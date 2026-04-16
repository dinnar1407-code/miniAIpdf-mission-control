import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();

    const data: Record<string, unknown> = {};
    if (body.status === "acknowledged") {
      data.status = "acknowledged";
      data.acknowledgedAt = new Date();
    } else if (body.status === "resolved") {
      data.status = "resolved";
      data.resolvedAt = new Date();
    }

    const alert = await prisma.alert.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json(alert);
  } catch {
    return NextResponse.json({ error: "Failed to update alert" }, { status: 500 });
  }
}
