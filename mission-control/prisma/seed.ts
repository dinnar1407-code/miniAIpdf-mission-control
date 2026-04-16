import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Projects
  const projects = await Promise.all([
    prisma.project.upsert({
      where: { slug: "miniaipdf" },
      update: {},
      create: {
        name: "MiniAIPDF",
        slug: "miniaipdf",
        description: "AI-powered PDF SaaS tool",
        color: "#3B82F6",
        emoji: "📄",
        status: "active",
      },
    }),
    prisma.project.upsert({
      where: { slug: "furmales" },
      update: {},
      create: {
        name: "FurMates",
        slug: "furmales",
        description: "Pet supplies e-commerce store",
        color: "#10B981",
        emoji: "🛒",
        status: "active",
      },
    }),
    prisma.project.upsert({
      where: { slug: "niw" },
      update: {},
      create: {
        name: "NIW",
        slug: "niw",
        description: "National Interest Waiver petition",
        color: "#F59E0B",
        emoji: "📝",
        status: "active",
      },
    }),
    prisma.project.upsert({
      where: { slug: "talengineer" },
      update: {},
      create: {
        name: "Talengineer",
        slug: "talengineer",
        description: "Engineering talent matchmaker",
        color: "#8B5CF6",
        emoji: "🔧",
        status: "active",
      },
    }),
    prisma.project.upsert({
      where: { slug: "wheatcoin" },
      update: {},
      create: {
        name: "wheatcoin",
        slug: "wheatcoin",
        description: "Crypto community & SDK",
        color: "#F97316",
        emoji: "🪙",
        status: "active",
      },
    }),
    prisma.project.upsert({
      where: { slug: "dinnar" },
      update: {},
      create: {
        name: "Dinnar",
        slug: "dinnar",
        description: "Industrial operations",
        color: "#EF4444",
        emoji: "🏭",
        status: "active",
      },
    }),
  ]);

  console.log(`✅ Created ${projects.length} projects`);

  // Agents
  const agents = await Promise.all([
    prisma.agent.upsert({
      where: { id: "agent-playfish" },
      update: {},
      create: {
        id: "agent-playfish",
        name: "Playfish",
        type: "ceo",
        status: "active",
        currentTask: "Reviewing MiniAIPDF growth metrics",
        config: JSON.stringify({ emoji: "🌾", role: "CEO Agent" }),
      },
    }),
    prisma.agent.upsert({
      where: { id: "agent-pm01" },
      update: {},
      create: {
        id: "agent-pm01",
        name: "PM01",
        type: "content",
        status: "active",
        currentTask: "Publishing Twitter thread for MiniAIPDF",
        config: JSON.stringify({ emoji: "📝", role: "Content Agent" }),
      },
    }),
    prisma.agent.upsert({
      where: { id: "agent-pm01b" },
      update: {},
      create: {
        id: "agent-pm01b",
        name: "PM01-B",
        type: "content",
        status: "idle",
        currentTask: null,
        config: JSON.stringify({ emoji: "📝", role: "Content Agent B" }),
      },
    }),
    prisma.agent.upsert({
      where: { id: "agent-admin01" },
      update: {},
      create: {
        id: "agent-admin01",
        name: "Admin01",
        type: "operations",
        status: "active",
        currentTask: "Processing NIW document reminders",
        config: JSON.stringify({ emoji: "🔧", role: "Operations Agent" }),
      },
    }),
    prisma.agent.upsert({
      where: { id: "agent-dfm" },
      update: {},
      create: {
        id: "agent-dfm",
        name: "DFM",
        type: "data",
        status: "idle",
        currentTask: null,
        config: JSON.stringify({ emoji: "📊", role: "Data & Finance Agent" }),
      },
    }),
  ]);

  console.log(`✅ Created ${agents.length} agents`);

  // Sample Tasks
  const miniProject = projects[0];
  const furProject = projects[1];

  await prisma.task.createMany({
    skipDuplicates: true,
    data: [
      {
        title: "Launch Product Hunt campaign",
        description: "Prepare assets, schedule launch, monitor comments",
        status: "in_progress",
        priority: "urgent",
        projectId: miniProject.id,
        agentId: "agent-playfish",
      },
      {
        title: "Write 5 SEO blog posts",
        description: "Target keywords: pdf editor, compress pdf, merge pdf",
        status: "todo",
        priority: "high",
        projectId: miniProject.id,
        agentId: "agent-pm01",
      },
      {
        title: "Set up Shopify abandoned cart emails",
        status: "review",
        priority: "medium",
        projectId: furProject.id,
        agentId: "agent-admin01",
      },
      {
        title: "Update NIW petition letter",
        description: "Add recent publications and citations",
        status: "todo",
        priority: "high",
        projectId: projects[2].id,
        agentId: "agent-playfish",
      },
      {
        title: "API documentation update",
        status: "done",
        priority: "medium",
        projectId: miniProject.id,
        agentId: "agent-pm01",
      },
      {
        title: "Fix checkout bug on mobile",
        status: "blocked",
        priority: "urgent",
        projectId: furProject.id,
      },
      {
        title: "Wheatcoin SDK v2 release notes",
        status: "in_progress",
        priority: "medium",
        projectId: projects[4].id,
        agentId: "agent-dfm",
      },
    ],
  });

  console.log("✅ Created sample tasks");

  // Sample Alerts
  await prisma.alert.createMany({
    skipDuplicates: true,
    data: [
      {
        severity: "critical",
        source: "platform",
        message: "Product Hunt launch detected — agents on standby",
        status: "new",
        projectId: miniProject.id,
      },
      {
        severity: "warning",
        source: "system",
        message: "API error rate elevated (2.3%) — monitoring",
        status: "acknowledged",
        projectId: miniProject.id,
      },
      {
        severity: "info",
        source: "agent",
        message: "NIW deadline in 3 days — review required",
        status: "new",
        projectId: projects[2].id,
      },
      {
        severity: "warning",
        source: "platform",
        message: "FurMates Shopify: 3 abandoned carts in last hour",
        status: "new",
        projectId: furProject.id,
      },
    ],
  });

  console.log("✅ Created sample alerts");

  // Sample Activity Logs
  await prisma.activityLog.createMany({
    data: [
      {
        agentId: "agent-pm01",
        action: "published",
        target: "Twitter thread",
        result: "12 retweets, 45 likes",
        projectId: miniProject.id,
        timestamp: new Date(Date.now() - 2 * 60 * 1000),
      },
      {
        agentId: "agent-playfish",
        action: "replied",
        target: "Customer email",
        result: "Resolved — upgrade offer sent",
        projectId: furProject.id,
        timestamp: new Date(Date.now() - 15 * 60 * 1000),
      },
      {
        agentId: "agent-admin01",
        action: "sent reminder",
        target: "Terry",
        result: "NIW petition review needed",
        projectId: projects[2].id,
        timestamp: new Date(Date.now() - 60 * 60 * 1000),
      },
      {
        agentId: "agent-dfm",
        action: "updated",
        target: "wheatcoin SDK docs",
        result: "v2.1.0 release notes published",
        projectId: projects[4].id,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
      {
        agentId: "agent-playfish",
        action: "drafted",
        target: "CFO report",
        result: "Q1 summary ready for review",
        projectId: projects[5].id,
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
      },
    ],
  });

  console.log("✅ Created activity logs");

  // Sample Metrics
  const days = 14;
  const metricData = [];
  for (let i = days; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    metricData.push(
      { date, platform: "miniaipdf", metric: "mrr", value: 1100 + Math.random() * 200, projectId: miniProject.id },
      { date, platform: "miniaipdf", metric: "users", value: 2700 + Math.random() * 200, projectId: miniProject.id },
      { date, platform: "miniaipdf", metric: "api_calls", value: 45000 + Math.random() * 10000, projectId: miniProject.id },
      { date, platform: "furmales", metric: "mrr", value: 800 + Math.random() * 150, projectId: furProject.id },
      { date, platform: "furmales", metric: "users", value: 1200 + Math.random() * 100, projectId: furProject.id }
    );
  }

  await prisma.metricSnapshot.createMany({ data: metricData });
  console.log("✅ Created metric snapshots");

  console.log("\n🚀 Seed complete! Playfish Mission Control is ready.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
