ALTER TABLE "Approval" RENAME TO "PlanApproval";
ALTER TABLE "PlanApproval" RENAME CONSTRAINT "Approval_pkey" TO "PlanApproval_pkey";
ALTER TABLE "PlanApproval" RENAME CONSTRAINT "Approval_planId_fkey" TO "PlanApproval_planId_fkey";
ALTER INDEX "Approval_planId_key" RENAME TO "PlanApproval_planId_key";
ALTER INDEX "Approval_decision_createdAt_idx" RENAME TO "PlanApproval_decision_createdAt_idx";
