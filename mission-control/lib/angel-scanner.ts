/**
 * FurMates Angel 客户自动识别器
 *
 * 规则（与 agent-prompts.ts 保持一致）：
 *   total_spent  > $200  → 标签 "angel-customer"
 *   orders_count >= 3    → 标签 "loyal-customer"
 *   近 30 天有购买       → 标签 "active-customer"（由 Shopify 订单判断）
 *
 * 逻辑：
 *   1. 拉取所有客户（分页，最多 5000）
 *   2. 筛选符合条件但尚未打过标签的客户
 *   3. 打标签 + 发 angelWelcome 邮件
 *   4. 通过 Telegram 通知 Terry
 *
 * 调用：daily cron 每天运行一次
 */

import { getShopifyClient, ShopifyCustomer } from "@/lib/integrations/shopify";
import { sendEmail, EMAIL_TEMPLATES } from "@/lib/integrations/gmail";

// ==================== 类型 ====================

export interface AngelScanResult {
  scanned:    number;
  newAngels:  number;
  newLoyal:   number;
  errors:     number;
  details:    string[];
}

// ==================== 主函数 ====================

export async function runAngelScanner(): Promise<AngelScanResult> {
  const shopify = await getShopifyClient();
  if (!shopify) {
    console.warn("[AngelScanner] Shopify 未配置，跳过");
    return { scanned: 0, newAngels: 0, newLoyal: 0, errors: 0, details: [] };
  }

  const result: AngelScanResult = {
    scanned: 0, newAngels: 0, newLoyal: 0, errors: 0, details: [],
  };

  // 分页拉取所有客户
  const allCustomers: ShopifyCustomer[] = [];
  let sinceId: string | undefined;

  for (let page = 0; page < 20; page++) {   // 最多 20 页 × 250 = 5000 客户
    const res = await shopify.listCustomers({
      limit: 250,
      ...(sinceId ? { since_id: sinceId } : {}),
    });
    if (!res.customers.length) break;
    allCustomers.push(...res.customers);
    sinceId = res.customers[res.customers.length - 1].id;
    if (res.customers.length < 250) break;   // 已到末页
  }

  result.scanned = allCustomers.length;
  console.log(`[AngelScanner] 扫描 ${allCustomers.length} 个客户`);

  for (const customer of allCustomers) {
    if (!customer.email) continue;

    const existingTags = customer.tags
      ? customer.tags.split(",").map(t => t.trim())
      : [];

    const totalSpent   = parseFloat(customer.total_spent ?? "0");
    const ordersCount  = customer.orders_count ?? 0;

    const shouldBeAngel = totalSpent > 200  && !existingTags.includes("angel-customer");
    const shouldBeLoyal = ordersCount >= 3  && !existingTags.includes("loyal-customer");

    if (!shouldBeAngel && !shouldBeLoyal) continue;

    // 计算新标签
    const newTags: string[] = [];
    if (shouldBeAngel) newTags.push("angel-customer");
    if (shouldBeLoyal) newTags.push("loyal-customer");
    const mergedTags = [...new Set([...existingTags, ...newTags])].join(", ");

    // 打标签
    try {
      await shopify.updateCustomer(customer.id, {
        tags: mergedTags,
      } as Parameters<typeof shopify.updateCustomer>[1]);
    } catch (err) {
      result.errors++;
      result.details.push(`打标签失败 ${customer.email}: ${err instanceof Error ? err.message : err}`);
      continue;
    }

    // 仅首次成为 Angel 时发邮件（loyal 不发邮件，避免重复）
    if (shouldBeAngel) {
      try {
        const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Friend";
        const { subject, html } = EMAIL_TEMPLATES.angelWelcome({
          name,
          email:      customer.email,
          couponCode: "ANGEL50",
        });
        await sendEmail({ to: customer.email, subject, html });
        result.newAngels++;
        result.details.push(
          `👼 Angel: ${customer.email}（消费 $${totalSpent.toFixed(2)}，${ordersCount} 单）`
        );
      } catch (err) {
        result.errors++;
        result.details.push(`发 Angel 邮件失败 ${customer.email}: ${err instanceof Error ? err.message : err}`);
      }
    }

    if (shouldBeLoyal && !shouldBeAngel) {
      result.newLoyal++;
      result.details.push(`💎 Loyal: ${customer.email}（${ordersCount} 单）`);
    }
  }

  return result;
}

// ==================== Telegram 推送格式 ====================

export function formatAngelSummary(result: AngelScanResult): string | null {
  if (result.newAngels === 0 && result.newLoyal === 0) return null;

  const lines = [
    `🌟 Angel 客户扫描完成（共 ${result.scanned} 客户）`,
    result.newAngels > 0 ? `  👼 新 Angel 客户: ${result.newAngels} 人（已发 50% OFF 邮件）` : "",
    result.newLoyal  > 0 ? `  💎 新 Loyal 客户: ${result.newLoyal}  人（已打标签）` : "",
    result.errors    > 0 ? `  ⚠️ 失败: ${result.errors} 条` : "",
    "",
    ...result.details.slice(0, 10),
    result.details.length > 10 ? `  ...共 ${result.details.length} 条详情` : "",
  ].filter(Boolean);

  return lines.join("\n");
}
