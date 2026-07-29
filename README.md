# iHelper

自托管优先的个人与家庭数据中枢 —— 把日程、待办、家庭库存、菜谱、生活记录放进同一套数据模型，让它们互相引用、互相触发。

> 🚧 项目处于 **Phase 0（项目奠基）**，尚无可运行代码。

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

## 当前状态

**MVP 目标**：菜谱模块 —— 做一个自己每周都会用的完整产品，而非能跑通的 demo。

**技术栈**

- 前端：Vue 3 + TypeScript + Vite + Pinia
- 后端：待定（NestJS 推荐 / FastAPI 备选，详见 ARCHITECTURE.md）
- 数据库：PostgreSQL 16+
- 部署：Docker Compose（本地）→ 云服务器（Phase 5）

**规模路径**：本地部署 10 人以内 → 云端 1000+ 用户 → Web / iOS / Android 多平台

## 明确不做

社交网络 · 记账理财 · 即时通讯 · 企业版 · 初期 AI 功能

## 数据主权

这是产品承诺，不是可选项：全部数据可一键导出为 JSON 并导入回空实例，永远提供可自建的开源版本。

## 下一步

- [ ] 确认后端框架选型
- [ ] 初始化 Monorepo 骨架
- [ ] Docker Compose 开发环境
- [ ] 数据库 Schema 首版
