import { NextResponse } from "next/server";

export async function GET() {
  // Mock data for MVP — replace with Prisma queries in Phase 2
  const data = {
    stats: {
      mrr: 2327,
      mrrChange: 12,
      users: 4494,
      usersChange: 8,
      openTasks: 23,
      totalTasks: 45,
      activeAgents: 3,
      totalAgents: 5,
      agentHours: 142,
    },
    recentActivity: [
      { id: "1", agentName: "PM01", agentEmoji: "📝", action: "published Twitter thread", projectName: "MiniAIPDF", projectColor: "#3B82F6", timestamp: new Date(Date.now() - 2 * 60 * 1000) },
      { id: "2", agentName: "Playfish", agentEmoji: "🌾", action: "replied to customer email", projectName: "FurMates", projectColor: "#10B981", timestamp: new Date(Date.now() - 15 * 60 * 1000) },
    ],
    alerts: [
      { id: "1", severity: "critical", message: "Product Hunt launch detected", project: "MiniAIPDF", time: "2m ago" },
      { id: "2", severity: "warning", message: "API error rate elevated (2.3%)", project: "MiniAIPDF", time: "1h ago" },
    ],
    agents: [
      { id: "playfish", name: "Playfish", emoji: "🌾", status: "active" },
      { id: "pm01", name: "PM01", emoji: "📝", status: "active" },
      { id: "admin01", name: "Admin01", emoji: "🔧", status: "active" },
      { id: "dfm", name: "DFM", emoji: "📊", status: "idle" },
    ],
  };

  return NextResponse.json(data);
}
