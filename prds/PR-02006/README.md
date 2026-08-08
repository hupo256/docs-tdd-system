---
projectId: PR-02006
status: closed
stage: G8
branch: feature/PR-02006
worktree: ""
port: ""
visualFidelity: standard
prdSource: "apps/web/docs_tdd/prds/PR-02006/inbox/lark-sync/prd-latest.md"
figmaNode: ""
larkEnabled: false
---

# PR-02006 需求文档

> 状态：**已上线（2026-07-01）**。Web + Admin 币种配置已实现并合入（`ea8c24750`），G6 自测完成。项目已关闭；如有真实 API / QA 验收差异，回本项目 `product/06-collaboration.md` 补记。公共规则入口见 [`../common/README.md`](../../common/README.md)。

## 当前基线

| 项 | 状态 |
|----|------|
| PRD | 已同步到 `inbox/lark-sync/prd-latest.md`，并提取可读正文 `inbox/lark-sync/prd-content.md` |
| Figma | 已提供原型链接；正式 UI 地址为空，待确认 |
| API / YApi | 未提供；当前实现为 mock-first + 真实 API 字段预留，待联调校准 |
| QA 用例 | PRD §七截图 OCR 已补入 3 条验收标准；嵌入 sheet 明细仍未展开，G7 前需 QA/产品确认 |
| G0/G2 功能清单 | F01-F23 共 23 条，已确认全部本期做 |
| 当前阶段 | G6 自测已完成；进入 G7 前待真实 API / 正式 UI / QA 验收明细 |
| Lark 主动通知 | 不启用；阶段结果人工同步 |
| 群内 @ 应用转 task | 未启用 |

## 文档地图

| 文档 | 用途 | 状态 |
|------|------|------|
| `inbox/lark-sync/prd-latest.md` | PRD 本地只读副本 | 已同步 |
| `inbox/lark-sync/prd-content.md` | 从 Lark JSON payload 提取的可读 PRD 正文 | 已生成 |
| `product/00-feature-inventory.md` | PRD 全量功能清单 | F01-F23 已确认本期做，代码已提交 |
| `product/01-scope-and-phases.md` | 范围与阶段 | 已更新到 G6 自测完成 |
| `product/02-technical-design.md` | 技术设计 | 已生成 |
| `product/03-api-contract.md` | API 契约 | 已生成 |
| `product/04-frontend-tasks.md` | 前端任务 | T01-T23 已实现并提交 |
| `product/05-ui-and-interaction.md` | UI 与交互 | 已生成 |
| `product/06-collaboration.md` | 待确认、冲突、假设 | 已记录 G6 结果与 G7 待办 |
| `product/07-figma-spec.md` | Figma 规格 | 已生成 |
| `engineering/development-rules.md` | 项目特殊工程规则 | 已生成 |
| `agent/README.md` | Agent 恢复流程 | 已创建 |

## 规则继承检查

| 项 | 结论 |
|----|------|
| 已读公共规则入口 | 是，见 `../common/README.md` |
| 已对照最近成熟项目 | 是，`PR-01988/engineering/development-rules.md` |
| 是否发现需新增到 common 的通用规则 | 暂无 |
| 薄包装检查 | 已通过；项目文件只记录 PR-02006 状态和差异 |

## 当前阶段

| 阶段 | 状态 | 证据 |
|------|------|------|
| G0/G1 文档与基线 | 已完成 | PRD、清单、技术/API/UI/协作文档均已生成 |
| G2 范围确认 | 已完成 | F01-F23 全部本期做，包含 Admin F19-F21 |
| G3 Mock / API 准备 | 已完成 mock-first | Web mock 数据与真实 API 字段预留已落地，真实接口待联调 |
| G4 Web / Admin 实现 | 已完成 | 最新提交 `ea8c24750 feat: PR-02006 tradfi market experience` |
| G6 自测 | 已完成定向自测 | Biome 通过；定向 Vitest 5 files / 46 tests 通过；历史 Web 定向单测 55/55 通过；headless Chrome evidence 已归档 |
| G7 QA 回归 | 待进入 | 需要 QA 验收 sheet / 正式 UI / 真实 API 联调结果 |

## 待确认项

1. PRD §七嵌入 sheet 明细仍未展开；目前只有用户截图 OCR 的 3 条验收标准。
2. 正式 UI 地址为空；当前实现按原型与 PRD 截图，后续 UI 差异需补。
3. 真实 API / YApi / Swagger 待提供；需联调币种别名、语言参数、24h 成交额、Admin 提交字段。
4. Admin 币种配置已随本期提交；页面落点、权限和真实接口字段仍需联调确认。
5. Lark 主动通知和群内 @ 应用转 task 已确认不启用。
