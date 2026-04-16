import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const projectSlug = searchParams.get("project");

    const alerts = await prisma.alert.findMany({
      where: {
        ...(status && { status }),
        ...(projectSlug && { project: { slug: projectSlug } }),
      },
      include: { project: true },
      orderBy: [
        { status: "asc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json(alerts);
  } catch {
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const alert = await prisma.alert.create({
      data: {
        severity: body.severity,
        source: body.source || "manual",
        message: body.message,
        projectId: body.projectId,
      },
    });
    return NextResponse.json(alert, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create alert" }, { status: 500 });
  }
}
