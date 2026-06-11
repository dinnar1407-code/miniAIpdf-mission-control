import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const ok = (data: unknown, status = 200) =>
  NextResponse.json({ ok: true, data }, { status });

const fail = (error: string, status: number, code?: string) =>
  NextResponse.json({ ok: false, error, ...(code ? { code } : {}) }, { status });

const AgentCreate = z.object({
  name:        z.string().min(1).max(100),
  type:        z.string().min(1).max(50),
  status:      z.enum(["active", "idle", "inactive"]).default("active"),
  config:      z.record(z.unknown()).default({}),
  currentTask: z.string().nullable().optional(),
});

function parseConfig(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
}

function normalize(a: { config: string; [k: string]: unknown }) {
  return { ...a, config: parseConfig(a.config) };
}

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  try {
    const agents = await prisma.agent.findMany({
      where:   status ? { status } : undefined,
      orderBy: { name: "asc" },
    });
    return ok(agents.map(normalize));
  } catch {
    return fail("Failed to fetch agents", 500);
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return fail("Invalid JSON", 400); }

  const parsed = AgentCreate.safeParse(body);
  if (!parsed.success) return fail(parsed.error.errors[0].message, 400);

  const { name, type, status, config, currentTask } = parsed.data;

  // App-layer name dedup — no DB unique constraint on Agent.name
  const existing = await prisma.agent.findFirst({ where: { name } });
  if (existing) return fail(`Agent "${name}" already exists`, 409, "DUPLICATE_NAME");

  try {
    const agent = await prisma.agent.create({
      data: { name, type, status, config: JSON.stringify(config), currentTask: currentTask ?? null },
    });
    return ok(normalize(agent as unknown as { config: string; [k: string]: unknown }), 201);
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002")
      return fail(`Agent "${name}" already exists`, 409, "DUPLICATE_NAME");
    return fail("Failed to create agent", 500);
  }
}
