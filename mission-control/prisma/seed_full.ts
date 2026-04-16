// MiniAIPDF Mission Control - Extended Seed Data
// This file adds realistic tasks, metrics, and initial data for all projects

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database with full data...");

  // ==================== PROJECTS ====================
  
  const miniaipdf = await prisma.project.upsert({
    where: { slug: "miniaipdf" },
    update: {},
    create: {
      name: "MiniAIPDF",
      slug: "miniaipdf",
      description: "AI-powered PDF SaaS tool - compress, merge, split, AI Q&A",
      color: "#3B82F6",
      emoji: "📄",
      status: "active",
    },
  });

  const furmales = await prisma.project.upsert({
    where: { slug: "furmales" },
    update: {},
    create: {
      name: "FurMates",
      slug: "furmales",
      description: "Pet nutrition subscription e-commerce store",
      color: "#10B981",
      emoji: "🛒",
      status: "active",
    },
  });

  const niw = await prisma.project.upsert({
    where: { slug: "niw" },
    update: {},
    create: {
      name: "NIW",
      slug: "niw",
      description: "National Interest Waiver immigration petition",
      color: "#F59E0B",
      emoji: "📝",
      status: "active",
    },
  });

  const talengineer = await prisma.project.upsert({
    where: { slug: "talengineer" },
    update: {},
    create: {
      name: "Talengineer",
      slug: "talengineer",
      description: "Engineering talent matchmaker platform",
      color: "#8B5CF6",
      emoji: "🔧",
      status: "active",
    },
  });

  const wheatcoin = await prisma.project.upsert({
    where: { slug: "wheatcoin" },
    update: {},
    create: {
      name: "wheatcoin",
      slug: "wheatcoin",
      description: "Crypto community token & developer SDK",
      color: "#F97316",
      emoji: "🪙",
      status: "active",
    },
  });

  const dinnar = await prisma.project.upsert({
    where: { slug: "dinnar" },
    update: {},
    create: {
      name: "Dinnar",
      slug: "dinnar",
      description: "Industrial machine vision equipment company",
      color: "#EF4444",
      emoji: "🏭",
      status: "active",
    },
  });

  // ==================== TASKS ====================
  
  // MiniAIPDF Tasks
  const miniaipdfTasks = [
    { title: "PH Launch - Invite friends to upvote", status: "in_progress", priority: "high", projectId: miniaipdf.id },
    { title: "Post LinkedIn announcement", status: "todo", priority: "high", projectId: miniaipdf.id },
    { title: "Post Chinese community announcement", status: "todo", priority: "medium", projectId: miniaipdf.id },
    { title: "Fix Clerk middleware for sitemap.xml", status: "todo", priority: "high", projectId: miniaipdf.id },
    { title: "Write SEO blog post #1", status: "done", priority: "medium", projectId: miniaipdf.id },
    { title: "Contact 10 API potential customers", status: "in_progress", priority: "high", projectId: miniaipdf.id },
    { title: "Submit to AlternativeTo directory", status: "todo", priority: "medium", projectId: miniaipdf.id },
    { title: "Set up Google Search Console", status: "todo", priority: "medium", projectId: miniaipdf.id },
    { title: "Deploy Mission Control to Vercel", status: "in_progress", priority: "high", projectId: miniaipdf.id },
  ];

  for (const task of miniaipdfTasks) {
    await prisma.task.upsert({
      where: { id: task.title.toLowerCase().replace(/ /g, "-") },
      update: task,
      create: { ...task, id: task.title.toLowerCase().replace(/ /g, "-") },
    });
  }

  // FurMates Tasks
  const furmalesTasks = [
    { title: "Review Shopify store analytics", status: "in_progress", priority: "medium", projectId: furmales.id },
    { title: "Set up email automation for welcome series", status: "todo", priority: "high", projectId: furmales.id },
    { title: "Create ad creatives for Google Ads", status: "todo", priority: "medium", projectId: furmales.id },
    { title: "Respond to pending customer messages", status: "todo", priority: "high", projectId: furmales.id },
  ];

  for (const task of furmalesTasks) {
    await prisma.task.upsert({
      where: { id: task.title.toLowerCase().replace(/ /g, "-") },
      update: task,
      create: { ...task, id: task.title.toLowerCase().replace(/ /g, "-") },
    });
  }

  // NIW Tasks
  const niwTasks = [
    { title: "Draft employment plan letter", status: "in_progress", priority: "high", projectId: niw.id },
    { title: "Gather position documents", status: "todo", priority: "high", projectId: niw.id },
    { title: "Review petition letter draft", status: "todo", priority: "high", projectId: niw.id },
    { title: "Submit employment plan", status: "todo", priority: "urgent", projectId: niw.id },
  ];

  for (const task of niwTasks) {
    await prisma.task.upsert({
      where: { id: task.title.toLowerCase().replace(/ /g, "-") },
      update: task,
      create: { ...task, id: task.title.toLowerCase().replace(/ /g, "-") },
    });
  }

  // ==================== AGENTS ====================
  
  const agents = [
    { id: "playfish", name: "Playfish", type: "ceo", status: "active", currentTask: "Coordinating MiniAIPDF PH launch" },
    { id: "pm01", name: "PM01", type: "content", status: "active", currentTask: "Writing SEO blog content" },
    { id: "pm01-b", name: "PM01-B", type: "content", status: "idle", currentTask: null },
    { id: "admin01", name: "Admin01", type: "operations", status: "active", currentTask: "Monitoring PH status" },
    { id: "dfm", name: "DFM", type: "data", status: "idle", currentTask: null },
  ];

  for (const agent of agents) {
    await prisma.agent.upsert({
      where: { id: agent.id },
      update: agent,
      create: agent,
    });
  }

  // ==================== ALERTS ====================
  
  const alerts = [
    { severity: "info", message: "MiniAIPDF Product Hunt launched! PH URL shared.", status: "new", projectId: miniaipdf.id },
    { severity: "warning", message: "Clerk middleware blocking sitemap.xml - needs fix", status: "acknowledged", projectId: miniaipdf.id },
    { severity: "info", message: "Mission Control MVP deployed by Claude Code", status: "resolved", projectId: miniaipdf.id },
    { severity: "warning", message: "NIW H1B deadline approaching: June 30, 2026", status: "new", projectId: niw.id },
  ];

  for (let i = 0; i < alerts.length; i++) {
    const alert = alerts[i];
    await prisma.alert.upsert({
      where: { id: `alert-${i}` },
      update: alert,
      create: { ...alert, id: `alert-${i}` },
    });
  }

  // ==================== METRICS ====================
  
  const today = new Date();
  
  // MiniAIPDF Metrics (last 7 days)
  const miniMetrics = [
    { date: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000), platform: "website", metric: "visitors", value: 234 },
    { date: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000), platform: "website", metric: "visitors", value: 312 },
    { date: new Date(today.getTime() - 4 * 24 * 60 * 60 * 1000), platform: "website", metric: "visitors", value: 287 },
    { date: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000), platform: "website", metric: "visitors", value: 445 },
    { date: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000), platform: "website", metric: "visitors", value: 521 },
    { date: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), platform: "website", metric: "visitors", value: 892 },
    { date: today, platform: "website", metric: "visitors", value: 1247 },
  ];

  // Add MRR data
  for (let i = 0; i < 7; i++) {
    miniMetrics.push({
      date: new Date(today.getTime() - i * 24 * 60 * 60 * 1000),
      platform: "stripe",
      metric: "mrr",
      value: 0, // No revenue yet
    });
  }

  // Signups
  for (let i = 0; i < 7; i++) {
    miniMetrics.push({
      date: new Date(today.getTime() - i * 24 * 60 * 60 * 1000),
      platform: "website",
      metric: "signups",
      value: Math.floor(Math.random() * 20) + 5,
    });
  }

  for (const m of miniMetrics) {
    await prisma.metricSnapshot.create({ data: m });
  }

  // FurMates Metrics
  const furMetrics = [
    { date: today, platform: "shopify", metric: "orders", value: 3 },
    { date: today, platform: "shopify", metric: "revenue", value: 149.97 },
    { date: today, platform: "shopify", metric: "subscribers", value: 12 },
  ];

  for (const m of furMetrics) {
    await prisma.metricSnapshot.create({ data: m });
  }

  // ==================== WORKFLOWS ====================
  
  const workflows = [
    {
      id: "ph-launch-flow",
      name: "Product Hunt Launch Flow",
      description: "Automated workflow when PH goes live",
      triggerType: "manual",
      status: "draft",
      steps: JSON.stringify([
        { type: "agent", agent: "playfish", action: "Send PH announcement tweet" },
        { type: "agent", agent: "pm01", action: "Post to all communities" },
        { type: "schedule", delay: 60, action: "Send performance report" },
      ]),
    },
    {
      id: "daily-standup",
      name: "Daily Operations Standup",
      description: "Morning routine - analytics, alerts, content",
      triggerType: "schedule",
      status: "active",
      steps: JSON.stringify([
        { type: "agent", agent: "dfm", action: "Generate daily analytics" },
        { type: "agent", agent: "admin01", action: "Check all platforms" },
        { type: "agent", agent: "admin01", action: "Post scheduled content" },
        { type: "notify", channel: "telegram", action: "Send morning briefing" },
      ]),
    },
    {
      id: "api-customer-onboarding",
      name: "API Customer Onboarding",
      description: "When new API customer signs up",
      triggerType: "webhook",
      status: "draft",
      steps: JSON.stringify([
        { type: "agent", agent: "playfish", action: "Send welcome email" },
        { type: "agent", agent: "admin01", action: "Create API credentials" },
        { type: "schedule", delay: 1440, action: "Send getting started guide" },
      ]),
    },
  ];

  for (const wf of workflows) {
    await prisma.workflow.upsert({
      where: { id: wf.id },
      update: wf,
      create: wf,
    });
  }

  console.log("✅ Database seeded successfully!");
  console.log(`   - Projects: 6`);
  console.log(`   - Tasks: ${miniaipdfTasks.length + furmalesTasks.length + niwTasks.length}`);
  console.log(`   - Agents: 5`);
  console.log(`   - Alerts: ${alerts.length}`);
  console.log(`   - Metrics: ${miniMetrics.length + furMetrics.length}`);
  console.log(`   - Workflows: ${workflows.length}`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
