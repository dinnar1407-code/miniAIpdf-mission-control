"use client";

import { Header } from "@/components/layout/header";
import { WorkflowEditor } from "@/components/workflows/workflow-editor";
import { useRouter } from "next/navigation";
import { WorkflowData } from "@/lib/workflow-types";

export default function NewWorkflowPage() {
  const router = useRouter();

  const handleSave = async (data: Partial<WorkflowData>) => {
    const res = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const wf = await res.json();
      router.push(`/workflows/${wf.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20 md:pb-0">
      <Header title="New Workflow" subtitle="Design your automation" />
      <div className="p-6">
        <WorkflowEditor onSave={handleSave} />
      </div>
    </div>
  );
}
