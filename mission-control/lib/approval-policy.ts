import type { Reversibility } from "@prisma/client";

export interface PlanRiskAttrs {
  riskLevel:      number;
  reversibility:  Reversibility;
  blastRadius?:   string | null;
  estimatedCost?: number | null;
}

// autoApproveThreshold: plans with riskLevel <= threshold AND reversible are auto-approved.
// Default threshold is 1 (platform default, conservative).
export function needsApproval(p: PlanRiskAttrs, autoApproveThreshold = 1): boolean {
  // User-facing blast radius always requires approval regardless of threshold
  if (p.blastRadius === "all_users" || p.blastRadius === "public") return true;

  // Irreversible actions always require approval
  if (p.reversibility === "irreversible") return true;

  // Within trust boundary: auto-approve
  if (p.riskLevel <= autoApproveThreshold && p.reversibility === "reversible") return false;

  return true;
}
