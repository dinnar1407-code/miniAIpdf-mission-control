import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const agents = await prisma.agent.findMany({
      include: { agentAssignments: { include: { project: true } } },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(agents);
  } catch {
    return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
  }
}
