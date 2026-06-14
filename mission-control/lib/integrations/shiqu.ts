/**
 * 拾趣（ShiQu）二手平台集成 —— Jarvis 阶段3「自主运营大脑」
 * ============================================================
 * 角色：拾趣是货架（交易场 + 数据 + 站内 AI），Jarvis 是运营大脑。
 * 本适配层让 Jarvis 能：
 *   1) syncShiquKpis()        —— 把拾趣运营指标同步进 Jarvis 的 KpiSnapshot（喂 Observer / 仪表盘）
 *   2) runShiquModeration()   —— 审核「提案」：拉违规队列 → 逐条推 Telegram 交互审批按钮（不擅自动手）
 * 配套：用户在 Telegram 点「批准下架/保留」→ webhook 回调里调 ShiquClient.removeContent 执行（人类签字）。
 *
 * 凭证读取优先级（对齐 shopify.ts 习惯）：DB ChannelCredential(channelId="shiqu") → 环境变量。
 * 设计原则：纯只读拉数 + 仅一个写动作（下架，且可逆），不碰拾趣其它系统。
 */
import { prisma } from "@/lib/db";
import { sendTelegramWithButtons } from "@/lib/telegram";

// ==================== 类型 ====================

export interface ShiquConfig {
  baseUrl:   string; // https://shiqu-production.up.railway.app
  adminUser: string; // 运营 admin 账号
  adminPass: string;
}

/** 拾趣近 N 日运营汇总（对应拾趣 /api/admin/stats 的 totals） */
export interface ShiquTotals {
  dau:        number;
  newUsers:   number;
  publishes:  number;
  orders:     number;
  gmv:        number;
  aiCalls:    number;
}

/** 审核队列里的一条违规嫌疑内容（对应拾趣 mapModerationItem） */
export interface ShiquModerationItem {
  id:          number;                 // moderation 行 id（下架时用它）
  targetType:  "goods" | "note";
  targetId:    number;
  status:      "approved" | "flagged" | "removed";
  aiReason:    string;                 // 拾趣站内 AI 给出的标记理由
  targetTitle: string;
  createdAt:   string;
}

// ==================== 客户端 ====================

export class ShiquClient {
  private baseUrl: string;
  private adminUser: string;
  private adminPass: string;
  private token: string | null = null;

  constructor(config: ShiquConfig) {
    // 去掉结尾斜杠，避免拼出双斜杠的 URL
    this.baseUrl   = config.baseUrl.replace(/\/+$/, "");
    this.adminUser = config.adminUser;
    this.adminPass = config.adminPass;
  }

  /** 带超时的 fetch，避免拾趣慢响应把整个 cron 拖死 */
  private async http(path: string, init: RequestInit = {}, timeoutMs = 30000): Promise<Response> {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(`${this.baseUrl}${path}`, { ...init, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  /** 登录拿 admin token（懒加载，整个实例生命周期复用一次） */
  private async auth(): Promise<string> {
    if (this.token) return this.token;
    const res = await this.http("/api/auth/login", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ username: this.adminUser, password: this.adminPass }),
    });
    if (!res.ok) throw new Error(`拾趣登录失败 HTTP ${res.status}`);
    const data = (await res.json()) as { token?: string; user?: { isAdmin?: number } };
    if (!data.token) throw new Error("拾趣登录响应无 token");
    if (data.user && data.user.isAdmin !== 1) throw new Error("该账号非 admin，拉不到运营数据");
    this.token = data.token;
    return this.token;
  }

  private async authedHeaders(): Promise<Record<string, string>> {
    const token = await this.auth();
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }

  /** 近 N 日运营汇总 */
  async getStats(days = 7): Promise<ShiquTotals> {
    const res = await this.http(`/api/admin/stats?days=${days}`, { headers: await this.authedHeaders() });
    if (!res.ok) throw new Error(`拾趣 stats 失败 HTTP ${res.status}`);
    const data = (await res.json()) as { totals?: Partial<ShiquTotals> };
    const t = data.totals ?? {};
    // 缺字段一律兜底 0，保证下游算 delta / 写库不出 NaN
    return {
      dau:       Number(t.dau)       || 0,
      newUsers:  Number(t.newUsers)  || 0,
      publishes: Number(t.publishes) || 0,
      orders:    Number(t.orders)    || 0,
      gmv:       Number(t.gmv)       || 0,
      aiCalls:   Number(t.aiCalls)   || 0,
    };
  }

  /** 违规嫌疑队列（默认 flagged，待人审） */
  async getModerationQueue(status: "flagged" = "flagged"): Promise<ShiquModerationItem[]> {
    const res = await this.http(`/api/admin/moderation?status=${status}&page=1`, {
      headers: await this.authedHeaders(),
    });
    if (!res.ok) throw new Error(`拾趣审核队列失败 HTTP ${res.status}`);
    const data = (await res.json()) as { items?: ShiquModerationItem[] };
    return data.items ?? [];
  }

  /** 下架一条违规内容（唯一写动作；可逆——运营台可恢复） */
  async removeContent(moderationId: number): Promise<boolean> {
    const res = await this.http(`/api/admin/moderation/${moderationId}/remove`, {
      method:  "POST",
      headers: await this.authedHeaders(),
      body:    "{}",
    });
    return res.ok;
  }
}

// ==================== 工厂 + 业务函数 ====================

/** 读凭证造客户端：DB ChannelCredential 优先，回退环境变量；都没有返回 null（调用方降级跳过） */
export async function getShiquClient(): Promise<ShiquClient | null> {
  try {
    const cred = await prisma.channelCredential.findUnique({ where: { channelId: "shiqu" } });
    if (cred?.enabled) {
      const c = JSON.parse(cred.credentials) as Record<string, string>;
      if (c.baseUrl && c.adminUser && c.adminPass) {
        return new ShiquClient({ baseUrl: c.baseUrl, adminUser: c.adminUser, adminPass: c.adminPass });
      }
    }
  } catch {
    // ChannelCredential 表查不到 / JSON 坏了都不致命，继续回退环境变量
  }

  const baseUrl   = process.env.SHIQU_BASE_URL;
  const adminUser = process.env.SHIQU_ADMIN_USER;
  const adminPass = process.env.SHIQU_ADMIN_PASS;
  if (baseUrl && adminUser && adminPass) {
    return new ShiquClient({ baseUrl, adminUser, adminPass });
  }
  return null;
}

/** 找拾趣在 Jarvis 里的 Project id；供 KPI / Memory 归属（没有则返回 null） */
export async function getShiquProjectId(): Promise<string | null> {
  try {
    const p = await prisma.project.findUnique({ where: { slug: "shiqu" } });
    return p?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * 把拾趣运营指标同步进 Jarvis 的 KpiSnapshot。
 * 每个指标写一行（source="shiqu"），delta = 与上一次同指标的差值（喂 Observer 找异常）。
 */
export async function syncShiquKpis(projectId: string | null): Promise<void> {
  const shiqu = await getShiquClient();
  if (!shiqu) {
    console.warn("[Shiqu] 未配置凭证，跳过 KPI 同步");
    return;
  }

  const totals = await shiqu.getStats(7);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // 指标清单：metric 名加 shiqu_ 前缀，避免和其它 source 撞名
  const metrics: Array<{ metric: string; value: number }> = [
    { metric: "shiqu_dau",       value: totals.dau },
    { metric: "shiqu_new_users", value: totals.newUsers },
    { metric: "shiqu_publishes", value: totals.publishes },
    { metric: "shiqu_orders",    value: totals.orders },
    { metric: "shiqu_gmv",       value: totals.gmv },
    { metric: "shiqu_ai_calls",  value: totals.aiCalls },
  ];

  for (const m of metrics) {
    // 算 delta：取「当天之前」最近一行，避免同日重跑时拿到刚写的今天那行导致 delta=0 失真
    const prev = await prisma.kpiSnapshot.findFirst({
      where:   { source: "shiqu", metric: m.metric, date: { lt: today } },
      orderBy: { date: "desc" },
    });
    const delta = prev ? m.value - prev.value : null;

    // 幂等：当天同指标已有行就更新（手动重跑/重试不会堆重复），否则新建
    const todayRow = await prisma.kpiSnapshot.findFirst({
      where: { source: "shiqu", metric: m.metric, date: today },
    });
    if (todayRow) {
      await prisma.kpiSnapshot.update({
        where: { id: todayRow.id },
        data:  { value: m.value, delta: delta ?? undefined, projectId: projectId ?? undefined },
      });
    } else {
      await prisma.kpiSnapshot.create({
        data: {
          date:      today,
          projectId: projectId ?? undefined,
          source:    "shiqu",
          metric:    m.metric,
          value:     m.value,
          delta:     delta ?? undefined,
          metadata:  JSON.stringify({ window: "7d" }),
        },
      });
    }
  }
  console.log(`[Shiqu] KPI 同步完成：${metrics.length} 项`);
}

/**
 * 审核「提案」：阶段3 核心 —— Jarvis 不擅自动手，而是把拾趣的违规嫌疑逐条推 Telegram 让你一键签字。
 * 幂等：已经提过案（ShiquModerationRequest 里有同 shiquModId 记录）的跳过，避免重复打扰。
 * 返回 {proposed, skipped, queue} 供 cron 端点汇报。
 */
export async function runShiquModeration(): Promise<{ proposed: number; skipped: number; queue: number }> {
  const shiqu = await getShiquClient();
  if (!shiqu) {
    console.warn("[Shiqu] 未配置凭证，跳过审核提案");
    return { proposed: 0, skipped: 0, queue: 0 };
  }

  const queue = await shiqu.getModerationQueue("flagged");
  let proposed = 0;
  let skipped  = 0;

  for (const item of queue) {
    const shiquModId = String(item.id);

    // 幂等：这条已经提过案就不再推
    const exists = await prisma.shiquModerationRequest.findUnique({ where: { shiquModId } });
    if (exists) { skipped++; continue; }

    // 落库（pending），再推 Telegram 带按钮——按钮 callback_data 引用本记录 id
    const reqRow = await prisma.shiquModerationRequest.create({
      data: {
        shiquModId,
        targetType:  item.targetType,
        targetTitle: item.targetTitle?.slice(0, 200) ?? "(无标题)",
        aiReason:    item.aiReason?.slice(0, 500) ?? "",
        status:      "pending",
      },
    });

    const text = [
      "🛡️ *拾趣审核 · 请你定夺*",
      "",
      `*${item.targetType === "goods" ? "商品" : "笔记"}*：${item.targetTitle || "(无标题)"}`,
      `*AI 标记理由*：${item.aiReason || "(无)"}`,
      "",
      "拾趣站内 AI 已判定为违规嫌疑。是否下架？（下架可逆，运营台随时可恢复）",
    ].join("\n");

    await sendTelegramWithButtons(text, [[
      { text: "✅ 批准下架", callback_data: `shiqu_remove:${reqRow.id}` },
      { text: "↩️ 保留",     callback_data: `shiqu_keep:${reqRow.id}` },
    ]]);

    proposed++;
  }

  console.log(`[Shiqu] 审核提案：队列 ${queue.length} 条，新提案 ${proposed}，跳过 ${skipped}`);
  return { proposed, skipped, queue: queue.length };
}
