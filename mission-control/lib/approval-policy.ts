import type { Reversibility } from "@prisma/client";

export interface PlanRiskAttrs {
  // ⚠️ riskLevel / reversibility 是 LLM「自报」字段，可能被注入污染或越界。
  // 类型放宽为 unknown，由 needsApproval 内部做保守归一化（见 normalizeRiskLevel）。
  riskLevel:      unknown;
  reversibility:  Reversibility | string | null | undefined;
  blastRadius?:   string | null;
  estimatedCost?: number | null;
}

// Plan step 的最小形状——只需要能扫描到 action 文本即可。
// 用宽松类型是为了让 planner.ts / 测试脚本传入各种 step 对象都能兼容。
export interface PlanStepLike {
  action?: string | null;
}

// ──────────────────────────────────────────────────────────────────────────
// 危险操作关键词（纵深防御第 2 层）
// 命中这些词的 step.action 一律强制人工审批，无论 LLM 自报风险多低。
//
// ⚠️ 重要：step.action 是 planner（LLM）写的【自然语言描述】，例如
//    "Send welcome email to new signups" / "Post the announcement tweet" /
//    "Refund the customer's order"，而【不是】代码里的工具名（send_email）。
// 所以词表必须匹配自然语言动词/名词，而不是带下划线的工具标识符——后者在 action
// 散文里几乎不会出现（这是上一版漏掉的点：词表全是 send_email 这类，匹配不到 prose）。
//
// 设计取舍：本层只看 action 文本、不看被指派 agent 的真实工具，属于「碰运气的子串匹配」，
// 因此故意【偏宽、宁可错杀】——把对外/不可逆动作尽量都拦下来强制人工审批。
// 代价是一些本可自动批准的计划也会被挡（安全方向，不会放行危险操作）。
// 真正稳健的做法是「基于结构化信号」：让 PlanStep 显式带上要调用的工具/能力，
// needsApproval 用工具白/黑名单判定。这一结构化改造记为后续 P-next（见报告）。
//
// 全部转小写后做「子串包含」匹配。
// ──────────────────────────────────────────────────────────────────────────
const DANGEROUS_ACTION_KEYWORDS: string[] = [
  // —— 对外发消息 / 邮件（自然语言）——
  "email",            // send welcome email / email the customer / send_email
  "tweet", "twitter",
  "post to", "post a ", "post an ", "post the",
  "publish", "announce",
  "broadcast", "blast",
  "reach out", "outreach", "reply to", "respond to", "message the", "contact the",
  "dm the", "direct message", "send dm",
  // —— 财务 / 不可逆 ——
  "refund", "issue a credit", "invoice", "charge the", "charge customer",
  // —— 发货 / 履约 ——
  "fulfill", "fulfil", "ship the", "ship order", "shipment", "create shipment",
  // —— 批量触达 ——
  "mass ", "send all", "sendall", "send_all", "send to all", "email all",
  // —— 改外部 CRM / 客户数据 ——
  "tag the customer", "tag customer", "update the customer", "update customer",
  // —— 工具标识符兜底（万一 action 里直接写了工具名）——
  "send_email", "send_custom_email", "send_email_template",
  "publish_twitter", "publish_wordpress", "publish_telegram", "fulfill_shopify",
  "reply_tidio", "tag_shopify",
  // —— 中文高危动词 ——
  "发邮件", "发送邮件", "邮件", "发推", "推文", "发布", "群发", "广播",
  "退款", "退费", "开票", "扣款",
  "发货", "出货", "履约",
  "回复客户", "私信", "触达", "联系客户", "通知客户",
];

/**
 * 把 LLM 自报的 riskLevel 归一化成合法整数（0-5）。
 * 保守原则：任何「读不出有效值」的情况都按最高风险 5 处理，
 * 这样攻击者把 riskLevel 设成 undefined / "low" / -1 / 99 都无法绕过审批。
 */
function normalizeRiskLevel(raw: unknown): number {
  // 缺失 / 非数字 / NaN → 最高风险
  if (typeof raw !== "number" || Number.isNaN(raw)) return 5;
  // 越界（非 0-5）→ 最高风险
  if (raw < 0 || raw > 5) return 5;
  return raw;
}

/**
 * 把 LLM 自报的 reversibility 归一化。
 * 保守原则：只有显式等于 "reversible" / "partially" 才认；其它（缺失、乱写、被注入）
 * 一律当作 "irreversible"（不可逆），从而强制走审批。
 */
function normalizeReversibility(raw: unknown): Reversibility {
  if (raw === "reversible" || raw === "partially") return raw;
  return "irreversible" as Reversibility;
}

/**
 * 扫描 plan steps 的 action 文本，命中任一危险关键词即返回 true。
 * 命中后调用方应强制 requireApproval=true。
 */
function hasDangerousAction(steps?: PlanStepLike[]): boolean {
  if (!steps || steps.length === 0) return false;
  for (const step of steps) {
    const action = (step.action ?? "").toLowerCase();
    if (!action) continue;
    for (const kw of DANGEROUS_ACTION_KEYWORDS) {
      if (action.includes(kw)) return true;
    }
  }
  return false;
}

// autoApproveThreshold: plans with riskLevel <= threshold AND reversible are auto-approved.
// Default threshold is 0 (platform default, conservative — 未显式配置的项目不自动批准).
//
// 纵深防御：本函数信任的全部是「LLM 自报字段」，而 LLM 的输入里含用户可控的 Insight
// 文本，存在提示词注入风险。因此这里对自报字段做保守归一化，并额外扫描 step.action
// 里的危险操作关键词作为兜底——即使 LLM 被骗自报 riskLevel=0 reversible，只要计划里
// 真的有发邮件/退款/发货/发布动作，仍然强制人工审批。
export function needsApproval(
  p: PlanRiskAttrs,
  autoApproveThreshold = 0,
  steps?: PlanStepLike[],
): boolean {
  // 先把自报字段归一化成可信值
  const riskLevel     = normalizeRiskLevel(p.riskLevel);
  const reversibility = normalizeReversibility(p.reversibility);

  // 0) 危险操作关键词升级——无论自报风险如何，命中即强制审批（最高优先级）
  if (hasDangerousAction(steps)) return true;

  // 1) 面向全体用户 / 公开的 blast radius 一律需要审批
  if (p.blastRadius === "all_users" || p.blastRadius === "public") return true;

  // 2) 不可逆操作一律需要审批（缺失/非法的 reversibility 已被归一化成 irreversible）
  if (reversibility === "irreversible") return true;

  // 3) 在信任边界内（风险足够低且可逆）才自动批准
  if (riskLevel <= autoApproveThreshold && reversibility === "reversible") return false;

  // 4) 其余情况默认需要审批
  return true;
}
