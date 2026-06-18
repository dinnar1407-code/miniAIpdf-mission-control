-- CreateEnum
CREATE TYPE "DelegatedTaskStatus" AS ENUM ('pending', 'claimed', 'running', 'succeeded', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "DelegatedTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "targetDir" TEXT,
    "status" "DelegatedTaskStatus" NOT NULL DEFAULT 'pending',
    "blackballRunId" TEXT,
    "resultSummary" TEXT,
    "errorMessage" TEXT,
    "planStepId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DelegatedTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DelegatedTask_status_createdAt_idx" ON "DelegatedTask"("status", "createdAt");
