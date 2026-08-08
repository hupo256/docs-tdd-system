# PR-01988 G2 Scope Review

> 状态：已确认。确认人：aven；日期：2026-06-17。已同步 `00-feature-inventory.md`。

## 建议确认口径

| ID | 功能 | 建议本期 | 原因 | 需确认人 |
|----|------|----------|------|----------|
| F01 | Web/App 前端数据埋点 | Web 做 / App 另端 | PRD 明确前端漏斗点位；当前仓仅能覆盖 Web | 产品 / 数据 / Web FE / App |
| F02 | 服务端结果和结算埋点 | 后端做 / 前端联调 | 前端不生产服务端事件，但需核对买卖结果字段 | 后端 / 数据 / QA |
| F03 | Admin 每日收入统计 | 做 | PRD 范围一览和截图均明确 | 产品 / Admin FE / 后端 |
| F04 | 收入、成本、毛利口径 | 做，但口径待财务确认 | PRD 要求账务一致；毛利表述存在冲突 | 产品 / 财务 / 后端 |
| F05 | Admin 分类管理 | 做 | PRD 正文完整，G2 已确认纳入本期 | 产品 / Admin FE / 后端 |
| F06 | Admin 事件管理 | 做 | 运营闭环核心：添加事件、上下线、rate、阈值 | 产品 / Admin FE / 后端 |
| F07 | 事件交易关闭后的用户侧禁用态 | 做 Web 联调 | PRD 验收要求关闭交易后前端不可买卖 | 产品 / Web FE / 后端 |
| F08 | Admin 订单管理 | 做 | PRD 范围一览和对账验收明确 | 产品 / Admin FE / 后端 |
| F09 | Admin 仓位管理 | 做 | PRD 范围一览和验收明确，虽缺截图 | 产品 / Admin FE / 后端 |
| F10 | Admin 手动平账 | 做，但需安全边界 | 高风险操作，必须确认权限、审批、限额、审计 | 产品 / 风控 / 后端 / Admin FE |
| F11 | Admin 告警配置 | 做，但 secret 不回显；测试告警按 PRD 删除线口径不作为当前必做 | PRD 明确阈值和 Lark 配置；涉及敏感配置 | 产品 / 安全 / 后端 / Admin FE |
| F12 | 上线验收流程 | 做 / QA 主责 | PRD 明确灰度、核对、稳定性观察和会签 | QA / 产品 / 运维 |
| F13 | 三期规划候选 | 不做 | PRD 明确为后续规划 | 产品 |

## 必须先回答的问题

| 编号 | 问题 | 影响 | 默认建议 |
|------|------|------|----------|
| Q01 | 本仓是否负责 `apps/admin` 后台页面和 `apps/web` 用户侧埋点？App 是否另端负责？ | 决定 F01/F07 代码范围 | 本仓做 Admin + Web；App 另排 |
| Q02 | 是否允许在无 YApi/Swagger 时 mock-first？ | 决定能否进入 G4 | 已确认允许；当前 YApi 32 个接口已到，mock-first 保留兜底 |
| Q03 | Admin API base path、分页、导出、错误码、样例响应在哪里？ | service、schema、mapper、表格状态 | YApi project 459 已提供 32 个接口；仍需真实环境、权限、路径稳定性、字段精度和错误码 |
| Q04 | HTML 原型 / Figma node 是否提供？若不提供，能否按 PRD 截图低保真实现？ | UI 还原和弹窗细节 | 无原型时按 PRD 截图 + 现有 Admin 风格 |
| Q05 | 分类管理是否本期做？ | 页面数量、菜单、API | 建议做，否则需产品确认裁剪 |
| Q06 | Admin 菜单分组、route、permission code、legacy redirect 如何配置？ | 路由、菜单、权限、legacy 入口 | 预测市场独立菜单组，具体 code 后端给 |
| Q07 | 收入统计“毛利”是否扣 PM fee / Gas？PM fee 精度 8 位还是 5 位？ | formatter、账务核对、测试用例 | 后端直接返回展示字段，前端不自行算账 |
| Q08 | 手动平账是否需要审批、白名单、最大份额限制、独立权限？ | 高风险 mutation 安全边界 | 无确认不接真实 mutation |
| Q09 | Lark webhook secret 是否允许前端配置？是否只展示脱敏状态？ | 敏感信息安全 | 前端只展示开关/脱敏状态，secret 不回显 |
| Q10 | legacy `/polymarket_config` 私钥配置页保留还是迁移？ | 菜单和安全范围 | 默认保留 legacy，迁移需单独安全确认 |
| Q11 | QA 用例、联调环境、测试账号是否提供？ | G7 验收 | 未提供则记录跳过，保留自测证据 |

## 推荐 G2 结论模板

已按下方内容同步到 `product/06-collaboration.md` 并更新 `product/00-feature-inventory.md`：

```text
G2 Scope confirmed by: <姓名>
Date: <YYYY-MM-DD>

本期做：F01(Web), F03, F04, F05/F06/F07/F08/F09/F10/F11/F12
后端主责 / 前端联调：F02
App 另端：F01(App)
不做：F13

API：YApi project 459 已提供 32 个接口；mock-first 保留兜底；真实环境 / 权限 / 路径稳定性待确认
原型：<HTML/Figma/截图路径；或确认按 PRD 截图低保真实现>
菜单权限：<菜单分组、route、permission code、legacy redirect>
财务口径：<毛利是否扣成本、PM fee 精度>
高风险边界：<手动平账审批/白名单/限额；Lark secret；polymarket_config 保留/迁移>
```

## G2 后文档动作

- 更新 `00-feature-inventory.md`：F01-F12 从“待 G2 确认”改为“做 / 不做 / 延期 / 后端主责”。
- 填写 `G2 确认人 & 日期`。
- 裁剪项写入 `Scope 裁剪记录` 和 `06-collaboration.md`。
- 将 `04-frontend-tasks.md` 的任务状态改为 G4 待开发或延期。
- YApi / 环境 / 权限继续更新时，同步 `03-api-contract.md` 和 `12-yapi-api-integration.md`；mock-first 只作为无环境 / 无权限时的兜底。
