import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ok = (data: unknown, status = 200) =>
  NextResponse.json({ ok: true, data }, { status });

const fail = (error: string, status: number, code?: string) =>
  NextResponse.json({ ok: false, error, ...(code ? { code } : {}) }, { status });

const GoalPatch = z.object({
  kpi:      z.string().min(1).optional(),
  unit:     z.enum(["usd", "count", "percent"]).optional(),
  baseline: z.number().min(0).optional(),
  target:   z.number().min(0).optional(),
  deadline: z.string().datetime({ offset: true }).optional(),
  cadence:  z.enum(["daily", "weekly", "monthly", "quarterly"]).optional(),
  current:  z.number().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return fail("Invalid JSON", 400); }

  const parsed = GoalPatch.safeParse(body);
  if (!parsed.success) return fail(parsed.error.errors[0].message, 400);

  let existing: { baseline: number; target: number } | null;
  try {
    existing = await prisma.goal.findUniqueOrThrow({ where: { id } });
  } catch {
    return fail("Goal not found", 404);
  }

  const { deadline, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (deadline !== undefined) data.deadline = new Date(deadline);

  try {
    const goal = await prisma.goal.update({ where: { id }, data });

    const baselineChanged = rest.baseline !== undefined && rest.baseline !== existing.baseline;
    const targetChanged   = rest.target   !== undefined && rest.target   !== existing.target;
    const warning = (baselineChanged || targetChanged)
      ? "Modifying baseline/target affects historical Plan effectiveness calculations. Past Feedbacks were computed against the previous values."
      : undefined;

    return NextResponse.json({ ok: true, data: goal, ...(warning ? { warning } : {}) });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2025") return fail("Goal not found", 404);
    return fail("Failed to update goal", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const goal = await prisma.goal.delete({ where: { id } });
    return ok(goal);
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2025") return fail("Goal not found", 404);
    return fail("Failed to delete goal", 500);
  }
}
