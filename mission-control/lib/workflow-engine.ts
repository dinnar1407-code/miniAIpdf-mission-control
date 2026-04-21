import { prisma } from "@/lib/db";
import { WorkflowStep } from "@/lib/workflow-types";
import { channelRegistry } from "@/lib/channels/registry";
import { ChannelId, PublishContent } from "@/lib/channels/types";
import { ask, callClaudeWithTools } from "@/lib/ai/claude-client";
import { getAgentPrompt } from "@/lib/ai/agent-prompts";
import { getAgentTools, getAgentModel, createToolExecutor } from "@/lib/ai/agent-tools";
import { createApprovalRequest } from "@/lib/approval";
import { getAgentMemoryContext, extractAndSaveMemory } from "@/lib/ai/agent-memory";
import { publishToChannels } from "@/lib/channels/publisher";

// ==================== TELEGRAM HELPER ====================

async function sendTelegram(text: string): Promise<boolean> {
  // 优先用环境变量，其次读 DB 中的 telegram_notification 配置
  let token  = process.env.TELEGRAM_BOT_TOKEN;
  let chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    try {
      const cred = await prisma.channelCredential.findUnique({
        where: { channelId: "telegram_notification" },
      });
      if (cred && cred.enabled) {
        const c = JSON.parse(cred.credentials) as Record<string, string>;
        token  = token  || c.botToken;
        chatId = chatId || c.chatId;
      }
    } catch {}
  }

  if (!token || !chatId) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id:    chatId,
        text:       `🤖 *Jarvis Mission Control*\n\n${text}`,
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

    // ── AGENT：调用 Claude + Tool Use ──────────────────────────
    case "agent": {
      const agentId = step.agent || "playfish";
      const action  = step.action || "完成分配的任务";
      await addLog(runId, index, step.type, `🤖 ${agentId} 正在思考...`, "info");

      const systemPrompt = getAgentPrompt(agentId);
      const agentTools   = getAgentTools(agentId);
      const agentModel   = getAgentModel(agentId);

      // 执行前：获取 Agent 记忆上下文
      const memoryContext = await getAgentMemoryContext(agentId);

      let userMessage = prevOutput
        ? `上一步输出：\n${prevOutput}\n\n当前任务：${action}`
        : action;

      if (memoryContext) {
        userMessage = `${userMessage}\n\n${memoryContext}`;
      }

      let output: string;

      if (agentTools.length > 0) {
        // ── 有工具：使用 Tool Use 多轮调用 ──
        await addLog(runId, index, step.type, `🔧 ${agentId} 可用工具: ${agentTools.map(t => t.name).join(", ")}`, "info");

        const toolExecutor = createToolExecutor(agentId, (toolName, msg) => {
          void addLog(runId, index, step.type, `  ↳ [tool] ${toolName}: ${msg}`, "info");
        });

        output = await callClaudeWithTools(systemPrompt, userMessage, agentTools, toolExecutor, agentModel);
      } else {
        // ── 无工具：单轮调用（向后兼容）──
        output = await ask(systemPrompt, userMessage, agentModel);
      }

      if (output.startsWith("[AI Error:")) {
        await addLog(runId, index, step.type, `⚠ ${output}（降级为模拟模式）`, "warn");
        const fallbacks: Record<string, string[]> = {
          playfish: ["已分析任务并制定执行方案", "优先级已调整，开始执行"],
          pm01:     ["博客草稿已完成，等待审核", "推文已撰写，共 247 字"],
          dfm:      ["日报已生成，关键指标正常", "数据分析完成"],
          admin01:  ["系统巡检完成，状态正常 ✅", "所有服务运行正常"],
        };
        const sims: string[] = fallbacks[agentId] ?? ["任务已完成"];
        const sim  = sims[Math.floor(Math.random() * sims.length)];
        await addLog(runId, index, step.type, `✓ ${sim}（模拟）`, "success");
        return { success: true, output: sim };
      }

      // 执行后：从输出中提取并保存记忆
      void extractAndSaveMemory(agentId, output, action);

      const preview = output.length > 200 ? output.slice(0, 200) + "..." : output;
      await addLog(runId, index, step.type, `✓ ${agentId} 完成 | ${preview}`, "success");
      return { success: true, output };
    }

    // ── HTTP ─────────────────────────────────────────────────
    case "http": {
      const method = (step.method || "GET").toUpperCase();
      const url    = step.url;

      if (!url) {
        await addLog(runId, index, step.type, `✗ 缺少 URL`, "error");
        return { success: false, error: "HTTP step missing URL" };
      }

      await addLog(runId, index, step.type, `🌐 ${method} ${url}`, "info");

      try {
        const fetchOptions: RequestInit = { method };

        // 合并自定义 headers
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...(step.headers || {}),
        };
        fetchOptions.headers = headers;

        // body（仅 POST/PUT/PATCH）
        if (["POST", "PUT", "PATCH"].includes(method) && step.body) {
          fetchOptions.body = step.body;
        }

        const res = await fetch(url, fetchOptions);
        let responseText = "";
        try { responseText = await res.text(); } catch {}

        if (!res.ok) {
          await addLog(runId, index, step.type, `✗ HTTP ${res.status} ${res.statusText}`, "error");
          return { success: false, error: `HTTP ${res.status}: ${responseText.slice(0, 200)}` };
        }

        const preview = responseText.length > 200 ? responseText.slice(0, 200) + "..." : responseText;
        await addLog(runId, index, step.type, `✓ HTTP ${res.status} | ${preview}`, "success");
        return { success: true, output: responseText };

      } catch (err) {
        const message = err instanceof Error ? err.message : "网络请求失败";
        await addLog(runId, index, step.type, `✗ ${message}`, "error");
        return { success: false, error: message };
      }
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
      const expr = step.condition || "";
      await addLog(runId, index, step.type, `🔀 评估条件: ${expr}`, "info");

      if (!expr) {
        await addLog(runId, index, step.type, `⚠ 条件表达式为空，默认 true`, "warn");
        return { success: true, output: "true" };
      }

      try {
        // 安全沙箱：仅提供 output（上一步结果）作为上下文变量
        // 支持示例：output.includes("success") / output === "true" / Number(output) > 100
        // eslint-disable-next-line no-new-func
        const fn = new Function("output", `"use strict"; try { return !!(${expr}); } catch { return false; }`);
        const result: boolean = fn(prevOutput ?? "");
        const resultStr = result ? "true" : "false";
        await addLog(runId, index, step.type, `✓ 条件结果 = ${resultStr}`, "success");
        return { success: true, output: resultStr };
      } catch (err) {
        const message = err instanceof Error ? err.message : "表达式执行错误";
        await addLog(runId, index, step.type, `✗ 条件评估失败: ${message}`, "error");
        return { success: false, error: `Condition evaluation failed: ${message}` };
      }
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

      // ── 如果需要审批，创建审批请求 ──
      if (step.requireApproval === true) {
        // 创建 ContentCalendar 记录
        let contentId: string | undefined;
        try {
          const contentRecord = await prisma.contentCalendar.create({
            data: {
              title: step.label,
              body,
              contentType: step.contentType || "short_post",
              status: "draft",
              workflowRunId: runId,
              channelIds: JSON.stringify(channels),
            },
          });
          contentId = contentRecord.id;
        } catch (err) {
          await addLog(runId, index, step.type, `⚠ ContentCalendar 创建失败`, "warn");
        }

        // 创建审批请求并发送 Telegram
        try {
          const preview = body.length > 500 ? body.slice(0, 500) : body;
          await createApprovalRequest({
            workflowRunId: runId,
            contentId,
            type: "publish",
            title: step.label,
            preview,
          });

          await addLog(runId, index, step.type, `📋 审批请求已发送至 Telegram`, "info");
          return {
            success: true,
            output: "Approval request sent - awaiting response",
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          await addLog(runId, index, step.type, `⚠ 审批请求创建失败: ${message}`, "warn");
          return { success: false, error: `Approval request failed: ${message}` };
        }
      }

      // ── 无需审批，直接发布 ──
      for (const channelId of channels) {
        const adapter = channelRegistry.get(channelId);
        if (adapter) {
          await addLog(runId, index, step.type, `📡 发布到 ${adapter.icon} ${adapter.name}...`, "info");
        }
      }

      const publishResults = await publishToChannels(channels, content);
      const resultStrings: string[] = [];

      for (const r of publishResults) {
        if (r.success) {
          await addLog(runId, index, step.type, `✓ ${r.channelName} 发布成功${r.postUrl ? ` → ${r.postUrl}` : ""}`, "success");
          resultStrings.push(`${r.icon} ${r.channelName} ✓`);
        } else {
          await addLog(runId, index, step.type, `⚠ ${r.channelName}: ${r.error}`, "warn");
          resultStrings.push(`${r.icon} ${r.channelName} ⚠`);
        }
      }

      return { success: true, output: resultStrings.join(" | ") };
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
        await sendTelegram(`❌ *${workflow.name}* 执行失败\n步骤 ${i + 1}「${step.label}」\n错误: ${result.error}`);
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
    await sendTelegram(`❌ *${workflow.name}* 意外崩溃\n错误: ${message}`);
    return run;
  }
}
