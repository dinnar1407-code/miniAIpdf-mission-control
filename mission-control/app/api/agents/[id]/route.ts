import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 先把可为空的外键置 null，再删除必填外键的关联记录，最后删 Agent
    await prisma.$transaction([
      prisma.task.updateMany({ where: { agentId: params.id }, data: { agentId: null } }),
      prisma.contentItem.updateMany({ where: { agentId: params.id }, data: { agentId: null } }),
      prisma.activityLog.updateMany({ where: { agentId: params.id }, data: { agentId: null } }),
      prisma.agentAssignment.deleteMany({ where: { agentId: params.id } }),
      prisma.agentMemory.deleteMany({ where: { agentId: params.id } }),
      prisma.agent.delete({ where: { id: params.id } }),
    ]);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete agent" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();

    // Handle agent commands
    if (body.command === "pause") {
      const agent = await prisma.agent.update({
        where: { id: params.id },
        data: { status: "idle" },
      });
      return NextResponse.json(agent);
    }

    if (body.command === "resume") {
      const agent = await prisma.agent.update({
        where: { id: params.id },
        data: { status: "active", lastActiveAt: new Date() },
      });
      return NextResponse.json(agent);
    }

    const agent = await prisma.agent.update({
      where: { id: params.id },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.currentTask !== undefined && { currentTask: body.currentTask }),
      },
    });
    return NextResponse.json(agent);
  } catch {
    return NextResponse.json({ error: "Failed to update agent" }, { status: 500 });
  }
}
