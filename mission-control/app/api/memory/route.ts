import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeAgentMemory } from "@/lib/ai/agent-memory";

/**
 * GET /api/memory?agentId=xxx
 * 列出该 Agent 所有记忆
 */
async function handleGet(request: NextRequest) {
  try {
    const agentId = request.nextUrl.searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json(
        { error: "缺少必需参数: agentId" },
        { status: 400 }
      );
    }

    const memories = await prisma.agentMemory.findMany({
      where: { agentId },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      agentId,
      count: memories.length,
      memories: memories.map((m) => ({
        id: m.id,
        type: m.type,
        key: m.key,
        value: m.value,
        expiresAt: m.expiresAt,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
    });
  } catch (error) {
    console.error("[API/memory] GET 错误:", error);
    return NextResponse.json(
      { error: "获取记忆列表失败" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/memory
 * 手动写入记忆
 * Body: { agentId, type, key, value, expiresInDays? }
 */
async function handlePost(request: NextRequest) {
  try {
    const body = await request.json();

    const { agentId, type, key, value, expiresInDays } = body;

    // 验证必需字段
    if (!agentId || !type || !key || !value) {
      return NextResponse.json(
        {
          error:
            "缺少必需参数: agentId, type, key, value",
        },
        { status: 400 }
      );
    }

    // 验证 type 是否有效
    const validTypes = ["experience", "content", "kpi", "task", "preference"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        {
          error: `无效的类型: ${type}，必须是 ${validTypes.join(", ")} 之一`,
        },
        { status: 400 }
      );
    }

    await writeAgentMemory({
      agentId,
      type,
      key,
      value,
      expiresInDays,
    });

    return NextResponse.json(
      {
        success: true,
        message: "记忆已保存",
        data: { agentId, type, key },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API/memory] POST 错误:", error);
    return NextResponse.json(
      { error: "保存记忆失败" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/memory
 * 删除记忆
 * Body: { agentId, key }
 */
async function handleDelete(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, key } = body;

    if (!agentId || !key) {
      return NextResponse.json(
        { error: "缺少必需参数: agentId, key" },
        { status: 400 }
      );
    }

    // 删除所有匹配该 key 的记忆（所有类型）
    const result = await prisma.agentMemory.deleteMany({
      where: {
        agentId,
        key,
      },
    });

    return NextResponse.json({
      success: true,
      message: `已删除 ${result.count} 条记忆`,
      deleted: result.count,
    });
  } catch (error) {
    console.error("[API/memory] DELETE 错误:", error);
    return NextResponse.json(
      { error: "删除记忆失败" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleGet(request);
}

export async function POST(request: NextRequest) {
  return handlePost(request);
}

export async function DELETE(request: NextRequest) {
  return handleDelete(request);
}
