-- This migration was generated via `prisma migrate diff --from-empty`
-- and incidentally includes two pre-existing, intentional changes that
-- were pending in the schema at the time:
--   1. AgentMemory: add projectId column + scope unique index by projectId (Fix 10)
--   2. Workflow.taskTemplate: relax column type to TEXT
-- The autopilot-layer-specific changes start below.

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('on_track', 'at_risk', 'achieved', 'missed');

-- CreateEnum
CREATE TYPE "InsightType" AS ENUM ('anomaly', 'opportunity', 'risk', 'trend', 'milestone');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "InsightStatus" AS ENUM ('new', 'acknowledged', 'planned', 'dismissed', 'superseded');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('draft', 'pending', 'approved', 'rejected', 'executing', 'completed', 'failed', 'superseded');

-- CreateEnum
CREATE TYPE "Reversibility" AS ENUM ('reversible', 'partially', 'irreversible');

-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('queued', 'executing', 'succeeded', 'failed', 'cancelled', 'awaiting_feedback');

-- CreateEnum
CREATE TYPE "MemoryKind" AS ENUM ('insight_summary', 'feedback_lesson', 'playbook', 'project_fact', 'postmortem');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('pending', 'approved', 'rejected', 'expired', 'escalated');

-- DropIndex
DROP INDEX "AgentMemory_agentId_type_key_key";

-- AlterTable
ALTER TABLE "AgentMemory" ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "Workflow" ALTER COLUMN "taskTemplate" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kpi" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "baseline" DOUBLE PRECISION NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "current" DOUBLE PRECISION,
    "currentAt" TIMESTAMP(3),
    "deadline" TIMESTAMP(3) NOT NULL,
    "cadence" TEXT NOT NULL,
    "status" "GoalStatus" NOT NULL DEFAULT 'on_track',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insight" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "goalId" TEXT,
    "type" "InsightType" NOT NULL,
    "severity" "Severity" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "suggestedAction" TEXT,
    "status" "InsightStatus" NOT NULL DEFAULT 'new',
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Insight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "insightId" TEXT,
    "objective" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "estimatedKpi" TEXT,
    "estimatedDelta" DOUBLE PRECISION,
    "estimatedHorizon" INTEGER,
    "riskLevel" INTEGER NOT NULL,
    "reversibility" "Reversibility" NOT NULL,
    "blastRadius" TEXT,
    "status" "PlanStatus" NOT NULL DEFAULT 'draft',
    "generatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanStep" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "agentId" TEXT,
    "workflowId" TEXT,
    "expectedOutput" TEXT,
    "inputs" JSONB,

    CONSTRAINT "PlanStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "workflowRunId" TEXT,
    "status" "MissionStatus" NOT NULL DEFAULT 'queued',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "resultSummary" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "expectedKpi" TEXT NOT NULL,
    "expectedDelta" DOUBLE PRECISION NOT NULL,
    "actualDelta" DOUBLE PRECISION,
    "effectiveness" DOUBLE PRECISION,
    "postmortem" TEXT NOT NULL,
    "learnings" TEXT NOT NULL,
    "tags" TEXT[],
    "evaluatedAt" TIMESTAMP(3) NOT NULL,
    "observationWindow" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Memory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "kind" "MemoryKind" NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "embeddingModel" TEXT,
    "sourceTable" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "retrievedCount" INTEGER NOT NULL DEFAULT 0,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "riskLevel" INTEGER NOT NULL,
    "reversibility" "Reversibility" NOT NULL,
    "blastRadius" TEXT,
    "estimatedCost" DOUBLE PRECISION,
    "requiredApprovers" INTEGER NOT NULL DEFAULT 1,
    "decision" "ApprovalDecision" NOT NULL DEFAULT 'pending',
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "notes" TEXT,
    "approverContext" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Playbook" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "triggerPattern" TEXT NOT NULL,
    "template" JSONB NOT NULL,
    "invocations" INTEGER NOT NULL DEFAULT 0,
    "successes" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Playbook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Goal_status_idx" ON "Goal"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Goal_projectId_kpi_key" ON "Goal"("projectId", "kpi");

-- CreateIndex
CREATE INDEX "Insight_status_severity_createdAt_idx" ON "Insight"("status", "severity", "createdAt");

-- CreateIndex
CREATE INDEX "Insight_projectId_createdAt_idx" ON "Insight"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Plan_status_priority_idx" ON "Plan"("status", "priority");

-- CreateIndex
CREATE INDEX "Plan_projectId_createdAt_idx" ON "Plan"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "PlanStep_agentId_idx" ON "PlanStep"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanStep_planId_order_key" ON "PlanStep"("planId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Mission_workflowRunId_key" ON "Mission"("workflowRunId");

-- CreateIndex
CREATE INDEX "Mission_status_idx" ON "Mission"("status");

-- CreateIndex
CREATE INDEX "Mission_projectId_createdAt_idx" ON "Mission"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_missionId_key" ON "Feedback"("missionId");

-- CreateIndex
CREATE INDEX "Feedback_effectiveness_idx" ON "Feedback"("effectiveness");

-- CreateIndex
CREATE INDEX "Memory_kind_projectId_idx" ON "Memory"("kind", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Memory_sourceTable_sourceId_key" ON "Memory"("sourceTable", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Approval_planId_key" ON "Approval"("planId");

-- CreateIndex
CREATE INDEX "Approval_decision_createdAt_idx" ON "Approval"("decision", "createdAt");

-- CreateIndex
CREATE INDEX "Playbook_projectId_isActive_idx" ON "Playbook"("projectId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AgentMemory_agentId_type_key_projectId_key" ON "AgentMemory"("agentId", "type", "key", "projectId");

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "Insight"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanStep" ADD CONSTRAINT "PlanStep_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Playbook" ADD CONSTRAINT "Playbook_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex (HNSW for vector similarity search)
CREATE INDEX memory_embedding_hnsw_idx ON "Memory" USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
