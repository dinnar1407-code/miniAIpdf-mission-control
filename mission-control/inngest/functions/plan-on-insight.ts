import { prisma } from "@/lib/db";
import { inngest }        from "@/inngest/client";
import { planFromInsight } from "@/lib/planner";

// 单次最多对多少个 insight 跑 planFromInsight（每个都会调 LLM 做规划）。
// 为什么设上限：planFromInsight 是「重」操作（调用更贵的规划模型），
// 如果一次事件里塞进几十上百个 insightId，会一次性烧掉大量成本，也容易撞 Inngest step 超时。
// 设成 15 条作为安全闸：超出的部分这次先跳过并记日志，避免单次失控。
const MAX_INSIGHTS_PER_RUN = 15;


export const planOnInsightFn = inngest.createFunction(
  {
    id:       "plan-on-insight",
    name:     "Auto-Plan on High-Severity Insight",
    triggers: [{ event: "autopilot/insights.generated" }],
  },
  async ({ event, step }) => {
    const { insightIds } = event.data as { insightIds: string[] };

    // 批量上限保护：本次最多处理 MAX_INSIGHTS_PER_RUN 个 insight。
    // slice(0, N) 取前 N 个；超出的先跳过并记日志，避免单次规划调用过多 LLM。
    const toPlan = insightIds.slice(0, MAX_INSIGHTS_PER_RUN);
    const overflow = insightIds.length - toPlan.length;
    if (overflow > 0) {
      console.warn(
        JSON.stringify({
          event:   "plan_on_insight_batch_capped",
          total:   insightIds.length,    // 本次事件携带的总数
          limit:   MAX_INSIGHTS_PER_RUN, // 单次上限
          skipped: overflow,             // 这次被跳过的条数
          ts:      new Date().toISOString(),
        })
      );
    }

    const results = await step.run("plan-high-severity-insights", async () => {
      let planned = 0;
      let skipped = 0;
      let errors  = 0;

      for (const id of toPlan) {
        try {
          const insight = await prisma.insight.findUnique({ where: { id } });
          if (!insight) { skipped++; continue; }
          if (!["high", "critical"].includes(insight.severity)) { skipped++; continue; }

          await planFromInsight(id);
          planned++;
        } catch (err) {
          console.error(
            JSON.stringify({
              event:     "plan_on_insight_error",
              insightId: id,
              error:     String(err),
              ts:        new Date().toISOString(),
            })
          );
          errors++;
        }
      }

      return { planned, skipped, errors };
    });

    console.log(
      JSON.stringify({
        event: "plan_on_insight_complete",
        total: insightIds.length,
        ...results,
        ts:    new Date().toISOString(),
      })
    );

    return results;
  }
);
