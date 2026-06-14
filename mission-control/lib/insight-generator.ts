import { InsightType, Severity } from "@prisma/client";
import { prisma } from "@/lib/db";
import { llmCall } from "@/lib/llm";
import { type RawObservation } from "@/lib/observer";
import { inngest } from "@/inngest/client";

interface InsightDraft {
  type: InsightType;
  severity: Severity;
  title: string;
  titleZh?: string;
  summary: string;
  summaryZh?: string;
  suggestedAction: string | null;
  suggestedActionZh?: string | null;
}

export interface InsightGeneratorResult {
  processed: number;
  created: number;
  skipped: number;
  errors: number;
}

const SYSTEM_PROMPT = `You are an AI analyst for a multi-project operations dashboard.
Given a metric observation, classify it and generate a bilingual insight (English + Chinese).

Respond with valid JSON only, no markdown fences:
{
  "type": "anomaly" | "opportunity" | "risk" | "trend" | "milestone",
  "severity": "low" | "medium" | "high" | "critical",
  "title": "short English title under 80 characters",
  "titleZh": "简短中文标题，不超过30字",
  "summary": "2-3 sentences in English explaining what the data shows and why it matters",
  "summaryZh": "2-3句中文，解释数据含义和影响",
  "suggestedAction": "a concrete recommended action in English, or null",
  "suggestedActionZh": "具体的中文建议行动，或null"
}`;

function buildUserPrompt(obs: RawObservation): string {
  const pctStr = (obs.deltaPct7d * 100).toFixed(1);
  const direction = obs.delta7d >= 0 ? "increased" : "decreased";
  const goalLine =
    obs.target !== 0
      ? `Goal target: ${obs.target} ${obs.unit}. Current gap: ${(((obs.current - obs.target) / Math.abs(obs.target)) * 100).toFixed(1)}%.`
      : "No goal target set.";

  return `Project: ${obs.projectName}
Metric: ${obs.metric} (unit: ${obs.unit})
Current value: ${obs.current}
Baseline 7 days ago: ${obs.baseline}
Change: ${direction} by ${Math.abs(obs.delta7d).toFixed(2)} (${pctStr}%) over 7 days.
${goalLine}
Data source: ${obs.source}
Observed at: ${obs.observedAt}`;
}

const VALID_TYPES = new Set<string>(["anomaly", "opportunity", "risk", "trend", "milestone"]);
const VALID_SEVERITIES = new Set<string>(["low", "medium", "high", "critical"]);

// 单次运行最多处理多少条观测数据（每条都要调一次 LLM）。
// 为什么要这个上限：每条 observation 都会触发一次付费的 LLM 调用，
// 如果某次传进来上千条，会一口气烧掉大量 token / 费用，也可能撞上路由超时。
// 设成 25 条作为「安全闸」：超出的部分这次先跳过并记日志，下次运行再处理，
// 既控制单次成本，又不会静默丢数据（日志里能看到被跳过多少）。
const MAX_OBSERVATIONS_PER_RUN = 25;

function stripFences(raw: string): string {
  // Strip ```json ... ``` or ``` ... ``` wrappers that some models add
  return raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function parseDraft(raw: string): InsightDraft | null {
  try {
    const json = JSON.parse(stripFences(raw));
    if (
      !VALID_TYPES.has(json.type) ||
      !VALID_SEVERITIES.has(json.severity) ||
      typeof json.title !== "string" ||
      typeof json.summary !== "string"
    ) {
      return null;
    }
    return {
      type:               json.type as InsightType,
      severity:           json.severity as Severity,
      title:              String(json.title).slice(0, 80),
      titleZh:            json.titleZh ? String(json.titleZh).slice(0, 60) : undefined,
      summary:            String(json.summary),
      summaryZh:          json.summaryZh ? String(json.summaryZh) : undefined,
      suggestedAction:    json.suggestedAction ? String(json.suggestedAction) : null,
      suggestedActionZh:  json.suggestedActionZh ? String(json.suggestedActionZh) : null,
    };
  } catch {
    return null;
  }
}

async function isDuplicate(obs: RawObservation): Promise<boolean> {
  // Skip if an insight for this project+metric was created in the last 6 hours
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const existing = await prisma.insight.findFirst({
    where: {
      projectId: obs.projectId,
      observedAt: { gte: since },
      title: { contains: obs.metric },
    },
  });
  return existing !== null;
}

export async function generateInsights(
  observations: RawObservation[]
): Promise<InsightGeneratorResult> {
  // 批量上限保护：本次最多处理 MAX_OBSERVATIONS_PER_RUN 条。
  // slice(0, N) 取前 N 条；剩下的这次不处理，下面单独记日志说明跳过了多少，
  // 避免一次运行调用过多 LLM 把成本/时间烧爆。
  const toProcess = observations.slice(0, MAX_OBSERVATIONS_PER_RUN);
  const overflow = observations.length - toProcess.length;
  if (overflow > 0) {
    console.warn(
      JSON.stringify({
        event:   "insight_generator_batch_capped",
        total:   observations.length,   // 实际传进来的总数
        limit:   MAX_OBSERVATIONS_PER_RUN, // 单次上限
        skipped: overflow,               // 这次被跳过、留待下次处理的条数
        ts:      new Date().toISOString(),
      })
    );
  }

  const result: InsightGeneratorResult = {
    processed: toProcess.length,
    created: 0,
    skipped: 0,
    errors: 0,
  };
  const createdIds: string[] = [];

  for (const obs of toProcess) {
    try {
      if (await isDuplicate(obs)) {
        result.skipped++;
        continue;
      }

      const llmResult = await llmCall({
        task: "observe",
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: buildUserPrompt(obs),
        maxTokens: 600,
        temperature: 0.2,
        projectId: obs.projectId,
      });

      const draft = parseDraft(llmResult.content);
      if (!draft) {
        console.error(
          JSON.stringify({
            event:     "insight_parse_error",
            projectId: obs.projectId,
            metric:    obs.metric,
            raw:       llmResult.content.slice(0, 200),
            ts:        new Date().toISOString(),
          })
        );
        result.errors++;
        continue;
      }

      const created = await prisma.insight.create({
        data: {
          projectId:        obs.projectId,
          goalId:           obs.goalId,
          type:             draft.type,
          severity:         draft.severity,
          title:            draft.title,
          titleZh:          draft.titleZh,
          summary:          draft.summary,
          summaryZh:        draft.summaryZh,
          evidence:         obs as object,
          suggestedAction:  draft.suggestedAction,
          suggestedActionZh: draft.suggestedActionZh,
          status:           "new",
          observedAt:       new Date(obs.observedAt),
        },
      });

      createdIds.push(created.id);
      result.created++;
    } catch (err) {
      console.error(
        JSON.stringify({
          event:     "insight_generation_error",
          projectId: obs.projectId,
          metric:    obs.metric,
          error:     String(err),
          ts:        new Date().toISOString(),
        })
      );
      result.errors++;
    }
  }

  console.log(
    JSON.stringify({
      event: "insight_generator_run",
      ...result,
      ts:    new Date().toISOString(),
    })
  );

  if (createdIds.length > 0) {
    await inngest.send({
      name: "autopilot/insights.generated",
      data: { insightIds: createdIds },
    });
  }

  return result;
}
