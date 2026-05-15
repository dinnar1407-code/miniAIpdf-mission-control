'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Locale = 'zh' | 'en';

const STORAGE_KEY = 'mc_locale';

// ── zh dictionary (source of truth for shape) ──────────────────────────────

const zh = {
  // Common
  loading:        '加载中…',
  noData:         '暂无数据',
  viewAll:        '全部 →',
  viewHistory:    '查看历史 →',
  all:            '全部',
  save:           '保存',
  close:          '关闭',
  cancel:         '取消',
  testConnection: '测试连接',
  sendTest:       '发送测试',
  enabled:        '启用',
  disabled:       '关闭',

  // Time
  justNow: '刚刚',
  timeAgo(ms: number): string {
    const m = Math.floor(ms / 60000);
    if (m < 1)  return '刚刚';
    if (m < 60) return `${m}分钟前`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}小时前`;
    return `${Math.floor(h / 24)}天前`;
  },

  // Login
  loginTitle:        'Mission Ctrl 登录',
  loginButton:       '登录',
  loginLoading:      '验证中…',
  loginErrorToken:   'Token 不对',
  loginErrorNetwork: '网络错误',

  // Dashboard
  dashSubtitle:         'Playfish Universal Platform · All Projects',
  dashWeeklyWorkflows:  '本周 Workflows',
  dashDoneTriggered:    '完成 / 触发',
  dashContentPublished: '内容已发布',
  dashAllChannels:      '全渠道',
  dashDraftCount:       (n: number) => `草稿 ${n} 篇`,
  dashPendingApprovals: '待审批',
  dashActionRequired:   '需要处理',
  dashRecentRuns:       '最近 Workflow 运行',
  dashViewAll:          '查看全部 →',

  // Autopilot overview
  autopilotSubtitle:         '自动驾驶总览',
  autopilotInsights:         '洞察流',
  autopilotNoInsights:       '暂无 Insights',
  autopilotActiveMissions:   '当前任务',
  autopilotExecuting:        '执行中',
  autopilotQueued:           '排队中',
  autopilotNoActiveMissions: '无进行中任务',
  autopilotFeedback:         '反馈库',

  // Autopilot sub-pages
  insightsSubtitle:  (n: number) => `自动观测 · ${n} 条`,
  insightsNone:      '暂无 Insights',
  insightsNoneHint:  'Observer 扫描后自动生成',
  plansSubtitle:     (n: number, pending: number) =>
    `自动驾驶计划 · ${n} 条${pending > 0 ? ` · ${pending} 待审批` : ''}`,
  plansNone:         '暂无 Plans',
  plansNoneHint:     'Insight 触发后自动生成',
  plansPendingBanner:(n: number) => `${n} 个计划等待审批后才能执行`,
  missionsSubtitle:  (n: number, running: number) =>
    `执行记录 · ${n} 条${running > 0 ? ` · ${running} 运行中` : ''}`,
  missionsNone:      '暂无 Missions',
  missionsNoneHint:  '批准 Plan 后自动触发执行',

  // Agents
  agentsSubtitle:        'AI 智能体管理',
  agentsActive:          '活跃 Agent',
  agentsTasksCompleted:  '累计完成任务',
  agentsContentCount:    '内容已发布',
  agentsWeeklyWorkflows: '本周 Workflow',
  agentsNoData:          '还没有 Agent 数据',
  agentsNoDataHint:      '运行一次 Workflow 后，Agent 记录会自动创建',
  agentsIdle:            '空闲 — 等待任务',
  agentsTasksStat:       (n: number) => `✅ ${n} 任务`,
  agentsContentStat:     (n: number) => `📄 ${n} 内容`,
  agentsRecentActivity:  '近期活动',
  agentsNoActivity:      '暂无活动记录',
  agentsClickToView:     '点击 Agent 卡片查看详情',
  agentsRecentRuns:      '最近 Workflow 运行',
  agentsTasksDone:       '完成任务',
  agentsPublished:       '已发内容',
  agentsPause:           '暂停',
  agentsActivate:        '激活',

  // Content
  contentSubtitle:    '全媒体矩阵 · 发布管理',
  contentTotal:       '总内容',
  contentPublished:   '已发布',
  contentScheduled:   '待发布',
  contentDraft:       '草稿',
  contentApprove:     '审核通过',
  contentPublishNow:  '立即发布',
  contentNoItems:     '暂无内容',
  contentNoItemsHint: '运行带有 📡 Publish 步骤的 Workflow 后，内容会自动出现在这里',
  contentNoTitle:     '无标题',
  contentResults:     '发布结果',
  contentCreatedAt:   '创建：',
  contentScheduledAt: '计划：',
  contentPublishedAt: '发布：',
  contentSource:      '来源：Workflow Run',
  // Status / type labels
  statusDraft:     '草稿',
  statusApproved:  '已审批',
  statusPublished: '已发布',
  statusFailed:    '失败',
  statusScheduled: '待发布',
  typeShortPost:   '短帖',
  typeLongPost:    '长文',
  typeArticle:     '博客',
  typeThread:      '推文串',
  typeVideo:       '视频',
  typeImagePost:   '图文',
  typeLinkShare:   '链接',

  // Settings
  settingsSubtitle:           '平台配置 · J.A.R.V.I.S.',
  settingsTabChannels:        '渠道',
  settingsTabIntegrations:    '集成',
  settingsTabAI:              'AI 引擎',
  settingsTabApiKeys:         'API Keys',
  settingsTabProjects:        '项目',
  settingsChannelsTitle:      '发布渠道',
  settingsChannelsDesc:       '配置 API 凭证后即可在 Workflow 中使用该渠道发布内容',
  settingsIntegrationsTitle:  '第三方集成',
  settingsIntegrationsDesc:   '配置外部服务的 API 凭证，即可自动获取数据和推送事件',
  settingsAITitle:            'AI 引擎配置',
  settingsAIDesc:             'Workflow 中 Agent 步骤的 AI 驱动设置',
  settingsProjectsTitle:      '项目管理',
  settingsProjectsDesc:       '管理你的项目组合',
  settingsAddProject:         '添加项目',
  settingsRequired:           '必填环境变量',
  settingsViewDocs:           '查看文档',
  settingsChannelEnabled:     '已启用',
  settingsChannelConfigured:  '已配置',
  settingsChannelReserved:    '预留',
  settingsNoFields:           '该渠道暂无官方 API，接口已预留，后续更新自动接入。',
  settingsTestOk:             '✓ 连接测试成功',
  settingsConnConfigured:     '✓ 已配置',
  settingsConnMissing:        '○ 未配置',
  settingsMaxLength:          (n: number) => `最长 ${n} 字`,
  settingsRevoke:             '撤销',
  settingsNoApiKeys:          '暂无 API Key',
  settingsKeyCreated:         '✓ Key 已创建 — 请立即复制，不会再次显示',
  settingsKeyNamePlaceholder: 'Key 名称 (如: Playfish Agent)',
  settingsApiKeyDesc:         '用于 Playfish Agent 和外部集成',
  settingsRevokedBadge:       '已撤销',
  settingsCreatedAt:          '创建于',
  settingsLastUsed:           '· 最近使用',
  settingsTelegramTitle:      'Telegram 通知',
  settingsTelegramDesc:       'Workflow 完成时推送到你的 Telegram',
  settingsTelegramChatIdHint: '向 @userinfobot 发送任意消息即可获取你的 Chat ID',
  settingsTelegramTestOk:     '✓ 测试消息发送成功！',
  settingsTelegramTestFail:   '发送失败，请检查 Bot Token 和 Chat ID',
  settingsNetworkError:       '网络错误',
  settingsAnthropicHow:       '如何配置 ANTHROPIC_API_KEY',
  // AI tab config table
  settingsAIDefaultModel:     '默认模型',
  settingsAIDefaultModelSub:  '低延迟，适合大多数 Agent 任务',
  settingsAIFallback:         '降级策略',
  settingsAIFallbackValue:    '自动降级到模拟模式',
  settingsAIFallbackSub:      'API Key 未配置时，Agent 返回预设示例输出',
  settingsAIAgentsSub:        '各 Agent 拥有专属系统 Prompt 和能力范围',
  settingsAIApiKeyConfig:     '在 Vercel 环境变量中配置',
  settingsAIRow1Sub:          'claude-haiku-4-5-20251001 (快速任务) · claude-sonnet-4-6 (内容创作)',
  // AI setup steps
  settingsAIStep1:            '访问 console.anthropic.com → API Keys',
  settingsAIStep2:            '创建新 Key，复制',
  settingsAIStep3:            '打开 Vercel → 你的项目 → Settings → Environment Variables',
  settingsAIStep4:            '添加 ANTHROPIC_API_KEY，粘贴值，选择所有环境',
  settingsAIStep5:            '重新部署（Deployments → Redeploy）',
};

// ── en dictionary (must match zh shape exactly) ────────────────────────────

const en: typeof zh = {
  loading:        'Loading…',
  noData:         'No data',
  viewAll:        'All →',
  viewHistory:    'View history →',
  all:            'All',
  save:           'Save',
  close:          'Close',
  cancel:         'Cancel',
  testConnection: 'Test Connection',
  sendTest:       'Send Test',
  enabled:        'Enabled',
  disabled:       'Disabled',

  justNow: 'just now',
  timeAgo(ms: number): string {
    const m = Math.floor(ms / 60000);
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  },

  loginTitle:        'Mission Ctrl Login',
  loginButton:       'Login',
  loginLoading:      'Verifying…',
  loginErrorToken:   'Invalid token',
  loginErrorNetwork: 'Network error',

  dashSubtitle:         'Playfish Universal Platform · All Projects',
  dashWeeklyWorkflows:  'Workflows This Week',
  dashDoneTriggered:    'Done / Triggered',
  dashContentPublished: 'Content Published',
  dashAllChannels:      'All Channels',
  dashDraftCount:       (n: number) => `${n} Draft${n !== 1 ? 's' : ''}`,
  dashPendingApprovals: 'Pending Approvals',
  dashActionRequired:   'Action Required',
  dashRecentRuns:       'Recent Workflow Runs',
  dashViewAll:          'View All →',

  autopilotSubtitle:         'Overview',
  autopilotInsights:         'Insights',
  autopilotNoInsights:       'No insights yet',
  autopilotActiveMissions:   'Active Missions',
  autopilotExecuting:        'Executing',
  autopilotQueued:           'Queued',
  autopilotNoActiveMissions: 'No active missions',
  autopilotFeedback:         'Feedback',

  insightsSubtitle:  (n: number) => `Auto-observe · ${n} items`,
  insightsNone:      'No Insights',
  insightsNoneHint:  'Generated automatically after Observer scans',
  plansSubtitle:     (n: number, pending: number) =>
    `Autopilot Plans · ${n} items${pending > 0 ? ` · ${pending} pending` : ''}`,
  plansNone:         'No Plans',
  plansNoneHint:     'Auto-generated after an Insight is triggered',
  plansPendingBanner:(n: number) => `${n} plan${n !== 1 ? 's' : ''} awaiting approval`,
  missionsSubtitle:  (n: number, running: number) =>
    `Execution log · ${n} items${running > 0 ? ` · ${running} running` : ''}`,
  missionsNone:      'No Missions',
  missionsNoneHint:  'Auto-triggered after a Plan is approved',

  agentsSubtitle:        'AI Agent Management',
  agentsActive:          'Active Agents',
  agentsTasksCompleted:  'Tasks Completed',
  agentsContentCount:    'Published Content',
  agentsWeeklyWorkflows: 'Workflows This Week',
  agentsNoData:          'No agent data',
  agentsNoDataHint:      'Agent records are created automatically after running a Workflow',
  agentsIdle:            'Idle — awaiting task',
  agentsTasksStat:       (n: number) => `✅ ${n} task${n !== 1 ? 's' : ''}`,
  agentsContentStat:     (n: number) => `📄 ${n} published`,
  agentsRecentActivity:  'Recent Activity',
  agentsNoActivity:      'No activity recorded',
  agentsClickToView:     'Click an agent card to view details',
  agentsRecentRuns:      'Recent Workflow Runs',
  agentsTasksDone:       'Tasks Done',
  agentsPublished:       'Published',
  agentsPause:           'Pause',
  agentsActivate:        'Activate',

  contentSubtitle:    'Omni-channel · Publishing',
  contentTotal:       'Total',
  contentPublished:   'Published',
  contentScheduled:   'Scheduled',
  contentDraft:       'Draft',
  contentApprove:     'Approve',
  contentPublishNow:  'Publish Now',
  contentNoItems:     'No content',
  contentNoItemsHint: 'Content will appear here after running a Workflow with a 📡 Publish step',
  contentNoTitle:     'Untitled',
  contentResults:     'Publish Results',
  contentCreatedAt:   'Created: ',
  contentScheduledAt: 'Scheduled: ',
  contentPublishedAt: 'Published: ',
  contentSource:      'Source: Workflow Run',
  statusDraft:     'Draft',
  statusApproved:  'Approved',
  statusPublished: 'Published',
  statusFailed:    'Failed',
  statusScheduled: 'Scheduled',
  typeShortPost:   'Short Post',
  typeLongPost:    'Long Post',
  typeArticle:     'Article',
  typeThread:      'Thread',
  typeVideo:       'Video',
  typeImagePost:   'Image Post',
  typeLinkShare:   'Link Share',

  settingsSubtitle:           'Platform Config · J.A.R.V.I.S.',
  settingsTabChannels:        'Channels',
  settingsTabIntegrations:    'Integrations',
  settingsTabAI:              'AI Engine',
  settingsTabApiKeys:         'API Keys',
  settingsTabProjects:        'Projects',
  settingsChannelsTitle:      'Publishing Channels',
  settingsChannelsDesc:       'Configure API credentials to use channels in Workflows',
  settingsIntegrationsTitle:  'Third-party Integrations',
  settingsIntegrationsDesc:   'Configure external service credentials for auto data and events',
  settingsAITitle:            'AI Engine Config',
  settingsAIDesc:             'AI settings for Agent steps in Workflows',
  settingsProjectsTitle:      'Project Management',
  settingsProjectsDesc:       'Manage your project portfolio',
  settingsAddProject:         'Add Project',
  settingsRequired:           'Required env vars',
  settingsViewDocs:           'View Docs',
  settingsChannelEnabled:     'Enabled',
  settingsChannelConfigured:  'Configured',
  settingsChannelReserved:    'Reserved',
  settingsNoFields:           'No official API yet. Slot reserved for future integration.',
  settingsTestOk:             '✓ Connection test successful',
  settingsConnConfigured:     '✓ Configured',
  settingsConnMissing:        '○ Not configured',
  settingsMaxLength:          (n: number) => `Max ${n} chars`,
  settingsRevoke:             'Revoke',
  settingsNoApiKeys:          'No API Keys',
  settingsKeyCreated:         "✓ Key created — copy now, it won't be shown again",
  settingsKeyNamePlaceholder: 'Key name (e.g. Playfish Agent)',
  settingsApiKeyDesc:         'For Playfish Agent and external integrations',
  settingsRevokedBadge:       'Revoked',
  settingsCreatedAt:          'Created',
  settingsLastUsed:           '· Last used',
  settingsTelegramTitle:      'Telegram Notifications',
  settingsTelegramDesc:       'Push to your Telegram when Workflows complete',
  settingsTelegramChatIdHint: 'Send any message to @userinfobot to get your Chat ID',
  settingsTelegramTestOk:     '✓ Test message sent successfully!',
  settingsTelegramTestFail:   'Send failed — check your Bot Token and Chat ID',
  settingsNetworkError:       'Network error',
  settingsAnthropicHow:       'How to configure ANTHROPIC_API_KEY',
  // AI tab config table
  settingsAIDefaultModel:     'Default Model',
  settingsAIDefaultModelSub:  'Low latency, suitable for most Agent tasks',
  settingsAIFallback:         'Fallback Strategy',
  settingsAIFallbackValue:    'Auto-fallback to mock mode',
  settingsAIFallbackSub:      'When API Key is not configured, Agent returns preset example output',
  settingsAIAgentsSub:        'Each Agent has a dedicated system prompt and capability scope',
  settingsAIApiKeyConfig:     'Configure in Vercel environment variables',
  settingsAIRow1Sub:          'claude-haiku-4-5-20251001 (fast tasks) · claude-sonnet-4-6 (content creation)',
  // AI setup steps
  settingsAIStep1:            'Visit console.anthropic.com → API Keys',
  settingsAIStep2:            'Create a new Key, copy it',
  settingsAIStep3:            'Open Vercel → your project → Settings → Environment Variables',
  settingsAIStep4:            'Add ANTHROPIC_API_KEY, paste value, select all environments',
  settingsAIStep5:            'Redeploy (Deployments → Redeploy)',
};

const dict = { zh, en } as const;

// ── Context ────────────────────────────────────────────────────────────────

interface LocaleCtx {
  locale: Locale;
  toggle: () => void;
}

const LocaleContext = createContext<LocaleCtx>({ locale: 'zh', toggle: () => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>('zh');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved === 'zh' || saved === 'en') setLocale(saved);
  }, []);

  const toggle = () => {
    setLocale(prev => {
      const next: Locale = prev === 'zh' ? 'en' : 'zh';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  };

  return (
    <LocaleContext.Provider value={{ locale, toggle }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function useT() {
  const { locale } = useLocale();
  return dict[locale] as typeof zh;
}
