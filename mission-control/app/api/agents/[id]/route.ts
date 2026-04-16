import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
