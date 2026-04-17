import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const workflow = await prisma.workflow.findUnique({
      where: { id: params.id },
      include: { runs: { orderBy: { createdAt: "desc" }, take: 5 } },
    });
    if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(workflow);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const workflow = await prisma.workflow.update({
      where: { id: params.id },
      data: {
        ...(body.name        && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.triggerType && { triggerType: body.triggerType }),
        ...(body.triggerConfig !== undefined && { triggerConfig: JSON.stringify(body.triggerConfig) }),
        ...(body.steps !== undefined && { steps: JSON.stringify(body.steps) }),
        ...(body.status      && { status: body.status }),
      },
    });
    return NextResponse.json(workflow);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Delete related logs and runs first, then the workflow
    const runs = await prisma.workflowRun.findMany({
      where: { workflowId: params.id },
      select: { id: true },
    });
    const runIds = runs.map(r => r.id);
    if (runIds.length > 0) {
      await prisma.workflowLog.deleteMany({ where: { runId: { in: runIds } } });
      await prisma.workflowRun.deleteMany({ where: { workflowId: params.id } });
    }
    await prisma.workflow.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
