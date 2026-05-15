import type { Reversibility } from "@prisma/client";

export interface PlanRiskAttrs {
  riskLevel:      number;
  reversibility:  Reversibility;
  blastRadius?:   string | null;
  estimatedCost?: number | null;
}

export function needsApproval(p: PlanRiskAttrs): boolean {
  // Low-risk + fully reversible = auto-approve
  if (p.riskLevel <= 1 && p.reversibility === "reversible") return false;

  // Any irreversible action requires approval
  if (p.reversibility === "irreversible") return true;

  // riskLevel >= 2 requires approval
  if (p.riskLevel >= 2) return true;

  // User-facing blast radius requires approval
  if (p.blastRadius === "all_users" || p.blastRadius === "public") return true;

  return true;
}
