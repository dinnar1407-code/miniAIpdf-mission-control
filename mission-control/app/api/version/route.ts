import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    commit: "e884be6",
    message: "fix: override vercel build/install commands for prisma generate",
    timestamp: Date.now()
  });
}
