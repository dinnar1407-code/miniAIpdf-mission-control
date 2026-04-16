# Build MiniAIPDF Mission Control Dashboard

## Context
Terry wants a custom web dashboard to manage MiniAIPDF's autonomous growth engine. You need to build a "command center" style dashboard where Terry can monitor all Agent activities, content pipelines, analytics, and revenue metrics in real-time from web or mobile.

## Key Requirements

### 1. Must-Have Pages
- **Dashboard**: Quick stats (MRR, Users, API Calls, Tasks), recent activity feed, agent status, alerts queue, traffic chart
- **Tasks**: Kanban board (To Do | In Progress | Review | Done | Blocked) with drag-and-drop
- **Content**: Calendar view + list view of all scheduled/published content across platforms
- **Analytics**: Charts for traffic, signups, paying users, MRR, API calls. Date range picker, export CSV
- **Agents**: Status cards for each agent, current task, activity timeline, pause/resume controls
- **Alerts**: Severity-sorted alert queue with acknowledge/resolve actions

### 2. Design
- Dark mode SaaS dashboard (Linear/Vercel inspired)
- Color palette: dark backgrounds (#0A0A0F, #12121A), accent colors for status
- Responsive: Works on desktop and mobile
- Real-time feel: Auto-refresh, live indicators

### 3. Tech Stack
- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Zustand for state, TanStack Query for data fetching
- Prisma + SQLite (can upgrade to PostgreSQL later)
- NextAuth.js for basic auth
- Recharts for charts

### 4. Full Spec
Read the detailed spec at: `PROJECTS/MiniAIPDF/MISSION_CONTROL_SPEC.md`

## Instructions

1. Create a new folder `mission-control/` in this project
2. Initialize Next.js project with TypeScript and Tailwind
3. Set up shadcn/ui components
4. Implement Prisma schema and SQLite database
5. Build all pages and API routes
6. Style according to spec
7. Make it mobile responsive
8. Add real-time feel (polling every 30s, live indicators)

## Development Priority
1. Dashboard page with mock data first (visual confirmation)
2. Task Kanban CRUD
3. Analytics charts
4. Agent status cards
5. Alerts queue
6. Content calendar
7. Real data integration
8. Auth

## Note
This is for MiniAIPDF (miniaipdf.com) - Terry's AI PDF SaaS product. The dashboard should feel professional and inspire confidence in the autonomous growth system.

Start building and ask if you have any questions about the spec.
