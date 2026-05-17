import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ok = (data: unknown, status = 200) =>
  NextResponse.json({ ok: true, data }, { status });

const fail = (error: string, status: number, code?: string) =>
  NextResponse.json({ ok: false, error, ...(code ? { code } : {}) }, { status });

const GoalInput = z.object({
  kpi:      z.string().min(1),
  unit:     z.enum(["usd", "count", "percent"]),
  baseline: z.number().min(0),
  target:   z.number().min(0),
  deadline: z.string().datetime({ offset: true }),
  cadence:  z.enum(["daily", "weekly", "monthly", "quarterly"]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return fail("Invalid JSON", 400); }

  const parsed = GoalInput.safeParse(body);
  if (!parsed.success) return fail(parsed.error.errors[0].message, 400);

  let project: { id: string } | null;
  try {
    project = await prisma.project.findUniqueOrThrow({ where: { slug } });
  } catch {
    return fail("Project not found", 404);
  }

  try {
    const goal = await prisma.goal.create({
      data: {
        projectId: project.id,
        kpi:       parsed.data.kpi,
        unit:      parsed.data.unit,
        baseline:  parsed.data.baseline,
        target:    parsed.data.target,
        deadline:  new Date(parsed.data.deadline),
        cadence:   parsed.data.cadence,
      },
    });
    return ok(goal, 201);
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002")
      return fail(`Goal with kpi "${parsed.data.kpi}" already exists for this project`, 409, "DUPLICATE_KPI");
    return fail("Failed to create goal", 500);
  }
}
