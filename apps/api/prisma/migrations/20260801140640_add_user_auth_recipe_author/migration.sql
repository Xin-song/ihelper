-- 手写迁移：`prisma migrate diff` 生成的原始 SQL 里带了一批误删语句（DROP INDEX 手写的
-- GIN/局部索引、DROP DEFAULT search_vector 生成列、无意义的 space_id SET DEFAULT 重复项），
-- 按 ARCHITECTURE.md 4.3 / DATABASE.md 5.4 的规矩已全部剔除，只保留本次真正的结构变更。

-- users：加登录用户名（唯一），email 改为非必填（自托管场景不做公开注册，昵称走 display_name）
ALTER TABLE "users"
  ADD COLUMN "username" TEXT NOT NULL,
  ALTER COLUMN "email" DROP NOT NULL;

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- recipes：加作者外键，登录接入前建的菜谱这里是 NULL（应用层按「未认领」放行编辑，见 ARCHITECTURE.md 4.4）
ALTER TABLE "recipes"
  ADD COLUMN "author_id" UUID;

ALTER TABLE "recipes"
  ADD CONSTRAINT "recipes_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
