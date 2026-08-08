# PR-01988 Acceptance Checklist

> 状态：G4 Admin UI/UX 已完成；G5 已拉取 YApi 32 个接口并补齐 real-mode 主要映射，接口联调已完成。QA MindNote 已转为可执行自测用例，当前进入 G6/G7 回归执行和验收证据收口。

## 模块验收矩阵

| ID | 模块 | 验收检查 | 证据 | 阻塞项 |
|----|------|----------|------|--------|
| A01 | 数据埋点 | Web 列表曝光、事件点击、买入提交、买入结果、卖出提交、卖出结果、FAQ 点击均可上报 | 埋点日志 / Network / 数据平台截图 | 埋点 SDK、字段口径、App 责任边界 |
| A02 | 服务端埋点 | 买入/卖出结果事件与订单一致；结算事件含 `win_loss` 和 `amount` | 后端日志 / 数据平台抽样 | 后端接口和数据平台口径 |
| A03 | 每日收入统计 | 近 7/15/30 日和自定义区间可查询；三类收入、PM fee、Gas、毛利展示正确 | 页面截图 + 账务抽样 | API、毛利口径、PM fee 精度 |
| A04 | 每日收入导出 | 导出文件按当前筛选条件生成，列与页面一致 | CSV 文件 + 筛选条件截图 | 导出接口和文件名规则 |
| A05 | 分类管理 | 一级/二级/三级分类可增改删、排序；英文必填，多语言兜底正确 | 操作录屏 / 截图 | 本期是否做、分类 API |
| A06 | 事件管理 | 可按 ID/Slug 添加 PM 事件，配置分类、三档 rate、阈值、上线/下线、交易开关 | 页面截图 + API 结果 | PM 搜索 API、字段枚举 |
| A07 | 用户侧交易关闭 | 后台关闭交易后，Web 买入/卖出不可继续或展示后端 toast | Web 页面截图 / Network | 是否前端禁用、错误码文案 |
| A08 | 订单管理 | 可按类型、状态、UID、订单ID、hash、时间检索；hash 可跳 Polygonscan；支持导出 | 页面截图 + 导出文件 | 订单 API、Polygonscan 链接规则 |
| A09 | 仓位管理 | 建仓、加仓、平仓、结算状态、保证金、份额、最后更新时间展示正确 | 页面截图 + 后端抽样 | 仓位 API、状态枚举 |
| A10 | 手动平账 | 差异列表展示清楚；FOK 平账有二次确认；记录含操作人、时间、hash、状态 | 操作录屏 / 平账记录 | 权限、审批、白名单、最大份额限制 |
| A11 | 告警配置 | 阈值可读写；Lark webhook 只展示配置状态 / 脱敏状态；持仓差异告警字段完整 | 页面截图 + Lark 截图 | webhook secret、安全边界；PRD 删除线中的测试告警不作为当前必做 |
| A12 | 自动对账观察 | 连续 3 个自动对账周期差异率 < 0.1% | 后端 / 运维观测记录 | 联调环境、对账任务 |
| A13 | 资金精度 | 买入冻结、失败退回、卖出/结算入账与公式一致；精度 8 位末位舍弃 | 账务抽样记录 | 财务口径、后端结算数据 |
| A14 | 性能 | 后台列表检索 P95 < 2s，大数据分页正常 | Network timing / 后端监控 | 测试数据量、环境 |

## G6 自测清单

## Admin Mock-first 自测矩阵

| 范围 | 当前可验证 | 仍待 API / 环境 |
|------|------------|-----------------|
| 路由 / 菜单 | `/prediction/**` 薄路由、独立菜单组、zh-CN title/sider、legacy language redirect | 后端正式 permission code、测试账号权限 |
| 收入统计 | KPI、三类收入、订单数、成交额、PM fee、Gas、毛利、净利润、导出 mock 反馈、空态 / 错误态 | 趋势图数据、真实导出、账务抽样 |
| 分类管理 | 一级列表、二/三级数量、新增 / 修改弹窗、删除二次确认、空态 / 错误态 | 分类树、拖拽排序、多语言 DTO、删除校验和 mutation |
| 事件管理 | PM slug、多级分类、三档 rate、对账阈值、上线时间、交易开关、修改弹窗、下线确认 | PM 搜索 API、分类级联、上下线 / 交易开关 mutation、Web 禁用态 |
| 订单 / 仓位 | RDP 表格字段、状态筛选、hash 外链、导出 mock 反馈、空态 / 错误态 | 真实分页、真实导出、状态枚举、Polygonscan 环境 |
| 手动平账 | 差异列表、建议动作、挂单价格、二次确认、审计字段；real-mode 已预接 `positionDiff` 列表 / 记录 / 导出 / 平账提交 | 独立权限、限额、白名单、FOK 执行、真实环境结果 |
| 告警配置 | 三类阈值、级别、处理方式、监控频率、Lark 开关、secret 不回显 | Lark 测试群、真实保存 / 发送、审计；测试告警接口未提供且 PRD 删除线标记，不作为当前验收必做 |
| Mock 场景 | 关键词 / 状态筛选、统一空态、`keyword=__error` 失败态且不重试 | 真实错误码、后端空态 / 异常样例 |

| 类型 | 范围 | 命令 / 证据 | 状态 |
|------|------|-------------|------|
| Biome | 触达的 JS / TS / JSON 文件 | `pnpm exec biome check --write --no-errors-on-unmatched <touched files>` | 已通过（2026-06-21，7 个 PR-01988 touched 文件，无自动修复） |
| Typecheck | Admin 改动 | `pnpm --filter @fameex/admin exec tsc --project ./tsconfig.json --noEmit --pretty false` | 全量退出 1；筛选确认无 PR-01988 相关诊断，日志见 `/private/tmp/pr01988-admin-tsc.log` |
| Typecheck | Web 用户侧改动时 | `pnpm --filter @fameex/web typecheck` | 待确认是否改 Web |
| 单测 | mapper、formatter、金额/费率/状态纯函数 | Vitest 相关用例 | 待实现 |
| 浏览器自测 | Admin 桌面页面 | 截图或录屏 | UI 和接口联调已完成；按 `14-self-test-cases.md` 补真实数据状态截图 / 报告 |
| 浏览器自测 | Web 用户侧埋点 / 禁用态 | 桌面 + 390px，按实际影响决定 | 待确认是否改 Web |
| 导出验证 | 收入、订单、仓位、平账记录 | CSV / Excel 文件和筛选条件截图 | 接口联调已完成；待按 QA 用例补导出文件和筛选条件证据 |
| 高风险操作 | 手动平账、下线、关闭交易、分类 / 事件变更、告警配置保存 | 二次确认和失败态证据 | 接口联调已完成；G7 仍需保留独立权限、二次确认、审计和失败态证据 |

## G7 QA / 联调资料需求

| 资料 | 用途 | 状态 |
|------|------|------|
| Admin 测试账号和权限码 | 菜单、按钮权限、无权限态验证 | 接口联调已完成；若 QA 回归需复测无权限态，再补账号 / 截图 |
| 后端联调环境 | API、导出、mutation、对账观察 | 接口联调已完成；G7 补证据即可 |
| 数据平台或埋点日志入口 | 验证 polymarket_* 点位 | 待提供 |
| Lark 测试群或测试 webhook | 验证真实告警可达；如后端后续恢复测试告警接口，再补连通性证据 | 接口联调已完成；如 QA 用例覆盖告警可达性，再补脱敏截图 |
| Polymarket 测试事件 ID / slug | 事件添加、GAME/EVENT 判别 | 待提供 |
| 可平账差异样本 | 手动平账和记录验证 | 待提供 |
| 账务抽样数据 | 收入统计、资金精度、退款核对 | 待提供 |

## 验收风险

- 接口联调已完成后，验收重点从“接口是否可通”转为“QA 用例是否覆盖、证据是否完整、数据是否可追溯”。
- 手动平账、Lark webhook、Polymarket 私钥配置属于高风险项，必须用测试环境和脱敏截图做证据。
- 若 F05 分类管理被 G2 裁剪，需同步删改 A05 以及事件管理中的分类验收。
- 若 Web 用户侧不在本期，需同步调整 A01/A07 的责任边界和验收证据。

## 2026-06-22 验收状态更新

| 项 | 状态 | 说明 |
|----|------|------|
| Admin mock-first 功能 | 已完成 | 核心页面、菜单、路由、mock hooks、空态、错误态、导出反馈已落地 |
| UI/UX 收口 | 已完成 | 页面说明 / 解释 / mock 提示型组件已移除；当前 UI 已确认完成 |
| Biome | 通过 | 2026-06-21 对 7 个 PR-01988 touched 文件执行，通过且无自动修复 |
| TypeScript | PR 范围通过，仓库全量未通过 | Admin 全量 TS 退出 1，错误为既有无关路径；PR-01988 筛选无诊断 |
| Commit | 已提交 | `b9f615195 feat: PR-01988 prediction admin UI` |
| 联调 | 已完成 | 用户确认接口已联调完成；后续按 QA 用例补真实数据、导出、mutation 和安全链路验收证据 |

## 2026-06-22 UI 完成确认

| 项 | 状态 | 说明 |
|----|------|------|
| UI/UX | 已完成 | 后台页面视觉与交互细节已确认，可进入接口联调阶段 |
| 验收证据 | QA 后补 | mock UI 和接口联调阶段不再阻塞；QA 正文可读后补真实数据截图、Network / 导出 / mutation 证据 |
| 下一阶段 | 等待 QA 正文 | 优先同步测试用例正文，按用例执行回归并补充证据矩阵 |

## 2026-06-22 YApi / real-mode 预接入自测

| 项 | 状态 | 说明 |
|----|------|------|
| YApi 拉取 | 已完成 | 已登录 project 459 并拉取 32 个接口；快照见 `inbox/yapi/list-menu.json`、`inbox/yapi/interface-details.json`、`inbox/yapi/interface-details.md`，最新增量见 `inbox/yapi/diff-summary-2026-06-25.json`；历史增量见 `inbox/yapi/diff-summary-2026-06-24.json` |
| 文档同步 | 已完成 | `03-api-contract.md` 和 `12-yapi-api-integration.md` 已记录新增事件、手动平账、导出与切换开关 |
| Mock 数据 | 已覆盖 | 现有 Admin fixture 覆盖收入、分类、事件、订单、仓位、手动平账、告警和空态 / 错误态；继续作为默认模式 |
| real-mode 开关 | 已保留 | `NEXT_PUBLIC_PREDICTION_API_MODE=real` 走真实接口；`NEXT_PUBLIC_PREDICTION_API_PREFIX` 默认 `/operate-api` |
| 本轮 Biome | 通过 | `pnpm exec biome check --write --no-errors-on-unmatched apps/admin/src/services/api/prediction.ts apps/admin/src/types/prediction.ts apps/admin/src/apps/PredictionMarket/reconciliation/index.tsx`，通过且无自动修复 |
| 本轮 TypeScript | PR 范围通过，仓库全量未通过 | `pnpm --filter @fameex/admin exec tsc --project ./tsconfig.json --noEmit --pretty false` 退出 1；日志 `/private/tmp/pr01988-yapi-admin-tsc.log`，筛选无 PR-01988 相关诊断，剩余为既有无关路径 |
| 浏览器 / 真实接口 | 后续已完成联调 | 早期记录显示当时缺真实 Admin 环境和 permission code；当前用户已确认接口联调完成，下一步改为按 QA 用例补真实数据截图、Network、导出文件和平账提交证据 |

## 2026-06-24 dev real API local 联调记录

| 项 | 状态 | 说明 |
|----|------|------|
| 本地服务 | 已启动 | `/Users/aven/github/PR-01988` worktree 通过 `next dev --port 3001` 启动 Admin，本地 env 已设置 `NEXT_PUBLIC_PREDICTION_API_MODE=real` |
| 网关路径 | 已修正 | 新 Admin 登录接口需走 `/operate-api/v1/member/login-before` 和 `/operate-api/v1/member/login`，否则会命中 Next 站点 404 |
| 测试账号 | 被权限阻断 | `aven2@qq.com / test123456` 能打到后端，但登录和预测接口返回 `106102 暂无权限，请先联系超级管理员分配角色权限` |
| 预测接口 | 到达后端 | `/operate-api/polymarket/event/findAdminByPage`、`tradeDailyIncome`、`order`、`position`、`positionDiff` 等接口均返回后端业务响应，不再是网络或路径错误 |
| 本轮 Biome | 通过 | `pnpm exec biome check --write --no-errors-on-unmatched apps/admin/src/services/api/member.ts apps/admin/src/services/api/prediction.ts apps/admin/src/types/prediction.ts apps/admin/src/apps/PredictionMarket/reconciliation/index.tsx`，通过并自动修复 1 个文件 |
| 本轮 TypeScript | PR 范围通过，仓库全量未通过 | `pnpm --filter @fameex/admin exec tsc --project ./tsconfig.json --noEmit --pretty false` 退出 1；日志 `/private/tmp/pr01988-real-admin-tsc.log`，筛选无 PR-01988 相关诊断 |
| 后续阻塞 | 已解除 | 当前用户已确认接口联调完成；该权限阻塞记录保留为历史背景，后续阻塞改为 QA 用例正文暂不可读 |


## 2026-06-25 QA 用例同步记录

| 项 | 状态 | 说明 |
|----|------|------|
| 测试用例来源 | 已提供链接 | `https://qfglxo2m3dc.sg.larksuite.com/docx/NiHVdQGgUohh20xRJmOlmo0rgAg` |
| FreeMind 导出 | 已读取 | `inbox/lark-qa/PR-01988预测市场二期测试用例.mm` |
| 自测用例生成 | 已完成 | `product/14-self-test-cases.md`，共 164 条，按模块、优先级、步骤、预期、执行结果和证据列组织 |
| 下一步 | 执行回填 | 按 `14-self-test-cases.md` 执行 G6/G7 自测，补结果、证据和失败 / 阻塞备注 |

## 当前验收推进口径

- 接口联调已按用户最新反馈视为完成，文档状态从“等待真实接口 / 权限联调”更新为“按 QA 自测用例执行 G6/G7 验收”。
- QA MindNote 已通过 FreeMind 导出读取，后续执行依据是 `product/14-self-test-cases.md`，不是摘要。
- 执行后需在自测用例表中逐条回填通过 / 失败 / 阻塞 / 不适用、证据路径和问题备注。
