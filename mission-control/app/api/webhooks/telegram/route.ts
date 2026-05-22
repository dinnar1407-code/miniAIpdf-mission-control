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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as TelegramUpdate;

    if (!body.message || !body.message.text) {
      return NextResponse.json({ ok: true });
    }

    const text     = body.message.text.trim();
    const chatId   = body.message.chat.id;
    const fromId   = body.message.from?.id;
    const username = body.message.from?.username ?? "unknown";

    // Only allow messages from the configured chat / user
    const allowedChatId = process.env.TELEGRAM_CHAT_ID
      ? Number(process.env.TELEGRAM_CHAT_ID)
      : null;
    if (allowedChatId && chatId !== allowedChatId && fromId !== allowedChatId) {
      return NextResponse.json({ ok: true }); // silently ignore
    }

    // ---- KPI REPORT: /kpi <project> metric=value [metric=value ...] ----
    // Example: /kpi wheatcoin revenue=320 orders=8 users=150
    const kpiMatch = text.match(/^\/kpi\s+(\S+)\s+(.+)$/i);
    if (kpiMatch) {
      const slug  = kpiMatch[1].toLowerCase();
      const kvStr = kpiMatch[2];

      const project = await prisma.project.findFirst({
        where: { OR: [{ slug }, { name: { equals: slug, mode: "insensitive" } }] },
      });

      if (!project) {
        await sendTelegramMessage(chatId, `❌ 项目 "${slug}" 不存在\n\n用 /projects 查看可用项目`);
        return NextResponse.json({ ok: true });
      }

      // Parse key=value pairs (supports integers and decimals)
      const pairs = [...kvStr.matchAll(/(\w+)=([\d.]+)/g)];
      if (pairs.length === 0) {
        await sendTelegramMessage(
          chatId,
          `❌ 格式错误\n\n示例: /kpi wheatcoin revenue=320 orders=8`
        );
        return NextResponse.json({ ok: true });
      }

      await prisma.kpiSnapshot.createMany({
        data: pairs.map(([, metric, valueStr]) => ({
          projectId: project.id,
          source:    "telegram",
          metric,
          value:     parseFloat(valueStr),
          date:      new Date(),
          metadata:  JSON.stringify({ reportedBy: username }),
        })),
      });

      const lines = pairs.map(([, m, v]) => `  • ${m}: ${v}`).join("\n");
      await sendTelegramMessage(
        chatId,
        `✅ *${project.name}* 数据已上报\n${lines}\n\n_Observer 下次运行时自动分析趋势_`
      );
      return NextResponse.json({ ok: true });
    }

    // ---- MANUAL INSIGHT: /report <project> <summary> ----
    // Example: /report wheatcoin 本周转化率下降，怀疑是定价问题
    const reportMatch = text.match(/^\/report\s+(\S+)\s+(.+)$/is);
    if (reportMatch) {
      const slug    = reportMatch[1].toLowerCase();
      const summary = reportMatch[2].trim();

      const project = await prisma.project.findFirst({
        where: { OR: [{ slug }, { name: { equals: slug, mode: "insensitive" } }] },
      });

      if (!project) {
        await sendTelegramMessage(chatId, `❌ 项目 "${slug}" 不存在`);
        return NextResponse.json({ ok: true });
      }

      const insight = await prisma.insight.create({
        data: {
          projectId:       project.id,
          type:            "risk",
          severity:        "medium",
          title:           summary.slice(0, 80),
          summary,
          evidence:        { source: "telegram", reportedBy: username, reportedAt: new Date().toISOString() },
          suggestedAction: "请进一步调查并制定应对方案",
          status:          "new",
          observedAt:      new Date(),
        },
      });

      await sendTelegramMessage(
        chatId,
        `✅ Insight 已创建\n\n*项目:* ${project.name}\n*摘要:* ${summary.slice(0, 100)}\n*ID:* \`${insight.id}\`\n\n_Planner 可基于此生成执行方案_`
      );
      return NextResponse.json({ ok: true });
    }

    // ---- LIST PROJECTS: /projects ----
    if (/^\/projects$/i.test(text)) {
      const projects = await prisma.project.findMany({
        where:   { status: "active" },
        select:  { name: true, slug: true, emoji: true },
        orderBy: { name: "asc" },
      });
      const lines = projects.map((p) => `${p.emoji} ${p.slug}`).join("\n");
      await sendTelegramMessage(chatId, `📁 *可用项目*\n\n${lines}`);
      return NextResponse.json({ ok: true });
    }

    // ---- APPROVE COMMAND ----
    const approveMatch = text.match(/\/approve_(\S+)/);
    if (approveMatch) {
      const result = await handleApprovalResponse(approveMatch[1], "approve");
      await sendTelegramMessage(
        chatId,
        result.ok
          ? `✅ 审批已批准！\n任务: ${result.request?.title}`
          : `❌ 审批失败: ${result.error ?? "Unknown error"}`
      );
      return NextResponse.json({ ok: true });
    }

    // ---- REJECT COMMAND ----
    const rejectMatch = text.match(/\/reject_(\S+)/);
    if (rejectMatch) {
      const result = await handleApprovalResponse(rejectMatch[1], "reject");
      await sendTelegramMessage(
        chatId,
        result.ok
          ? `❌ 审批已拒绝！\n任务: ${result.request?.title}`
          : `❌ 拒绝失败: ${result.error ?? "Unknown error"}`
      );
      return NextResponse.json({ ok: true });
    }

    // ---- STATUS COMMAND ----
    if (/^\/status$/i.test(text)) {
      const [pending, approved, rejected] = await Promise.all([
        getApprovalRequests("pending"),
        getApprovalRequests("approved"),
        getApprovalRequests("rejected"),
      ]);
      await sendTelegramMessage(
        chatId,
        `📊 *审批统计*\n⏳ 待审批: ${pending.length}\n✅ 已批准: ${approved.length}\n❌ 已拒绝: ${rejected.length}`
      );
      return NextResponse.json({ ok: true });
    }

    // ---- HELP COMMAND ----
    if (/^\/help$/i.test(text)) {
      await sendTelegramMessage(chatId, `🤖 *Jarvis 命令列表*

*数据上报*
/kpi \\<project\\> metric=value \\.\\.\\. — 上报 KPI 数据
/report \\<project\\> \\<摘要\\> — 手动创建 Insight

*审批*
/approve\\_CODE — 批准审批请求
/reject\\_CODE — 拒绝审批请求
/status — 查看审批统计

*其他*
/projects — 列出所有项目
/help — 显示此帮助

*示例*
/kpi wheatcoin revenue=320 orders=8
/report miniaipdf 注册转化率本周下降 15%`);
      return NextResponse.json({ ok: true });
    }

    // Unknown command
    await sendTelegramMessage(chatId, "❓ 未知命令。输入 /help 查看可用命令");
    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error("Telegram webhook error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ==================== HELPER ====================

async function sendTelegramMessage(chatId: number, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("TELEGRAM_BOT_TOKEN not configured");
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });
    return res.ok;
  } catch (err) {
    console.error("Error sending telegram message:", err);
    return false;
  }
}
