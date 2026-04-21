import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { executeWorkflow } from "@/lib/workflow-engine";

// Vercel Cron Job — 每天 10:00 UTC 触发
// 执行所有 triggerType="schedule" + triggerConfig.cronType="social" 的工作流
// 用于 PM01 自动发布当日社媒内容（推文、LinkedIn、Telegram Channel）

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  console.log(`[Cron Social] 触发于 ${now.toISOString()}`);

  try {
    // 查找所有 social 类型的 active scheduled workflows
    const workflows = await prisma.workflow.findMany({
      where: { status: "active", triggerType: "schedule" },
    });

    const socialWorkflows = workflows.filter((wf) => {
      try {
        const raw = wf.triggerConfig;
        const config: Record<string, unknown> | null = raw
          ? (typeof raw === "string" ? JSON.parse(raw) : (raw as Record<string, unknown>))
          : null;
        return config?.cronType === "social";
      } catch {
        return false;
      }
    });

    console.log(`[Cron Social] 找到 ${socialWorkflows.length} 个社媒发布工作流`);

    const results = [];
    for (const wf of socialWorkflows) {
      try {
        console.log(`[Cron Social] 执行: ${wf.name} (${wf.id})`);
        const run = await executeWorkflow(wf.id, {
          trigger:     "cron_social",
          triggeredAt: now.toISOString(),
          date:        now.toISOString().split("T")[0],
        });
        results.push({ workflowId: wf.id, name: wf.name, runId: run.id, status: "triggered" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[Cron Social] workflow ${wf.id} 失败:`, msg);
        results.push({ workflowId: wf.id, name: wf.name, status: "failed", error: msg });
      }
    }

    return NextResponse.json({
      ok:          true,
      triggeredAt: now.toISOString(),
      triggered:   socialWorkflows.length,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Cron Social] 错误:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
