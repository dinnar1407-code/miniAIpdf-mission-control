import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const kpiRows = await prisma.kpiSnapshot.findMany({
    where: { metric: { in: ["mrr", "users"] } },
    orderBy: { date: "desc" },
    take: 5,
  }).catch(() => []);

  const latestMrr = [...kpiRows]
    .filter(k => k.metric === "mrr")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  return NextResponse.json({
    commit: "803f823",
    timestamp: Date.now(),
    kpiRows: kpiRows.map(r => ({ metric: r.metric, value: r.value, date: r.date })),
    latestMrr: latestMrr ? { value: latestMrr.value, date: latestMrr.date } : null,
  });
}
