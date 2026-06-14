import { callClaude, type ClaudeModel } from "@/lib/ai/claude-client";
import { callMiniMax } from "@/lib/ai/minimax-client";

// 主模型用 MiniMax；Anthropic 仅在 MiniMax 失败时兜底（见 llmCall）
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || "MiniMax-M3";

// Task type drives model selection — add new tasks here as phases expand
export type LlmTask = "observe" | "plan" | "embed_summary" | "fast";

// Approximate cost per 1M tokens (USD) — used for logging only, not billing
const COST_PER_1M: Record<ClaudeModel, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 0.8,  output: 4.0  },
  "claude-sonnet-4-6":         { input: 3.0,  output: 15.0 },
  "claude-opus-4-7":           { input: 15.0, output: 75.0 },
};

// Route each task to the appropriate model
const TASK_MODEL: Record<LlmTask, ClaudeModel> = {
  fast:          "claude-haiku-4-5-20251001", // low-latency one-shots
  observe:       "claude-haiku-4-5-20251001", // high-volume observer scans
  embed_summary: "claude-haiku-4-5-20251001", // text prep before embedding
  plan:          "claude-sonnet-4-6",          // quality-critical planning
};

export interface LlmCallOptions {
  task: LlmTask;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  projectId?: string; // attached to log for cost attribution
}

export interface LlmResult {
  content: string;
  model: string;                          // 可能是 MiniMax 或 Claude 模型名
  provider: "minimax" | "anthropic";      // 实际命中的提供商（便于观测/排障）
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
}

export async function llmCall(opts: LlmCallOptions): Promise<LlmResult> {
  const startedAt = Date.now();

  // ── 主：MiniMax ───────────────────────────────────────────────────────────
  let provider: "minimax" | "anthropic" = "minimax";
  let model: string = MINIMAX_MODEL;
  let response = await callMiniMax(opts.systemPrompt, opts.userPrompt, {
    maxTokens:   opts.maxTokens,
    temperature: opts.temperature,
  });

  // ── 兜底：MiniMax 失败（限流/超时/欠费等）→ Anthropic ─────────────────────
  if (!response.success) {
    console.warn(
      JSON.stringify({
        event:  "llm_fallback",
        task:   opts.task,
        from:   "minimax",
        to:     "anthropic",
        reason: (response.error ?? "").slice(0, 200),
        ts:     new Date().toISOString(),
      })
    );
    provider = "anthropic";
    model    = TASK_MODEL[opts.task]; // 回到该任务原本的 Claude 模型
    response = await callClaude(
      opts.systemPrompt,
      [{ role: "user", content: opts.userPrompt }],
      { model: model as ClaudeModel, maxTokens: opts.maxTokens, temperature: opts.temperature }
    );
  }

  const latencyMs    = Date.now() - startedAt;
  const inputTokens  = response.usage?.input_tokens  ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  // 成本仅对 Anthropic 估算；MiniMax 走套餐计费，这里按 0 记
  const rates = provider === "anthropic" ? COST_PER_1M[model as ClaudeModel] : { input: 0, output: 0 };
  const estimatedCostUsd =
    (inputTokens / 1_000_000) * rates.input +
    (outputTokens / 1_000_000) * rates.output;

  // Structured log — picked up by Vercel log drains / grep
  console.log(
    JSON.stringify({
      event:            "llm_call",
      task:             opts.task,
      provider,
      model,
      inputTokens,
      outputTokens,
      latencyMs,
      estimatedCostUsd: +estimatedCostUsd.toFixed(6),
      success:          response.success,
      projectId:        opts.projectId ?? null,
      ts:               new Date().toISOString(),
    })
  );

  if (!response.success) {
    throw new Error(`llmCall [${opts.task}] failed (MiniMax 主 + Anthropic 兜底都失败): ${response.error}`);
  }

  return { content: response.content, model, provider, inputTokens, outputTokens, latencyMs, estimatedCostUsd };
}
