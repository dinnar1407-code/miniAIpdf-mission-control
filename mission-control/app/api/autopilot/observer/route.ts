import { NextRequest, NextResponse } from "next/server";
import { runObserver } from "@/lib/observer";

export const maxDuration = 60;

// GET /api/autopilot/observer — triggered by Vercel Cron or manual call
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runObserver();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[observer] runObserver failed:", err);
    return NextResponse.json(
      { error: "Observer failed", detail: String(err) },
      { status: 500 }
    );
  }
}
