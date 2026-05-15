import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const status    = searchParams.get("status")    ?? undefined;
  const severity  = searchParams.get("severity")  ?? undefined;
  const projectId = searchParams.get("projectId") ?? undefined;
  const type      = searchParams.get("type")      ?? undefined;

  const where = {
    ...(status    ? { status:    status    as never } : {}),
    ...(severity  ? { severity:  severity  as never } : {}),
    ...(projectId ? { projectId }                    : {}),
    ...(type      ? { type:      type      as never } : {}),
  };

  const [insights, total] = await Promise.all([
    prisma.insight.findMany({
      where,
      include: { project: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.insight.count({ where }),
  ]);

  return NextResponse.json({ insights, total });
}
