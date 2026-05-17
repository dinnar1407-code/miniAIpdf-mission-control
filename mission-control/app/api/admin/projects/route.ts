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

const ProjectCreate = z.object({
  slug:        z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, digits, or hyphens"),
  name:        z.string().min(1).max(100),
  description: z.string().nullable().optional(),
  color:       z.string().optional(),
  emoji:       z.string().optional(),
  status:      z.string().default("active"),
  goals:       z.array(GoalInput).min(1, "At least one goal is required"),
});

export async function GET() {
  try {
    const projects = await prisma.project.findMany({ orderBy: { name: "asc" } });
    return ok(projects);
  } catch {
    return fail("Failed to fetch projects", 500);
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return fail("Invalid JSON", 400); }

  const parsed = ProjectCreate.safeParse(body);
  if (!parsed.success) return fail(parsed.error.errors[0].message, 400);

  const { goals, ...projectData } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({ data: projectData });
      const createdGoals = await Promise.all(
        goals.map((g) =>
          tx.goal.create({
            data: {
              projectId: project.id,
              kpi:       g.kpi,
              unit:      g.unit,
              baseline:  g.baseline,
              target:    g.target,
              deadline:  new Date(g.deadline),
              cadence:   g.cadence,
            },
          })
        )
      );
      return { ...project, goals: createdGoals };
    });
    return ok(result, 201);
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002")
      return fail(`Project slug "${parsed.data.slug}" already exists`, 409, "DUPLICATE_SLUG");
    return fail("Failed to create project", 500);
  }
}
