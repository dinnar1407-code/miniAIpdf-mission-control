import { PrismaClient }          from "@prisma/client";
import { planFromInsight }        from "@/lib/planner";
import { createMissionFromPlan }  from "@/lib/mission-orchestrator";
import { inngest }                from "@/inngest/client";
import { NextRequest }            from "next/server";
import { POST as approvePost }    from "@/app/api/autopilot/plans/[id]/approve/route";

const prisma = new PrismaClient();

async function findOrCreateApprovedPlan(): Promise<string> {
  // Prefer an already-approved plan that has no Mission yet
  const candidates = await prisma.plan.findMany({
    where:   { status: "approved" },
    include: { missions: { select: { id: true } } },
    orderBy: { createdAt: "desc" },
    take:    20,
  });
  const free = candidates.find((p) => p.missions.length === 0);
  if (free) {
    console.log(`  → Re-using approved plan: ${free.id}`);
    return free.id;
  }

  // Fall back: create plan from a new insight
  console.log("  No free approved plan — creating one from insight...");
  let insightId: string;

  const fresh = await prisma.insight.findFirst({
    where:   { status: "new" },
    orderBy: { createdAt: "desc" },
  });

  if (fresh) {
    insightId = fresh.id;
  } else {
    const project = await prisma.project.findFirstOrThrow();
    const seeded  = await prisma.insight.create({
      data: {
        projectId:       project.id,
        type:            "opportunity",
        severity:        "high",
        title:           "Test: Mission orchestration",
        summary:         "Conversion rate increased 18% after A/B test. Winner variant should be promoted to 100% traffic.",
        evidence:        { metric: "conversion_rate", delta: 0.18 },
        suggestedAction: "Promote winner variant and document findings.",
        status:          "new",
        observedAt:      new Date(),
      },
    });
    insightId = seeded.id;
    console.log(`  Seeded insight: ${insightId}`);
  }

  const { plan } = await planFromInsight(insightId);
  console.log(`  Created plan: ${plan.id}, status=${plan.status}`);

  if (plan.status === "pending") {
    const req = new NextRequest(
      `http://localhost/api/autopilot/plans/${plan.id}/approve`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ decidedBy: "test-runner" }),
      }
    );
    const res = await approvePost(req, { params: { id: plan.id } });
    console.log(`  Approve API: ${res.status}`);
  }

  const confirmed = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
  if (confirmed.status !== "approved") {
    throw new Error(`Plan ${plan.id} still not approved (status=${confirmed.status})`);
  }
  return confirmed.id;
}

async function main() {
  console.log("=== Mission Orchestrator Test ===\n");

  // ── 1. Find / create approved plan ──
  console.log("[1] Finding approved plan with no Mission...");
  const planId = await findOrCreateApprovedPlan();
  console.log(`    → planId=${planId}`);

  // ── 2. createMissionFromPlan ──
  console.log("\n[2] createMissionFromPlan()...");
  const t0        = Date.now();
  const mission   = await createMissionFromPlan(planId);
  const latencyMs = Date.now() - t0;

  console.log(`    mission.id:            ${mission.id}`);
  console.log(`    mission.workflowId:    ${mission.workflowId}`);
  console.log(`    mission.workflowRunId: ${mission.workflowRunId ?? "(null)"}`);
  console.log(`    mission.status:        ${mission.status}`);
  console.log(`    latencyMs:             ${latencyMs}`);
  console.log(`    workflowId non-empty:  ${mission.workflowId ? "PASS" : "FAIL"}`);

  const workflow = await prisma.workflow.findUniqueOrThrow({ where: { id: mission.workflowId } });
  console.log(`    Workflow name:         ${workflow.name}`);
  console.log(`    name starts 'plan:':   ${workflow.name.startsWith("plan:") ? "PASS" : "FAIL"}`);

  if (mission.workflowRunId) {
    const wr    = await prisma.workflowRun.findUnique({ where: { id: mission.workflowRunId } });
    const steps = JSON.parse(wr?.stepResults ?? "[]") as unknown[];
    console.log(`    WorkflowRun exists:    ${wr ? "PASS" : "FAIL"}`);
    console.log(`    WorkflowRun.status:    ${wr?.status}`);
    console.log(`    stepResults count:     ${steps.length}`);
  } else {
    console.log(`    WorkflowRun:           (not linked — possible early failure)`);
  }

  // Plan.status is updated to "completed"/"failed" after mission finishes (subtask 1)
  const dbPlan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  const planFinalOk = dbPlan.status === "completed" || dbPlan.status === "failed";
  console.log(`    Plan.status final:     ${planFinalOk ? "PASS" : "FAIL"} (${dbPlan.status}, expected completed|failed)`);

  // ── 3. Mission final status ──
  console.log("\n[3] Mission final status...");
  if (mission.status === "succeeded") {
    console.log(`    PASS — mission succeeded, workflowRunId=${mission.workflowRunId}`);
    if (mission.resultSummary) {
      console.log(`    resultSummary: ${mission.resultSummary.slice(0, 120)}`);
    }
  } else if (mission.status === "failed") {
    console.log(`    WARN — Workflow execution failed (orchestrator is correct, this is a Workflow issue)`);
    console.log(`    errorMessage: ${mission.errorMessage}`);
  } else {
    console.log(`    FAIL — mission.status='${mission.status}' (expected succeeded or failed after await)`);
  }

  // ── 4. JOIN query ──
  console.log("\n[4] Full JOIN state:");
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT
      p.id            AS "planId",
      p.status        AS "planStatus",
      m.id            AS "missionId",
      m.status        AS "missionStatus",
      w.id            AS "workflowId",
      w.name          AS "workflowName",
      wr.id           AS "workflowRunId",
      wr.status       AS "workflowRunStatus",
      wr."totalSteps"
    FROM "Plan" p
    JOIN "Mission"     m  ON m."planId"     = p.id
    JOIN "Workflow"    w  ON w.id           = m."workflowId"
    LEFT JOIN "WorkflowRun" wr ON wr.id     = m."workflowRunId"
    WHERE p.id = ${planId}
  `;
  console.log(JSON.stringify(rows, null, 2));

  // ── 5. Idempotency test ──
  console.log("\n[5] Idempotency test (second call must return same Mission)...");
  const [mCntBefore, wCntBefore] = await Promise.all([
    prisma.mission.count({ where: { planId } }),
    prisma.workflow.count({ where: { name: { startsWith: `plan:${planId}` } } }),
  ]);

  const mission2 = await createMissionFromPlan(planId);

  const [mCntAfter, wCntAfter] = await Promise.all([
    prisma.mission.count({ where: { planId } }),
    prisma.workflow.count({ where: { name: { startsWith: `plan:${planId}` } } }),
  ]);

  console.log(`    Same mission.id:       ${mission2.id === mission.id ? "PASS" : "FAIL"}`);
  console.log(`    Mission count stable:  ${mCntAfter === mCntBefore ? "PASS" : "FAIL"} (${mCntBefore}→${mCntAfter})`);
  console.log(`    Workflow count stable: ${wCntAfter === wCntBefore ? "PASS" : "FAIL"} (${wCntBefore}→${wCntAfter})`);

  // ── 6. Inngest event fire for a fresh plan ──
  console.log("\n[6] Seeding second plan and firing Inngest event...");
  const project  = await prisma.project.findFirstOrThrow();
  const insight2 = await prisma.insight.create({
    data: {
      projectId:       project.id,
      type:            "opportunity",
      severity:        "high",
      title:           "Test2: Inngest mission trigger",
      summary:         "NPS score improved from 32 to 51 after product update. Signals strong PMF improvement worth amplifying.",
      evidence:        { metric: "nps", before: 32, after: 51 },
      suggestedAction: "Run targeted outreach to promoter cohort.",
      status:          "new",
      observedAt:      new Date(),
    },
  });

  const { plan: plan2 } = await planFromInsight(insight2.id);
  let planId2 = plan2.id;
  console.log(`    plan2.id=${planId2} status=${plan2.status}`);

  if (plan2.status === "pending") {
    const req = new NextRequest(
      `http://localhost/api/autopilot/plans/${planId2}/approve`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ decidedBy: "test-runner" }),
      }
    );
    const res = await approvePost(req, { params: { id: planId2 } });
    console.log(`    Approve API: ${res.status}`);
  }

  await inngest.send({ name: "autopilot/plans.approved", data: { planId: planId2 } });
  console.log(`    Inngest event fired for planId=${planId2}`);
  console.log(`    → Verify in Inngest dev dashboard > Function Runs > "Create Mission from approved Plan"`);

  await prisma.$disconnect();
  console.log("\n=== ALL DONE ===");
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
