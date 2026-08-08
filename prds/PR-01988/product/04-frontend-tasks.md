# PR-01988 前端任务

> 状态：G2 已确认，允许 mock-first 进入 G4；真实 API / 高风险 mutation 仍需后续联调确认。

## G0-G2 文档任务

- [x] 创建 `PR-01988` 项目目录。
- [x] 读取 PRD：`inbox/【PR-01988】预测市场二期方案.md`。
- [x] 从 PRD 正文和上线验收抽出功能清单初稿。
- [x] 对照当时可用的一期基线资料；历史本地基线目录现已移除，不再作为当前文档依赖。
- [x] 初查 Admin 路由、菜单、权限和现有列表页模式。
- [x] 修正一期 Prediction 代码基线：已确认 Web 预测市场路径和 legacy Polymarket 配置页。
- [x] 补充 Admin 复用锚点：`ThirdPartyOrders`、`ThirdPartySummary`、`ThirdPartyRisk`、`MerchantReversalForm`。
- [x] 获取 YApi project 459 接口快照：当前 32 个接口，详见 `inbox/yapi/` 与 `12-yapi-api-integration.md`；mock-first 保留为兜底。
- [x] 原型按 PRD 截图低保真实现；HTML / Figma 后续如有再补。
- [x] G2 已确认每条功能做 / 不做 / 后端主责。
- [x] 补充 mock 场景矩阵和 mock-first 准入条件。
- [x] 补充 G6/G7 验收清单和证据矩阵。
- [x] 补充 G2 后实施计划、文件落点和高风险安全闸口。
- [x] 补充进入开发前最小输入清单和回复模板。

## G3-G6 实现任务草案

| ID | 任务 | 状态 | 对应功能 |
|----|------|------|----------|
| T01 | 接入 Web 用户侧预测市场埋点：列表曝光、事件点击、买入/卖出提交与结果、FAQ 点击 | 待输入：当前 worktree 未找到一期 Prediction 路径，需确认代码来源或新落点 | F01 |
| T02 | 与后端确认服务端埋点结果字段，前端联调买入/卖出结果和结算验收 | 待联调 | F02 |
| T03 | 新增 Admin 每日收入统计页：筛选、KPI、趋势、明细、导出 | 进行中：mock-first 已补 KPI、三类收入、订单数、成交额、PM fee、Gas、毛利、净利润；YApi 已给列表 / summary / 导出，导出响应类型和文件名仍待联调 | F03 |
| T04 | 实现收入/成本/毛利 formatter 与口径说明，补纯函数测试 | 进行中：毛利由后端返回；PM fee、金额、份额、rate 的类型 / 精度 / 舍入规则仍待联调确认 | F04 |
| T05 | 新增 Admin 分类管理页：分类树、多语言弹窗、排序、删除确认 | 进行中：mock-first 已补一级列表、二/三级数量、新增 / 修改弹窗和删除二次确认；YApi 已给列表 / 树 / 创建 / 保存 / 全量修改 / 一级删除，二三级删除 / 排序 / 启停仍待补 | F05 |
| T06 | 新增 Admin 事件管理页：搜索 PM 事件、创建/修改、上线/下线、交易开关、rate 与阈值 | 进行中：mock-first 已补 PM slug、多级分类、三档 rate、对账阈值、上线时间、交易开关、修改弹窗和下线确认；YApi 已给事件同步 / 新增 / 修改 / 详情 / 列表 / 状态更新，本轮列表接口新增上线时间 / 结算时间范围筛选字段；用户侧禁用字段、时间单位/时区和真实 mutation 权限仍待联调 | F06 |
| T07 | 对接事件交易关闭状态：用户侧禁用或错误提示联调 | 待输入：Web 代码来源 / API 字段 / 错误码确认后开发 | F07 |
| T08 | 新增 Admin 订单管理页：搜索表单、表格、hash 跳转、导出 | 进行中：mock-first 已补订单类型、份额、平台收入、成交时间、成功/失败/成交中/结算中状态；YApi 已给列表 / 统计 / 导出，失败退款字段、导出文件名和错误枚举仍待确认 | F08 |
| T09 | 新增 Admin 仓位管理页：搜索表单、表格、导出 | 进行中：mock-first 已补仓位ID、保证金、平台收入、创建时间、状态筛选；YApi 已给列表 / 导出，方向、均价、标记价、盈亏和导出文件名仍待确认 | F09 |
| T10 | 新增 Admin 手动平账页：差异列表、平账确认弹窗、记录列表、导出 | 进行中：mock-first 已补事件方向、交易所/链上持仓、差值、差异率、建议动作、挂单价格、平账记录字段；真实 mutation 待安全确认 | F10 |
| T11 | 新增 Admin 告警配置页：阈值表单、Lark 配置状态 | 进行中：mock-first 已补钱包余额、下单失败、持仓差异三类阈值、级别、处理方式、监控频率、Lark 开关并保持 secret 不回显；PRD 删除线里的测试告警不作为当前必做，YApi 已给查询 / 新版更新，路径稳定性与 secret 提交策略仍待确认 | F11 |
| T12 | 新增 Admin 路由、菜单、权限、legacy redirect（如需要）和 zh-CN 文案 | 已完成：独立 `预测市场` 菜单组、`/prediction/...` 路由、占位权限码、legacy language redirect、zh-CN 文案；正式 permission code 待后端补齐 | F03-F11 |
| T13 | 建立 mock 场景矩阵和 API mapper/schema | 已完成当前阶段：已建立 Admin 类型、React Query hooks、关键词/状态筛选、统一空态、`__error` 错误态、mock fixture、DTO mapper，并预留 `NEXT_PUBLIC_PREDICTION_API_MODE=real` 切真实 API；真实字段按 YApi 32 个接口继续联调 | F03-F11 |
| T14 | 自测：Biome、typecheck、核心纯函数测试、Admin 页面桌面验证 | 进行中：Biome 已通过；typecheck 受 worktree 依赖缺失阻塞；浏览器自测待 dev server | F03-F11 |

## 验证任务

| 类型 | 状态 | 说明 |
|------|------|------|
| Biome | 已执行 | 使用主仓已安装 Biome：`/Users/aven/github/fameex-web/node_modules/.bin/biome check --write --no-errors-on-unmatched <touched files>` |
| Typecheck | 受环境阻塞 | 已复用主仓 `node_modules` 软链重跑，仍因 Admin workspace 依赖解析/既有类型问题失败；未发现 prediction 文件专属 typecheck 输出 |
| 单测 | 待实现后评估 | 金额、费率、毛利、状态 mapper 优先补纯函数测试 |
| Browser / Playwright | 部分完成 | Admin dev server 已启动；7 个 `/zh-CN/prediction/**` 路由 HTTP smoke 均 200。Playwright 包未安装，未做自动截图 |
| QA 用例 | 待提供 | 未提供时 G7 记录跳过 |

> 详细验收矩阵见 [`09-acceptance-checklist.md`](./09-acceptance-checklist.md)。
> G2 后实施顺序见 [`10-implementation-plan.md`](./10-implementation-plan.md)。
> 最小待补信息见 [`11-needed-inputs.md`](./11-needed-inputs.md)。
