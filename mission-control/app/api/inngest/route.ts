import { serve }               from "inngest/next";
import { inngest }              from "@/inngest/client";
import { memorySyncFn }         from "@/inngest/functions/memory-sync";
import { planOnInsightFn }      from "@/inngest/functions/plan-on-insight";
import { missionOnApprovalFn }  from "@/inngest/functions/mission-on-approval";

export const { GET, POST, PUT } = serve({
  client:    inngest,
  functions: [memorySyncFn, planOnInsightFn, missionOnApprovalFn],
});
