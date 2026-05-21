# WeChat Publish Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stub `publish()` in `WechatAdapter` with a real four-step WeChat API flow: get access_token → (optionally) upload thumb image → add draft → (optionally) mass send.

**Architecture:** Single-file modification to `lib/channels/adapters/wechat.ts`. Three private helper functions (`getAccessToken`, `uploadThumbMedia`, `addDraft`) plus one optional `massSend`, all wired together in `publish()`. A module-level `Map` caches access tokens per `appId`.

**Tech Stack:** TypeScript, native `fetch` (Node 18+), WeChat MP API (`api.weixin.qq.com`), `tsx` for manual test scripts.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `lib/channels/adapters/wechat.ts` | Full WeChat publish implementation |
| Create | `scripts/test-wechat-adapter.ts` | Manual test script (pure-logic assertions + optional live API) |
| Modify | `package.json` | Add `test:wechat` script |

---

## Task 1: Credential guard + test script scaffold

**Files:**
- Modify: `lib/channels/adapters/wechat.ts`
- Create: `scripts/test-wechat-adapter.ts`

- [ ] **Step 1: Replace wechat.ts with credential guard + stubs**

Replace the entire contents of `lib/channels/adapters/wechat.ts` with:

```typescript
// 微信公众号 — 完整发布流程
// 支持：纯文字图文 / 带封面图图文 / 草稿模式 / 群发模式
import { BaseChannelAdapter } from "./base";
import { ChannelConfig, ContentType, PublishContent, PublishResult } from "../types";

// access_token 模块级缓存（key = appId）
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

const WX_BASE = "https://api.weixin.qq.com";

export class WechatAdapter extends BaseChannelAdapter {
  readonly id = "wechat" as const;
  readonly name = "微信公众号";
  readonly icon = "💬";
  readonly color = "#07C160";
  readonly supportedTypes: ContentType[] = ["article", "long_post", "image_post"];
  readonly requiresApproval = true;

  async publish(content: PublishContent, config: ChannelConfig): Promise<PublishResult> {
    const { appId, appSecret } = config.credentials;

    if (!appId || !appSecret) {
      return { success: false, error: "未配置 AppID 或 AppSecret" };
    }

    // TODO: implement in later tasks
    void content;
    return { success: false, error: "实现进行中" };
  }
}
```

- [ ] **Step 2: Create test script scaffold**

Create `scripts/test-wechat-adapter.ts`:

```typescript
import assert from "node:assert/strict";
import { WechatAdapter } from "@/lib/channels/adapters/wechat";

// ── 辅助函数：测试断言 ──────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${(e as Error).message}`);
    failed++;
  }
}

const adapter = new WechatAdapter();

// ── Test Suite 1: 凭证缺失时的 guard ──────────────────────────
console.log("\n[Suite 1] 凭证缺失 guard");

async function runSuite1() {
  const result = await adapter.publish(
    { body: "test" },
    { channelId: "wechat", enabled: true, credentials: {} }
  );

  test("无凭证时返回 success: false", () => {
    assert.equal(result.success, false);
  });

  test("无凭证时 error 包含 AppID", () => {
    assert.ok(
      result.error?.includes("AppID") || result.error?.includes("appId"),
      `error 实际内容：${result.error}`
    );
  });
}

// ── 汇总 ──────────────────────────────────────────────────────
async function main() {
  await runSuite1();

  console.log(`\n结果：${passed} 通过，${failed} 失败`);
  if (failed > 0) process.exit(1);
}

main().catch(console.error);
```

- [ ] **Step 3: Run the test**

```bash
cd /Users/wheat/miniAIpdf-mission-control/mission-control
npx tsx scripts/test-wechat-adapter.ts
```

Expected output:
```
[Suite 1] 凭证缺失 guard
  ✓ 无凭证时返回 success: false
  ✓ 无凭证时 error 包含 AppID

结果：2 通过，0 失败
```

- [ ] **Step 4: Commit**

```bash
cd /Users/wheat/miniAIpdf-mission-control
git add mission-control/lib/channels/adapters/wechat.ts mission-control/scripts/test-wechat-adapter.ts
git commit -m "feat(wechat): add credential guard + test scaffold"
```

---

## Task 2: `getAccessToken()` — 缓存 + 获取

**Files:**
- Modify: `lib/channels/adapters/wechat.ts`
- Modify: `scripts/test-wechat-adapter.ts`

- [ ] **Step 1: Add token cache helper exports and implementation to wechat.ts**

In `lib/channels/adapters/wechat.ts`, insert the following block between the `WX_BASE` constant and the `WechatAdapter` class:

```typescript
// ── Access Token ──────────────────────────────────────────────

interface WxTokenResponse {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
}

async function getAccessToken(appId: string, appSecret: string): Promise<string> {
  const cached = tokenCache.get(appId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const url = `${WX_BASE}/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
  const res = await fetch(url);
  const data = (await res.json()) as WxTokenResponse;

  if (!data.access_token) {
    throw new Error(`获取 access_token 失败：[${data.errcode}] ${data.errmsg}`);
  }

  // 提前 5 分钟刷新，避免边界过期
  tokenCache.set(appId, {
    token: data.access_token,
    expiresAt: Date.now() + ((data.expires_in ?? 7200) - 300) * 1000,
  });

  return data.access_token;
}

// 仅供单元测试使用
export const _testOnly_tokenCache = tokenCache;
export const _testOnly_getAccessToken = getAccessToken;
```

Also update `publish()` to call `getAccessToken` (replace the `// TODO` block):

```typescript
  async publish(content: PublishContent, config: ChannelConfig): Promise<PublishResult> {
    const { appId, appSecret } = config.credentials;

    if (!appId || !appSecret) {
      return { success: false, error: "未配置 AppID 或 AppSecret" };
    }

    try {
      const accessToken = await getAccessToken(appId, appSecret);
      void accessToken; // 后续步骤使用
      return { success: false, error: "实现进行中" };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "未知错误" };
    }
  }
```

- [ ] **Step 2: Add Suite 2 to test script**

In `scripts/test-wechat-adapter.ts`, add the following imports at the top (after the existing import of `WechatAdapter`):

```typescript
import { _testOnly_tokenCache, _testOnly_getAccessToken } from "@/lib/channels/adapters/wechat";
```

Add Suite 2 function before `main()`:

```typescript
// ── Test Suite 2: token cache 逻辑 ──────────────────────────
console.log("\n[Suite 2] getAccessToken cache");

async function runSuite2() {
  _testOnly_tokenCache.clear();

  // 模拟一个未过期的缓存 token
  const fakeExpiry = Date.now() + 60_000;
  _testOnly_tokenCache.set("appId_test", { token: "cached_token_123", expiresAt: fakeExpiry });

  const token = await _testOnly_getAccessToken("appId_test", "any_secret");

  test("命中缓存时返回缓存 token", () => {
    assert.equal(token, "cached_token_123");
  });

  // 模拟过期 token——用 fake 凭证应触发网络请求并抛错
  _testOnly_tokenCache.set("appId_expired", { token: "old_token", expiresAt: Date.now() - 1 });

  try {
    await _testOnly_getAccessToken("appId_expired", "bad_secret");
    test("过期 token 不返回旧值（应抛错）", () => assert.fail("应该抛错"));
  } catch {
    test("过期 token 触发重新请求（抛错符合预期）", () => assert.ok(true));
  }
}
```

Update `main()`:

```typescript
async function main() {
  await runSuite1();
  await runSuite2();

  console.log(`\n结果：${passed} 通过，${failed} 失败`);
  if (failed > 0) process.exit(1);
}
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/wheat/miniAIpdf-mission-control/mission-control
npx tsx scripts/test-wechat-adapter.ts
```

Expected:
```
[Suite 1] 凭证缺失 guard
  ✓ 无凭证时返回 success: false
  ✓ 无凭证时 error 包含 AppID

[Suite 2] getAccessToken cache
  ✓ 命中缓存时返回缓存 token
  ✓ 过期 token 触发重新请求（抛错符合预期）

结果：4 通过，0 失败
```

- [ ] **Step 4: Commit**

```bash
cd /Users/wheat/miniAIpdf-mission-control
git add mission-control/lib/channels/adapters/wechat.ts mission-control/scripts/test-wechat-adapter.ts
git commit -m "feat(wechat): implement getAccessToken with module-level cache"
```

---

## Task 3: `buildArticle()` — 内容格式化

**Files:**
- Modify: `lib/channels/adapters/wechat.ts`
- Modify: `scripts/test-wechat-adapter.ts`

- [ ] **Step 1: Add Suite 3 to test script (before `main()`)**

Add import at top of test script:

```typescript
import { _testOnly_buildArticle } from "@/lib/channels/adapters/wechat";
```

Add Suite 3 function before `main()`:

```typescript
// ── Test Suite 3: buildArticle ──────────────────────────────
console.log("\n[Suite 3] buildArticle");

function runSuite3() {
  test("有 title 时使用 title", () => {
    const a = _testOnly_buildArticle({ body: "正文内容", title: "我的标题" }, {}, "");
    assert.equal(a.title, "我的标题");
  });

  test("无 title 时默认 '无标题'", () => {
    const a = _testOnly_buildArticle({ body: "正文" }, {}, "");
    assert.equal(a.title, "无标题");
  });

  test("有 summary 时用 summary 作 digest", () => {
    const a = _testOnly_buildArticle({ body: "正文", summary: "摘要内容" }, {}, "");
    assert.equal(a.digest, "摘要内容");
  });

  test("无 summary 时 digest 取正文前 120 字", () => {
    const a = _testOnly_buildArticle({ body: "a".repeat(200) }, {}, "");
    assert.equal(a.digest.length, 120);
  });

  test("defaults.author 传入 author 字段", () => {
    const a = _testOnly_buildArticle({ body: "正文" }, { author: "Terry" }, "");
    assert.equal(a.author, "Terry");
  });

  test("thumbMediaId 传入 thumb_media_id", () => {
    const a = _testOnly_buildArticle({ body: "正文" }, {}, "media_abc");
    assert.equal(a.thumb_media_id, "media_abc");
  });
}
```

Update `main()`:

```typescript
async function main() {
  await runSuite1();
  await runSuite2();
  runSuite3();

  console.log(`\n结果：${passed} 通过，${failed} 失败`);
  if (failed > 0) process.exit(1);
}
```

- [ ] **Step 2: Run test to verify Suite 3 fails (import error)**

```bash
npx tsx scripts/test-wechat-adapter.ts
```

Expected: 报错 `_testOnly_buildArticle` 未导出。

- [ ] **Step 3: Implement `buildArticle` in wechat.ts**

Insert the following block after `_testOnly_getAccessToken` export and before the `WechatAdapter` class:

```typescript
// ── 内容格式化 ─────────────────────────────────────────────────

interface WxArticle {
  title: string;
  author: string;
  content: string;
  digest: string;
  thumb_media_id: string;
  need_open_comment: number;
  only_fans_can_comment: number;
}

function buildArticle(
  content: PublishContent,
  defaults: Record<string, unknown>,
  thumbMediaId: string
): WxArticle {
  return {
    title: content.title ?? "无标题",
    author: (defaults.author as string) ?? "",
    content: content.body,
    digest: content.summary ?? content.body.slice(0, 120),
    thumb_media_id: thumbMediaId,
    need_open_comment: 0,
    only_fans_can_comment: 0,
  };
}

export const _testOnly_buildArticle = buildArticle;
```

- [ ] **Step 4: Run tests**

```bash
npx tsx scripts/test-wechat-adapter.ts
```

Expected:
```
[Suite 3] buildArticle
  ✓ 有 title 时使用 title
  ✓ 无 title 时默认 '无标题'
  ✓ 有 summary 时用 summary 作 digest
  ✓ 无 summary 时 digest 取正文前 120 字
  ✓ defaults.author 传入 author 字段
  ✓ thumbMediaId 传入 thumb_media_id

结果：10 通过，0 失败
```

- [ ] **Step 5: Commit**

```bash
cd /Users/wheat/miniAIpdf-mission-control
git add mission-control/lib/channels/adapters/wechat.ts mission-control/scripts/test-wechat-adapter.ts
git commit -m "feat(wechat): implement buildArticle helper"
```

---

## Task 4: `uploadThumbMedia()` — 封面图上传

**Files:**
- Modify: `lib/channels/adapters/wechat.ts`

- [ ] **Step 1: Implement `uploadThumbMedia` in wechat.ts**

Insert after `_testOnly_buildArticle` export and before `WechatAdapter` class:

```typescript
// ── 封面图上传 ─────────────────────────────────────────────────

interface WxMediaUploadResponse {
  type?: string;
  media_id?: string;
  created_at?: number;
  errcode?: number;
  errmsg?: string;
}

async function uploadThumbMedia(imageUrl: string, accessToken: string): Promise<string> {
  // 微信不接受外部 URL，需先下载图片到内存
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error(`封面图下载失败：HTTP ${imgRes.status}`);
  }
  const imgBuffer = await imgRes.arrayBuffer();
  const imgBlob = new Blob([imgBuffer]);

  // 从 URL 推断文件名（取最后一段，默认 cover.jpg）
  const fileName = imageUrl.split("/").pop()?.split("?")[0] || "cover.jpg";

  const form = new FormData();
  form.append("media", imgBlob, fileName);

  const url = `${WX_BASE}/cgi-bin/media/upload?access_token=${accessToken}&type=thumb`;
  const res = await fetch(url, { method: "POST", body: form });
  const data = (await res.json()) as WxMediaUploadResponse;

  if (!data.media_id) {
    throw new Error(`封面图上传失败：[${data.errcode}] ${data.errmsg}`);
  }

  return data.media_id;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/wheat/miniAIpdf-mission-control/mission-control
npx tsc --noEmit
```

Expected: 无错误输出。

- [ ] **Step 3: Commit**

```bash
cd /Users/wheat/miniAIpdf-mission-control
git add mission-control/lib/channels/adapters/wechat.ts
git commit -m "feat(wechat): implement uploadThumbMedia"
```

---

## Task 5: `addDraft()` + `massSend()` — 发布操作

**Files:**
- Modify: `lib/channels/adapters/wechat.ts`

- [ ] **Step 1: Implement `addDraft` in wechat.ts**

Insert after `uploadThumbMedia` function and before `WechatAdapter` class:

```typescript
// ── 草稿 ───────────────────────────────────────────────────────

interface WxDraftAddResponse {
  media_id?: string;
  errcode?: number;
  errmsg?: string;
}

async function addDraft(article: WxArticle, accessToken: string): Promise<string> {
  const url = `${WX_BASE}/cgi-bin/draft/add?access_token=${accessToken}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ articles: [article] }),
  });
  const data = (await res.json()) as WxDraftAddResponse;

  if (!data.media_id) {
    throw new Error(`草稿创建失败：[${data.errcode}] ${data.errmsg}`);
  }

  return data.media_id;
}
```

- [ ] **Step 2: Implement `massSend` in wechat.ts**

Insert after `addDraft` and before `WechatAdapter` class:

```typescript
// ── 群发 ───────────────────────────────────────────────────────

interface WxMassSendResponse {
  errcode?: number;
  errmsg?: string;
  msg_id?: number;
  msg_data_id?: number;
}

async function massSend(draftMediaId: string, accessToken: string): Promise<number> {
  const url = `${WX_BASE}/cgi-bin/message/mass/sendall?access_token=${accessToken}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filter: { is_to_all: true },
      mpnews: { media_id: draftMediaId },
      msgtype: "mpnews",
      send_ignore_reprint: 1,
    }),
  });
  const data = (await res.json()) as WxMassSendResponse;

  if (data.errcode && data.errcode !== 0) {
    throw new Error(`群发失败：[${data.errcode}] ${data.errmsg}`);
  }

  return data.msg_id ?? 0;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/wheat/miniAIpdf-mission-control/mission-control
npx tsc --noEmit
```

Expected: 无错误输出。

- [ ] **Step 4: Commit**

```bash
cd /Users/wheat/miniAIpdf-mission-control
git add mission-control/lib/channels/adapters/wechat.ts
git commit -m "feat(wechat): implement addDraft and massSend"
```

---

## Task 6: Wire up `publish()` — 完整流程

**Files:**
- Modify: `lib/channels/adapters/wechat.ts`
- Modify: `scripts/test-wechat-adapter.ts`

- [ ] **Step 1: Replace `publish()` with complete implementation**

Replace the entire `publish()` method in `WechatAdapter`:

```typescript
  async publish(content: PublishContent, config: ChannelConfig): Promise<PublishResult> {
    const { appId, appSecret } = config.credentials;

    if (!appId || !appSecret) {
      return { success: false, error: "未配置 AppID 或 AppSecret" };
    }

    const publishMode = (config.defaults?.publishMode as string) ?? "draft";
    const defaults = config.defaults ?? {};

    try {
      // Step 1: 获取 access_token（带缓存，40001 时清缓存重试一次）
      let accessToken: string;
      try {
        accessToken = await getAccessToken(appId, appSecret);
      } catch (err) {
        tokenCache.delete(appId);
        accessToken = await getAccessToken(appId, appSecret);
        void err;
      }

      // Step 2: 上传封面图（如有）
      let thumbMediaId = "";
      if (content.imageUrls?.[0]) {
        thumbMediaId = await uploadThumbMedia(content.imageUrls[0], accessToken);
      }

      // Step 3: 创建草稿
      const article = buildArticle(content, defaults, thumbMediaId);
      const draftMediaId = await addDraft(article, accessToken);

      // Step 4: 群发（可选）
      if (publishMode === "mass") {
        const msgId = await massSend(draftMediaId, accessToken);
        return {
          success: true,
          postId: String(msgId),
          raw: { mode: "mass", draftMediaId, msgId },
        };
      }

      return {
        success: true,
        postId: draftMediaId,
        raw: { mode: "draft" },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "未知错误",
      };
    }
  }
```

- [ ] **Step 2: Add Suite 4 to test script**

Add Suite 4 function before `main()`:

```typescript
// ── Test Suite 4: publish() 结构验证（无真实凭证）─────────────
console.log("\n[Suite 4] publish() 结构验证");

async function runSuite4() {
  const result = await adapter.publish(
    { body: "test body", title: "Test" },
    {
      channelId: "wechat",
      enabled: true,
      credentials: { appId: "fake_id", appSecret: "fake_secret" },
      defaults: { publishMode: "draft" },
    }
  );

  test("fake 凭证时 publish 返回 PublishResult 结构", () => {
    assert.ok("success" in result, "缺少 success 字段");
  });

  test("fake 凭证时 success 为 false（网络请求失败）", () => {
    assert.equal(result.success, false);
  });

  test("fake 凭证时 error 为字符串", () => {
    assert.equal(typeof result.error, "string");
  });
}
```

Update `main()`:

```typescript
async function main() {
  await runSuite1();
  await runSuite2();
  runSuite3();
  await runSuite4();

  console.log(`\n结果：${passed} 通过，${failed} 失败`);
  if (failed > 0) process.exit(1);
}
```

- [ ] **Step 3: Run all tests**

```bash
cd /Users/wheat/miniAIpdf-mission-control/mission-control
npx tsx scripts/test-wechat-adapter.ts
```

Expected:
```
[Suite 1] 凭证缺失 guard
  ✓ 无凭证时返回 success: false
  ✓ 无凭证时 error 包含 AppID

[Suite 2] getAccessToken cache
  ✓ 命中缓存时返回缓存 token
  ✓ 过期 token 触发重新请求（抛错符合预期）

[Suite 3] buildArticle
  ✓ 有 title 时使用 title
  ✓ 无 title 时默认 '无标题'
  ✓ 有 summary 时用 summary 作 digest
  ✓ 无 summary 时 digest 取正文前 120 字
  ✓ defaults.author 传入 author 字段
  ✓ thumbMediaId 传入 thumb_media_id

[Suite 4] publish() 结构验证
  ✓ fake 凭证时 publish 返回 PublishResult 结构
  ✓ fake 凭证时 success 为 false（网络请求失败）
  ✓ fake 凭证时 error 为字符串

结果：13 通过，0 失败
```

- [ ] **Step 4: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: 无错误输出。

- [ ] **Step 5: Commit**

```bash
cd /Users/wheat/miniAIpdf-mission-control
git add mission-control/lib/channels/adapters/wechat.ts mission-control/scripts/test-wechat-adapter.ts
git commit -m "feat(wechat): wire up complete publish flow (draft + mass send)"
```

---

## Task 7: package.json test script 注册

**Files:**
- Modify: `mission-control/package.json`

- [ ] **Step 1: Add test:wechat to package.json scripts**

In `mission-control/package.json`, find the `"scripts"` section and add after `"test:mission"`:

```json
"test:wechat": "tsx --env-file=.env.local scripts/test-wechat-adapter.ts"
```

- [ ] **Step 2: Verify it runs**

```bash
cd /Users/wheat/miniAIpdf-mission-control/mission-control
npm run test:wechat
```

Expected: 13 通过，0 失败。

- [ ] **Step 3: Commit**

```bash
cd /Users/wheat/miniAIpdf-mission-control
git add mission-control/package.json
git commit -m "chore: add test:wechat npm script"
```

---

## 注意事项（给实现者）

- 使用 `draft/add` 新版草稿接口，不要使用旧版 `uploadnews`
- 群发 `is_to_all: true` 对个人订阅号可能返回 errcode 45028（超频）或 45016（非认证号限制）；如遇此情况需改为 `is_to_all: false` + `tag_id: 2`（全部粉丝标签）
- `thumb_media_id` 必须通过 `media/upload?type=thumb` 上传，不能使用临时素材或外部 URL
- 本次不处理 `data:` URI 形式的封面图，只支持 `http(s)://` URL
