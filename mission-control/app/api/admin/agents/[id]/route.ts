import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";


const ok = (data: unknown, status = 200) =>
  NextResponse.json({ ok: true, data }, { status });

const fail = (error: string, status: number, code?: string) =>
  NextResponse.json({ ok: false, error, ...(code ? { code } : {}) }, { status });

const AgentPatch = z.object({
  name:        z.string().min(1).max(100).optional(),
  type:        z.string().min(1).max(50).optional(),
  status:      z.enum(["active", "idle", "inactive"]).optional(),
  config:      z.record(z.unknown()).optional(),
  currentTask: z.string().nullable().optional(),
});

function parseConfig(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
}

function normalize(a: { config: string; [k: string]: unknown }) {
  return { ...a, config: parseConfig(a.config) };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const agent = await prisma.agent.findUniqueOrThrow({ where: { id } });
    return ok(normalize(agent as unknown as { config: string; [k: string]: unknown }));
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2025") return fail("Agent not found", 404);
    return fail("Failed to fetch agent", 500);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return fail("Invalid JSON", 400); }

  const parsed = AgentPatch.safeParse(body);
  if (!parsed.success) return fail(parsed.error.errors[0].message, 400);

  const { config, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (config !== undefined) data.config = JSON.stringify(config);

  try {
    const agent = await prisma.agent.update({ where: { id }, data });
    return ok(normalize(agent as unknown as { config: string; [k: string]: unknown }));
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2025") return fail("Agent not found", 404);
    return fail("Failed to update agent", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let target: { status: string } | null;
  try {
    target = await prisma.agent.findUniqueOrThrow({ where: { id } });
  } catch {
    return fail("Agent not found", 404);
  }

  if (target.status === "active") {
    const activeCount = await prisma.agent.count({ where: { status: "active" } });
    if (activeCount === 1) {
      return fail(
        "Cannot deactivate the last active agent — Planner needs at least 1",
        409,
        "LAST_ACTIVE_AGENT"
      );
    }
  }

  try {
    const agent = await prisma.agent.update({ where: { id }, data: { status: "inactive" } });
    return ok(normalize(agent as unknown as { config: string; [k: string]: unknown }));
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2025") return fail("Agent not found", 404);
    return fail("Failed to deactivate agent", 500);
  }
}
