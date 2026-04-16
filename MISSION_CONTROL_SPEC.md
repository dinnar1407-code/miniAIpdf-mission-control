# MiniAIPDF Mission Control - Product Specification

## 1. Concept & Vision

**MiniAIPDF Mission Control** is a real-time command center for the autonomous growth engine. It gives Terry a single-pane-of-glass view of all Agent activities, content pipelines, analytics, and revenue metrics—accessible from web or mobile. The interface feels like a NASA ground control dashboard: authoritative, data-rich, and confidence-inspiring.

**Core metaphor:** You are the CEO of an AI-powered growth machine. This is your cockpit.

---

## 2. Design Language

### Aesthetic Direction
Dark-mode SaaS dashboard inspired by Linear, Vercel, and SpaceX mission control. Dense information hierarchy, precise typography, glowing accent highlights on status indicators.

### Color Palette
```
Background Primary:   #0A0A0F (near-black)
Background Secondary: #12121A (card surfaces)
Background Tertiary:  #1A1A24 (elevated elements)
Border:               #2A2A3A (subtle dividers)
Text Primary:         #FFFFFF
Text Secondary:       #8B8B9E
Text Muted:          #5A5A6E
Accent Blue:          #3B82F6 (links, primary actions)
Accent Green:         #10B981 (success, online, completed)
Accent Yellow:        #F59E0B (warnings, in-progress)
Accent Red:           #EF4444 (errors, blocked)
Accent Purple:        #8B5CF6 (special highlights)
```

### Typography
```
Headings:    Inter (700) — clean, authoritative
Body:        Inter (400/500) — readable at small sizes
Monospace:   JetBrains Mono — logs, code, timestamps
```

### Spatial System
- Base unit: 4px
- Component padding: 12px / 16px / 24px
- Card gap: 16px
- Section gap: 32px
- Border radius: 8px (cards), 6px (buttons), 4px (inputs)

### Motion Philosophy
- Subtle fade-ins for new data (opacity 0→1, 200ms ease-out)
- Progress bars animate on value change (300ms ease-in-out)
- Status indicators pulse gently (2s infinite for "active" states)
- No jarring transitions—everything flows like data streaming in

---

## 3. Layout & Structure

### Global Layout
```
┌─────────────────────────────────────────────────────────────┐
│  Sidebar (240px fixed)  │  Main Content Area               │
│                         │                                   │
│  ┌─────────────────┐   │  ┌─────────────────────────────┐  │
│  │ Logo / Brand   │   │  │  Header: Page Title + Actions│  │
│  └─────────────────┘   │  └─────────────────────────────┘  │
│                         │                                   │
│  ┌─────────────────┐   │  ┌─────────────────────────────┐  │
│  │ Navigation      │   │  │                              │  │
│  │ - Dashboard     │   │  │  Page Content                │  │
│  │ - Tasks         │   │  │  (scrollable)                │  │
│  │ - Content       │   │  │                              │  │
│  │ - Analytics     │   │  │                              │  │
│  │ - Agents        │   │  │                              │  │
│  │ - Alerts        │   │  └─────────────────────────────┘  │
│  │ - Settings      │   │                                   │
│  └─────────────────┘   │                                   │
│                         │                                   │
│  ┌─────────────────┐   │                                   │
│  │ Agent Status    │   │                                   │
│  │ (compact)       │   │                                   │
│  └─────────────────┘   │                                   │
└─────────────────────────────────────────────────────────────┘
```

### Responsive Strategy
- Desktop (1280px+): Full sidebar + content
- Tablet (768-1279px): Collapsible sidebar, compact cards
- Mobile (< 768px): Bottom navigation, stacked cards, swipeable views

### Page Structure

#### Dashboard (Home)
```
┌────────────────────────────────────────────────────┐
│  Quick Stats Row (4 cards)                         │
│  [Revenue] [Users] [API Calls] [Tasks Done Today]   │
├────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌──────────────────┐   │
│  │  Recent Activity    │  │  Active Agents   │   │
│  │  (live feed)        │  │  (compact list)  │   │
│  └──────────────────────┘  └──────────────────┘   │
├────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌──────────────────┐   │
│  │  Content Pipeline    │  │  Alerts Queue    │   │
│  │  (Kanban mini)      │  │  (critical first)│   │
│  └──────────────────────┘  └──────────────────┘   │
├────────────────────────────────────────────────────┤
│  Traffic Chart (last 7 days)                       │
└────────────────────────────────────────────────────┘
```

#### Tasks Page
Full Kanban board with drag-and-drop:
- Columns: To Do | In Progress | Review | Done | Blocked
- Filter by: Agent | Priority | Type | Date
- Quick add task inline

#### Content Page
Calendar view + list view toggle:
- Calendar: Visualize scheduled content
- List: Sortable table with all content items
- Filter by: Platform | Status | Date | Agent

#### Analytics Page
- Date range picker
- Platform selector (multi-select)
- Key metrics: Traffic, Signups, Paying Users, MRR, API Calls
- Trend charts with comparison to previous period
- Top content table

#### Agents Page
- Card per Agent: Avatar, Name, Status, Current Task, Performance
- Activity timeline
- Task history
- Output logs (collapsible)

#### Alerts Page
- Severity: Critical | Warning | Info
- Source: Platform | System | Agent
- Status: New | Acknowledged | Resolved
- Action buttons: View Details | Dismiss | Assign

---

## 4. Features & Interactions

### 4.1 Real-time Dashboard
- Auto-refresh every 30 seconds (configurable)
- Manual refresh button with spin animation
- Last updated timestamp visible
- Connection status indicator (green dot = live)

### 4.2 Task Management
- Create task: Click "+" → modal with fields (title, description, agent, priority, due date)
- Edit task: Click card → slide-out panel
- Move task: Drag between columns, or use status dropdown
- Delete task: Swipe left (mobile) or hover → delete icon
- Bulk actions: Select multiple → assign/prioritize/delete

### 4.3 Content Calendar
- Create content: Click date → modal with platform selector, content type, scheduled time
- Connect to social accounts via OAuth (future phase)
- Preview content before publishing
- Reschedule: Drag content to new date/time

### 4.4 Analytics
- Date range: Last 7 days | 30 days | 90 days | Custom
- Export: CSV download for all data
- Sharing: Generate read-only link for reports
- Alerts threshold: Set custom thresholds per metric

### 4.5 Agent Control
- Pause/Resume agent
- Assign specific task
- View full activity log
- Override agent decision (with reason logged)

### 4.6 Notifications
- In-app: Bell icon with unread count, dropdown list
- Email digest: Daily/weekly summary (configurable)
- Telegram push: Critical alerts only (optional)

### 4.7 Mobile Experience
- Bottom tab navigation (5 items max)
- Swipe gestures for common actions
- Pull-to-refresh
- Offline mode: View cached data, queue actions

---

## 5. Component Inventory

### Stat Card
- States: Default, Loading (skeleton), Error (retry button)
- Variants: Small (1 number), Large (number + trend + sparkline)
- Hover: Subtle glow, cursor pointer if clickable

### Task Card (Kanban)
- Default: White border-left accent by priority
- Hover: Elevated shadow, border brightens
- Dragging: Slight rotation, drop shadow, opacity 0.9
- Blocked: Red border, warning icon

### Agent Badge
- Online: Green dot + "Active"
- Idle: Gray dot + "Idle"  
- Error: Red dot + "Error" + tooltip with error message
- Pulse animation when actively working

### Chart Components
- Line chart: Smooth curves, gradient fill below
- Bar chart: Rounded top corners
- Donut chart: Center label with total
- Sparkline: Minimal, no axes

### Alert Item
- Critical: Red left border, red icon
- Warning: Yellow left border, yellow icon
- Info: Blue left border, blue icon
- Hover: Background lightens, action buttons appear

### Modal / Slide Panel
- Backdrop: rgba(0,0,0,0.8) with blur(4px)
- Enter: Slide from right (panels) or fade+scale (modals)
- Exit: Reverse animation, 200ms
- Close: X button, Escape key, click outside

### Form Inputs
- Default: Dark background, subtle border
- Focus: Blue border, subtle glow
- Error: Red border, error message below
- Disabled: Reduced opacity, cursor not-allowed

### Buttons
- Primary: Blue background, white text
- Secondary: Transparent, blue text, blue border
- Danger: Red background, white text
- Ghost: Transparent, gray text, no border
- Loading: Spinner replaces text, disabled state
- Hover: Brightness increase 10%
- Active: Brightness decrease 5%

### Empty States
- Centered illustration (simple line art)
- Descriptive heading + subtext
- CTA button when applicable
- Example: "No tasks yet. Create your first task to get started."

### Loading States
- Skeleton screens for cards and lists
- Spinner for buttons and inline loading
- Progress bar for file uploads

### Error States
- Red border, error icon
- Clear error message
- Retry button when applicable
- "Something went wrong. Please try again."

---

## 6. Technical Approach

### Stack
```
Frontend:    Next.js 14 (App Router) + TypeScript
Styling:     Tailwind CSS
UI Library:  shadcn/ui (Radix primitives)
Charts:      Recharts
State:       Zustand (lightweight, simple)
Data Fetch:  TanStack Query (React Query)
Forms:       React Hook Form + Zod
Backend:     Next.js API Routes (serverless)
Database:    SQLite (via Prisma) for local/dev
             PostgreSQL for production
Auth:        NextAuth.js (credentials + OAuth)
Real-time:   Server-Sent Events (SSE) or WebSocket
Deployment:  Vercel (frontend) + Railway/Render (backend)
```

### Data Model

```
User {
  id: string (uuid)
  email: string
  name: string
  role: enum (admin, viewer)
  createdAt: DateTime
}

Agent {
  id: string
  name: string (e.g., "PM01", "Admin01", "Playfish")
  type: enum (ceo, content, operations, data)
  status: enum (active, idle, error, paused)
  currentTask: string?
  lastActiveAt: DateTime
  config: JSON
}

Task {
  id: string
  title: string
  description: string?
  status: enum (todo, in_progress, review, done, blocked)
  priority: enum (low, medium, high, urgent)
  assignedAgent: Agent?
  dueDate: DateTime?
  createdAt: DateTime
  updatedAt: DateTime
  completedAt: DateTime?
}

ContentItem {
  id: string
  title: string
  platform: enum (youtube, tiktok, instagram, twitter, linkedin, blog, newsletter)
  type: string (e.g., "tutorial", "tip", "announcement")
  status: enum (draft, scheduled, published, failed)
  scheduledFor: DateTime?
  publishedAt: DateTime?
  publishedUrl: string?
  metrics: JSON { views, likes, shares, comments }
  createdBy: Agent
}

Alert {
  id: string
  severity: enum (critical, warning, info)
  source: string
  message: string
  status: enum (new, acknowledged, resolved)
  createdAt: DateTime
  acknowledgedAt: DateTime?
  resolvedAt: DateTime?
}

MetricSnapshot {
  id: string
  date: Date
  platform: string
  metric: string
  value: number
  metadata: JSON?
}

ActivityLog {
  id: string
  agentId: string
  action: string
  target: string?
  result: string?
  timestamp: DateTime
}
```

### API Design

```
GET    /api/dashboard          → { stats, recentActivity, alerts }
GET    /api/tasks              → Task[]
POST   /api/tasks              → Task
PATCH  /api/tasks/:id          → Task
DELETE /api/tasks/:id          → void
GET    /api/content            → ContentItem[]
POST   /api/content            → ContentItem
PATCH  /api/content/:id        → ContentItem
GET    /api/analytics          → MetricSnapshot[]
GET    /api/agents             → Agent[]
PATCH  /api/agents/:id         → Agent
GET    /api/alerts             → Alert[]
PATCH  /api/alerts/:id         → Alert
GET    /api/activity           → ActivityLog[]

POST   /api/agents/:id/command → { command: "pause" | "resume" | "assign" }
```

### Authentication
- Admin users: Email + password (bcrypt hashed)
- View-only viewers: Read-only access
- Session-based auth with HTTP-only cookies
- Optional: Google/GitHub OAuth for convenience

### Real-time Updates
- Server-Sent Events (SSE) for dashboard auto-refresh
- Polling fallback for mobile (every 60 seconds)
- WebSocket upgrade path when scale demands

---

## 7. Development Phases

### Phase 1: Core MVP (1-2 weeks)
- Dashboard with static mock data
- Task Kanban (CRUD)
- Simple analytics charts
- Agent status cards
- Single user, no auth

### Phase 2: Data Layer (1 week)
- SQLite database setup
- API routes for all entities
- Real data flowing into dashboard
- Basic auth

### Phase 3: Automation Integration (1 week)
- Connect to OpenClaw agents via API
- Agent commands (pause/resume)
- Activity logging from agents
- Real-time updates via SSE

### Phase 4: Polish & Mobile (1 week)
- Mobile responsive design
- Notification system
- Alert management
- Settings page

### Phase 5: Scale (ongoing)
- PostgreSQL migration
- OAuth integration
- Advanced analytics
- Multi-team support

---

## 8. File Structure

```
mission-control/
├── app/
│   ├── layout.tsx
│   ├── page.tsx (redirects to /dashboard)
│   ├── dashboard/
│   │   └── page.tsx
│   ├── tasks/
│   │   └── page.tsx
│   ├── content/
│   │   └── page.tsx
│   ├── analytics/
│   │   └── page.tsx
│   ├── agents/
│   │   └── page.tsx
│   ├── alerts/
│   │   └── page.tsx
│   ├── settings/
│   │   └── page.tsx
│   └── api/
│       ├── dashboard/
│       ├── tasks/
│       ├── content/
│       ├── analytics/
│       ├── agents/
│       └── alerts/
├── components/
│   ├── ui/ (shadcn components)
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   └── mobile-nav.tsx
│   ├── dashboard/
│   │   ├── stat-card.tsx
│   │   ├── activity-feed.tsx
│   │   └── agent-status.tsx
│   ├── tasks/
│   │   ├── kanban-board.tsx
│   │   ├── task-card.tsx
│   │   └── task-modal.tsx
│   ├── content/
│   │   ├── calendar.tsx
│   │   └── content-card.tsx
│   ├── analytics/
│   │   ├── charts.tsx
│   │   └── metric-table.tsx
│   └── shared/
│       ├── alert-item.tsx
│       └── empty-state.tsx
├── lib/
│   ├── db.ts (Prisma client)
│   ├── auth.ts
│   └── utils.ts
├── prisma/
│   └── schema.prisma
└── public/
```

---

## 9. Out of Scope (v1)

- Social media OAuth connections
- Two-way messaging with agents
- Video hosting/transcoding
- Mobile native apps (PWA acceptable)
- Multi-tenant / white-label
- Billing integration

---

## 10. Success Metrics

- Dashboard loads in < 2 seconds
- All CRUD operations < 500ms
- Mobile-first testing passes
- Zero console errors in production
- Terry can perform any action in < 3 clicks
