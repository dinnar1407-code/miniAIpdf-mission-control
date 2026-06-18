import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/blackball/tasks
// 手动派活入口：创建一个 pending 状态的 DelegatedTask，供测试及未来手动派发使用。
// body: { title, prompt, targetDir? }
// 鉴权：Bearer <BLACKBALL_WORKER_TOKEN>
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = process.env.BLACKBALL_WORKER_TOKEN;

  if (token && authHeader !== `Bearer ${token}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      title: string;
      prompt: string;
      targetDir?: string;
    };

    const { title, prompt, targetDir } = body;

    // 参数校验
    if (!title || !prompt) {
      return NextResponse.json(
        { ok: false, error: "title 和 prompt 均为必填" },
        { status: 400 }
      );
    }

    // 创建 pending 状态任务，status 默认值由 schema 指定（pending）
    const task = await prisma.delegatedTask.create({
      data: {
        title,
        prompt,
        targetDir: targetDir ?? null,
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, id: task.id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Blackball/tasks] 错误:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
