import { NextRequest, NextResponse } from "next/server";
import { PrismaClient }              from "@prisma/client";
import { inngest }                   from "@/inngest/client";
import { createMissionFromPlan }     from "@/lib/mission-orchestrator";

const prisma = new PrismaClient();

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let decidedBy: string;
  let notes: string | undefined;
  try {
    const body = await req.json() as { decidedBy?: string; notes?: string };
    decidedBy = body.decidedBy ?? "";
    notes     = body.notes;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!decidedBy) {
    return NextResponse.json({ error: "decidedBy is required" }, { status: 400 });
  }

  const planId = params.id;

  const plan = await prisma.plan.findUnique({
    where:   { id: planId },
    include: { planApproval: true },
  });
  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }
  if (plan.status !== "pending" || plan.planApproval?.decision !== "pending") {
    return NextResponse.json(
      {
        error: `Plan is not awaiting approval (status=${plan.status}, decision=${plan.planApproval?.decision ?? "none"})`,
      },
      { status: 409 }
    );
  }

  const updatedPlan = await prisma.$transaction(async (tx) => {
    await tx.planApproval.update({
      where: { planId },
      data: {
        decision:  "approved",
        decidedBy,
        decidedAt: new Date(),
        notes:     notes ?? null,
      },
    });
    return tx.plan.update({
      where: { id: planId },
      data:  { status: "approved" },
    });
  });

  void inngest.send({ name: "autopilot/plans.approved", data: { planId } });

  let mission;
  try {
    mission = await createMissionFromPlan(planId);
  } catch (err) {
    console.error("createMissionFromPlan failed:", String(err));
  }

  return NextResponse.json({ ...updatedPlan, missionId: mission?.id ?? null });
}
