---
projectId: PR-02233
status: active
stage: G4
branch: feature/PR-02233
worktree: /Users/aven/github/PR-02233
port: ""
visualFidelity: standard
prdSource: https://qfglxo2m3dc.sg.larksuite.com/docx/QaBEditNroySaGxmywFl8CwXg6d
figmaNode: ""
larkEnabled: false
---

# PR-02233 【用户端】安全验证校验交互优化

## 状态

| 字段 | 值 |
|------|-----|
| 当前阶段 | G4 P0/P1 已实现并完成专项自测；P2/P3 待推进 |
| 最新通过门禁 | G4（57 项文档 + 6 项实现检查通过；PRD fingerprint `4523d7396057da62`） |
| 公共规则 | 继承 ../../common/README.md |
| PRD 来源 | revision 670，本地快照 `inbox/lark-sync/prd-latest.extracted.md` |
| 范围口径 | Web 本仓实施；App 需求移交 App owner |
| API 口径 | 复用现有登录/注册/发送/确认接口；少量新增或字段变更走 MSW 路线 B |
| visualFidelity | standard（PRD 截图，无独立 Figma node） |

## 当前实施顺序

1. P0：共享 resolver、发送状态机、帮助弹窗、MSW 契约。
2. P1：Web 注册引导 + Web 登录真实切换。
3. P2：非登录注册的 Web 安全验证场景分批迁移。
4. P3：埋点、全场景回归和真实 API 对账。

## 文档地图

- `product/00-feature-inventory.md`：唯一范围裁决
- `product/01-scope-and-phases.md`：批次与门禁
- `product/02-technical-design.md`：复用、状态所有权和方案
- `product/03-api-contract.md`：既有 API + MSW provisional contract
- `product/04-frontend-tasks.md`：原子任务与证据
- `product/05-ui-and-interaction.md`：交互状态矩阵
- `product/06-collaboration.md`：外部依赖和冲突结论
- `product/07-figma-spec.md`：PRD 截图替代设计输入说明
- `agent/prd-source-manifest.json`：富媒体事实源

## 尚未阻塞编码但须在 G5 前销账

- 后端新增/变更 API 的最终 path、字段名、错误码和冷却截止时间单位。
- 客服入口复用的 Web SDK action。
- App 仓 owner 与提测节奏（不阻塞 Web P0/P1）。
