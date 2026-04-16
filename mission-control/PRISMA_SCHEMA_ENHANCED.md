# MiniAIPDF Mission Control - 工作流配置

## 预设工作流

### 1. Product Hunt 上线工作流 (PH Launch Flow)

```yaml
name: "Product Hunt Launch Flow"
trigger: "manual"  # 手动触发
status: "ready"

steps:
  - name: "Send Twitter announcement"
    type: "agent"
    agent: "playfish"
    action: "post_tweet"
    config:
      template: "just_launched"
      
  - name: "Post to communities"
    type: "agent"
    agent: "pm01"
    action: "post_community"
    config:
      platforms: ["linkedin", "hackernews", "reddit"]
      
  - name: "Send Telegram notification"
    type: "notify"
    channel: "telegram"
    config:
      message: "🎉 MiniAIPDF is live on Product Hunt!"
      
  - name: "Wait 24 hours"
    type: "delay"
    duration: 1440  # minutes
    
  - name: "Generate PH performance report"
    type: "agent"
    agent: "dfm"
    action: "generate_report"
    config:
      metrics: ["visitors", "upvotes", "comments"]
```

---

### 2. 每日运营工作流 (Daily Standup)

```yaml
name: "Daily Operations Standup"
trigger: "schedule"
schedule: "0 9 * * 1-5"  # Weekdays 9 AM
status: "active"

steps:
  - name: "Generate analytics snapshot"
    type: "agent"
    agent: "dfm"
    action: "analytics_snapshot"
    config:
      metrics: ["visitors", "signups", "api_calls", "mrr"]
      
  - name: "Check all platforms"
    type: "agent"
    agent: "admin01"
    action: "health_check"
    config:
      platforms: ["shopify", "stripe", "miniaipdf", "railway"]
      
  - name: "Aggregate overnight messages"
    type: "agent"
    agent: "admin01"
    action: "aggregate_messages"
    config:
      sources: ["email", "telegram", "support"]
      
  - name: "Send morning briefing"
    type: "notify"
    channel: "telegram"
    config:
      format: "briefing"
      to: "terry"
```

---

### 3. SEO 内容流水线 (Content Pipeline)

```yaml
name: "SEO Content Pipeline"
trigger: "schedule"
schedule: "0 9 * * 1"  # Monday 9 AM
status: "active"

steps:
  - name: "Research SEO keywords"
    type: "agent"
    agent: "pm01"
    action: "keyword_research"
    config:
      count: 5
      topics: ["pdf tools", "document automation"]
      
  - name: "Write blog post"
    type: "agent"
    agent: "pm01"
    action: "write_blog"
    config:
      template: "seo_article"
      
  - name: "Create social content"
    type: "agent"
    agent: "pm01"
    action: "create_social_posts"
    config:
      platforms: ["twitter", "linkedin"]
      
  - name: "Schedule publication"
    type: "schedule"
    config:
      platforms: ["blog"]
      date: "friday"  # Publish Friday
      
  - name: "Schedule social posts"
    type: "schedule"
    config:
      platforms: ["twitter", "linkedin"]
      dates: ["friday", "saturday", "monday"]
```

---

### 4. 新 API 客户入门 (API Onboarding)

```yaml
name: "API Customer Onboarding"
trigger: "webhook"
webhook: "stripe_payment_completed"
status: "active"

steps:
  - name: "Send welcome email"
    type: "agent"
    agent: "playfish"
    action: "send_email"
    config:
      template: "api_welcome"
      
  - name: "Create API credentials"
    type: "agent"
    agent: "admin01"
    action: "create_api_keys"
    config:
      plan: "${plan}"
      
  - name: "Send getting started guide"
    type: "schedule"
    delay: 60  # 1 hour later
    
  - name: "Schedule follow-up"
    type: "schedule"
    delay: 10080  # 7 days later
    
  - name: "Follow-up email"
    type: "agent"
    agent: "playfish"
    action: "send_email"
    config:
      template: "api_checkin"
```

---

### 5. 每周复盘工作流 (Weekly Review)

```yaml
name: "Weekly Review"
trigger: "schedule"
schedule: "0 18 * * 5"  # Friday 6 PM
status: "active"

steps:
  - name: "Generate weekly report"
    type: "agent"
    agent: "dfm"
    action: "weekly_report"
    config:
      metrics: ["all"]
      
  - name: "Compile accomplishments"
    type: "agent"
    agent: "playfish"
    action: "compilation"
    config:
      sources: ["tasks", "workflows", "alerts"]
      
  - name: "Plan next week"
    type: "agent"
    agent: "playfish"
    action: "plan_next_week"
    
  - name: "Send weekly summary"
    type: "notify"
    channel: "telegram"
    config:
      message: "weekly_summary"
```

---

### 6. 竞品监控工作流 (Competitor Monitor)

```yaml
name: "Competitor Monitor"
trigger: "schedule"
schedule: "0 10 * * *"  # Daily 10 AM
status: "active"

steps:
  - name: "Check Smallpdf"
    type: "http"
    method: "GET"
    url: "https://smallpdf.com"
    
  - name: "Check iLovePDF"
    type: "http"
    method: "GET"
    url: "https://www.ilovepdf.com"
    
  - name: "Analyze changes"
    type: "agent"
    agent: "admin01"
    action: "analyze_competitors"
    
  - name: "Alert on significant changes"
    type: "condition"
    condition: "significant_change == true"
    true_branch:
      - name: "Send alert"
        type: "notify"
        channel: "telegram"
```

---

### 7. 网站健康检查 (Uptime Monitor)

```yaml
name: "Uptime Monitor"
trigger: "schedule"
schedule: "*/5 * * * *"  # Every 5 minutes
status: "active"

steps:
  - name: "Check MiniAIPDF"
    type: "http"
    method: "GET"
    url: "https://miniaipdf.com"
    timeout: 10000
    
  - name: "Check API endpoint"
    type: "http"
    method: "GET"
    url: "https://api.miniaipdf.com/health"
    timeout: 5000
    
  - name: "On failure"
    type: "condition"
    condition: "status != 200"
    true_branch:
      - name: "Alert"
        type: "notify"
        channel: "telegram"
        config:
          severity: "critical"
          message: "⚠️ MiniAIPDF is down!"
          
      - name: "Auto-restart services"
        type: "agent"
        agent: "admin01"
        action: "restart_services"
```

---

## 工作流执行状态追踪

| 工作流 | 触发 | 状态 | 最后运行 | 成功率 |
|-------|------|------|---------|--------|
| PH Launch Flow | 手动 | Ready | - | - |
| Daily Standup | 定时(9AM) | Active | - | - |
| Content Pipeline | 定时(周一) | Active | - | - |
| API Onboarding | Webhook | Active | - | - |
| Weekly Review | 定时(周五6PM) | Active | - | - |
| Competitor Monitor | 定时(10AM) | Active | - | - |
| Uptime Monitor | 定时(每5分) | Active | - | - |

---

## Playfish 工作流执行能力

作为 J.A.R.V.I.S.，我能够：

1. **触发工作流**: `playfish: run [workflow-name]`
2. **监控执行**: 实时查看工作流状态
3. **暂停/恢复**: `playfish: pause [workflow-name]`
4. **查看日志**: `playfish: logs [workflow-name]`

---

## 下一步

1. ✅ 工作流设计完成
2. ⏳ Claude Code 实现工作流引擎
3. ⏳ Playfish 集成 API
4. ⏳ 测试所有工作流
5. ⏳ 部署到生产环境
