import { prisma } from "@/lib/db";

/**
 * 获取 Agent 记忆上下文（注入到 Prompt）
 * @param agentId Agent ID
 * @returns 格式化的记忆字符串，用于拼接到用户消息中
 */
export async function getAgentMemoryContext(agentId: string): Promise<string> {
  try {
    const memories = await prisma.agentMemory.findMany({
      where: {
        agentId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    if (memories.length === 0) {
      return "";
    }

    // 按类型分组
    const grouped = memories.reduce(
      (acc, mem) => {
        if (!acc[mem.type]) {
          acc[mem.type] = [];
        }
        acc[mem.type].push(mem);
        return acc;
      },
      {} as Record<string, typeof memories>
    );

    // 构建格式化输出
    const sections: string[] = [];

    if (grouped.experience && grouped.experience.length > 0) {
      sections.push(
        "## 你的经验记忆\n" +
          grouped.experience
            .map((m) => `- [${m.key}] ${m.value}`)
            .join("\n")
      );
    }

    if (grouped.content && grouped.content.length > 0) {
      sections.push(
        "## 已发布的内容\n" +
          grouped.content
            .map((m) => `- ${m.value}`)
            .join("\n")
      );
    }

    if (grouped.kpi && grouped.kpi.length > 0) {
      sections.push(
        "## 关键业务指标\n" +
          grouped.kpi
            .map((m) => `- ${m.key}: ${m.value}`)
            .join("\n")
      );
    }

    if (grouped.task && grouped.task.length > 0) {
      sections.push(
        "## 已完成的任务\n" +
          grouped.task
            .map((m) => `- ${m.value}`)
            .join("\n")
      );
    }

    if (grouped.preference && grouped.preference.length > 0) {
      sections.push(
        "## 你的偏好设置\n" +
          grouped.preference
            .map((m) => `- ${m.key}: ${m.value}`)
            .join("\n")
      );
    }

    return sections.length > 0
      ? "## 你的记忆库\n" + sections.join("\n\n")
      : "";
  } catch (error) {
    console.error(`[AgentMemory] 获取记忆失败 (agentId=${agentId}):`, error);
    return "";
  }
}

/**
 * 写入 Agent 记忆
 * @param params 记忆参数
 */
export async function writeAgentMemory(params: {
  agentId: string;
  type: "experience" | "content" | "kpi" | "task" | "preference";
  key: string;
  value: string;
  expiresInDays?: number;
}): Promise<void> {
  const { agentId, type, key, value, expiresInDays = 30 } = params;

  try {
    const expiresAt = expiresInDays === null ? null : new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    await prisma.agentMemory.upsert({
      where: {
        agentId_type_key: { agentId, type, key },
      },
      update: {
        value,
        expiresAt,
        updatedAt: new Date(),
      },
      create: {
        agentId,
        type,
        key,
        value,
        expiresAt,
      },
    });
  } catch (error) {
    console.error(
      `[AgentMemory] 写入记忆失败 (agentId=${agentId}, type=${type}, key=${key}):`,
      error
    );
  }
}

/**
 * 从 Agent 输出中自动提取并保存记忆
 * 解析输出里的结构化内容，存储关键信息
 * @param agentId Agent ID
 * @param output Agent 输出
 * @param taskType 任务类型
 */
export async function extractAndSaveMemory(
  agentId: string,
  output: string,
  taskType?: string
): Promise<void> {
  if (!output || output.length === 0) {
    return;
  }

  try {
    // 尝试提取 KPI 数据（DFM 输出）
    const kpiMatch = output.match(
      /\[KPI_SUMMARY\]([\s\S]*?)\[\/KPI_SUMMARY\]/
    );
    if (kpiMatch) {
      const kpiData = kpiMatch[1].trim();
      const kpiLines = kpiData.split("\n");

      for (const line of kpiLines) {
        const [key, value] = line.split(":").map((s) => s.trim());
        if (key && value) {
          await writeAgentMemory({
            agentId,
            type: "kpi",
            key: key.toLowerCase(),
            value,
            expiresInDays: 30,
          });
        }
      }
    }

    // 尝试提取内容元数据（PM01 输出）
    const contentMatch = output.match(
      /\[CONTENT_META\]([\s\S]*?)\[\/CONTENT_META\]/
    );
    if (contentMatch) {
      const contentData = contentMatch[1].trim();

      // 提取标题
      const titleMatch = contentData.match(/Title:\s*(.+?)(?:\n|$)/i);
      if (titleMatch) {
        await writeAgentMemory({
          agentId,
          type: "content",
          key: "last_published_title",
          value: titleMatch[1].trim(),
          expiresInDays: 60,
        });
      }

      // 提取关键词
      const keywordsMatch = contentData.match(/Keywords:\s*(.+?)(?:\n|$)/i);
      if (keywordsMatch) {
        const keywords = keywordsMatch[1].trim();
        await writeAgentMemory({
          agentId,
          type: "content",
          key: "published_keywords",
          value: keywords,
          expiresInDays: 60,
        });
      }
    }

    // 检测发布成功（常见的内容发布确认）
    const publishKeywords = [
      "已发布",
      "发布成功",
      "已成功发布",
      "publish success",
      "published",
    ];
    const isPublished = publishKeywords.some((kw) =>
      output.toLowerCase().includes(kw.toLowerCase())
    );

    if (isPublished && taskType) {
      await writeAgentMemory({
        agentId,
        type: "task",
        key: `published_${Date.now()}`,
        value: `完成 ${taskType} 任务并发布，时间：${new Date().toISOString()}`,
        expiresInDays: 90,
      });
    }

    // 提取任何带有 [MEMORY] 标签的内容
    const memoryMatches = output.matchAll(/\[MEMORY:(\w+)\]\s*(.+?)(?:\n|$)/gi);
    for (const match of memoryMatches) {
      const memType = match[1].toLowerCase();
      const memValue = match[2].trim();

      // 验证类型是否有效
      if (["experience", "content", "kpi", "task", "preference"].includes(memType)) {
        await writeAgentMemory({
          agentId,
          type: memType as "experience" | "content" | "kpi" | "task" | "preference",
          key: `auto_${Date.now()}`,
          value: memValue,
          expiresInDays: 30,
        });
      }
    }
  } catch (error) {
    console.error(
      `[AgentMemory] 提取记忆失败 (agentId=${agentId}):`,
      error
    );
    // 不抛异常，这是可选的增强功能
  }
}

/**
 * 获取最近的 KPI 快照作为记忆上下文
 * 从 KpiSnapshot 表读取最近数据，格式化为文字
 * @param limit 获取数量，默认 10
 * @returns 格式化的 KPI 文本
 */
export async function getKpiMemoryContext(limit: number = 10): Promise<string> {
  try {
    const snapshots = await prisma.kpiSnapshot.findMany({
      orderBy: { date: "desc" },
      take: limit,
    });

    if (snapshots.length === 0) {
      return "";
    }

    // 按日期倒序分组
    const grouped = snapshots.reduce(
      (acc, snap) => {
        const dateStr = snap.date.toISOString().split("T")[0];
        if (!acc[dateStr]) {
          acc[dateStr] = [];
        }
        acc[dateStr].push(snap);
        return acc;
      },
      {} as Record<string, typeof snapshots>
    );

    const lines: string[] = [];
    for (const [date, snaps] of Object.entries(grouped).sort().reverse()) {
      lines.push(`**${date}**`);
      for (const snap of snaps) {
        const deltaStr = snap.delta
          ? ` (${snap.delta > 0 ? "+" : ""}${snap.delta.toFixed(2)})`
          : "";
        lines.push(`  - ${snap.metric}: ${snap.value.toFixed(2)}${deltaStr}`);
      }
    }

    return "## 最近 KPI 数据\n" + lines.join("\n");
  } catch (error) {
    console.error("[AgentMemory] 获取 KPI 记忆失败:", error);
    return "";
  }
}
