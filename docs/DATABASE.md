# 数据库 Schema 设计 —— 菜谱模块首版

> 最后更新：2026-08-01
> 配套文档：[ROADMAP.md](./ROADMAP.md) · [REQUIREMENTS.md](./REQUIREMENTS.md) · [ARCHITECTURE.md](./ARCHITECTURE.md)
> 落地位置：`apps/api/prisma/schema.prisma` + `apps/api/prisma/migrations/`

对应 REQUIREMENTS.md 第 1 节（菜谱模块）与 ARCHITECTURE.md 第 4 节（多用户预留方案）。

---

## 1. ER 关系

```
spaces ──< space_members >── users

spaces ──< ingredients (space_id)
spaces ──< recipes (space_id)

recipes ──< recipe_ingredients >── ingredients
                (quantity / unit / vague_label / note / is_optional / sort_order)

recipes ──< recipe_submissions (作业：成品图 + 心得，可选关联 users)
recipes ──< recipe_print_images (打印版菜谱图，横版 / 竖版)

ingredients ──self FK── merged_into_id   (食材合并，保留审计轨迹)
```

Phase 1 实体化：`spaces`、`users`、`space_members`、`ingredients`、`recipes`、`recipe_ingredients`、`recipe_submissions`、`recipe_print_images`。
`spaces` 表现在只有一行种子数据（`00000000-0000-0000-0000-000000000001`），所有业务表的 `space_id` 默认指向它，按 ARCHITECTURE.md 4.1 的规定，Phase 3 引入真正多空间时不需要改表结构或回填数据。

---

## 2. 表设计取舍

### 2.1 `ingredients`（食材主数据）

- `aliases TEXT[]`：别名走数组列，不单独建表，配 GIN 索引支持包含查询（REQUIREMENTS 1.1「土豆/马铃薯/洋芋」模糊匹配）。
- `category`：自由 TEXT，不用 Postgres enum、不加 CHECK 白名单。原因见 ARCHITECTURE.md 4.3——枚举值的合法性交给应用层（`packages/shared/src/recipe.ts` 的 `INGREDIENT_CATEGORIES`），加新分类不需要走数据库迁移。
- `merged_into_id`：自引用 FK，支持 REQUIREMENTS 1.1 的「合并两条重复食材」——合并时把重复食材软删除（`deleted_at`）并指向存活记录，同时把引用它的 `recipe_ingredients.ingredient_id` 批量改写到存活记录，这一步是应用层事务，不是数据库约束能表达的。
- 唯一约束 `idx_ingredients_space_name_unique`：`(space_id, lower(name))` 的部分唯一索引（`WHERE deleted_at IS NULL`），防止同一空间内出现两条同名有效食材，同时不影响软删除记录和别的空间。

### 2.2 `recipes`（菜谱）

- `steps JSONB`：步骤是有序列表，每项 `{ stepNumber, body, imageUrl?, timerSeconds? }`，结构随产品迭代可能变化，按 ARCHITECTURE.md 的建议用 JSONB 而不是单独建 `recipe_steps` 表——省一次 JOIN，且改步骤结构不用迁移。类型定义见 `packages/shared/src/recipe.ts` 的 `RecipeStep`。
- `tags TEXT[]`：标签自由创建，数组列 + GIN 索引，同 `aliases` 的理由。
- `servings DECIMAL(5,1)`：允许半份（如 2.5 人份），`CHECK (servings > 0)`。
- `difficulty`：可空整数，`CHECK (difficulty BETWEEN 1 AND 5)`——这是值域约束不是可扩展枚举，所以用 CHECK 而非应用层校验。
- `search_vector`：`tsvector` 生成列，`GENERATED ALWAYS AS (to_tsvector('simple', title || description)) STORED` + GIN 索引。**已知限制**：`simple` 配置不做中文分词，中文标题/简介会被当成一个整词，子串查询匹配不到（已用真实数据验证，见下方"验证记录"）。ARCHITECTURE.md 7 节已经把"中文分词扩展（zhparser / pg_jieba）"列为 Phase 1 待办；届时只需要 `ALTER TABLE ... ALTER COLUMN search_vector ...` 换分词配置，不影响其他表结构。Phase 1 中文关键词搜索在扩展装好前，应用层可以先退化到 `ILIKE` 兜底。
- Prisma 端把这一列声明成 `Unsupported("tsvector")`，Prisma 不管理它的生成表达式，迁移文件里手写 SQL 维护。

### 2.3 `recipe_ingredients`（配料表）

- 模糊用量（适量/少许/按口味）与精确用量（数字 + 单位）是两种数据形状，不是同一字段的可选状态，所以设计成 `amount_type ('exact' | 'vague')` + 两组互斥字段，并用 CHECK 约束保证形状一致：
  ```sql
  CHECK (
    (amount_type = 'exact' AND quantity IS NOT NULL)
    OR (amount_type = 'vague' AND vague_label IS NOT NULL)
  )
  ```
  这样即使绕过应用层直接写库，也不会出现"精确用量却没有数字"的脏数据。缩放（REQUIREMENTS 1.4）时，应用层按 `amount_type = 'vague'` 跳过这些行，原样保留。
- `is_optional`：对应"可标记为可选配料"。
- `sort_order`：配料表可排序的持久化字段。
- 没有做单位换算表——REQUIREMENTS 1.2 明确"厨房常用近似单位按固定近似值换算即可，不追求精确"，且"不做跨量纲换算"，这类固定换算表放在 `packages/shared` 的静态常量里，不是数据库实体。

### 2.4 为什么没有 `recipe_steps` / `units` / `shopping_lists` 表

- `recipe_steps`：并入 `recipes.steps` JSONB，见 2.2。
- `units`：单位是有限的固定枚举（g/kg/斤/ml/L/个/勺/适量…），换算规则是纯函数不是数据，放应用层常量表，不建表。
- `shopping_lists`：本轮任务范围是"菜谱设计与存储"，购物清单是运行时从多个菜谱聚合生成的衍生数据，属于 REQUIREMENTS 1.6 的独立功能，留到实现购物清单时再设计表结构（可能需要 `shopping_list` + `shopping_list_item` 两张表，届时会更新本文档）。

---

## 3. 遵循的全局规则（来自 ARCHITECTURE.md 第 4 节）

- 所有业务表：UUID 主键（`gen_random_uuid()`）、`space_id`（默认指向种子空间）、`created_at`/`updated_at`（`TIMESTAMPTZ`）、软删除 `deleted_at`。
- `updated_at` 没有数据库端自动更新逻辑——Prisma 的 `@updatedAt` 只在 Prisma Client 写入时维护。这意味着**所有写操作必须经过 Service 层的 Prisma Client**，不能手写 SQL 绕过（这也是 ARCHITECTURE.md 6 节"数据库变更一律走迁移文件，禁止手改生产库"的自然延伸）。
- 枚举字段（`category` / `role` / `amount_type` 的取值范围）不建数据库 CHECK 白名单，校验放 `packages/shared`，前后端共用同一份合法值定义。
- 每张表按 `space_id`（`WHERE deleted_at IS NULL`）建部分索引，为 Phase 3 的多空间查询预热。

---

## 4. 验证记录（2026-07-30）

在真实容器化 PostgreSQL 16 上跑通以下验证（迁移 + 手工 SQL 事务，均已回滚，未污染数据）：

- ✅ `prisma migrate dev` 成功建表，`prisma migrate status` 显示 schema up to date
- ✅ 插入菜谱「番茄炒蛋」+ 2 条配料（1 条精确用量「3 个鸡蛋」+ 1 条模糊用量「适量番茄」）成功
- ✅ 按食材反查菜谱（"有鸡蛋能做什么"）查询正确返回
- ✅ `CHECK` 约束正确拒绝：`difficulty = 9`、`amount_type = 'exact'` 但缺 `quantity`
- ✅ 唯一索引正确拒绝同空间重复食材名
- ⚠️ 全文检索：`to_tsvector('simple', '经典家常菜...')` 把整段中文当成一个词元，子串查询查不到——印证了上面第 2.2 节的已知限制，中文分词扩展是 Phase 1 遗留任务，不是这次的 bug。

---

## 更新记录

| 日期 | 变更 |
|---|---|
| 2026-07-30 | 初版：菜谱模块首版 Schema（spaces/users/space_members/ingredients/recipes/recipe_ingredients），迁移已在本地验证跑通 |
| 2026-08-01 | 加 `recipes.visibility`（private/public，广场用）、`recipe_submissions`（作业）、`recipe_print_images`（打印版图）。详见下方第 5 节 |
| 2026-08-01 | 登录接入：`users.username`（唯一，登录用）、`email` 改选填、`recipes.author_id`。详见下方第 6 节，含一次误删数据的事故记录 |

---

## 5. 第二次迁移（2026-08-01）：可见性 / 作业 / 打印版

### 5.1 `recipes.visibility`

`private`（默认）只在「我的菜谱」出现，`public` 同时进菜谱广场。加列时给了 `DEFAULT 'private'`，
存量菜谱不会因为这次迁移意外公开。枚举值按 ARCHITECTURE.md 4.3 不加 `CHECK`，由 `packages/shared`
的 `RECIPE_VISIBILITIES` 统一校验。

### 5.2 `recipe_submissions`（作业）

跟着某个菜谱做出来的成品帖：`images`（至少一张）+ `body`（心得）+ 可选 `rating` + `like_count`。

- `recipe_id` **必填** —— 作业的定义就是「跟着某道菜做的」，脱离菜谱没有意义。
- `user_id` 可空 + `author_name` 冗余：Phase 3 接入真实用户前先靠 `author_name` 展示，
  接入后回填 `user_id`，不用改表。冗余展示名也让作业广场列表不必 join `users`。
- `CHECK (array_length(images, 1) >= 1)`：没有图的作业没有意义，DB 侧兜底，应用层也有同样的校验。
- `rating` 的 `CHECK ... BETWEEN 1 AND 5` 与 `recipes.difficulty` 同规格。
- 点赞先做成计数器而非关联表：Phase 3 有用户后才谈得上「谁赞过 / 取消赞」，
  现在建关联表是为不存在的场景提前设计。

### 5.3 `recipe_print_images`（打印版菜谱图）

和 `recipes.cover_image_url` 是两回事：封面是列表缩略图，这个是整张排好版、拿去打印的成品。
`orientation` 区分横版/竖版，同样是应用层校验。没有软删除字段 —— 它没有被别的东西引用，
删除时连同磁盘文件一起硬删（见 `RecipesService.removePrintImage`），否则 uploads 目录只涨不减。

### 5.4 一个迁移陷阱

`prisma migrate dev --create-only` 生成的原始 SQL 里包含一批 **`DROP INDEX`**（`idx_recipes_tags`、
`idx_recipes_search_vector`、`idx_ingredients_aliases`、`idx_recipe_ingredients_*`、`idx_space_members_user`）
和一句 `ALTER COLUMN "search_vector" DROP DEFAULT`。原因是这些索引是 init 迁移里**手写补的**
（GIN / 局部索引，Prisma DSL 表达不了），Prisma 不认识它们就当成"多余的"要删掉；
`search_vector` 则是 `GENERATED ALWAYS` 列、本来就没有 DEFAULT。

**这些语句已全部手工删除。以后每次生成迁移都必须先通读一遍生成的 SQL**，
确认没有误删手写索引 —— 直接 `migrate dev` 一把梭会静默摧毁全文检索和标签查询的索引。

---

## 6. 第三次迁移（2026-08-01）：登录接入

### 6.1 `users` 表变更

- 加 `username`（唯一，登录用），`email` 从必填改选填 —— 自托管场景不做找回密码邮件，见 ARCHITECTURE.md 4.4。
- `display_name` 沿用原字段当昵称，没有新增列。

### 6.2 `recipes.author_id`

外键指向 `users.id`，`ON DELETE SET NULL`，允许为空。空值代表「登录接入前建的存量菜谱」，
应用层按「未认领」放行任何登录用户编辑；一旦写入了 `author_id`，就只有作者本人能改。
`recipe_submissions.user_id` 走同样的兼容策略，本次迁移没有新加列（该列上一次迁移就有）。

### 6.3 环境非交互导致的 `migrate dev` 不可用，以及由此引出的一次数据丢失事故

**背景**：这次迁移是在非交互式 shell（CI/自动化环境）里做的，`prisma migrate dev`（包括
`--create-only`）在这种环境下直接拒绝执行，报 "environment is non-interactive"。

**当时的变通做法**：改用 `prisma migrate diff --from-migrations ... --to-schema-datamodel ...
--shadow-database-url <url> --script` 生成原始 SQL，再手工创建迁移目录、人工过一遍（按 5.4 的规矩
剔除误删语句）、最后用 `prisma migrate deploy` 应用。这个流程本身是对的。

**事故**：`--shadow-database-url` 参数**误填成了当前开发环境正在用的那个真实数据库连接串**，
而不是一个一次性的影子库。Prisma 计算 diff 时会把 shadow URL 指向的库当成「可以随意清空重建」的
临时工作区——它在那上面重放了全部历史迁移文件来还原 schema，这个过程**清空了目标库当时的实际数据**
（`recipes`、`ingredients`、`recipe_ingredients`、`recipe_submissions` 全部归零；表结构本身没有损坏，
`_prisma_migrations` 记录也完好）。当时库里的数据后来靠重新走一遍菜谱创建 API 补了回来，
但如果是生产库，这会是不可逆的真实数据丢失。

**规矩，以后必须遵守**：

1. **`--shadow-database-url` 永远指向一个独立的、可随意丢弃的数据库/schema**，绝不能填当前在用的
   开发库或生产库连接串。本地开发场景，宁可专门起一个 `ihelper_shadow` 库，或者干脆用
   `docker run --rm` 起一个一次性 Postgres 容器。
2. **任何时候要在非交互式环境下生成迁移，先确认能不能改用交互式终端跑标准的
   `prisma migrate dev --create-only`**——那是官方支持的路径，不需要手动摆弄 shadow 库。
   只有确认走不通时才退回到 `migrate diff` 这条路，且执行前默念一遍上面第 1 条。
3. **对着任何数据库连接串类的参数（尤其是名字带 "shadow" "temp" 的），执行前用 `psql \\l` 或等价
   方式确认目标库确实是空的/一次性的**，不要假设 CLI 参数名暗示的语义会帮你兜底。
