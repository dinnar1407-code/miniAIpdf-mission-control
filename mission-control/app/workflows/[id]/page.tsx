"use client";

import { Header } from "@/components/layout/header";
import { WorkflowEditor } from "@/components/workflows/workflow-editor";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { WorkflowData } from "@/lib/workflow-types";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

// Mock data for demo
const MOCK_WORKFLOWS: Record<string, Partial<WorkflowData>> = {
  "ph-launch-flow": {
    id: "ph-launch-flow",
    name: "Product Hunt Launch Flow",
    description: "Publish everywhere when PH goes live",
    triggerType: "manual",
    triggerConfig: {},
    status: "draft",
    steps: [
      { id: "s1", type: "agent", label: "Draft PH Tweet", agent: "playfish", action: "Draft a Product Hunt launch tweet for MiniAIPDF. Include link, key benefit, and call to action.", config: {} },
      { id: "s2", type: "agent", label: "Post to Communities", agent: "pm01", action: "Post MiniAIPDF PH launch announcement to: HackerNews, IndieHackers, relevant Slack groups", config: {} },
      { id: "s3", type: "notify", label: "Notify Terry", channel: "telegram", message: "🚀 PH Launch flow complete! Check results.", config: {} },
    ],
  },
  "daily-standup": {
    id: "daily-standup",
    name: "Daily Operations Standup",
    description: "Morning analytics + alerts + content",
    triggerType: "schedule",
    triggerConfig: { cron: "0 9 * * 1-5" },
    status: "active",
    steps: [
      { id: "s1", type: "agent",  label: "Generate Analytics",   agent: "dfm",     action: "Generate daily analytics snapshot: traffic, signups, API calls, revenue", config: {} },
      { id: "s2", type: "agent",  label: "Check All Platforms",  agent: "admin01", action: "Check Shopify, Twitter, Product Hunt, Stripe for any issues or alerts", config: {} },
      { id: "s3", type: "agent",  label: "Post Scheduled Content", agent: "pm01",  action: "Post any content scheduled for today across all platforms", config: {} },
      { id: "s4", type: "notify", label: "Morning Briefing",     channel: "telegram", message: "Good morning Terry! Daily standup complete. Check Mission Control for details.", config: {} },
    ],
  },
  "api-customer-onboarding": {
    id: "api-customer-onboarding",
    name: "API Customer Onboarding",
    description: "Welcome + setup when new API customer signs up",
    triggerType: "webhook",
    triggerConfig: { webhookPath: "/api-signup" },
    status: "draft",
    steps: [
      { id: "s1", type: "agent",       label: "Send Welcome Email", agent: "playfish", action: "Send personalized welcome email to new API customer. Include getting started guide.", config: {} },
      { id: "s2", type: "create_task", label: "Create Onboarding Task", action: "Follow up with new API customer after 3 days", config: {} },
      { id: "s3", type: "log",         label: "Log Signup", message: "New API customer onboarded", config: {} },
    ],
  },
};

export default function WorkflowDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [workflow, setWorkflow] = useState<Partial<WorkflowData> | null>(null);

  useEffect(() => {
    // Try API first, fallback to mock
    fetch(`/api/workflows/${params.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setWorkflow({
            ...data,
            steps: typeof data.steps === "string" ? JSON.parse(data.steps) : data.steps,
            triggerConfig: typeof data.triggerConfig === "string" ? JSON.parse(data.triggerConfig) : data.triggerConfig,
          });
        } else {
          setWorkflow(MOCK_WORKFLOWS[params.id] || { id: params.id, name: "Workflow", steps: [], triggerType: "manual", triggerConfig: {} });
        }
      })
      .catch(() => {
        setWorkflow(MOCK_WORKFLOWS[params.id] || { id: params.id, name: "Workflow", steps: [], triggerType: "manual", triggerConfig: {} });
      });
  }, [params.id]);

  const handleSave = async (data: Partial<WorkflowData>) => {
    await fetch(`/api/workflows/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).catch(() => {});
    setWorkflow(prev => prev ? { ...prev, ...data } : data);
  };

  const handleRun = async (id: string) => {
    const res = await fetch(`/api/workflows/${id}/run`, { method: "POST" });
    if (res.ok) {
      const run = await res.json();
      router.push(`/workflows/${id}/runs/${run.id}`);
    } else {
      // fallback: go to runs page
      router.push(`/workflows/${id}/runs`);
    }
  };

  if (!workflow) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="text-[#5A5A6E] text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20 md:pb-0">
      <Header
        title={workflow.name || "Workflow"}
        subtitle={
          <span className="flex items-center gap-1 text-sm text-[#8B8B9E]">
            <Link href="/workflows" className="hover:text-white transition-colors">Workflows</Link>
            <ChevronRight size={13} />
            <span>{workflow.name}</span>
          </span>
        }
      />
      <div className="p-6">
        <WorkflowEditor
          initial={workflow}
          onSave={handleSave}
          onRun={handleRun}
        />
      </div>
    </div>
  );
}
