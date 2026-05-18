import { PrismaClient } from "@prisma/client";
import goalSeedData from "./seed-data/projects.json";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Mission Control...\n");

  // --- Projects ---
  const projects = await Promise.all([
    prisma.project.upsert({
      where: { slug: "miniaipdf" },
      update: {},
      create: {
        name: "MiniAIPDF",
        slug: "miniaipdf",
        description: "在线 PDF 工具平台，压缩/合并/拆分/转换",
        color: "#EF4444",
        emoji: "📄",
        status: "active",
      },
    }),
    prisma.project.upsert({
      where: { slug: "furm8s" },
      update: {},
      create: {
        name: "FurMates",
        slug: "furm8s",
        description: "宠物社交与领养平台",
        color: "#F97316",
        emoji: "🐾",
        status: "active",
      },
    }),
    prisma.project.upsert({
      where: { slug: "niw" },
      update: {},
      create: {
        name: "NIW",
        slug: "niw",
        description: "国家利益豁免移民申请材料准备",
        color: "#8B5CF6",
        emoji: "🛂",
        status: "active",
      },
    }),
    prisma.project.upsert({
      where: { slug: "talengineer" },
      update: {},
      create: {
        name: "Talengineer",
        slug: "talengineer",
        description: "开发者工具与开源项目",
        color: "#06B6D4",
        emoji: "🔧",
        status: "active",
      },
    }),
    prisma.project.upsert({
      where: { slug: "wheatcoin" },
      update: {},
      create: {
        name: "wheatcoin-community",
        slug: "wheatcoin",
        description: "社区运营与内容平台",
        color: "#EAB308",
        emoji: "🌾",
        status: "active",
      },
    }),
    prisma.project.upsert({
      where: { slug: "dinnar" },
      update: {},
      create: {
        name: "Dinnar AI",
        slug: "dinnar",
        description: "OPC 视觉开发平台 — 工业机器视觉算法引擎",
        color: "#3B82F6",
        emoji: "🔬",
        status: "active",
      },
    }),
  ]);
  console.log(`✅ ${projects.length} Projects created`);

  // --- Agents ---
  const agents = await Promise.all([
    prisma.agent.upsert({
      where: { id: "agent-playfish" },
      update: {},
      create: {
        id: "agent-playfish",
        name: "Playfish",
        type: "ceo",
        status: "active",
        currentTask: "监督全局运营",
        config: JSON.stringify({ role: "CEO", channel: "telegram" }),
      },
    }),
    prisma.agent.upsert({
      where: { id: "agent-pm01" },
      update: {},
      create: {
        id: "agent-pm01",
        name: "PM01 小研",
        type: "operations",
        status: "active",
        currentTask: "OPC 视觉平台研发调研",
        config: JSON.stringify({ role: "CTO/研究员", channel: "webchat" }),
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
        currentTask: "MiniAIPDF 运维",
        config: JSON.stringify({ role: "系统运维", channel: "webchat" }),
      },
    }),
    prisma.agent.upsert({
      where: { id: "agent-dfm" },
      update: {},
      create: {
        id: "agent-dfm",
        name: "DFM",
        type: "content",
        status: "active",
        currentTask: "内容营销与增长",
        config: JSON.stringify({ role: "内容/增长", channel: "webchat" }),
      },
    }),
    prisma.agent.upsert({
      where: { id: "agent-caishen" },
      update: {},
      create: {
        id: "agent-caishen",
        name: "Caishen",
        type: "investment",
        status: "active",
        currentTask: "财务数据分析",
        config: JSON.stringify({
          emoji: "💰",
          role: "Investment Agent",
          channel: "telegram",
          telegramBotToken: process.env.CAISHEN_TELEGRAM_BOT_TOKEN,
          telegramChatId: process.env.CAISHEN_TELEGRAM_CHAT_ID,
        }),
      },
    }),
  ]);
  console.log(`✅ ${agents.length} Agents created`);

  // --- Agent Assignments ---
  const assignments = [
    { agentId: "agent-playfish", projectSlug: "dinnar", role: "primary" },
    { agentId: "agent-pm01", projectSlug: "dinnar", role: "primary" },
    { agentId: "agent-pm01", projectSlug: "miniaipdf", role: "contributor" },
    { agentId: "agent-pm01", projectSlug: "talengineer", role: "contributor" },
    { agentId: "agent-admin01", projectSlug: "miniaipdf", role: "primary" },
    { agentId: "agent-dfm", projectSlug: "furm8s", role: "primary" },
    { agentId: "agent-dfm", projectSlug: "wheatcoin", role: "primary" },
    { agentId: "agent-dfm", projectSlug: "miniaipdf", role: "contributor" },
    { agentId: "agent-caishen", projectSlug: "niw", role: "primary" },
    { agentId: "agent-caishen", projectSlug: "miniaipdf", role: "contributor" },
    { agentId: "agent-playfish", projectSlug: "miniaipdf", role: "primary" },
    { agentId: "agent-playfish", projectSlug: "niw", role: "primary" },
  ];

  for (const a of assignments) {
    const project = projects.find((p) => p.slug === a.projectSlug);
    if (!project) continue;
    await prisma.agentAssignment.upsert({
      where: { agentId_projectId: { agentId: a.agentId, projectId: project.id } },
      update: {},
      create: { agentId: a.agentId, projectId: project.id, role: a.role },
    });
  }
  console.log(`✅ ${assignments.length} Agent Assignments created`);

  // --- Tasks ---
  const dinnarProject = projects.find((p) => p.slug === "dinnar")!;
  const miniProject = projects.find((p) => p.slug === "miniaipdf")!;
  const niwProject = projects.find((p) => p.slug === "niw")!;

  const tasks = await Promise.all([
    prisma.task.create({
      data: {
        title: "HALCON 26.05 发布解析",
        description: "5.20 HALCON 26.05 发布后第一时间做技术拆解",
        status: "todo",
        priority: "urgent",
        projectId: dinnarProject.id,
        agentId: "agent-pm01",
        dueDate: new Date("2026-05-21"),
      },
    }),
    prisma.task.create({
      data: {
        title: "C++ 构建环境搭建",
        description: "安装 Xcode CLT + CMake + vcpkg，搭建 OPC 可编译环境",
        status: "todo",
        priority: "high",
        projectId: dinnarProject.id,
        agentId: "agent-pm01",
      },
    }),
    prisma.task.create({
      data: {
        title: "MiniAIPDF 404页面修复",
        description: "compress/merge/split/pdf-to-word/word-to-pdf/pdf-to-excel/excel-to-pdf 七个页面修复",
        status: "done",
        priority: "urgent",
        projectId: miniProject.id,
        agentId: "agent-pm01",
        completedAt: new Date("2026-05-13"),
      },
    }),
    prisma.task.create({
      data: {
        title: "MiniAIPDF Vercel 部署验证",
        description: "推送代码并验证7个新页面线上正常",
        status: "review",
        priority: "high",
        projectId: miniProject.id,
        agentId: "agent-admin01",
      },
    }),
    prisma.task.create({
      data: {
        title: "NIW Petition Letter 终稿",
        description: "润色 NIW Petition Letter 最终版本",
        status: "in_progress",
        priority: "high",
        projectId: niwProject.id,
        agentId: "agent-caishen",
      },
    }),
  ]);
  console.log(`✅ ${tasks.length} Tasks created`);

  // --- Activity Logs ---
  const logs = await Promise.all([
    prisma.activityLog.create({
      data: {
        agentId: "agent-pm01",
        action: "report_generated",
        target: "竞品情报双周报告",
        result: "success",
        projectId: dinnarProject.id,
        timestamp: new Date("2026-05-12T08:00:00"),
      },
    }),
    prisma.activityLog.create({
      data: {
        agentId: "agent-pm01",
        action: "bug_fixed",
        target: "MiniAIPDF 7个404页面",
        result: "success",
        projectId: miniProject.id,
        timestamp: new Date("2026-05-13T01:00:00"),
      },
    }),
    prisma.activityLog.create({
      data: {
        agentId: "agent-pm01",
        action: "research_completed",
        target: "机器视觉行业全景分析报告",
        result: "success",
        projectId: dinnarProject.id,
        timestamp: new Date("2026-05-13T02:00:00"),
      },
    }),
    prisma.activityLog.create({
      data: {
        agentId: "agent-playfish",
        action: "database_setup",
        target: "Jarvis PostgreSQL (Neon)",
        result: "success",
        projectId: null,
        timestamp: new Date("2026-05-13T01:10:00"),
      },
    }),
  ]);
  console.log(`✅ ${logs.length} Activity Logs created`);

  // --- Metric Snapshots ---
  const metrics = await Promise.all([
    prisma.metricSnapshot.create({
      data: {
        date: new Date("2026-05-12"),
        platform: "all",
        metric: "active_projects",
        value: 6,
        projectId: null,
      },
    }),
    prisma.metricSnapshot.create({
      data: {
        date: new Date("2026-05-12"),
        platform: "all",
        metric: "active_agents",
        value: 5,
        projectId: null,
      },
    }),
    prisma.metricSnapshot.create({
      data: {
        date: new Date("2026-05-12"),
        platform: "all",
        metric: "tasks_completed",
        value: 3,
        projectId: null,
      },
    }),
    prisma.metricSnapshot.create({
      data: {
        date: new Date("2026-05-12"),
        platform: "web",
        metric: "traffic",
        value: 0,
        metadata: JSON.stringify({ note: "待接入 GA" }),
        projectId: miniProject.id,
      },
    }),
  ]);
  console.log(`✅ ${metrics.length} Metric Snapshots created`);

  // --- Preset Workflows ---
  const workflows = await Promise.all([
    prisma.workflow.upsert({
      where: { id: "wf-pulse" },
      update: {},
      create: {
        id: "wf-pulse",
        name: "L0-脉搏扫描",
        description: "每15分钟扫描 BTC/ETH 价格 + 资金费率",
        triggerType: "cron",
        cronExpression: "*/15 * * * *",
        targetAgent: "caishen",
        status: "active",
        taskTemplate: JSON.stringify({ message: "📊 L0脉搏扫描：获取BTC/ETH当前价格和主要交易所资金费率", timeoutSeconds: 60 }),
      },
    }),
    prisma.workflow.upsert({
      where: { id: "wf-scan" },
      update: {},
      create: {
        id: "wf-scan",
        name: "L1-全币种扫描",
        description: "每小时全交易所费率对比",
        triggerType: "cron",
        cronExpression: "0 * * * *",
        targetAgent: "caishen",
        status: "active",
        taskTemplate: JSON.stringify({ message: "📊 L1全币种扫描：全交易所资金费率对比分析", timeoutSeconds: 90 }),
      },
    }),
    prisma.workflow.upsert({
      where: { id: "wf-heartbeat" },
      update: {},
      create: {
        id: "wf-heartbeat",
        name: "全员心跳审计",
        description: "每小时ping所有Agent确认存活",
        triggerType: "cron",
        cronExpression: "0 * * * *",
        targetAgent: "playfish",
        status: "active",
        taskTemplate: JSON.stringify({ message: "🫀 心跳审计：检查PM01/Admin01/DFM/Caishen上次活跃时间，超时告警", timeoutSeconds: 30 }),
      },
    }),
    prisma.workflow.upsert({
      where: { id: "wf-battle-report" },
      update: {},
      create: {
        id: "wf-battle-report",
        name: "战报自动补报",
        description: "每天凌晨5分钟检查当日战报是否生成，未生成则通知补写",
        triggerType: "cron",
        cronExpression: "5 0 * * *",
        targetAgent: "playfish",
        status: "active",
        taskTemplate: JSON.stringify({ message: "📋 战报补报检查：所有Agent昨日战报是否已写入？缺失则通知", timeoutSeconds: 30 }),
      },
    }),
    prisma.workflow.upsert({
      where: { id: "wf-brain" },
      update: {},
      create: {
        id: "wf-brain",
        name: "第二大脑聚合",
        description: "每天凌晨30分聚合所有Agent知识到第二大脑",
        triggerType: "cron",
        cronExpression: "30 0 * * *",
        targetAgent: "playfish",
        status: "active",
        taskTemplate: JSON.stringify({ message: "🧠 第二大脑聚合：同步Obsidian/知识库更新，索引今日新增内容", timeoutSeconds: 60 }),
      },
    }),
  ]);
  console.log(`✅ ${workflows.length} Preset Workflows created`);

  // --- Goals (Autopilot Phase 1.2) ---
  let goalInserted = 0;
  let goalSkipped = 0;

  await prisma.$transaction(async (tx) => {
    for (const projectData of goalSeedData.projects) {
      const project = projects.find((p) => p.slug === projectData.slug);
      if (!project) continue;

      for (const g of projectData.goals) {
        const existing = await tx.goal.findUnique({
          where: { projectId_kpi: { projectId: project.id, kpi: g.kpi } },
        });
        if (existing) {
          goalSkipped++;
        } else {
          await tx.goal.create({
            data: {
              projectId: project.id,
              kpi: g.kpi,
              unit: g.unit,
              baseline: g.baseline,
              target: g.target,
              cadence: g.cadence,
              deadline: new Date(g.deadline),
              status: "on_track",
            },
          });
          goalInserted++;
        }
      }
    }
  });

  console.log(
    `✅ Goals: ${goalInserted} inserted, ${goalSkipped} skipped (already exist)`
  );

  console.log("\n🎉 Seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
