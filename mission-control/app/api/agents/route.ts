import { NextRequest, NextResponse } from "next/server";
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, type, status = "idle", currentTask = null, config = {} } = body;

    if (!name || !type) {
      return NextResponse.json({ error: "name 和 type 为必填项" }, { status: 400 });
    }

    const agent = await prisma.agent.create({
      data: {
        name,
        type,
        status,
        currentTask,
        config: typeof config === "string" ? config : JSON.stringify(config),
      },
    });
    return NextResponse.json(agent, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create agent" }, { status: 500 });
  }
}
