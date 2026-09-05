# V2 灰度样本 API 契约待补清单

> 三个 V2 样本因后端没有可版本化的 API 契约文档而处于 `pending-dependency`，本清单用于人工催办后端。
> 契约到位后，对每个项目重跑：
>
> ```bash
> node common/engine/agent-scripts/vnext-verify.mjs \
>   --input common/vnext/pilots/<PR-XXXX>/work-item.json \
>   --worktree <fameex-web-absolute-path> \
>   --write --out common/vnext/pilots/<PR-XXXX>
> ```

## PR-02117（做市商管理实时盘口）

| Blocker ID | 所需后端契约 | 影响 R-xxx |
|------------|--------------|-----------|
| API-PR-02117-MARKET-MAKER-DATA | 实时盘口、做市商指标、刷新/游标、权限数据契约 | R-002、R-003、R-006、R-009、R-011、R-013、R-015、R-016、R-017、R-018、R-019、R-020 |

**要点**：需版本化的 API 文档，包含请求/响应/字段语义/错误码；供前端做 `api-contract` 与 MSW mock 使用。

## PR-02133（佣金状态变更）

| Blocker ID | 所需后端契约 | 影响 R-xxx |
|------------|--------------|-----------|
| API-PR-02133-COMMISSION-STATUS | 佣金入账状态/时间、资金流水创建语义 | R-002、R-003、R-004、R-006、R-009 |

**要点**：需确认状态机字段与事件，以及资金流水生成时机；影响 App/Web funds-flow 与 commission-management 表面。

## PR-02193（抵扣金扣减流水）

| Blocker ID | 所需后端契约 | 影响 R-xxx |
|------------|--------------|-----------|
| API-PR-02193-DEDUCTION-FLOW | 新抵扣流水类型、聚合逻辑、审计查询与导出 | R-001、R-003、R-004、R-005、R-007、R-008、R-009、R-011 |

**要点**：需管理端流水查询接口的版本化契约，以及 fixture/测试数据，用于 component-dom 与 browser-interaction 证据。
