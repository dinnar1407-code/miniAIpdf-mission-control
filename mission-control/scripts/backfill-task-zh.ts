/**
 * Backfill Chinese translations for existing Task records.
 *
 * Usage (from project root):
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/backfill-task-zh.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const MODEL   = "claude-haiku-4-5-20251001";
const BATCH   = 5;
const DELAY   = 1000;

const SYSTEM = `You are a professional translator. Given task fields, return only a JSON object with Chinese translations — no markdown fences, no extra text:
{
  "titleZh": "简短中文任务标题，不超过40字",
  "descriptionZh": "中文描述，或null（如果原描述为null）"
}`;

interface ZhDraft {
  titleZh: string;
  descriptionZh: string | null;
}

async function translate(title: string, description: string | null): Promise<ZhDraft | null> {
  const userPrompt = `title: ${title}\ndescription: ${description ?? "null"}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:  "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: 300,
      system:     SYSTEM,
      messages:   [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    console.error(`API error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return null;
  }

  const data = await res.json() as { content: { text: string }[] };
  const raw  = data.content?.[0]?.text ?? "";

  try {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const json    = JSON.parse(cleaned) as Partial<ZhDraft>;
    return {
      titleZh:       String(json.titleZh ?? "").slice(0, 80) || title,
      descriptionZh: json.descriptionZh ? String(json.descriptionZh) : null,
    };
  } catch {
    console.error("Parse error:", raw.slice(0, 200));
    return null;
  }
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  if (!API_KEY) {
    console.error("ANTHROPIC_API_KEY not set — aborting.");
    process.exit(1);
  }

  const total = await prisma.task.count({ where: { titleZh: null } });
  console.log(`Found ${total} tasks without Chinese translations.`);

  if (total === 0) {
    console.log("Nothing to backfill.");
    return;
  }

  let done = 0, failed = 0, offset = 0;

  while (offset < total) {
    const batch = await prisma.task.findMany({
      where:   { titleZh: null },
      select:  { id: true, title: true, description: true },
      orderBy: { createdAt: "asc" },
      skip:    offset,
      take:    BATCH,
    });

    if (batch.length === 0) break;

    await Promise.all(
      batch.map(async (task) => {
        const zh = await translate(task.title, task.description);
        if (!zh) { failed++; return; }

        await prisma.task.update({
          where: { id: task.id },
          data:  { titleZh: zh.titleZh, descriptionZh: zh.descriptionZh },
        });

        done++;
        console.log(`[${done}/${total}] OK ${task.id} — ${zh.titleZh}`);
      })
    );

    offset += batch.length;
    if (offset < total) await sleep(DELAY);
  }

  console.log(`\nDone. translated=${done}, failed=${failed}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
