/**
 * Agent 工具定义与执行器
 *
 * 每个 Agent 有专属工具集，允许 Claude 直接调用外部系统
 * 而不只是输出文字，由下游步骤去执行。
 *
 * 工具调用链：
 * executeStep(agent) → callClaudeWithTools(tools, executor)
 *   → Claude 决定调用哪个工具 → executor 执行 → 结果返回给 Claude
 *   → Claude 继续推理 → 最终输出文字报告
 */

import { prisma } from "@/lib/db";
import { ClaudeTool, ToolExecutor } from "@/lib/ai/claude-client";
import { publishToChannels } from "@/lib/channels/publisher";
import { ChannelId, PublishContent } from "@/lib/channels/types";
import { getShopifyClient } from "@/lib/integrations/shopify";
import { sendEmail, EMAIL_TEMPLATES, EmailTemplateKey } from "@/lib/integrations/gmail";
import {
  listConversations,
  getConversation,
  sendMessage as tidioSendMessage,
  closeConversation,
  getPendingConversationsSummary,
} from "@/lib/integrations/tidio";

// ==================== 工具定义（Claude 可调用的工具列表）====================

const TOOLS_PLAYFISH: ClaudeTool[] = [
  {
    name: "create_task",
    description: "创建一个新任务并存入任务系统。用于将目标拆解为可执行的具体工作项。",
    input_schema: {
      type: "object",
      properties: {
        title:       { type: "string",  description: "任务标题（简洁明确）" },
        description: { type: "string",  description: "任务详情和执行要求" },
        priority:    { type: "string",  description: "优先级：high / medium / low", enum: ["high", "medium", "low"] },
      },
      required: ["title"],
    },
  },
  {
    name: "get_metrics_summary",
    description: "获取最新的业务 KPI 数据，包括 MRR、用户数、API 调用量等。用于做数据驱动决策。",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "string", description: "查询最近多少天的数据，默认 7" },
      },
    },
  },
  {
    name: "send_notification",
    description: "通过 Telegram 发送通知消息给 Terry。用于汇报重要决策或需要关注的事项。",
    input_schema: {
      type: "object",
      properties: {
        message: { type: "string", description: "要发送的消息内容（支持 Markdown）" },
      },
      required: ["message"],
    },
  },
];

const TOOLS_PM01: ClaudeTool[] = [
  {
    name: "publish_twitter",
    description: "把内容发布到 Twitter/X。用于发布推文、产品更新、用户故事等社媒内容。自动截断到 280 字。",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "推文内容，不超过 280 字" },
      },
      required: ["text"],
    },
  },
  {
    name: "publish_wordpress",
    description: "将文章发布到 WordPress 博客。用于发布 SEO 长文、教程、产品更新文章等。",
    input_schema: {
      type: "object",
      properties: {
        title:   { type: "string", description: "文章标题" },
        content: { type: "string", description: "文章正文（支持 HTML）" },
        excerpt: { type: "string", description: "文章摘要（150字以内）" },
        tags:    { type: "string", description: "标签列表，逗号分隔，如: pdf, compress, tutorial" },
        status:  { type: "string", description: "发布状态: publish（直接发布）或 draft（草稿）", enum: ["publish", "draft"] },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "publish_telegram_channel",
    description: "发布内容到 Telegram 频道。用于推送博客更新、产品公告、使用技巧等。",
    input_schema: {
      type: "object",
      properties: {
        text:  { type: "string", description: "消息内容（支持 Markdown）" },
        title: { type: "string", description: "可选标题" },
      },
      required: ["text"],
    },
  },
  {
    name: "save_draft",
    description: "将内容保存为草稿到内容日历，等待审批后发布。用于需要人工审核的高价值内容。",
    input_schema: {
      type: "object",
      properties: {
        title:        { type: "string", description: "内容标题" },
        body:         { type: "string", description: "正文内容" },
        content_type: { type: "string", description: "内容类型: short_post / long_post / article", enum: ["short_post", "long_post", "article"] },
        channels:     { type: "string", description: "目标发布渠道，逗号分隔，如: twitter,wordpress,telegram_channel" },
      },
      required: ["title", "body"],
    },
  },
];

const TOOLS_DFM: ClaudeTool[] = [
  {
    name: "get_kpi_data",
    description: "从数据库查询 KPI 快照数据。用于分析业务趋势、对比目标、发现异常。",
    input_schema: {
      type: "object",
      properties: {
        metrics: { type: "string", description: "指标名称，逗号分隔。可选值: mrr, users, signups, pageviews, api_calls, active_subscriptions, gsc_clicks, gsc_impressions, ga_sessions" },
        days:    { type: "string", description: "查询最近多少天，默认 7" },
      },
    },
  },
  {
    name: "save_kpi_report",
    description: "将生成的日报/周报保存到内容日历，并可选择发送到 Telegram。",
    input_schema: {
      type: "object",
      properties: {
        report:      { type: "string", description: "报告完整内容" },
        report_type: { type: "string", description: "报告类型: daily / weekly", enum: ["daily", "weekly"] },
        send_telegram: { type: "string", description: "是否发送到 Telegram: yes / no", enum: ["yes", "no"] },
      },
      required: ["report", "report_type"],
    },
  },
];

const TOOLS_ADMIN01: ClaudeTool[] = [
  {
    name: "check_url_health",
    description: "检查指定 URL 的可访问性和响应时间。用于监控关键服务是否正常运行。",
    input_schema: {
      type: "object",
      properties: {
        url:     { type: "string",  description: "要检查的 URL，如 https://miniaipdf.com" },
        timeout: { type: "string",  description: "超时时间（毫秒），默认 5000" },
      },
      required: ["url"],
    },
  },
  {
    name: "create_alert",
    description: "创建一条系统告警并发送 Telegram 通知。用于报告异常情况、服务降级、数据异常等。",
    input_schema: {
      type: "object",
      properties: {
        message:  { type: "string", description: "告警详细描述" },
        severity: { type: "string", description: "严重等级: critical / warning / info", enum: ["critical", "warning", "info"] },
        source:   { type: "string", description: "告警来源，如: admin01, cron_hourly, stripe" },
      },
      required: ["message", "severity"],
    },
  },
  {
    name: "get_recent_errors",
    description: "查询最近的工作流错误日志，用于识别系统问题。",
    input_schema: {
      type: "object",
      properties: {
        hours: { type: "string", description: "查询最近多少小时内的错误，默认 24" },
        limit: { type: "string", description: "返回条数上限，默认 20" },
      },
    },
  },
];

// ==================== FurMates Shopify 工具 ====================

const TOOLS_FURMATES: ClaudeTool[] = [
  {
    name: "get_shopify_summary",
    description: "获取 FurMates Shopify 店铺的销售概览数据：订单数、营收、待发货数量等。",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "string", description: "统计最近多少天，默认 7" },
      },
    },
  },
  {
    name: "list_shopify_orders",
    description: "查询 Shopify 订单列表，支持按状态筛选。",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", description: "订单状态: open / closed / cancelled / any，默认 open", enum: ["open", "closed", "cancelled", "any"] },
        limit:  { type: "string", description: "返回条数上限，默认 20" },
      },
    },
  },
  {
    name: "get_shopify_order",
    description: "获取指定订单的完整详情，包含商品、客户、地址信息。",
    input_schema: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "Shopify 订单 ID" },
      },
      required: ["order_id"],
    },
  },
  {
    name: "fulfill_shopify_order",
    description: "将订单标记为已发货，可选填物流单号和承运商。",
    input_schema: {
      type: "object",
      properties: {
        order_id:          { type: "string", description: "Shopify 订单 ID" },
        tracking_number:   { type: "string", description: "物流单号（可选）" },
        tracking_company:  { type: "string", description: "承运商名称，如 UPS、FedEx（可选）" },
      },
      required: ["order_id"],
    },
  },
  {
    name: "search_shopify_customers",
    description: "按姓名、邮箱或手机号搜索客户。",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "搜索关键词" },
      },
      required: ["query"],
    },
  },
  {
    name: "tag_shopify_customer",
    description: "给客户添加标签，用于 Angel 客户计划等分层管理。已有标签会保留，只追加新标签。",
    input_schema: {
      type: "object",
      properties: {
        customer_id: { type: "string", description: "Shopify 客户 ID" },
        tags:        { type: "string", description: "要添加的标签，逗号分隔，如: angel-customer,vip" },
        note:        { type: "string", description: "客户备注（可选）" },
      },
      required: ["customer_id", "tags"],
    },
  },
  {
    name: "check_low_stock",
    description: "检查 FurMates 店铺中库存低于阈值的商品，用于补货预警。",
    input_schema: {
      type: "object",
      properties: {
        threshold: { type: "string", description: "库存阈值，低于此数量视为低库存，默认 10" },
      },
    },
  },
  {
    name: "list_shopify_products",
    description: "查看店铺产品列表，支持按状态筛选。",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", description: "产品状态: active / draft / archived，默认 active", enum: ["active", "draft", "archived"] },
        limit:  { type: "string", description: "返回条数，默认 20" },
      },
    },
  },

  // ── Gmail 邮件工具 ──────────────────────────────────────
  {
    name: "send_email_template",
    description: "通过 Gmail 向客户发送 FurMates 品牌邮件（使用预设模板）。用于欢迎邮件、优惠码推送、唤醒流失用户、Angel 客户奖励等。",
    input_schema: {
      type: "object",
      properties: {
        to:           { type: "string", description: "收件人邮箱" },
        template:     { type: "string", description: "模板名称: welcome / productIntro / limitedOffer / lastChance / wakeUp / angelWelcome", enum: ["welcome", "productIntro", "limitedOffer", "lastChance", "wakeUp", "angelWelcome"] },
        customer_name:{ type: "string", description: "客户姓名" },
        coupon_code:  { type: "string", description: "优惠码（可选，限时优惠和 Angel 邮件适用）" },
        product_url:  { type: "string", description: "产品链接（可选）" },
        store_url:    { type: "string", description: "店铺链接（可选）" },
      },
      required: ["to", "template", "customer_name"],
    },
  },
  {
    name: "send_custom_email",
    description: "通过 Gmail 发送自定义 HTML 邮件给指定客户。用于需要个性化内容的场景。",
    input_schema: {
      type: "object",
      properties: {
        to:      { type: "string", description: "收件人邮箱" },
        subject: { type: "string", description: "邮件主题" },
        html:    { type: "string", description: "邮件正文 HTML" },
        text:    { type: "string", description: "纯文本备用版本（可选）" },
      },
      required: ["to", "subject", "html"],
    },
  },

  // ── Tidio 客服工具 ──────────────────────────────────────
  {
    name: "list_tidio_conversations",
    description: "查看 Tidio 客服对话列表，支持按状态筛选。用于监控未回复的客户咨询。",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", description: "对话状态: open / solved / pending，默认 open", enum: ["open", "solved", "pending"] },
        limit:  { type: "string", description: "返回条数，默认 10" },
      },
    },
  },
  {
    name: "get_tidio_conversation",
    description: "获取指定 Tidio 对话的完整消息记录，用于了解客户问题详情后再回复。",
    input_schema: {
      type: "object",
      properties: {
        conversation_id: { type: "string", description: "Tidio 对话 ID" },
      },
      required: ["conversation_id"],
    },
  },
  {
    name: "reply_tidio_conversation",
    description: "以客服身份回复 Tidio 对话中的客户。用于处理咨询、投诉、售后问题。",
    input_schema: {
      type: "object",
      properties: {
        conversation_id: { type: "string", description: "Tidio 对话 ID" },
        message:         { type: "string", description: "回复内容" },
      },
      required: ["conversation_id", "message"],
    },
  },
  {
    name: "close_tidio_conversation",
    description: "将 Tidio 对话标记为已解决（solved）。问题处理完毕后使用。",
    input_schema: {
      type: "object",
      properties: {
        conversation_id: { type: "string", description: "Tidio 对话 ID" },
      },
      required: ["conversation_id"],
    },
  },
  {
    name: "get_tidio_summary",
    description: "获取 Tidio 客服概览：未处理对话数量和最新消息预览。用于日报中的客服状态汇总。",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
];

// 按 agentId 获取工具列表
export function getAgentTools(agentId: string): ClaudeTool[] {
  const toolMap: Record<string, ClaudeTool[]> = {
    playfish: TOOLS_PLAYFISH,
    pm01:     TOOLS_PM01,
    "pm01-b": TOOLS_PM01,  // 复用 PM01 工具（中文内容）
    dfm:      TOOLS_DFM,
    admin01:  TOOLS_ADMIN01,
    furmates: TOOLS_FURMATES,
  };
  return toolMap[agentId] ?? [];
}

// 按 agentId 获取推荐模型（内容创作用 sonnet，其他用 haiku）
export function getAgentModel(agentId: string): "claude-haiku-4-5-20251001" | "claude-sonnet-4-6" {
  const contentAgents = ["pm01", "pm01-b"];
  return contentAgents.includes(agentId) ? "claude-sonnet-4-6" : "claude-haiku-4-5-20251001";
}

// ==================== 工具执行器 ====================

async function sendTelegramHelper(text: string): Promise<boolean> {
  let token  = process.env.TELEGRAM_BOT_TOKEN;
  let chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    try {
      const cred = await prisma.channelCredential.findUnique({ where: { channelId: "telegram_notification" } });
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
      body: JSON.stringify({ chat_id: chatId, text: `🤖 *Jarvis*\n\n${text}`, parse_mode: "Markdown" }),
    });
    return res.ok;
  } catch { return false; }
}

/**
 * 创建指定 Agent 的工具执行器
 * @param agentId Agent ID（用于权限范围控制）
 * @param logFn   可选的日志回调（workflow-engine 传入）
 */
export function createToolExecutor(
  agentId: string,
  logFn?: (toolName: string, result: string) => void
): ToolExecutor {
  return async (name: string, input: Record<string, unknown>): Promise<string> => {
    logFn?.(name, `调用工具: ${name}`);

    try {
      // ── Playfish / 通用工具 ─────────────────────────────────
      if (name === "create_task") {
        const task = await prisma.task.create({
          data: {
            title:       String(input.title       ?? "新任务"),
            description: String(input.description ?? ""),
            priority:    String(input.priority    ?? "medium"),
            status:      "todo",
          },
        });
        return `任务已创建，ID: ${task.id}，标题: "${task.title}"`;
      }

      if (name === "get_metrics_summary") {
        const days = parseInt(String(input.days ?? "7"), 10);
        const since = new Date(Date.now() - days * 86400_000);
        const snapshots = await prisma.kpiSnapshot.findMany({
          where: { date: { gte: since } },
          orderBy: { date: "desc" },
          take: 50,
        });
        if (snapshots.length === 0) return "暂无 KPI 数据。请先配置 Stripe/GA/GSC 集成并运行日报 Cron。";
        const grouped = snapshots.reduce<Record<string, number[]>>((acc, s) => {
          if (!acc[s.metric]) acc[s.metric] = [];
          acc[s.metric].push(s.value);
          return acc;
        }, {});
        const summary = Object.entries(grouped)
          .map(([metric, vals]) => `${metric}: 最新=${vals[0].toFixed(2)}, 均值=${(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2)}`)
          .join("\n");
        return `最近 ${days} 天 KPI 摘要:\n${summary}`;
      }

      if (name === "send_notification") {
        const msg = String(input.message ?? "");
        const sent = await sendTelegramHelper(msg);
        return sent ? "Telegram 通知发送成功" : "Telegram 发送失败（请检查 TELEGRAM_BOT_TOKEN 配置）";
      }

      // ── PM01 工具 ───────────────────────────────────────────
      if (name === "publish_twitter") {
        const text = String(input.text ?? "").slice(0, 280);
        const content: PublishContent = { body: text };
        const results = await publishToChannels(["twitter"], content);
        const r = results[0];
        if (r.success) return `Twitter 发布成功${r.postUrl ? `，链接: ${r.postUrl}` : ""}`;
        return `Twitter 发布失败: ${r.error}`;
      }

      if (name === "publish_wordpress") {
        const content: PublishContent = {
          title:   String(input.title   ?? ""),
          body:    String(input.content ?? ""),
          summary: String(input.excerpt ?? ""),
          tags:    String(input.tags    ?? "").split(",").map(t => t.trim()).filter(Boolean),
          metadata: { status: String(input.status ?? "draft") },
        };
        const results = await publishToChannels(["wordpress"], content);
        const r = results[0];
        if (r.success) return `WordPress 发布成功${r.postUrl ? `，链接: ${r.postUrl}` : ""}`;
        return `WordPress 发布失败: ${r.error}`;
      }

      if (name === "publish_telegram_channel") {
        const content: PublishContent = {
          title: String(input.title ?? ""),
          body:  String(input.text  ?? ""),
        };
        const results = await publishToChannels(["telegram_channel"], content);
        const r = results[0];
        if (r.success) return `Telegram 频道发布成功${r.postUrl ? `，链接: ${r.postUrl}` : ""}`;
        return `Telegram 频道发布失败: ${r.error}`;
      }

      if (name === "save_draft") {
        const channels = String(input.channels ?? "").split(",").map(s => s.trim()).filter(Boolean);
        const record = await prisma.contentCalendar.create({
          data: {
            title:       String(input.title ?? ""),
            body:        String(input.body  ?? ""),
            contentType: String(input.content_type ?? "short_post"),
            status:      "draft",
            channelIds:  JSON.stringify(channels),
          },
        });
        return `草稿已保存，ID: ${record.id}，标题: "${record.title}"，等待审批后发布`;
      }

      // ── DFM 工具 ───────────────────────────────────────────
      if (name === "get_kpi_data") {
        const days = parseInt(String(input.days ?? "7"), 10);
        const since = new Date(Date.now() - days * 86400_000);
        const requestedMetrics = String(input.metrics ?? "").split(",").map(m => m.trim()).filter(Boolean);

        const where = requestedMetrics.length > 0
          ? { date: { gte: since }, metric: { in: requestedMetrics } }
          : { date: { gte: since } };

        const snapshots = await prisma.kpiSnapshot.findMany({
          where,
          orderBy: [{ metric: "asc" }, { date: "desc" }],
          take: 200,
        });

        if (snapshots.length === 0) return "查询范围内无 KPI 数据。";

        const lines = snapshots.map(s =>
          `${s.date.toISOString().split("T")[0]} | ${s.metric}: ${s.value.toFixed(2)}${s.delta ? ` (${s.delta > 0 ? "+" : ""}${s.delta.toFixed(2)})` : ""}`
        );
        return `${lines.length} 条 KPI 记录:\n${lines.join("\n")}`;
      }

      if (name === "save_kpi_report") {
        const report      = String(input.report      ?? "");
        const reportType  = String(input.report_type ?? "daily");
        const sendTg      = String(input.send_telegram ?? "no") === "yes";

        await prisma.contentCalendar.create({
          data: {
            title:       `${reportType === "weekly" ? "周报" : "日报"} - ${new Date().toISOString().split("T")[0]}`,
            body:        report,
            contentType: "long_post",
            status:      "published",
            publishedAt: new Date(),
            channelIds:  JSON.stringify(["telegram_channel"]),
          },
        });

        if (sendTg) {
          const preview = report.length > 3000 ? report.slice(0, 3000) + "\n...[已截断]" : report;
          await sendTelegramHelper(preview);
        }

        return `${reportType === "weekly" ? "周报" : "日报"}已保存${sendTg ? "并发送到 Telegram" : "，未发送 Telegram"}`;
      }

      // ── Admin01 工具 ────────────────────────────────────────
      if (name === "check_url_health") {
        const url     = String(input.url     ?? "");
        const timeout = parseInt(String(input.timeout ?? "5000"), 10);

        if (!url) return "ERROR: url 参数不能为空";

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        const startMs = Date.now();

        try {
          const res = await fetch(url, { method: "HEAD", signal: controller.signal });
          clearTimeout(timer);
          const ms = Date.now() - startMs;
          if (res.ok || res.status < 500) {
            return `✅ ${url} 正常 | HTTP ${res.status} | 响应时间 ${ms}ms`;
          }
          return `⚠️ ${url} 异常 | HTTP ${res.status} | 响应时间 ${ms}ms`;
        } catch (err) {
          clearTimeout(timer);
          const ms = Date.now() - startMs;
          const msg = err instanceof Error ? err.message : "请求失败";
          return `❌ ${url} 不可达 | ${msg} | 超时 ${ms}ms`;
        }
      }

      if (name === "create_alert") {
        const message  = String(input.message  ?? "");
        const severity = String(input.severity ?? "warning");
        const source   = String(input.source   ?? agentId);

        await prisma.alert.create({
          data: { message, severity, source, status: "new" },
        });

        const emoji = severity === "critical" ? "🚨" : severity === "warning" ? "⚠️" : "ℹ️";
        await sendTelegramHelper(`${emoji} *[${severity.toUpperCase()}]* ${message}\n来源: ${source}`);

        return `告警已创建并通知 Telegram，级别: ${severity}`;
      }

      if (name === "get_recent_errors") {
        const hours = parseInt(String(input.hours ?? "24"), 10);
        const limit = parseInt(String(input.limit ?? "20"), 10);
        const since = new Date(Date.now() - hours * 3600_000);

        const errors = await prisma.workflowLog.findMany({
          where:   { level: "error", createdAt: { gte: since } },
          orderBy: { createdAt: "desc" },
          take:    limit,
        });

        if (errors.length === 0) return `最近 ${hours} 小时内无错误日志 ✅`;

        const lines = errors.map(e =>
          `[${e.createdAt.toISOString().slice(11, 19)}] Run ${e.runId.slice(-6)} | ${e.message}`
        );
        return `最近 ${hours}h 内 ${errors.length} 条错误:\n${lines.join("\n")}`;
      }

      // ── FurMates Shopify 工具 ───────────────────────────────
      if (name === "get_shopify_summary") {
        const shopify = await getShopifyClient();
        if (!shopify) return "ERROR: Shopify 未配置（请在 Settings → Channels 添加 shopify 渠道凭证或设置 SHOPIFY_SHOP_DOMAIN + SHOPIFY_ACCESS_TOKEN）";
        const days    = parseInt(String(input.days ?? "7"), 10);
        const summary = await shopify.getOrderSummary(days);
        return `FurMates 最近 ${days} 天销售摘要：\n` +
          `订单数: ${summary.totalOrders}\n` +
          `总营收: ${summary.currency} ${summary.totalRevenue}\n` +
          `均单价: ${summary.currency} ${summary.avgOrderValue}\n` +
          `待发货: ${summary.pendingFulfillment} 单`;
      }

      if (name === "list_shopify_orders") {
        const shopify = await getShopifyClient();
        if (!shopify) return "ERROR: Shopify 未配置";
        const { orders } = await shopify.listOrders({
          status: String(input.status ?? "open"),
          limit:  parseInt(String(input.limit ?? "20"), 10),
        });
        if (!orders.length) return "没有找到符合条件的订单";
        const lines = orders.map(o =>
          `#${o.order_number} | ${o.email} | ${o.currency} ${o.total_price} | 支付:${o.financial_status} | 发货:${o.fulfillment_status ?? "未发货"}`
        );
        return `${orders.length} 条订单:\n${lines.join("\n")}`;
      }

      if (name === "get_shopify_order") {
        const shopify = await getShopifyClient();
        if (!shopify) return "ERROR: Shopify 未配置";
        const { order } = await shopify.getOrder(String(input.order_id ?? ""));
        const items = order.line_items.map(i => `  - ${i.title} ×${i.quantity} @ ${i.price}`).join("\n");
        return `订单 #${order.order_number}:\n` +
          `客户: ${order.email}\n` +
          `金额: ${order.currency} ${order.total_price}\n` +
          `支付: ${order.financial_status} | 发货: ${order.fulfillment_status ?? "未发货"}\n` +
          `商品:\n${items}`;
      }

      if (name === "fulfill_shopify_order") {
        const shopify = await getShopifyClient();
        if (!shopify) return "ERROR: Shopify 未配置";
        await shopify.fulfillOrder(String(input.order_id ?? ""), {
          tracking_number:  input.tracking_number  ? String(input.tracking_number)  : undefined,
          tracking_company: input.tracking_company ? String(input.tracking_company) : undefined,
        });
        return `✅ 订单 ${input.order_id} 已标记发货${input.tracking_number ? `，物流单号: ${input.tracking_number}` : ""}`;
      }

      if (name === "search_shopify_customers") {
        const shopify = await getShopifyClient();
        if (!shopify) return "ERROR: Shopify 未配置";
        const { customers } = await shopify.searchCustomers(String(input.query ?? ""));
        if (!customers.length) return "未找到匹配客户";
        const lines = customers.map(c =>
          `ID:${c.id} | ${c.first_name} ${c.last_name} | ${c.email} | 订单数:${c.orders_count} | 消费:${c.total_spent} | 标签:${c.tags || "无"}`
        );
        return `找到 ${customers.length} 个客户:\n${lines.join("\n")}`;
      }

      if (name === "tag_shopify_customer") {
        const shopify    = await getShopifyClient();
        if (!shopify) return "ERROR: Shopify 未配置";
        const customerId = String(input.customer_id ?? "");
        const newTags    = String(input.tags ?? "").split(",").map(t => t.trim()).filter(Boolean);

        // 先获取现有标签，追加而不是覆盖
        const { customer } = await shopify.getCustomer(customerId);
        const existingTags = customer.tags ? customer.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
        const mergedTags   = [...new Set([...existingTags, ...newTags])].join(", ");

        const updateData: Record<string, string> = { tags: mergedTags };
        if (input.note) updateData.note = String(input.note);

        await shopify.updateCustomer(customerId, updateData as Parameters<typeof shopify.updateCustomer>[1]);
        return `✅ 客户 ${customer.first_name} ${customer.last_name}（${customer.email}）标签已更新: ${mergedTags}`;
      }

      if (name === "check_low_stock") {
        const shopify   = await getShopifyClient();
        if (!shopify) return "ERROR: Shopify 未配置";
        const threshold = parseInt(String(input.threshold ?? "10"), 10);
        const { inventory_levels } = await shopify.getInventoryLevels();
        const low = inventory_levels.filter(l => l.available <= threshold);
        if (!low.length) return `✅ 所有商品库存均高于 ${threshold} 件`;
        const lines = low.map(l => `商品ID:${l.inventory_item_id} | 库存:${l.available} 件`);
        return `⚠️ ${low.length} 个商品库存低于 ${threshold} 件:\n${lines.join("\n")}`;
      }

      if (name === "list_shopify_products") {
        const shopify = await getShopifyClient();
        if (!shopify) return "ERROR: Shopify 未配置";
        const { products } = await shopify.listProducts({
          status: String(input.status ?? "active"),
          limit:  parseInt(String(input.limit ?? "20"), 10),
        });
        if (!products.length) return "没有找到产品";
        const lines = products.map(p =>
          `ID:${p.id} | ${p.title} | ${p.status} | 变体数:${p.variants.length}`
        );
        return `${products.length} 个产品:\n${lines.join("\n")}`;
      }

      // ── Gmail 邮件工具 ─────────────────────────────────────
      if (name === "send_email_template") {
        const to           = String(input.to            ?? "");
        const templateKey  = String(input.template      ?? "") as EmailTemplateKey;
        const customerName = String(input.customer_name ?? "there");
        const couponCode   = input.coupon_code  ? String(input.coupon_code)  : undefined;
        const productUrl   = input.product_url  ? String(input.product_url)  : undefined;
        const storeUrl     = input.store_url    ? String(input.store_url)    : undefined;

        if (!to) return "ERROR: to（收件人）不能为空";
        if (!(templateKey in EMAIL_TEMPLATES)) {
          return `ERROR: 未知模板 "${templateKey}"，可选: welcome, productIntro, limitedOffer, lastChance, wakeUp, angelWelcome`;
        }

        const vars    = { name: customerName, email: to, couponCode, productUrl, storeUrl };
        const tplFn   = EMAIL_TEMPLATES[templateKey] as (v: typeof vars) => { subject: string; html: string };
        const { subject, html } = tplFn(vars);
        const result  = await sendEmail({ to, subject, html });
        return `✅ 邮件已发送 → ${to}，主题: "${subject}"，Message ID: ${result.messageId}`;
      }

      if (name === "send_custom_email") {
        const to      = String(input.to      ?? "");
        const subject = String(input.subject ?? "");
        const html    = String(input.html    ?? "");
        const text    = input.text ? String(input.text) : undefined;

        if (!to || !subject || !html) return "ERROR: to、subject、html 均为必填";

        const result = await sendEmail({ to, subject, html, text });
        return `✅ 自定义邮件已发送 → ${to}，Message ID: ${result.messageId}`;
      }

      // ── Tidio 客服工具 ─────────────────────────────────────
      if (name === "list_tidio_conversations") {
        const status = String(input.status ?? "open") as "open" | "solved" | "pending";
        const limit  = parseInt(String(input.limit ?? "10"), 10);
        const { conversations, total } = await listConversations({ status, limit });
        if (!conversations.length) return `没有 ${status} 状态的对话`;
        const lines = conversations.map(c => {
          const lastMsg = c.messages?.[c.messages.length - 1];
          const preview = lastMsg?.message?.slice(0, 80) ?? "(无消息)";
          return `ID:${c.id} | ${c.contact?.email ?? "Unknown"} | "${preview}" | ${c.updated_at.slice(0, 10)}`;
        });
        return `共 ${total} 条 ${status} 对话，显示 ${conversations.length} 条:\n${lines.join("\n")}`;
      }

      if (name === "get_tidio_conversation") {
        const conv = await getConversation(String(input.conversation_id ?? ""));
        const msgs = (conv.messages ?? []).slice(-10).map(m =>
          `[${m.created_at.slice(11, 16)}] ${m.author.type === "visitor" ? "客户" : "客服"}: ${m.message}`
        );
        return `对话 ${conv.id}（${conv.status}）\n` +
          `客户: ${conv.contact?.email ?? conv.contact?.name ?? "Unknown"}\n` +
          `最近消息:\n${msgs.join("\n")}`;
      }

      if (name === "reply_tidio_conversation") {
        const msg = await tidioSendMessage(
          String(input.conversation_id ?? ""),
          String(input.message ?? "")
        );
        return `✅ 回复已发送，Message ID: ${msg.id}`;
      }

      if (name === "close_tidio_conversation") {
        await closeConversation(String(input.conversation_id ?? ""));
        return `✅ 对话 ${input.conversation_id} 已标记为已解决`;
      }

      if (name === "get_tidio_summary") {
        const summary = await getPendingConversationsSummary();
        const topLines = summary.topMessages.map(m =>
          `  • ${m.contact}: "${m.preview}" (${m.created_at.slice(0, 10)})`
        );
        return `Tidio 客服概览:\n` +
          `待处理: ${summary.openCount} open / ${summary.pendingCount} pending\n` +
          `最新对话:\n${topLines.join("\n")}`;
      }

      return `ERROR: 未知工具 "${name}"`;
    } catch (err) {
      const message = err instanceof Error ? err.message : "工具执行异常";
      return `ERROR: ${message}`;
    }
  };
}
