import { GoogleGenerativeAI } from "@google/generative-ai";

const API_MODEL = "gemini-embedding-001";       // Gemini SDK model name
const EMBEDDING_MODEL_ID = "google/gemini-embedding-001"; // stored in Memory.embeddingModel
const DIMENSIONS = 1536;

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
  const result = await (model.embedContent as any)({
    content: { role: "user", parts: [{ text: text.slice(0, 25000) }] },
    taskType,
    outputDimensionality: DIMENSIONS,
  });

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
      (model.embedContent as any)({
        content: { role: "user", parts: [{ text: text.slice(0, 25000) }] },
        taskType,
        outputDimensionality: DIMENSIONS,
      })
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
