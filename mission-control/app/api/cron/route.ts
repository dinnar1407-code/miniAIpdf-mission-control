import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { executeWorkflow } from "@/lib/workflow-engine";

// Vercel Cron Job — 建议 vercel.json schedule 改为 "0 * * * *"（每小时）
// 根据每个 workflow 的 cronExpression 字段决定本次是否执行
// 安全：仅允许来自 Vercel Cron 或持有 CRON_SECRET 的请求

export const maxDuration = 300;

// Fix 2: 轻量级 5 字段 cron 匹配（UTC），支持 * , / - 语法
function matchesCronNow(expression: string | null | undefined, now: Date): boolean {
  if (!expression) return true; // 无表达式 = 每次都执行
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return true; // 格式不对 = 放行

  const [minute, hour, dom, month, dow] = parts;

  const matchField = (field: string, value: number): boolean => {
    if (field === "*") return true;
    if (field.includes(",")) return field.split(",").some(f => matchField(f.trim(), value));
    if (field.includes("/")) {
      const [range, step] = field.split("/");
      const stepNum = parseInt(step, 10);
      const start   = range === "*" ? 0 : parseInt(range, 10);
      return value >= start && (value - start) % stepNum === 0;
    }
    if (field.includes("-")) {
      const [lo, hi] = field.split("-").map(Number);
      return value >= lo && value <= hi;
    }
    return parseInt(field, 10) === value;
  };

  return (
    matchField(minute, now.getUTCMinutes())   &&
    matchField(hour,   now.getUTCHours())     &&
    matchField(dom,    now.getUTCDate())       &&
    matchField(month,  now.getUTCMonth() + 1) &&
    matchField(dow,    now.getUTCDay())
  );
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  console.log(`[Cron] 触发于 ${now.toISOString()}`);

  try {
    const allScheduled = await prisma.workflow.findMany({
      where: { status: "active", triggerType: "schedule" },
    });

    // Fix 2: 只执行 cronExpression 与当前时间匹配的 workflow
    const workflows = allScheduled.filter(wf => matchesCronNow(wf.cronExpression, now));

    console.log(`[Cron] 共 ${allScheduled.length} 个 scheduled，本次执行 ${workflows.length} 个`);

    if (workflows.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "本次 cron tick 无匹配的 workflow",
        triggeredAt: now.toISOString(),
      });
    }

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
