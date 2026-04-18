import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { executeWorkflow } from "@/lib/workflow-engine";
import { writeKpiSnapshot } from "@/lib/integrations/stripe";

// Stripe Webhook Handler
// POST /api/webhooks/stripe
// 处理 Stripe webhook 事件
// - customer.subscription.created → 触发 onboarding workflow + 写 KPI
// - customer.subscription.deleted → 写 KPI（取消）+ 发 Telegram 通知
// - invoice.payment_succeeded → 更新 MRR KPI 快照
// - invoice.payment_failed → 发 Telegram 告警

export const maxDuration = 300;

// ==================== TELEGRAM HELPER ====================

async function sendTelegram(text: string): Promise<boolean> {
  let token = process.env.TELEGRAM_BOT_TOKEN;
  let chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    try {
      const cred = await prisma.channelCredential.findUnique({
        where: { channelId: "telegram_notification" },
      });
      if (cred && cred.enabled) {
        const c = JSON.parse(cred.credentials) as Record<string, string>;
        token = token || c.botToken;
        chatId = chatId || c.chatId;
      }
    } catch {
      // Non-fatal
    }
  }

  if (!token || !chatId) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🤖 *Jarvis Stripe Webhook*\n\n${text}`,
        parse_mode: "Markdown",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ==================== STRIPE SIGNATURE VERIFICATION ====================

function verifyStripeSignature(
  payload: string,
  sig: string,
  secret: string
): boolean {
  // Stripe 签名格式：t=timestamp,v1=hash
  const parts = sig.split(",");
  let timestamp = "";
  let providedHash = "";

  for (const part of parts) {
    if (part.startsWith("t=")) {
      timestamp = part.substring(2);
    } else if (part.startsWith("v1=")) {
      providedHash = part.substring(3);
    }
  }

  if (!timestamp || !providedHash) {
    return false;
  }

  // 生成签名：HMAC-SHA256(timestamp + "." + payload, secret)
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(`${timestamp}.${payload}`);
  const expectedHash = hmac.digest("hex");

  // 使用 timingSafeEqual 防止时序攻击
  return crypto.timingSafeEqual(
    Buffer.from(providedHash),
    Buffer.from(expectedHash)
  );
}

// ==================== WEBHOOK HANDLER ====================

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  try {
    // 获取请求体和签名
    const payload = await req.text();
    const sig = req.headers.get("stripe-signature");

    if (!sig) {
      console.warn("[Stripe Webhook] Missing stripe-signature header");
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    // 验证签名
    if (!verifyStripeSignature(payload, sig, webhookSecret)) {
      console.warn("[Stripe Webhook] Invalid signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // 解析事件
    const event = JSON.parse(payload) as {
      type: string;
      data?: {
        object?: Record<string, unknown>;
      };
    };

    const eventType = event.type;
    const eventData = event.data?.object || {};

    console.log(`[Stripe Webhook] 处理事件: ${eventType}`);

    // ==================== 处理 customer.subscription.created ====================
    if (eventType === "customer.subscription.created") {
      const subscription = eventData as {
        id?: string;
        customer?: string;
        items?: {
          data?: Array<{
            price?: {
              amount?: number;
            };
          }>;
        };
      };

      const amount = subscription.items?.data?.[0]?.price?.amount || 0;
      const mrr = amount / 100; // 转换为美元

      console.log(
        `[Stripe Webhook] 新订阅 ${subscription.id}, MRR: ${mrr}`
      );

      // 写 KPI
      try {
        await writeKpiSnapshot(null, "mrr_subscription_created", mrr, undefined, "stripe_webhook");
        console.log(
          `[Stripe Webhook] KPI snapshot 已写入: mrr_subscription_created`
        );
      } catch (err) {
        console.error(`[Stripe Webhook] 写 KPI 失败:`, err);
      }

      // 触发 onboarding workflow
      try {
        const onboardingWorkflows = await prisma.workflow.findMany({
          where: {
            status: "active",
            name: { contains: "onboarding", mode: "insensitive" },
          },
          take: 1,
        });

        if (onboardingWorkflows.length > 0) {
          const wf = onboardingWorkflows[0];
          console.log(
            `[Stripe Webhook] 触发 onboarding workflow: ${wf.name} (${wf.id})`
          );
          await executeWorkflow(wf.id, {
            trigger: "stripe_webhook_subscription_created",
            triggeredAt: new Date().toISOString(),
            metadata: {
              subscriptionId: subscription.id,
              customerId: subscription.customer,
              mrr,
            },
          });
        } else {
          console.log(
            `[Stripe Webhook] 未找到 onboarding workflow`
          );
        }
      } catch (err) {
        console.error(
          `[Stripe Webhook] 触发 onboarding workflow 失败:`,
          err
        );
      }
    }

    // ==================== 处理 customer.subscription.deleted ====================
    if (eventType === "customer.subscription.deleted") {
      const subscription = eventData as {
        id?: string;
        items?: {
          data?: Array<{
            price?: {
              amount?: number;
            };
          }>;
        };
      };

      const amount = subscription.items?.data?.[0]?.price?.amount || 0;
      const mrr = amount / 100;

      console.log(
        `[Stripe Webhook] 订阅已取消 ${subscription.id}, MRR: ${mrr}`
      );

      // 写 KPI
      try {
        await writeKpiSnapshot(null, "mrr_subscription_deleted", -mrr, undefined, "stripe_webhook");
        console.log(
          `[Stripe Webhook] KPI snapshot 已写入: mrr_subscription_deleted`
        );
      } catch (err) {
        console.error(`[Stripe Webhook] 写 KPI 失败:`, err);
      }

      // 发送 Telegram 通知
      try {
        const message = `⚠️ 订阅已取消\n订阅 ID: ${subscription.id}\nMRR 损失: -$${mrr.toFixed(2)}`;
        const sent = await sendTelegram(message);
        if (sent) {
          console.log(`[Stripe Webhook] Telegram 通知已发送`);
        } else {
          console.warn(`[Stripe Webhook] 发送 Telegram 通知失败`);
        }
      } catch (err) {
        console.error(`[Stripe Webhook] 发送 Telegram 通知异常:`, err);
      }
    }

    // ==================== 处理 invoice.payment_succeeded ====================
    if (eventType === "invoice.payment_succeeded") {
      const invoice = eventData as {
        id?: string;
        amount_paid?: number;
        subscription?: string;
      };

      const amountPaid = invoice.amount_paid || 0;
      const mrrAmount = amountPaid / 100; // 转换为美元

      console.log(
        `[Stripe Webhook] 发票支付成功 ${invoice.id}, 金额: $${mrrAmount.toFixed(2)}`
      );

      // 更新 MRR KPI 快照
      try {
        await writeKpiSnapshot(null, "mrr_invoice_paid", mrrAmount, undefined, "stripe_webhook");
        console.log(
          `[Stripe Webhook] KPI snapshot 已写入: mrr_invoice_paid`
        );
      } catch (err) {
        console.error(`[Stripe Webhook] 写 KPI 失败:`, err);
      }
    }

    // ==================== 处理 invoice.payment_failed ====================
    if (eventType === "invoice.payment_failed") {
      const invoice = eventData as {
        id?: string;
        amount_due?: number;
        customer?: string;
      };

      const amountDue = invoice.amount_due || 0;
      const amount = amountDue / 100;

      console.error(
        `[Stripe Webhook] 发票支付失败 ${invoice.id}, 金额: $${amount.toFixed(2)}`
      );

      // 发送 Telegram 告警
      try {
        const message = `🚨 *Stripe 发票支付失败*\n发票 ID: ${invoice.id}\n金额: $${amount.toFixed(2)}\n客户: ${invoice.customer || "N/A"}`;
        const sent = await sendTelegram(message);
        if (sent) {
          console.log(`[Stripe Webhook] 告警 Telegram 已发送`);
        } else {
          console.warn(`[Stripe Webhook] 发送告警 Telegram 失败`);
        }
      } catch (err) {
        console.error(`[Stripe Webhook] 发送告警 Telegram 异常:`, err);
      }
    }

    // ==================== 返回成功响应 ====================
    return NextResponse.json({ ok: true, received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Stripe Webhook] 错误:", message);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
