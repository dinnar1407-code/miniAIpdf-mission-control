import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { executeWorkflow } from "@/lib/workflow-engine";
import { syncStripeKpis } from "@/lib/integrations/stripe";
import { syncGSCKpis } from "@/lib/integrations/gsc";
import { syncGAKpis } from "@/lib/integrations/ga";
import { syncShopifyKpis } from "@/lib/integrations/shopify";
import { syncWheatcoinKpis } from "@/lib/integrations/wheatcoin";
import { syncShiquKpis, getShiquProjectId } from "@/lib/integrations/shiqu";
import { runEmailDrip, formatDripSummary } from "@/lib/email-drip";
import { runAngelScanner, formatAngelSummary } from "@/lib/angel-scanner";
import { runObserver } from "@/lib/observer";
import { generateInsights } from "@/lib/insight-generator";

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
      await syncShopifyKpis("cmo21zrhg00039rvsd6ay6ag0");
      kpiStatus.shopify = { ok: true };
      console.log(`[Cron Daily] Shopify KPI 同步成功`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[Cron Daily] Shopify KPI 同步失败:`, msg);
      kpiStatus.shopify = { ok: false, error: msg };
    }

    // 同步 Wheatcoin KPI（社区 + pump.fun 代币数据）
    try {
      console.log(`[Cron Daily] 开始同步 Wheatcoin KPI...`);
      const wheatcoinResult = await syncWheatcoinKpis();
      kpiStatus.wheatcoin = { ok: wheatcoinResult.community || wheatcoinResult.token };
      console.log(`[Cron Daily] Wheatcoin KPI 同步完成:`, wheatcoinResult);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[Cron Daily] Wheatcoin KPI 同步失败:`, msg);
      kpiStatus.wheatcoin = { ok: false, error: msg };
    }

    // 同步拾趣 KPI（阶段4：让拾趣进入自循环）——必须在 Observer 之前，否则当天数据还没入库
    try {
      console.log(`[Cron Daily] 开始同步拾趣 KPI...`);
      const shiquProjectId = await getShiquProjectId();
      await syncShiquKpis(shiquProjectId);
      kpiStatus.shiqu = { ok: true };
      console.log(`[Cron Daily] 拾趣 KPI 同步成功`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[Cron Daily] 拾趣 KPI 同步失败:`, msg);
      kpiStatus.shiqu = { ok: false, error: msg };
    }

    // ==================== Observer → Insight 自动管线 ====================
    // 这一步是「自动闭环」的关键一环，承接上面刚刚同步好的 KPI 数据：
    //   1) runObserver()：扫描最近 7 天的 KPI/指标快照，找出"异常波动"或"离目标差距过大"
    //      的指标，返回一批原始观察值（observations）。
    //   2) generateInsights(observations)：把这些观察值交给 LLM 分类、生成中英双语的
    //      Insight（洞察），写入数据库，供 Planner 等后续环节消费。
    // 必须放在 KPI 同步「之后」——因为 Observer 扫描的就是上面刚写入的最新快照数据；
    // 如果没人调用它，KPI 同步完就没人扫描生成 Insight，整条自动闭环就是断的。
    const observerStatus: {
      ok: boolean;
      observations?: number;
      created?: number;
      error?: string;
    } = { ok: false };
    try {
      console.log(`[Cron Daily] 开始 Observer KPI 扫描...`);
      // runObserver() 返回 ObserverResult，这里只需要其中的 observations 数组
      const { observations } = await runObserver();
      // 把扫描出来的观察值喂给 Insight 生成器；返回 { processed, created, skipped, errors }
      const insightResult = await generateInsights(observations);
      observerStatus.ok           = true;
      observerStatus.observations = observations.length;
      observerStatus.created      = insightResult.created;
      console.log(
        `[Cron Daily] Observer 完成：扫描 ${observations.length} 条观察值，` +
          `新建 ${insightResult.created} 条 Insight（跳过 ${insightResult.skipped}，失败 ${insightResult.errors}）`
      );
    } catch (err) {
      // 单独 try/catch 包裹：Observer/Insight 任一步失败都不能让整个 cron 崩溃，
      // 否则会连累后面的 Email Drip、Angel 扫描等步骤跑不到
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[Cron Daily] Observer/Insight 失败:`, msg);
      observerStatus.ok    = false;
      observerStatus.error = msg;
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
      observerStatus,
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
