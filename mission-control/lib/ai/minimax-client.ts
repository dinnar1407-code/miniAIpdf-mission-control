/**
 * MiniMax 客户端 —— OpenAI 兼容的 chat/completions 接口。
 * 作为 Jarvis 推理层（llmCall）的**主模型**，Anthropic 作兜底。
 *
 * 注意：
 *  - MiniMax M3 是「思考模型」，回复里会带 <think>…</think> 推理块，必须剥掉再返回。
 *  - 返回结构刻意对齐 claude-client 的 ClaudeResponse（success/content/model/error/usage），
 *    这样 llmCall 里 MiniMax 与 Anthropic 可无缝互换。
 *  - JSON 任务的 markdown 围栏由调用方（insight-generator / planner 的 stripFences）处理，这里不碰。
 */

export interface MiniMaxResponse {
  success: boolean;
  content: string;
  model: string;
  error?: string;
  usage?: { input_tokens: number; output_tokens: number };
}

const MINIMAX_BASE  = (process.env.MINIMAX_BASE_URL || "https://api.minimaxi.com/v1").replace(/\/+$/, "");
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || "MiniMax-M3";

/** 带超时的 fetch（思考模型偏慢，给到 90s） */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 90000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function callMiniMax(
  systemPrompt: string,
  userPrompt: string,
  options: { model?: string; maxTokens?: number; temperature?: number } = {}
): Promise<MiniMaxResponse> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    return { success: false, content: "", model: "", error: "MINIMAX_API_KEY 未配置" };
  }
  const model = options.model ?? MINIMAX_MODEL;

  try {
    // M3 是思考模型，<think> 推理会吃掉 token 预算。调用方按 Claude（无内联思考）设的
    // maxTokens（如 observe=600）对 M3 太小，会把真正的 JSON 答案截断。这里抬一个下限，
    // 留足"思考 + 答案"空间（套餐计费，多给 token 不额外花钱）。剥掉 <think> 后内容仍很小。
    const effectiveMaxTokens = Math.max(options.maxTokens ?? 2048, 8000);
    const body: Record<string, unknown> = {
      model,
      max_tokens: effectiveMaxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
    };
    if (options.temperature !== undefined) body.temperature = options.temperature;

    const res = await fetchWithTimeout(`${MINIMAX_BASE}/chat/completions`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body:    JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, content: "", model, error: `MiniMax API Error ${res.status}: ${err.slice(0, 300)}` };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      base_resp?: { status_code: number; status_msg: string };
    };

    // MiniMax 业务级错误（HTTP 200 但 base_resp.status_code != 0）
    if (data.base_resp && data.base_resp.status_code !== 0) {
      return { success: false, content: "", model, error: `MiniMax 业务错误 ${data.base_resp.status_code}: ${data.base_resp.status_msg}` };
    }

    // 剥掉思考块（M3 思考模型会输出 <think>…</think>）
    const raw = data.choices?.[0]?.message?.content ?? "";
    const content = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    if (!content) {
      return { success: false, content: "", model, error: "MiniMax 返回空内容（可能全是思考块）" };
    }

    return {
      success: true,
      content,
      model,
      usage: {
        input_tokens:  data.usage?.prompt_tokens     ?? 0,
        output_tokens: data.usage?.completion_tokens ?? 0,
      },
    };
  } catch (err) {
    return { success: false, content: "", model, error: err instanceof Error ? err.message : "MiniMax 网络请求失败" };
  }
}
