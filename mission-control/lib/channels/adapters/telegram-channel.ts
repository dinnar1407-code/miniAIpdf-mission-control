// Telegram Channel — 半真实实现（已有 Bot Token）
import { BaseChannelAdapter } from "./base";
import { ChannelConfig, ContentType, PublishContent, PublishResult } from "../types";

export class TelegramChannelAdapter extends BaseChannelAdapter {
  readonly id = "telegram_channel" as const;
  readonly name = "Telegram Channel";
  readonly icon = "✈️";
  readonly color = "#229ED9";
  readonly supportedTypes: ContentType[] = ["short_post", "long_post", "link_share"];
  readonly maxLength = 4096;
  readonly requiresApproval = false; // Telegram 直发，低风险

  async publish(content: PublishContent, config: ChannelConfig): Promise<PublishResult> {
    const token  = config.credentials.botToken  || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = config.credentials.channelId || process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return { success: false, error: "未配置 Telegram Bot Token 或 Channel ID" };
    }

    const formatted = this.formatContent(content);
    const tags = content.tags?.map(t => `#${t.replace(/\s+/g, "_")}`).join(" ") || "";
    const text = [
      content.title ? `*${content.title}*\n` : "",
      formatted.primary,
      tags ? `\n\n${tags}` : "",
      content.link ? `\n\n🔗 ${content.link}` : "",
    ].join("");

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
      });
      const data = await res.json() as { ok: boolean; result?: { message_id: number }; description?: string };

      if (data.ok) {
        return {
          success: true,
          postId: String(data.result?.message_id),
          postUrl: `https://t.me/c/${chatId.replace("-100", "")}/${data.result?.message_id}`,
        };
      }
      return { success: false, error: data.description || "发送失败" };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "网络错误" };
    }
  }
}
