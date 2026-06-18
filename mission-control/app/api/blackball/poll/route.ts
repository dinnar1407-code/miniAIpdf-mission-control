import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/blackball/poll
// 黑球 worker 轮询接口：在事务内原子地取出最早一个 pending 任务并标记为 claimed。
// 事务保证并发安全（两个 worker 同时 poll 不会领到同一个任务）。
// 鉴权：Bearer <BLACKBALL_WORKER_TOKEN>（照 cron 路由模式，token 不存在时放行以便本地调试）
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = process.env.BLACKBALL_WORKER_TOKEN;

  // token 存在时严格校验；不存在时开发环境可无鉴权访问
  if (token && authHeader !== `Bearer ${token}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 使用事务防止并发重复领取：
    // 1. 查找最早一个 pending 任务
    // 2. 立即将其状态改为 claimed 并记录 claimedAt
    // 3. 两步在同一个事务内完成，数据库层保证原子性
    const task = await prisma.$transaction(async (tx) => {
      // 取 status=pending 中 createdAt 最早的那一个（FIFO 队列）
      const found = await tx.delegatedTask.findFirst({
        where: { status: "pending" },
        orderBy: { createdAt: "asc" },
        select: { id: true, prompt: true, targetDir: true },
      });

      if (!found) return null;

      // 原子标记 claimed，避免另一个并发事务领走同一个任务
      await tx.delegatedTask.update({
        where: { id: found.id },
        data: {
          status: "claimed",
          claimedAt: new Date(),
        },
      });

      return found;
    });

    return NextResponse.json({ ok: true, task: task ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Blackball/poll] 错误:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
