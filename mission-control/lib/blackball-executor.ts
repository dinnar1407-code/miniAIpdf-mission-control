// ─────────────────────────────────────────────────────────────────────────────
// BLACKBALL EXECUTOR — 黑球虚拟执行器（Phase 3：Autopilot 自动派发）
//
// 「黑球」是一个本地通用任务执行器（claude+codex 双引擎真实执行），通过
// DelegatedTask 队列 + /api/blackball/* 接口以「拉取模式」领活：
//   Jarvis 侧只往 DB 写一条 DelegatedTask(status=pending)，黑球 worker 自己
//   轮询 /api/blackball/poll 领取、跑完后回调 /api/blackball/result。
//
// 设计要点（与 IRON-LAW 一致）：
//   1. 永远是「拉取」——Jarvis 绝不主动 fetch 黑球、绝不暴露黑球端口。派发=DB 写入。
//   2. 黑球只接「只产出文档、不改代码、不碰外部系统」的调研/检索/写作/总结/分析任务。
//   3. 它是一个【虚拟 agent】：不在 DB 的 Agent 表里注册，而是在代码层（planner /
//      workflow-engine）按 slug 识别。这样无需跑 migration / seed 就能让 Planner 用它。
// ─────────────────────────────────────────────────────────────────────────────

import { containsDangerousAction } from "@/lib/approval-policy";

/** 黑球虚拟 agent 的 slug。Planner 指派 / workflow-engine 识别都用这个常量，避免散落硬编码。 */
export const BLACKBALL_AGENT_SLUG = "blackball";

/** 给 Planner 看的能力描述（注入到 Available Agents 列表）。 */
export const BLACKBALL_AGENT_DESCRIPTION =
  "本地通用任务执行器，擅长调研/检索/写作/总结/分析等只产出文档的任务；不可用于改代码、删文件、对外发送";

/**
 * 全自动派发总开关。
 * 缺失 / 非字面量 'true' 一律视为关闭（默认半自动：黑球计划仍走 Telegram 人工审批）。
 * 只有显式设为 'true' 才允许「纯黑球调研/写作计划」绕过审批自动放行。
 */
export function isBlackballAutoDispatchEnabled(): boolean {
  return process.env.BLACKBALL_AUTO_DISPATCH === "true";
}

/** 判断某个步骤是否被指派给黑球（slug 比较，容忍 undefined/null）。 */
export function isBlackballStep(agentId: string | null | undefined): boolean {
  return agentId === BLACKBALL_AGENT_SLUG;
}

/**
 * 代码级安全闸：黑球只接「安全任务」。
 * 复用 approval-policy 的危险操作关键词扫描——只要 task 文本里出现
 * 发邮件/退款/发货/发布/群发…等对外或不可逆动作的迹象，就判定为不安全、拒绝派发。
 *
 * 这是 prompt 注入之外的第二道（代码级）防线：即使 Planner 被骗把危险任务派给黑球，
 * 这里也会在真正写入 DelegatedTask 之前拦下来。
 *
 * @param text  要检查的任务文本（一般是 step.action / prompt）
 * @returns true=安全可派发，false=命中危险关键词、必须拒绝
 */
export function isBlackballTaskSafe(text: string | null | undefined): boolean {
  return !containsDangerousAction(text);
}
