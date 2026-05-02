# Mission Control — 项目上下文

MiniAIPDF 自动增长引擎的统一控制中心（命令中心式仪表盘）。用于监控旗下所有项目的 AI 代理活动、内容管道、分析数据和营收指标。

管理的项目包括：MiniAIPDF、TalEngineer、FurMates、NIW、wheatcoin、Dinnar 等。

## 技术栈

- **框架**：Next.js 14（App Router）+ TypeScript
- **UI**：Tailwind CSS + shadcn/ui + Radix UI
- **状态管理**：Zustand + TanStack Query
- **图表**：Recharts
- **认证**：NextAuth.js
- **数据库**：PostgreSQL + Prisma ORM（`prisma/schema.prisma`）
- **表单**：React Hook Form + Zod
- **部署**：Vercel

## 项目结构

```
mission-control/
  app/          Next.js App Router 页面和 API
  components/   可复用 React 组件
  lib/          工具函数和数据库客户端
  prisma/
    schema.prisma   数据库结构
    seed.ts         测试数据
```

## 核心数据模型

| 模型 | 用途 |
|------|------|
| Project | 被管理的各个产品项目 |
| Agent | AI 代理（状态、当前任务、活动记录） |
| Task | Kanban 任务（Todo / InProgress / Review / Done / Blocked） |
| ContentItem | 内容日历（跨平台发布内容） |
| Workflow | 自动化工作流 |
| Alert | 告警队列（按严重程度排序） |
| MetricSnapshot | 指标快照（MRR、用户数、API 调用量） |

## 主要页面

- `/` **Dashboard**：MRR、用户数、API 调用量、近期活动、代理状态、告警
- `/tasks` **任务看板**：拖拽式 Kanban（shadcn/ui + dnd-kit）
- `/content` **内容日历**：日历视图 + 列表视图
- `/analytics` **数据分析**：流量、注册、付费用户、MRR 图表
- `/agents` **代理管理**：代理状态卡片、暂停/恢复控制
- `/alerts` **告警队列**：确认/解决操作

## 设计规范

- 深色模式（Linear/Vercel 风格）
- 主背景色：`#0A0A0F`、`#12121A`
- 每 30 秒自动轮询刷新数据
- 响应式，桌面和移动端均可用

## 开发注意事项

- 数据轮询用 TanStack Query，不要自己写 setInterval
- 组件库用 shadcn/ui，新增 UI 组件先查是否已有
- 数据库迁移用 `npx prisma migrate dev`
- 种子数据：`npx prisma db seed`
- 环境变量：`DATABASE_URL`、`NEXTAUTH_SECRET`、`NEXTAUTH_URL`
