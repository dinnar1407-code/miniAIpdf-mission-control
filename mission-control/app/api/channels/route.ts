import { NextResponse } from "next/server";
import { channelRegistry } from "@/lib/channels/registry";

// GET /api/channels — 返回所有注册渠道及状态
export async function GET() {
  const adapters = channelRegistry.getAll();

  const channels = adapters.map(adapter => ({
    id:               adapter.id,
    name:             adapter.name,
    icon:             adapter.icon,
    color:            adapter.color,
    supportedTypes:   adapter.supportedTypes,
    requiresApproval: adapter.requiresApproval,
    maxLength:        adapter.maxLength,
    // TODO: 从 DB 读取配置状态
    configured: adapter.id === "telegram_channel", // Telegram 已配置
    enabled:    adapter.id === "telegram_channel",
  }));

  return NextResponse.json(channels);
}
