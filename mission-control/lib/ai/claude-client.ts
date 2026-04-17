// Claude API 客户端 — 直接使用 fetch，无需安装 SDK
// 模型选择：haiku（快速任务）/ sonnet（复杂内容）

export type ClaudeModel =
  | "claude-haiku-4-5-20251001"   // 快速、低成本（日常任务）
  | "claude-sonnet-4-6"           // 均衡（内容创作）
  | "claude-opus-4-6";            // 最强（复杂分析）

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeResponse {
  success: boolean;
  content: string;
  model: string;
  usage?: { input_tokens: number; output_tokens: number };
  error?: string;
}

export async function callClaude(
  systemPrompt: string,
  messages: ClaudeMessage[],
  options: {
    model?: ClaudeModel;
    maxTokens?: number;
    temperature?: number;
  } = {}
): Promise<ClaudeResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      content: "",
      model: "",
      error: "ANTHROPIC_API_KEY 未配置。请在 Vercel 环境变量中添加。",
    };
  }

  const model       = options.model      ?? "claude-haiku-4-5-20251001";
  const maxTokens   = options.maxTokens  ?? 2048;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system:     systemPrompt,
        messages,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, content: "", model, error: `API Error ${res.status}: ${err}` };
    }

    const data = await res.json() as {
      content: Array<{ type: string; text: string }>;
      model: string;
      usage: { input_tokens: number; output_tokens: number };
    };

    const text = data.content?.find(b => b.type === "text")?.text ?? "";
    return { success: true, content: text, model: data.model, usage: data.usage };

  } catch (err) {
    return {
      success: false, content: "", model,
      error: err instanceof Error ? err.message : "网络请求失败",
    };
  }
}

// 简化调用：单轮对话
export async function ask(
  systemPrompt: string,
  userMessage: string,
  model?: ClaudeModel
): Promise<string> {
  const res = await callClaude(systemPrompt, [{ role: "user", content: userMessage }], { model });
  return res.success ? res.content : `[AI Error: ${res.error}]`;
}
