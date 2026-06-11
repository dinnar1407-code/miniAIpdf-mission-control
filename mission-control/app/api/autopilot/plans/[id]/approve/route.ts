import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createMissionFromPlan }     from "@/lib/mission-orchestrator";


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

  // 直接创建 Mission（下方 await）即为权威路径，结果用于返回 missionId。
  // 不再额外发 Inngest 事件——否则 Inngest worker 会再调一次 createMissionFromPlan，
  // 造成重复触发（虽有唯一约束兜底，但应从源头避免无谓的重复工作）。
  let mission;
  try {
    mission = await createMissionFromPlan(planId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("createMissionFromPlan failed:", msg);
    return NextResponse.json(
      { error: `Plan approved but Mission creation failed: ${msg}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ...updatedPlan, missionId: mission.id });
}
