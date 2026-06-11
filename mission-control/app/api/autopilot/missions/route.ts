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

  const [missions, total] = await Promise.all([
    prisma.mission.findMany({
      where,
      include: {
        plan:    { select: { id: true, objective: true, status: true } },
        project: { select: { id: true, name: true, emoji: true, color: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.mission.count({ where }),
  ]);

  return NextResponse.json({ missions, total });
}
