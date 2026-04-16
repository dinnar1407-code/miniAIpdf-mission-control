import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const key = await prisma.apiKey.update({
      where: { id: params.id },
      data: {
        ...(body.name        ? { name: body.name }               : {}),
        ...(body.permissions ? { permissions: body.permissions } : {}),
        ...(body.active !== undefined ? { active: body.active }  : {}),
      },
    });
    return NextResponse.json(key);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.apiKey.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
