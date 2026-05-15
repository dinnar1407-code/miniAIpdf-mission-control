import { NextRequest, NextResponse } from "next/server";
import { runObserver } from "@/lib/observer";
import { generateInsights } from "@/lib/insight-generator";

export const maxDuration = 120;

// GET /api/autopilot/insights/generate — runs observer then generates insights
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { observations, scannedAt, windowDays } = await runObserver();
    const result = await generateInsights(observations);

    return NextResponse.json({
      scannedAt,
      windowDays,
      observations: observations.length,
      ...result,
    });
  } catch (err) {
    console.error("[insights/generate] failed:", err);
    return NextResponse.json(
      { error: "Pipeline failed", detail: String(err) },
      { status: 500 }
    );
  }
}
