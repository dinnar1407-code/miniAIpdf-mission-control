import { z } from "zod";

export const PlanStepOutputSchema = z.object({
  order:          z.number().int().min(1),
  action:         z.string().min(5).max(500),
  agentId:        z.string().nullable(),
  expectedOutput: z.string().nullable(),
});

export const PlanOutputSchema = z.object({
  objective:        z.string().min(10).max(200),
  rationale:        z.string().min(20).max(2000),
  priority:         z.number().int().min(0).max(100),
  estimatedKpi:     z.string().nullable(),
  estimatedDelta:   z.number().nullable(),
  estimatedHorizon: z.number().int().min(1).max(720).nullable(),
  riskLevel:        z.number().int().min(0).max(5),
  reversibility:    z.enum(["reversible", "partially", "irreversible"]),
  blastRadius:      z.enum(["internal", "segment", "all_users", "public"]).nullable(),
  steps:            z.array(PlanStepOutputSchema).min(1),
});

export type PlanOutput     = z.infer<typeof PlanOutputSchema>;
export type PlanStepOutput = z.infer<typeof PlanStepOutputSchema>;
