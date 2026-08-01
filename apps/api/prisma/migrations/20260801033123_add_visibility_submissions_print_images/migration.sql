-- 菜谱可见性（我的菜谱 / 菜谱广场）+ 作业 + 打印版菜谱图
--
-- 注意：prisma migrate diff 生成的原始版本里包含一批 DROP INDEX（idx_recipes_tags、
-- idx_recipes_search_vector、idx_ingredients_aliases、idx_recipe_ingredients_* 等）
-- 和一句 ALTER COLUMN "search_vector" DROP DEFAULT，全部已手工删除：
-- 那些索引是 init 迁移里手写补的（GIN / 局部索引，Prisma DSL 表达不了），
-- search_vector 则是 GENERATED ALWAYS 列、本来就没有 DEFAULT。
-- 以后每次生成迁移都要检查一遍这类误删。

-- AlterTable: 菜谱可见性。private = 只在「我的菜谱」；public = 同时进菜谱广场。
-- 存量数据默认 private，不会因为这次迁移意外公开。
ALTER TABLE "recipes" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'private';

-- CreateTable: 作业（跟着菜谱做出来的成品帖）
CREATE TABLE "recipe_submissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "space_id" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    "recipe_id" UUID NOT NULL,
    "user_id" UUID,
    "author_name" TEXT NOT NULL DEFAULT '我',
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "body" TEXT NOT NULL,
    "rating" INTEGER,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "recipe_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: 用户上传的打印版菜谱图（横版 / 竖版）
CREATE TABLE "recipe_print_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipe_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "orientation" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_print_images_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "recipe_submissions" ADD CONSTRAINT "recipe_submissions_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_submissions" ADD CONSTRAINT "recipe_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_print_images" ADD CONSTRAINT "recipe_print_images_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 手写补充：同 init 迁移的约定。
-- 枚举类字段（visibility / orientation）按 ARCHITECTURE.md 4.3 不加 CHECK，
-- 交给应用层（packages/shared）校验；range 类约束则在这里落 CHECK。
-- ============================================================

-- CheckConstraint: 作业评分 1-5，与 recipes.difficulty 同规格
ALTER TABLE "recipe_submissions" ADD CONSTRAINT "recipe_submissions_rating_range"
    CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 5);

-- CheckConstraint: 作业必须至少有一张成品图 —— 没有图的作业没有意义
ALTER TABLE "recipe_submissions" ADD CONSTRAINT "recipe_submissions_images_not_empty"
    CHECK (array_length("images", 1) >= 1);

-- Index: 菜谱详情页「用户作业」列表，按时间倒序
CREATE INDEX "idx_recipe_submissions_recipe" ON "recipe_submissions"("recipe_id", "created_at" DESC)
    WHERE "deleted_at" IS NULL;

-- Index: 作业广场的全局信息流，按时间倒序
CREATE INDEX "idx_recipe_submissions_feed" ON "recipe_submissions"("space_id", "created_at" DESC)
    WHERE "deleted_at" IS NULL;

-- Index: 菜谱广场只查 public 且未删除的菜谱
CREATE INDEX "idx_recipes_public" ON "recipes"("visibility", "updated_at" DESC)
    WHERE "deleted_at" IS NULL AND "visibility" = 'public';

-- Index: 菜谱详情页取打印版图
CREATE INDEX "idx_recipe_print_images_recipe" ON "recipe_print_images"("recipe_id", "sort_order");
