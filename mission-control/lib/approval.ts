import { prisma } from "@/lib/db";
import { ApprovalRequest } from "@prisma/client";

// ==================== TELEGRAM APPROVAL HELPER ====================

async function getTelegramCredentials(): Promise<{
  token: string;
  chatId: string;
}> {
  let token = process.env.TELEGRAM_BOT_TOKEN;
  let chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    try {
      const cred = await prisma.channelCredential.findUnique({
        where: { channelId: "telegram_notification" },
      });
      if (cred && cred.enabled) {
        const c = JSON.parse(cred.credentials) as Record<string, string>;
        token = token || c.botToken;
        chatId = chatId || c.chatId;
      }
    } catch {
      // Non-fatal
    }
  }

  return { token: token || "", chatId: chatId || "" };
}

// ==================== APPROVAL TELEGRAM SENDER ====================

async function sendApprovalTelegram(
  request: ApprovalRequest
): Promise<string | null> {
  const { token, chatId } = await getTelegramCredentials();

  if (!token || !chatId) {
    console.warn("Telegram credentials not found for approval message");
    return null;
  }

  // Escape underscores for Markdown
  const escapedCode = request.approvalCode.replace(/_/g, "\\_");
  const preview = request.preview.length > 300
    ? request.preview.slice(0, 300) + "..."
    : request.preview;

  const message = `🤖 *Jarvis 请求审批*

*任务*: ${request.title}
*类型*: ${request.type}

*预览*:
\`\`\`
${preview}
\`\`\`

⏰ 2小时内未响应将自动跳过

✅ /approve\\_${escapedCode}   ❌ /reject\\_${escapedCode}`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      }),
    });

    if (!res.ok) {
      console.error("Failed to send approval telegram:", res.statusText);
      return null;
    }

    const data = (await res.json()) as { result?: { message_id?: number } };
    const msgId = data.result?.message_id?.toString();
    return msgId || null;
  } catch (err) {
    console.error("Error sending approval telegram:", err);
    return null;
  }
}

// ==================== CORE APPROVAL FUNCTIONS ====================

export async function createApprovalRequest(params: {
  workflowRunId?: string;
  contentId?: string;
  type: "content" | "action" | "publish";
  title: string;
  preview: string;
  expiresInMinutes?: number;
}): Promise<ApprovalRequest> {
  const expiresInMinutes = params.expiresInMinutes ?? 120;
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  // Generate unique approval code
  const approvalCode = `${params.type}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const request = await prisma.approvalRequest.create({
    data: {
      workflowRunId: params.workflowRunId,
      contentId: params.contentId,
      type: params.type,
      title: params.title,
      preview: params.preview,
      approvalCode,
      expiresAt,
      status: "pending",
    },
  });

  // Send Telegram message
  const msgId = await sendApprovalTelegram(request);
  if (msgId) {
    await prisma.approvalRequest.update({
      where: { id: request.id },
      data: { telegramMsgId: msgId },
    });
    request.telegramMsgId = msgId;
  }

  return request;
}

export async function handleApprovalResponse(
  code: string,
  action: "approve" | "reject"
): Promise<{
  ok: boolean;
  request?: ApprovalRequest;
  error?: string;
}> {
  try {
    const request = await prisma.approvalRequest.findUnique({
      where: { approvalCode: code },
    });

    if (!request) {
      return { ok: false, error: "Approval request not found" };
    }

    if (request.status !== "pending") {
      return {
        ok: false,
        error: `Request already ${request.status}`,
      };
    }

    if (new Date() > request.expiresAt) {
      return {
        ok: false,
        error: "Request has expired",
      };
    }

    const newStatus =
      action === "approve" ? "approved" : "rejected";

    const updated = await prisma.approvalRequest.update({
      where: { id: request.id },
      data: {
        status: newStatus,
        respondedAt: new Date(),
        respondedBy: "telegram_user",
      },
    });

    return { ok: true, request: updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
}

export async function expireOldRequests(): Promise<void> {
  try {
    const now = new Date();

    await prisma.approvalRequest.updateMany({
      where: {
        status: "pending",
        expiresAt: { lt: now },
      },
      data: {
        status: "expired",
        respondedAt: now,
        respondedBy: "system",
      },
    });
  } catch (err) {
    console.error("Error expiring old requests:", err);
  }
}

export async function getApprovalRequests(
  status?: "pending" | "approved" | "rejected" | "expired"
): Promise<ApprovalRequest[]> {
  try {
    return await prisma.approvalRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    console.error("Error fetching approval requests:", err);
    return [];
  }
}
