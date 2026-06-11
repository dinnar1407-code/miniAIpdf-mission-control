import { prisma } from "@/lib/db";
import { inngest }               from "@/inngest/client";
import { createMissionFromPlan } from "@/lib/mission-orchestrator";


export const missionOnApprovalFn = inngest.createFunction(
  {
    id:      "mission-on-approval",
    name:    "Create Mission from approved Plan",
    // No retries — failures are typically schema/agent mismatches that retry won't fix
    retries: 0,
    triggers: [{ event: "autopilot/plans.approved" }],
  },
  async ({ event, step }) => {
    const { planId } = event.data as { planId: string };

    try {
      const mission = await step.run("create-mission", () =>
        createMissionFromPlan(planId)
      );
      return { missionId: mission.id, status: mission.status };
    } catch (err) {
      console.error(
        JSON.stringify({
          event:  "mission_creation_failed",
          planId,
          error:  String(err),
          ts:     new Date().toISOString(),
        })
      );

      await prisma.plan.update({
        where: { id: planId },
        data:  { status: "failed" },
      });

      throw err;
    }
  }
);
