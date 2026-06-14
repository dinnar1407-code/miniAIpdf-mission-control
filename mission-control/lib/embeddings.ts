import { GoogleGenerativeAI } from "@google/generative-ai";

const API_MODEL = "gemini-embedding-001";       // Gemini SDK model name
const EMBEDDING_MODEL_ID = "google/gemini-embedding-001"; // stored in Memory.embeddingModel
const DIMENSIONS = 1536;

// 单次 Gemini embedding 调用超时（毫秒）。
// 为什么是 30s：和 Claude 客户端保持一致，小于路由 maxDuration。
// Gemini SDK 的 embedContent 不直接暴露 AbortSignal，所以这里用 Promise.race
// 让「真正的请求」和「一个到点就 reject 的计时器」赛跑——谁先结束用谁的结果。
// 这样即使上游网络卡死，30s 后也会抛错，而不是让函数无限挂起。
const EMBED_TIMEOUT_MS = 30_000;

// 给任意 Promise 套超时：原始 Promise 和「计时器 reject」赛跑。
// 注意 finally 里 clearTimeout，避免请求已经成功了计时器还在空跑造成泄漏。
// <T> 是泛型，表示这个函数不关心 Promise 里具体是什么类型，原样透传。
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  // 到点就 reject 的「计时器 Promise」
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} 超时（>${timeoutMs}ms）`)), timeoutMs);
  });
  // 谁先 settle 用谁；无论结果如何都清掉计时器
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    _genAI = new GoogleGenerativeAI(apiKey);
  }
  return _genAI;
}

export interface EmbedResult {
  embedding: number[];
  inputTokens: number;
  latencyMs: number;
}

export interface EmbedBatchResult {
  embeddings: number[][];
  totalInputTokens: number;
  latencyMs: number;
}

type GeminiTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" | "SEMANTIC_SIMILARITY";

/** Embed a single text string. */
export async function embedText(
  text: string,
  taskType: GeminiTaskType = "RETRIEVAL_DOCUMENT"
): Promise<EmbedResult> {
  const start = Date.now();
  const model = getGenAI().getGenerativeModel({ model: API_MODEL });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // 用 withTimeout 包住这次 Gemini 请求：30s 内没返回就抛超时错误，避免函数挂死。
  // 显式写 <any>：因为 embedContent 走的是 as any（SDK 类型不全），
  // 不指定的话泛型会被推断成 unknown，导致下面 result.embedding 报错。
  const result = await withTimeout<any>(
    (model.embedContent as any)({
      content: { role: "user", parts: [{ text: text.slice(0, 25000) }] },
      taskType,
      outputDimensionality: DIMENSIONS,
    }),
    EMBED_TIMEOUT_MS,
    "embedText"
  );

  const embedding: number[] = result.embedding.values;
  const latencyMs = Date.now() - start;

  console.log(
    JSON.stringify({
      event:    "embed_text",
      model:    EMBEDDING_MODEL_ID,
      dims:     embedding.length,
      latencyMs,
      ts:       new Date().toISOString(),
    })
  );

  return { embedding, inputTokens: 0, latencyMs };
}

/** Embed multiple texts. Runs in parallel (no Gemini batch endpoint in SDK). */
export async function embedTexts(
  texts: string[],
  taskType: GeminiTaskType = "RETRIEVAL_DOCUMENT"
): Promise<EmbedBatchResult> {
  const start = Date.now();
  const model = getGenAI().getGenerativeModel({ model: API_MODEL });

  const results = await Promise.all(
    texts.map((text) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // 每个并行请求都各自套 30s 超时；任何一个卡死都会单独抛错，
      // 不会让整个 Promise.all 无限等待。
      // 同上，显式 <any> 避免泛型被推断成 unknown。
      withTimeout<any>(
        (model.embedContent as any)({
          content: { role: "user", parts: [{ text: text.slice(0, 25000) }] },
          taskType,
          outputDimensionality: DIMENSIONS,
        }),
        EMBED_TIMEOUT_MS,
        "embedTexts"
      )
    )
  );

  const embeddings: number[][] = results.map((r) => r.embedding.values);
  const latencyMs = Date.now() - start;

  console.log(
    JSON.stringify({
      event:            "embed_batch",
      model:            EMBEDDING_MODEL_ID,
      count:            texts.length,
      totalInputTokens: 0,
      latencyMs,
      ts:               new Date().toISOString(),
    })
  );

  return { embeddings, totalInputTokens: 0, latencyMs };
}

export { DIMENSIONS, EMBEDDING_MODEL_ID as EMBEDDING_MODEL };
