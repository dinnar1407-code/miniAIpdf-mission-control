import { prisma } from "@/lib/db";
import { WorkflowStep } from "@/lib/workflow-types";

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

// ==================== WORKFLOW EXECUTION ENGINE ====================

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

async function simulateStep(
  step: WorkflowStep,
  index: number,
  runId: string
): Promise<{ success: boolean; output?: string; error?: string }> {
  await addLog(runId, index, step.type, `▶ Starting step: ${step.label}`, "info");

  // Simulate realistic execution time
  const delay = step.type === "wait"
    ? Math.min((step.delay || 1) * 100, 2000) // cap at 2s for simulation
    : Math.floor(Math.random() * 1500) + 300;

  await new Promise(r => setTimeout(r, delay));

  switch (step.type) {
    case "agent": {
      const agent = step.agent || "playfish";
      await addLog(runId, index, step.type, `🤖 ${agent}: ${step.action}`, "info");
      await new Promise(r => setTimeout(r, 800));
      const outputs: Record<string, string[]> = {
        playfish: ["Task analyzed and executed", "Strategic action completed", "Decision made and implemented"],
        pm01:     ["Content created and scheduled", "Post published successfully", "Thread drafted (245 chars)"],
        admin01:  ["Operations check complete", "Systems nominal", "Monitoring active"],
        dfm:      ["Analytics report generated", "Data processed successfully", "Metrics compiled"],
        "pm01-b": ["Content batch processed", "Drafts ready for review"],
      };
      const agentOutputs = outputs[agent] || ["Task completed"];
      const output = agentOutputs[Math.floor(Math.random() * agentOutputs.length)];
      await addLog(runId, index, step.type, `✓ ${output}`, "success");
      return { success: true, output };
    }

    case "http": {
      await addLog(runId, index, step.type, `🌐 ${step.method} ${step.url}`, "info");
      await new Promise(r => setTimeout(r, 600));
      // Simulate 90% success rate
      if (Math.random() > 0.9) {
        await addLog(runId, index, step.type, `✗ HTTP 503 Service Unavailable`, "error");
        return { success: false, error: "HTTP 503 Service Unavailable" };
      }
      await addLog(runId, index, step.type, `✓ HTTP 200 OK — response received`, "success");
      return { success: true, output: "HTTP 200 OK" };
    }

    case "wait": {
      const mins = step.delay || 1;
      await addLog(runId, index, step.type, `⏱ Simulating wait: ${mins} min (fast mode)`, "info");
      await addLog(runId, index, step.type, `✓ Wait complete`, "success");
      return { success: true, output: `Waited ${mins} minutes` };
    }

    case "condition": {
      await addLog(runId, index, step.type, `🔀 Evaluating: ${step.condition}`, "info");
      const result = Math.random() > 0.3 ? "true" : "false";
      await addLog(runId, index, step.type, `✓ Condition = ${result}`, "success");
      return { success: true, output: result };
    }

    case "notify": {
      const channel = step.channel || "telegram";
      const message = step.message || "(no message)";
      await addLog(runId, index, step.type, `📨 Sending to ${channel}: "${message}"`, "info");

      if (channel === "telegram") {
        const sent = await sendTelegram(message);
        if (sent) {
          await addLog(runId, index, step.type, `✓ Telegram message delivered`, "success");
          return { success: true, output: `Sent to Telegram` };
        } else {
          await addLog(runId, index, step.type, `⚠ Telegram delivery failed (check token/chat ID)`, "warn");
          return { success: true, output: `Telegram failed — check env vars` };
        }
      }

      await addLog(runId, index, step.type, `✓ Notification sent`, "success");
      return { success: true, output: `Sent to ${channel}` };
    }

    case "create_task": {
      await addLog(runId, index, step.type, `✅ Creating task: "${step.action}"`, "info");
      await addLog(runId, index, step.type, `✓ Task created`, "success");
      return { success: true, output: `Task created: ${step.action}` };
    }

    case "log": {
      await addLog(runId, index, step.type, `📝 ${step.message}`, "info");
      return { success: true, output: step.message };
    }

    default:
      return { success: true, output: "Step completed" };
  }
}

export async function executeWorkflow(workflowId: string, triggerData: Record<string, unknown> = {}) {
  // Load workflow
  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!workflow) throw new Error("Workflow not found");

  const steps: WorkflowStep[] = typeof workflow.steps === "string"
    ? JSON.parse(workflow.steps)
    : (workflow.steps as WorkflowStep[]) || [];

  // Create run record
  const run = await prisma.workflowRun.create({
    data: {
      workflowId,
      status: "running",
      currentStep: 0,
      totalSteps: steps.length,
      startedAt: new Date(),
      triggerData: JSON.stringify(triggerData),
      stepResults: JSON.stringify(steps.map((_, i) => ({
        stepIndex: i, status: "pending",
      }))),
    },
  });

  await addLog(run.id, -1, "system", `▶ Workflow "${workflow.name}" started`, "info");
  await addLog(run.id, -1, "system", `📋 ${steps.length} steps to execute`, "info");

  const stepResults = steps.map((_, i) => ({
    stepIndex: i, stepId: steps[i].id, status: "pending" as const,
  }));

  try {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      // Update run: mark step as running
      stepResults[i] = { ...stepResults[i], status: "running", startedAt: new Date().toISOString() };
      await prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          currentStep: i,
          stepResults: JSON.stringify(stepResults),
        },
      });

      const result = await simulateStep(step, i, run.id);

      if (result.success) {
        stepResults[i] = {
          ...stepResults[i],
          status: "completed",
          completedAt: new Date().toISOString(),
          output: result.output,
        };
      } else {
        stepResults[i] = {
          ...stepResults[i],
          status: "failed",
          completedAt: new Date().toISOString(),
          error: result.error,
        };

        await prisma.workflowRun.update({
          where: { id: run.id },
          data: {
            status: "failed",
            currentStep: i,
            completedAt: new Date(),
            stepResults: JSON.stringify(stepResults),
            error: `Step ${i + 1} failed: ${result.error}`,
          },
        });

        await addLog(run.id, -1, "system", `✗ Workflow failed at step ${i + 1}: ${result.error}`, "error");
        return run;
      }

      await prisma.workflowRun.update({
        where: { id: run.id },
        data: { stepResults: JSON.stringify(stepResults) },
      });
    }

    // All steps passed
    await prisma.workflowRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
        currentStep: steps.length,
        completedAt: new Date(),
        stepResults: JSON.stringify(stepResults),
      },
    });

    await addLog(run.id, -1, "system", `✓ Workflow completed successfully (${steps.length} steps)`, "success");
    return run;

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.workflowRun.update({
      where: { id: run.id },
      data: { status: "failed", completedAt: new Date(), error: message },
    });
    await addLog(run.id, -1, "system", `✗ Unexpected error: ${message}`, "error");
    return run;
  }
}
