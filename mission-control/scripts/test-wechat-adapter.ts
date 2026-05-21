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

// ── 汇总 ──────────────────────────────────────────────────────
async function main() {
  await runSuite1();

  console.log(`\n结果：${passed} 通过，${failed} 失败`);
  if (failed > 0) process.exit(1);
}

main().catch(console.error);
