import { readFileSync } from "fs";
import { join }         from "path";
import { PrismaClient, Reversibility, type Plan, type PlanStep } from "@prisma/client";
import { embedText }                      from "@/lib/embeddings";
import { retrieveSimilar, markRetrieved } from "@/lib/memory";
import { llmCall }                        from "@/lib/llm";
import { buildUserPrompt }                from "@/prompts/planner-user";
import { PlanOutputSchema }               from "@/lib/planner-schema";
import { needsApproval }                  from "@/lib/approval-policy";
import { inngest }                        from "@/inngest/client";

const prisma = new PrismaClient();

// Loaded once at cold-start — iterate prompts/planner-system.md independently
const SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), "prompts/planner-system.md"),
  "utf-8"
);

function stripFences(raw: string): string {
  return raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

export async function planFromInsight(
  insightId: string,
  opts?: { dryRun?: boolean }
): Promise<{ plan: Plan & { steps: PlanStep[] }; memoryIdsUsed: string[] }> {
  const dryRun = opts?.dryRun ?? false;

  // 1. Load Insight with project + goal
  const insight = await prisma.insight.findUniqueOrThrow({
    where:   { id: insightId },
    include: { project: true, goal: true },
  });

  // 2. Idempotency check
  if (insight.status === "planned") {
    throw new Error(`Insight ${insightId} already has a Plan associated`);
  }

  // 3. All goals for the project
  const goalContext = insight.projectId
    ? await prisma.goal.findMany({ where: { projectId: insight.projectId } })
    : [];

  // 4. Embed insight summary
  const { embedding: queryEmbedding } = await embedText(insight.summary, "RETRIEVAL_QUERY");

  // 5. Retrieve similar memories
  const memoryHits = await retrieveSimilar({
    queryEmbedding,
    projectId:     insight.projectId ?? undefined,
    kinds:         ["feedback_lesson", "playbook", "postmortem", "insight_summary"],
    limit:         8,
    minSimilarity: 0.55,
  });

  // 6. Partition by effectiveness
  const meta = (h: (typeof memoryHits)[0]): Record<string, unknown> =>
    (h.metadata as Record<string, unknown> | null) ?? {};

  const retrievedContext = {
    successes: memoryHits.filter(
      (h) => h.kind === "feedback_lesson" && Number(meta(h).effectiveness ?? -1) >= 0.6
    ),
    failures: memoryHits.filter(
      (h) => h.kind === "feedback_lesson" && Number(meta(h).effectiveness ?? 1) < 0.3
    ),
    playbooks: memoryHits.filter((h) => h.kind === "playbook"),
    others:    memoryHits.filter(
      (h) => h.kind !== "feedback_lesson" && h.kind !== "playbook"
    ),
  };

  // 7. Query available agents (active only; empty list is fine)
  const agentRows = await prisma.agent.findMany({
    where:  { status: { not: "disabled" } },
    select: { id: true, name: true, type: true },
  });
  const availableAgents = agentRows.map((a) => ({
    id:   a.id,
    slug: a.name,
    role: a.type,
  }));
  const validSlugs = new Set(availableAgents.map((a) => a.slug));

  // 8. Build user prompt
  const userPrompt = buildUserPrompt({ insight, retrievedContext, goalContext, availableAgents });

  // 9. LLM call
  const llmResult = await llmCall({
    task:         "plan",
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    maxTokens:    1500,
    temperature:  0.2,
    projectId:    insight.projectId ?? undefined,
  });

  // 10. Parse + validate schema
  let parsed: ReturnType<typeof PlanOutputSchema.safeParse>;
  try {
    parsed = PlanOutputSchema.safeParse(JSON.parse(stripFences(llmResult.content)));
  } catch {
    throw new Error(
      `Planner LLM output is not valid JSON.\nRaw: ${llmResult.content.slice(0, 500)}`
    );
  }
  if (!parsed.success) {
    throw new Error(
      `Planner LLM output failed schema validation:\n${parsed.error.message}\n\nRaw: ${llmResult.content.slice(0, 500)}`
    );
  }
  const planOutput = parsed.data;

  // 11. Runtime agentId validation — reject hallucinated slugs
  for (const step of planOutput.steps) {
    if (step.agentId !== null && !validSlugs.has(step.agentId)) {
      throw new Error(
        `Planner LLM invented agentId "${step.agentId}" (step order=${step.order}). ` +
        `Valid slugs: [${Array.from(validSlugs).join(", ") || "none"}]`
      );
    }
  }

  // 12. dryRun — return without persisting
  if (dryRun) {
    const dryPlan = {
      id:               "(dry-run)",
      projectId:        insight.projectId ?? "",
      insightId,
      objective:        planOutput.objective,
      rationale:        planOutput.rationale,
      priority:         planOutput.priority,
      estimatedKpi:     planOutput.estimatedKpi,
      estimatedDelta:   planOutput.estimatedDelta,
      estimatedHorizon: planOutput.estimatedHorizon,
      riskLevel:        planOutput.riskLevel,
      reversibility:    planOutput.reversibility as Reversibility,
      blastRadius:      planOutput.blastRadius,
      status:           "draft" as const,
      generatedBy:      "planner_v1",
      createdAt:        new Date(),
      updatedAt:        new Date(),
      steps:            planOutput.steps.map((s, i) => ({
        id:             `(dry-${i})`,
        planId:         "(dry-run)",
        order:          s.order,
        action:         s.action,
        agentId:        s.agentId,
        workflowId:     null,
        expectedOutput: s.expectedOutput,
        inputs:         null,
      })),
    } as unknown as Plan & { steps: PlanStep[] };

    return { plan: dryPlan, memoryIdsUsed: memoryHits.map((h) => h.id) };
  }

  // 13. Determine approval requirement
  const requireApproval = needsApproval({
    riskLevel:     planOutput.riskLevel,
    reversibility: planOutput.reversibility as Reversibility,
    blastRadius:   planOutput.blastRadius,
  });

  // 14. Atomic write
  const { plan, steps } = await prisma.$transaction(async (tx) => {
    const plan = await tx.plan.create({
      data: {
        projectId:        insight.projectId!,
        insightId,
        objective:        planOutput.objective,
        rationale:        planOutput.rationale,
        priority:         planOutput.priority,
        estimatedKpi:     planOutput.estimatedKpi,
        estimatedDelta:   planOutput.estimatedDelta,
        estimatedHorizon: planOutput.estimatedHorizon,
        riskLevel:        planOutput.riskLevel,
        reversibility:    planOutput.reversibility as Reversibility,
        blastRadius:      planOutput.blastRadius,
        status:           "draft",
        generatedBy:      "planner_v1",
      },
    });

    await tx.planStep.createMany({
      data: planOutput.steps.map((s) => ({
        planId:         plan.id,
        order:          s.order,
        action:         s.action,
        agentId:        s.agentId,
        expectedOutput: s.expectedOutput,
      })),
    });

    const steps = await tx.planStep.findMany({
      where:   { planId: plan.id },
      orderBy: { order: "asc" },
    });

    if (requireApproval) {
      await tx.planApproval.create({
        data: {
          planId:            plan.id,
          riskLevel:         plan.riskLevel,
          reversibility:     plan.reversibility,
          blastRadius:       plan.blastRadius,
          estimatedCost:     null,
          requiredApprovers: 1,
          decision:          "pending",
        },
      });
      await tx.plan.update({ where: { id: plan.id }, data: { status: "pending" } });
    } else {
      await tx.plan.update({ where: { id: plan.id }, data: { status: "approved" } });
    }

    await tx.insight.update({
      where: { id: insightId },
      data:  { status: "planned" },
    });

    return { plan, steps };
  });

  // 15. Fire Inngest event on auto-approve
  if (!requireApproval) {
    void inngest.send({ name: "autopilot/plans.approved", data: { planId: plan.id } });
  }

  // 16. markRetrieved outside transaction — failure must not roll back the Plan
  void markRetrieved(memoryHits.map((h) => h.id));

  // 17. Return with refreshed status
  const finalPlan = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
  return { plan: { ...finalPlan, steps }, memoryIdsUsed: memoryHits.map((h) => h.id) };
}
