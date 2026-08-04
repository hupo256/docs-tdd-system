# PR-01988 API 契约

> 状态：YApi project 459 已拉取 32 个接口；Admin mock-first 已保留，真实 API 模式已继续补齐事件列表、订单/仓位/收入、告警、手动平账映射。

## API 来源

| 来源 | 状态 | 链接 / 文件 |
|------|------|-------------|
| PRD | 已提供 | `inbox/【PR-01988】预测市场二期方案.md` |
| YApi / Swagger | 已提供 32 个接口 | `inbox/yapi/interface-details.md`、`inbox/yapi/interface-details.json`；对接说明见 `product/12-yapi-api-integration.md` |
| 后端样例响应 | 已提供 YApi 示例 | 原始 JSON 快照见 `inbox/yapi/*.json`；字段口径仍以真实联调响应为准 |
| 管理后台 HTML 原型 | 后补 | G2 确认先按 PRD 截图低保真实现 |

## 接口清单草案

| 模块 | 场景 | Method / Path | 前端需要 |
|------|------|---------------|----------|
| 数据埋点 | 前端埋点上报 | 待确认，或复用现有埋点 SDK | 点位名、公共字段、业务字段、成功/失败回调 |
| 每日收入统计 | 查询区间汇总、趋势、明细 | `POST /tradeDailyIncome/pageList`；`POST /tradeDailyIncome/summary` | 日期区间、三类收入、PM fee、Gas、订单数、成交额、毛利 |
| 每日收入统计 | CSV / Excel 导出 | `POST /tradeDailyIncome/export` | 当前筛选条件导出；响应类型和文件名规则待联调 |
| 通用参数 | 查询 / 更新三档 fee | `GET /polymarket/alert-config/get_1782211018309`；`POST /polymarket/alert-config/fee/update` | 买入费率、卖出费率、结算费率；YApi 路径当前在通用参数管理分类下 |
| 分类管理 | 分类树 / 按等级查询 | `GET /polymarket/category/tree`；`GET /polymarket/category/treeByLevelOneId`；`GET /polymarket/category/category/list?level=` | 一级/二级/三级、排序、多语言名称；按等级查询接口当前不返回多语言名称 |
| 分类管理 | 创建/修改/删除/排序 | 已给创建/保存/全量修改/一级删除；二/三级删除、排序和状态待补 | 英文必填、多语言兜底、删除二次确认 |
| 事件管理 | 按 ID/Slug 搜索 PM 事件 | `POST /polymarket/event/eventSync` | PM event/market 信息、GAME/EVENT 判别字段、多语言模板 |
| 事件管理 | 创建/修改事件 | `POST /polymarket/event/addEvent`；`POST /polymarket/event/updateEvent`；`GET /polymarket/event/viewEvent` | 名称多语言、分类、上线状态、交易开关 |
| 事件管理 | 列表 / 上线 / 下线 / 开关交易 | `POST /polymarket/event/findAdminByPage`；`POST /polymarket/event/updateEventStatus` | 行操作、二次确认、即时生效结果；列表查询已新增上线时间 / 结算时间范围筛选字段 |
| 订单管理 | 订单列表查询 | `POST /polymarket/order/pageList`；`POST /polymarket/order/stats` | 类型、状态、UID、订单ID、hash、时间区间、分页 |
| 订单管理 | CSV / Excel 导出 | `POST /polymarket/order/export` | 当前筛选条件导出；成功返回文件流，失败返回 JSON |
| 仓位管理 | 仓位列表查询 | `POST /polymarket/position/pageList` | 状态、UID、仓位ID、创建/更新时间区间、分页 |
| 仓位管理 | CSV / Excel 导出 | `POST /polymarket/position/export` | 当前筛选条件导出；成功返回文件流，失败返回 JSON |
| 手动平账 | 顶部统计 / 差异列表查询 | `GET /positionDiff/statistics`；`POST /positionDiff/pageList` | 未平事件数量、待平账差异额、今日已平数量、最近同步事件时间；差异列表含事件/方向、交易所持仓、链上持仓、差值、差异率、建议动作 |
| 手动平账 | 发起平账 | `POST /positionDiff/markBalanced` | 二次确认、执行状态；真实安全边界仍需权限/审计确认 |
| 手动平账 | 平账记录查询 / 导出 | `POST /positionDiff/balanceRecordPageList`；`POST /positionDiff/export` | 平账单ID、操作人、时间、结果 |
| 告警配置 | 查询 / 更新阈值 | `GET /polymarket/alert-config/get`；`POST /polymarket/alert-config/update_1782211023564` | 钱包余额、下单失败、持仓差异、Lark 配置状态；新版 YApi 更新路径带生成后缀，接入前需后端确认最终路径 |
| 告警配置 | 发送测试告警 | 当前不作为必做 | PRD 对该项存在删除线版本，YApi 未提供测试告警接口；如后端恢复需重新确认范围 |

## 关键字段草案

| 领域 | 字段 | 类型 / 精度 | 说明 |
|------|------|-------------|------|
| 公共埋点 | uid | string | 未登录为匿名 device_id |
| 公共埋点 | event_id / event_slug / market_id | string | Polymarket 标识 |
| 公共埋点 | direction | enum | yes / no |
| 公共埋点 | source | enum | web / app |
| 交易结果 | amount / shares | decimal string | 金额 / 份额，精度待确认 |
| 收入统计 | buy_markup_income | decimal string | 买入加价收入逐笔累加 |
| 收入统计 | sell_fee_income | decimal string | 卖出抽水收入逐笔累加，链上卖出 <= 1U 豁免 |
| 收入统计 | settlement_fee_income | decimal string | 结算抽水收入，盈利订单收取 |
| 收入统计 | pm_fee_actual | decimal string | 链上成交回执实际手续费，USDC，PRD 写 8 位/资料写 5 位，待确认 |
| 收入统计 | fee_tx_hash | string | 手续费所在成交哈希 |
| 收入统计 | gas | decimal string | POL 折算 USDT，预留 |
| 事件 | buy_rate / sell_rate / settlement_rate | decimal string | 三档 rate，事件级覆盖默认值 |
| 事件 | reconcile_min_share / diff_rate_threshold | decimal string | 对账最小份额阈值、差异率阈值 |
| 事件 | online_status / trade_status / settle_status | enum | 上线/下线/已结算，交易开启/关闭 |
| 订单 | order_id / hash | string | 一一对应，hash 跳转 Polygonscan |
| 订单 | order_type | enum | 买入 / 卖出 / 结算 |
| 订单 | order_status | enum | 成交中 / 成功 / 失败 / 结算中；失败订单需能核对退款状态 |
| 订单 | platform_income | decimal string | 按买入加价、卖出抽水、结算抽水归集的平台收入 |
| 订单 | shares / filled_at | decimal string / datetime | 链上返回份额、成交成功时间 |
| 仓位 | id / position_id | string | 仓位唯一标识，YApi 返回 `id` |
| 仓位 | betAmount / platformAmount | decimal number | 保证金为用户下注金额累加；平台收入按 position_id 汇总 |
| 仓位 | statusType | enum | YApi 返回 `holding` / `closed`；前端归并展示为持仓中 / 已平仓 |
| 仓位 | createdAt / updatedAt | datetime | YApi 同时返回格式化字符串和毫秒时间戳 |
| 平账 | reconcile_order_id | string | 非用户订单 |
| 平账 | exchange_position / chain_position / diff / diff_rate | decimal string | 差异列表核心字段，低于阈值不执行平账 |
| 平账 | suggested_action / order_price | enum / decimal string | 链上买入/卖出建议动作；买入取卖一价，卖出取买一价 |
| 平账 | execution_status | enum | 执行中 / 已完成 / 失败；FOK 未成交可重新发起 |
| 告警 | lark_webhook_enabled | boolean | 前端只展示开关 / 状态，真实密钥不能回显 |

## 当前前端 Mock Model（2026-06-17）

> 已落在 `apps/admin/src/types/prediction.ts`、`apps/admin/src/services/api/prediction.ts`、`apps/admin/src/services/api/prediction.mock.ts`；用于 mock-first UI，不代表最终后端 DTO。

| 模块 | 当前字段 | 说明 |
|------|----------|------|
| 通用搜索 | `keyword`, `status` | React Query mock hooks 已支持关键词和状态筛选；UI 已按页面定制状态选项，收入页不展示状态筛选；真实 API 需确认筛选字段名 |
| Mock 错误态 | `keyword=__error` | 任意 Admin mock 列表输入该关键词会抛出 mock API error，且 mock query 不重试，用于验证错误提示和 QA 失败场景 |
| 每日收入 | `date`, `market`, `totalIncome`, `buyMarkupIncome`, `sellFeeIncome`, `settlementFeeIncome`, `orderCount`, `buyOrderCount`, `sellOrderCount`, `settlementOrderCount`, `volume`, `pmFee`, `gas`, `grossProfit`, `netProfit` | `grossProfit` 按 G2 口径由后端返回；`pmFee` 精度待后端；趋势数据待真实 API |
| 分类 | `id`, `name`, `sort`, `status`, `secondLevelCount`, `thirdLevelCount`, `eventCount`, `updatedBy`, `updatedAt` | 当前为一级列表低保真，已保留新增 / 修改 / 删除二次确认外壳；YApi 已给列表 / 树 / 按等级查询 / 创建 / 保存 / 全量修改 / 一级删除，二三级删除、排序保存、启停状态和多语言响应细节仍待确认 |
| 事件 | `id`, `title`, `slug`, `category`, `secondCategory`, `thirdCategory`, `eventType`, `buyRate`, `sellRate`, `settlementRate`, `reconcileMinShare`, `diffRateThreshold`, `tradeEnabled`, `status`, `onlineAt`, `startAt`, `settleAt`, `liquidity`, `oracle` | `eventType` 暂用 `GAME` / `EVENT` 展示；已保留修改弹窗和下线二次确认外壳；YApi 已给 PM 搜索、列表、详情、新增、修改、状态更新，真实权限和用户侧禁用字段仍待联调 |
| 订单 | `orderId`, `uid`, `event`, `hash`, `side`, `type`, `price`, `amount`, `shares`, `platformIncome`, `status`, `createdAt`, `filledAt` | `hash` 已用于 Polygonscan 外链占位；状态 mock 为 `matching` / `success` / `failed` / `settling` |
| 仓位 | `positionId`, `uid`, `event`, `side`, `margin`, `shares`, `platformIncome`, `avgPrice`, `markPrice`, `pnl`, `status`, `createdAt`, `updatedAt` | YApi 已给列表低保真字段；`closed` 归并为现有已平仓展示，均价/标记价/盈亏暂无真实字段 |
| 平账 | `id`, `event`, `side`, `exchangePosition`, `chainPosition`, `diffAmount`, `diffRate`, `suggestedAction`, `orderPrice`, `status`, `auditor`, `hash`, `startedAt`, `completedAt`, `updatedAt` | 手动平账仅 mock-only 二次确认，不接真实 mutation；状态 mock 为 `pending` / `manual_required` / `running` / `completed` / `failed` |
| 告警 | `id`, `name`, `scene`, `monitorItem`, `threshold`, `level`, `action`, `frequency`, `larkWebhook`, `larkEnabled`, `mentionAll`, `status`, `updatedBy`, `updatedAt` | 已覆盖钱包余额、下单失败、持仓差异三类阈值；`larkWebhook` 只展示状态，secret 不回显；测试告警按 PRD 删除线口径不作为当前必做 |

## 待确认

1. 真实环境 base path、鉴权 header、跨环境代理规则。
2. 金额/份额/费率字段是 number 还是 string；统一精度和舍入规则。
3. PM 手续费精度：PRD 落库要求写 8 位，费用资料写 5 位小数。
4. 毛利字段是否由后端直接返回；是否扣 PM fee / Gas。
5. 多语言名称结构：全部语言列表、英文兜底策略、接口字段名。
6. 事件关闭交易后，用户侧接口返回错误码 / toast 文案 / 前端禁用态字段。
7. 手动平账是否需要审批流、权限码、操作白名单、最大份额限制。
8. Lark webhook 是否由前端保存；若保存，必须确认密钥脱敏、权限和审计方案。

## G3 最小交付物

进入开发前，至少需要后端 / 负责人提供以下内容之一：

| 类型 | 最低要求 | 用途 |
|------|----------|------|
| 正式接口文档 | base path、method、request、response、错误码、分页、导出方式 | 生成 service、schema、mapper |
| 样例响应 | 每个 Admin 模块正常 / 空态 / 错误态各 1 份 JSON | mock-first 与 UI 边界验证 |
| mock 授权 | 明确允许前端按本文契约先写 mock，并承诺后端字段兼容或后续联调调整 | 在无 YApi 时进入 G4 |
| 前端切换开关 | `NEXT_PUBLIC_PREDICTION_API_MODE=real` 时走真实 Admin API；默认 / 未配置走源码 mock fixture | 后端 API 未就绪时保持 mock-first，联调时一键切换 |

未满足以上任一项时，不写生产 API service，避免把猜测字段固化进代码。

## Mock 场景矩阵（已授权）

> G2 已明确允许 mock-first；mock fixture 放源码或 Admin mock API，不从 `docs_tdd` 运行时读取。

| 模块 | 正常态 | 空态 | 错误 / 边界态 | 权限 / 禁用态 |
|------|--------|------|---------------|---------------|
| 每日收入统计 | 近 7 日有三类收入、PM fee、Gas、毛利、订单数、成交额 | 所选区间无收入，KPI 为 0，趋势空柱或空态 | 自定义区间跨月、开始晚于结束、导出失败、金额超大精度 | 无导出权限隐藏/禁用导出 |
| 分类管理 | 一级、二级、三级均有数据，可排序 | 无分类，展示新增入口 | 英文名缺失、重复分类名、删除含子级分类、排序保存失败 | 无新增/编辑/删除权限时隐藏操作 |
| 事件管理 | 搜索 PM 事件成功，创建后列表展示，支持上线/下线和交易开关 | 无事件或 PM 搜索无结果 | PM API 超时、slug 不存在、rate 超限、阈值非法、已结算事件不可编辑 | 无修改权限隐藏行操作；交易关闭展示不可买卖状态 |
| 订单管理 | 买入/卖出/结算订单混合，hash 可跳 Polygonscan，支持导出 | 无订单 | UID/订单ID/hash 不存在、失败订单退款状态、导出失败、长事件名 | 无导出权限隐藏导出 |
| 仓位管理 | 持仓、加仓、平仓、结算状态混合，金额和份额正常 | 无仓位 | 仓位状态未知、份额为 0、超大金额、最后更新时间缺失 | 无导出权限隐藏导出 |
| 手动平账 | 差异列表有建议动作，二次确认后生成平账记录 | 无差异，提示无需平账 | 差异率超过阈值、FOK 失败、hash 返回慢、重复提交、超出最大份额 | 无平账权限禁用按钮；审批/白名单未满足不允许提交 |
| 告警配置 | 阈值读取成功，可保存；Lark webhook 只展示配置 / 脱敏状态 | 未配置 Lark，仅展示未启用状态 | 阈值非法、保存失败、secret 不回显 | 无编辑权限只读；测试告警接口未提供且 PRD 删除线标记，当前不作为必做 |
| Web 用户侧埋点 / 禁用态 | 列表曝光、事件点击、买入/卖出提交与结果、FAQ 点击可触发 | 未登录 device_id 上报；无事件列表不上报曝光 | 埋点 SDK 不可用、下单失败、交易关闭接口错误码 | 交易关闭时买卖按钮禁用或后端 toast，按 G2/API 确认 |

## Mock 字段假设（非最终 API）

| 领域 | UI Model 字段 | 假设类型 | 待确认点 |
|------|---------------|----------|----------|
| 分页 | `page`, `pageSize`, `total`, `list` | number / array | 后端分页字段命名和是否 1-based |
| 金额 | `amount`, `income`, `fee`, `gas`, `grossProfit` | decimal string | 是否统一 string、精度、舍入、币种 |
| 比率 | `buyRate`, `sellRate`, `settlementRate`, `diffRate` | decimal string | 返回小数还是百分比；展示保留位数 |
| 时间 | `createdAt`, `updatedAt`, `settledAt` | timestamp ms 或 ISO string | 时区是否 UTC+8；前端是否格式化 |
| 状态 | `status`, `tradeStatus`, `onlineStatus` | enum string | 枚举值、未知状态兜底文案 |
| 多语言 | `nameI18n: Record<string,string>` | object | 语言列表、英文必填、中文兜底策略 |
| 导出 | `downloadUrl` 或 file stream | string / blob | 导出接口返回方式和文件名规则 |
| 敏感配置 | `larkWebhookEnabled`, `webhookMasked` | boolean / string | secret 是否永不回显，是否允许前端提交 |

## Mock-first 准入条件

- G2 scope 已确认，`00-feature-inventory.md` 不再有「待 G2 确认」。
- 负责人已明确允许按本契约 mock-first；后端样例响应后续联调时补齐。
- 高风险 mutation（手动平账、Lark webhook、私钥配置迁移）即便 mock-first，也不得接真实接口，直到权限和安全边界确认。
- mock 字段必须集中在 mapper/schema 层，UI 不直接消费临时 DTO，便于后续替换真实 API。

## 2026-06-25 YApi 增量拉取更新

- 已登录 YApi project 459 并拉取 32 个接口，快照已覆盖到 `inbox/yapi/list-menu.json`、`inbox/yapi/interface-details.json`、`inbox/yapi/interface-details.md`；本次差异见 `inbox/yapi/diff-summary-2026-06-25.json`。
- 本次新增 1 个接口：`GET /polymarket/category/category/list?level=`（按等级查询分类列表，YApi ID 5245）。
- 本次无接口删除 / 变更。
- 前端接入注意：该接口按 `level=1/2/3` 返回指定层级分类，响应含 `id`、`parentId`、`pathIds`、`level`、`code`、`sort`、`status`、`createTime`、`updateTime`；当前不返回多语言名称和子级数量，分类主列表仍优先使用 `pageList`。

## 2026-06-24 YApi 增量拉取更新

- 已登录 YApi project 459 并拉取 31 个接口；该记录为历史增量，当前权威状态见上方 2026-06-25 的 32 个接口记录。历史新增差异见 `inbox/yapi/diff-summary-2026-06-24.json`，字段差异见 `inbox/yapi/diff-summary-2026-06-24-latest.json`。
- 历史新增 2 个接口：`GET /polymarket/category/delete?id=`（一级分类删除）、`POST /tradeDailyIncome/export`（每日收入导出）。
- 本轮无接口新增 / 删除；`POST /polymarket/event/findAdminByPage` 新增 4 个请求筛选字段：`startDateNum`、`endDateNum`、`settleStartDateNum`、`settleEndDateNum`。
- 前端接入注意：分类删除响应 schema 为空，需确认有关联事件 / 子级分类时的错误码；每日收入导出未写响应类型，建议按订单 / 仓位导出的文件流方式联调；事件列表新增时间筛选字段示例为毫秒时间戳，接入前需确认单位和时区。

## 2026-06-23 YApi 增量拉取更新（历史记录）

- 已登录 YApi project 459 并拉取阶段性快照；该记录为历史增量，当前权威状态见上方 2026-06-24 的 31 个接口记录。
- 本次新增/确认接口：`GET /polymarket/alert-config/get_1782211018309`（通用参数查询）、`POST /polymarket/alert-config/update_1782211023564`（预警配置新版更新）、`GET /positionDiff/statistics`（持仓差异顶部统计）。
- 本次无删除 / 变更：YApi ID `4618` 从预警配置更新调整为 `POST /polymarket/alert-config/fee/update`，用于通用参数 buy/sell/settlement fee 更新。
- 前端接入注意：两个新增 alert-config 路径带时间戳后缀，接入真实代码前需要后端确认是否为临时生成路径还是最终稳定路径。

## 2026-06-22 YApi 全量拉取更新

- 已登录 YApi project 459 并拉取 26 个接口，快照已覆盖到 `inbox/yapi/list-menu.json`、`inbox/yapi/interface-details.json`、`inbox/yapi/interface-details.md`；该记录为 2026-06-22 历史快照，当前权威状态见上方 2026-06-24 的 31 个接口记录。
- 新增/确认手动平账接口：`POST /positionDiff/pageList`、`POST /positionDiff/balanceRecordPageList`、`POST /positionDiff/markBalanced`、`POST /positionDiff/export`。
- 事件管理接口已补齐：`eventSync`、`addEvent`、`updateEvent`、`viewEvent`、`findAdminByPage`、`updateEventStatus`。
- 前端真实模式继续使用 `NEXT_PUBLIC_PREDICTION_API_MODE=real`，默认 mock；`NEXT_PUBLIC_PREDICTION_API_PREFIX` 默认 `/operate-api`。
