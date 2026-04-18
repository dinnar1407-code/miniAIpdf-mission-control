import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const NOTIFY_CHANNEL_ID = "telegram_notification";

// GET — 返回当前 Telegram 通知配置（不返回 token 值）
export async function GET() {
  try {
    const cred = await prisma.channelCredential.findUnique({
      where: { channelId: NOTIFY_CHANNEL_ID },
    });

    return NextResponse.json({
      enabled:    cred?.enabled ?? false,
      configured: cred ? Object.keys(JSON.parse(cred.credentials)).length > 0 : false,
      testedAt:   cred?.testedAt ?? null,
      testResult: cred?.testResult ?? null,
    });
  } catch {
    return NextResponse.json({ enabled: false, configured: false });
  }
}

// PUT — 保存 Telegram 通知配置
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json() as {
      enabled:     boolean;
      botToken:    string;
      chatId:      string;
    };

    await prisma.channelCredential.upsert({
      where:  { channelId: NOTIFY_CHANNEL_ID },
      create: {
        channelId:   NOTIFY_CHANNEL_ID,
        enabled:     body.enabled,
        credentials: JSON.stringify({ botToken: body.botToken, chatId: body.chatId }),
        defaults:    JSON.stringify({}),
      },
      update: {
        enabled:     body.enabled,
        credentials: JSON.stringify({ botToken: body.botToken, chatId: body.chatId }),
        updatedAt:   new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
