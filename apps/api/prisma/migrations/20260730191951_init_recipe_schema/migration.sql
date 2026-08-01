-- CreateTable
CREATE TABLE "spaces" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "spaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "space_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "space_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "space_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "space_id" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" TEXT NOT NULL,
    "default_unit" TEXT NOT NULL,
    "note" TEXT,
    "merged_into_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "space_id" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    "title" TEXT NOT NULL,
    "cover_image_url" TEXT,
    "description" TEXT,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "steps" JSONB NOT NULL DEFAULT '[]',
    "prep_minutes" INTEGER,
    "cook_minutes" INTEGER,
    "difficulty" INTEGER,
    "servings" DECIMAL(5,1) NOT NULL,
    "source" TEXT,
    "personal_rating" INTEGER,
    "last_cooked_at" TIMESTAMPTZ,
    "search_vector" tsvector GENERATED ALWAYS AS (
        to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("description", ''))
    ) STORED,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipe_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "amount_type" TEXT NOT NULL DEFAULT 'exact',
    "quantity" DECIMAL(10,3),
    "unit" TEXT,
    "vague_label" TEXT,
    "note" TEXT,
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "space_members_space_id_user_id_key" ON "space_members"("space_id", "user_id");

-- AddForeignKey
ALTER TABLE "space_members" ADD CONSTRAINT "space_members_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_members" ADD CONSTRAINT "space_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "ingredients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 手写补充：Prisma DSL 表达不了的部分（CHECK 约束 / 局部索引 / 表达式索引 / GIN）
-- 枚举类字段（category / role / amount_type）按 ARCHITECTURE.md 4.3 的规定，
-- 不加 CHECK，交给应用层（packages/shared）校验，避免加新枚举值也要走迁移。
-- ============================================================

-- CheckConstraint: 难度 1-5
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_difficulty_range"
    CHECK ("difficulty" IS NULL OR "difficulty" BETWEEN 1 AND 5);

-- CheckConstraint: 份数必须为正
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_servings_positive"
    CHECK ("servings" > 0);

-- CheckConstraint: 用量必须为正（模糊用量不存数字，quantity 为 NULL）
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_quantity_positive"
    CHECK ("quantity" IS NULL OR "quantity" > 0);

-- CheckConstraint: exact 用量必须有 quantity，vague 用量必须有 vague_label
-- 这是数据形状约束（内部一致性），不是可扩展的枚举值，所以在这里用 CHECK 而非应用层校验
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_amount_shape"
    CHECK (
        ("amount_type" = 'exact' AND "quantity" IS NOT NULL)
        OR ("amount_type" = 'vague' AND "vague_label" IS NOT NULL)
    );

-- Index: 每张业务表按 space_id 过滤未删除记录，见 ARCHITECTURE.md 4.1 ①
CREATE INDEX "idx_ingredients_space" ON "ingredients"("space_id") WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_recipes_space" ON "recipes"("space_id") WHERE "deleted_at" IS NULL;

-- Index: 同一空间内，未删除的食材名称不允许重复（大小写不敏感）
CREATE UNIQUE INDEX "idx_ingredients_space_name_unique"
    ON "ingredients"("space_id", lower("name")) WHERE "deleted_at" IS NULL;

-- Index: 别名 / 标签数组的包含查询（REQUIREMENTS.md 1.1 别名模糊匹配、1.5 标签筛选）
CREATE INDEX "idx_ingredients_aliases" ON "ingredients" USING GIN ("aliases");
CREATE INDEX "idx_recipes_tags" ON "recipes" USING GIN ("tags");

-- Index: 全文检索（REQUIREMENTS.md 1.5）。'simple' 是占位配置，Phase 1 接入
-- zhparser/pg_jieba 中文分词后，只需 ALTER 这一列的 GENERATED 表达式，不影响其他结构。
CREATE INDEX "idx_recipes_search_vector" ON "recipes" USING GIN ("search_vector");

-- Index: 反查关联（REQUIREMENTS.md 1.5「有鸡蛋能做什么」按食材反查菜谱、菜谱详情取配料表）
CREATE INDEX "idx_recipe_ingredients_recipe" ON "recipe_ingredients"("recipe_id");
CREATE INDEX "idx_recipe_ingredients_ingredient" ON "recipe_ingredients"("ingredient_id");

-- Index: 食材合并链路 / 空间成员反查
CREATE INDEX "idx_ingredients_merged_into" ON "ingredients"("merged_into_id") WHERE "merged_into_id" IS NOT NULL;
CREATE INDEX "idx_space_members_user" ON "space_members"("user_id");

-- Seed: Phase 1 前恒定的默认空间，所有业务表的 space_id 默认值都指向它
-- updated_at 没有 DB 端 DEFAULT（Prisma 的 @updatedAt 只在应用层维护），这里手动补上
INSERT INTO "spaces" ("id", "name", "updated_at") VALUES
    ('00000000-0000-0000-0000-000000000001', '默认空间', now())
ON CONFLICT ("id") DO NOTHING;
