# 微信公众号发布流程设计文档

**日期**：2026-05-20  
**状态**：已批准，待实现  
**作者**：Terry Qin  
**修改范围**：`lib/channels/adapters/wechat.ts`（单文件修改）

---

## 背景

微信公众号 adapter 当前为占位实现（`stubPublish`），即使填入凭证也会返回错误。需要实现真实的发布流程。

账号类型：**个人订阅号**

---

## 功能目标

- 支持纯文字图文和带封面图的图文两种格式
- 支持保存为草稿（默认）和直接群发两种发布模式
- access_token 服务端缓存，避免频繁请求

---

## 架构与数据流

```
PublishContent + ChannelConfig
        │
        ▼
WechatAdapter.publish()
        │
        ├─ Step 1: getAccessToken(appId, appSecret)
        │          ┌─ 模块级缓存（提前 5 分钟刷新）
        │          └─ 过期/未命中 → POST /cgi-bin/token
        │
        ├─ Step 2: [有封面图时] uploadThumbMedia(imageUrl, accessToken)
        │          └─ fetch 图片 buffer → POST /cgi-bin/media/upload?type=thumb
        │             → thumb_media_id
        │
        ├─ Step 3: addDraft(article, accessToken)
        │          └─ POST /cgi-bin/draft/add → draft_media_id
        │
        └─ Step 4: [publishMode = "mass"] massSend(draftMediaId, accessToken)
                   └─ POST /cgi-bin/message/mass/sendall → msg_id
```

---

## 接口参数

### ChannelConfig.credentials
| 字段 | 说明 |
|------|------|
| `appId` | 公众号 AppID |
| `appSecret` | 公众号 AppSecret |

### ChannelConfig.defaults
| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `publishMode` | `"draft" \| "mass"` | `"draft"` | 草稿或直接群发 |
| `author` | `string` | `""` | 图文作者名 |

### PublishContent 使用字段
| 字段 | 用途 |
|------|------|
| `title` | 图文标题（缺省为"无标题"） |
| `body` | 图文正文（支持 HTML） |
| `summary` | 摘要（缺省取正文前 120 字） |
| `imageUrls[0]` | 封面图 URL（外部 URL，fetch 后上传） |

---

## 图文草稿结构（draft/add articles 数组）

```json
{
  "title": "content.title ?? '无标题'",
  "author": "defaults.author ?? ''",
  "content": "content.body",
  "digest": "content.summary ?? content.body.slice(0, 120)",
  "thumb_media_id": "<上传后的 media_id，无封面图时传空字符串>",
  "need_open_comment": 0,
  "only_fans_can_comment": 0
}
```

---

## Access Token 缓存

```typescript
// 模块级，进程内单例
const tokenCache = new Map<string, { token: string; expiresAt: number }>();
// expiresAt = Date.now() + (expires_in - 300) * 1000（提前 5 分钟刷新）
```

- key 为 `appId`，支持多账号
- access_token 过期（errcode 40001）时清除缓存并重试一次

---

## 错误处理

| 场景 | 处理方式 |
|------|---------|
| appId / appSecret 为空 | 立即返回错误，不发请求 |
| 微信 API errcode != 0 | 返回 `"[errcode] errmsg"` |
| 网络异常 | try/catch，返回 err.message |
| access_token 过期（40001） | 清除缓存，重试一次 |
| 群发后状态轮询 | 超出范围，只返回 msg_id |

---

## PublishResult 语义

| 模式 | success | postId |
|------|---------|--------|
| 草稿 | `true` | 草稿 `media_id` |
| 群发 | `true` | 群发 `msg_id` |
| 失败 | `false` | — |

---

## 约束与注意事项

- 个人订阅号群发限制：每天 1 次，超限微信 API 会返回 errcode 45028
- 封面图必须先下载到内存再上传（微信不接受外部 URL）
- 群发不可撤回，`requiresApproval = true` 保留，确保走审批流程
- 不涉及 Settings 页面、registry.ts、types.ts 等其他文件的修改

---

## 不在本次范围内

- 发布后状态轮询（PostStatus）
- Analytics 接入
- 模板消息
- 视频/音频内容类型
