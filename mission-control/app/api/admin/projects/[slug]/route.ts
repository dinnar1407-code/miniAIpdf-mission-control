import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";


const ok = (data: unknown, status = 200) =>
  NextResponse.json({ ok: true, data }, { status });

const fail = (error: string, status: number, code?: string) =>
  NextResponse.json({ ok: false, error, ...(code ? { code } : {}) }, { status });

const ProjectPatch = z.object({
  name:                 z.string().min(1).max(100).optional(),
  description:          z.string().nullable().optional(),
  color:                z.string().optional(),
  emoji:                z.string().optional(),
  status:               z.string().optional(),
  autoApproveThreshold: z.number().int().min(0).max(5).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const project = await prisma.project.findUniqueOrThrow({
      where:   { slug },
      include: { goals: { orderBy: { kpi: "asc" } } },
    });
    return ok(project);
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2025") return fail("Project not found", 404);
    return fail("Failed to fetch project", 500);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return fail("Invalid JSON", 400); }

  const parsed = ProjectPatch.safeParse(body);
  if (!parsed.success) return fail(parsed.error.errors[0].message, 400);

  try {
    const project = await prisma.project.update({
      where:   { slug },
      data:    parsed.data,
      include: { goals: { orderBy: { kpi: "asc" } } },
    });
    return ok(project);
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2025") return fail("Project not found", 404);
    return fail("Failed to update project", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let project: { id: string } | null;
  try {
    project = await prisma.project.findUniqueOrThrow({ where: { slug } });
  } catch {
    return fail("Project not found", 404);
  }

  const pendingInsights = await prisma.insight.count({
    where: { projectId: project.id, status: { in: ["new", "planned"] } },
  });
  if (pendingInsights > 0) {
    return fail(
      `Cannot archive — ${pendingInsights} unprocessed insights still attached`,
      409,
      "HAS_PENDING_INSIGHTS"
    );
  }

  try {
    const updated = await prisma.project.update({
      where:   { slug },
      data:    { status: "archived" },
      include: { goals: { orderBy: { kpi: "asc" } } },
    });
    return ok(updated);
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2025") return fail("Project not found", 404);
    return fail("Failed to archive project", 500);
  }
}
