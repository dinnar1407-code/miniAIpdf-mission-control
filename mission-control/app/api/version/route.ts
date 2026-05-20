import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    commit: "803f823",
    timestamp: Date.now(),
  });
}
