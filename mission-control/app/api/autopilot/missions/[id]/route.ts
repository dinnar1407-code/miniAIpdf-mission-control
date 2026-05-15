import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const mission = await prisma.mission.findUnique({
    where:   { id: params.id },
    include: {
      plan:    { include: { steps: { orderBy: { order: "asc" } } } },
      project: true,
    },
  });

  if (!mission) {
    return NextResponse.json({ error: "Mission not found" }, { status: 404 });
  }

  const [workflow, workflowRun] = await Promise.all([
    prisma.workflow.findUnique({ where: { id: mission.workflowId } }),
    mission.workflowRunId
      ? prisma.workflowRun.findUnique({ where: { id: mission.workflowRunId } })
      : null,
  ]);

  return NextResponse.json({ mission, workflow, workflowRun });
}
