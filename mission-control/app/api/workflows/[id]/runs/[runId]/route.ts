import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _: NextRequest,
  { params }: { params: { id: string; runId: string } }
) {
  try {
    const run = await prisma.workflowRun.findUnique({
      where: { id: params.runId },
      include: {
        logs: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(run);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
