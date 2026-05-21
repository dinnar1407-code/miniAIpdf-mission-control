import assert from "node:assert/strict";
import { WechatAdapter, _testOnly_tokenCache, _testOnly_getAccessToken, _testOnly_buildArticle } from "@/lib/channels/adapters/wechat";

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

async function runSuite1() {
  console.log("\n[Suite 1] 凭证缺失 guard");
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

// ── Test Suite 2: token cache 逻辑 ──────────────────────────

async function runSuite2() {
  console.log("\n[Suite 2] getAccessToken cache");
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

// ── Test Suite 3: buildArticle ──────────────────────────────

function runSuite3() {
  console.log("\n[Suite 3] buildArticle");

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

// ── Test Suite 4: publish() 结构验证（无真实凭证）─────────────

async function runSuite4() {
  console.log("\n[Suite 4] publish() 结构验证");

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

// ── 汇总 ──────────────────────────────────────────────────────
async function main() {
  await runSuite1();
  await runSuite2();
  runSuite3();
  await runSuite4();

  console.log(`\n结果：${passed} 通过，${failed} 失败`);
  if (failed > 0) process.exit(1);
}

main().catch(console.error);
