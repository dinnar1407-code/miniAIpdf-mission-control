import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectSlug = searchParams.get("project");

    const where = projectSlug && projectSlug !== "all"
      ? { project: { slug: projectSlug } }
      : {};

    const tasks = await prisma.task.findMany({
      where,
      include: { project: true, agent: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(tasks);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const task = await prisma.task.create({
      data: {
        title: body.title,
        description: body.description,
        status: body.status || "todo",
        priority: body.priority || "medium",
        projectId: body.projectId,
        agentId: body.agentId,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      },
      include: { project: true, agent: true },
    });
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
