import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectSlug = searchParams.get("project");

    const workflows = await prisma.workflow.findMany({
      where: projectSlug ? { project: { slug: projectSlug } } : {},
      include: {
        project: true,
        runs: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(workflows);
  } catch {
    return NextResponse.json({ error: "Failed to fetch workflows" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workflow = await prisma.workflow.create({
      data: {
        name:          body.name || "New Workflow",
        description:   body.description,
        triggerType:   body.triggerType || "manual",
        triggerConfig: JSON.stringify(body.triggerConfig || {}),
        steps:         JSON.stringify(body.steps || []),
        status:        body.status || "draft",
        projectId:     body.projectId,
      },
    });
    return NextResponse.json(workflow, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create workflow" }, { status: 500 });
  }
}
