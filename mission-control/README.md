# 🌾 Playfish Mission Control

Universal AI Agent Orchestration Platform for Terry's entire business portfolio.

## Quick Start

```bash
# 1. Enter the project folder
cd mission-control

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.local.example .env.local

# 4. Set up database
npx prisma db push
npm run db:seed

# 5. Start dev server
npm run dev
```

Then open: http://localhost:3000

---

## Pages

| Page | URL | Description |
|------|-----|-------------|
| Dashboard | `/dashboard` | Unified command center |
| Tasks | `/tasks` | Kanban board |
| Content | `/content` | Content calendar & list |
| Analytics | `/analytics` | Charts & metrics |
| Agents | `/agents` | Agent status & control |
| Alerts | `/alerts` | Alert management |
| Workflows | `/workflows` | Automation engine |
| Settings | `/settings` | Project management |

## Projects

- 📄 MiniAIPDF — AI PDF SaaS
- 🛒 FurMates — Pet supplies
- 📝 NIW — Immigration petition
- 🔧 Talengineer — Talent matchmaker
- 🪙 wheatcoin — Crypto SDK
- 🏭 Dinnar — Industrial ops

## Deploy to Vercel

```bash
npx vercel --prod
```

---

*Built for Terry by Playfish · J.A.R.V.I.S. Lives! 🚀*
