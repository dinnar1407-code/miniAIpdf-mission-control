import assert from "node:assert/strict";
import { WechatAdapter } from "@/lib/channels/adapters/wechat";
import { _testOnly_tokenCache, _testOnly_getAccessToken } from "@/lib/channels/adapters/wechat";

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

// ── 汇总 ──────────────────────────────────────────────────────
async function main() {
  await runSuite1();
  await runSuite2();

  console.log(`\n结果：${passed} 通过，${failed} 失败`);
  if (failed > 0) process.exit(1);
}

main().catch(console.error);
