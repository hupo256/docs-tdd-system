# PR-01988 Needed Inputs

> 状态：N01-N05 已确认；YApi 32 个接口已拉取且接口联调已完成。N06-N17 后续 QA 验收 / Web 开发前补齐。

## 立即必填

| ID | 需要提供 / 确认 | 推荐默认值 | 没有会怎样 |
|----|-----------------|------------|------------|
| N01 | G2 确认人和日期 | aven / 2026-06-17 | 已确认 |
| N02 | F01-F12 做 / 不做 / 延期 | F01 Web 做、App 另端；F02 后端主责前端联调；F03-F12 做；F13 不做 | 已确认 |
| N03 | API 或 mock-first 授权 | YApi project 459 已提供 32 个接口；mock-first 保留兜底 | 已确认；用户反馈接口已联调完成 |
| N04 | Admin 菜单分组、route、permission code、legacy redirect | 预测市场独立菜单组；route 用 `/prediction/...`；权限码后端补 | 已确认 |
| N05 | 手动平账安全边界 | 独立权限 + 二次确认 + 操作审计；真实 mutation 等后端确认 | 已确认 |

## 可后补但会影响联调

| ID | 需要提供 / 确认 | 推荐默认值 | 影响 |
|----|-----------------|------------|------|
| N06 | HTML 原型 / Figma node / 截图原图 | 若无，按 PRD 截图 + 现有 Admin 风格低保真实现 | UI 细节可能后续返工 |
| N07 | 收入统计毛利口径、PM fee 精度 | 后端直接返回展示字段；前端不自行算账 | formatter、验收抽样、测试用例 |
| N08 | Lark webhook secret 处理 | 前端只展示开关/脱敏状态，secret 不回显 | 告警配置安全边界 |
| N09 | legacy `/polymarket_config` 保留还是迁移 | 默认保留 legacy，不纳入本期迁移 | 菜单和敏感配置范围 |
| N10 | QA 用例、测试账号、联调环境 | QA Lark 链接已提供；测试账号 / 联调环境按接口联调完成处理 | QA 链接正文暂未读到，影响验收用例拆解和证据矩阵 |
| N11 | Web F01/F07 一期 Prediction 代码来源或新实现落点 | 当前 worktree 未找到 `apps/web/src/apps/Prediction/**`，需确认分支/路径；若无则从当前结构新建 | 阻塞 Web 埋点和交易关闭禁用态开发 |
| N12 | 订单 / 仓位 / 平账状态枚举和字段命名 | 先按 RDP 中文枚举 mock；真实 API 到位后 mapper 适配 | 影响状态筛选、表格列、验收用例 |
| N13 | Polygonscan 环境与 hash 链接规则 | 默认 `https://polygonscan.com/tx/{hash}` | 影响订单 / 平账 hash 外链 |
| N14 | 手动平账限额和可重试规则 | 独立权限 + 二次确认 + 审计；FOK 失败允许重新发起 | 影响按钮禁用、确认弹窗、失败态 |
| N15 | 收入导出、PM fee 精度、金额 / 份额 / rate 类型和错误码 | 趋势按自然日返回；导出按当前筛选生成 CSV / Excel | 影响收入趋势图、真实导出、formatter 和验收证据 |
| N16 | 分类删除 / 排序 / 启停、分类树拖拽、多语言字段和删除校验 | 英文必填，未配置语言回退英文；删除前校验子级和关联事件 | 影响分类编辑弹窗和 mutation 接入 |
| N17 | 事件 PM 搜索、分类级联、上下线 / 交易开关 mutation、用户侧禁用字段 | 后端返回 PM event/market/tags 和 GAME/EVENT 判别字段 | 影响事件添加、修改、下线和用户侧禁用态 |
| N18 | YApi 带时间戳后缀路径是否稳定 | `alert-config/get_1782211018309`、`alert-config/update_1782211023564` 需确认最终 path | 影响通用参数和告警配置是否可固化真实路径 |
| N19 | Admin 测试账号权限和 permission code | 提供已有权限账号，或给测试账号分配预测市场菜单 / 按钮权限 | 当前真实接口可到后端，但页面级联调受权限阻断 |
| N20 | 事件列表新增时间筛选字段单位 / 时区 | `startDateNum`、`endDateNum`、`settleStartDateNum`、`settleEndDateNum` 按毫秒时间戳、UTC+0 或后端约定时区传参 | 影响事件管理上线时间 / 结算时间筛选真实联调 |
| N21 | 按等级查询分类列表是否补多语言名称 / 子级数量 | `GET /polymarket/category/category/list?level=` 当前只返回 `id`、`parentId`、`pathIds`、`level`、`code`、`sort`、`status`、时间字段 | 影响分类弹窗、级联选择是否能直接用该接口展示中文名和数量 |
| N22 | QA 测试用例正文导出或 Lark CLI 授权 | 提供 Markdown / Excel / PDF 导出稿，或完成 `lark-cli config init --new` 授权 | 影响 G6/G7 测试用例拆解、执行记录和验收证据闭环 |

## 可直接回复模板

```text
G2 确认人：<姓名>
日期：2026-06-17

scope：按 08-g2-scope-review.md 默认建议
API：YApi project 459 已提供 32 个接口；mock-first 保留兜底；接口联调已完成
原型：按 PRD 截图低保真实现 / 或 Figma: <链接>
菜单权限：预测市场独立菜单组，route 用 /prediction/...，permission code 后端补
财务口径：毛利由后端返回，PM fee 精度 <8位/5位/待后端>
安全边界：手动平账独立权限 + 二次确认 + 审计；Lark secret 不回显；polymarket_config 保留 legacy
```

## 已收到回复后的动作

1. 更新 `00-feature-inventory.md`：F01-F12 改为做 / 后端主责 / 延期 / 不做，填 G2 确认人和日期。
2. 更新 `04-frontend-tasks.md`：将确认范围内任务从“待 G2”改为“待 G4”。
3. 更新 `06-collaboration.md`：记录确认结论、裁剪项和风险接受项。
4. 若 YApi / 环境 / 权限继续更新，先同步 `03-api-contract.md` 和 `12-yapi-api-integration.md`，再按 `10-implementation-plan.md` 进入真实联调；当前接口联调已完成，本轮新增 N22 跟踪 QA 用例正文导出或 Lark CLI 授权。
