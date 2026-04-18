"use client";

import { useState, useCallback } from "react";
import { Plus, Save, Play, Zap, Clock, Globe, MousePointer } from "lucide-react";
import { StepNode } from "./step-node";
import {
  WorkflowStep, WorkflowData, TriggerType, StepType,
  STEP_TEMPLATES, STEP_ICONS,
} from "@/lib/workflow-types";
import { cn } from "@/lib/utils";

interface WorkflowEditorProps {
  initial?: Partial<WorkflowData>;
  onSave?: (data: Partial<WorkflowData>) => Promise<void>;
  onRun?: (id: string) => void;
  readOnly?: boolean;
  runningStepIndex?: number;
  stepStatuses?: Record<number, "pending" | "running" | "completed" | "failed">;
}

const TRIGGER_OPTIONS: { type: TriggerType; label: string; icon: React.ReactNode; desc: string }[] = [
  { type: "manual",   label: "Manual",   icon: <MousePointer size={14} />, desc: "Click to run" },
  { type: "schedule", label: "Schedule", icon: <Clock size={14} />,        desc: "Cron / time-based" },
  { type: "webhook",  label: "Webhook",  icon: <Globe size={14} />,        desc: "HTTP POST trigger" },
  { type: "event",    label: "Event",    icon: <Zap size={14} />,          desc: "Agent / system event" },
];

const STEP_PALETTE: { type: StepType; label: string }[] = [
  { type: "agent",       label: "Agent Task" },
  { type: "publish",     label: "Publish" },
  { type: "http",        label: "HTTP Request" },
  { type: "wait",        label: "Wait" },
  { type: "condition",   label: "Condition" },
  { type: "notify",      label: "Notify" },
  { type: "create_task", label: "Create Task" },
  { type: "log",         label: "Log" },
];

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export function WorkflowEditor({
  initial, onSave, onRun, readOnly = false, runningStepIndex, stepStatuses,
}: WorkflowEditorProps) {
  const [name, setName]               = useState(initial?.name || "New Workflow");
  const [description, setDescription] = useState(initial?.description || "");
  const [triggerType, setTriggerType] = useState<TriggerType>(initial?.triggerType || "manual");
  const [cronExpr, setCronExpr]       = useState(
    (initial?.triggerConfig as { cron?: string })?.cron || "0 9 * * 1-5"
  );
  const [webhookPath, setWebhookPath] = useState(
    (initial?.triggerConfig as { webhookPath?: string })?.webhookPath || "/webhook/my-flow"
  );
  const [steps, setSteps]             = useState<WorkflowStep[]>(initial?.steps || []);
  const [status, setStatus]           = useState(initial?.status || "draft");
  const [saving, setSaving]           = useState(false);

  const addStep = (type: StepType) => {
    const template = STEP_TEMPLATES[type];
    const newStep: WorkflowStep = {
      ...template,
      id: generateId(),
      type,
      label: template.label || type,
      config: {},
    } as WorkflowStep;
    setSteps([...steps, newStep]);
  };

  const updateStep = useCallback((updated: WorkflowStep) => {
    setSteps(prev => prev.map(s => s.id === updated.id ? updated : s));
  }, []);

  const deleteStep = useCallback((id: string) => {
    setSteps(prev => prev.filter(s => s.id !== id));
  }, []);

  const moveStep = useCallback((id: string, dir: "up" | "down") => {
    setSteps(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (dir === "up" && idx === 0) return prev;
      if (dir === "down" && idx === prev.length - 1) return prev;
      const arr = [...prev];
      const swap = dir === "up" ? idx - 1 : idx + 1;
      [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
      return arr;
    });
  }, []);

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    await onSave({
      name, description, triggerType, steps, status: status as WorkflowData["status"],
      triggerConfig: triggerType === "schedule" ? { cron: cronExpr }
                   : triggerType === "webhook"  ? { webhookPath }
                   : {},
    });
    setSaving(false);
  };

  return (
    <div className="flex gap-4 h-full">
      {/* LEFT: Step Palette */}
      {!readOnly && (
        <div className="w-44 flex-shrink-0">
          <div className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-3">
            <div className="text-xs font-medium text-[#5A5A6E] uppercase tracking-wider mb-2">Add Step</div>
            <div className="space-y-1">
              {STEP_PALETTE.map(s => (
                <button
                  key={s.type}
                  onClick={() => addStep(s.type)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-[#8B8B9E] hover:text-white hover:bg-[#1A1A24] transition-colors text-left"
                >
                  <span>{STEP_ICONS[s.type]}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MAIN: Canvas */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-4 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              {readOnly ? (
                <div className="text-lg font-semibold text-white">{name}</div>
              ) : (
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="text-lg font-semibold text-white bg-transparent border-b border-transparent hover:border-[#2A2A3A] focus:border-[#3B82F6] focus:outline-none w-full pb-0.5"
                />
              )}
              {readOnly ? (
                <div className="text-sm text-[#8B8B9E] mt-1">{description}</div>
              ) : (
                <input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Description (optional)"
                  className="text-sm text-[#8B8B9E] bg-transparent border-b border-transparent hover:border-[#2A2A3A] focus:border-[#3B82F6] focus:outline-none w-full mt-1"
                />
              )}
            </div>
            {!readOnly && (
              <div className="flex gap-2 flex-shrink-0">
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as "active" | "draft" | "paused" | "archived")}
                  className="bg-[#1A1A24] border border-[#2A2A3A] text-xs text-white rounded px-2 py-1 focus:outline-none"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1A24] border border-[#2A2A3A] hover:border-[#3A3A4A] text-[#8B8B9E] hover:text-white text-xs rounded transition-colors"
                >
                  <Save size={12} />
                  {saving ? "Saving..." : "Save"}
                </button>
                {onRun && initial?.id && (
                  <button
                    onClick={() => onRun(initial.id!)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3B82F6] hover:bg-blue-600 text-white text-xs rounded transition-colors"
                  >
                    <Play size={12} />
                    Run Now
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Trigger */}
        <div className="mb-4">
          <div className="text-xs font-medium text-[#5A5A6E] uppercase tracking-wider mb-2">Trigger</div>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {TRIGGER_OPTIONS.map(t => (
              <button
                key={t.type}
                onClick={() => !readOnly && setTriggerType(t.type)}
                disabled={readOnly}
                className={cn(
                  "flex flex-col items-center gap-1 p-3 rounded-lg border text-xs transition-colors",
                  triggerType === t.type
                    ? "border-[#3B82F6] bg-[#3B82F610] text-white"
                    : "border-[#2A2A3A] bg-[#12121A] text-[#8B8B9E] hover:border-[#3A3A4A]"
                )}
              >
                {t.icon}
                <span className="font-medium">{t.label}</span>
                <span className="text-[#5A5A6E] text-[10px]">{t.desc}</span>
              </button>
            ))}
          </div>

          {triggerType === "schedule" && !readOnly && (
            <div className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-3">
              <label className="text-xs text-[#5A5A6E] mb-1 block">Cron Expression</label>
              <input
                value={cronExpr}
                onChange={e => setCronExpr(e.target.value)}
                placeholder="0 9 * * 1-5"
                className="w-full bg-[#0A0A0F] border border-[#2A2A3A] rounded px-3 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-[#3B82F6]"
              />
              <div className="text-xs text-[#5A5A6E] mt-1">
                e.g. <code className="text-[#8B8B9E]">0 9 * * 1-5</code> = Weekdays 9am
              </div>
            </div>
          )}
          {triggerType === "webhook" && !readOnly && (
            <div className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-3">
              <label className="text-xs text-[#5A5A6E] mb-1 block">Webhook Path</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#5A5A6E] font-mono">/api/webhooks</span>
                <input
                  value={webhookPath}
                  onChange={e => setWebhookPath(e.target.value)}
                  className="flex-1 bg-[#0A0A0F] border border-[#2A2A3A] rounded px-3 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-[#3B82F6]"
                />
              </div>
            </div>
          )}
          {triggerType === "manual" && (
            <div className="bg-[#12121A] border border-[#F59E0B30] rounded-lg p-3">
              <div className="text-xs text-[#F59E0B]">
                🖱 This workflow runs only when manually triggered via the Run button or API.
              </div>
            </div>
          )}
        </div>

        {/* Steps */}
        <div>
          <div className="text-xs font-medium text-[#5A5A6E] uppercase tracking-wider mb-2">
            Steps ({steps.length})
          </div>

          {steps.length === 0 ? (
            <div className="bg-[#12121A] border border-dashed border-[#2A2A3A] rounded-lg p-8 text-center">
              <div className="text-3xl mb-2">⚡</div>
              <div className="text-sm text-[#8B8B9E]">No steps yet</div>
              {!readOnly && (
                <div className="text-xs text-[#5A5A6E] mt-1">← Add steps from the left panel</div>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {steps.map((step, i) => (
                <StepNode
                  key={step.id}
                  step={step}
                  index={i}
                  total={steps.length}
                  onUpdate={updateStep}
                  onDelete={deleteStep}
                  onMoveUp={id => moveStep(id, "up")}
                  onMoveDown={id => moveStep(id, "down")}
                  runStatus={stepStatuses?.[i]}
                />
              ))}

              {!readOnly && (
                <button
                  onClick={() => addStep("agent")}
                  className="w-full flex items-center justify-center gap-2 py-2 mt-2 border border-dashed border-[#2A2A3A] rounded-lg text-xs text-[#5A5A6E] hover:text-white hover:border-[#3A3A4A] transition-colors"
                >
                  <Plus size={12} /> Add Step
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
