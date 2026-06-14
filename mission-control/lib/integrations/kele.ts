/**
 * kele-quant（可乐量化）集成 — L0 监控简报层
 *
 * 只读拉取可乐的公开 API（无需鉴权、无副作用），把组合状态汇总成晨报里的一段。
 * 设计原则（见 Obsidian 10-可乐×Jarvis 畅想）：
 *   - L0 只做"看"，不写库、不触发 Observer/Plan（避免给未验证策略造自动闭环）。
 *   - 可乐挂了不能拖垮晨报：拉取失败返回 { ok:false }，由调用方降级显示。
 *
 * 环境变量：
 *   - KELE_BASE_URL：可乐服务地址（默认指向生产 Railway 域名，可覆盖；设为空串=关闭集成）。
 */

// 可乐生产地址（公开只读端点，非密钥）；可用环境变量覆盖
const DEFAULT_KELE_BASE_URL = "https://app-production-d90b.up.railway.app";

// 资产超过此时长没 tick 视为"数据停更"（可乐每小时 tick 一次，>3h = 连漏好几次）
const STALE_MS = 3 * 60 * 60 * 1000;

// regime：0=死寂 1=牛市 2=恐慌（与可乐 signal/regime 对齐）
const REGIME_LABEL: Record<number, { emoji: string; text: string }> = {
  0: { emoji: "💤", text: "死寂" },
  1: { emoji: "🐂", text: "牛市" },
  2: { emoji: "🔴", text: "恐慌" },
};

interface KeleOverviewAsset {
  last_tick_ms?: number;
  last_error?: string | null;
  regime?: number;
  equity?: number;
  cash?: number;
}

interface KeleOverview {
  watch_mode?: boolean;
  live_trading?: boolean;
  scheduler_started?: boolean;
  assets?: Record<string, KeleOverviewAsset>;
  equity_curve?: { ts: number; v: number }[];
}

export interface KeleSummary {
  ok: boolean;
  error?: string;
  watchMode: boolean;
  liveTrading: boolean;
  schedulerStarted: boolean;
  assetCount: number;
  totalEquity: number;          // 各资产模拟盘权益合计
  investedRatio: number;        // 持仓占比 =(权益-现金)/权益
  regimeCounts: Record<number, number>; // {0:n,1:n,2:n}
  panicAssets: string[];        // regime==2 的标的
  errorAssets: { symbol: string; error: string }[];
  staleAssets: string[];        // last_tick_ms 超过 STALE_MS 没更新的标的
}

function baseUrl(): string | null {
  // 显式设为空串 = 关闭集成；未设 = 用默认生产地址
  const v = process.env.KELE_BASE_URL;
  if (v === "") return null;
  return v || DEFAULT_KELE_BASE_URL;
}

/**
 * 拉取可乐组合摘要。永不抛错——失败返回 { ok:false }，让晨报降级显示。
 * 集成被显式关闭（KELE_BASE_URL=""）时返回 null。
 */
export async function fetchKeleSummary(): Promise<KeleSummary | null> {
  const base = baseUrl();
  if (!base) return null;

  const empty = {
    watchMode: false,
    liveTrading: false,
    schedulerStarted: false,
    assetCount: 0,
    totalEquity: 0,
    investedRatio: 0,
    regimeCounts: {} as Record<number, number>,
    panicAssets: [] as string[],
    errorAssets: [] as { symbol: string; error: string }[],
    staleAssets: [] as string[],
  };

  try {
    // 8s 超时，避免可乐慢响应拖垮整封晨报（briefing maxDuration=60）
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${base}/api/overview`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}`, ...empty };
    }

    const data = (await res.json()) as KeleOverview;
    const assets = data.assets ?? {};
    const entries = Object.entries(assets);

    let totalEquity = 0;
    let totalCash = 0;
    const regimeCounts: Record<number, number> = {};
    const panicAssets: string[] = [];
    const errorAssets: { symbol: string; error: string }[] = [];
    const staleAssets: string[] = [];
    const now = Date.now();

    for (const [symbol, a] of entries) {
      if (typeof a.equity === "number") totalEquity += a.equity;
      if (typeof a.cash === "number") totalCash += a.cash;
      if (typeof a.regime === "number") {
        regimeCounts[a.regime] = (regimeCounts[a.regime] ?? 0) + 1;
        if (a.regime === 2) panicAssets.push(symbol);
      }
      if (a.last_error) errorAssets.push({ symbol, error: a.last_error });
      // last_tick_ms===0 = 刚播种还没首次 tick（重启后短暂状态），不算停更，避免误报
      if (typeof a.last_tick_ms === "number" && a.last_tick_ms > 0 && now - a.last_tick_ms > STALE_MS) {
        staleAssets.push(symbol);
      }
    }

    const investedRatio =
      totalEquity > 0 ? (totalEquity - totalCash) / totalEquity : 0;

    return {
      ok: true,
      watchMode: Boolean(data.watch_mode),
      liveTrading: Boolean(data.live_trading),
      schedulerStarted: Boolean(data.scheduler_started),
      assetCount: entries.length,
      totalEquity,
      investedRatio,
      regimeCounts,
      panicAssets,
      errorAssets,
      staleAssets,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : "unknown";
    console.error("[kele] fetchKeleSummary 失败:", error);
    return { ok: false, error, ...empty };
  }
}

/** 把可乐摘要格式化成晨报里的若干行（Markdown）。 */
export function formatKeleBriefingLines(s: KeleSummary): string[] {
  const lines: string[] = ["*🥤 可乐量化*"];

  if (!s.ok) {
    lines.push(`⚠️ 无法连接可乐（${s.error ?? "未知错误"}）`);
    return lines;
  }

  const equity = s.totalEquity.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
  lines.push(
    `合计权益 $${equity} · 持仓 ${(s.investedRatio * 100).toFixed(0)}% · ${s.assetCount} 标的`
  );

  // 市况分布（按 死寂/牛市/恐慌 顺序）
  const regimeParts = [0, 1, 2]
    .map((r) => {
      const n = s.regimeCounts[r] ?? 0;
      if (!n) return null;
      const lbl = REGIME_LABEL[r];
      return `${lbl.emoji}${n} ${lbl.text}`;
    })
    .filter(Boolean);
  if (regimeParts.length) lines.push(`市况 ${regimeParts.join(" · ")}`);

  if (s.panicAssets.length) {
    lines.push(`🔴 恐慌态：${s.panicAssets.join(", ")}`);
  }
  if (s.errorAssets.length) {
    lines.push(
      `⚠️ ${s.errorAssets.length} 资产数据异常：${s.errorAssets
        .map((e) => e.symbol)
        .join(", ")}`
    );
  }
  if (s.watchMode) lines.push("👁 观望模式开启");
  if (!s.schedulerStarted) lines.push("⚠️ 调度器未运行");

  return lines;
}

// ── L1 健康监控：从摘要里识别"可乐自身的故障"（可乐宕了没法给自己报警）──

export interface KeleHealthIssue {
  severity: "critical" | "high";
  message: string; // 给 Telegram/Alert 用的纯文本说明
}

/**
 * 识别可乐健康问题，合并成**一条**告警（无问题返回 null）。
 * 覆盖：服务打不通 / 调度器未运行 / 资产数据异常 / 资产数据停更。
 * 纯函数（不发通知、不写库）——编排在调用方（hourly cron）做去重 + Alert + Telegram。
 */
export function detectKeleHealthIssues(s: KeleSummary): KeleHealthIssue | null {
  // 服务整体打不通：最高级别（注意：调用方应只在持续失败时才升级，避免单次抖动误报）
  if (!s.ok) {
    return { severity: "critical", message: `可乐服务无法访问（${s.error ?? "未知错误"}）` };
  }

  const problems: string[] = [];
  let severity: "critical" | "high" = "high";

  if (!s.schedulerStarted) {
    problems.push("调度器未运行（不再产生交易决策）");
    severity = "critical";
  }
  if (s.errorAssets.length) {
    problems.push(
      `${s.errorAssets.length} 个资产数据异常：${s.errorAssets.map((e) => e.symbol).join(", ")}`
    );
  }
  if (s.staleAssets.length) {
    problems.push(`${s.staleAssets.length} 个资产数据停更(>3h)：${s.staleAssets.join(", ")}`);
  }

  if (!problems.length) return null;
  return { severity, message: problems.join("；") };
}
