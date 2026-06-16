import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendTelegram } from "@/lib/telegram";
import { fetchKeleSummary, formatKeleBriefingLines } from "@/lib/integrations/kele";
import { fetchTopNews, formatNewsLines } from "@/lib/integrations/news";

export const maxDuration = 60;

const SEVERITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const SEVERITY_EMOJI: Record<string, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🔵",
};

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    const [newInsights, pendingPlans, recentMissions] = await Promise.all([
      // 过去 7 天新发现的 insights，按严重程度排序
      prisma.insight.findMany({
        where: {
          status: { in: ["new", "acknowledged"] },
          createdAt: { gte: sevenDaysAgo },
        },
        include: { project: { select: { name: true, emoji: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      // 待审批的 Plans
      prisma.plan.findMany({
        where: { status: "pending" },
        include: { project: { select: { name: true, emoji: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      // 过去 24 小时完成的 Missions
      prisma.mission.findMany({
        where: {
          status: { in: ["succeeded", "failed"] },
          completedAt: { gte: oneDayAgo },
        },
        include: {
          project: { select: { name: true, emoji: true } },
          plan: { select: { objective: true } },
        },
        orderBy: { completedAt: "desc" },
        take: 10,
      }),
    ]);

    // 按严重程度排序 insights，取前 5
    const rankedInsights = [...newInsights].sort(
      (a, b) =>
        (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0)
    );

    const today = now.toLocaleDateString("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const lines: string[] = [];
    lines.push(`☀️ *JarMC 晨报 · ${today}*`);
    lines.push("");

    // ——— 关键洞察（最多 5 条） ———
    lines.push("*📊 关键洞察*");
    if (rankedInsights.length > 0) {
      for (const insight of rankedInsights.slice(0, 5)) {
        const emoji = SEVERITY_EMOJI[insight.severity] ?? "⚪";
        const proj = insight.project
          ? `${insight.project.emoji} ${insight.project.name}`
          : "平台";
        const title = insight.titleZh || insight.title;
        const truncated = title.length > 55 ? title.slice(0, 55) + "…" : title;
        lines.push(`${emoji} *${proj}* — ${truncated}`);
      }
    } else {
      lines.push("🟢 无新洞察，系统运行正常");
    }

    lines.push("");

    // ——— 待审批 Plans ———
    if (pendingPlans.length > 0) {
      lines.push(`*⏳ 待审批计划（${pendingPlans.length}个）*`);
      for (const plan of pendingPlans.slice(0, 3)) {
        const proj = plan.project
          ? `${plan.project.emoji} ${plan.project.name}`
          : "平台";
        const obj =
          plan.objective.length > 50
            ? plan.objective.slice(0, 50) + "…"
            : plan.objective;
        lines.push(`⏳ *${proj}* — ${obj} (风险 ${plan.riskLevel}/5)`);
      }
      if (pendingPlans.length > 3) {
        lines.push(`_…还有 ${pendingPlans.length - 3} 个待审批_`);
      }
    }

    // ——— 昨日完成 ———
    if (recentMissions.length > 0) {
      lines.push("");
      lines.push("*✅ 昨日任务*");
      const succeeded = recentMissions.filter((m) => m.status === "succeeded");
      const failed = recentMissions.filter((m) => m.status === "failed");
      for (const mission of succeeded.slice(0, 3)) {
        const proj = mission.project
          ? `${mission.project.emoji} ${mission.project.name}`
          : "平台";
        const obj =
          mission.plan.objective.length > 50
            ? mission.plan.objective.slice(0, 50) + "…"
            : mission.plan.objective;
        lines.push(`✅ *${proj}* — ${obj}`);
      }
      for (const mission of failed.slice(0, 2)) {
        const proj = mission.project
          ? `${mission.project.emoji} ${mission.project.name}`
          : "平台";
        const obj =
          mission.plan.objective.length > 45
            ? mission.plan.objective.slice(0, 45) + "…"
            : mission.plan.objective;
        lines.push(`❌ *${proj}* — ${obj}`);
      }
    }

    // ——— 可乐量化组合（L0 监控简报；只读，可乐故障不打断晨报）———
    try {
      const kele = await fetchKeleSummary();
      if (kele) {
        lines.push("");
        lines.push(...formatKeleBriefingLines(kele));
      }
    } catch (err) {
      console.error("[Cron Briefing] 可乐摘要失败:", err);
    }

    // ——— 市场要闻（免费 Google News RSS；只读情境，绝不进交易决策；失败不打断简报）———
    try {
      const news = await fetchTopNews(4);
      if (news.length) {
        lines.push("");
        lines.push(...formatNewsLines(news));
      }
    } catch (err) {
      console.error("[Cron Briefing] 市场要闻失败:", err);
    }

    lines.push("");
    lines.push(
      `_${now.toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit" })} · Jarvis Mission Control_`
    );

    const message = lines.join("\n");
    const sent = await sendTelegram(message);

    console.log(
      `[Cron Briefing] 晨报发送${sent ? "成功" : "失败"}，insights=${rankedInsights.length}，pendingPlans=${pendingPlans.length}，missions=${recentMissions.length}`
    );

    return NextResponse.json({
      ok: true,
      sent,
      stats: {
        insights: rankedInsights.length,
        pendingPlans: pendingPlans.length,
        recentMissions: recentMissions.length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Cron Briefing] 错误:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
