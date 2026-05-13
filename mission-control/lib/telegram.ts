import { prisma } from "@/lib/db";

// 共享 Telegram 发送工具：优先读环境变量，fallback 读 DB ChannelCredential
export async function sendTelegram(text: string): Promise<boolean> {
  let token  = process.env.TELEGRAM_BOT_TOKEN;
  let chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    try {
      const cred = await prisma.channelCredential.findUnique({
        where: { channelId: "telegram_notification" },
      });
      if (cred?.enabled) {
        const c = JSON.parse(cred.credentials) as Record<string, string>;
        token  = token  || c.botToken;
        chatId = chatId || c.chatId;
      }
    } catch {}
  }

  if (!token || !chatId) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id:    chatId,
        text:       `🤖 *Jarvis Mission Control*\n\n${text}`,
        parse_mode: "Markdown",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
