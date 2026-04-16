import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export type Permission = "read" | "write" | "admin";

export interface AuthResult {
  ok: true;
  keyId: string;
  name: string;
  permissions: Permission[];
}

export interface AuthError {
  ok: false;
  error: string;
  status: number;
}

/**
 * Validate the API key from Authorization header.
 * Accepts: "Bearer mc_..." or "ApiKey mc_..."
 */
export async function validateApiKey(
  req: NextRequest,
  required: Permission = "read"
): Promise<AuthResult | AuthError> {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^(?:Bearer|ApiKey)\s+(.+)$/i);

  if (!match) {
    return { ok: false, error: "Missing Authorization header. Use: Authorization: Bearer <api_key>", status: 401 };
  }

  const rawKey = match[1].trim();

  const apiKey = await prisma.apiKey.findUnique({ where: { key: rawKey } });

  if (!apiKey) {
    return { ok: false, error: "Invalid API key", status: 401 };
  }

  if (!apiKey.active) {
    return { ok: false, error: "API key is disabled", status: 401 };
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return { ok: false, error: "API key has expired", status: 401 };
  }

  const permissions = apiKey.permissions.split(",").map(p => p.trim()) as Permission[];
  const permRank: Record<string, number> = { read: 1, write: 2, admin: 3 };
  const hasPermission = permissions.some(p => (permRank[p] || 0) >= (permRank[required] || 0));

  if (!hasPermission) {
    return { ok: false, error: `Insufficient permissions. Required: ${required}`, status: 403 };
  }

  // Update last used
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

  return {
    ok: true,
    keyId: apiKey.id,
    name: apiKey.name,
    permissions,
  };
}

/**
 * Generate a new API key string
 */
export function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "mc_";
  for (let i = 0; i < 40; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
