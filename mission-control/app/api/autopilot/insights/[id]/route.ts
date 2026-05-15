import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const insight = await prisma.insight.findUnique({
    where:   { id: params.id },
    include: {
      project: true,
      plans:   { select: { id: true, objective: true, status: true, createdAt: true } },
    },
  });

  if (!insight) {
    return NextResponse.json({ error: "Insight not found" }, { status: 404 });
  }

  return NextResponse.json({ insight });
}
