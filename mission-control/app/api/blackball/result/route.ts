import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/blackball/result
// 黑球 worker 提交任务结果接口。
// body: { taskId, status, runId, resultSummary?, artifactCount?, error? }
// 鉴权：Bearer <BLACKBALL_WORKER_TOKEN>
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = process.env.BLACKBALL_WORKER_TOKEN;

  if (token && authHeader !== `Bearer ${token}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 解析请求体，明确类型方便后续类型检查
    const body = (await req.json()) as {
      taskId: string;
      status: string;
      runId: string;
      resultSummary?: string;
      artifactCount?: number;
      error?: string;
    };

    const { taskId, status, runId, resultSummary, error } = body;

    // 基本参数校验：
    // - taskId 和 status 始终必填
    // - runId 在 status=failed 时允许为空字符串（黑球 submit 失败时没有 runId）
    //   其他状态（succeeded 等）仍然要求 runId 非空
    const requireRunId = status !== "failed";
    if (!taskId || !status || (requireRunId && !runId)) {
      return NextResponse.json(
        { ok: false, error: "taskId 和 status 为必填；succeeded 时 runId 也必填" },
        { status: 400 }
      );
    }

    // 查找任务是否存在
    const existing = await prisma.delegatedTask.findUnique({
      where: { id: taskId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: `任务 ${taskId} 不存在` },
        { status: 404 }
      );
    }

    // 更新任务状态及结果字段
    // blackballRunId：runId 为空字符串时（failed 状态下没有 runId）存 null
    await prisma.delegatedTask.update({
      where: { id: taskId },
      data: {
        status:         status as import("@prisma/client").DelegatedTaskStatus,
        blackballRunId: runId || null,
        resultSummary:  resultSummary ?? null,
        errorMessage:   error ?? null,
        completedAt:    new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Blackball/result] 错误:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
