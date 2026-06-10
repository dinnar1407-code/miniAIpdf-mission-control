import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createMissionFromPlan }     from "@/lib/mission-orchestrator";

export const maxDuration = 120;


// POST /api/autopilot/plans/:id/execute
// Manually trigger Mission creation for an approved Plan.
// Used when Inngest is not configured.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const planId = params.id;

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }
  if (plan.status !== "approved") {
    return NextResponse.json(
      { error: `Plan is not approved (status=${plan.status})` },
      { status: 409 }
    );
  }

  let mission;
  try {
    mission = await createMissionFromPlan(planId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("createMissionFromPlan failed:", msg);
    return NextResponse.json(
      { error: `Mission creation failed: ${msg}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ missionId: mission.id, status: mission.status });
}
