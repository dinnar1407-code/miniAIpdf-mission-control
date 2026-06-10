import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";


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
