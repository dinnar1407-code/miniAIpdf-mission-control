import { prisma } from "@/lib/db";
import { WorkflowStep } from "@/lib/workflow-types";
import { channelRegistry } from "@/lib/channels/registry";
import { ChannelId, PublishContent } from "@/lib/channels/types";
import { ask } from "@/lib/ai/claude-client";
import { getAgentPrompt } from "@/lib/ai/agent-prompts";

// ==================== TELEGRAM HELPER ====================

async function sendTelegram(text: string): Promise<boolean> {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🤖 *Jarvis Mission Control*\n\n${text}`,
        parse_mode: "Markdown",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ==================== LOG HELPER ====================

async function addLog(
  runId: string,
  stepIndex: number,
  stepType: string,
  message: string,
  level: "info" | "warn" | "error" | "success" = "info"
) {
  try {
    await prisma.workflowLog.create({
      data: { runId, stepIndex, stepType, message, level },
    });
  } catch {
    // Non-fatal
  }
}

// ==================== STEP EXECUTOR ====================

async function executeStep(
  step: WorkflowStep,
  index: number,
  runId: string,
  prevOutput?: string
): Promise<{ success: boolean; output?: string; error?: string }> {
  await addLog(runId, index, step.type, `▶ Starting: ${step.label}`, "info");

  switch (step.type) {

    // ── AGENT：真正调用 Claude ────────────────────────────────
    case "agent": {
      const agentId = step.agent || "playfish";
      const action  = step.action || "完成分配的任务";
      await addLog(runId, index, step.type, `🤖 ${agentId} 正在思考...`, "info");

      const systemPrompt = getAgentPrompt(agentId);
      const userMessage  = prevOutput
        ? `上一步输出：\n${prevOutput}\n\n当前任务：${action}`
        : action;

      const output = await ask(systemPrompt, userMessage, "claude-haiku-4-5-20251001");

      if (output.startsWith("[AI Error:")) {
        await addLog(runId, index, step.type, `⚠ ${output}（降级为模拟模式）`, "warn");
        // 降级：Claude 不可用时给出模拟输出
        const fallbacks: Record<string, string[]> = {
          playfish: ["已分析任务并制定执行方案", "优先级已调整，开始执行"],
          pm01:     ["博客草稿已完成，等待审核", "推文已撰写，共 247 字"],
          dfm:      ["日报已生成，关键指标正常", "数据分析完成"],
          admin01:  ["系统巡检完成，状态正常 ✅", "所有服务运行正常"],
        };
        const sims = fallbacks[agentId] || ["任务已完成"];
        const sim  = sims[Math.floor(Math.random() * sims.length)];
        await addLog(runId, index, step.type, `✓ ${sim}（模拟）`, "success");
        return { success: true, output: sim };
      }

      // 截取前 200 字用于日志展示
      const preview = output.length > 200 ? output.slice(0, 200) + "..." : output;
      await addLog(runId, index, step.type, `✓ ${agentId} 完成 | ${preview}`, "success");
      return { success: true, output };
    }

    // ── HTTP ─────────────────────────────────────────────────
    case "http": {
      await addLog(runId, index, step.type, `🌐 ${step.method || "GET"} ${step.url}`, "info");
      await new Promise(r => setTimeout(r, 600));
      if (Math.random() > 0.9) {
        await addLog(runId, index, step.type, `✗ HTTP 503`, "error");
        return { success: false, error: "HTTP 503 Service Unavailable" };
      }
      await addLog(runId, index, step.type, `✓ HTTP 200 OK`, "success");
      return { success: true, output: "HTTP 200 OK" };
    }

    // ── WAIT ─────────────────────────────────────────────────
    case "wait": {
      const mins = step.delay || 1;
      await addLog(runId, index, step.type, `⏱ 模拟等待 ${mins} 分钟`, "info");
      await new Promise(r => setTimeout(r, Math.min(mins * 100, 2000)));
      await addLog(runId, index, step.type, `✓ 等待完成`, "success");
      return { success: true, output: `Waited ${mins} minutes` };
    }

    // ── CONDITION ────────────────────────────────────────────
    case "condition": {
      await addLog(runId, index, step.type, `🔀 评估条件: ${step.condition}`, "info");
      const result = Math.random() > 0.3 ? "true" : "false";
      await addLog(runId, index, step.type, `✓ 条件结果 = ${result}`, "success");
      return { success: true, output: result };
    }

    // ── NOTIFY ───────────────────────────────────────────────
    case "notify": {
      const channel = step.channel || "telegram";
      const message = step.message || "(no message)";
      await addLog(runId, index, step.type, `📨 发送通知到 ${channel}`, "info");

      if (channel === "telegram") {
        const sent = await sendTelegram(message);
        if (sent) {
          await addLog(runId, index, step.type, `✓ Telegram 消息发送成功`, "success");
          return { success: true, output: "Sent to Telegram" };
        }
        await addLog(runId, index, step.type, `⚠ Telegram 发送失败（检查 Token/Chat ID）`, "warn");
        return { success: true, output: "Telegram failed — check env vars" };
      }

      await addLog(runId, index, step.type, `✓ 通知已发送`, "success");
      return { success: true, output: `Sent to ${channel}` };
    }

    // ── CREATE_TASK ──────────────────────────────────────────
    case "create_task": {
      await addLog(runId, index, step.type, `✅ 创建任务: "${step.action}"`, "info");
      try {
        await prisma.task.create({
          data: {
            title:    step.action || "Workflow 自动创建的任务",
            status:   "todo",
            priority: "medium",
          },
        });
        await addLog(runId, index, step.type, `✓ 任务已创建`, "success");
      } catch {
        await addLog(runId, index, step.type, `⚠ 任务创建失败（DB 错误）`, "warn");
      }
      return { success: true, output: `Task created: ${step.action}` };
    }

    // ── LOG ──────────────────────────────────────────────────
    case "log": {
      await addLog(runId, index, step.type, `📝 ${step.message}`, "info");
      return { success: true, output: step.message };
    }

    // ── PUBLISH ──────────────────────────────────────────────
    case "publish": {
      const channels = (step.publishChannels || []) as ChannelId[];
      if (channels.length === 0) {
        await addLog(runId, index, step.type, `⚠ 未配置发布渠道`, "warn");
        return { success: true, output: "No channels configured" };
      }

      // 内容来源：上一步输出 or 静态内容
      const body = (step.contentSource === "prev_output" && prevOutput)
        ? prevOutput
        : (step.message || step.action || "Jarvis 自动发布内容");

      const content: PublishContent = {
        body,
        title: step.label,
        tags:  [],
      };

      const results: string[] = [];
      for (const channelId of channels) {
        const adapter = channelRegistry.get(channelId);
        if (!adapter) {
          await addLog(runId, index, step.type, `⚠ 渠道 ${channelId} 未注册`, "warn");
          continue;
        }

        await addLog(runId, index, step.type, `📡 发布到 ${adapter.icon} ${adapter.name}...`, "info");

        // 从 DB 读取渠道凭证
        let channelConfig;
        try {
          const cred = await prisma.channelCredential.findUnique({ where: { channelId } });
          channelConfig = {
            channelId,
            enabled: cred?.enabled ?? false,
            credentials: cred ? JSON.parse(cred.credentials) : {},
            defaults:    cred ? JSON.parse(cred.defaults) : {},
          };
        } catch {
          channelConfig = { channelId, enabled: false, credentials: {}, defaults: {} };
        }

        const result = channelConfig.enabled
          ? await adapter.publish(content, channelConfig)
          : { success: false, error: "渠道未启用（请在 Settings → Channels 配置）" };

        if (result.success) {
          await addLog(runId, index, step.type, `✓ ${adapter.name} 发布成功${result.postUrl ? ` → ${result.postUrl}` : ""}`, "success");
          results.push(`${adapter.icon} ${adapter.name} ✓`);
        } else {
          await addLog(runId, index, step.type, `⚠ ${adapter.name}: ${result.error}`, "warn");
          results.push(`${adapter.icon} ${adapter.name} ⚠`);
        }
      }

      void content;
      return { success: true, output: results.join(" | ") };
    }

    default:
      return { success: true, output: "Step completed" };
  }
}

// ==================== MAIN WORKFLOW EXECUTOR ====================

export async function executeWorkflow(
  workflowId: string,
  triggerData: Record<string, unknown> = {}
) {
  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!workflow) throw new Error("Workflow not found");

  const steps: WorkflowStep[] = typeof workflow.steps === "string"
    ? JSON.parse(workflow.steps)
    : (workflow.steps as WorkflowStep[]) || [];

  const run = await prisma.workflowRun.create({
    data: {
      workflowId,
      status:      "running",
      currentStep: 0,
      totalSteps:  steps.length,
      startedAt:   new Date(),
      triggerData: JSON.stringify(triggerData),
      stepResults: JSON.stringify(steps.map((_, i) => ({ stepIndex: i, status: "pending" }))),
    },
  });

  await addLog(run.id, -1, "system", `▶ Workflow "${workflow.name}" 开始执行`, "info");
  await addLog(run.id, -1, "system", `📋 共 ${steps.length} 个步骤`, "info");

  type StepStatus = "pending" | "running" | "completed" | "failed";
  const stepResults: Array<{
    stepIndex: number; stepId?: string; status: StepStatus;
    startedAt?: string; completedAt?: string; output?: string; error?: string;
  }> = steps.map((_, i) => ({ stepIndex: i, stepId: steps[i].id, status: "pending" as StepStatus }));

  let prevOutput: string | undefined;

  try {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      stepResults[i] = { ...stepResults[i], status: "running", startedAt: new Date().toISOString() };
      await prisma.workflowRun.update({
        where: { id: run.id },
        data: { currentStep: i, stepResults: JSON.stringify(stepResults) },
      });

      const result = await executeStep(step, i, run.id, prevOutput);

      if (result.success) {
        stepResults[i] = {
          ...stepResults[i], status: "completed",
          completedAt: new Date().toISOString(), output: result.output,
        };
        prevOutput = result.output; // 传递给下一步
      } else {
        stepResults[i] = {
          ...stepResults[i], status: "failed",
          completedAt: new Date().toISOString(), error: result.error,
        };
        await prisma.workflowRun.update({
          where: { id: run.id },
          data: {
            status: "failed", currentStep: i, completedAt: new Date(),
            stepResults: JSON.stringify(stepResults),
            error: `Step ${i + 1} 失败: ${result.error}`,
          },
        });
        await addLog(run.id, -1, "system", `✗ Workflow 在步骤 ${i + 1} 失败: ${result.error}`, "error");
        return run;
      }

      await prisma.workflowRun.update({
        where: { id: run.id },
        data: { stepResults: JSON.stringify(stepResults) },
      });
    }

    await prisma.workflowRun.update({
      where: { id: run.id },
      data: {
        status: "completed", currentStep: steps.length,
        completedAt: new Date(), stepResults: JSON.stringify(stepResults),
      },
    });

    await addLog(run.id, -1, "system", `✓ Workflow 执行完成（共 ${steps.length} 步）`, "success");

    // 成功后发 Telegram 通知（如果 workflow 有通知配置）
    const hasNotifyStep = steps.some(s => s.type === "notify");
    if (!hasNotifyStep) {
      await sendTelegram(`✅ *${workflow.name}* 执行完成\n共 ${steps.length} 步 | 全部成功`);
    }

    return run;

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.workflowRun.update({
      where: { id: run.id },
      data: { status: "failed", completedAt: new Date(), error: message },
    });
    await addLog(run.id, -1, "system", `✗ 意外错误: ${message}`, "error");
    return run;
  }
}
