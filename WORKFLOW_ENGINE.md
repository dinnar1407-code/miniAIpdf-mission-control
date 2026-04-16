# Playfish Mission Control - Workflow Automation Engine

## 1. Concept

**Design, Execute, Monitor** complete multi-step automation workflows. Each workflow is a visual pipeline where:

- **Triggers** start the flow (time, event, manual)
- **Steps** process data (AI Agent tasks, API calls, data transforms)
- **Branches** handle conditions (if/else, switch)
- **Actions** produce results (send message, update database, notify)
- **Monitoring** tracks everything in real-time

**Core metaphor:** You are programming your AI team with a visual flowchart instead of code.

---

## 2. Workflow Builder

### 2.1 Visual Editor

```
┌──────────────────────────────────────────────────────────────────────┐
│  Workflow: MiniAIPDF Product Hunt Launch Flow                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│    ┌─────────┐                                                      │
│    │ START   │                                                      │
│    │ Trigger │                                                      │
│    └────┬────┘                                                      │
│         │                                                           │
│         ▼                                                           │
│    ┌─────────┐     ┌─────────────┐                                  │
│    │ CHECK  │────▶│   Agent:    │                                  │
│    │ PH Live?│ Yes │   Playfish   │                                  │
│    └────┬────┘     │  Send Tweet  │                                  │
│         │ No       └──────┬──────┘                                  │
│         ▼                 │                                         │
│    ┌─────────┐             ▼                                         │
│    │ WAIT   │       ┌─────────────┐                                  │
│    │ 24 hrs │       │   Agent:    │                                  │
│    └─────────┘       │   Admin01   │                                  │
│                       │ Send Report │                                  │
│                       └──────┬──────┘                                  │
│                              │                                         │
│                              ▼                                         │
│                       ┌─────────────┐                                 │
│                       │   END       │                                 │
│                       │   Complete  │                                 │
│                       └─────────────┘                                 │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│  [+ Trigger] [+ Step] [+ Condition] [+ Action]      [▶ Test] [Save] │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 Node Types

#### Triggers (Start of workflow)
| Node | Description | Config |
|------|-------------|--------|
| **Schedule** | Time-based (cron) | `0 9 * * 1-5` = 9am weekdays |
| **Webhook** | External event | URL endpoint |
| **Product Hunt** | PH goes live | Monitor URL |
| **Email** | New email received | IMAP filter |
| **API Poll** | Check API periodically | URL + interval |
| **Manual** | Click to run | - |
| **Agent Event** | Agent completes task | Agent + task type |
| **Alert** | Alert created | Severity filter |

#### Steps (Processing)
| Node | Description | Config |
|------|-------------|--------|
| **Agent Task** | Assign to Agent | Agent + task prompt |
| **HTTP Request** | Call external API | Method, URL, headers, body |
| **Transform** | Data transformation | JSONata expression |
| **Filter** | Filter data | Condition |
| **Parse** | Parse text/HTML/JSON | Extractor |
| **AI Process** | AI processing | Prompt + model |

#### Conditions (Branching)
| Node | Description | Config |
|------|-------------|--------|
| **If/Else** | Two branches | Condition |
| **Switch** | Multiple branches | Value + cases |
| **Wait** | Delay | Duration |
| **Loop** | Repeat steps | Count or while |

#### Actions (End points)
| Node | Description | Config |
|------|-------------|--------|
| **Send Email** | Email notification | To, subject, body |
| **Send Telegram** | Telegram message | Chat ID, message |
| **Create Task** | Create task in DB | Project, title, agent |
| **Update Status** | Update entity | Entity, field, value |
| **Post Twitter** | Post tweet | Text, media |
| **Log** | Log to activity | Message |

---

## 3. Workflow Examples

### Example 1: Product Hunt Launch Flow

```
START: Webhook (PH API → status = "live")
  │
  ├─▶ Playfish Agent: "Draft PH launch tweet"
  │       │
  │       ▼
  │   [Terry approves via Telegram]
  │       │
  │       ▼
  │   Post Twitter
  │       │
  │       ▼
  ├─▶ Admin01: "Send PH celebration to Telegram"
  │       │
  │       ▼
  ├─▶ Create Task: "Monitor PH comments for 48hrs"
  │       │
  │       ▼
  └─▶ Schedule: 48hrs later → Send PH performance report
```

### Example 2: New Customer Onboarding

```
START: Stripe webhook (payment.completed)
  │
  ▼
Agent: PM01 - Send welcome email
  │
  ▼
Agent: Admin01 - Create account in system
  │
  ▼
If: Plan == "Enterprise"
  │
  ├─▶ Agent: Playfish - Send personal welcome
  │       │
  │       ▼
  └─▶ Create Task: "Schedule onboarding call" (Terry)
  │
Else: Plan == "Pro"
  │
  └─▶ Send tutorial video sequence
```

### Example 3: Daily Operations

```
START: Schedule (Every day 8:00 AM)
  │
  ▼
┌─────────────────────────────────────┐
│ PARALLEL:                          │
│                                     │
│ ├─▶ DFM: Generate analytics report │
│ │       │                          │
│ │       ▼                          │
│ │   Post to #analytics Slack      │
│ │                                    │
│ ├─▶ Admin01: Check all platforms  │
│ │       │                          │
│ │       ▼                          │
│ │   Alert if issues found         │
│ │                                    │
│ └─▶ PM01: Post scheduled content   │
│         │                          │
│         ▼                          │
│     Mark tasks complete            │
└─────────────────────────────────────┘
  │
  ▼
END: Daily standup complete
```

### Example 4: SEO Content Pipeline

```
START: Schedule (Every Monday 9:00 AM)
  │
  ▼
Agent: PM01 - Research 5 SEO keywords
  │
  ▼
For each keyword (loop):
  │
  ├─▶ Agent: PM01 - Write blog post
  │       │
  │       ▼
  │   Create Task: "Review blog post"
  │       │
  │       ▼
  │   [Terry or Playfish approves]
  │       │
  │       ▼
  │   Schedule: Publish on Friday
  │
  ▼
Agent: Admin01 - Submit to directories
  │
  ▼
END: Pipeline complete
```

---

## 4. Real-time Monitoring

### 4.1 Workflow Dashboard

```
┌─────────────────────────────────────────────────────────────────────┐
│  WORKFLOW MONITOR                                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ACTIVE RUNS                                                        │
│  ─────────────────────────────────────────────────────────────────  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ ● MiniAIPDF PH Launch Flow                                    │  │
│  │   Step 3/7: "Playfish Send Tweet"                            │  │
│  │   ████████████████░░░░░░░  43%  │  ⏱ 2m 34s remaining      │  │
│  │   [▶ Running] [⏸ Pause] [⏹ Stop]                           │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ ○ Daily Operations Flow                                        │  │
│  │   Waiting: Next run in 2h 14m                                │  │
│  │   [▶ Run Now] [⏸ Disable]                                    │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  RECENT RUNS                                                        │
│  ─────────────────────────────────────────────────────────────────  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ ✅ SEO Content Pipeline     │ Completed │ 12 steps │ 4m 23s │  │
│  │    Finished 2 hours ago    │ 3 posts published             │  │
│  └───────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ ❌ New Customer Onboarding │ Failed    │ Step 4  │ 0m 45s │  │
│  │    Error: Stripe API timeout│ [Retry] [View Logs]          │  │
│  └───────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ ✅ Product Hunt Monitor   │ Completed │ 1 step  │ 0m 12s │  │
│  │    PH not live yet        │ [View Run]                        │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Run Detail View

```
┌─────────────────────────────────────────────────────────────────────┐
│  RUN: MiniAIPDF PH Launch Flow                            [← Back] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Status: ● Running                              Duration: 2m 34s      │
│                                                                      │
│  STEP EXECUTION TIMELINE                                             │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                      │
│  ① START           ────────────▶  ✅ Completed  (0.2s)             │
│     Webhook received                                                   │
│                                                                      │
│  ② Agent Task      ────────────▶  ✅ Completed  (1m 12s)            │
│     Playfish: Draft PH tweet                                         │
│     ┌─────────────────────────────────────────────────────────┐      │
│     │ "Just launched on @ProductHunt! MiniAIPDF — AI-powered │      │
│     │ PDF tools that actually understand your documents..."   │      │
│     └─────────────────────────────────────────────────────────┘      │
│     Output: Tweet draft ready                                         │
│                                                                      │
│  ③ Approval        ────────────▶  ⏳ Waiting...                      │
│     Awaiting Terry approval via Telegram                            │
│     ┌─────────────────────────────────────────────────────────┐      │
│     │ "Approve this tweet?"                                   │      │
│     │ [✅ Approve] [✏️ Edit] [❌ Reject]                      │      │
│     └─────────────────────────────────────────────────────────┘      │
│                                                                      │
│  ④ Post Twitter   ○ Pending                                          │
│                                                                      │
│  ⑤ Agent Task     ○ Pending                                          │
│     Admin01: Send celebration message                                 │
│                                                                      │
│  ⑥ Create Task   ○ Pending                                          │
│                                                                      │
│  ⑦ Schedule       ○ Pending                                          │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│  [⏸ Pause] [⏹ Stop] [📋 Duplicate Run] [📤 Export Logs]          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Workflow Management

### 5.1 Workflow List

| Workflow | Trigger | Status | Last Run | Next Run |
|----------|---------|--------|----------|----------|
| MiniAIPDF PH Launch | PH API | Active | - | Manual |
| Daily Operations | 8:00 AM | Active | 2h ago | 2h 14m |
| SEO Content Pipeline | Mon 9am | Active | 2h ago | 4d |
| Customer Onboarding | Stripe | Active | Failed ❌ | - |
| FurMates Order Alert | Webhook | Active | 15m ago | - |
| NIW Reminder | 1st Monthly | Active | 3d ago | 22d |

### 5.2 Workflow Settings

```
┌─────────────────────────────────────────────────────────────┐
│  Edit Workflow: Daily Operations                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Name:        [Daily Operations Flow________________]        │
│                                                              │
│  Trigger:     [Schedule ▼]     [0 9 * * 1-5]               │
│  (Cron: 9am weekdays)                                   │
│                                                              │
│  Status:      (●) Active  ( ) Paused  ( ) Disabled         │
│                                                              │
│  ┌─ Notifications ─────────────────────────────────────┐     │
│  │  ☑ Notify on start                                   │     │
│  │  ☑ Notify on completion                              │     │
│  │  ☑ Notify on error                                   │     │
│  │  Send to: [@terry_telegram]                          │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌─ Error Handling ────────────────────────────────────┐     │
│  │  On error: (●) Retry 3x  ( ) Skip  ( ) Stop         │     │
│  │  Retry interval: [5 minutes ▼]                        │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌─ History ────────────────────────────────────────────┐     │
│  │  Keep runs for: [30 days ▼]                          │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  [💾 Save] [🗑 Delete] [📋 Duplicate]                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Technical Implementation

### 6.1 Data Model

```prisma
model Workflow {
  id          String   @id @default(cuid())
  name        String
  description String?
  triggerType String   // schedule, webhook, manual, event
  triggerConfig Json
  steps       Json     // Array of step configurations
  status      WorkflowStatus @default(DRAFT)
  projectId   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  runs        WorkflowRun[]
}

model WorkflowRun {
  id          String   @id @default(cuid())
  workflowId  String
  workflow    Workflow @relation(fields: [workflowId], references: [id])
  status      RunStatus // PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
  currentStep Int      @default(0)
  startedAt   DateTime?
  completedAt DateTime?
  triggerData Json?    // What triggered this run
  stepResults Json?    // Results of each step
  error       String?  // Error message if failed
  
  logs        WorkflowLog[]
}

model WorkflowLog {
  id        String   @id @default(cuid())
  runId     String
  run       WorkflowRun @relation(fields: [runId], references: [id])
  stepIndex Int
  stepType  String
  message   String
  level     String    // info, warn, error
  createdAt DateTime @default(now())
}
```

### 6.2 Execution Engine

```typescript
class WorkflowEngine {
  // Execute a workflow
  async execute(workflowId: string, triggerData?: any) {
    const workflow = await db.workflow.findUnique({ where: { id: workflowId }})
    const run = await db.workflowRun.create({
      data: { workflowId, status: 'RUNNING', triggerData, startedAt: new Date() }
    })
    
    try {
      for (let i = 0; i < workflow.steps.length; i++) {
        await this.executeStep(run, workflow.steps[i], i)
      }
      await db.workflowRun.update({ where: { id: run.id }, data: { status: 'COMPLETED' }})
    } catch (error) {
      await db.workflowRun.update({ where: { id: run.id }, data: { status: 'FAILED', error: error.message }})
    }
  }
  
  async executeStep(run, step, index) {
    // Update current step
    await db.workflowRun.update({ where: { id: run.id }, data: { currentStep: index }})
    
    // Execute based on step type
    switch (step.type) {
      case 'agent':
        await this.executeAgentStep(step)
        break
      case 'http':
        await this.executeHttpStep(step)
        break
      case 'condition':
        await this.executeConditionStep(step)
        break
      // ... other step types
    }
  }
}
```

### 6.3 Trigger Types

```typescript
// Schedule trigger (uses node-cron)
scheduler.schedule('0 9 * * 1-5', async () => {
  const workflows = await db.workflow.findMany({ where: { triggerType: 'schedule', status: 'ACTIVE' }})
  for (const wf of workflows) {
    workflowEngine.execute(wf.id)
  }
})

// Webhook trigger (HTTP endpoint)
app.post('/webhook/:workflowId', async (req, res) => {
  const { workflowId } = req.params
  await workflowEngine.execute(workflowId, req.body)
  res.status(200).send('OK')
})

// Product Hunt monitor (polls every 15 min)
async function checkProductHunt() {
  const response = await fetch('https://api.producthunt.com/v1/posts/miniaipdf')
  const data = await response.json()
  if (data.post?.status === 'live') {
    const wf = await db.workflow.findFirst({ where: { triggerType: 'producthunt' }})
    if (wf) await workflowEngine.execute(wf.id, { event: 'ph_live' })
  }
}
```

---

## 7. Approval Flows

### 7.1 Human-in-the-Loop

Some steps require human approval before proceeding:

```typescript
// Approval step
async function executeApprovalStep(step, run) {
  const approval = await db.approval.create({
    data: {
      runId: run.id,
      stepIndex: step.index,
      message: step.config.message,
      options: step.config.options, // ['Approve', 'Reject', 'Edit']
      status: 'PENDING',
      sentTo: step.config.notify
    }
  })
  
  // Send to Telegram/Slack
  await telegram.sendMessage(step.config.notify, {
    text: step.config.message,
    buttons: step.config.options.map(opt => [{ text: opt, callback_data: `${approval.id}:${opt}` }])
  })
  
  // Wait for response (using SSE or polling)
  await waitForApproval(approval.id)
}
```

### 7.2 Approval UI

```
┌─────────────────────────────────────────────────────────────┐
│  ⏳ APPROVAL REQUIRED                                       │
│                                                              │
│  Workflow: MiniAIPDF PH Launch Flow                        │
│  Step: "Draft PH Launch Tweet"                              │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Just launched on @ProductHunt! MiniAIPDF — AI-powered │ │
│  │ PDF tools that actually understand your documents.      │ │
│  │ $7/mo. No subscription traps. 👇                      │ │
│  │ https://miniaipdf.com                                  │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  [✅ Approve] [✏️ Edit & Approve] [❌ Reject]               │
│                                                              │
│  Awaiting response...                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Monitoring & Logging

### 8.1 Real-time Updates

```
Technology: Server-Sent Events (SSE)

Client connects: GET /api/runs/:id/stream
Server sends:
  - step_started
  - step_progress
  - step_completed
  - step_failed
  - approval_required
  - run_completed
  - run_failed
```

### 8.2 Log Viewer

```
┌─────────────────────────────────────────────────────────────┐
│  LOGS: Daily Operations - Run #142              [Export ▼] │
├─────────────────────────────────────────────────────────────┤
│  [All ▼] [Errors ▼] [Search: _______________]              │
│                                                              │
│  08:00:01.234  ▶  Workflow started (triggered by schedule) │
│  08:00:01.456  ▶  Step 1: DFM Generate Report              │
│  08:00:12.891  ▶  Calling Google Analytics API...           │
│  08:00:13.204  ▶  ✓ Received 847 sessions, 124 conversions  │
│  08:00:13.456  ▶  ✓ Report generated (12kb)                │
│  08:00:14.001  ▶  Step 2: Post to Slack                     │
│  08:00:14.234  ▶  Posting to #analytics...                  │
│  08:00:15.102  ▶  ✓ Posted successfully                     │
│  08:00:15.456  ▶  Step 3: Admin01 Check Platforms           │
│  08:00:15.678  ▶  Checking: Shopify, Twitter, PH...          │
│  08:00:16.102  ⚠️  Warning: PH returning 403               │
│  08:00:16.204  ▶  Retrying in 5 minutes...                  │
│  08:00:21.456  ▶  ✓ PH check passed                        │
│  08:00:22.001  ▶  Step 4: PM01 Post Content                 │
│  08:00:22.234  ▶  Posting scheduled tweets...               │
│  08:00:23.891  ▶  ✓ 3 tweets posted                        │
│  08:00:24.001  ▶  ✓ Workflow completed                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Starter Templates

Pre-built workflows Terry can enable with one click:

| Template | Description |
|----------|-------------|
| **PH Launch Flow** | When PH goes live → Post everywhere |
| **Daily Standup** | Every morning → Analytics + Alerts + Content |
| **New Customer** | Stripe payment → Onboarding sequence |
| **Weekly Review** | Every Friday → Generate reports + Schedule next week |
| **Bug Alert** | Error detected → Alert + Create task + Auto-fix if possible |
| **Content Pipeline** | Every Monday → Research → Write → Schedule |
| **Competitor Monitor** | Daily → Check competitor sites → Alert on changes |
| **Uptime Monitor** | Every 5 min → Check sites → Alert if down |

---

## 10. Integration Points

### Agents
- Playfish: Strategic approvals, Twitter, emails
- PM01: Content creation, social posting
- Admin01: Operations, monitoring, support
- DFM: Analytics, reporting, data processing

### External Services
- Telegram: Notifications, approvals
- Stripe: Payment events
- Shopify: Order events
- Google Analytics: Reporting
- Slack: Team notifications
- Twitter/X: Posting
- Email: Notifications

### APIs
- Product Hunt: Monitor launches
- GitHub: Code events
- Vercel: Deploy events
- Railway: Server events
