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

// 按 agentId 获取工具列表
export function getAgentTools(agentId: string): ClaudeTool[] {
  const toolMap: Record<string, ClaudeTool[]> = {
    playfish: TOOLS_PLAYFISH,
    pm01:     TOOLS_PM01,
    "pm01-b": TOOLS_PM01,  // 复用 PM01 工具（中文内容）
    dfm:      TOOLS_DFM,
    admin01:  TOOLS_ADMIN01,
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

      return `ERROR: 未知工具 "${name}"`;
    } catch (err) {
      const message = err instanceof Error ? err.message : "工具执行异常";
      return `ERROR: ${message}`;
    }
  };
}
