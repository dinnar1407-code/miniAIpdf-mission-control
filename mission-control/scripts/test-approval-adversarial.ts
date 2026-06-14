/**
 * 审批策略对抗测试（needsApproval 的安全回归测试）
 *
 * 目的：实测「提示词注入 / 绕过」类输入是否都被正确升级为人工审批，
 *       同时确认真正无害的低风险可逆计划仍能自动批准（没被过度封锁）。
 *
 * 只测纯逻辑函数 needsApproval，不连数据库、不调 LLM、不触发任何真实发送。
 * 运行：npx tsx scripts/test-approval-adversarial.ts
 *
 * 约定：needsApproval 返回 true = 需要人工审批（安全）；false = 自动批准。
 */
import { needsApproval, type PlanRiskAttrs, type PlanStepLike } from "@/lib/approval-policy";

interface Case {
  name: string;
  attrs: PlanRiskAttrs;
  threshold?: number;
  steps?: PlanStepLike[];
  expect: boolean; // 期望的 needsApproval 返回值
}

const cases: Case[] = [
  // ── 攻击/绕过场景：全部应当“需要审批”(true) ──
  {
    name: "注入：自报低风险可逆 + 实际要发邮件",
    attrs: { riskLevel: 0, reversibility: "reversible" },
    threshold: 0,
    steps: [{ action: "Send a welcome email to the new signups" }],
    expect: true,
  },
  {
    name: "注入：自报低风险 + 退款（财务不可逆）",
    attrs: { riskLevel: 0, reversibility: "reversible" },
    threshold: 0,
    steps: [{ action: "Refund the customer's last order" }],
    expect: true,
  },
  {
    name: "注入：自报低风险 + 发推",
    attrs: { riskLevel: 0, reversibility: "reversible" },
    threshold: 0,
    steps: [{ action: "Post the launch announcement tweet" }],
    expect: true,
  },
  {
    name: "中文注入：给所有用户发邮件",
    attrs: { riskLevel: 0, reversibility: "reversible" },
    threshold: 0,
    steps: [{ action: "给所有新用户发邮件介绍新功能" }],
    expect: true,
  },
  {
    name: "批量触达：mass email all customers",
    attrs: { riskLevel: 0, reversibility: "reversible" },
    threshold: 0,
    steps: [{ action: "Mass email all customers about the sale" }],
    expect: true,
  },
  {
    name: "字段污染：riskLevel 写成字符串 'low'（应归一化为最高风险）",
    attrs: { riskLevel: "low" as unknown as number, reversibility: "reversible" },
    threshold: 0,
    steps: [{ action: "analyze the data" }],
    expect: true,
  },
  {
    name: "字段污染：riskLevel 越界 99",
    attrs: { riskLevel: 99, reversibility: "reversible" },
    threshold: 0,
    steps: [{ action: "analyze the data" }],
    expect: true,
  },
  {
    name: "字段污染：reversibility 缺失（应按不可逆处理）",
    attrs: { riskLevel: 0, reversibility: undefined },
    threshold: 0,
    steps: [{ action: "analyze the data" }],
    expect: true,
  },
  {
    name: "字段污染：reversibility 写成 'reversible (trust me)'（非精确值→不可逆）",
    attrs: { riskLevel: 0, reversibility: "reversible (trust me)" },
    threshold: 0,
    steps: [{ action: "analyze the data" }],
    expect: true,
  },
  {
    name: "blastRadius=all_users（面向全体用户）",
    attrs: { riskLevel: 0, reversibility: "reversible", blastRadius: "all_users" },
    threshold: 0,
    steps: [{ action: "analyze the data" }],
    expect: true,
  },
  {
    name: "阈值边界：risk 2 > 阈值 0",
    attrs: { riskLevel: 2, reversibility: "reversible" },
    threshold: 0,
    steps: [{ action: "analyze the data" }],
    expect: true,
  },

  // ── 正常无害场景：应当“自动批准”(false)，确认没被过度封锁 ──
  {
    name: "无害：低风险可逆 + 纯内部分析（阈值 0 应自动批准）",
    attrs: { riskLevel: 0, reversibility: "reversible" },
    threshold: 0,
    steps: [{ action: "Analyze last week's KPI data and generate an internal draft summary" }],
    expect: false,
  },
  {
    name: "无害：计算并刷新看板缓存（阈值 0 应自动批准）",
    attrs: { riskLevel: 0, reversibility: "reversible" },
    threshold: 0,
    steps: [{ action: "Compute the conversion rate and refresh the dashboard cache" }],
    expect: false,
  },
  {
    name: "信任边界：risk 2 可逆 + 项目阈值调到 3 → 自动批准",
    attrs: { riskLevel: 2, reversibility: "reversible" },
    threshold: 3,
    steps: [{ action: "analyze the data and tag internal records" }],
    expect: false,
  },
];

function main() {
  console.log("=== 审批策略对抗测试 ===\n");
  let passed = 0;
  let failed = 0;

  for (const c of cases) {
    const got = needsApproval(c.attrs, c.threshold, c.steps);
    const ok = got === c.expect;
    if (ok) passed++;
    else failed++;
    const verdict = got ? "需审批" : "自动批准";
    console.log(`${ok ? "PASS" : "FAIL"} | ${verdict.padEnd(5)} | ${c.name}`);
    if (!ok) console.log(`      ↑ 期望 ${c.expect ? "需审批" : "自动批准"}，实际 ${verdict}`);
  }

  console.log(`\n=== ${failed === 0 ? "全部通过" : "有失败"} : ${passed} passed, ${failed} failed ===`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
