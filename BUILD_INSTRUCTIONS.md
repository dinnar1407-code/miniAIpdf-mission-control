# MiniAIPDF Mission Control - Build Instructions

## 🚀 START HERE

Build a universal AI Agent orchestration platform called **"Playfish Mission Control"** - a command center for Terry's entire business portfolio (MiniAIPDF, FurMates, NIW, Talengineer, wheatcoin, Dinnar).

This is a Next.js web application where Terry can design, execute, and monitor multi-step automation workflows across all his projects.

---

## Project Status

**Phase:** Planning Complete - Starting Development
**Repo:** https://github.com/dinnar1407-code/miniAIpdf-mission-control
**Specs:** See `*.md` files in this directory

---

## Reading Order (DO THIS FIRST)

1. Read `PLATFORM_SPEC.md` - Universal multi-project architecture
2. Read `MISSION_CONTROL_SPEC.md` - Detailed UI/UX specifications  
3. Read `WORKFLOW_ENGINE.md` - Workflow automation engine
4. Read `JARVIS_ROLE.md` - Playfish's role as AI Chief of Staff

---

## Tech Stack (MANDATORY)

```
Frontend:  Next.js 14 (App Router) + TypeScript
Styling:   Tailwind CSS + shadcn/ui
Charts:    Recharts
State:     Zustand
Data Fetch: TanStack Query
Forms:     React Hook Form + Zod
Backend:   Next.js API Routes
Database:  SQLite (Prisma) - can migrate to PostgreSQL later
Auth:      NextAuth.js (simple)
Real-time: Server-Sent Events (SSE)
Deployment: Vercel
```

---

## Phase 1: MVP Scope (Build This First)

### 1. Project Structure

Create `mission-control/` folder in this repo:

```
mission-control/
├── app/
│   ├── layout.tsx
│   ├── page.tsx (redirects to /dashboard)
│   ├── dashboard/page.tsx
│   ├── tasks/page.tsx
│   ├── content/page.tsx
│   ├── analytics/page.tsx
│   ├── agents/page.tsx
│   ├── alerts/page.tsx
│   ├── workflows/page.tsx
│   └── api/
│       ├── dashboard/route.ts
│       ├── tasks/route.ts
│       └── ...
├── components/
│   ├── ui/ (shadcn)
│   ├── layout/ (sidebar, header)
│   ├── dashboard/ (stat cards, activity feed)
│   ├── tasks/ (kanban board)
│   ├── workflows/ (workflow builder)
│   └── ...
├── lib/
│   ├── db.ts (Prisma client)
│   └── ...
└── prisma/
    └── schema.prisma
```

### 2. Database Schema

Use Prisma with SQLite:

```prisma
model Project {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  description String?
  color       String   @default("#3B82F6")
  emoji       String   @default("📦")
  status      String   @default("active")
  createdAt   DateTime @default(now())
  
  tasks       Task[]
  content     ContentItem[]
  alerts      Alert[]
  metrics     MetricSnapshot[]
}

model Task {
  id          String   @id @default(cuid())
  title       String
  description String?
  status      String   @default("todo")
  priority    String   @default("medium")
  projectId   String?
  project     Project? @relation(fields: [projectId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Workflow {
  id           String   @id @default(cuid())
  name         String
  description  String?
  triggerType  String
  steps       String   // JSON array
  status      String   @default("draft")
  createdAt   DateTime @default(now())
  
  runs        WorkflowRun[]
}

model WorkflowRun {
  id          String   @id @default(cuid())
  workflowId  String
  workflow    Workflow @relation(fields: [workflowId], references: [id])
  status      String   @default("pending")
  currentStep Int      @default(0)
  startedAt   DateTime?
  completedAt DateTime?
}

model Alert {
  id          String   @id @default(cuid())
  severity    String
  message     String
  status      String   @default("new")
  projectId   String?
  project     Project? @relation(fields: [projectId], references: [id])
  createdAt   DateTime @default(now())
}
```

### 3. Pages to Build (Phase 1)

#### Dashboard (/)
- Quick stats cards (MRR, Users, Tasks, Agent Status)
- Recent activity feed (mock data initially)
- Agent status section
- Alerts queue

#### Tasks (/tasks)
- Kanban board with columns: To Do | In Progress | Review | Done | Blocked
- Task cards with drag-and-drop
- Filter by project

#### Workflows (/workflows)
- List of workflows
- Visual workflow builder (start simple)
- Run history

#### Analytics (/analytics)
- Simple charts (Recharts)
- Metric cards

#### Agents (/agents)
- Agent cards with status
- Simple activity timeline

### 4. Design System

Dark mode, Linear-inspired:

```css
Background Primary:   #0A0A0F
Background Secondary: #12121A
Background Tertiary:  #1A1A24
Border:               #2A2A3A
Text Primary:         #FFFFFF
Text Secondary:       #8B8B9E
Accent Blue:          #3B82F6
Accent Green:         #10B981
Accent Yellow:        #F59E0B
Accent Red:           #EF4444
```

### 5. Pre-configured Projects

Include these projects in seed data:

```json
[
  { "name": "MiniAIPDF", "slug": "miniaipdf", "color": "#3B82F6", "emoji": "📄" },
  { "name": "FurMates", "slug": "furmales", "color": "#10B981", "emoji": "🛒" },
  { "name": "NIW", "slug": "niw", "color": "#F59E0B", "emoji": "📝" },
  { "name": "Talengineer", "slug": "talengineer", "color": "#8B5CF6", "emoji": "🔧" },
  { "name": "wheatcoin", "slug": "wheatcoin", "color": "#F97316", "emoji": "🪙" },
  { "name": "Dinnar", "slug": "dinnar", "color": "#EF4444", "emoji": "🏭" }
]
```

---

## Getting Started

```bash
# Clone the repo
cd ~/MiniAIPDF-Projects
git clone https://github.com/dinnar1407-code/miniAIpdf-mission-control.git
cd miniAIpdf-mission-control

# Create Next.js app
npx create-next-app@latest mission-control --typescript --tailwind --app --src-dir=false
cd mission-control

# Install dependencies
npm install @prisma/client prisma zustand @tanstack/react-query recharts react-hook-form zod @hookform/resolvers
npm install -D tailwindcss postcss autoprefixer

# Initialize shadcn/ui
npx shadcn-ui@latest init

# Add shadcn components
npx shadcn-ui@latest add button card input textarea select badge tabs dropdown-menu dialog sheet

# Set up Prisma
npx prisma init --datasource-provider sqlite

# Create schema (copy from above)
# Then:
npx prisma generate
npx prisma db push

# Run development server
npm run dev
```

---

## Development Priority

### Week 1: Foundation
1. ✅ Next.js project setup
2. ✅ Dark mode design system
3. ✅ Sidebar navigation
4. ✅ Dashboard page with mock stats
5. ✅ Task Kanban (basic CRUD)

### Week 2: Core Features
6. ⬜ Project selector (multi-project)
7. ⬜ Workflow list and simple builder
8. ⬜ Analytics charts
9. ⬜ Agent status cards
10. ⬜ Alert management

### Week 3: Polish
11. ⬜ Mobile responsive
12. ⬜ Real data integration
13. ⬜ SSE for real-time updates
14. ⬜ Workflow execution engine (basic)

### Week 4: Advanced
15. ⬜ Visual workflow builder
16. ⬜ Approval flows
17. ⬜ Advanced monitoring
18. ⬜ Mobile app

---

## Important Notes

1. **Start with mock data** - Don't wait for real API integrations
2. **Mobile-first** - Must work on phone
3. **Dark mode only** - Linear-style dark theme
4. **Simple auth** - Basic password protection for Terry
5. **Focus on UI** - Get the dashboard looking great first

---

## Communication

- Terry will monitor progress via GitHub
- Commit frequently with clear messages
- If stuck, commit current state and ask questions

---

## Success Criteria (MVP)

- Terry can view dashboard on phone
- Can create and manage tasks
- Can see all 6 projects
- Can view workflow list
- Workflows can be triggered manually

---

*Let's build J.A.R.V.I.S.!*
