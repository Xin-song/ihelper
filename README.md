# iHelper

自托管优先的个人与家庭数据中枢 —— 把日程、待办、家庭库存、菜谱、生活记录放进同一套数据模型，让它们互相引用、互相触发。

> 🚧 **Phase 0 已达成退出条件**，正在做 Phase 1（菜谱 MVP）。
> 菜谱模块可用：CRUD、分量缩放、图片上传、菜谱广场、交作业、可打印菜谱图。
> 尚无登录（当前恒为单用户默认空间），搜索与购物清单待做。

## 这是什么

市面上不缺待办 App，也不缺菜谱 App。iHelper 的价值不在单个模块，而在**模块之间的联动**：

```
查菜谱 → 做饭 → 自动扣减食材库存 → 低于阈值 → 生成采购待办 → 出现在日程里
```

如果最终产品做不到这条链路，它就没有存在意义。

## 文档

| 文档 | 内容 |
|---|---|
| [docs/ROADMAP.md](docs/ROADMAP.md) | 产品定位、长短期目标、六个阶段的划分与退出条件 |
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | 各模块功能需求拆解，P0–P3 优先级 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 技术选型、数据模型、部署方案、Git 规范 |
| [docs/index.html](docs/index.html) | 可视化看板（浏览器打开） |
| [docs/DATABASE.md](docs/DATABASE.md) | 数据库 Schema 设计与取舍记录（菜谱模块首版） |

## 当前状态

**MVP 目标**：菜谱模块 —— 做一个自己每周都会用的完整产品，而非能跑通的 demo。

**技术栈**

- 前端：Vue 3 + TypeScript + Vite + Pinia + Element Plus
- 后端：NestJS + Prisma（TypeScript）
- 数据库：PostgreSQL 16+
- 图片存储：本地磁盘 + 存储抽象层（Phase 4 可切 S3，只换实现类）
- 部署：Docker Compose（本地）→ 云服务器（Phase 5）

## 本地跑起来

```bash
pnpm install
cp .env.example .env          # 默认值可直接用
pnpm db:up                    # 起 PostgreSQL
pnpm --filter @ihelper/shared build
pnpm --filter @ihelper/api prisma:deploy
pnpm api:dev                  # :3000
pnpm --filter @ihelper/web dev  # :5173
```

浏览器打开 http://localhost:5173 。

**规模路径**：本地部署 10 人以内 → 云端 1000+ 用户 → Web / iOS / Android 多平台

## 明确不做

通用社交网络（关注关系链 / 算法推荐流）· 记账理财 · 即时通讯 · 企业版 · 初期 AI 功能

> 「菜谱广场 / 交作业」不算通用社交：它围绕菜谱内容组织、按时间倒序、没有关注关系和推荐算法。
> 定位是「自用为主，顺带分享」。

## 数据主权

这是产品承诺，不是可选项：全部数据可一键导出为 JSON 并导入回空实例，永远提供可自建的开源版本。

## 下一步

- [x] 确认后端框架选型（NestJS + Prisma）
- [x] 初始化 Monorepo 骨架（`apps/web`、`apps/api`、`packages/shared`）
- [x] 数据库 Schema 首版（菜谱模块，详见 [docs/DATABASE.md](docs/DATABASE.md)）
- [x] 菜谱三页结构：我的菜谱 / 菜谱广场 / 交作业
- [x] 图片上传 + 可打印菜谱图（Canvas 排版生成，非 AI）
- [ ] 单用户登录与会话（当前所有数据挂在默认空间）
- [ ] 菜谱搜索与筛选（按名称/标签/食材反查）
- [ ] 购物清单
- [ ] `api`/`web` 容器化，做到真正一条命令启动
- [ ] CI：提交即跑 lint + 类型检查 + 测试
