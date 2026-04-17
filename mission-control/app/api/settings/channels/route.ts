import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { channelRegistry } from "@/lib/channels/registry";
import { ChannelId } from "@/lib/channels/types";

// GET — 返回所有渠道及当前配置状态
export async function GET() {
  const adapters = channelRegistry.getAll();

  // 从 DB 读取已保存的凭证状态（不返回凭证值本身）
  const creds = await prisma.channelCredential.findMany();
  const credMap = Object.fromEntries(creds.map(c => [c.channelId, c]));

  const channels = adapters.map(adapter => {
    const cred = credMap[adapter.id];
    return {
      id:               adapter.id,
      name:             adapter.name,
      icon:             adapter.icon,
      color:            adapter.color,
      supportedTypes:   adapter.supportedTypes,
      requiresApproval: adapter.requiresApproval,
      maxLength:        adapter.maxLength,
      enabled:          cred?.enabled ?? false,
      configured:       cred ? Object.keys(JSON.parse(cred.credentials)).length > 0 : false,
      testedAt:         cred?.testedAt ?? null,
      testResult:       cred?.testResult ?? null,
    };
  });

  return NextResponse.json(channels);
}

// PUT — 保存渠道凭证 & 启用状态
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json() as {
      channelId: ChannelId;
      enabled: boolean;
      credentials: Record<string, string>;
      defaults?: Record<string, unknown>;
    };

    const { channelId, enabled, credentials, defaults = {} } = body;

    if (!channelRegistry.isRegistered(channelId)) {
      return NextResponse.json({ error: "渠道不存在" }, { status: 400 });
    }

    const record = await prisma.channelCredential.upsert({
      where:  { channelId },
      create: {
        channelId,
        enabled,
        credentials: JSON.stringify(credentials),
        defaults:    JSON.stringify(defaults),
      },
      update: {
        enabled,
        credentials: JSON.stringify(credentials),
        defaults:    JSON.stringify(defaults),
        updatedAt:   new Date(),
      },
    });

    return NextResponse.json({ ok: true, id: record.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/settings/channels/test — 测试渠道连接
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { channelId: ChannelId };
    const { channelId } = body;

    const adapter = channelRegistry.get(channelId);
    if (!adapter) return NextResponse.json({ error: "渠道不存在" }, { status: 400 });

    const cred = await prisma.channelCredential.findUnique({ where: { channelId } });
    if (!cred) return NextResponse.json({ error: "请先保存凭证再测试" }, { status: 400 });

    const config = {
      channelId,
      enabled:     true,
      credentials: JSON.parse(cred.credentials),
      defaults:    JSON.parse(cred.defaults),
    };

    const testContent = {
      body: `🤖 Jarvis 连接测试 — ${adapter.name} ✓ ${new Date().toLocaleString("zh-CN")}`,
    };

    const result = await adapter.publish(testContent, config);
    const testResult = result.success ? "ok" : (result.error || "failed");

    await prisma.channelCredential.update({
      where: { channelId },
      data: { testedAt: new Date(), testResult },
    });

    return NextResponse.json({ ok: result.success, result: testResult, postUrl: result.postUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
