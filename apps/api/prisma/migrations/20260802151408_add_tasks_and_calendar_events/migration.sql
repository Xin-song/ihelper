-- 手写迁移：diff 是对着开发库生成的，噪音语句（历史手写索引的 DROP INDEX、
-- 无意义的 space_id 重复 SET DEFAULT）按 ARCHITECTURE.md 4.3 的规矩剔除，
-- 只保留真正的结构变更，并补上 Prisma DSL 表达不了的 CHECK 约束和局部索引。

CREATE TABLE "tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "space_id" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "due_at" TIMESTAMPTZ,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'todo',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "calendar_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "space_id" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "calendar_events_end_at_check" CHECK ("end_at" >= "start_at")
);

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_space_id_fkey"
  FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calendar_events"
  ADD CONSTRAINT "calendar_events_space_id_fkey"
  FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "calendar_events"
  ADD CONSTRAINT "calendar_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 待办和日程都是私人数据，按 user_id 过滤为主，日历视图再按时间范围过滤，见 ARCHITECTURE.md 4.1
CREATE INDEX "idx_tasks_user_due" ON "tasks"("user_id", "due_at") WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_calendar_events_user_start" ON "calendar_events"("user_id", "start_at") WHERE "deleted_at" IS NULL;
