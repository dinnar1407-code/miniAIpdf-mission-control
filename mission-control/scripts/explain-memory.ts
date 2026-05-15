import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRaw<{ embedding: string }[]>`
    SELECT embedding::text FROM "Memory" WHERE "sourceId" = 'test-memory-r1' LIMIT 1
  `;
  if (!rows.length) { console.error("R1 not found"); process.exit(1); }
  const vec = rows[0].embedding;

  const plan = await prisma.$queryRawUnsafe<{ "QUERY PLAN": string }[]>(`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
    SELECT id, 1 - (embedding <=> '${vec}'::vector) AS similarity
    FROM "Memory"
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> '${vec}'::vector
    LIMIT 50
  `);
  console.log(plan.map((r) => r["QUERY PLAN"]).join("\n"));
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
