import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { executeWorkflow } from "@/lib/workflow-engine";

// Vercel Cron Job — 每天 9:00 UTC 触发
// 触发所有状态为 active 且 triggerType = "schedule" 的 workflow
// 安全：仅允许来自 Vercel Cron 或持有 CRON_SECRET 的请求

export const maxDuration = 300; // 5分钟超时

export async function GET(req: NextRequest) {
  // 验证 Cron 请求来源
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  console.log(`[Cron] 触发于 ${now.toISOString()}`);

  try {
    // 查找所有需要执行的 scheduled workflows
    const workflows = await prisma.workflow.findMany({
      where: {
        status:      "active",
        triggerType: "schedule",
      },
    });

    console.log(`[Cron] 找到 ${workflows.length} 个待执行 workflow`);

    if (workflows.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "没有需要执行的 scheduled workflow",
        triggeredAt: now.toISOString(),
      });
    }

    // 串行执行（避免并发占用太多资源）
    const results = [];
    for (const wf of workflows) {
      try {
        console.log(`[Cron] 执行 workflow: ${wf.name} (${wf.id})`);
        const run = await executeWorkflow(wf.id, { trigger: "cron", triggeredAt: now.toISOString() });
        results.push({ workflowId: wf.id, name: wf.name, runId: run.id, status: "triggered" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[Cron] workflow ${wf.id} 执行失败:`, msg);
        results.push({ workflowId: wf.id, name: wf.name, status: "failed", error: msg });
      }
    }

    return NextResponse.json({
      ok: true,
      triggeredAt: now.toISOString(),
      total: workflows.length,
      results,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Cron] 错误:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// POST /api/cron — 手动触发单个 workflow（需要 CRON_SECRET）
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json() as { workflowId?: string };
    if (!body.workflowId) {
      return NextResponse.json({ error: "workflowId 必填" }, { status: 400 });
    }

    const run = await executeWorkflow(body.workflowId, {
      trigger: "manual_cron",
      triggeredAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, runId: run.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
