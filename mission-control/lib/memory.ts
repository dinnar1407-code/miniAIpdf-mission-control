import { randomUUID } from "crypto";
import { MemoryKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { embedText, EMBEDDING_MODEL } from "@/lib/embeddings";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type MemoryHit = {
  id: string;
  kind: MemoryKind;
  content: string;
  metadata: unknown;
  sourceTable: string;
  sourceId: string;
  similarity: number;
  score: number;
  helpfulCount: number;
  createdAt: Date;
};

// Raw row shape from $queryRaw before number conversions
type RawHit = Omit<MemoryHit, "similarity" | "score" | "helpfulCount"> & {
  similarity: number | bigint;
  score: number | bigint;
  helpfulCount: number | bigint;
};

// ─────────────────────────────────────────────────────────────
// A) retrieveSimilar — two-stage CTE so HNSW index fires
// ─────────────────────────────────────────────────────────────

const DEFAULT_KINDS: MemoryKind[] = ["feedback_lesson", "playbook", "postmortem"];

export async function retrieveSimilar(opts: {
  queryEmbedding: number[];
  projectId?: string;
  kinds?: MemoryKind[];
  minSimilarity?: number;
  candidatePoolSize?: number;
  limit?: number;
}): Promise<MemoryHit[]> {
  const {
    queryEmbedding,
    projectId,
    kinds = DEFAULT_KINDS,
    minSimilarity = 0.55,
    candidatePoolSize = 50,
    limit = 8,
  } = opts;

  // Vector must be inlined — pgvector doesn't accept parameterised real[] as vector
  const vecLiteral = `'[${queryEmbedding.join(",")}]'::vector`;

  // MemoryKind is a constrained Prisma enum — safe to inline
  const kindsLiteral = kinds.map((k) => `'${k}'`).join(",");

  // Project filter fragment (projectId goes through parameterised query)
  const projectCond =
    projectId !== undefined
      ? Prisma.sql`AND ("projectId" = ${projectId} OR "projectId" IS NULL)`
      : Prisma.sql``;

  const rows = await prisma.$queryRaw<RawHit[]>(
    Prisma.sql`
      WITH knn AS (
        SELECT
          id, kind, content, metadata,
          "sourceTable", "sourceId",
          "helpfulCount"::int  AS "helpfulCount",
          "createdAt",
          1 - (embedding <=> ${Prisma.raw(vecLiteral)}) AS similarity
        FROM "Memory"
        WHERE embedding IS NOT NULL
          AND kind = ANY(ARRAY[${Prisma.raw(kindsLiteral)}]::"MemoryKind"[])
          ${projectCond}
        ORDER BY embedding <=> ${Prisma.raw(vecLiteral)}   -- HNSW fires here
        LIMIT ${candidatePoolSize}
      )
      SELECT *,
        similarity
        * (1 + LEAST("helpfulCount", 5) * 0.1)
        * EXP(-EXTRACT(EPOCH FROM (now() - "createdAt")) / 7776000.0) AS score
      FROM knn
      WHERE similarity > ${minSimilarity}
      ORDER BY score DESC
      LIMIT ${limit}
    `
  );

  return rows.map((r) => ({
    ...r,
    similarity:   Number(r.similarity),
    score:        Number(r.score),
    helpfulCount: Number(r.helpfulCount),
  }));
}

// ─────────────────────────────────────────────────────────────
// B) writeMemory — upsert with embedding
// ─────────────────────────────────────────────────────────────

export async function writeMemory(opts: {
  projectId?: string;
  kind: MemoryKind;
  content: string;
  sourceTable: string;
  sourceId: string;
  metadata: Record<string, unknown>;
}): Promise<{ id: string; isNew: boolean }> {
  const { projectId, kind, content, sourceTable, sourceId, metadata } = opts;

  const { embedding } = await embedText(content, "RETRIEVAL_DOCUMENT");
  const vecLiteral = `'[${embedding.join(",")}]'::vector`;
  const metaJson = JSON.stringify(metadata);
  const newId = randomUUID();
  const now = new Date();

  const rows = await prisma.$queryRaw<{ id: string; is_new: boolean }[]>(
    Prisma.sql`
      INSERT INTO "Memory" (
        id, "projectId", kind, content, embedding,
        "embeddingModel", "sourceTable", "sourceId",
        metadata, "retrievedCount", "helpfulCount",
        "createdAt", "updatedAt"
      )
      VALUES (
        ${newId},
        ${projectId ?? null},
        ${kind}::"MemoryKind",
        ${content},
        ${Prisma.raw(vecLiteral)},
        ${EMBEDDING_MODEL},
        ${sourceTable},
        ${sourceId},
        ${metaJson}::jsonb,
        0, 0,
        ${now}, ${now}
      )
      ON CONFLICT ("sourceTable", "sourceId") DO UPDATE SET
        content          = EXCLUDED.content,
        embedding        = EXCLUDED.embedding,
        "embeddingModel" = EXCLUDED."embeddingModel",
        metadata         = EXCLUDED.metadata,
        "updatedAt"      = now()
      RETURNING id, (xmax = 0) AS is_new
    `
  );

  return { id: rows[0].id, isNew: Boolean(rows[0].is_new) };
}

// ─────────────────────────────────────────────────────────────
// C) markRetrieved — increment retrievedCount
// ─────────────────────────────────────────────────────────────

export async function markRetrieved(memoryIds: string[]): Promise<void> {
  if (memoryIds.length === 0) return;
  await prisma.memory.updateMany({
    where: { id: { in: memoryIds } },
    data:  { retrievedCount: { increment: 1 } },
  });
}
