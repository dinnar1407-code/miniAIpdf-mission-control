import { prisma } from "@/lib/db";

const WINDOW_DAYS = 7;
const DELTA_THRESHOLD = 0.2;   // 20% swing triggers observation
const GOAL_GAP_THRESHOLD = 0.5; // 50% gap to target triggers observation

export interface RawObservation {
  projectId: string;
  projectName: string;
  goalId: string | null;
  source: "kpi_snapshot" | "metric_snapshot";
  metric: string;
  unit: string;
  current: number;
  baseline: number;
  target: number;
  delta7d: number;
  deltaPct7d: number;
  window: "7d";
  observedAt: string;
}

export interface ObserverResult {
  scannedAt: string;
  windowDays: number;
  observations: RawObservation[];
}

async function scanKpiSnapshots(since: Date, now: Date): Promise<RawObservation[]> {
  const [snapshots, goals] = await Promise.all([
    prisma.kpiSnapshot.findMany({
      where: { date: { gte: since, lte: now }, projectId: { not: null } },
      include: { project: true },
      orderBy: { date: "asc" },
    }),
    prisma.goal.findMany(),
  ]);

  const groups = new Map<string, typeof snapshots>();
  for (const s of snapshots) {
    const key = `${s.projectId}::${s.metric}`;
    const arr = groups.get(key) ?? [];
    arr.push(s);
    groups.set(key, arr);
  }

  const observations: RawObservation[] = [];
  const observedAt = now.toISOString();

  for (const rows of Array.from(groups.values())) {
    if (rows.length < 2) continue;
    const oldest = rows[0];
    const latest = rows[rows.length - 1];
    const delta7d = latest.value - oldest.value;
    const deltaPct7d = oldest.value !== 0 ? delta7d / Math.abs(oldest.value) : 0;

    const goal = goals.find(
      (g) => g.projectId === latest.projectId && g.kpi === latest.metric
    );
    const goalGap =
      goal && goal.target !== 0
        ? Math.abs(latest.value - goal.target) / Math.abs(goal.target)
        : 0;

    if (Math.abs(deltaPct7d) >= DELTA_THRESHOLD || goalGap >= GOAL_GAP_THRESHOLD) {
      observations.push({
        projectId: latest.projectId!,
        projectName: latest.project?.name ?? latest.projectId!,
        goalId: goal?.id ?? null,
        source: "kpi_snapshot",
        metric: latest.metric,
        unit: goal?.unit ?? "unknown",
        current: latest.value,
        baseline: oldest.value,
        target: goal?.target ?? 0,
        delta7d,
        deltaPct7d,
        window: "7d",
        observedAt,
      });
    }
  }

  return observations;
}

async function scanMetricSnapshots(since: Date, now: Date): Promise<RawObservation[]> {
  const [snapshots, goals] = await Promise.all([
    prisma.metricSnapshot.findMany({
      where: { date: { gte: since, lte: now }, projectId: { not: null } },
      include: { project: true },
      orderBy: { date: "asc" },
    }),
    prisma.goal.findMany(),
  ]);

  const groups = new Map<string, typeof snapshots>();
  for (const s of snapshots) {
    const key = `${s.projectId}::${s.metric}`;
    const arr = groups.get(key) ?? [];
    arr.push(s);
    groups.set(key, arr);
  }

  const observations: RawObservation[] = [];
  const observedAt = now.toISOString();

  for (const rows of Array.from(groups.values())) {
    if (rows.length < 2) continue;
    const oldest = rows[0];
    const latest = rows[rows.length - 1];
    const delta7d = latest.value - oldest.value;
    const deltaPct7d = oldest.value !== 0 ? delta7d / Math.abs(oldest.value) : 0;

    const goal = goals.find(
      (g) => g.projectId === latest.projectId && g.kpi === latest.metric
    );
    const goalGap =
      goal && goal.target !== 0
        ? Math.abs(latest.value - goal.target) / Math.abs(goal.target)
        : 0;

    if (Math.abs(deltaPct7d) >= DELTA_THRESHOLD || goalGap >= GOAL_GAP_THRESHOLD) {
      observations.push({
        projectId: latest.projectId!,
        projectName: latest.project?.name ?? latest.projectId!,
        goalId: goal?.id ?? null,
        source: "metric_snapshot",
        metric: latest.metric,
        unit: goal?.unit ?? "unknown",
        current: latest.value,
        baseline: oldest.value,
        target: goal?.target ?? 0,
        delta7d,
        deltaPct7d,
        window: "7d",
        observedAt,
      });
    }
  }

  return observations;
}

export async function runObserver(): Promise<ObserverResult> {
  const now = new Date();
  const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [kpiObs, metricObs] = await Promise.all([
    scanKpiSnapshots(since, now),
    scanMetricSnapshots(since, now),
  ]);

  const observations = [...kpiObs, ...metricObs];

  console.log(
    JSON.stringify({
      event:            "observer_run",
      windowDays:       WINDOW_DAYS,
      kpiObservations:  kpiObs.length,
      metricObservations: metricObs.length,
      total:            observations.length,
      ts:               now.toISOString(),
    })
  );

  return { scannedAt: now.toISOString(), windowDays: WINDOW_DAYS, observations };
}
