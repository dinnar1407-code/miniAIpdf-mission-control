import { PrismaClient, PlanStatus, type Mission } from "@prisma/client";
import { executeWorkflow }             from "@/lib/workflow-engine";
import type { WorkflowStep }           from "@/lib/workflow-types";
import { sendTelegram }                from "@/lib/telegram";

const prisma = new PrismaClient();

export async function createMissionFromPlan(planId: string): Promise<Mission> {
  // 1. Load Plan + steps + project
  const plan = await prisma.plan.findUniqueOrThrow({
    where:   { id: planId },
    include: { steps: { orderBy: { order: "asc" } }, project: true },
  });

  // 2. Idempotency — return existing Mission without re-executing (check before status validation)
  const existing = await prisma.mission.findFirst({ where: { planId } });
  if (existing) return existing;

  // 3. Only approved plans can be executed (checked after idempotency to allow re-entry)
  if (plan.status !== "approved") {
    throw new Error(
      `Plan ${planId} is not approved (current status: ${plan.status})`
    );
  }

  // 4. Translate PlanStep → WorkflowStep; null agentId is a planner bug
  const workflowSteps: WorkflowStep[] = plan.steps.map((s) => {
    if (s.agentId === null) {
      throw new Error(
        `PlanStep ${s.id} (order=${s.order}) has null agentId — cannot create agent workflow step`
      );
    }
    return {
      id:     crypto.randomUUID(),
      type:   "agent" as const,
      label:  s.action.slice(0, 60),
      config: {},
      agent:  s.agentId,
      action: s.action,
    };
  });

  // 5. Atomic write: Workflow + Mission + Plan.status=executing
  const created = { missionId: "", workflowId: "" };

  await prisma.$transaction(async (tx) => {
    const workflow = await tx.workflow.create({
      data: {
        name:        `plan:${plan.id}:${plan.objective.slice(0, 50)}`,
        steps:       JSON.stringify(workflowSteps),
        targetAgent: null,
        projectId:   plan.projectId,
        status:      "active",
      },
    });

    const mission = await tx.mission.create({
      data: {
        planId:        plan.id,
        projectId:     plan.projectId,
        workflowId:    workflow.id,
        workflowRunId: null,
        status:        "queued",
        startedAt:     new Date(),
      },
    });

    await tx.plan.update({
      where: { id: planId },
      data:  { status: "executing" },
    });

    created.missionId  = mission.id;
    created.workflowId = workflow.id;
  });

  const { missionId, workflowId } = created;

  // 6. Execute workflow outside transaction — may be long-running
  let runId: string;
  try {
    const run = await executeWorkflow(workflowId, {
      planId,
      missionId,
      source: "autopilot",
    });
    runId = run.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.mission.update({
      where: { id: missionId },
      data:  { status: "failed", errorMessage: msg.slice(0, 1000) },
    });
    return prisma.mission.findUniqueOrThrow({ where: { id: missionId } });
  }

  // 7. Fetch final WorkflowRun status from DB (run snapshot is stale)
  const finalRun = await prisma.workflowRun.findUniqueOrThrow({ where: { id: runId } });

  // "done" and "completed" are both terminal-success states in the engine
  const missionStatus =
    (finalRun.status === "completed" || finalRun.status === "done") ? "succeeded" :
    finalRun.status === "failed" ? "failed" : "executing";

  const planStatusUpdate: PlanStatus | null =
    missionStatus === "succeeded" ? PlanStatus.completed :
    missionStatus === "failed"    ? PlanStatus.failed    : null;

  const resultSummary = finalRun.result ? finalRun.result.slice(0, 1000) : null;
  const errorMessage  = missionStatus === "failed"
    ? (finalRun.error ?? "Workflow failed").slice(0, 1000)
    : null;

  // 8. Atomically update Mission + Plan status
  const [updatedMission] = await prisma.$transaction([
    prisma.mission.update({
      where: { id: missionId },
      data: {
        workflowRunId: finalRun.id,
        status:        missionStatus,
        ...(missionStatus !== "executing" ? { completedAt: new Date() } : {}),
        ...(resultSummary                 ? { resultSummary }            : {}),
        ...(errorMessage                  ? { errorMessage }             : {}),
      },
    }),
    ...(planStatusUpdate
      ? [prisma.plan.update({ where: { id: planId }, data: { status: planStatusUpdate } })]
      : []
    ),
  ]);

  // 9. Notify Telegram on terminal status (fire-and-forget)
  if (missionStatus === "succeeded" || missionStatus === "failed") {
    const icon     = missionStatus === "succeeded" ? "✅" : "❌";
    const dur      = updatedMission.completedAt && updatedMission.startedAt
      ? `${Math.round((updatedMission.completedAt.getTime() - updatedMission.startedAt.getTime()) / 6000) / 10} min`
      : "—";
    const stepCount = plan.steps.length;
    const succeeded = missionStatus === "succeeded"
      ? JSON.parse(finalRun.stepResults || "[]").filter((s: { status: string }) => s.status === "completed").length
      : 0;

    const lines = [
      `${icon} *Mission ${missionStatus === "succeeded" ? "完成" : "失败"}*`,
      ``,
      `📁 项目: ${plan.project.name}`,
      `🎯 目标: ${plan.objective.slice(0, 100)}${plan.objective.length > 100 ? "…" : ""}`,
      `⏱ 耗时: ${dur}`,
      missionStatus === "succeeded"
        ? `✅ 步骤: ${succeeded}/${stepCount} 完成`
        : `❌ 错误: ${(errorMessage ?? "未知错误").slice(0, 150)}`,
      ``,
      `\`${missionId}\``,
    ];
    void sendTelegram(lines.join("\n"));
  }

  return updatedMission;
}
