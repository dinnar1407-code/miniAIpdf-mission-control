import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";


export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const plan = await prisma.plan.findUnique({
    where:   { id: params.id },
    include: {
      project:      { select: { id: true, name: true, emoji: true, color: true } },
      insight:      { select: { id: true, title: true, type: true, severity: true, summary: true } },
      planApproval: true,
      steps:        { orderBy: { order: "asc" } },
      missions:     { select: { id: true, status: true, startedAt: true, completedAt: true, errorMessage: true } },
    },
  });

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  return NextResponse.json({ plan });
}
