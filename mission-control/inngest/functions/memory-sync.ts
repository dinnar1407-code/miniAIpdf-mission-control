import { PrismaClient } from "@prisma/client";
import { inngest } from "@/inngest/client";
import { llmCall } from "@/lib/llm";
import { embedText, EMBEDDING_MODEL } from "@/lib/embeddings";

const prisma = new PrismaClient();

const SUMMARIZE_SYSTEM = `You are a knowledge distillation agent. Given an AI-generated insight,
write a concise 2-3 sentence memory entry suitable for future semantic retrieval.
Capture: what changed, the metric context, and the recommended action if any.
Return plain text only — no JSON, no markdown.`;

function buildSummarizePrompt(insight: {
  type: string;
  severity: string;
  title: string;
  summary: string;
  suggestedAction: string | null;
}): string {
  return `Insight type: ${insight.type} (${insight.severity})
Title: ${insight.title}
Summary: ${insight.summary}${insight.suggestedAction ? `\nRecommended action: ${insight.suggestedAction}` : ""}`;
}

export const memorySyncFn = inngest.createFunction(
  {
    id: "memory-sync",
    name: "Sync Insights to Memory",
    triggers: [{ event: "autopilot/insights.generated" }],
  },
  async ({ event, step }) => {
    const { insightIds } = event.data as { insightIds: string[] };

    const results = await step.run("process-insights", async () => {
      let created = 0;
      let skipped = 0;
      let errors = 0;

      for (const insightId of insightIds) {
        try {
          const existing = await prisma.memory.findFirst({
            where: { sourceTable: "Insight", sourceId: insightId },
          });
          if (existing) {
            skipped++;
            continue;
          }

          const insight = await prisma.insight.findUnique({
            where: { id: insightId },
          });
          if (!insight) {
            skipped++;
            continue;
          }

          const llmResult = await llmCall({
            task:         "embed_summary",
            systemPrompt: SUMMARIZE_SYSTEM,
            userPrompt:   buildSummarizePrompt({
              type:            insight.type,
              severity:        insight.severity,
              title:           insight.title,
              summary:         insight.summary,
              suggestedAction: insight.suggestedAction,
            }),
            maxTokens:  150,
            temperature: 0,
            projectId:  insight.projectId ?? undefined,
          });

          const memory = await prisma.memory.create({
            data: {
              projectId:      insight.projectId,
              kind:           "insight_summary",
              content:        llmResult.content,
              embeddingModel: EMBEDDING_MODEL,
              sourceTable:    "Insight",
              sourceId:       insightId,
              metadata:       {
                insightType: insight.type,
                severity:    insight.severity,
                observedAt:  insight.observedAt.toISOString(),
              },
            },
          });

          // Embedding is best-effort — Memory row is still created without it
          try {
            const { embedding } = await embedText(llmResult.content);
            const vectorLiteral = `[${embedding.join(",")}]`;
            await prisma.$executeRaw`
              UPDATE "Memory"
              SET embedding = ${vectorLiteral}::vector
              WHERE id = ${memory.id}
            `;
          } catch (embedErr) {
            console.warn(
              JSON.stringify({
                event:    "memory_embed_skipped",
                memoryId: memory.id,
                error:    String(embedErr),
                ts:       new Date().toISOString(),
              })
            );
          }

          created++;
        } catch (err) {
          console.error(
            JSON.stringify({
              event:     "memory_sync_error",
              insightId,
              error:     String(err),
              ts:        new Date().toISOString(),
            })
          );
          errors++;
        }
      }

      return { created, skipped, errors };
    });

    console.log(
      JSON.stringify({
        event: "memory_sync_complete",
        total: insightIds.length,
        ...results,
        ts:    new Date().toISOString(),
      })
    );

    return results;
  }
);
