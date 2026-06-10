-- 给 Mission.planId 加唯一约束：数据库层杜绝同一个 Plan 被并发创建出多个 Mission
-- （配合 lib/mission-orchestrator.ts 的 P2002 兜底，防止重复执行 / 重复发货 / 重复扣费）
-- 应用前已确认生产 Mission 表无重复 planId，可安全创建。

-- CreateIndex
CREATE UNIQUE INDEX "Mission_planId_key" ON "Mission"("planId");
