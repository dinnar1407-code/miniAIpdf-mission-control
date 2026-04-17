import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status    = searchParams.get("status");
    const projectId = searchParams.get("projectId");
    const limit     = parseInt(searchParams.get("limit") || "50");

    const items = await prisma.contentCalendar.findMany({
      where: {
        ...(status    ? { status }    : {}),
        ...(projectId ? { projectId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json(items);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const item = await prisma.contentCalendar.create({
      data: {
        title:        body.title || "Untitled",
        body:         body.body  || "",
        channelIds:   JSON.stringify(body.channelIds || []),
        contentType:  body.contentType  || "short_post",
        status:       body.status       || "draft",
        scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
        projectId:    body.projectId    || null,
        workflowRunId: body.workflowRunId || null,
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as { id: string; status?: string; publishedAt?: string; publishResults?: Record<string, unknown> };
    const item = await prisma.contentCalendar.update({
      where: { id: body.id },
      data: {
        ...(body.status       ? { status: body.status } : {}),
        ...(body.publishedAt  ? { publishedAt: new Date(body.publishedAt) } : {}),
        ...(body.publishResults ? { publishResults: JSON.stringify(body.publishResults) } : {}),
      },
    });
    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
