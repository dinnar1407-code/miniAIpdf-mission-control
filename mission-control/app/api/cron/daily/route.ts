import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { executeWorkflow } from "@/lib/workflow-engine";
import { syncStripeKpis } from "@/lib/integrations/stripe";
import { syncGSCKpis } from "@/lib/integrations/gsc";
import { syncGAKpis } from "@/lib/integrations/ga";
import { syncShopifyKpis } from "@/lib/integrations/shopify";
import { runEmailDrip, formatDripSummary } from "@/lib/email-drip";
import { runAngelScanner, formatAngelSummary } from "@/lib/angel-scanner";

async function sendTelegram(text: string): Promise<void> {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  }).catch(() => {});
}

// Vercel Cron Job — 每天 9:00 UTC 触发
// 1. 触发所有 triggerType="schedule" + triggerConfig.cronType="daily" 的 workflow
// 2. 触发 triggerType="schedule" + 没有 cronType（向后兼容）的 workflow
// 3. 同步 Stripe KPI
// 4. 同步 GSC KPI
// 5. 同步 GA KPI

export const maxDuration = 300; // 5分钟超时

export async function GET(req: NextRequest) {
  // 验证 Cron 请求来源
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  console.log(`[Cron Daily] 触发于 ${now.toISOString()}`);

  try {
    // ==================== 查找所有 daily 的 scheduled workflows ====================
    const workflows = await prisma.workflow.findMany({
      where: {
        status: "active",
        triggerType: "schedule",
      },
    });

    // 筛选出 daily workflows 或没有指定 cronType 的（向后兼容）
    const dailyWorkflows = workflows.filter((wf) => {
      try {
        const raw = wf.triggerConfig;
        const config: Record<string, unknown> | null = raw
          ? (typeof raw === "string" ? JSON.parse(raw) : raw as Record<string, unknown>)
          : null;
        if (!config) return true; // 没有 cronType，视为 daily
        if (config.cronType === "daily") return true;
        if (config.cronType === undefined || config.cronType === null)
          return true;
        return false;
      } catch {
        return true; // 解析失败，默认视为 daily
      }
    });

    console.log(
      `[Cron Daily] 找到 ${dailyWorkflows.length} 个待执行 daily workflow`
    );

    // ==================== 执行 daily workflows ====================
    const results = [];
    for (const wf of dailyWorkflows) {
      try {
        console.log(`[Cron Daily] 执行 workflow: ${wf.name} (${wf.id})`);
        const run = await executeWorkflow(wf.id, {
          trigger: "cron_daily",
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
        console.error(`[Cron Daily] workflow ${wf.id} 执行失败:`, msg);
        results.push({
          workflowId: wf.id,
          name: wf.name,
          status: "failed",
          error: msg,
        });
      }
    }

    // ==================== 同步 KPI ====================
    const kpiStatus: Record<string, { ok: boolean; error?: string }> = {};

    // 同步 Stripe KPI
    try {
      console.log(`[Cron Daily] 开始同步 Stripe KPI...`);
      await syncStripeKpis(null);
      kpiStatus.stripe = { ok: true };
      console.log(`[Cron Daily] Stripe KPI 同步成功`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[Cron Daily] Stripe KPI 同步失败:`, msg);
      kpiStatus.stripe = { ok: false, error: msg };
    }

    // 同步 GSC KPI
    try {
      console.log(`[Cron Daily] 开始同步 GSC KPI...`);
      await syncGSCKpis(null);
      kpiStatus.gsc = { ok: true };
      console.log(`[Cron Daily] GSC KPI 同步成功`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[Cron Daily] GSC KPI 同步失败:`, msg);
      kpiStatus.gsc = { ok: false, error: msg };
    }

    // 同步 GA KPI
    try {
      console.log(`[Cron Daily] 开始同步 GA KPI...`);
      await syncGAKpis(null);
      kpiStatus.ga = { ok: true };
      console.log(`[Cron Daily] GA KPI 同步成功`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[Cron Daily] GA KPI 同步失败:`, msg);
      kpiStatus.ga = { ok: false, error: msg };
    }

    // 同步 Shopify KPI（FurMates）
    try {
      console.log(`[Cron Daily] 开始同步 Shopify KPI...`);
      await syncShopifyKpis("proj_furmates");
      kpiStatus.shopify = { ok: true };
      console.log(`[Cron Daily] Shopify KPI 同步成功`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[Cron Daily] Shopify KPI 同步失败:`, msg);
      kpiStatus.shopify = { ok: false, error: msg };
    }

    // ==================== Email Drip 序列 ====================
    const dripStatus: { ok: boolean; sent?: number; error?: string } = { ok: false };
    try {
      console.log(`[Cron Daily] 开始 Email Drip 扫描...`);
      const dripResults = await runEmailDrip();
      const totalSent   = dripResults.reduce((s, r) => s + r.sent, 0);
      dripStatus.ok   = true;
      dripStatus.sent = totalSent;

      // 推送 Drip 摘要到 Telegram
      const summary = formatDripSummary(dripResults);
      if (totalSent > 0) await sendTelegram(summary);
      console.log(`[Cron Daily] Email Drip 完成，发送 ${totalSent} 封`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[Cron Daily] Email Drip 失败:`, msg);
      dripStatus.ok    = false;
      dripStatus.error = msg;
    }

    // ==================== Angel 客户扫描 ====================
    const angelStatus: { ok: boolean; newAngels?: number; error?: string } = { ok: false };
    try {
      console.log(`[Cron Daily] 开始 Angel 客户扫描...`);
      const angelResult = await runAngelScanner();
      angelStatus.ok        = true;
      angelStatus.newAngels = angelResult.newAngels;

      // 有新 Angel 才推送 Telegram
      const angelMsg = formatAngelSummary(angelResult);
      if (angelMsg) await sendTelegram(angelMsg);
      console.log(`[Cron Daily] Angel 扫描完成，新 Angel ${angelResult.newAngels}，新 Loyal ${angelResult.newLoyal}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[Cron Daily] Angel 扫描失败:`, msg);
      angelStatus.ok    = false;
      angelStatus.error = msg;
    }

    return NextResponse.json({
      ok: true,
      triggeredAt: now.toISOString(),
      triggered: dailyWorkflows.length,
      results,
      kpiStatus,
      dripStatus,
      angelStatus,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Cron Daily] 错误:", message);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
