import { callClaude, type ClaudeModel } from "@/lib/ai/claude-client";

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
  model: ClaudeModel;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
}

export async function llmCall(opts: LlmCallOptions): Promise<LlmResult> {
  const model = TASK_MODEL[opts.task];
  const startedAt = Date.now();

  const response = await callClaude(
    opts.systemPrompt,
    [{ role: "user", content: opts.userPrompt }],
    { model, maxTokens: opts.maxTokens, temperature: opts.temperature }
  );

  const latencyMs = Date.now() - startedAt;
  const inputTokens  = response.usage?.input_tokens  ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  const rates = COST_PER_1M[model];
  const estimatedCostUsd =
    (inputTokens / 1_000_000) * rates.input +
    (outputTokens / 1_000_000) * rates.output;

  // Structured log — picked up by Vercel log drains / grep
  console.log(
    JSON.stringify({
      event:            "llm_call",
      task:             opts.task,
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
    throw new Error(`llmCall [${opts.task}] failed: ${response.error}`);
  }

  return { content: response.content, model, inputTokens, outputTokens, latencyMs, estimatedCostUsd };
}
