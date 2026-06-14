/**
 * 拾趣审核自循环端点（阶段3）
 * ============================
 * 由 jarvis-cron.yml 定时 GET 调用（Bearer CRON_SECRET 鉴权），也可手动 curl 触发。
 * 做两件事：
 *   1) syncShiquKpis      —— 把拾趣运营指标同步进 Jarvis KpiSnapshot（数据管道）
 *   2) runShiquModeration —— 拉违规队列，对未提案过的逐条推 Telegram 交互审批按钮（提案，不擅自动手）
 * 设计：两步各自 try/catch，互不连累；KPI 同步失败不影响审核提案，反之亦然。
 */
import { NextRequest, NextResponse } from "next/server";
import { syncShiquKpis, runShiquModeration, getShiquProjectId } from "@/lib/integrations/shiqu";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  // 鉴权：与其它 cron 端点一致
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result: { kpi: string; moderation: unknown } = { kpi: "skipped", moderation: null };

  // ① KPI 同步（失败不影响审核）
  try {
    const projectId = await getShiquProjectId();
    await syncShiquKpis(projectId);
    result.kpi = "ok";
  } catch (err) {
    console.error("[Cron/shiqu] KPI 同步失败:", String(err));
    result.kpi = `error: ${String(err instanceof Error ? err.message : err)}`;
  }

  // ② 审核提案（核心）
  try {
    result.moderation = await runShiquModeration();
  } catch (err) {
    console.error("[Cron/shiqu] 审核提案失败:", String(err));
    result.moderation = { error: String(err instanceof Error ? err.message : err) };
  }

  return NextResponse.json({ ok: true, ...result });
}
