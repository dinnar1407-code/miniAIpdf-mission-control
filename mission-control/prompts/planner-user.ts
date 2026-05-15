import type { Insight, Goal, Project } from "@prisma/client";
import type { MemoryHit } from "@/lib/memory";

type InsightWithRelations = Insight & {
  project: Project | null;
  goal:    Goal    | null;
};

type RetrievedContext = {
  successes: MemoryHit[];
  failures:  MemoryHit[];
  playbooks: MemoryHit[];
  others:    MemoryHit[];
};

function formatHits(hits: MemoryHit[], prefix: string): string {
  if (hits.length === 0) return "None available.";
  return hits
    .map(
      (m, i) =>
        `[${prefix}${i + 1}] similarity ${(m.similarity * 100).toFixed(0)}%, helpfulCount ${m.helpfulCount}\n${m.content}`
    )
    .join("\n\n");
}

export interface AvailableAgent {
  id:    string;
  slug:  string;
  role?: string;
}

export function buildUserPrompt(opts: {
  insight:          InsightWithRelations;
  retrievedContext: RetrievedContext;
  goalContext:      Goal[];
  availableAgents:  AvailableAgent[];
}): string {
  const { insight, retrievedContext, goalContext, availableAgents } = opts;

  const projectLine = insight.project
    ? `${insight.project.name} (${insight.project.slug})`
    : insight.projectId ?? "unknown";

  const goalsTable =
    goalContext.length === 0
      ? "No goals configured for this project."
      : goalContext
          .map((g) => {
            const deadline = g.deadline.toISOString().split("T")[0];
            const current  = g.current != null ? String(g.current) : "n/a";
            return `${g.kpi} | baseline=${g.baseline} ${g.unit} | current=${current} ${g.unit} | target=${g.target} ${g.unit} | deadline=${deadline} | status=${g.status}`;
          })
          .join("\n");

  return `# Current Insight
Project: ${projectLine}
Type: ${insight.type} | Severity: ${insight.severity}
Title: ${insight.title}
Summary:
${insight.summary}
Evidence:
${JSON.stringify(insight.evidence, null, 2)}

# Project Goals (for grounding estimatedDelta)
${goalsTable}

# Historical Context

## ✅ Past actions that WORKED
${formatHits(retrievedContext.successes, "H")}

## ❌ Past actions that FAILED
${formatHits(retrievedContext.failures, "F")}

## 📘 Applicable Playbooks
${formatHits(retrievedContext.playbooks, "P")}

## Other Related Context
${formatHits(retrievedContext.others, "O")}

# Available Agents
When assigning agentId to a step, you MUST pick from this list of slugs. Use null if no agent fits.

${availableAgents.length === 0
  ? "(No agents available — set every step's agentId to null.)"
  : availableAgents.map(a => `- ${a.slug}${a.role ? ` (${a.role})` : ""}`).join("\n")}

# Output Schema
Generate a JSON object matching this TypeScript type:

interface PlanOutput {
  objective: string;        // 10-200 chars, one-sentence goal
  rationale: string;        // 20-2000 chars, include [H#]/[F#]/[P#] citations
  priority: number;         // 0-100 integer
  estimatedKpi: string | null;
  estimatedDelta: number | null;
  estimatedHorizon: number | null;   // hours, 1-720
  riskLevel: number;        // 0-5 integer
  reversibility: "reversible" | "partially" | "irreversible";
  blastRadius: "internal" | "segment" | "all_users" | "public" | null;
  steps: Array<{
    order: number;          // starts at 1, increments
    action: string;         // 5-500 chars
    agentId: string | null;
    expectedOutput: string | null;
  }>;
}

Respond with ONLY the JSON. No markdown fences, no commentary.`;
}
