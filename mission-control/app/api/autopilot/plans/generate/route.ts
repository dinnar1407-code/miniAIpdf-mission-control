import { NextRequest, NextResponse } from "next/server";
import { Prisma }                    from "@prisma/client";
import { planFromInsight }           from "@/lib/planner";

export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return req.headers.get("authorization") === `Bearer ${cronSecret}`;
}

function handleError(err: unknown): NextResponse {
  const msg = err instanceof Error ? err.message : String(err);
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
    return NextResponse.json({ error: "Insight not found" }, { status: 404 });
  }
  if (msg.includes("already has a Plan associated")) {
    return NextResponse.json({ error: msg }, { status: 409 });
  }
  console.error("[planner/generate]", err);
  return NextResponse.json({ error: msg }, { status: 500 });
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = req.nextUrl;
  const insightId = searchParams.get("insightId");
  const dryRun    = searchParams.get("dryRun") === "true";
  if (!insightId) {
    return NextResponse.json({ error: "insightId is required" }, { status: 400 });
  }
  try {
    const result = await planFromInsight(insightId, { dryRun });
    return NextResponse.json(result);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  // POST is user-facing (UI button) — no auth required
  let insightId: string;
  let dryRun = false;
  try {
    const body = await req.json() as { insightId?: string; dryRun?: boolean };
    insightId  = body.insightId ?? "";
    dryRun     = body.dryRun ?? false;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!insightId) {
    return NextResponse.json({ error: "insightId is required" }, { status: 400 });
  }
  try {
    const result = await planFromInsight(insightId, { dryRun });
    return NextResponse.json(result);
  } catch (err) {
    return handleError(err);
  }
}
