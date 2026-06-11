import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { llmCall } from "@/lib/llm";


export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const [insight, agents] = await Promise.all([
    prisma.insight.findUnique({
      where:   { id: params.id },
      include: { project: true },
    }),
    prisma.agent.findMany({ select: { id: true, type: true, status: true } }),
  ]);

  if (!insight) {
    return NextResponse.json({ error: "Insight not found" }, { status: 404 });
  }
  if (!insight.projectId) {
    return NextResponse.json({ error: "Insight has no project" }, { status: 400 });
  }

  // Build agentType → agentId map (prefer active agents)
  const agentByType: Record<string, string> = {};
  for (const a of agents) {
    if (!agentByType[a.type] || a.status === "active") {
      agentByType[a.type] = a.id;
    }
  }
  // Fallback: any available agent
  const fallbackAgentId = agents[0]?.id ?? null;

  const evidenceStr = JSON.stringify(insight.evidence, null, 2);

  const result = await llmCall({
    task: "plan",
    systemPrompt: `You are a strategic planning AI for ${insight.project?.name ?? "a startup"}.
Given an insight about the business, generate a concise, actionable plan in JSON format.
Respond ONLY with valid JSON, no markdown, no explanation.`,
    userPrompt: `Insight:
Title: ${insight.title}
Type: ${insight.type}
Severity: ${insight.severity}
Summary: ${insight.summary}
Suggested Action: ${insight.suggestedAction ?? "none"}
Evidence: ${evidenceStr}

Generate a plan with this exact JSON structure:
{
  "objective": "one sentence action objective",
  "rationale": "2-3 sentences explaining why this plan addresses the insight",
  "priority": <integer 1-10>,
  "riskLevel": <integer 1-5>,
  "reversibility": "reversible" | "partially" | "irreversible",
  "blastRadius": "brief description of scope/impact",
  "estimatedKpi": "metric name that this plan improves",
  "estimatedDelta": <expected % change as decimal, e.g. 0.15 for 15%>,
  "estimatedHorizon": <days to see result, e.g. 30>,
  "steps": [
    { "label": "step title", "description": "what to do", "agentType": "content" | "data" | "operations" | "ceo" }
  ]
}`,
    maxTokens: 1000,
  });

  let parsed: {
    objective: string;
    rationale: string;
    priority: number;
    riskLevel: number;
    reversibility: "reversible" | "partially" | "irreversible";
    blastRadius?: string;
    estimatedKpi?: string;
    estimatedDelta?: number;
    estimatedHorizon?: number;
    steps: { label: string; description: string; agentType: string }[];
  };

  try {
    const text = result.content.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "LLM returned invalid JSON", raw: result.content }, { status: 500 });
  }

  const riskLevel    = Math.min(5,  Math.max(1, parsed.riskLevel ?? 3));
  const reversibility = parsed.reversibility ?? "partially";

  const plan = await prisma.plan.create({
    data: {
      projectId:        insight.projectId,
      insightId:        insight.id,
      objective:        parsed.objective,
      rationale:        parsed.rationale,
      priority:         Math.min(10, Math.max(1, parsed.priority ?? 5)),
      riskLevel,
      reversibility,
      blastRadius:      parsed.blastRadius      ?? null,
      estimatedKpi:     parsed.estimatedKpi     ?? null,
      estimatedDelta:   parsed.estimatedDelta   ?? null,
      estimatedHorizon: parsed.estimatedHorizon ?? null,
      status:           "pending",
      generatedBy:      "ai",
      steps: {
        create: (parsed.steps ?? []).map((s, i) => ({
          order:          i,
          action:         s.label,
          expectedOutput: s.description ?? null,
          agentId:        agentByType[s.agentType] ?? fallbackAgentId,
        })),
      },
      planApproval: {
        create: {
          riskLevel,
          reversibility,
          blastRadius:       parsed.blastRadius ?? null,
          requiredApprovers: 1,
          decision:          "pending",
        },
      },
    },
  });

  await prisma.insight.update({
    where: { id: insight.id },
    data:  { status: "planned" },
  });

  return NextResponse.json({ planId: plan.id });
}
