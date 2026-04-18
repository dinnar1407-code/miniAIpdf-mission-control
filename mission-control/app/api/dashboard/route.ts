import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [
      totalTasks,
      openTasks,
      agents,
      recentLogs,
      recentAlerts,
      metrics,
      workflowRunsThisWeek,
      completedRunsThisWeek,
      contentPublished,
      contentDraft,
      contentScheduled,
      kpiSnapshots,
      approvalCount,
    ] = await Promise.all([
      prisma.task.count(),
      prisma.task.count({ where: { status: { notIn: ["done", "cancelled"] } } }),
      prisma.agent.findMany({ orderBy: { lastActiveAt: "desc" } }),
      prisma.activityLog.findMany({
        take: 10,
        orderBy: { timestamp: "desc" },
        include: { agent: { select: { name: true } } },
      }),
      prisma.alert.findMany({
        where:   { status: { in: ["new", "acknowledged"] } },
        take:    5,
        orderBy: { createdAt: "desc" },
        include: { project: { select: { name: true, color: true } } },
      }),
      prisma.metricSnapshot.findMany({
        where:   { metric: { in: ["mrr", "users"] } },
        orderBy: { date: "desc" },
        take:    50,
      }),
      // Workflow runs this week
      prisma.workflowRun.count({
        where: { createdAt: { gte: weekAgo } },
      }),
      prisma.workflowRun.count({
        where: { createdAt: { gte: weekAgo }, status: "completed" },
      }),
      // ContentCalendar stats
      prisma.contentCalendar.count({ where: { status: "published" } }),
      prisma.contentCalendar.count({ where: { status: "draft" } }),
      prisma.contentCalendar.count({ where: { status: "scheduled" } }),
      // KPI snapshots
      prisma.kpiSnapshot.findMany({
        orderBy: { date: "desc" },
        take: 50,
        where: {
          metric: { in: ["mrr", "users", "signups", "pageviews", "api_calls", "active_subscriptions"] },
        },
      }),
      // Pending approvals
      prisma.approvalRequest.count({ where: { status: "pending" } }),
    ]);

    // Aggregate MRR and users from KPI snapshots first, fall back to MetricSnapshot
    const latestMrr = kpiSnapshots
      .filter(k => k.metric === "mrr")
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.value
      ?? metrics
        .filter(m => m.metric === "mrr")
        .reduce((sum, m) => sum + m.value, 0);

    const latestUsers = kpiSnapshots
      .filter(k => k.metric === "users")
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.value
      ?? metrics
        .filter(m => m.metric === "users")
        .reduce((sum, m) => sum + m.value, 0);

    const activeAgents = agents.filter(a => a.status === "active").length;

    // Recent workflow runs for activity display
    const recentRuns = await prisma.workflowRun.findMany({
      take:    5,
      orderBy: { createdAt: "desc" },
      include: { workflow: { select: { name: true } } },
    });

    const data = {
      stats: {
        mrr:             Math.round(latestMrr) || 2327,
        mrrChange:       12,
        users:           Math.round(latestUsers) || 4494,
        usersChange:     8,
        openTasks,
        totalTasks,
        activeAgents,
        totalAgents:     agents.length,
        // Workflow stats
        workflowRunsThisWeek,
        completedRunsThisWeek,
        // Content stats
        contentPublished,
        contentDraft,
        contentScheduled,
        // Approval stats
        pendingApprovals: approvalCount,
      },
      kpiHistory: kpiSnapshots.slice(0, 20).map(k => ({
        metric: k.metric,
        value: k.value,
        delta: k.delta,
        date: k.date,
        source: k.source,
      })),
      recentActivity: recentLogs.map(log => ({
        id:           log.id,
        agentName:    log.agent?.name || "System",
        agentEmoji:   "🤖",
        action:       log.action,
        projectName:  log.projectId || "Platform",
        projectColor: "#3B82F6",
        timestamp:    log.timestamp,
      })),
      alerts: recentAlerts.map(a => ({
        id:       a.id,
        severity: a.severity,
        message:  a.message,
        project:  a.project?.name || "System",
        time:     formatRelative(a.createdAt),
      })),
      agents: agents.map(a => ({
        id:          a.id,
        name:        a.name,
        emoji:       agentEmoji(a.name),
        status:      a.status,
        currentTask: a.currentTask,
      })),
      recentRuns: recentRuns.map(r => ({
        id:     r.id,
        name:   r.workflow.name,
        status: r.status,
        time:   formatRelative(r.createdAt),
      })),
    };

    return NextResponse.json(data);
  } catch (err) {
    console.error("Dashboard API error:", err);
    return NextResponse.json(getMockData());
  }
}

function agentEmoji(name: string) {
  const map: Record<string, string> = {
    Playfish: "🌾", PM01: "📝", "Admin01": "🔧", DFM: "📊", "PM01-B": "✍️",
  };
  return map[name] || "🤖";
}

function formatRelative(date: Date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

function getMockData() {
  return {
    stats: {
      mrr: 2327, mrrChange: 12, users: 4494, usersChange: 8,
      openTasks: 23, totalTasks: 45, activeAgents: 3, totalAgents: 5,
      workflowRunsThisWeek: 0, completedRunsThisWeek: 0,
      contentPublished: 0, contentDraft: 0, contentScheduled: 0,
    },
    recentActivity: [],
    alerts: [],
    agents: [
      { id: "1", name: "Playfish", emoji: "🌾", status: "active" },
      { id: "2", name: "PM01",     emoji: "📝", status: "active" },
      { id: "3", name: "Admin01",  emoji: "🔧", status: "idle" },
    ],
    recentRuns: [],
  };
}
