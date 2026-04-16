# Playfish Mission Control - Universal Agent Orchestration Platform

## 1. Vision

A **universal command center** for Terry's entire portfolio of projects and companies. One dashboard to monitor, control, and optimize all autonomous agents across MiniAIPDF, FurMates, Talengineer, wheatcoin-community, NIW, Dinnar, and any future ventures.

**Core insight:** The agents (Playfish, PM01, Admin01, DFM) work across ALL projects. The mission control platform should reflect this reality—a single pane of glass for Terry's entire AI-powered operation.

---

## 2. Multi-Project Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Playfish Mission Control                           │
│                                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │  MiniAIPDF │  │   FurMates  │  │ Talengineer │  │ wheatcoin │ │
│  │  Agent Team │  │  Agent Team │  │  Agent Team │  │ Agent Team│ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘ │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                     Universal Agent Layer                        ││
│  │                                                                      ││
│  │   Playfish (CEO) ───────────────────────────────────────────────││
│  │       │           │           │           │                       ││
│  │   PM01-A      PM01-B      Admin01       DFM                     ││
│  │   (Content)   (Content)   (Ops)      (Data)                      ││
│  │       │           │           │           │                       ││
│  │   All Projects (Same agents work across multiple projects)        ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │  Dashboard  │  │    Tasks    │  │   Content   │  │ Analytics │ │
│  │  (Unified)  │  │  (Project   │  │  (Per-      │  │ (Compare  │ │
│  │             │  │   Filter)   │  │   Project)  │  │  Projects)│ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Project Registry

### 3.1 Project Configuration

Each project has a configuration file:

```json
{
  "id": "miniaipdf",
  "name": "MiniAIPDF",
  "description": "AI-powered PDF SaaS tool",
  "color": "#3B82F6",
  "emoji": "📄",
  "status": "active",
  "team": {
    "primary_agent": "playfish",
    "agents": ["pm01", "admin01", "dfm"],
    "github_repo": "dinnar1407-code/miniAIpdf_Claud-code"
  },
  "metrics": {
    "kpis": ["mrp", "users", "api_calls", "conversion_rate"],
    "targets": {
      "mrr": 1000,
      "users": 500
    }
  },
  "platforms": ["twitter", "youtube", "product_hunt"],
  "contacts": {
    "founder": "terry"
  }
}
```

### 3.2 Pre-configured Projects

| Project | ID | Status | Team | Focus |
|---------|-----|--------|------|-------|
| **MiniAIPDF** | `miniaipdf` | Active | All agents | SEO, API, Enterprise |
| **FurMates** | `furmales` | Active | Playfish, PM01 | Shopify, Ads, Content |
| **NIW** | `niw` | Active | Playfish | Petition, Docs |
| **Talengineer** | `talengineer` | Active | Admin01 | Matchmaker, Bugs |
| **wheatcoin** | `wheatcoin` | Active | DFM | SDK, Community |
| **Dinnar** | `dinnar` | Active | Playfish | Apple, CFO |

Future projects can be added via Settings page.

---

## 4. Dashboard: Universal View

### 4.1 Master Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  [🌾 Playfish Mission Control]              [🔔] [⚙️] [👤 Terry]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  PROJECT SELECTOR: [All] [MiniAIPDF] [FurMates] [NIW] ... │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐│
│  │ 💰 MRR   │ │ 👥 Users │ │ 📊 Tasks │ │ 🤖 Agents│ │ ⏰ Time ││
│  │ $1,247   │ │ 2,847    │ │ 23/45    │ │ 4 Active │ │ 142 hrs ││
│  │ +12% ↑   │ │ +8% ↑    │ │ 51%      │ │ 2 Idle   │ │ this wk ││
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └─────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  CROSS-PROJECT ACTIVITY FEED                                │   │
│  │  ─────────────────────────────────────────────────────────── │   │
│  │  [MiniAIPDF] PM01 published Twitter thread         2m ago   │   │
│  │  [FurMates] Playfish replied to customer email    15m ago  │   │
│  │  [NIW] Admin01 sent reminder to Terry             1h ago    │   │
│  │  [wheatcoin] DFM updated SDK docs                 2h ago    │   │
│  │  [Dinnar] Playfish drafted CFO report             3h ago    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐  │
│  │  AGENT STATUS              │  │  ALERTS                     │  │
│  │  ───────────────────────    │  │  ──────────────────────     │  │
│  │  🌾 Playfish    ● Active   │  │  🔴 PH launched!  2m ago    │  │
│  │  📝 PM01       ● Active    │  │  🟡 API error      1h ago    │  │
│  │  📝 PM01-B     ○ Idle      │  │  🔵 NIW deadline   3d        │  │
│  │  🔧 Admin01    ● Active    │  │                              │  │
│  │  📊 DFM        ○ Idle      │  │  [View All]                 │  │
│  └─────────────────────────────┘  └─────────────────────────────┘  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  PROJECT COMPARISON CHART (select metrics to compare)        │   │
│  │  [MRR] [Users] [Tasks] [Activity]                           │   │
│  │  ─────────────────────────────────────────────────────────── │   │
│  │  MiniAIPDF  ████████████████████                          │   │
│  │  FurMates   ████████████                                    │   │
│  │  NIW        ██████                                         │   │
│  │  wheatcoin  ████                                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Project-Specific Dashboard

When a single project is selected, shows deeper metrics for that project:

```
MiniAIPDF Dashboard
├── Quick Stats (MRR, Users, API Calls, Tasks Done)
├── Recent Activity (filtered to MiniAIPDF)
├── MiniAIPDF Agent Status
├── MiniAIPDF Alerts
├── Traffic Chart (Google Analytics)
├── Content Pipeline
├── Top Performing Content
└── Action Items
```

---

## 5. Navigation Structure

### Global Navigation (Sidebar)

```
┌─────────────────┐
│ 🌾 Mission Ctrl │
├─────────────────┤
│ 📊 Dashboard    │  ← Universal or project-filtered
│ 📋 Tasks        │  ← Kanban board
│ 📅 Content      │  ← All content across projects
│ 📈 Analytics    │  ← Compare across projects
│ 🤖 Agents       │  ← All agents + their status
│ 🔔 Alerts       │  ← All alerts
│ ⚙️ Settings     │  ← Manage projects
│                  │
│ ─────────────────│
│ PROJECTS        │
│ 📄 MiniAIPDF    │  ← Quick filter
│ 🛒 FurMates     │
│ 📝 NIW          │
│ 🔧 Talengineer  │
│ 🪙 wheatcoin    │
│ 🏭 Dinnar       │
└─────────────────┘
```

---

## 6. Universal Features (Per-Project or All)

### 6.1 Tasks (Kanban)
- Filter by project OR view all
- Cross-project tasks supported
- Agent assignment with multi-project agents
- Priority: Low | Medium | High | Urgent
- Due date + reminders
- Tags: #marketing, #development, #content, #sales

### 6.2 Content Calendar
- Each content item tagged with project + platform
- Calendar shows content from all projects or filtered
- Platform badges: 🐦 Twitter | 📺 YouTube | 📸 IG | 🔗 LinkedIn
- Status: Draft | Scheduled | Published | Failed
- Performance metrics per item

### 6.3 Analytics
- **Per-project:** Deep metrics for each project
- **Cross-project:** Compare MRR, users, growth, engagement
- **Agent productivity:** Tasks completed, content published
- **Time tracking:** Hours worked per agent per project

### 6.4 Alerts
- Severity: 🔴 Critical | 🟡 Warning | 🔵 Info
- Source: Project | Platform | Agent | System
- Auto-generated by agents (e.g., "API error", "PH launched")
- Manual alerts (e.g., "CFO meeting tomorrow")
- Snooze, acknowledge, resolve

### 6.5 Agent Management
- See all agents across all projects
- Current task + project
- Activity timeline
- Pause/resume per agent
- Override decisions

---

## 7. Settings: Project Management

### 7.1 Add New Project

```
Project Name: [________________]
Project ID: [auto-generated from name]
Description: [________________]
Color: [●] [●] [●] [●]
Emoji: [📦]

Team Configuration:
├── Primary Agent: [Playfish ▼]
├── Assigned Agents: [✓] PM01 [✓] Admin01 [ ] DFM
│
├── GitHub Repo: [________________]
├── Key Platforms: [🐦] [📺] [📸] [🔗] [+ Add]
│
├── KPI Metrics:
│   ├── [✓] MRR
│   ├── [✓] Users
│   ├── [ ] Tasks Completed
│   └── [+ Add Custom Metric]
│
└── Contacts:
    └── Founder: [Terry ▼]
```

### 7.2 Project Archival

Projects can be "Archived" (hidden from main view but data preserved):
- Dinnar Crisis → Archived after resolution
- Past experiments → Archived after pivot

---

## 8. Technical Architecture

### 8.1 Data Model Extension

```prisma
model Project {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique  // URL-friendly ID
  description String?
  color       String   @default("#3B82F6")
  emoji       String   @default("📦")
  status      ProjectStatus @default(ACTIVE)
  createdAt   DateTime @default(now())
  
  tasks       Task[]
  content     ContentItem[]
  alerts      Alert[]
  metrics     MetricSnapshot[]
  agentAssignments AgentAssignment[]
}

model AgentAssignment {
  id        String   @id @default(cuid())
  agentId   String
  projectId String
  project   Project  @relation(fields: [projectId], references: [id])
  role      String   // "primary", "contributor"
  assignedAt DateTime @default(now())
  
  @@unique([agentId, projectId])
}

model Task {
  // ... existing fields ...
  projectId  String?
  project    Project? @relation(fields: [projectId], references: [id])
}

model ContentItem {
  // ... existing fields ...
  projectId  String?
  project    Project? @relation(fields: [projectId], references: [id])
}

model Alert {
  // ... existing fields ...
  projectId  String?
  project    Project? @relation(fields: [projectId], references: [id])
}
```

### 8.2 API Extension

```typescript
// Project-aware API
GET    /api/projects                    // List all projects
POST   /api/projects                   // Create project
GET    /api/projects/:slug             // Get project details
PATCH  /api/projects/:slug             // Update project
DELETE /api/projects/:slug             // Archive project

// Project-filtered endpoints
GET    /api/tasks?project=:slug        // Tasks for project
GET    /api/tasks?project=all          // All tasks
GET    /api/content?project=:slug      // Content for project
GET    /api/analytics?project=:slug    // Analytics for project
GET    /api/analytics?compare=true      // Cross-project comparison

// Universal dashboard
GET    /api/dashboard?project=all      // All projects aggregated
GET    /api/dashboard?project=:slug    // Single project
```

---

## 9. Agent Integration

### 9.1 Project Context for Agents

Each agent now knows which projects they're assigned to:

```
Playfish:
- MiniAIPDF (primary)
- FurMates (secondary)
- NIW (primary)
- Dinnar (occasional)

PM01:
- MiniAIPDF (content)
- FurMates (content)

Admin01:
- MiniAIPDF (ops)
- Talengineer (bugs)
- wheatcoin (support)

DFM:
- wheatcoin (primary)
- MiniAIPDF (analytics)
```

### 9.2 Agent Task Routing

When Playfish assigns a task, specify project:
```
"Create 5 SEO blog posts for MiniAIPDF"
"Monitor FurMates Shopify for customer messages"
"Update NIW petition letter for Terry"
```

Tasks auto-tagged with project, appear in correct project view.

---

## 10. Mobile Experience

### 10.1 Mobile Layout

```
┌─────────────────────┐
│ 🌾 Mission Ctrl  [🔔]│
├─────────────────────┤
│                     │
│  [Project Pills]    │
│  [All][Mini][Fur]   │
│                     │
│  ┌─────────────────┐│
│  │ 💰 MRR   $1,247 ││
│  │ ↑ +12%          ││
│  └─────────────────┘│
│  ┌─────────────────┐│
│  │ 📊 Tasks   23/45││
│  │ ████████░░ 51% ││
│  └─────────────────┘│
│                     │
│  ACTIVITY           │
│  ───────────────    │
│  PM01 posted Twitter│
│  2m ago            │
│                     │
│  🌾 CFO call at 5pm│
│  1h ago            │
│                     │
├─────────────────────┤
│ [🏠][📋][📅][📈][⚙️]│
└─────────────────────┘
```

### 10.2 Quick Actions (Mobile)

- Swipe a task → Change status
- Tap alert → View details
- Pull to refresh
- Quick add task (FAB button)

---

## 11. Deployment & Scaling

### 11.1 Deployment

```
Frontend:  Vercel (vercel.com/deploy)
Backend:   Railway or Render
Database:  PostgreSQL (Neon, Supabase, or Railway)
Auth:      NextAuth.js with Google OAuth
Domain:    mission-control.miniaipdf.com (or separate)
```

### 11.2 Future: Multi-tenant

Later, this could become a **SaaS product**:
- Other companies use it to manage their AI agent teams
- White-label option
- Per-seat pricing

But for now, Terry's personal use is the target.

---

## 12. Phased Implementation

### Phase 1: MiniAIPDF Only (v1)
- Single-project dashboard
- Basic Kanban
- Simple analytics
- MVP only

### Phase 2: Multi-Project (v2)
- Project selector
- Cross-project activity feed
- Project comparison charts
- Agent multi-project support

### Phase 3: Advanced (v3)
- Full analytics per project
- Time tracking
- Alert automation
- Mobile polish

### Phase 4: Platform (v4)
- Settings page for project management
- Archive projects
- Custom KPIs per project
- Team members (invite others)

---

## 13. Success Metrics

- Terry can see ALL projects in < 3 taps
- Agent assignment clarity improved
- Cross-project dependencies visible
- Time saved on status meetings
- Platform used daily by Terry
