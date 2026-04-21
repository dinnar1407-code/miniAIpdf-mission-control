/**
 * 共享发布器 — 供 workflow-engine 和 approval 两处调用
 * 避免代码重复，统一处理渠道凭证读取 + adapter 调用
 */
import { prisma } from "@/lib/db";
import { channelRegistry } from "@/lib/channels/registry";
import { ChannelId, PublishContent } from "@/lib/channels/types";

export interface ChannelPublishResult {
  channelId: string;
  channelName: string;
  icon: string;
  success: boolean;
  postUrl?: string;
  error?: string;
}

/**
 * 向一组渠道发布内容，返回每个渠道的发布结果
 */
export async function publishToChannels(
  channelIds: ChannelId[],
  content: PublishContent
): Promise<ChannelPublishResult[]> {
  const results: ChannelPublishResult[] = [];

  for (const channelId of channelIds) {
    const adapter = channelRegistry.get(channelId);
    if (!adapter) {
      results.push({
        channelId,
        channelName: channelId,
        icon: "❓",
        success: false,
        error: `渠道 ${channelId} 未注册`,
      });
      continue;
    }

    // 从 DB 读取渠道凭证
    let channelConfig;
    try {
      const cred = await prisma.channelCredential.findUnique({ where: { channelId } });
      channelConfig = {
        channelId,
        enabled: cred?.enabled ?? false,
        credentials: cred ? JSON.parse(cred.credentials) : {},
        defaults:    cred ? JSON.parse(cred.defaults ?? "{}") : {},
      };
    } catch {
      channelConfig = { channelId, enabled: false, credentials: {}, defaults: {} };
    }

    if (!channelConfig.enabled) {
      results.push({
        channelId,
        channelName: adapter.name,
        icon: adapter.icon,
        success: false,
        error: "渠道未启用（请在 Settings → Channels 配置）",
      });
      continue;
    }

    try {
      const result = await adapter.publish(content, channelConfig);
      results.push({
        channelId,
        channelName: adapter.name,
        icon: adapter.icon,
        success: result.success,
        postUrl: result.postUrl,
        error: result.error,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "未知错误";
      results.push({
        channelId,
        channelName: adapter.name,
        icon: adapter.icon,
        success: false,
        error: message,
      });
    }
  }

  return results;
}

/**
 * 将渠道发布结果格式化为可读字符串（用于日志和 Telegram 通知）
 */
export function formatPublishResults(results: ChannelPublishResult[]): string {
  return results
    .map(r =>
      r.success
        ? `${r.icon} ${r.channelName} ✓${r.postUrl ? ` → ${r.postUrl}` : ""}`
        : `${r.icon} ${r.channelName} ✗ ${r.error || "失败"}`
    )
    .join("\n");
}
