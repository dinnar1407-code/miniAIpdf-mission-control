import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/agents/stats
// 返回所有 Agent 的聚合统计数据（任务数、内容数、近期活动、workflow runs）
export async function GET() {
  try {
    // 1. 所有 agent 基础信息（含项目分配）
    const agents = await prisma.agent.findMany({
      include: {
        agentAssignments: { include: { project: true } },
      },
      orderBy: { name: "asc" },
    });

    // 2. 每个 agent 完成的任务数
    const taskCounts = await prisma.task.groupBy({
      by: ["agentId"],
      where: { status: { in: ["done", "completed"] } },
      _count: { id: true },
    });
    const taskMap = Object.fromEntries(
      taskCounts.map(t => [t.agentId, t._count.id])
    );

    // 3. 每个 agent 发布的内容数
    const contentCounts = await prisma.contentItem.groupBy({
      by: ["agentId"],
      where: { status: "published" },
      _count: { id: true },
    });
    const contentMap = Object.fromEntries(
      contentCounts.map(c => [c.agentId, c._count.id])
    );

    // 4. 每个 agent 最近 5 条活动日志
    const allLogs = await prisma.activityLog.findMany({
      where: { agentId: { not: null } },
      orderBy: { timestamp: "desc" },
      take: 100, // 取最近 100 条，前端按 agent 分组
    });

    // 按 agentId 分组，每个 agent 取最近 5 条
    const logMap: Record<string, typeof allLogs> = {};
    for (const log of allLogs) {
      if (!log.agentId) continue;
      if (!logMap[log.agentId]) logMap[log.agentId] = [];
      if (logMap[log.agentId].length < 5) logMap[log.agentId].push(log);
    }

    // 5. workflow run 统计（本周触发的）
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const recentRuns = await prisma.workflowRun.findMany({
      where: { createdAt: { gte: weekAgo } },
      select: { id: true, status: true, workflow: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // 6. 全局 ContentCalendar 已发布数（不分 agent）
    const publishedCount = await prisma.contentCalendar.count({
      where: { status: "published" },
    });

    // 组装结果
    const result = agents.map(agent => ({
      id:          agent.id,
      name:        agent.name,
      type:        agent.type,
      status:      agent.status,
      currentTask: agent.currentTask,
      lastActiveAt: agent.lastActiveAt,
      config:      agent.config,
      projects: agent.agentAssignments.map(a => a.project.name),
      tasksCompleted:   taskMap[agent.id] ?? 0,
      contentPublished: contentMap[agent.id] ?? 0,
      recentActivity: (logMap[agent.id] ?? []).map(log => ({
        action:    log.action,
        target:    log.target,
        result:    log.result,
        timestamp: log.timestamp,
      })),
    }));

    return NextResponse.json({
      agents: result,
      globalStats: {
        totalWorkflowRunsThisWeek: recentRuns.length,
        completedRunsThisWeek: recentRuns.filter(r => r.status === "completed").length,
        publishedContent: publishedCount,
        recentRuns: recentRuns.slice(0, 5).map(r => ({
          id:     r.id,
          status: r.status,
          name:   r.workflow.name,
        })),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
