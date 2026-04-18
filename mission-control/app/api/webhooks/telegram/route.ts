import { NextRequest, NextResponse } from "next/server";
import { handleApprovalResponse, getApprovalRequests } from "@/lib/approval";
import { prisma } from "@/lib/db";

// Telegram Update types
interface TelegramMessage {
  message_id: number;
  date: number;
  chat: { id: number };
  from?: { id: number; username?: string };
  text?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

// ==================== WEBHOOK HANDLER ====================

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Verify webhook secret token
    const secretToken = req.headers.get("x-telegram-bot-api-secret-token");
    const expectedToken = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (!expectedToken || secretToken !== expectedToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = (await req.json()) as TelegramUpdate;

    if (!body.message || !body.message.text) {
      return NextResponse.json({ ok: true });
    }

    const text = body.message.text;
    const chatId = body.message.chat.id;

    // Parse commands: /approve_xxx or /reject_xxx
    const approveMatch = text.match(/\/approve_(\S+)/);
    const rejectMatch = text.match(/\/reject_(\S+)/);
    const statusMatch = text.match(/\/status/);
    const helpMatch = text.match(/\/help/);

    // ---- APPROVE COMMAND ----
    if (approveMatch) {
      const code = approveMatch[1];
      const result = await handleApprovalResponse(code, "approve");

      if (result.ok) {
        await sendTelegramMessage(
          chatId,
          `✅ 审批已批准！\n任务: ${result.request?.title}`
        );
      } else {
        await sendTelegramMessage(
          chatId,
          `❌ 审批失败: ${result.error || "Unknown error"}`
        );
      }

      return NextResponse.json({ ok: true });
    }

    // ---- REJECT COMMAND ----
    if (rejectMatch) {
      const code = rejectMatch[1];
      const result = await handleApprovalResponse(code, "reject");

      if (result.ok) {
        await sendTelegramMessage(
          chatId,
          `❌ 审批已拒绝！\n任务: ${result.request?.title}`
        );
      } else {
        await sendTelegramMessage(
          chatId,
          `❌ 拒绝失败: ${result.error || "Unknown error"}`
        );
      }

      return NextResponse.json({ ok: true });
    }

    // ---- STATUS COMMAND ----
    if (statusMatch) {
      const pendingCount = (await getApprovalRequests("pending")).length;
      const approvedCount = (await getApprovalRequests("approved")).length;
      const rejectedCount = (await getApprovalRequests("rejected")).length;

      const statusMessage = `📊 *审批统计*
⏳ 待审批: ${pendingCount}
✅ 已批准: ${approvedCount}
❌ 已拒绝: ${rejectedCount}`;

      await sendTelegramMessage(chatId, statusMessage);
      return NextResponse.json({ ok: true });
    }

    // ---- HELP COMMAND ----
    if (helpMatch) {
      const helpMessage = `🤖 *Jarvis 审批系统*

*可用命令:*
/approve\\_CODE - 批准审批请求
/reject\\_CODE - 拒绝审批请求
/status - 查看审批统计
/help - 显示此帮助信息

*示例:*
/approve\\_content_1713437400_abc1def
/reject\\_action_1713437401_xyz2uvw`;

      await sendTelegramMessage(chatId, helpMessage);
      return NextResponse.json({ ok: true });
    }

    // Unknown command
    await sendTelegramMessage(
      chatId,
      "❓ 未知命令。输入 /help 查看可用命令"
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Telegram webhook error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ==================== HELPER FUNCTION ====================

async function sendTelegramMessage(
  chatId: number,
  text: string
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.warn("TELEGRAM_BOT_TOKEN not configured");
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    });

    return res.ok;
  } catch (err) {
    console.error("Error sending telegram message:", err);
    return false;
  }
}
