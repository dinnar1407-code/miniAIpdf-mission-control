import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const runs = await prisma.workflowRun.findMany({
      where: { workflowId: params.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json(runs);
  } catch {
    return NextResponse.json({ error: "Failed to fetch runs" }, { status: 500 });
  }
}
