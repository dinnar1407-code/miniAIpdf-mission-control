# JARVIS AUTOPILOT — 建设规格 v1

> 本文件是 Jarvis Mission Control 从"任务调度器"升级为"AI 闭环自主管理系统"的工程规格。
> 给 Claude Code 阅读，作为后续所有任务的上下文锚点。

---

## TL;DR

- **现状**：Workflow 引擎已就绪（step-based 执行 + WorkflowRun 调度），Dashboard 能看数据。
- **目标**：在 Workflow 之上叠加 Autopilot AI 层，让系统从"被动等触发"变成"主动观察→规划→执行→学习"的闭环。
- **核心原则**：**不动现有 Workflow 引擎**，只在它上面叠一层"谁来决策"的大脑。
- **产品定位**：让 Jarvis 从"你要看什么"变成"它告诉你该看什么，还帮你做了"。

---

## 1. 架构总览

```
┌─────────────────────────────────────┐
│  Autopilot AI Layer        【新增】  │
│  ┌───────────┐    ┌───────────┐    │
│  │ Observer  │ →  │  Planner  │    │
│  │ (扫描)    │    │ (LLM 决策)│    │
│  └───────────┘    └─────┬─────┘    │
└────────────────────────┼────────────┘
                         ↓ 下发 Plan/Mission
┌─────────────────────────────────────┐
│  Workflow Engine           【已有】  │
│  WorkflowRun + step 调度             │
└─────────────────────────┬───────────┘
                          ↓ 执行结果
┌─────────────────────────────────────┐
│  Feedback / Memory Layer  【新增】   │
│  Outcome 归因 + pgvector 学习库      │
└─────────────────────────────────────┘
```

数据流主干：**Insight → Plan → Mission → Feedback**
横向支撑：Memory（向量库）、Goal（KPI 锚点）、Approval（HITL 关卡）、Playbook（可复用模板）

---

## 2. 完整 Prisma Schema

> 仅新增，**不修改**现有 `Project / Agent / Workflow / WorkflowRun / User` 等模型。
> 假设这些表已存在；下方仅展示新模型与必要的反向关系。

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [vector]
}

// ─────────────────────────────────────────
// Project 反向关系（现有 Project 模型上加这些字段）
// ─────────────────────────────────────────
// goals     Goal[]
// insights  Insight[]
// plans     Plan[]
// missions  Mission[]
// memories  Memory[]
// playbooks Playbook[]

// ─────────────────────────────────────────
// 1. GOAL  —  KPI 锚点
// ─────────────────────────────────────────
model Goal {
  id          String     @id @default(cuid())
  projectId   String
  project     Project    @relation(fields: [projectId], references: [id])

  kpi         String     // 'mrr' | 'mau' | 'daily_signups' | 'churn_rate'
  unit        String     // 'usd' | 'count' | 'percent'
  baseline    Float
  target      Float
  current     Float?
  currentAt   DateTime?
  deadline    DateTime
  cadence     String     // 'daily' | 'weekly' | 'monthly' | 'quarterly'
  status      GoalStatus @default(on_track)

  insights    Insight[]

  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@unique([projectId, kpi])
  @@index([status])
}

enum GoalStatus { on_track  at_risk  achieved  missed }

// ─────────────────────────────────────────
// 2. INSIGHT  —  Observer 产出，Planner 输入
// ─────────────────────────────────────────
model Insight {
  id              String        @id @default(cuid())
  projectId       String?
  project         Project?      @relation(fields: [projectId], references: [id])
  goalId          String?
  goal            Goal?         @relation(fields: [goalId], references: [id])

  type            InsightType
  severity        Severity
  title           String        // "MiniAIPDF 流量今天比同期跌 23%"
  summary         String        @db.Text
  evidence        Json          // { source, metric, current, baseline, delta, window }
  suggestedAction String?       @db.Text

  status          InsightStatus @default(new)

  plans           Plan[]

  observedAt      DateTime
  createdAt       DateTime      @default(now())

  @@index([status, severity, createdAt])
  @@index([projectId, createdAt])
}

enum InsightType   { anomaly  opportunity  risk  trend  milestone }
enum Severity      { low  medium  high  critical }
enum InsightStatus { new  acknowledged  planned  dismissed  superseded }

// ─────────────────────────────────────────
// 3. PLAN  —  Planner 决策产出
// ─────────────────────────────────────────
model Plan {
  id               String        @id @default(cuid())
  projectId        String
  project          Project       @relation(fields: [projectId], references: [id])
  insightId        String?
  insight          Insight?      @relation(fields: [insightId], references: [id])

  objective        String
  rationale        String        @db.Text

  priority         Int           // 0-100
  estimatedKpi     String?
  estimatedDelta   Float?
  estimatedHorizon Int?          // hours

  riskLevel        Int           // 0-5
  reversibility    Reversibility
  blastRadius      String?       // 'internal' | 'segment' | 'all_users' | 'public'

  status           PlanStatus    @default(draft)

  steps            PlanStep[]
  missions         Mission[]
  approval         Approval?

  generatedBy      String        // 'planner_v1' | 'manual' | model id
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  @@index([status, priority])
  @@index([projectId, createdAt])
}

enum PlanStatus    { draft  pending  approved  rejected  executing  completed  failed  superseded }
enum Reversibility { reversible  partially  irreversible }

// ─────────────────────────────────────────
// 4. PLAN STEP
// ─────────────────────────────────────────
model PlanStep {
  id             String  @id @default(cuid())
  planId         String
  plan           Plan    @relation(fields: [planId], references: [id], onDelete: Cascade)

  order          Int
  action         String
  agentId        String? // FK → existing Agent
  workflowId     String? // FK → existing Workflow（可选）
  expectedOutput String? @db.Text
  inputs         Json?

  @@unique([planId, order])
  @@index([agentId])
}

// ─────────────────────────────────────────
// 5. MISSION  —  执行实例，绑定 WorkflowRun
// ─────────────────────────────────────────
model Mission {
  id             String        @id @default(cuid())
  planId         String
  plan           Plan          @relation(fields: [planId], references: [id])
  projectId      String
  project        Project       @relation(fields: [projectId], references: [id])

  workflowId     String        // FK → existing Workflow
  workflowRunId  String?       @unique  // FK → existing WorkflowRun

  status         MissionStatus @default(queued)
  startedAt      DateTime?
  completedAt    DateTime?
  resultSummary  String?       @db.Text
  errorMessage   String?

  feedback       Feedback?

  createdAt      DateTime      @default(now())

  @@index([status])
  @@index([projectId, createdAt])
}

enum MissionStatus { queued  executing  succeeded  failed  cancelled  awaiting_feedback }

// ─────────────────────────────────────────
// 6. FEEDBACK  —  Outcome 归因
// ─────────────────────────────────────────
model Feedback {
  id                String   @id @default(cuid())
  missionId         String   @unique
  mission           Mission  @relation(fields: [missionId], references: [id])

  expectedKpi       String
  expectedDelta     Float
  actualDelta       Float?
  effectiveness     Float?   // 0-1

  postmortem        String   @db.Text  // 全文复盘
  learnings         String   @db.Text  // 1-3 句精华，喂给 Memory embed
  tags              String[]

  evaluatedAt       DateTime
  observationWindow Int      // 观察了多少小时

  createdAt         DateTime @default(now())

  @@index([effectiveness])
}

// ─────────────────────────────────────────
// 7. MEMORY  —  唯一向量库
// ─────────────────────────────────────────
model Memory {
  id              String                        @id @default(cuid())
  projectId       String?
  project         Project?                      @relation(fields: [projectId], references: [id])

  kind            MemoryKind
  content         String                        @db.Text
  embedding       Unsupported("vector(1536)")?
  embeddingModel  String?                       // 'openai/text-embedding-3-small'

  sourceTable     String                        // 'insight' | 'feedback' | 'playbook' | ...
  sourceId        String

  metadata        Json

  retrievedCount  Int      @default(0)
  helpfulCount    Int      @default(0)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([kind, projectId])
  @@unique([sourceTable, sourceId])
}

enum MemoryKind {
  insight_summary
  feedback_lesson
  playbook
  project_fact
  postmortem
}

// ─────────────────────────────────────────
// 8. APPROVAL  —  HITL 关卡
// ─────────────────────────────────────────
model Approval {
  id                String           @id @default(cuid())
  planId            String           @unique
  plan              Plan             @relation(fields: [planId], references: [id])

  riskLevel         Int
  reversibility     Reversibility
  blastRadius       String?
  estimatedCost     Float?
  requiredApprovers Int               @default(1)

  decision          ApprovalDecision  @default(pending)
  decidedBy         String?
  decidedAt         DateTime?
  notes             String?

  approverContext   Json?

  createdAt         DateTime          @default(now())
  expiresAt         DateTime?

  @@index([decision, createdAt])
}

enum ApprovalDecision { pending  approved  rejected  expired  escalated }

// ─────────────────────────────────────────
// 9. PLAYBOOK  —  可复用模板
// ─────────────────────────────────────────
model Playbook {
  id              String   @id @default(cuid())
  projectId       String?
  project         Project? @relation(fields: [projectId], references: [id])

  name            String
  description     String   @db.Text
  triggerPattern  String   @db.Text

  template        Json

  invocations     Int      @default(0)
  successes       Int      @default(0)
  successRate     Float?

  isActive        Boolean  @default(true)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([projectId, isActive])
}
```

### Migration 必须包含

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE INDEX memory_embedding_hnsw_idx
  ON "Memory" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

---

## 3. 关键设计决策

1. **Memory 是唯一存 embedding 的表**——不在 Insight/Feedback 上各加 embedding 字段。统一检索逻辑、统一回写学习信号。
2. **Plan 拆出 PlanStep 独立表**——可按 agent 维度查询、可挂 FK 到现有 Agent / Workflow。
3. **Write-through embed 走后台**——`Insight`/`Feedback` 写入后发 Inngest event 异步 embed，不堵请求路径。
4. **检索阈值 similarity > 0.55**，90 天时间衰减（半衰期）。
5. **`helpfulCount` 是 Memory 自进化机制**——被引用且对应 Plan 评为 effective 时 `+1`，未来排序优先级 = similarity × (1 + helpful × 0.1) × time_decay。
6. **Plan 自带 risk/reversibility/blastRadius**——风险元数据是 Planner 输出的一部分；Approval 表只是 HITL 决策的快照。
7. **观察期延时任务用 Inngest**，不用 Vercel cron——需要 24/72h 的 durable delayed jobs。

---

## 4. 技术栈补充

- **pgvector** extension（Supabase / Neon 直接开）
- **OpenAI `text-embedding-3-small`**（1536 维，~$0.02 / 1M tokens）
- **Inngest**（durable jobs，处理 delayed feedback observation）
- **LLM 路由**：Planner 用 Claude Opus（强推理），分类/小任务用 Haiku
- **zod**：所有 API route 输入校验

---

## 5. Memory 模块规格

### 5.1 Embedding 策略

| MemoryKind | content 字段写什么 | 典型长度 |
|---|---|---|
| `insight_summary` | `Insight.summary` 原文 | 50-200 tokens |
| `feedback_lesson` | `Feedback.learnings`（不是 postmortem 全文！） | 30-100 tokens |
| `playbook` | `name + "\n" + triggerPattern` | 50-150 tokens |
| `project_fact` | 项目元知识小卡片 | 20-80 tokens |
| `postmortem` | `Feedback.postmortem` 头部 + 关键 metrics | 200-300 tokens |

**核心原则**：embed 单元和检索粒度对齐。Planner 想要"教训"不是"故事全文"——所以 Feedback 必须有 `learnings`（短）和 `postmortem`（长）两个字段，embed `learnings`。

### 5.2 写时机（write-through）

```ts
// 应用代码写 Insight 后
const insight = await prisma.insight.create({ data: {...} })
await inngest.send({
  name: 'memory/sync',
  data: { sourceTable: 'insight', sourceId: insight.id }
})

// inngest function: memory/sync
async function syncMemory({ sourceTable, sourceId }) {
  const content = await loadContent(sourceTable, sourceId)
  const { data: [{ embedding }] } = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: content,
  })
  await prisma.$executeRaw`
    INSERT INTO "Memory" (...) VALUES (...)
    ON CONFLICT ("sourceTable", "sourceId") DO UPDATE SET ...
  `
}
```

### 5.3 检索时机

主要：**Planner 从 Insight 生成 Plan 的瞬间**。

```ts
async function retrieveContextForPlanning(insight: Insight) {
  const { data: [{ embedding: queryEmb }] } = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: insight.summary,
  })

  const memories = await prisma.$queryRaw<MemoryHit[]>`
    SELECT 
      m.id, m.kind, m.content, m.metadata,
      m."sourceTable", m."sourceId", m."helpfulCount",
      1 - (m.embedding <=> ${queryEmb}::vector) AS similarity
    FROM "Memory" m
    WHERE 
      m.kind IN ('feedback_lesson', 'playbook', 'postmortem')
      AND (m."projectId" = ${insight.projectId} OR m."projectId" IS NULL)
      AND 1 - (m.embedding <=> ${queryEmb}::vector) > 0.55
    ORDER BY 
      (1 - (m.embedding <=> ${queryEmb}::vector))
      * (1 + LEAST(m."helpfulCount", 5) * 0.1)
      * EXP(-EXTRACT(EPOCH FROM (now() - m."createdAt")) / 7776000)
      DESC
    LIMIT 8
  `

  // 用 metadata 补全 effectiveness，分组成功/失败
  // ...
  return { successes, failures, playbooks }
}
```

次要时机：审批 UI 渲染、Insight 去重、Postmortem 生成（可后续加）。

### 5.4 Prompt 注入格式

成功 / 失败 / Playbook 分组展示，每条标 similarity + effectiveness，要求模型在 rationale 里引用 `[H1]`/`[F2]`/`[P1]`。Plan 完成后解析引用，回写 `retrievedCount` / `helpfulCount`。

```
## ✅ Past actions that WORKED (use as templates)
[H1] similarity 89% · effectiveness 0.85
  Lesson: "..."

## ❌ Past actions that FAILED (avoid these patterns)
[F1] similarity 74% · effectiveness 0.2
  Why it didn't work: "..."

## 📘 Applicable Playbooks
[P1] SEO 排名下降补救 (success rate 0.7)
  Trigger: "..."
```

约束：top-8 max，每条 ≤ 300 tokens；超长的先用 Haiku 压缩。

---

## 6. 建设路线（3 阶段）

### Phase 1 — Observer 单链路（本周）

**目标**：UI 上能看到自动产生的 Insight 卡片；Plan 仍然手动。

- [ ] 1.1 Prisma migration（9 个新模型）+ pgvector + HNSW 索引
- [ ] 1.2 Project / Goal seed（6 个项目 × 3 个核心 KPI）
- [ ] 1.3 LLM 抽象层 `lib/llm.ts`（路由 + 日志）
- [ ] 1.4 Embeddings 抽象层 `lib/embeddings.ts`
- [ ] 1.5 Observer cron（每小时跑一次，先接 1-2 个数据源跑通）
- [ ] 1.6 Insight 生成 pipeline：raw data → LLM → Insight row
- [ ] 1.7 `inngest/memory.sync` function
- [ ] 1.8 `/autopilot/insights` 页面（read-only 列表）

**验收**：每天早上能看到一份"6 个项目的异常清单"，每条 Insight 有 title / summary / evidence / suggestedAction。

### Phase 2 — Planner 半自动（下周）

**目标**：Insight 触发 Planner，自动生成 Plan，人审批后绑定 Workflow 执行。

- [ ] 2.1 Memory 检索 helper `lib/memory.ts`（含 pgvector raw SQL）
- [ ] 2.2 Planner prompt template + JSON schema 输出
- [ ] 2.3 Planner 触发：Insight.status='new' && severity ∈ [high, critical]
- [ ] 2.4 Plan + PlanStep 落库
- [ ] 2.5 Approval 自动创建（按 riskLevel 决定是否需要）
- [ ] 2.6 Plan.approved → Mission → WorkflowRun 绑定
- [ ] 2.7 Approval 审批 UI（收件箱样式）
- [ ] 2.8 `/autopilot` 三栏页面：洞察流 ｜ 当前任务 ｜ 反馈库

**验收**：你审批一个 Plan 后能跑到 Mission completed，Memory 表里能看到引用过的条目 retrievedCount +1。

### Phase 3 — Feedback 闭环（后续）

**目标**：Mission 完成后自动观察 KPI、写复盘、更新 Memory，闭环成立。

- [ ] 3.1 `inngest/feedback.observe` function（delay 24/72h）
- [ ] 3.2 KPI 采样器（before/after baseline）
- [ ] 3.3 Postmortem LLM 生成
- [ ] 3.4 Memory 回写（kind='feedback_lesson'）
- [ ] 3.5 解析 Plan.rationale 中的 [H#]/[F#] 引用，回写 helpfulCount
- [ ] 3.6 Feedback 库页面（含 effectiveness 分布）
- [ ] 3.7 Playbook 自动生成提案（高 success 率的模式聚合成模板）

**验收**：跑过一轮完整 Plan 后，Memory 表有 feedback_lesson 条目；下一次相似 Insight 来时，Planner 的 rationale 里能看到对历史的引用。

---

## 7. 文件结构约定

```
mission-control/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── modules/
│   │   ├── observer/        # cron 扫描 + insight 生成
│   │   ├── planner/         # LLM 决策
│   │   ├── autopilot/       # plan → mission 绑定
│   │   ├── feedback/        # outcome 归因
│   │   └── memory/          # 向量检索
│   ├── app/
│   │   ├── autopilot/
│   │   │   ├── page.tsx           # 三栏总览
│   │   │   ├── insights/page.tsx
│   │   │   ├── plans/[id]/page.tsx
│   │   │   ├── approvals/page.tsx
│   │   │   └── feedback/page.tsx
│   │   └── api/
│   │       ├── inngest/route.ts
│   │       └── webhooks/
│   └── lib/
│       ├── llm.ts           # Claude / OpenAI 路由
│       ├── embeddings.ts    # text-embedding-3-small
│       ├── memory.ts        # pgvector raw SQL helpers
│       └── inngest.ts       # client
└── tests/
```

---

## 8. 工程约束（给 Claude Code 的硬规则）

1. **不修改现有 Workflow / WorkflowRun / Agent schema**——只新增。
2. **所有 LLM 调用必须走 `lib/llm.ts`**——便于切模型、加日志、控成本。
3. **所有 pgvector raw SQL 集中在 `lib/memory.ts`**——不要在 route 里写 `$queryRaw`。
4. **所有 API route 输入用 zod 校验**。
5. **跨进程任务必须用 Inngest function**——不要在 route handler 里 `await openai.embed(...)`。
6. **新增超过 30 行的业务函数加单测**。
7. **数据库变更必须出 migration**，不要直接改 schema 然后 `db push`。
8. **任何 LLM prompt 模板放到 `prompts/` 目录**作为单独文件，不要 inline 在业务代码里。

---

## 9. 风险与陷阱清单

- **不要在 cron 里同步调 LLM**——15min cron × 6 项目 × LLM 调用容易超时。先入 raw 数据，再用 Inngest 异步分析。
- **不要把 Postmortem 全文 embed**——embed `learnings` 字段就够，否则向量噪声大、token 浪费。
- **不要让 Planner 在没有 retrieval 的情况下出 Plan**——哪怕 Memory 是空表也要走 retrieve（返回空数组，prompt 里说明"无历史"）。这是为了保证未来有 Memory 时不需要改 prompt。
- **不要跳过 Approval 阶段直接自动执行**——Phase 1/2 默认全部走审批，Phase 3 后才按 riskLevel 路由。
- **Phase 1 别贪心**：先接一个数据源（建议先 Vercel deploy events 或 Google Analytics），跑通端到端再扩。

---

文档版本：v1（基于设计讨论 2026-05-13）
