/**
 * 安全的条件表达式求值器（替换危险的 new Function）
 *
 * 【为什么需要它】
 * 原来 workflow 的 condition 步骤用 `new Function(expr)` 执行表达式。
 * new Function 创建的函数运行在 Node 全局作用域里，能访问 `process`（即 process.env
 * 里所有密钥）、`fetch`（向外发请求）等全局对象。而 expr 来自 workflow 定义，
 * 也就是说：谁能创建/修改 workflow，谁就能让服务器执行任意 JavaScript，
 * 偷走 Stripe / 数据库密钥并外传——这是一个远程代码执行（RCE）漏洞。
 *
 * 【改成什么】
 * 改成「白名单解析」：只认识下面固定的几种句式，逐个用正则匹配后求值；
 * 认不出来的句式一律返回 false，绝不把字符串当代码执行。
 * 覆盖了原注释里声明支持的全部用法，所以正常的 workflow 不受影响。
 *
 * 【支持的句式】（`output` 代表上一步的输出字符串）
 *   字符串方法： output.includes("x") / output.startsWith("x") / output.endsWith("x")
 *   字符串相等： output === "x" / output !== "x" / output == "x" / output != "x"
 *   数值比较：   Number(output) > 100 / >= / < / <= / === / !==
 *   真值判断：   output（非空字符串为真）/ true / false
 *   取反：       在以上任意句式前加 !，例如 !output.includes("error")
 */

/** 单条求值结果：value 是布尔结果，recognized 表示这条句式是否被白名单识别 */
export interface ConditionResult {
  value: boolean;
  /** false 表示句式无法识别（已按 false 安全处理），调用方应记录告警 */
  recognized: boolean;
}

/**
 * 对条件表达式求值。
 * @param rawExpr workflow 里写的条件字符串
 * @param output  上一步的输出（作为 output 变量参与判断）
 */
export function evaluateCondition(rawExpr: string, output: string): ConditionResult {
  let expr = rawExpr.trim();
  // 空表达式：与原行为保持一致，默认放行（true）
  if (!expr) return { value: true, recognized: true };

  // 处理可选的取反前缀 "!"
  let negate = false;
  if (expr.startsWith("!")) {
    negate = true;
    expr = expr.slice(1).trim();
  }

  const r = evalSingle(expr, output);
  return { value: negate ? !r.value : r.value, recognized: r.recognized };
}

/** 求值单条（不含取反前缀）的句式 */
function evalSingle(expr: string, output: string): ConditionResult {
  // ── 字面量与裸 output ──
  if (expr === "true") return { value: true, recognized: true };
  if (expr === "false") return { value: false, recognized: true };
  if (expr === "output") return { value: Boolean(output), recognized: true };

  // ── 字符串方法：output.includes("x") / startsWith / endsWith ──
  // 第 2 个捕获组 (['"]) 记录用的是单引号还是双引号，\2 要求结尾引号与之配对
  const strMethod = expr.match(
    /^output\.(includes|startsWith|endsWith)\(\s*(['"])(.*?)\2\s*\)$/
  );
  if (strMethod) {
    const method = strMethod[1];
    const literal = strMethod[3];
    if (method === "includes") return { value: output.includes(literal), recognized: true };
    if (method === "startsWith") return { value: output.startsWith(literal), recognized: true };
    if (method === "endsWith") return { value: output.endsWith(literal), recognized: true };
  }

  // ── 字符串相等：output === "x" / !== / == / != ──
  const strEq = expr.match(/^output\s*(===|!==|==|!=)\s*(['"])(.*?)\2$/);
  if (strEq) {
    const op = strEq[1];
    const literal = strEq[3];
    const eq = output === literal;
    return { value: op === "===" || op === "==" ? eq : !eq, recognized: true };
  }

  // ── 数值比较：Number(output) OP 数字 ──
  const numCmp = expr.match(
    /^Number\(output\)\s*(>=|<=|>|<|===|!==|==|!=)\s*(-?\d+(?:\.\d+)?)$/
  );
  if (numCmp) {
    const op = numCmp[1];
    const a = Number(output);
    const b = Number(numCmp[2]);
    // output 不是合法数字时，任何数值比较都判为 false（避免 NaN 带来的意外）
    if (Number.isNaN(a)) return { value: false, recognized: true };
    switch (op) {
      case ">": return { value: a > b, recognized: true };
      case "<": return { value: a < b, recognized: true };
      case ">=": return { value: a >= b, recognized: true };
      case "<=": return { value: a <= b, recognized: true };
      case "===":
      case "==": return { value: a === b, recognized: true };
      case "!==":
      case "!=": return { value: a !== b, recognized: true };
    }
  }

  // ── 认不出来的句式：安全起见返回 false，并标记 recognized=false 让调用方告警 ──
  return { value: false, recognized: false };
}
