import { prisma } from "@/lib/db";
import { inngest }        from "@/inngest/client";
import { planFromInsight } from "@/lib/planner";


export const planOnInsightFn = inngest.createFunction(
  {
    id:       "plan-on-insight",
    name:     "Auto-Plan on High-Severity Insight",
    triggers: [{ event: "autopilot/insights.generated" }],
  },
  async ({ event, step }) => {
    const { insightIds } = event.data as { insightIds: string[] };

    const results = await step.run("plan-high-severity-insights", async () => {
      let planned = 0;
      let skipped = 0;
      let errors  = 0;

      for (const id of insightIds) {
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
