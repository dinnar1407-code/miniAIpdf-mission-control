-- 把 Project.autoApproveThreshold 的默认值从 1 改为 0
-- 安全加固：新建项目默认「不自动批准」（保守信任边界），需显式调高阈值才会自动放行。
-- 只改列默认值，不改动任何现有行（现有项目保留各自已设的阈值）。
ALTER TABLE "Project" ALTER COLUMN "autoApproveThreshold" SET DEFAULT 0;
