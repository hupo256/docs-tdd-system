---
projectId: PR-01988
status: closed
stage: G8
branch: feature/PR-01988
worktree: ""
port: ""
visualFidelity: standard
prdSource: "apps/web/docs_tdd/PR-01988/inbox/【PR-01988】预测市场二期方案.md"
figmaNode: ""
larkEnabled: true
---

# 预测市场二期（PR-01988）— 开发文档

> **状态**：**已上线（2026-07-11），worktree 已回收**（`decommission-worktree.mjs`，分支 `feature/PR-01988` 保留便于回查）。Admin 运营后台闭环 + Web 侧 F01 埋点 / F07 交易禁用态已合入 online。
> **PRD**：`apps/web/docs_tdd/PR-01988/inbox/【PR-01988】预测市场二期方案.md`。  
> **公共规则**：继承 [../common/README.md](../common/README.md)，当前已通过 G2，mock-first 保留为兜底；真实接口联调已完成，高风险操作仍保留安全闸口和验收证据要求。

## 文档地图

| 分类 | 文档 | 说明 |
|------|------|------|
| 功能清单 | [product/00-feature-inventory.md](./product/00-feature-inventory.md) | PRD 全量功能、验收项、做/不做/延期、待确认差异 |
| 产品范围 | [product/01-scope-and-phases.md](./product/01-scope-and-phases.md) | 背景、目标、范围、阶段、验收 |
| 技术方案 | [product/02-technical-design.md](./product/02-technical-design.md) | Admin / Web 影响面、复用候选、数据流、风险 |
| API 契约 | [product/03-api-contract.md](./product/03-api-contract.md) | 接口清单草案、字段、schema、mapper、Mock 假设 |
| 前端任务 | [product/04-frontend-tasks.md](./product/04-frontend-tasks.md) | G2 后落地的任务清单 |
| UI 交互 | [product/05-ui-and-interaction.md](./product/05-ui-and-interaction.md) | Admin 页面、用户侧影响、异常态、i18n |
| 协作记录 | [product/06-collaboration.md](./product/06-collaboration.md) | 待确认项、PRD / API / Figma / 代码基线差异 |
| Figma / 原型 | [product/07-figma-spec.md](./product/07-figma-spec.md) | PRD 截图覆盖、缺失原型、设计待补 |
| G2 Scope Review | [product/08-g2-scope-review.md](./product/08-g2-scope-review.md) | 建议做/不做/延期口径、必须回答问题、确认模板 |
| 验收清单 | [product/09-acceptance-checklist.md](./product/09-acceptance-checklist.md) | G6/G7 自测、联调、QA 证据矩阵 |
| 实施计划 | [product/10-implementation-plan.md](./product/10-implementation-plan.md) | G2 后开发阶段、文件落点、安全闸口、验证顺序 |
| 输入清单 | [product/11-needed-inputs.md](./product/11-needed-inputs.md) | 进入开发前最小必填信息、可后补信息、回复模板 |
| 自测用例 | [product/14-self-test-cases.md](./product/14-self-test-cases.md) | 从 Lark MindNote FreeMind 导出生成的 G6/G7 可执行自测用例 |
| 工程规则 | [engineering/development-rules.md](./engineering/development-rules.md) | 当前项目特殊工程约束 |
| Agent 流程 | [agent/README.md](./agent/README.md) | 恢复顺序、Lark 决策、资料状态 |
| Lark 接入 | [agent/lark-integration.md](./agent/lark-integration.md) | 主动通知脚本、配置路径、补信息口径 |
| 通知记录 | [agent/notification-log.md](./agent/notification-log.md) | G0-G8 / Lark Job 实际发送记录 |

## 当前状态摘要

| 项 | 状态 |
|----|------|
| PRD | 已提供并完成 G0 读取 |
| RDP / 补充资料 | 已通过 worktree 软链读取主仓 `/Users/aven/github/fameex-web/apps/web/docs_tdd/PR-01988/inbox/【PR-01988】预测市场二期方案.md` |
| 需求名称 | 预测市场二期：后台运营与风控闭环 |
| 核心范围 | 数据埋点、每日收入统计、分类管理、事件管理、订单管理、仓位管理、手动平账、告警配置 |
| 主要代码面 | `apps/admin` 新后台页面为主；`apps/web` 用户侧埋点 / 交易禁用态待确认 |
| 一期代码基线 | 当前 worktree 未找到 `apps/web/src/apps/Prediction/`、`apps/web/src/services/api/prediction/` 与 `apps/web/src/services/api/predict/`；仅找到 WorldCup 活动代码和 `polymarket` i18n 文案，Web F01/F07 开发前需确认代码来源 |
| docs_tdd 软链 | `/Users/aven/github/PR-01988/apps/web/docs_tdd` → `/Users/aven/github/fameex-web/apps/web/docs_tdd`，后续文档均从主仓读取 |
| Figma / 原型 | G2 确认按 PRD 截图低保真实现；HTML / Figma 后续如有再补 |
| API / YApi / Swagger | 已拉取 YApi project 459 的 32 个接口并完成接口联调；快照见 `inbox/yapi/`，对接说明见 `product/12-yapi-api-integration.md` |
| Admin mock-first | `/prediction/**` 路由、菜单、zh-CN 文案、React Query mock hooks、RDP 核心表格字段、导出反馈、统一空态和 `__error` 错误态已完成；说明/解释/mock 提示型 UI 已按截图要求清理 |
| QA 用例 | 已通过 FreeMind 导出读取，原始文件见 `inbox/lark-qa/PR-01988预测市场二期测试用例.mm`；已生成可执行自测清单 `product/14-self-test-cases.md` |
| Lark 主动通知 | 已接入脚本；本机 webhook 配置已就绪，可真实发送 |
| 群内 @ 应用转任务 | 未启用；如需启用需另接 Lark 应用事件订阅 + Bot Gateway |

## 核心结论

1. 二期不是用户侧新玩法，而是运营后台闭环：可观测、可处置、可预警。
2. Admin 新页面至少包含每日收入统计、分类管理、事件管理、订单管理、仓位管理、手动平账、告警配置。
3. Web 用户侧明确涉及前端埋点；事件交易关闭禁用态纳入本期，字段 / 错误码后续联调。
4. 三期规划、自动补资、限价单、理财收益等不进入二期实现。
5. G2 已确认；Admin mock-first 与真实接口联调已完成，高风险 mutation 按安全闸口保留验收记录。

## 后续必须确认

| ID | 待确认项 | 影响 |
|----|----------|------|
| Q1 | 本仓是否同时负责 Admin 页面、Web 用户侧埋点；App / 服务端埋点是否只做联调验收 | 任务范围 |
| Q2 | HTML 原型 / Figma node / 截图原图 | Admin UI 还原 |
| Q3 | 真实环境、权限码、YApi 路径稳定性、字段精度和错误码 | schema、mapper、real-mode 联调 |
| Q4 | 分类管理是否本期做 | 页面数量和菜单 |
| Q5 | Admin 菜单分组、路由名、权限码、legacy redirect | 路由与权限 |
| Q6 | 毛利是否扣 PM 手续费/Gas；PM fee 精度 8 位还是 5 位 | 财务口径与 formatter |
| Q7 | 手动平账权限、审批、白名单、最大份额限制 | 高风险操作安全边界 |
| Q8 | Lark webhook 是否前端可配置，secret 如何脱敏和审计 | 告警配置安全边界 |
| Q9 | legacy `/polymarket_config` 私钥、钱包、Relayer API Key 配置页是否保留在 legacy，还是迁移到本期 Next Admin | Admin 配置迁移范围 |

## 开发准入状态

| 门禁 | 当前结论 | 是否可开发 |
|------|----------|------------|
| G2 功能清单 | aven / 2026-06-17 已确认：F01 Web 做、F02 后端主责前端联调、F03-F12 做、F13 不做 | 是 |
| G3 API / Mock | YApi project 459 已拉取 32 个接口；mock-first 保留兜底，真实 API 等权限 / 环境 / 路径稳定性继续联调 | 是（mock-first + real-mode 预接入） |
| 原型 / UI | G2 确认按 PRD 截图 + 现有 Admin 风格低保真实现 | 是 |
| 路由 / 权限 | 预测市场独立菜单组，route 用 `/prediction/...`，permission code 后端补 | 是（权限 code 占位/后补） |
| 高风险操作 | 手动平账独立权限 + 二次确认 + 审计；Lark secret 不回显；`polymarket_config` 保留 legacy | 是（真实 mutation 仍需安全确认） |

> 结论：G4 Admin UI/UX 已完成并提交；G5 YApi 文档同步、real-mode 预接入和接口联调已完成；QA MindNote 已转为可执行自测用例，下一阶段是按 `14-self-test-cases.md` 执行 G6/G7 验收并沉淀证据。

## 文档确认后开发顺序

1. Admin mock-first 已完成并提交：路由 / 菜单 / 权限占位 / mock service / fixture / 页面字段 / 空态 / 错误态 / PRD UI 差异修正。
2. 2026-06-21 已跑 Biome；Admin TypeScript 全量仍因既有无关错误退出 1，但无 PR-01988 相关诊断。
3. YApi 已同步 32 个接口；Admin real-mode 已补齐事件列表、收入、订单、仓位、告警、手动平账列表 / 记录 / 导出 / 提交映射。
4. 接口联调已完成；QA FreeMind 已生成 164 条自测用例，继续按用例执行并回填证据；Web 一期 Prediction 代码来源仍需按 scope 确认。
5. 高风险模块（手动平账、告警配置）真实 mutation 验收仍按安全闸口记录，必须保留独立权限、二次确认和审计字段证据。
6. Web F01/F07 暂不开发，直到确认一期 Prediction 代码路径、分支或允许从当前结构新建。
7. UI/UX 当前已按最新“去说明/解释/mock 提示组件”版本完成；后续如接口联调改变页面状态，再补联调截图/报告。

## 新需求 Checklist

### G0 资料接收

- [x] PRD 已放入 `inbox/`
- [x] Agent 已自动创建 `product/00-feature-inventory.md`
- [x] Agent 已读 PRD 含验收标准，并填写清单初稿
- [x] Figma 链接 / node id 未提供；G2 确认按 PRD 截图低保真实现
- [x] YApi project 459 已拉取 32 个接口；G2 mock-first 授权仍作为兜底，真实接口按 `product/12-yapi-api-integration.md` 联调
- [x] QA 用例来源标记待补，详见 `09-acceptance-checklist.md`
- [x] 现有代码复用候选已初查
- [x] 现有组件、hooks、services、stores、utils、相近业务功能已盘点，并在技术方案中记录复用 / 封装 / 新建判断
- [x] 已从 PRD 含验收标准抽出功能清单
- [x] 已读取 `common/README.md` 和公共规则专题
- [x] 已对照最近成熟项目 `PR-01973/engineering/development-rules.md` 做规则继承检查
- [x] 旧项目可复用规则已确认无需本次新增到 `common/`
- [x] 已完成薄包装检查：项目文档只写项目差异，没有复制公共规则全文
- [x] 若启用脚本能力，项目脚本只调用 `common/` 公共脚本，不复制完整实现

### G1-G2 文档确认

- [x] `00-feature-inventory.md` G2 已定稿：每条「做/不做/后端主责」+ G2 确认人 & 日期
- [x] `01-scope-and-phases.md`
- [x] `02-technical-design.md`
- [x] `03-api-contract.md`
- [x] `04-frontend-tasks.md`
- [x] `05-ui-and-interaction.md`
- [x] `06-collaboration.md`
- [x] `07-figma-spec.md`
- [x] `08-g2-scope-review.md`
- [x] `09-acceptance-checklist.md`
- [x] `10-implementation-plan.md`
- [x] `11-needed-inputs.md`
- [x] `engineering/development-rules.md`
- [x] `agent/README.md`
- [x] 已记录是否启用 Lark 主动发群消息：已接入项目脚本，等待本机 webhook 配置
- [x] 已记录是否启用群内 @ 应用自动生成 task：未启用，群反馈仍由人工整理

## 2026-06-22 阶段更新

| 项 | 当前结论 | 证据 / 备注 |
|----|----------|-------------|
| 当前阶段 | G5 YApi 文档同步、real-mode 预接入和接口联调已完成；进入 G6/G7 QA 用例同步与验收证据收口 | 最新提交以 PR-01988 worktree 为准；本地 docs_tdd 更新不进入业务提交 |
| 代码落点 | 仅保留在 `/Users/aven/github/PR-01988` 的 `feature/PR-01988` worktree | 主仓 `/Users/aven/github/fameex-web` 已清理误落代码 |
| UI/UX | 后台页面按 PRD 截图低保真实现；页面上的说明 / 解释 / mock 提示型组件已统一移除；当前 UI 已确认完成 | 接口联调已完成，按 QA 用例补真实数据状态截图证据 |
| 质量检查 | Biome touched files 已通过；Admin TS 全量仍有历史无关错误，无 PR-01988 路径诊断 | TS 日志：`/private/tmp/pr01988-admin-tsc.log` |
| 下一阶段 | 同步 QA 测试用例正文、拆解验收矩阵、补真实数据 / 导出 / mutation / 高风险安全链路证据 | Lark 用例链接已提供，但本机 CLI 未配置，需导出稿或授权 |

## 2026-06-22 UI 完成口径更新

| 项 | 当前结论 | 下一步 |
|----|----------|--------|
| UI/UX | 已确认完成；PRD 截图低保真、交互细节、去说明/解释/mock 提示组件均已落地 | 等真实接口数据接入后做联调截图 |
| 接口状态 | mock-first 可用；YApi 32 个接口已形成快照，real 模式路径和 mapper 已补齐主要读写链路 | 等真实环境 / permission code 对齐 |
| 高风险操作 | 仅保留 UI 外壳、二次确认和安全边界记录 | 等权限、审计、限额、白名单确认后再接真实 mutation |
