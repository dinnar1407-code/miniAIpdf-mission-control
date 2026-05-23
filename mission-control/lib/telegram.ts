import { prisma } from "@/lib/db";

export type InlineButton = { text: string; callback_data: string };

// ── 内部：读取凭证 ────────────────────────────────────────────────────────────

async function getConfig(): Promise<{ token: string; chatId: string } | null> {
  let token  = process.env.TELEGRAM_BOT_TOKEN;
  let chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    try {
      const cred = await prisma.channelCredential.findUnique({
        where: { channelId: "telegram_notification" },
      });
      if (cred?.enabled) {
        const c = JSON.parse(cred.credentials) as Record<string, string>;
        token  ||= c.botToken;
        chatId ||= c.chatId;
      }
    } catch {}
  }

  return token && chatId ? { token, chatId } : null;
}

// ── 公开 API ──────────────────────────────────────────────────────────────────

/** 向默认 chatId 推送文本消息（自动加 Jarvis 前缀） */
export async function sendTelegram(text: string): Promise<boolean> {
  const cfg = await getConfig();
  if (!cfg) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        chat_id:    cfg.chatId,
        text:       `🤖 *Jarvis Mission Control*\n\n${text}`,
        parse_mode: "Markdown",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 向默认 chatId 推送文本 + inline 按钮（调用方自行控制文本格式，不加前缀） */
export async function sendTelegramWithButtons(
  text:    string,
  buttons: InlineButton[][]
): Promise<boolean> {
  const cfg = await getConfig();
  if (!cfg) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        chat_id:      cfg.chatId,
        text,
        parse_mode:   "Markdown",
        reply_markup: { inline_keyboard: buttons },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 编辑已发消息并清空按钮（用于审批后更新状态） */
export async function editTelegramMessage(
  chatId:    number | string,
  messageId: number,
  text:      string
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      chat_id:      chatId,
      message_id:   messageId,
      text,
      parse_mode:   "Markdown",
      reply_markup: { inline_keyboard: [] },
    }),
  }).catch(() => {});
}

/** 回应 callback_query（必须在 10s 内调用，否则 Telegram 显示超时错误） */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?:           string
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ callback_query_id: callbackQueryId, text }),
  }).catch(() => {});
}
