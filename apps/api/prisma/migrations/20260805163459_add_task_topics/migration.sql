-- 手写迁移：diff 是对着开发库生成的，噪音语句（历史手写索引的 DROP INDEX、
-- 无意义的 space_id 重复 SET DEFAULT）按 ARCHITECTURE.md 4.3 的规矩剔除，
-- 只保留真正的结构变更，并补上 Prisma DSL 表达不了的 CHECK 约束和局部索引。

CREATE TABLE "task_topics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "space_id" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "task_topics_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "task_topics"
  ADD CONSTRAINT "task_topics_space_id_fkey"
  FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "task_topics"
  ADD CONSTRAINT "task_topics_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 主题列表按 userId 过滤，见 ARCHITECTURE.md 4.1
CREATE INDEX "idx_task_topics_user" ON "task_topics"("user_id") WHERE "deleted_at" IS NULL;

ALTER TABLE "tasks"
  ADD COLUMN "topic_id" UUID,
  ADD COLUMN "archived_at" TIMESTAMPTZ,
  ADD COLUMN "scheduled_start_at" TIMESTAMPTZ,
  ADD COLUMN "scheduled_end_at" TIMESTAMPTZ;

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_topic_id_fkey"
  FOREIGN KEY ("topic_id") REFERENCES "task_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 「今日日程管理」时间轴上的起止时间，两者都填时才要求先后顺序，Prisma DSL 表达不了 CHECK
ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_scheduled_range_check"
  CHECK ("scheduled_start_at" IS NULL OR "scheduled_end_at" IS NULL OR "scheduled_end_at" >= "scheduled_start_at");

-- 主题看板：总览/Archived 视图按 topic_id 分组；今日日程视图按 user_id + 当天时间范围查已排入时间轴的待办
CREATE INDEX "idx_tasks_topic" ON "tasks"("topic_id") WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_tasks_user_scheduled_start" ON "tasks"("user_id", "scheduled_start_at") WHERE "deleted_at" IS NULL AND "scheduled_start_at" IS NOT NULL;
