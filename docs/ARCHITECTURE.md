# iHelper 技术选型与架构

> 最后更新：2026-08-01
> 配套文档：[ROADMAP.md](./ROADMAP.md) · [REQUIREMENTS.md](./REQUIREMENTS.md)

---

## 1. 已确定的选型

| 层 | 选型 | 状态 |
|---|---|---|
| 前端 | **Vue 3 + TypeScript + Vite** | ✅ 已定 |
| UI 组件库 | **Element Plus** | ✅ 已定 |
| 状态管理 | **Pinia** | ✅ 已定 |
| 数据库 | **PostgreSQL 16+** | ✅ 已定 |
| 后端 | **NestJS + Prisma**（TypeScript） | ✅ 已定 |
| 部署 | **Docker Compose**（本地）→ 云服务器 | ✅ 已定 |

### 为什么是 PostgreSQL

你要的是「现在流行、扩展性好」，PostgreSQL 是这个描述的标准答案，且对本项目有几个具体的贴合点：

- **JSONB 列**：菜谱步骤、附加元数据这类结构不固定的内容，可以放 JSONB，避免为每个小变动改表结构；同时仍能建索引查询
- **全文检索内置**：菜谱搜索第一版直接用 PostgreSQL 的 `tsvector`，不需要额外部署 Elasticsearch
- **数组类型**：标签、别名可直接用数组列，简单场景省掉一张关联表
- **从 10 用户到数千用户不用换**：这是最关键的 —— SQLite 到时候要迁移，MySQL 在 JSON 和全文检索上弱一截
- 中文分词：需要装 `zhparser` 或 `pg_jieba` 扩展，Phase 1 处理

**不选 MongoDB 的理由**：本项目的数据高度关系化（菜谱↔食材↔库存↔待办 全是多对多引用），文档数据库在这里是反模式。

---

## 2. 后端选型 — 需要你拍板

前端已定 Vue，后端有两条路：

### 方案 A：NestJS（TypeScript）— 推荐

```
Vue 3 (TS)  ←→  NestJS (TS)  ←→  Prisma  ←→  PostgreSQL
```

**优点**

- **前后端同语言**，类型定义可以放在 `packages/shared` 里两边共用。这对单人开发是巨大的效率提升 —— 后端改了一个字段，前端立刻编译报错，而不是等到运行时
- Prisma 的类型生成 + 迁移工具是目前最好用的一档，`prisma migrate` 直接解决 Phase 3 加 `space_id` 那种大改造
- NestJS 的模块化结构天然契合本项目「菜谱/库存/待办/记录」的模块划分，不会写成一坨
- 将来做移动端如果用 React Native / Ionic，共享类型继续有效
- 招人/找资料/AI 辅助编程，TS 生态的资料量最大

**缺点**

- NestJS 的装饰器和依赖注入有一定学习曲线，比 Express 重
- 内存占用比 Python 方案略高（对 10 用户完全无所谓，1000 用户时也不是瓶颈）

### 方案 B：FastAPI（Python）

```
Vue 3 (TS)  ←→  FastAPI (Python)  ←→  SQLModel/SQLAlchemy  ←→  PostgreSQL
```

**优点**

- 上手快，代码量少，写起来舒服
- Pydantic 的数据校验非常顺手
- 自动生成的 OpenAPI 文档质量高
- 如果将来想加数据分析、营养计算、AI 推荐，Python 生态更顺

**缺点**

- 前后端两套类型定义，需要靠 OpenAPI 生成器同步，多一道工序也多一处出错点
- Alembic 迁移体验不如 Prisma
- 异步生态偶有坑（同步库混用容易埋雷）

### 建议

**选 A（NestJS）**，除非你 Python 明显比 TypeScript 熟。

理由：这是个**单人长期项目**，最大的敌人是「隔三个月回来看不懂自己写的代码」和「改一处漏改三处」。全栈同语言 + 端到端类型安全，正是针对这两个问题的解法。前端已经定了 Vue（TS），后端再用 TS，整个项目只需要在一个语言的心智模型里切换。

如果觉得 NestJS 太重，还有个折中：**Nitro / H3 或 Fastify + Prisma**，同样是 TS，但更轻。

> **决策记录**：2026-07-30 确定选 A（NestJS + Prisma）。`apps/api` 已按此方案搭好骨架，菜谱模块首版 Schema 已用 Prisma Migrate 跑通，详见 [DATABASE.md](./DATABASE.md)。

---

## 3. 整体架构

### 3.1 目录结构（Monorepo）

```
ihelper/
├── apps/
│   ├── web/                  # Vue 3 前端
│   │   ├── src/
│   │   │   ├── modules/      # 按业务模块划分：recipe/ stock/ task/ post/
│   │   │   ├── components/   # 跨模块通用组件
│   │   │   ├── stores/       # Pinia
│   │   │   ├── api/          # 接口封装
│   │   │   └── locales/      # i18n 文案
│   │   └── ...
│   └── api/                  # 后端
│       ├── src/
│       │   ├── modules/      # 与前端模块一一对应
│       │   ├── common/       # 守卫、拦截器、异常过滤
│       │   └── prisma/       # schema 与迁移
│       └── ...
├── packages/
│   └── shared/               # 前后端共享的 TS 类型与常量
├── docs/                     # 本目录
├── docker-compose.yml        # 本地一键启动
└── README.md
```

**原则**：前端 `modules/recipe` 与后端 `modules/recipe` 目录名严格对应。找代码时不用思考。

### 3.2 分层

```
┌─────────────────────────────────────────┐
│  Vue 前端（浏览器 / PWA / 将来的移动端）    │
└──────────────────┬──────────────────────┘
                   │  REST /api/v1/*  (JSON)
┌──────────────────▼──────────────────────┐
│  Controller  —  路由、参数校验、鉴权        │
├─────────────────────────────────────────┤
│  Service     —  业务逻辑（联动规则写在这里） │
├─────────────────────────────────────────┤
│  Repository  —  数据访问（ORM）            │
└──────────────────┬──────────────────────┘
                   │
        ┌──────────▼──────────┐
        │    PostgreSQL       │
        └─────────────────────┘
        ┌─────────────────────┐
        │  文件存储（抽象接口）  │
        │  本地磁盘 ↔ S3 可切换 │
        └─────────────────────┘
```

**关键约束**：模块间联动（菜谱扣库存、库存生成待办）的逻辑一律写在 Service 层，通过**领域事件**解耦，不要让菜谱模块直接 import 库存模块的 Repository。否则模块会互相缠死，将来拆分或裁剪都做不了。

### 3.3 API 约定

- 统一前缀 `/api/v1`，**从第一天就带版本号**，这是给将来的移动端留的后路
- REST 风格，资源名复数：`GET /api/v1/recipes`、`POST /api/v1/recipes/:id/cook`
- 统一响应结构，统一错误码
- 列表接口一律分页，默认 20 条
- 认证：JWT，Token 放 httpOnly Cookie（7 天有效期，见 4.4——落地时从「Access + Refresh」简化为单 Token，理由同上）

---

## 4. 数据模型：为多用户预留的设计

这是整份文档最重要的一节。

你选择了「先做单用户，后期再加多用户」。这个选择在开发速度上是对的，但如果什么都不预留，Phase 3 会变成一次痛苦的重写。**解法是：现在就在数据结构上留好位置，但不写任何多用户的业务代码。**

### 4.1 现在就要做的三件事

**① 每张业务表都带 `space_id` 列，第一版全部填同一个默认值**

```sql
-- Phase 1 就这么建表
CREATE TABLE recipes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id    UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  title       TEXT NOT NULL,
  ...
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ            -- 软删除
);

CREATE INDEX idx_recipes_space ON recipes(space_id) WHERE deleted_at IS NULL;
```

成本：每张表多一列。收益：Phase 3 不需要改表结构、不需要数据迁移、不需要回填。这个交易极其划算。

**② 所有查询从第一天起就带 `space_id` 条件**

```ts
// Phase 1：CURRENT_SPACE 是写死的常量
const recipes = await prisma.recipe.findMany({
  where: { spaceId: CURRENT_SPACE, deletedAt: null }
})
```

Phase 3 只需把 `CURRENT_SPACE` 从常量换成「从请求上下文取」。业务代码一行不用改。

如果第一版偷懒不写这个条件，Phase 3 就要逐个接口去审查有没有漏加过滤 —— 那是漏数据的高风险活。

**③ 主键用 UUID 而不是自增整数**

- 自增 ID 会泄露数据量，且多实例合并数据时必然冲突
- 将来做移动端离线创建数据，客户端可以直接生成 ID，同步时不冲突
- PostgreSQL 的 `gen_random_uuid()` 开箱即用

### 4.2 核心表关系（第一版）

```
users ──────────< space_members >────── spaces
                                           │
        ┌──────────────────────────────────┼───────────────────┐
        │                                  │                   │
     recipes                          ingredients          stock_items
        │                                  │                   │
        └──── recipe_ingredients ──────────┘                   │
                    │                                          │
             (数量 / 单位 / 备注 / 是否可选)          ←── 扣减 ───┘
```

Phase 1 只实体化 `users`、`spaces`（一行）、`recipes`、`ingredients`、`recipe_ingredients`。
`space_members` 表可以先建但只有一行，也可以 Phase 3 再建 —— 但 `spaces` 表和 `space_id` 列必须现在就有。

### 4.3 其他现在就该定的规矩

- **软删除**：所有业务表带 `deleted_at`，误删可恢复。查询默认过滤
- **时间戳**：`created_at` / `updated_at` 全表标配，用 `TIMESTAMPTZ`（带时区），一律存 UTC
- **迁移文件**：从第一次建表就走迁移工具，禁止手动改库
- **枚举**：用字符串常量而非数据库 enum 类型（PostgreSQL 改 enum 很麻烦），在应用层校验
- **生成的迁移必须人工过一遍**：schema 里有一批 Prisma DSL 表达不了、只能手写在迁移 SQL 里的东西
  （GIN 索引、局部索引、`CHECK` 约束、`GENERATED ALWAYS` 的 `search_vector` 列）。
  Prisma 不认识它们，`migrate dev` 生成的 SQL 会带上 `DROP INDEX` 想把它们"清理"掉。
  **一律用 `--create-only` 生成、删掉误删语句、再 `migrate deploy`**，不要直接一把梭。
  实例见 [DATABASE.md 5.4](./DATABASE.md)。
- **图片存储走抽象层**：业务代码只依赖 `StorageService` 抽象类，本地磁盘实现是
  `LocalDiskStorage`。Phase 4 换 S3 只改 `storage.module.ts` 的 `useClass` 和 `main.ts`
  里那段静态目录挂载。落盘文件名一律服务端生成（UUID + mime 白名单扩展名），
  绝不复用用户传来的文件名 —— 那是路径穿越和覆盖已有文件的入口。

### 4.4 登录接入（2026-08-01）

Phase 1 的「单用户登录」已落地，记录几个和早期设计不完全一致的决定：

- **不做公开注册**。自托管场景下，谁能碰服务器谁才该有账号，`POST /auth/register` 这种口子反而是攻击面。
  账号只能用 `apps/api/scripts/create-user.js` 由持有服务器权限的人建，用法见脚本头部注释。
- **Token 简化为单个 httpOnly Cookie（7 天过期），不做 Access + Refresh 分离**。原设计（3.3 节）是为多用户
  云端场景写的；单用户自托管场景下 refresh 轮换的复杂度收益不成比例，先用一个长效 Cookie，
  Phase 5 上云、接入无痕续期需求时再加。
- **全局鉴权 + 白名单，不是逐接口加 Guard**：`JwtAuthGuard` 挂在 `APP_GUARD`，默认所有接口都要登录，
  用 `@Public()` 显式标记不需要登录的接口（菜谱/广场/作业的所有 `GET`、登录、退出登录）。
  这样新增接口忘记加保护是「默认拒绝」而不是「默认放行」，比逐个加更不容易漏。
- **`users.username` 是登录用，`display_name` 是昵称**，两者分开——用户名不可改（body 校验里没开放这个字段），
  昵称随便改。`email` 从必填改成选填，因为不做找回密码邮件，这一版用不上。
- **`recipes.author_id` 允许为空**：登录接入前建的存量菜谱没有作者。应用层按「未认领」处理——
  任何登录用户都能编辑/删除这类菜谱；一旦某条菜谱有了 `author_id`，就只有作者本人能改，
  其他人操作会收到 403。`recipe_submissions.user_id` 同理。这是过渡期的兼容策略，
  不是长期设计；Phase 3 引入真正的多用户协作时要重新评估「未认领」菜谱该归谁。

---

## 5. 部署

### 5.1 本地开发 / 自托管（当前阶段）

```yaml
# docker-compose.yml 大致构成
services:
  db:       postgres:16          # 数据卷持久化
  api:      本项目后端镜像
  web:      Nginx 提供前端静态文件 + 反代 /api 到后端
```

目标：`docker compose up` 一条命令启动全部。

- 环境变量集中在 `.env`，仓库里放 `.env.example`
- 数据库数据卷挂载到宿主机，方便备份
- 提供 `scripts/backup.sh` 与 `scripts/restore.sh`

### 5.2 云端（Phase 5）

- 一台 2C4G 云服务器起步，足够支撑数百用户
- Caddy 或 Nginx 做反向代理，自动申请 HTTPS 证书
- 图片走对象存储（S3 兼容），不占服务器磁盘
- 数据库每日自动备份到异地
- 监控：Uptime Kuma（可用性）+ 应用日志

### 5.3 CI/CD

- GitHub Actions：push 即跑 lint + 类型检查 + 单元测试
- 打 tag 触发构建 Docker 镜像
- Phase 5 起加自动部署

---

## 6. Git 与协作规范

- 分支：`main`（稳定可部署）+ `feat/xxx` / `fix/xxx` 功能分支
- 提交信息用 Conventional Commits：`feat(recipe): 支持分量缩放`
- **每完成一个可用的小功能就提交并推送**，不攒大提交
- 每个 Phase 结束打一个 tag（`v0.1.0` = Phase 1 完成）
- `docs/` 里的三份文档随代码一起版本管理，需求变更和代码变更在同一次提交里

---

## 7. 待决技术事项

| 事项 | 何时决定 |
|---|---|
| ~~后端框架最终选定（NestJS vs FastAPI）~~ | 2026-07-30 已定：NestJS + Prisma |
| ~~UI 组件库（Naive UI vs Element Plus）~~ | 2026-08-01 已定：Element Plus |
| 中文分词扩展（zhparser vs pg_jieba） | Phase 1 做搜索时 |
| 图片存储方案与压缩策略 | Phase 4 |
| 移动端技术路线（PWA / React Native / Capacitor） | Phase 4 结束前 |

---

## 更新记录

| 日期 | 变更 |
|---|---|
| 2026-07-28 | 初版：确定 Vue + PostgreSQL，后端待定，制定多用户预留方案 |
| 2026-07-30 | 后端确定为 NestJS + Prisma；菜谱模块首版数据库 Schema 落地并验证跑通，详见 [DATABASE.md](./DATABASE.md) |
| 2026-08-01 | UI 组件库定为 Element Plus；新增图片存储抽象层与「生成的迁移必须人工过一遍」的规矩（4.3）；`packages/shared` 改为 CJS + ESM 双构建（NestJS 走 require，Vite 走 import） |
| 2026-08-01 | 单用户登录落地（4.4）：JWT httpOnly Cookie（简化为单 Token）、全局 Guard + `@Public()` 白名单、`users.username`、`recipes.author_id`／`recipe_submissions.user_id` 认领机制、`scripts/create-user.js` 建号（不做公开注册） |
