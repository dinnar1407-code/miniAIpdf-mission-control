/**
 * Backfill Chinese translations for existing Insight records.
 *
 * Usage (from project root):
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/backfill-insight-zh.ts
 *
 * Picks up DATABASE_URL and ANTHROPIC_API_KEY from the environment.
 * Skips any insight that already has titleZh set.
 * Processes records in batches of 5 with a small delay to avoid rate limits.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const MODEL   = "claude-haiku-4-5-20251001";
const BATCH   = 5;
const DELAY   = 1000; // ms between batches

const SYSTEM = `You are a professional translator. Given English insight fields, return only a JSON object with Chinese translations — no markdown fences, no extra text:
{
  "titleZh": "简短中文标题，不超过30字",
  "summaryZh": "2-3句中文摘要",
  "suggestedActionZh": "中文建议行动，或null"
}`;

interface ZhDraft {
  titleZh: string;
  summaryZh: string;
  suggestedActionZh: string | null;
}

async function translate(
  title: string,
  summary: string,
  suggestedAction: string | null
): Promise<ZhDraft | null> {
  const userPrompt = `title: ${title}\nsummary: ${summary}\nsuggestedAction: ${suggestedAction ?? "null"}`;

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
    const err = await res.text();
    console.error(`API error ${res.status}: ${err.slice(0, 200)}`);
    return null;
  }

  const data = await res.json() as { content: { text: string }[] };
  const raw  = data.content?.[0]?.text ?? "";

  try {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const json    = JSON.parse(cleaned) as Partial<ZhDraft>;
    return {
      titleZh:           String(json.titleZh ?? "").slice(0, 60) || title,
      summaryZh:         String(json.summaryZh ?? ""),
      suggestedActionZh: json.suggestedActionZh ? String(json.suggestedActionZh) : null,
    };
  } catch {
    console.error("Parse error:", raw.slice(0, 200));
    return null;
  }
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!API_KEY) {
    console.error("ANTHROPIC_API_KEY not set — aborting.");
    process.exit(1);
  }

  const total = await prisma.insight.count({ where: { titleZh: null } });
  console.log(`Found ${total} insights without Chinese translations.`);

  if (total === 0) {
    console.log("Nothing to backfill.");
    return;
  }

  let done = 0, failed = 0, offset = 0;

  while (offset < total) {
    const batch = await prisma.insight.findMany({
      where:   { titleZh: null },
      select:  { id: true, title: true, summary: true, suggestedAction: true },
      orderBy: { createdAt: "asc" },
      skip:    offset,
      take:    BATCH,
    });

    if (batch.length === 0) break;

    await Promise.all(
      batch.map(async (insight) => {
        const zh = await translate(insight.title, insight.summary, insight.suggestedAction);
        if (!zh) { failed++; return; }

        await prisma.insight.update({
          where: { id: insight.id },
          data:  {
            titleZh:           zh.titleZh,
            summaryZh:         zh.summaryZh,
            suggestedActionZh: zh.suggestedActionZh,
          },
        });

        done++;
        console.log(`[${done}/${total}] OK ${insight.id} — ${zh.titleZh}`);
      })
    );

    offset += batch.length;
    if (offset < total) await sleep(DELAY);
  }

  console.log(`\nDone. translated=${done}, failed=${failed}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
