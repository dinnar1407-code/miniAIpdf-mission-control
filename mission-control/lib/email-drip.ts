/**
 * FurMates 邮件 Drip 序列引擎
 *
 * 策略：用 Shopify 客户标签记录已发送状态，避免重复发送
 *   drip-welcome   → Day 0  欢迎邮件
 *   drip-day3      → Day 3  产品介绍
 *   drip-day7      → Day 7  限时优惠（10% OFF）
 *   drip-day14     → Day 14 最后提醒
 *   drip-day21     → Day 21 唤醒
 *
 * 调用方式：由 daily cron 调用 runEmailDrip()
 * 每天运行时，按时间窗口查找"应该收到第 N 封"的客户，
 * 检查标签确认未发过，发送并打标签。
 */

import { getShopifyClient } from "@/lib/integrations/shopify";
import { sendEmail, EMAIL_TEMPLATES } from "@/lib/integrations/gmail";

// ==================== Drip 步骤定义 ====================

interface DripStep {
  day:      number;             // 注册后第几天发送
  tag:      string;             // Shopify 已发送标记
  template: keyof typeof EMAIL_TEMPLATES;
  couponCode?: string;
}

const DRIP_STEPS: DripStep[] = [
  { day: 0,  tag: "drip-welcome",  template: "welcome"      },
  { day: 3,  tag: "drip-day3",     template: "productIntro" },
  { day: 7,  tag: "drip-day7",     template: "limitedOffer", couponCode: "FURMATES10" },
  { day: 14, tag: "drip-day14",    template: "lastChance",   couponCode: "FURMATES10" },
  { day: 21, tag: "drip-day21",    template: "wakeUp"        },
];

// ==================== 核心执行函数 ====================

export interface DripResult {
  step:      number;
  sent:      number;
  skipped:   number;
  errors:    number;
  details:   string[];
}

/**
 * 执行一次 Drip 序列扫描
 * 每天由 daily cron 调用一次
 */
export async function runEmailDrip(): Promise<DripResult[]> {
  const shopify = await getShopifyClient();
  if (!shopify) {
    console.warn("[EmailDrip] Shopify 未配置，跳过");
    return [];
  }

  const results: DripResult[] = [];

  for (const step of DRIP_STEPS) {
    const result = await processDripStep(shopify, step);
    results.push(result);
    console.log(`[EmailDrip] Day-${step.day}: 发送 ${result.sent}，跳过 ${result.skipped}，失败 ${result.errors}`);
  }

  return results;
}

async function processDripStep(
  shopify: Awaited<ReturnType<typeof getShopifyClient>> & object,
  step: DripStep
): Promise<DripResult> {
  const result: DripResult = { step: step.day, sent: 0, skipped: 0, errors: 0, details: [] };

  // 计算时间窗口：注册时间在 [day, day+1) 天前的客户
  const windowEnd   = new Date(Date.now() - step.day       * 86400_000);
  const windowStart = new Date(Date.now() - (step.day + 1) * 86400_000);

  // 拉取该时间窗口内注册的客户（最多 250）
  let customers: Awaited<ReturnType<typeof shopify.listCustomers>>["customers"] = [];
  try {
    const res = await shopify.listCustomers({
      limit:          250,
      created_at_min: windowStart.toISOString(),
      created_at_max: windowEnd.toISOString(),
    });
    customers = res.customers;
  } catch (err) {
    result.errors++;
    result.details.push(`拉取客户失败: ${err instanceof Error ? err.message : err}`);
    return result;
  }

  for (const customer of customers) {
    // 必须有邮箱
    if (!customer.email) { result.skipped++; continue; }

    // 检查是否已发送（标签已存在）
    const existingTags = customer.tags
      ? customer.tags.split(",").map(t => t.trim())
      : [];
    if (existingTags.includes(step.tag)) { result.skipped++; continue; }

    // 生成邮件内容
    const name  = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Friend";
    const tplFn = EMAIL_TEMPLATES[step.template] as (v: {
      name: string; email: string; couponCode?: string; storeUrl?: string;
    }) => { subject: string; html: string };

    const { subject, html } = tplFn({
      name,
      email:      customer.email,
      couponCode: step.couponCode,
    });

    // 发送邮件
    try {
      await sendEmail({ to: customer.email, subject, html });
    } catch (err) {
      result.errors++;
      result.details.push(`发送失败 ${customer.email}: ${err instanceof Error ? err.message : err}`);
      continue;
    }

    // 打标签（追加，不覆盖）
    try {
      const mergedTags = [...new Set([...existingTags, step.tag])].join(", ");
      await shopify.updateCustomer(customer.id, { tags: mergedTags } as Parameters<typeof shopify.updateCustomer>[1]);
    } catch (err) {
      // 标签失败不影响发送计数
      result.details.push(`打标签失败 ${customer.id}: ${err instanceof Error ? err.message : err}`);
    }

    result.sent++;
    result.details.push(`✅ [Day-${step.day}] ${customer.email}`);
  }

  return result;
}

// ==================== 汇总格式化（供 Telegram 推送）====================

export function formatDripSummary(results: DripResult[]): string {
  const totalSent = results.reduce((s, r) => s + r.sent, 0);
  if (totalSent === 0) return "📧 Email Drip: 今日无需发送邮件";

  const lines = results
    .filter(r => r.sent > 0 || r.errors > 0)
    .map(r => `  Day-${r.step}: 发${r.sent} 跳${r.skipped}${r.errors > 0 ? ` ❌${r.errors}` : ""}`);

  return `📧 Email Drip 日报:\n${lines.join("\n")}\n合计发送: ${totalSent} 封`;
}
