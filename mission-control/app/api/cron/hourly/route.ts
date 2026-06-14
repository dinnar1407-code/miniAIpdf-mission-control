import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { executeWorkflow } from "@/lib/workflow-engine";
import { expireOldRequests } from "@/lib/approval";
import { listConversations } from "@/lib/integrations/tidio";
import { syncGARealtimeKpis } from "@/lib/integrations/ga";
import { fetchKeleSummary, detectKeleHealthIssues, assessDrawdown, detectUnderperformAlert } from "@/lib/integrations/kele";
import { sendTelegram } from "@/lib/telegram";

// MiniAIPDF project ID — GA4 property is tracked against this project
const MINIAIPDF_ID = "cmo21zrhd00029rvsyv1n2you";

// Vercel Cron Job — 每小时执行
// 1. 触发所有 triggerType="schedule" + triggerConfig.cronType="hourly" 的 workflow
// 2. 调用 expireOldRequests()（清理超时审批）
// 3. 检查各平台 API 状态（简单 ping 检测）

export const maxDuration = 300; // 5分钟超时

export async function GET(req: NextRequest) {
  // 验证 Cron 请求来源
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  console.log(`[Cron Hourly] 触发于 ${now.toISOString()}`);

  try {
    // ==================== 查找所有 hourly 的 scheduled workflows ====================
    const workflows = await prisma.workflow.findMany({
      where: {
        status: "active",
        triggerType: "schedule",
      },
    });

    const hourlyWorkflows = workflows.filter((wf) => {
      try {
        const raw = wf.triggerConfig;
        const config: Record<string, unknown> | null = raw
          ? (typeof raw === "string" ? JSON.parse(raw) : raw as Record<string, unknown>)
          : null;
        return config && config.cronType === "hourly";
      } catch {
        return false;
      }
    });

    console.log(
      `[Cron Hourly] 找到 ${hourlyWorkflows.length} 个待执行 hourly workflow`
    );

    // ==================== 执行 hourly workflows ====================
    const results = [];
    for (const wf of hourlyWorkflows) {
      try {
        console.log(`[Cron Hourly] 执行 workflow: ${wf.name} (${wf.id})`);
        const run = await executeWorkflow(wf.id, {
          trigger: "cron_hourly",
          triggeredAt: now.toISOString(),
        });
        results.push({
          workflowId: wf.id,
          name: wf.name,
          runId: run.id,
          status: "triggered",
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[Cron Hourly] workflow ${wf.id} 执行失败:`, msg);
        results.push({
          workflowId: wf.id,
          name: wf.name,
          status: "failed",
          error: msg,
        });
      }
    }

    // ==================== 清理超时审批 ====================
    let expiredCount = 0;
    try {
      console.log(`[Cron Hourly] 开始清理超时审批...`);
      await expireOldRequests();
      const expiredRequests = await prisma.approvalRequest.findMany({
        where: {
          status: "expired",
          respondedAt: {
            gte: new Date(now.getTime() - 60 * 1000), // 最近 1 分钟内标记为 expired
          },
        },
      });
      expiredCount = expiredRequests.length;
      console.log(
        `[Cron Hourly] 清理了 ${expiredCount} 个超时审批请求`
      );
    } catch (err) {
      console.error(`[Cron Hourly] 清理审批失败:`, err);
    }

    // ==================== 检查 API 状态 ====================
    const apiStatus: Record<string, boolean> = {};
    const apis = {
      stripe: "https://api.stripe.com/v1/subscriptions?limit=1",
      google: "https://www.google.com",
      telegram: "https://api.telegram.org",
    };

    for (const [name, url] of Object.entries(apis)) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const resp = await fetch(url, { method: "HEAD", signal: controller.signal });
        clearTimeout(timer);
        apiStatus[name] = resp.ok || resp.status < 500;
      } catch {
        apiStatus[name] = false;
      }
    }

    console.log(`[Cron Hourly] API 状态检查完成:`, apiStatus);

    // ==================== Tidio 超时未回复检查 ====================
    const STALE_HOURS  = 4;   // 超过 4 小时未更新视为需要跟进
    let tidioAlertSent = false;
    try {
      if (process.env.TIDIO_API_KEY) {
        const { conversations } = await listConversations({ status: "open", limit: 50 });
        const stale = conversations.filter(c => {
          const ms = Date.now() - new Date(c.updated_at).getTime();
          return ms > STALE_HOURS * 3600_000;
        });

        if (stale.length > 0) {
          const token  = process.env.TELEGRAM_BOT_TOKEN;
          const chatId = process.env.TELEGRAM_CHAT_ID;
          if (token && chatId) {
            const lines = stale.slice(0, 5).map(c => {
              const hours = ((Date.now() - new Date(c.updated_at).getTime()) / 3600_000).toFixed(1);
              return `  • ${c.contact?.email ?? c.id}（等待 ${hours}h）`;
            });
            const more = stale.length > 5 ? `\n  ...还有 ${stale.length - 5} 条` : "";
            const msg  = `⏰ *Tidio 客服提醒*\n${stale.length} 条对话超过 ${STALE_HOURS}h 未回复:\n${lines.join("\n")}${more}`;
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "Markdown" }),
            });
            tidioAlertSent = true;
            console.log(`[Cron Hourly] Tidio 超时告警已发送，${stale.length} 条对话`);
          }
        }
      }
    } catch (err) {
      console.error(`[Cron Hourly] Tidio 检查失败:`, err instanceof Error ? err.message : err);
    }

    // ==================== GA4 实时监控 ====================
    const gaStatus: { ok: boolean; activeUsers?: number; anomaly?: string; error?: string } = { ok: false };
    try {
      const currentUsers = await syncGARealtimeKpis(MINIAIPDF_ID);
      gaStatus.ok          = true;
      gaStatus.activeUsers = currentUsers;

      // 取过去 24 小时的快照计算基线（至少需要 6 个数据点）
      const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const recent = await prisma.kpiSnapshot.findMany({
        where: {
          projectId: MINIAIPDF_ID,
          metric:    "ga_realtime_users",
          date:      { gte: since24h },
        },
        orderBy: { date: "asc" },
      });

      if (recent.length >= 6) {
        const avg = recent.reduce((s, r) => s + r.value, 0) / recent.length;

        let anomaly: { type: "spike" | "drop"; severity: "high" | "critical"; msg: string } | null = null;

        if (currentUsers > avg * 2.5 && currentUsers > 5) {
          anomaly = {
            type:     "spike",
            severity: currentUsers > avg * 5 ? "critical" : "high",
            msg:      `📈 GA4 流量飙升！当前活跃用户 ${currentUsers}（24h均值 ${avg.toFixed(1)}，+${((currentUsers / avg - 1) * 100).toFixed(0)}%）`,
          };
        } else if (avg > 5 && currentUsers < avg * 0.2) {
          anomaly = {
            type:     "drop",
            severity: "critical",
            msg:      `📉 GA4 流量骤降！当前活跃用户 ${currentUsers}（24h均值 ${avg.toFixed(1)}，-${((1 - currentUsers / avg) * 100).toFixed(0)}%）`,
          };
        }

        if (anomaly) {
          gaStatus.anomaly = anomaly.type;
          // 写入 Alert（仅当最近 2h 没有同类告警时）
          const recentAlert = await prisma.alert.findFirst({
            where: {
              projectId: MINIAIPDF_ID,
              source:    "ga4_realtime",
              status:    { in: ["new", "acknowledged"] },
              createdAt: { gte: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
            },
          });
          if (!recentAlert) {
            await prisma.alert.create({
              data: {
                projectId: MINIAIPDF_ID,
                severity:  anomaly.severity,
                source:    "ga4_realtime",
                message:   anomaly.msg,
                status:    "new",
              },
            });
            void sendTelegram(
              `🚨 *GA4 实时异常*\n\n` +
              `${anomaly.msg}\n\n` +
              `项目: 📄 MiniAIPDF\n` +
              `时间: ${now.toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai" })}`
            );
          }
        }
      }
      console.log(`[Cron Hourly] GA4 实时用户: ${currentUsers}，样本数: ${recent.length}`);
    } catch (err) {
      gaStatus.ok    = false;
      gaStatus.error = err instanceof Error ? err.message : String(err);
      console.error("[Cron Hourly] GA4 实时监控失败:", gaStatus.error);
    }

    // ==================== 可乐量化健康监控（L1 智能预警）====================
    // 可乐自己宕了没法给自己报警——这里由 Jarvis 代为盯防。只读、写 Alert 去重、不触发自动计划。
    const keleHealth: { ok: boolean; issue?: string; alerted?: boolean } = { ok: true };
    const keleDrawdown: { tracked: boolean; equity?: number; drawdown?: number; alerted?: boolean } = { tracked: false };
    const keleUnderperform: { count: number; alerted?: boolean } = { count: 0 };
    try {
      let kele = await fetchKeleSummary();
      // 单次打不通可能是网络抖动：重试一次，两次都失败才当真，降低误报
      if (kele && !kele.ok) {
        await new Promise((r) => setTimeout(r, 2000));
        kele = await fetchKeleSummary();
      }
      if (kele) {
        const issue = detectKeleHealthIssues(kele);
        if (issue) {
          keleHealth.ok = false;
          keleHealth.issue = issue.message;
          // 去重：6h 内已有同源未处理告警则不重复推送（避免每小时刷屏）
          const recentAlert = await prisma.alert.findFirst({
            where: {
              source: "kele_health",
              status: { in: ["new", "acknowledged"] },
              createdAt: { gte: new Date(now.getTime() - 6 * 60 * 60 * 1000) },
            },
          });
          if (!recentAlert) {
            await prisma.alert.create({
              data: {
                projectId: null,
                severity: issue.severity,
                source: "kele_health",
                message: `可乐健康异常：${issue.message}`,
                status: "new",
              },
            });
            void sendTelegram(
              `🩺 *可乐量化 · 健康告警*\n\n` +
              `${issue.message}\n\n` +
              `严重度: ${issue.severity}\n` +
              `时间: ${now.toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai" })}`
            );
            keleHealth.alerted = true;
            console.log(`[Cron Hourly] 可乐健康告警已发送: ${issue.message}`);
          }
        }

        // ——— 组合回撤预警(L1)：Jarvis 自存可靠权益序列 → 峰值算回撤 ———
        if (kele.ok && kele.totalEquity > 0) {
          // 按小时 upsert 组合权益（projectId=null → Observer 不扫描、不会触发自动计划）
          const hourBucket = new Date(now);
          hourBucket.setMinutes(0, 0, 0);
          const snapId = `kele_equity_${hourBucket.toISOString().slice(0, 13)}`;
          await prisma.kpiSnapshot.upsert({
            where:  { id: snapId },
            create: { id: snapId, date: hourBucket, projectId: null, source: "kele", metric: "kele_portfolio_equity", value: kele.totalEquity },
            update: { value: kele.totalEquity },
          });
          // 近 30 天序列求峰值（含刚写入的当前点，故峰值≥当前→回撤≥0）
          const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          const series = await prisma.kpiSnapshot.findMany({
            where:   { projectId: null, metric: "kele_portfolio_equity", date: { gte: since30d } },
            orderBy: { date: "asc" },
          });
          const peak = series.reduce((m, s) => Math.max(m, s.value), kele.totalEquity);
          keleDrawdown.tracked  = true;
          keleDrawdown.equity   = kele.totalEquity;
          keleDrawdown.drawdown = peak > 0 ? (peak - kele.totalEquity) / peak : 0;

          const dd = assessDrawdown(peak, kele.totalEquity);
          if (dd) {
            // 去重：6h 内已有同源未处理告警则不重复
            const recentDd = await prisma.alert.findFirst({
              where: {
                source:    "kele_drawdown",
                status:    { in: ["new", "acknowledged"] },
                createdAt: { gte: new Date(now.getTime() - 6 * 60 * 60 * 1000) },
              },
            });
            if (!recentDd) {
              const pct = (dd.drawdown * 100).toFixed(1);
              const msg = `组合权益自峰值回撤 ${pct}%（当前 $${Math.round(kele.totalEquity).toLocaleString("en-US")}）`;
              await prisma.alert.create({
                data: { projectId: null, severity: dd.severity, source: "kele_drawdown", message: `可乐组合回撤：${msg}`, status: "new" },
              });
              void sendTelegram(
                `📉 *可乐量化 · 回撤预警*\n\n${msg}\n严重度: ${dd.severity}\n` +
                `时间: ${now.toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai" })}`
              );
              keleDrawdown.alerted = true;
              console.log(`[Cron Hourly] 可乐回撤告警已发送: ${msg}`);
            }
          }
        }

        // ——— 跑输 DCA 基准预警(L1)：资产 equity 持续低于无脑 DCA 基准 ———
        if (kele.ok && kele.underperformers.length) {
          keleUnderperform.count = kele.underperformers.length;
          const up = detectUnderperformAlert(kele.underperformers);
          if (up) {
            const recentUp = await prisma.alert.findFirst({
              where: {
                source:    "kele_underperform",
                status:    { in: ["new", "acknowledged"] },
                createdAt: { gte: new Date(now.getTime() - 6 * 60 * 60 * 1000) },
              },
            });
            if (!recentUp) {
              await prisma.alert.create({
                data: { projectId: null, severity: up.severity, source: "kele_underperform", message: `可乐${up.message}`, status: "new" },
              });
              void sendTelegram(
                `📊 *可乐量化 · 跑输基准*\n\n${up.message}\n严重度: ${up.severity}\n` +
                `时间: ${now.toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai" })}`
              );
              keleUnderperform.alerted = true;
              console.log(`[Cron Hourly] 可乐跑输基准告警已发送: ${up.message}`);
            }
          }
        }
      }
    } catch (err) {
      console.error("[Cron Hourly] 可乐健康监控失败:", err instanceof Error ? err.message : err);
    }

    return NextResponse.json({
      ok: true,
      triggeredAt: now.toISOString(),
      triggered: hourlyWorkflows.length,
      expired: expiredCount,
      results,
      apiStatus,
      tidioAlertSent,
      gaRealtime: gaStatus,
      keleHealth,
      keleDrawdown,
      keleUnderperform,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Cron Hourly] 错误:", message);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
