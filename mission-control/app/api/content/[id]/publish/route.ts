import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { channelRegistry } from "@/lib/channels/registry";
import { ChannelId, PublishContent } from "@/lib/channels/types";

// POST /api/content/[id]/publish
// 将 Content Calendar 条目发布到所有配置的渠道
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const item = await prisma.contentCalendar.findUnique({ where: { id: params.id } });
    if (!item) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    const channelIds: ChannelId[] = JSON.parse(item.channelIds || "[]");
    if (channelIds.length === 0) {
      return NextResponse.json({ error: "No channels configured for this content" }, { status: 400 });
    }

    const content: PublishContent = {
      title: item.title,
      body:  item.body,
      tags:  [],
    };

    const results: Record<string, { success: boolean; postUrl?: string; error?: string }> = {};

    for (const channelId of channelIds) {
      const adapter = channelRegistry.get(channelId);
      if (!adapter) {
        results[channelId] = { success: false, error: "Adapter not found" };
        continue;
      }

      // 读取渠道凭证
      let channelConfig;
      try {
        const cred = await prisma.channelCredential.findUnique({ where: { channelId } });
        channelConfig = {
          channelId,
          enabled:     cred?.enabled ?? false,
          credentials: cred ? JSON.parse(cred.credentials) : {},
          defaults:    cred ? JSON.parse(cred.defaults)    : {},
        };
      } catch {
        channelConfig = { channelId, enabled: false, credentials: {}, defaults: {} };
      }

      if (!channelConfig.enabled) {
        results[channelId] = {
          success: false,
          error: `${adapter.name} 未启用 — 请在 Settings → Channels 配置`,
        };
        continue;
      }

      const result = await adapter.publish(content, channelConfig);
      results[channelId] = {
        success: result.success,
        postUrl: result.postUrl,
        error:   result.error,
      };
    }

    const allSuccess = Object.values(results).every(r => r.success);
    const anySuccess = Object.values(results).some(r => r.success);

    // 更新 ContentCalendar 状态
    const newStatus = allSuccess ? "published"
                    : anySuccess ? "published"   // 部分成功也标为 published
                    : "failed";

    await prisma.contentCalendar.update({
      where: { id: params.id },
      data: {
        status:         newStatus,
        publishedAt:    anySuccess ? new Date() : undefined,
        publishResults: JSON.stringify(results),
        updatedAt:      new Date(),
      },
    });

    return NextResponse.json({
      ok:      anySuccess,
      status:  newStatus,
      results,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
