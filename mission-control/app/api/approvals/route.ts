import { NextRequest, NextResponse } from "next/server";
import {
  getApprovalRequests,
  handleApprovalResponse,
  expireOldRequests,
} from "@/lib/approval";

// ==================== GET APPROVALS ====================

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const status = req.nextUrl.searchParams.get("status") as
      | "pending"
      | "approved"
      | "rejected"
      | "expired"
      | null;

    // Expire old requests before fetching
    await expireOldRequests();

    const requests = await getApprovalRequests(
      status || undefined
    );

    return NextResponse.json({
      ok: true,
      count: requests.length,
      requests,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

// ==================== PATCH - MANUAL APPROVAL ====================

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as {
      code?: string;
      action?: "approve" | "reject";
    };

    if (!body.code || !body.action) {
      return NextResponse.json(
        { ok: false, error: "Missing code or action" },
        { status: 400 }
      );
    }

    const result = await handleApprovalResponse(body.code, body.action);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Request ${body.action}d successfully`,
      request: result.request,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
