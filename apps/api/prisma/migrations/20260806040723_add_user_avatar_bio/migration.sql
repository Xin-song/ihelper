-- 手写迁移：这台机器上 `prisma migrate dev` 的交互式检测在当前 shell 里跑不通
-- （非 TTY 环境），改成直接手写 SQL + `prisma migrate resolve --applied` 记录，
-- 内容和自动生成的草稿等价，两个字段都不参与查询过滤，不需要索引或 CHECK 约束。

ALTER TABLE "users"
  ADD COLUMN "avatar_url" TEXT,
  ADD COLUMN "bio" TEXT;
