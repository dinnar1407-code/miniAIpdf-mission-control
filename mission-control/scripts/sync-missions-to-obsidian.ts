/**
 * sync-missions-to-obsidian.ts
 * Writes completed Mission results to the local Obsidian vault.
 * Run manually or via launchd (see com.miniAIpdf.mission-sync.plist).
 *
 * Usage:
 *   npx tsx --env-file=.env.production.local scripts/sync-missions-to-obsidian.ts
 *   npx tsx --env-file=.env.production.local scripts/sync-missions-to-obsidian.ts --days=7
 */

import { PrismaClient } from "@prisma/client";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const VAULT_DIR = join(
  process.env.HOME ?? "/Users/wheat",
  "Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Wheat X/20-Jarvis/missions"
);

const DAYS = parseInt(
  process.argv.find((a) => a.startsWith("--days="))?.split("=")[1] ?? "1",
  10
);

// ── types ────────────────────────────────────────────────────────────────────

interface StepResult {
  stepIndex:    number;
  status:       string;
  output?:      string;
  error?:       string;
  startedAt?:   string;
  completedAt?: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function durationMin(start: Date | null, end: Date | null): string {
  if (!start || !end) return "—";
  const s = Math.round((end.getTime() - start.getTime()) / 6000) / 10;
  return `${s} min`;
}

function truncate(s: string, n = 2000): string {
  return s.length <= n ? s : s.slice(0, n) + `\n…（已截断，共 ${s.length} 字符）`;
}

function formatNote(mission: {
  id:          string;
  status:      string;
  startedAt:   Date | null;
  completedAt: Date | null;
  plan: {
    id:            string;
    objective:     string;
    rationale:     string;
    riskLevel:     number;
    reversibility: string;
    steps: Array<{ order: number; action: string; agentId: string | null }>;
  };
  project:     { name: string; slug: string; emoji: string };
  workflowRun: { stepResults: string; result: string | null; error: string | null } | null;
}): string {
  const steps       = mission.plan.steps.sort((a, b) => a.order - b.order);
  const stepResults: StepResult[] = JSON.parse(mission.workflowRun?.stepResults ?? "[]");

  const date       = (mission.completedAt ?? mission.startedAt ?? new Date()).toISOString().slice(0, 10);
  const statusIcon = mission.status === "succeeded" ? "✅" : "❌";
  const dur        = durationMin(mission.startedAt, mission.completedAt);

  const fm = [
    "---",
    `mission_id: ${mission.id}`,
    `plan_id: ${mission.plan.id}`,
    `project: ${mission.project.slug}`,
    `status: ${mission.status}`,
    `completed_at: "${mission.completedAt?.toISOString() ?? ""}"`,
    `duration_str: "${dur}"`,
    `risk_level: ${mission.plan.riskLevel}`,
    `reversibility: ${mission.plan.reversibility}`,
    `tags: [jarvis, mission, ${mission.project.slug}]`,
    "---",
  ].join("\n");

  const stepSections = steps.map((s) => {
    const r      = stepResults.find((r) => r.stepIndex === s.order - 1);
    const icon   = r?.status === "completed" ? "✅" : r?.status === "failed" ? "❌" : "⏭";
    const output = r?.output ? `\n\n> ${truncate(r.output).replace(/\n/g, "\n> ")}` : "";
    const err    = r?.error  ? `\n\n> ⚠️ Error: ${r.error}` : "";
    return `### Step ${s.order} ${icon}  ·  ${s.agentId ?? "?"}\n**任务**: ${s.action}${output}${err}`;
  }).join("\n\n");

  const resultBlock = mission.workflowRun?.result
    ? `\n\n## 执行结果\n\n${truncate(mission.workflowRun.result)}`
    : mission.workflowRun?.error
    ? `\n\n## 执行错误\n\n> ${mission.workflowRun.error}`
    : "";

  return [
    fm,
    "",
    `# ${statusIcon} ${mission.project.emoji} ${mission.plan.objective}`,
    "",
    `**项目**: [[${mission.project.name}]]  ·  **状态**: ${mission.status}  ·  **耗时**: ${dur}`,
    `**完成时间**: ${date}  ·  **Mission ID**: \`${mission.id}\``,
    "",
    "## 背景",
    "",
    truncate(mission.plan.rationale, 800),
    "",
    "## 执行步骤",
    "",
    stepSections,
    resultBlock,
    "",
    "---",
    `*由 Jarvis Mission Control 自动归档 · ${new Date().toISOString()}*`,
  ].join("\n");
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(VAULT_DIR, { recursive: true });

  const prisma = new PrismaClient();
  const since  = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

  const missions = await prisma.mission.findMany({
    where:   { status: { in: ["succeeded", "failed"] }, completedAt: { gte: since } },
    include: { plan: { include: { steps: true } }, project: { select: { name: true, slug: true, emoji: true } } },
    orderBy: { completedAt: "desc" },
  });

  console.log(`找到 ${missions.length} 个 Mission（最近 ${DAYS} 天）`);

  let written = 0;
  let skipped = 0;

  for (const mission of missions) {
    const fileName = `${(mission.completedAt ?? new Date()).toISOString().slice(0, 10)}-${mission.id.slice(-8)}.md`;
    const filePath = join(VAULT_DIR, fileName);

    if (existsSync(filePath)) {
      skipped++;
      continue;
    }

    const workflowRun = mission.workflowRunId
      ? await prisma.workflowRun.findUnique({
          where:  { id: mission.workflowRunId },
          select: { stepResults: true, result: true, error: true },
        })
      : null;

    writeFileSync(filePath, formatNote({ ...mission, workflowRun }), "utf-8");
    console.log(`  ✅ 写入: ${fileName}`);
    written++;
  }

  console.log(`\n完成：写入 ${written} 条，跳过 ${skipped} 条（已存在）`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("同步失败:", err);
  process.exit(1);
});
