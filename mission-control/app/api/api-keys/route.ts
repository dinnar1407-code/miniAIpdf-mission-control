import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateApiKey } from "@/lib/api-auth";

// GET /api/api-keys — list all keys (no secrets shown)
export async function GET() {
  try {
    const keys = await prisma.apiKey.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        permissions: true,
        active: true,
        lastUsedAt: true,
        createdAt: true,
        expiresAt: true,
        // Don't return the actual key value after creation
        key: false,
      },
    });
    return NextResponse.json(keys);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// POST /api/api-keys — create a new key (returns key ONCE)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const key = generateApiKey();
    const apiKey = await prisma.apiKey.create({
      data: {
        name:        body.name || "API Key",
        key,
        permissions: body.permissions || "read",
        expiresAt:   body.expiresAt ? new Date(body.expiresAt) : undefined,
      },
    });
    // Return the key only at creation time
    return NextResponse.json({ ...apiKey, key }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
