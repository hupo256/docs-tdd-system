<!-- template-version: 2 -->
<!-- template-effective-since: 2026-07-23 -->

# Feature Inventory — `<TICKET-ID> <需求名>`

> **Agent 自动创建**：新需求 G0 前，由 Agent 从 [feature-inventory-template.md](../templates/feature-inventory-template.md) 复制到本路径，勿等负责人手动操作。  
> 规则：[common/prd-feature-inventory.md](../common/prd-feature-inventory.md) §3（G0 初稿 → G2 定稿 → 再写代码）。

| 字段 | 值 |
|------|-----|
| 工单 | |
| PRD 来源 | `inbox/...md` / Lark 链接 |
| Figma 主画板 | node id |
| 清单维护人 | |
| G2 确认人 & 日期 | |
| 责任模块目录 | 如 `apps/web/src/apps/<Feature>/**, services/api/<domain>/**`（改动边界白名单，见 [change-scope-boundary.md §1.1](../common/change-scope-boundary.md)） |
| visualFidelity | `standard` / `high`（高保真判定见 [component-reuse-and-visual-fidelity.md §3.0](../common/component-reuse-and-visual-fidelity.md)） |

## 功能清单

| ID | PRD 来源锚点 | PRD 章节 | 功能简述 | 页面 / 路由 | Figma | 与主画板关系 | 本期 | 确认 | 任务 / 代码 |
|----|--------------|---------|---------|------------|-------|-------------|------|------|------------|
| F01 | `PRD-IMG-001` / `PRD-TABLE-001` / 正文 §x | | | | ✅ / ❌ | 落地页 / 独立页 / 全局 | 待 G2 确认 | | |
| F02 | | | | | | | | | |

## 验收标准对照（PRD §x.x）

| 验收项 | 对应 ID | 状态 |
|--------|---------|------|
| | F01 | ☐ |

## Figma 未覆盖但 PRD 要求

| ID | 说明 | 本期是否做 |
|----|------|-----------|
| | | |

## Scope 裁剪记录（若有）

| PRD 条目 | 裁剪结论 | 确认人 | 日期 | 对验收标准影响 |
|---------|---------|--------|------|---------------|
| | | | | |

## TDD / PRD 冲突（若有）

| 项 | PRD | TDD | 结论 |
|----|-----|-----|------|
| | | | 待确认 / 已确认 |

## PRD 未完全可读内容

| 类型 | 位置 | 影响 | 处理方式 | 状态 |
|------|------|------|----------|------|
| 图片 / 白板 / 思维导图 / 表格占位 / 引用文档 / 删除线歧义 | | | OCR / 补导出 / 补文字版 / 等待确认 | 待确认 / 已处理 |

> 富媒体逐项事实源为 `agent/prd-source-manifest.json`；本表只引用 `sourceId`，不复制识别摘要。
