// ==================== WORKFLOW TYPE DEFINITIONS ====================

export type TriggerType = "manual" | "schedule" | "webhook" | "event";
export type StepType = "agent" | "http" | "wait" | "condition" | "notify" | "create_task" | "log";
export type RunStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type LogLevel = "info" | "warn" | "error" | "success";

export interface WorkflowStep {
  id: string;
  type: StepType;
  label: string;
  config: Record<string, unknown>;
  // agent step
  agent?: string;
  action?: string;
  // http step
  method?: string;
  url?: string;
  // wait step
  delay?: number; // minutes
  // condition step
  condition?: string;
  // notify step
  channel?: string;
  message?: string;
}

export interface TriggerConfig {
  cron?: string;         // for schedule
  webhookPath?: string;  // for webhook
  event?: string;        // for event
}

export interface WorkflowData {
  id: string;
  name: string;
  description?: string;
  triggerType: TriggerType;
  triggerConfig: TriggerConfig;
  steps: WorkflowStep[];
  status: "draft" | "active" | "paused" | "archived";
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StepResult {
  stepIndex: number;
  stepId: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startedAt?: string;
  completedAt?: string;
  output?: string;
  error?: string;
}

export interface RunData {
  id: string;
  workflowId: string;
  workflowName: string;
  status: RunStatus;
  currentStep: number;
  totalSteps: number;
  startedAt?: string;
  completedAt?: string;
  stepResults: StepResult[];
  error?: string;
  createdAt: string;
}

export interface LogEntry {
  id: string;
  runId: string;
  stepIndex: number;
  stepType: string;
  message: string;
  level: LogLevel;
  createdAt: string;
}

// Step type configurations
export const STEP_TEMPLATES: Record<StepType, Partial<WorkflowStep>> = {
  agent: {
    type: "agent",
    label: "Agent Task",
    config: {},
    agent: "playfish",
    action: "Describe the task...",
  },
  http: {
    type: "http",
    label: "HTTP Request",
    config: {},
    method: "GET",
    url: "https://api.example.com/endpoint",
  },
  wait: {
    type: "wait",
    label: "Wait",
    config: {},
    delay: 60,
  },
  condition: {
    type: "condition",
    label: "Condition",
    config: {},
    condition: "result.status === 'success'",
  },
  notify: {
    type: "notify",
    label: "Notify",
    config: {},
    channel: "telegram",
    message: "Workflow step completed",
  },
  create_task: {
    type: "create_task",
    label: "Create Task",
    config: {},
    action: "Task title here",
  },
  log: {
    type: "log",
    label: "Log",
    config: {},
    message: "Log message here",
  },
};

export const STEP_ICONS: Record<StepType, string> = {
  agent: "🤖",
  http: "🌐",
  wait: "⏱",
  condition: "🔀",
  notify: "📨",
  create_task: "✅",
  log: "📝",
};

export const AGENT_OPTIONS = [
  { id: "playfish", name: "Playfish", emoji: "🌾" },
  { id: "pm01", name: "PM01", emoji: "📝" },
  { id: "pm01-b", name: "PM01-B", emoji: "📝" },
  { id: "admin01", name: "Admin01", emoji: "🔧" },
  { id: "dfm", name: "DFM", emoji: "📊" },
];
