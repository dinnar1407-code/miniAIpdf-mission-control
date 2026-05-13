// Claude API 客户端 — 直接使用 fetch，无需安装 SDK
// 模型选择：haiku（快速任务）/ sonnet（复杂内容）

export type ClaudeModel =
  | "claude-haiku-4-5-20251001"   // 快速、低成本（日常任务）
  | "claude-sonnet-4-6"           // 均衡（内容创作）
  | "claude-opus-4-7";            // 最强（复杂分析）

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeResponse {
  success: boolean;
  content: string;
  model: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  error?: string;
}

// Fix 6: 429 指数退避重试（最多 3 次：1s → 2s → 4s）
async function fetchWithRetry(url: string, init: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, init);
    if (res.status !== 429 || attempt === maxRetries) return res;
    await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
  }
  return fetch(url, init);
}

// Fix 4: 所有请求都带 prompt-caching beta header
const ANTHROPIC_HEADERS = {
  "anthropic-version": "2023-06-01",
  "anthropic-beta":    "prompt-caching-2024-07-31",
  "content-type":      "application/json",
};

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

  const model     = options.model     ?? "claude-haiku-4-5-20251001";
  const maxTokens = options.maxTokens ?? 2048;

  try {
    // Fix 4: system 改为数组格式，挂载 cache_control
    const body: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages,
    };
    // Fix 3: temperature 现在真正传给 API
    if (options.temperature !== undefined) body.temperature = options.temperature;

    const res = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, ...ANTHROPIC_HEADERS },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, content: "", model, error: `API Error ${res.status}: ${err}` };
    }

    const data = await res.json() as {
      content: Array<{ type: string; text: string }>;
      model: string;
      usage: {
        input_tokens: number;
        output_tokens: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
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

// ==================== TOOL USE ====================

export interface ClaudeTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
}

export type ToolExecutor = (
  name: string,
  input: Record<string, unknown>
) => Promise<string>;

/**
 * 多轮 Tool Use 调用：Claude 可以调用工具直到完成任务
 * - 最多 10 轮工具调用避免无限循环
 * - 每次工具调用通过 toolExecutor 执行并把结果返回给 Claude
 * - 最终返回 Claude 的文字回复
 */
export async function callClaudeWithTools(
  systemPrompt: string,
  userMessage: string,
  tools: ClaudeTool[],
  toolExecutor: ToolExecutor,
  model: ClaudeModel = "claude-haiku-4-5-20251001"
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return "[AI Error: ANTHROPIC_API_KEY 未配置]";
  }

  type ContentBlock =
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

  type Message =
    | { role: "user"; content: string | Array<{ type: "tool_result"; tool_use_id: string; content: string }> }
    | { role: "assistant"; content: ContentBlock[] };

  const messages: Message[] = [{ role: "user", content: userMessage }];
  const MAX_ITERATIONS = 10;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let res: Response;
    try {
      res = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, ...ANTHROPIC_HEADERS },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          // Fix 4: system 缓存
          system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
          tools,
          messages,
        }),
      });
    } catch (err) {
      return `[AI Error: ${err instanceof Error ? err.message : "网络请求失败"}]`;
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return `[AI Error: API Error ${res.status}: ${errText}]`;
    }

    const data = await res.json() as {
      stop_reason: string;
      content: ContentBlock[];
      usage?: { input_tokens: number; output_tokens: number };
    };

    messages.push({ role: "assistant", content: data.content });

    if (data.stop_reason === "end_turn") {
      const textBlock = data.content.find(b => b.type === "text") as { type: "text"; text: string } | undefined;
      return textBlock?.text ?? "";
    }

    if (data.stop_reason === "tool_use") {
      const toolUseBlocks = data.content.filter(b => b.type === "tool_use") as Array<{
        type: "tool_use"; id: string; name: string; input: Record<string, unknown>
      }>;

      const toolResults: Array<{ type: "tool_result"; tool_use_id: string; content: string }> = [];

      for (const block of toolUseBlocks) {
        let result: string;
        try {
          result = await toolExecutor(block.name, block.input);
        } catch (err) {
          result = `ERROR: ${err instanceof Error ? err.message : "工具执行失败"}`;
        }
        // Fix 5: 截断过长的工具返回值，防止 context 溢出
        if (result.length > 4000) result = result.slice(0, 4000) + "\n...[已截断，超出 4000 字符]";
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }

      messages.push({ role: "user", content: toolResults });
      continue;
    }

    break;
  }

  return "[AI Error: 超过最大工具调用轮次]";
}
