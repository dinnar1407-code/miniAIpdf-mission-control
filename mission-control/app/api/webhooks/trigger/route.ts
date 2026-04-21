import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { executeWorkflow } from "@/lib/workflow-engine";

// 通用 Webhook 触发端点
// POST /api/webhooks/trigger?event=<eventName>
// POST /api/webhooks/trigger/<eventName>   (通过 path params)
//
// Body：任意 JSON，会作为 triggerData 传入工作流
// Headers:
//   X-Webhook-Secret: <secret>  （可选，与 workflow triggerConfig.secret 匹配时才触发）
//
// 触发规则：查找所有 status=active AND triggerType=webhook
//   - triggerConfig.event 与 ?event= 参数匹配（或为空则触发所有 active webhook 工作流）
//   - secret 匹配（若配置了 secret）

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  // 读取 event 名称：优先 query param，其次 body 中的 event 字段
  const { searchParams } = new URL(req.url);
  const eventFromQuery = searchParams.get("event");

  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    // 非 JSON body 忽略
  }

  const eventName: string = eventFromQuery || (body.event as string) || "";
  const incomingSecret = req.headers.get("x-webhook-secret") || (body.secret as string) || "";

  // 查找所有 active webhook 类型的工作流
  const workflows = await prisma.workflow.findMany({
    where: { status: "active", triggerType: "webhook" },
  });

  if (workflows.length === 0) {
    return NextResponse.json({ triggered: 0, message: "No active webhook workflows found" });
  }

  const triggered: string[] = [];
  const skipped: string[] = [];

  for (const wf of workflows) {
    let triggerConfig: Record<string, string> = {};
    try {
      triggerConfig = typeof wf.triggerConfig === "string"
        ? JSON.parse(wf.triggerConfig)
        : (wf.triggerConfig as Record<string, string>) || {};
    } catch {}

    // 检查 event 匹配（若 workflow 配置了 event，必须与传入 event 匹配）
    const requiredEvent = triggerConfig.event || "";
    if (requiredEvent && eventName && requiredEvent !== eventName) {
      skipped.push(wf.id);
      continue;
    }

    // 检查 secret（若 workflow 配置了 secret，必须匹配）
    const requiredSecret = triggerConfig.secret || "";
    if (requiredSecret && incomingSecret !== requiredSecret) {
      skipped.push(wf.id);
      continue;
    }

    // 异步触发，不阻塞响应
    const triggerData = {
      ...body,
      event: eventName,
      triggeredAt: new Date().toISOString(),
      source: "webhook",
    };

    // fire-and-forget（避免请求超时影响触发结果）
    void executeWorkflow(wf.id, triggerData).catch(err => {
      console.error(`[Webhook] Workflow ${wf.id} failed:`, err);
    });

    triggered.push(wf.id);
  }

  return NextResponse.json({
    triggered: triggered.length,
    skipped: skipped.length,
    workflowIds: triggered,
    event: eventName || null,
  });
}

// GET：健康检查 + 查看当前 active webhook 工作流列表
export async function GET() {
  const workflows = await prisma.workflow.findMany({
    where: { status: "active", triggerType: "webhook" },
    select: { id: true, name: true, triggerConfig: true, updatedAt: true },
  });

  return NextResponse.json({
    status: "ok",
    activeWebhookWorkflows: workflows.map(wf => ({
      id: wf.id,
      name: wf.name,
      event: (() => {
        try {
          const c = typeof wf.triggerConfig === "string"
            ? JSON.parse(wf.triggerConfig)
            : wf.triggerConfig;
          return (c as Record<string, string>).event || null;
        } catch { return null; }
      })(),
      updatedAt: wf.updatedAt,
    })),
  });
}
