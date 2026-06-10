import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";


export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const status    = searchParams.get("status")    ?? undefined;
  const projectId = searchParams.get("projectId") ?? undefined;

  const where = {
    ...(status    ? { status:    status    as never } : {}),
    ...(projectId ? { projectId }                    : {}),
  };

  const [plans, total] = await Promise.all([
    prisma.plan.findMany({
      where,
      include: {
        project:      { select: { id: true, name: true, emoji: true, color: true } },
        insight:      { select: { id: true, title: true, type: true, severity: true } },
        planApproval: true,
        steps:        { orderBy: { order: "asc" } },
        missions:     { select: { id: true, status: true } },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 50,
    }),
    prisma.plan.count({ where }),
  ]);

  return NextResponse.json({ plans, total });
}
