import { NextRequest, NextResponse }       from "next/server";
import { handleApprovalResponse,
         getApprovalRequests }             from "@/lib/approval";
import { prisma }                          from "@/lib/db";
import { planFromInsight }                 from "@/lib/planner";
import { createMissionFromPlan }           from "@/lib/mission-orchestrator";
import { answerCallbackQuery,
         editTelegramMessage,
         sendTelegramWithButtons }         from "@/lib/telegram";
import { getShiquClient,
         getShiquProjectId }               from "@/lib/integrations/shiqu";
import { writeMemory }                     from "@/lib/memory";

export const maxDuration = 60;

// ── Telegram Update 类型 ──────────────────────────────────────────────────────

interface TelegramMessage {
  message_id: number;
  date:       number;
  chat:       { id: number };
  from?:      { id: number; username?: string };
  text?:      string;
}

interface TelegramCallbackQuery {
  id:       string;
  from:     { id: number; username?: string };
  message?: { message_id: number; chat: { id: number } };
  data?:    string;
}

interface TelegramUpdate {
  update_id:       number;
  message?:        TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

// ==================== WEBHOOK HANDLER ====================

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 验证 webhook secret token
    const secretToken   = req.headers.get("x-telegram-bot-api-secret-token");
    const expectedToken = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!expectedToken || secretToken !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as TelegramUpdate;

    // ── 处理 inline 按钮点击（callback_query）────────────────────────────────
    if (body.callback_query) {
      const cq     = body.callback_query;
      const data   = cq.data ?? "";
      const cbChat = cq.message?.chat.id;
      const msgId  = cq.message?.message_id;
      const cbUser = cq.from?.username ?? "telegram_user";

      // 必须在 10s 内 answer，否则 Telegram 显示加载超时
      await answerCallbackQuery(cq.id);

      if (data.startsWith("plan_approve:")) {
        const planId = data.slice("plan_approve:".length);
        const plan   = await prisma.plan.findUnique({
          where:   { id: planId },
          include: { planApproval: true },
        });

        if (!plan || plan.status !== "pending" || plan.planApproval?.decision !== "pending") {
          if (cbChat && msgId) {
            await editTelegramMessage(cbChat, msgId, `⚠️ 此 Plan 状态已变更，无需再次审批`);
          }
          return NextResponse.json({ ok: true });
        }

        await prisma.$transaction(async (tx) => {
          await tx.planApproval.update({
            where: { planId },
            data:  { decision: "approved", decidedBy: `telegram:${cbUser}`, decidedAt: new Date() },
          });
          await tx.plan.update({ where: { id: planId }, data: { status: "approved" } });
        });

        if (cbChat && msgId) {
          await editTelegramMessage(
            cbChat, msgId,
            `✅ *已批准执行*\n\n📋 Plan \`${planId.slice(-8)}\`\n由 @${cbUser} 批准\n\nMission 已创建，完成后通知你`
          );
        }

        // 触发 Mission（fire-and-forget，完成后由 mission-orchestrator 发通知）
        void createMissionFromPlan(planId).catch((err) =>
          console.error("[TG callback] createMissionFromPlan failed:", String(err))
        );

      } else if (data.startsWith("plan_reject:")) {
        const planId = data.slice("plan_reject:".length);
        const plan   = await prisma.plan.findUnique({
          where:   { id: planId },
          include: { planApproval: true },
        });

        if (!plan || plan.status !== "pending" || plan.planApproval?.decision !== "pending") {
          if (cbChat && msgId) {
            await editTelegramMessage(cbChat, msgId, `⚠️ 此 Plan 状态已变更`);
          }
          return NextResponse.json({ ok: true });
        }

        await prisma.$transaction(async (tx) => {
          await tx.planApproval.update({
            where: { planId },
            data:  { decision: "rejected", decidedBy: `telegram:${cbUser}`, decidedAt: new Date() },
          });
          await tx.plan.update({ where: { id: planId }, data: { status: "rejected" } });
        });

        if (cbChat && msgId) {
          await editTelegramMessage(
            cbChat, msgId,
            `❌ *已拒绝执行*\n\n📋 Plan \`${planId.slice(-8)}\`\n由 @${cbUser} 拒绝`
          );
        }

      // ── 拾趣审核：批准下架（阶段3 交互审批）──────────────────────────────────
      } else if (data.startsWith("shiqu_remove:")) {
        const reqId = data.slice("shiqu_remove:".length);

        // 原子抢占：只有仍是 pending 才能抢到 → 防止重复点击/Telegram 重发导致重复下架
        const claim = await prisma.shiquModerationRequest.updateMany({
          where: { id: reqId, status: "pending" },
          data:  { status: "processing", decidedBy: `telegram:${cbUser}`, decidedAt: new Date() },
        });
        if (claim.count === 0) {
          if (cbChat && msgId) await editTelegramMessage(cbChat, msgId, "⚠️ 此审核请求已处理");
          return NextResponse.json({ ok: true });
        }

        const reqRow = await prisma.shiquModerationRequest.findUnique({ where: { id: reqId } });
        // 调拾趣 admin API 执行下架（人类已签字）
        const shiqu  = await getShiquClient();
        const ok     = shiqu && reqRow ? await shiqu.removeContent(Number(reqRow.shiquModId)) : false;

        if (ok && reqRow) {
          await prisma.shiquModerationRequest.update({ where: { id: reqId }, data: { status: "removed" } });
          if (cbChat && msgId) {
            await editTelegramMessage(
              cbChat, msgId,
              `✅ *已下架*\n\n${reqRow.targetTitle}\n由 @${cbUser} 批准（可在拾趣运营台恢复）`
            );
          }
          // 学习飞轮：把「人工确认下架」写入 Memory，供日后审核参考
          try {
            const projectId = await getShiquProjectId();
            await writeMemory({
              projectId:   projectId ?? undefined,
              kind:        "feedback_lesson",
              content:     `拾趣审核：${reqRow.targetType}「${reqRow.targetTitle}」因「${reqRow.aiReason}」被人工确认下架。`,
              sourceTable: "ShiquModerationRequest",
              sourceId:    reqRow.id,
              metadata:    { decision: "removed", targetType: reqRow.targetType, aiReason: reqRow.aiReason },
            });
          } catch (err) {
            console.error("[TG callback] shiqu writeMemory(removed) failed:", String(err));
          }
        } else {
          // 下架失败：回退为 pending 并重发带按钮的消息，让你能重试（修复"失败即卡死"）
          await prisma.shiquModerationRequest.update({
            where: { id: reqId },
            data:  { status: "pending", decidedBy: null, decidedAt: null },
          });
          if (cbChat && msgId) {
            await editTelegramMessage(cbChat, msgId, `❌ 下架失败：${reqRow?.targetTitle ?? reqId}`);
          }
          await sendTelegramWithButtons(
            `🛡️ *拾趣审核 · 下架失败，请重试*\n\n${reqRow?.targetTitle ?? ""}\nAI 理由：${reqRow?.aiReason ?? ""}`,
            [[
              { text: "✅ 重试下架", callback_data: `shiqu_remove:${reqId}` },
              { text: "↩️ 保留",     callback_data: `shiqu_keep:${reqId}` },
            ]]
          );
        }

      // ── 拾趣审核：保留（AI 误报，人工判定正常）─────────────────────────────────
      } else if (data.startsWith("shiqu_keep:")) {
        const reqId = data.slice("shiqu_keep:".length);

        // 原子抢占（同上）：只有仍是 pending 才能改成 kept
        const claim = await prisma.shiquModerationRequest.updateMany({
          where: { id: reqId, status: "pending" },
          data:  { status: "kept", decidedBy: `telegram:${cbUser}`, decidedAt: new Date() },
        });
        if (claim.count === 0) {
          if (cbChat && msgId) await editTelegramMessage(cbChat, msgId, "⚠️ 此审核请求已处理");
          return NextResponse.json({ ok: true });
        }

        const reqRow = await prisma.shiquModerationRequest.findUnique({ where: { id: reqId } });
        if (cbChat && msgId) {
          await editTelegramMessage(
            cbChat, msgId,
            `↩️ *已保留*\n\n${reqRow?.targetTitle ?? ""}\n由 @${cbUser} 判定为正常`
          );
        }

        // 学习飞轮：人工判定「保留」（AI 误报）同样是宝贵教训
        if (reqRow) {
          try {
            const projectId = await getShiquProjectId();
            await writeMemory({
              projectId:   projectId ?? undefined,
              kind:        "feedback_lesson",
              content:     `拾趣审核：${reqRow.targetType}「${reqRow.targetTitle}」被 AI 以「${reqRow.aiReason}」标记，但人工判定为正常、予以保留（AI 误报）。`,
              sourceTable: "ShiquModerationRequest",
              sourceId:    reqRow.id,
              metadata:    { decision: "kept", targetType: reqRow.targetType, aiReason: reqRow.aiReason },
            });
          } catch (err) {
            console.error("[TG callback] shiqu writeMemory(kept) failed:", String(err));
          }
        }
      }

      return NextResponse.json({ ok: true });
    }

    // ── 普通消息 ──────────────────────────────────────────────────────────────
    if (!body.message?.text) {
      return NextResponse.json({ ok: true });
    }

    const text     = body.message.text.trim();
    const chatId   = body.message.chat.id;
    const fromId   = body.message.from?.id;
    const username = body.message.from?.username ?? "unknown";

    // 只允许来自配置 chat / user 的消息
    const allowedChatId = process.env.TELEGRAM_CHAT_ID
      ? Number(process.env.TELEGRAM_CHAT_ID)
      : null;
    if (allowedChatId && chatId !== allowedChatId && fromId !== allowedChatId) {
      return NextResponse.json({ ok: true });
    }

    // ---- RUN: /run [projectSlug] <objective> --------------------------------
    // 示例: /run furmates 写一篇双11小红书文案
    //       /run 帮 FurMates 分析本周销售下滑原因
    const runMatch = text.match(/^\/run\s+([\s\S]+)$/i);
    if (runMatch) {
      const args  = runMatch[1].trim();
      const parts = args.split(/\s+/);
      const slug  = parts[0].toLowerCase();

      // 尝试把第一个词当项目 slug 或名称匹配
      const projectBySlug = await prisma.project.findFirst({
        where: { OR: [{ slug }, { name: { equals: slug, mode: "insensitive" } }], status: "active" },
      });

      const project   = projectBySlug
        ?? await prisma.project.findFirst({ where: { status: "active" }, orderBy: { name: "asc" } });
      const objective = projectBySlug ? parts.slice(1).join(" ").trim() : args;

      if (!project || !objective) {
        await sendTelegramMessage(chatId,
          `❌ 请提供任务目标\n\n示例: /run furmates 写一篇双11推广文案`);
        return NextResponse.json({ ok: true });
      }

      await sendTelegramMessage(chatId,
        `🔄 正在为 *${project.name}* 生成执行方案…\n目标: ${objective.slice(0, 80)}`);

      // 创建 Insight，作为 Planner 的输入
      const insight = await prisma.insight.create({
        data: {
          projectId:       project.id,
          type:            "opportunity",
          severity:        "medium",
          title:           objective.slice(0, 80),
          summary:         objective,
          evidence:        { source: "telegram_run", requestedBy: username },
          suggestedAction: objective,
          status:          "new",
          observedAt:      new Date(),
        },
      });

      try {
        const { plan } = await planFromInsight(insight.id);

        if (plan.status === "approved") {
          await sendTelegramMessage(chatId,
            `✅ *低风险，已自动批准*\n\n🎯 ${plan.objective.slice(0, 80)}\n\nMission 执行中，完成后通知你`
          );
        }
        // 高风险：planner 内部已推送 inline 按钮审批通知，此处无需重复发送
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await sendTelegramMessage(chatId, `❌ 生成方案失败:\n${msg.slice(0, 200)}`);
      }

      return NextResponse.json({ ok: true });
    }

    // ---- KPI REPORT: /kpi <project> metric=value [...] ----------------------
    const kpiMatch = text.match(/^\/kpi\s+(\S+)\s+(.+)$/i);
    if (kpiMatch) {
      const kpiSlug = kpiMatch[1].toLowerCase();
      const kvStr   = kpiMatch[2];

      const project = await prisma.project.findFirst({
        where: { OR: [{ slug: kpiSlug }, { name: { equals: kpiSlug, mode: "insensitive" } }] },
      });

      if (!project) {
        await sendTelegramMessage(chatId, `❌ 项目 "${kpiSlug}" 不存在\n\n用 /projects 查看可用项目`);
        return NextResponse.json({ ok: true });
      }

      const rawPairs = (kvStr.match(/\w+=[\d.]+/g) ?? [])
        .map((p) => p.split("=") as [string, string]);
      if (rawPairs.length === 0) {
        await sendTelegramMessage(chatId, `❌ 格式错误\n\n示例: /kpi wheatcoin revenue=320 orders=8`);
        return NextResponse.json({ ok: true });
      }

      await prisma.kpiSnapshot.createMany({
        data: rawPairs.map(([metric, valueStr]) => ({
          projectId: project.id,
          source:    "telegram",
          metric,
          value:     parseFloat(valueStr),
          date:      new Date(),
          metadata:  JSON.stringify({ reportedBy: username }),
        })),
      });

      const lines = rawPairs.map(([m, v]) => `  • ${m}: ${v}`).join("\n");
      await sendTelegramMessage(chatId,
        `✅ *${project.name}* 数据已上报\n${lines}\n\n_Observer 下次运行时自动分析趋势_`);
      return NextResponse.json({ ok: true });
    }

    // ---- MANUAL INSIGHT: /report <project> <summary> ------------------------
    const reportMatch = text.match(/^\/report\s+(\S+)\s+([\s\S]+)$/i);
    if (reportMatch) {
      const repSlug = reportMatch[1].toLowerCase();
      const summary = reportMatch[2].trim();

      const project = await prisma.project.findFirst({
        where: { OR: [{ slug: repSlug }, { name: { equals: repSlug, mode: "insensitive" } }] },
      });

      if (!project) {
        await sendTelegramMessage(chatId, `❌ 项目 "${repSlug}" 不存在`);
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

      await sendTelegramMessage(chatId,
        `✅ Insight 已创建\n\n*项目:* ${project.name}\n*摘要:* ${summary.slice(0, 100)}\n` +
        `*ID:* \`${insight.id}\`\n\n_Planner 可基于此生成执行方案_`);
      return NextResponse.json({ ok: true });
    }

    // ---- LIST PROJECTS: /projects -------------------------------------------
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

    // ---- APPROVE COMMAND (文本形式，保留兼容) --------------------------------
    const approveMatch = text.match(/\/approve_(\S+)/);
    if (approveMatch) {
      const result = await handleApprovalResponse(approveMatch[1], "approve");
      await sendTelegramMessage(chatId,
        result.ok
          ? `✅ 审批已批准！\n任务: ${result.request?.title}`
          : `❌ 审批失败: ${result.error ?? "Unknown error"}`
      );
      return NextResponse.json({ ok: true });
    }

    // ---- REJECT COMMAND (文本形式，保留兼容) ---------------------------------
    const rejectMatch = text.match(/\/reject_(\S+)/);
    if (rejectMatch) {
      const result = await handleApprovalResponse(rejectMatch[1], "reject");
      await sendTelegramMessage(chatId,
        result.ok
          ? `❌ 审批已拒绝！\n任务: ${result.request?.title}`
          : `❌ 拒绝失败: ${result.error ?? "Unknown error"}`
      );
      return NextResponse.json({ ok: true });
    }

    // ---- STATUS COMMAND -----------------------------------------------------
    if (/^\/status$/i.test(text)) {
      const [pending, approved, rejected] = await Promise.all([
        getApprovalRequests("pending"),
        getApprovalRequests("approved"),
        getApprovalRequests("rejected"),
      ]);
      await sendTelegramMessage(chatId,
        `📊 *审批统计*\n⏳ 待审批: ${pending.length}\n✅ 已批准: ${approved.length}\n❌ 已拒绝: ${rejected.length}`);
      return NextResponse.json({ ok: true });
    }

    // ---- HELP COMMAND -------------------------------------------------------
    if (/^\/help$/i.test(text)) {
      await sendTelegramMessage(chatId, `🤖 *Jarvis 命令列表*

*任务执行*
/run \\[project\\] \\<目标\\> — 让 Jarvis 生成并执行方案

*数据上报*
/kpi \\<project\\> metric=value \\.\\.\\. — 上报 KPI 数据
/report \\<project\\> \\<摘要\\> — 手动创建 Insight

*审批*
/approve\\_CODE — 批准审批请求（文本形式）
/reject\\_CODE — 拒绝审批请求（文本形式）
/status — 查看审批统计

*其他*
/projects — 列出所有项目
/help — 显示此帮助

*示例*
/run furmates 写一篇双11小红书推广文案
/kpi wheatcoin revenue=320 orders=8
/report miniaipdf 注册转化率本周下降 15%`);
      return NextResponse.json({ ok: true });
    }

    // 未知命令
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
  if (!token) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
