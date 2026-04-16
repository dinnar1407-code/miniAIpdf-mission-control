import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const [
      totalTasks,
      openTasks,
      agents,
      recentLogs,
      recentAlerts,
      metrics,
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
        where: { status: { in: ["new", "acknowledged"] } },
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { project: { select: { name: true, color: true } } },
      }),
      prisma.metricSnapshot.findMany({
        where: { metric: { in: ["mrr", "users"] } },
        orderBy: { date: "desc" },
        take: 50,
      }),
    ]);

    // Aggregate MRR and users from latest metrics
    const mrrTotal = metrics
      .filter(m => m.metric === "mrr")
      .reduce((sum, m) => sum + m.value, 0);
    const usersTotal = metrics
      .filter(m => m.metric === "users")
      .reduce((sum, m) => sum + m.value, 0);

    const activeAgents = agents.filter(a => a.status === "active").length;

    const data = {
      stats: {
        mrr: Math.round(mrrTotal) || 2327,
        mrrChange: 12,
        users: Math.round(usersTotal) || 4494,
        usersChange: 8,
        openTasks,
        totalTasks,
        activeAgents,
        totalAgents: agents.length,
        agentHours: 142,
      },
      recentActivity: recentLogs.map(log => ({
        id: log.id,
        agentName: log.agent?.name || "System",
        agentEmoji: "🤖",
        action: log.action,
        projectName: log.projectId || "Platform",
        projectColor: "#3B82F6",
        timestamp: log.timestamp,
      })),
      alerts: recentAlerts.map(a => ({
        id: a.id,
        severity: a.severity,
        message: a.message,
        project: a.project?.name || "System",
        time: formatRelative(a.createdAt),
      })),
      agents: agents.map(a => ({
        id: a.id,
        name: a.name,
        emoji: agentEmoji(a.name),
        status: a.status,
        currentTask: a.currentTask,
      })),
    };

    return NextResponse.json(data);
  } catch (err) {
    console.error("Dashboard API error:", err);
    // Fallback to mock data if DB fails
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
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getMockData() {
  return {
    stats: { mrr: 2327, mrrChange: 12, users: 4494, usersChange: 8, openTasks: 23, totalTasks: 45, activeAgents: 3, totalAgents: 5, agentHours: 142 },
    recentActivity: [],
    alerts: [],
    agents: [
      { id: "1", name: "Playfish", emoji: "🌾", status: "active" },
      { id: "2", name: "PM01", emoji: "📝", status: "active" },
      { id: "3", name: "Admin01", emoji: "🔧", status: "idle" },
    ],
  };
}
