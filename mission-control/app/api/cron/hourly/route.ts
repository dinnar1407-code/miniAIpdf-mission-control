import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { executeWorkflow } from "@/lib/workflow-engine";
import { expireOldRequests } from "@/lib/approval";

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
        const resp = await fetch(url, {
          method: "HEAD",
          timeout: 5000,
        });
        apiStatus[name] = resp.ok || resp.status < 500;
      } catch {
        apiStatus[name] = false;
      }
    }

    console.log(`[Cron Hourly] API 状态检查完成:`, apiStatus);

    return NextResponse.json({
      ok: true,
      triggeredAt: now.toISOString(),
      triggered: hourlyWorkflows.length,
      expired: expiredCount,
      results,
      apiStatus,
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
