import { PrismaClient }   from "@prisma/client";
import { planFromInsight } from "@/lib/planner";
import { PlanOutputSchema } from "@/lib/planner-schema";
import { embedText }        from "@/lib/embeddings";
import { retrieveSimilar }  from "@/lib/memory";
import { buildUserPrompt }  from "@/prompts/planner-user";
import { needsApproval }    from "@/lib/approval-policy";
import { NextRequest }      from "next/server";
import { POST as approvePost } from "@/app/api/autopilot/plans/[id]/approve/route";

const prisma = new PrismaClient();

async function findOrCreateInsight(): Promise<string> {
  // 1. Prefer a 'new' insight
  const fresh = await prisma.insight.findFirst({
    where:   { status: "new" },
    orderBy: { createdAt: "desc" },
  });
  if (fresh) return fresh.id;

  // 2. Reset most-recent insight of any status to 'new'
  const any = await prisma.insight.findFirst({ orderBy: { createdAt: "desc" } });
  if (any) {
    await prisma.insight.update({ where: { id: any.id }, data: { status: "new" } });
    console.log(`  [setup] Reset insight ${any.id} to status=new`);
    return any.id;
  }

  // 3. No insights at all — seed a test insight (need a project to attach to)
  const project = await prisma.project.findFirst();
  if (!project) throw new Error("No projects in DB. Seed projects first.");

  const seeded = await prisma.insight.create({
    data: {
      projectId:       project.id,
      type:            "opportunity",
      severity:        "high",
      title:           "Test: MRR growth acceleration detected",
      summary:         "Monthly recurring revenue increased by 28% over the past 7 days, outpacing the 3-month average growth rate of 12%. This signals a potential product-market fit inflection point that warrants immediate follow-up to understand the driver and amplify it.",
      evidence:        { metric: "MRR", current: 128, baseline: 100, delta7d: 28, deltaPct7d: 0.28 },
      suggestedAction: "Identify top cohort driving growth and run targeted outreach campaign.",
      status:          "new",
      observedAt:      new Date(),
    },
  });
  console.log(`  [setup] Seeded test insight ${seeded.id}`);
  return seeded.id;
}

async function main() {
  console.log("=== Planner Test ===\n");

  // ── 1. Find a 'new' insight ──
  console.log("[1] Finding status=new insight...");
  const insightId = await findOrCreateInsight();
  console.log(`    → insightId=${insightId}`);

  // ── 1b. Print built user prompt (kept for debug — shows exactly what LLM sees) ──
  console.log("\n[1b] Building user prompt for inspection...");
  const insightFull = await prisma.insight.findUniqueOrThrow({
    where:   { id: insightId },
    include: { project: true, goal: true },
  });
  const goalCtx = insightFull.projectId
    ? await prisma.goal.findMany({ where: { projectId: insightFull.projectId } })
    : [];
  const { embedding: qEmb } = await embedText(insightFull.summary, "RETRIEVAL_QUERY");
  const hits = await retrieveSimilar({
    queryEmbedding: qEmb,
    projectId:      insightFull.projectId ?? undefined,
    kinds:          ["feedback_lesson", "playbook", "postmortem", "insight_summary"],
    limit:          8,
    minSimilarity:  0.55,
  });
  const metaOf = (h: (typeof hits)[0]) =>
    (h.metadata as Record<string, unknown> | null) ?? {};
  const builtPrompt = buildUserPrompt({
    insight: insightFull,
    retrievedContext: {
      successes: hits.filter(h => h.kind === "feedback_lesson" && Number(metaOf(h).effectiveness ?? -1) >= 0.6),
      failures:  hits.filter(h => h.kind === "feedback_lesson" && Number(metaOf(h).effectiveness ?? 1) < 0.3),
      playbooks: hits.filter(h => h.kind === "playbook"),
      others:    hits.filter(h => h.kind !== "feedback_lesson" && h.kind !== "playbook"),
    },
    goalContext:      goalCtx,
    availableAgents:  [],
  });
  console.log("\n====== BUILT USER PROMPT ======");
  console.log(builtPrompt);
  console.log("====== END USER PROMPT ======\n");

  // ── 2. dryRun ──
  console.log("\n[2] planFromInsight(dryRun=true)...");
  const { plan: dryPlan, memoryIdsUsed } = await planFromInsight(insightId, { dryRun: true });

  console.log(`    objective:      ${dryPlan.objective}`);
  console.log(`    priority:       ${dryPlan.priority}`);
  console.log(`    riskLevel:      ${dryPlan.riskLevel}`);
  console.log(`    reversibility:  ${dryPlan.reversibility}`);
  console.log(`    steps.length:   ${dryPlan.steps.length}`);
  console.log(`    memoryIds used: ${memoryIdsUsed.length}`);

  const citations = Array.from(dryPlan.rationale.matchAll(/\[[HFPO]\d+\]/g)).map((m) => m[0]);
  console.log(`    citations:      ${citations.length > 0 ? citations.join(" ") : "(none)"}`);

  const validation = PlanOutputSchema.safeParse({
    objective:        dryPlan.objective,
    rationale:        dryPlan.rationale,
    priority:         dryPlan.priority,
    estimatedKpi:     dryPlan.estimatedKpi,
    estimatedDelta:   dryPlan.estimatedDelta,
    estimatedHorizon: dryPlan.estimatedHorizon,
    riskLevel:        dryPlan.riskLevel,
    reversibility:    dryPlan.reversibility,
    blastRadius:      dryPlan.blastRadius as never,
    steps:            dryPlan.steps.map((s) => ({
      order:          s.order,
      action:         s.action,
      agentId:        s.agentId,
      expectedOutput: s.expectedOutput,
    })),
  });
  console.log(`\n    Zod validation: ${validation.success ? "PASS" : "FAIL"}`);
  if (!validation.success) console.error("   ", validation.error.message);
  console.log(`    steps >= 1:     ${dryPlan.steps.length >= 1 ? "PASS" : "FAIL"}`);

  // ── 3. Real write ──
  console.log("\n[3] planFromInsight(dryRun=false)...");
  const { plan, memoryIdsUsed: ids2 } = await planFromInsight(insightId);

  console.log(`    plan.id:        ${plan.id}`);
  console.log(`    steps written:  ${plan.steps.length}`);
  console.log(`    memoryIds:      ${ids2.join(", ") || "(none)"}`);

  const dbPlan    = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id }, include: { steps: { orderBy: { order: "asc" } } } });
  const dbInsight = await prisma.insight.findUniqueOrThrow({ where: { id: insightId } });

  console.log(`\n    DB verify:`);
  console.log(`    Plan exists:            ${dbPlan ? "PASS" : "FAIL"}`);
  console.log(`    PlanStep rows:          ${dbPlan.steps.length}`);
  const stepsOrdered = dbPlan.steps.every((s, i, a) => i === 0 || s.order > a[i - 1].order);
  console.log(`    Steps ordered by order: ${stepsOrdered ? "PASS" : "FAIL"}`);
  console.log(`    Insight.status=planned: ${dbInsight.status === "planned" ? "PASS" : "FAIL"}`);

  // ── 4. Idempotency ──
  console.log("\n[4] Re-calling planFromInsight (expect throw)...");
  try {
    await planFromInsight(insightId);
    console.log("    FAIL — should have thrown");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`    PASS — threw: ${msg.slice(0, 80)}`);
  }

  // ── 5. Summary ──
  console.log(`\n[5] Summary:`);
  console.log(`    Plan id:         ${plan.id}`);
  console.log(`    PlanStep count:  ${dbPlan.steps.length}`);
  console.log(`    Memory ids used: [${ids2.join(", ")}]`);

  // ── 6. Seed test agents ──
  console.log("\n[6] Seeding test agents (research-agent, comms-agent)...");
  const agentSlugs = ["research-agent", "comms-agent"];
  for (const slug of agentSlugs) {
    const existing = await prisma.agent.findFirst({ where: { name: slug } });
    if (!existing) {
      await prisma.agent.create({
        data: { name: slug, type: slug.replace("-agent", ""), status: "idle" },
      });
      console.log(`    Created agent: ${slug}`);
    } else {
      console.log(`    Agent already exists: ${slug}`);
    }
  }
  const dbAgents = await prisma.agent.findMany({ select: { name: true } });
  const dbSlugs  = new Set(dbAgents.map((a) => a.name));
  console.log(`    DB agent slugs: [${Array.from(dbSlugs).join(", ")}]`);

  // ── 7. Find a fresh insight for agent-injection test ──
  console.log("\n[7] Finding a second status=new insight for agent-injection test...");
  const fresh2 = await prisma.insight.findFirst({ where: { status: "new" }, orderBy: { createdAt: "desc" } });
  let insightId2: string;
  if (fresh2) {
    insightId2 = fresh2.id;
  } else {
    const project = await prisma.project.findFirst();
    if (!project) throw new Error("No projects in DB.");
    const seeded2 = await prisma.insight.create({
      data: {
        projectId:       project.id,
        type:            "opportunity",
        severity:        "high",
        title:           "Test 2: Retention spike detected",
        summary:         "30-day retention rate increased from 42% to 61% after the new onboarding flow. This suggests the revamped flow meaningfully reduces early churn.",
        evidence:        { metric: "retention_30d", before: 0.42, after: 0.61 },
        suggestedAction: "Identify which onboarding steps drive the improvement and scale them.",
        status:          "new",
        observedAt:      new Date(),
      },
    });
    insightId2 = seeded2.id;
    console.log(`    Seeded insight ${insightId2}`);
  }
  console.log(`    → insightId2=${insightId2}`);

  // ── 8. planFromInsight — agent injection test ──
  console.log("\n[8] planFromInsight (agent injection test)...");
  const { plan: plan2 } = await planFromInsight(insightId2);
  console.log(`    plan2.id:     ${plan2.id}`);
  console.log(`    plan2.status: ${plan2.status}`);

  // ── 9. Validate agentId — no hallucination ──
  console.log("\n[9] Validating agentId (no hallucination)...");
  const steps2 = await prisma.planStep.findMany({ where: { planId: plan2.id } });
  let hallucinated = false;
  for (const s of steps2) {
    if (s.agentId !== null && !dbSlugs.has(s.agentId)) {
      console.log(`    FAIL — step order=${s.order} has unknown agentId="${s.agentId}"`);
      hallucinated = true;
    }
  }
  if (!hallucinated) {
    console.log("    PASS — all non-null agentIds are in the DB slug set");
  }
  const agentSummary = steps2.map((s) => `order=${s.order} agentId=${s.agentId ?? "null"}`);
  console.log(`    Steps: ${agentSummary.join(" | ")}`);

  // ── 10. Approval logic + approve API ──
  console.log("\n[10] Approval logic verification...");
  const planRecord2 = await prisma.plan.findUniqueOrThrow({
    where:   { id: plan2.id },
    include: { planApproval: true },
  });
  const shouldNeedApproval = needsApproval({
    riskLevel:     planRecord2.riskLevel,
    reversibility: planRecord2.reversibility,
    blastRadius:   planRecord2.blastRadius,
  });
  console.log(`    needsApproval computed: ${shouldNeedApproval}`);
  console.log(`    Plan.status:            ${planRecord2.status}`);
  console.log(`    PlanApproval exists:    ${planRecord2.planApproval ? "yes" : "no"}`);

  if (shouldNeedApproval) {
    const approvalOk = planRecord2.status === "pending" && planRecord2.planApproval?.decision === "pending";
    console.log(`    Pending state:          ${approvalOk ? "PASS" : "FAIL"}`);

    // Call approve API via direct handler invocation
    console.log("\n    Calling approve API...");
    const approveReq = new NextRequest(
      `http://localhost/api/autopilot/plans/${plan2.id}/approve`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ decidedBy: "test-user" }),
      }
    );
    const approveRes  = await approvePost(approveReq, { params: { id: plan2.id } });
    const approveBody = await approveRes.json() as { status?: string };
    console.log(`    HTTP status:            ${approveRes.status === 200 ? "PASS (200)" : `FAIL (${approveRes.status})`}`);
    console.log(`    Plan.status in body:    ${approveBody.status}`);

    const dbAfter = await prisma.plan.findUniqueOrThrow({
      where:   { id: plan2.id },
      include: { planApproval: true },
    });
    console.log(`    DB Plan.status:         ${dbAfter.status === "approved" ? "PASS" : "FAIL"} (${dbAfter.status})`);
    console.log(`    DB PlanApproval:        ${dbAfter.planApproval?.decision === "approved" ? "PASS" : "FAIL"} (${dbAfter.planApproval?.decision})`);

    // 409 re-approve test
    console.log("\n    Re-approving (expect 409)...");
    const reApproveReq = new NextRequest(
      `http://localhost/api/autopilot/plans/${plan2.id}/approve`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ decidedBy: "test-user" }),
      }
    );
    const reApproveRes = await approvePost(reApproveReq, { params: { id: plan2.id } });
    console.log(`    409 test:               ${reApproveRes.status === 409 ? "PASS" : `FAIL (${reApproveRes.status})`}`);

  } else {
    const autoOk = planRecord2.status === "approved" && !planRecord2.planApproval;
    console.log(`    Auto-approved state:    ${autoOk ? "PASS" : "FAIL"}`);
  }

  await prisma.$disconnect();
  console.log("\n=== ALL DONE ===");
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
