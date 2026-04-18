import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { channelRegistry } from "@/lib/channels/registry";
import { ChannelId, PublishContent } from "@/lib/channels/types";

// PATCH /api/content/[id] — 更新状态、审核、发布
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json() as {
      status?: string;
      publishedAt?: string;
      publishResults?: Record<string, unknown>;
    };

    const item = await prisma.contentCalendar.update({
      where: { id: params.id },
      data: {
        ...(body.status        ? { status: body.status }                        : {}),
        ...(body.publishedAt   ? { publishedAt: new Date(body.publishedAt) }    : {}),
        ...(body.publishResults ? { publishResults: JSON.stringify(body.publishResults) } : {}),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(item);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/content/[id]/... is handled in the publish sub-route
// DELETE /api/content/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.contentCalendar.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
