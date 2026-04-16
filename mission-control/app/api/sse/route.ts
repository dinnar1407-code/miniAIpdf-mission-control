import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getStats() {
  try {
    const [totalTasks, openTasks, agents, newAlerts] = await Promise.all([
      prisma.task.count(),
      prisma.task.count({ where: { status: { notIn: ["done", "cancelled"] } } }),
      prisma.agent.findMany({ select: { id: true, name: true, status: true, currentTask: true } }),
      prisma.alert.count({ where: { status: "new" } }),
    ]);

    return {
      openTasks,
      totalTasks,
      activeAgents: agents.filter(a => a.status === "active").length,
      totalAgents: agents.length,
      newAlerts,
      agents,
      timestamp: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* client disconnected */ }
      };

      // Send initial data immediately
      const initial = await getStats();
      if (initial) send(initial);

      // Poll every 15 seconds and push updates
      const interval = setInterval(async () => {
        const stats = await getStats();
        if (stats) send(stats);
      }, 15000);

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(interval);
          clearInterval(heartbeat);
        }
      }, 30000);

      // Cleanup on close
      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        clearInterval(heartbeat);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
