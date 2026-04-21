import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyShopifyWebhook, ShopifyOrder } from "@/lib/integrations/shopify";
import { executeWorkflow } from "@/lib/workflow-engine";

// Shopify Webhook Handler
// POST /api/webhooks/shopify
// 在 Shopify Admin → Settings → Notifications → Webhooks 配置
//
// 处理事件：
// - orders/create     → Telegram 新订单通知
// - orders/paid       → 触发 onboarding workflow
// - orders/cancelled  → Telegram 取消通知
// - inventory_levels/update → 低库存检测

export const maxDuration = 60;

async function sendTelegram(text: string): Promise<void> {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  }).catch(() => {});
}

export async function POST(req: NextRequest) {
  // 1. 读取原始 body（签名验证需要原始字节）
  const rawBody = await req.text();

  // 2. 验证签名
  const hmac  = req.headers.get("x-shopify-hmac-sha256") ?? "";
  const topic = req.headers.get("x-shopify-topic")       ?? "";

  if (hmac && !verifyShopifyWebhook(rawBody, hmac)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  console.log(`[Shopify Webhook] topic=${topic}`);

  // 3. 按事件类型处理
  switch (topic) {

    // ── 新订单创建 ────────────────────────────────────────
    case "orders/create": {
      const order = payload as unknown as ShopifyOrder;
      const items = order.line_items.map(i => `${i.title} ×${i.quantity}`).join(", ");
      const name  = order.customer
        ? `${order.customer.first_name} ${order.customer.last_name}`.trim()
        : order.email;

      await sendTelegram(
        `🛍️ *FurMates 新订单 #${order.order_number}*\n\n` +
        `客户: ${name}\n` +
        `商品: ${items}\n` +
        `金额: ${order.currency} ${order.total_price}\n` +
        `状态: ${order.financial_status}`
      );
      break;
    }

    // ── 订单付款成功 → 触发 Onboarding Workflow ──────────
    case "orders/paid": {
      const order = payload as unknown as ShopifyOrder;

      // 触发 FurMates Onboarding Workflow（如果存在）
      try {
        const wf = await prisma.workflow.findFirst({
          where: { id: "wf_furmates_onboarding", status: "active" },
        });
        if (wf) {
          void executeWorkflow(wf.id, {
            event:          "order.paid",
            orderId:        order.id,
            orderNumber:    order.order_number,
            customerEmail:  order.email,
            totalPrice:     order.total_price,
            triggeredAt:    new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error("[Shopify] Failed to trigger onboarding workflow:", err);
      }
      break;
    }

    // ── 订单取消 ──────────────────────────────────────────
    case "orders/cancelled": {
      const order = payload as unknown as ShopifyOrder;
      await sendTelegram(
        `❌ *FurMates 订单取消 #${order.order_number}*\n` +
        `金额: ${order.currency} ${order.total_price}\n` +
        `客户: ${order.email}`
      );
      break;
    }

    // ── 库存变化 → 检测低库存 ────────────────────────────
    case "inventory_levels/update": {
      const level = payload as { inventory_item_id: string; available: number; location_id: string };
      const LOW_STOCK_THRESHOLD = parseInt(process.env.SHOPIFY_LOW_STOCK_THRESHOLD ?? "5", 10);

      if (level.available <= LOW_STOCK_THRESHOLD) {
        await prisma.alert.create({
          data: {
            severity: level.available <= 0 ? "critical" : "warning",
            source:   "shopify_webhook",
            message:  `FurMates 库存警告：商品 ${level.inventory_item_id} 剩余 ${level.available} 件（阈值 ${LOW_STOCK_THRESHOLD}）`,
            status:   "new",
          },
        }).catch(() => {});

        await sendTelegram(
          `${level.available <= 0 ? "🚨" : "⚠️"} *FurMates 库存${level.available <= 0 ? "耗尽" : "偏低"}*\n` +
          `商品 ID: ${level.inventory_item_id}\n` +
          `剩余: ${level.available} 件`
        );
      }
      break;
    }

    default:
      console.log(`[Shopify Webhook] 未处理的事件: ${topic}`);
  }

  return NextResponse.json({ ok: true });
}
