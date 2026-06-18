import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/admin/blackball/tasks
// 查询所有 DelegatedTask（倒序），供浏览器派活页面展示。
// 鉴权：由 middleware 统一校验 admin_token cookie 或 Bearer CRON_SECRET。
export async function GET() {
  try {
    const tasks = await prisma.delegatedTask.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id:             true,
        title:          true,
        prompt:         true,
        targetDir:      true,
        status:         true,
        blackballRunId: true,
        resultSummary:  true,
        errorMessage:   true,
        createdAt:      true,
        claimedAt:      true,
        completedAt:    true,
      },
    });
    return NextResponse.json({ ok: true, tasks });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Admin/blackball/tasks GET] 错误:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// POST /api/admin/blackball/tasks
// 在浏览器界面派活：创建一条 pending DelegatedTask。
// body: { title, prompt, targetDir? }
// 鉴权：由 middleware 统一校验 admin_token cookie 或 Bearer CRON_SECRET。
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      title: string;
      prompt: string;
      targetDir?: string;
    };

    const { title, prompt, targetDir } = body;

    // 基本参数校验
    if (!title?.trim() || !prompt?.trim()) {
      return NextResponse.json(
        { ok: false, error: "title 和 prompt 均为必填" },
        { status: 400 }
      );
    }

    const task = await prisma.delegatedTask.create({
      data: {
        title:     title.trim(),
        prompt:    prompt.trim(),
        targetDir: targetDir?.trim() || null,
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, id: task.id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Admin/blackball/tasks POST] 错误:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
