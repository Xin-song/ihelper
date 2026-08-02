-- 手写迁移：diff 是对着一次性影子库（ihelper_shadow，跑完即删）生成的，不是真实库，
-- 这次没有数据丢失风险。仍然按 ARCHITECTURE.md 4.3 的规矩剔除了噪音语句
-- （手写索引的 DROP INDEX、search_vector 的 DROP DEFAULT、无意义的 space_id 重复 SET DEFAULT），
-- 只保留真正的结构变更，并补上 Prisma DSL 表达不了的 CHECK 约束和局部索引。

CREATE TABLE "stock_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "space_id" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "safety_stock" DECIMAL(10,3),
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stock_items_quantity_check" CHECK ("quantity" >= 0),
    CONSTRAINT "stock_items_safety_stock_check" CHECK ("safety_stock" IS NULL OR "safety_stock" >= 0)
);

ALTER TABLE "stock_items"
  ADD CONSTRAINT "stock_items_space_id_fkey"
  FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 按 ARCHITECTURE.md 4.1 的规矩，每张业务表按 space_id（未软删部分）建局部索引
CREATE INDEX "idx_stock_items_space" ON "stock_items"("space_id") WHERE "deleted_at" IS NULL;
