<!-- template-version: 1 -->
<!-- template-effective-since: 2026-07-23 -->

# 03 — API 契约

> **模板**：`templates/03-api-contract-template.md`
> **配套规则**：
> - 单一来源字段默认贴合契约、仅两类改名例外：[api-and-mapper.md](../../common/api-and-mapper.md) §2
> - 文案像接口 contract 一样管理：[architecture-and-state.md](../../common/architecture-and-state.md) §7.1
> - 真实接口到位后的字段对账关卡：[architecture-and-state.md](../../common/architecture-and-state.md) §8.1
> - 新功能 mock 强制 MSW 路线 B：[architecture-and-state.md](../../common/architecture-and-state.md) §8.4.1
> **使用**：G1 复制到项目 `product/03-api-contract.md`；G3 补 Mock 场景和文案契约；G5 联调时逐行更新 §5 字段对账并做减法。

## 0. 元信息

| 字段 | 值 |
|------|-----|
| 项目 | `PR-02265` |
| 契约来源 | **复用现状接口**（添加/编辑外部做市商、做市账户查询、前台/后台资金流水与成交记录）；无新增接口。YApi 分类链接待补（G4 复用盘点从现有 service/schema 代码反查） |
| 契约变化 | **仅字段值域**：手续费率相关字段由 `[0,100]` 放开为 `[-100,100]`（精度 6 位不变）。DTO 结构不变 |
| 前端 service 目录 | 复用现状做市账户 / 合约流水 domain（`apps/web/src/services/api/<现状 domain>/`，G4 定位） |
| Mock 路线 | MSW 路线 B；handler：`apps/web/src/mocks/handlers/<feature>.ts`（用**负值 fixture** 在后端放开前先测负值渲染/正数化） |
| 环境策略 | dev/test 可启 MSW；pre/prod 不注册 handler / worker；无 `USE_MOCK` 业务开关 |
| 待确认登记入口 | `06-collaboration.md` |

## 0.1 MSW 落地前置（G3 必填）

> 后端接口已存在但「放开负值」可能未同步部署；用 MSW 负值 fixture 让前端先测负值配置/展示，再切真实。

| 项 | 需要落地的内容 |
|----|----------------|
| handler | `src/mocks/handlers/mm-fee.ts` 覆盖 normal / empty / error / unauthorized / edge，其中 edge 含**负费率**样本 |
| schema | mock response 与真实 schema 同链路；schema 放开负值（去掉 `min(0)` 约束）后契约测试可复核 |
| worker | `useMockWorker()` 仅 dev 启用，`browser.ts` 注册 handler |
| 切真实 | 后端「放开负值」部署后按 handler 粒度删除 / 停用，保留 schema / mapper |

## 1. 接口清单（均为现有接口，复用现状逻辑）

| ID | Method | Path | 用途 | 登录要求 | 状态 |
|----|--------|------|------|---------|------|
| A1 | GET | `<现有>` 外部做市商列表查询 | F04 列表「手续费率」列显示（含负值） | 需登录（后台） | 已存在复用 · 路径待补 |
| A2 | POST | `<现有>` 添加外部做市商账户 | F01 保存 4 个手续费率（允许负值） | 需登录（后台） | 已存在复用 · 路径待补 |
| A3 | PUT | `<现有>` 编辑外部做市商账户 | F01 编辑回显+保存负值 | 需登录（后台） | 已存在复用 · 路径待补 |
| A4 | GET | `<现有>` 前台合约账户/交易 资金流水·历史成交·仓位历史 | F05 手续费/返佣展示（正数化） | 需登录 | 已存在复用 · 路径待补 |
| A5 | GET | `<现有>` 现货后台用户详情合约流水 + 合约后台 仓位/成交/手续费/资产流水 | F06 手续费展示（正数化） | 需登录（后台） | 已存在复用 · 路径待补 |

> 精确 path / cat_id 属代码事实，G4 复用盘点时从现有 service 代码 + YApi 补全，不在 G3 臆造。

## 2. 通用约定

| 项 | 契约口径 |
|----|---------|
| 网关前缀 | `/fe-ex-api/` / `/api/`（沿用现状） |
| 成功响应 | `code: "0"`、`data: object \| array \| null` |
| 失败响应 | `code` 非 `"0"`；前端展示 `msg` |
| 数值口径 | 手续费率为字符串/数值百分比，**值域放开为 `[-100,100]`**，精度 6 位；负值表示返佣费率 |

## 3. 核心 DTO（契约原文）

> DTO 结构复用现状，本次不改字段名/结构；仅费率字段值域放开负值。真实字段名 G4 从现有 schema/YApi 确认，以下为语义占位。

```ts
// 外部做市商账户（A2/A3 入参 & A1 列表项）——字段名待 G4 从现状代码确认
interface ExternalMmAccountDTO {
  openMakerFeeRate: string   // 开仓 Maker 手续费率(%)，放开负值 [-100,100]
  openTakerFeeRate: string   // 开仓 Taker
  closeMakerFeeRate: string  // 平仓 Maker
  closeTakerFeeRate: string  // 平仓 Taker
  // 维持保证金倍率系数、所属做市机构、描述等沿用现状
}

// 资金流水/成交记录项（A4/A5）——费率/费用字段可为负（返佣），展示层正数化
interface FeeFlowItemDTO {
  bizType: string   // 流水类型：开仓手续费/平仓手续费（返佣与手续费共用类型）
  amount: string    // 金额，负=返佣入账（展示取绝对值 + 正号）
}
```

## 4. UI 领域模型

按 [api-and-mapper.md](../../common/api-and-mapper.md) §2 单一来源默认与 API 同名。本次核心是**展示派生**：

```ts
type FeeFlowView = {
  bizType: string        // 同名直传
  amount: string         // 同名转换：取绝对值展示（正数化）
  displayAmount: string  // 派生：`${sign}${Math.abs(amount)}`，返佣不出负号
}
```

## 5. 字段对账表（强制，Mock 阶段就建）

### 5.1 `FeeFlowView` ← `FeeFlowItemDTO`（`A4`/`A5`）

| UI 字段 | mapper 取值 | 契约字段 | 映射类型 | 备注 |
|---------|-------------|---------|---------|------|
| `bizType` | `dto.bizType` | `bizType`（待确认真实名） | 同名直传 | 开/平仓手续费共用类型 |
| `displayAmount` | `positivize(dto.amount)` | `amount`（待确认真实名） | 同名转换 | 正数化：`Math.abs` + 展示符号，返佣不出负号 |

**G5 联调收尾自检**：
- [ ] 表格所有 column、type 字段都在本表出现且映射类型非空。
- [ ] 无两个 UI 字段兜底到同一 `dto.xxx`。
- [ ] 真实字段名已从现状 schema 确认，占位「待确认真实名」清零。

### 5.2 真实 fixture schema 对账（推荐）

- [ ] 后端「放开负值」后拿到含负费率的真实响应 fixture，接入 `*.realFixture.test.ts` 对账；或记录不适用原因。

## 6. Mock 场景矩阵

> 强制路线：MSW（路线 B）。service/hook/mapper 从第一天只写真实请求；mock 只在 `src/mocks/handlers/mm-fee.ts`，用真实 schema 做契约测试。

| 场景 | 说明 | Mock 触发 | 覆盖字段 |
|------|------|----------|---------|
| normal | 正常正费率数据 | MSW handler 场景参数 / fixture | 全字段有值 |
| empty | 空列表/空流水 | MSW handler 场景参数 / fixture | 列表为空 |
| error | 后端错误 | MSW handler 场景参数 / fixture | `code != "0"`、`msg` 非空 |
| unauthorized | 未登录 | MSW handler 场景参数 / fixture | 后台鉴权拦截 |
| edge | **负费率/极值/精度** | MSW handler 场景参数 / fixture | 负费率 -0.000001、边界 ±100、6 位精度 |

## 6.1 MSW 路线 B 清单（强制，G3 建，G5 切真实）

| # | 检查项 | 状态 |
|---|--------|------|
| 1 | `src/mocks/handlers/mm-fee.ts` 已覆盖 normal / empty / error / unauthorized / edge（edge 含负费率） | 待填（G4） |
| 2 | service / hook / mapper / 组件无 `USE_MOCK` / `@mock-only` / `isMock` / mock import | 待填（G4） |
| 3 | handler response 通过真实 schema 契约测试（schema 已放开负值） | 待填（G4） |
| 4 | dev-only 启动 MSW；production 不注册 handler / worker | 待填（G4） |
| 5 | 后端放开负值 ready 后，删/停 handler 即可切真实接口，业务代码 0 改动 | 待填（G5） |

**切真实完成判定（G5→G6）**：
- [ ] handler 已删、停用或转入测试专用路径；业务代码无 mock 分支。
- [ ] 契约测试保留并更新为真实（含负费率）fixture / schema 对账。
- [ ] schema / mapper / UI 类型 / 纯函数保留未动。

## 7. 文案契约表（强制）

> 逐字取自 PRD 原文；实现阶段只维护 zh-CN。

| 文案 ID | 页面/组件 | 来源 | Owner | zh-CN key | 默认中文（逐字原文） | 动态变量 | 展示条件 | 状态 |
|---------|-----------|------|-------|-----------|----------|----------|----------|------|
| `copy.mmFee.hint` | 添加/编辑外部做市商弹窗 | PRD §5.1 / `PRD-IMG-004` | PM(Lucky) | 待 G4 定 key | `按对应订单类型分别收取，负值表示返佣费率(如-0.000001)` | 无 | 4 费率输入框下方常驻 | 已确认（F02） |
| `copy.mmFee.rangeError` | 同上（校验报错） | PRD §5.1 正文 | PM(Lucky) | 待 G4 定 key | `请输入【-100,100】之间的数字，精度支持6位` | 无 | 输入非法/越界时 | 已确认（F03，以正文为准） |

**自检**：
- [ ] 页面新增固定文案均已入表，并有来源与 owner。
- [ ] 「默认中文」逐字取自 PRD 原文，无意译；已建「值 === 来源原文」字面断言测试。
- [ ] locale 只更新 zh-CN。

## 8. 待确认 / 契约差异

| # | 接口 / 字段 | 现状 | 期望 | 待谁确认 | 状态 |
|---|------------|------|------|---------|------|
| 1 | 手续费率字段值域 | schema/校验 `min(0)` 仅正 | 放开负值 `[-100,100]`，schema 去 `min(0)` | 后端（放开是否已部署）+ 前端 | 待确认 |
| 2 | 现有接口 path / DTO 真实字段名 | 分散在现状代码 | G4 复用盘点从 service/schema/YApi 补全 | 前端（G4） | 待补 |
| 3 | 返佣与手续费共用流水类型 | 共用「开仓/平仓手续费」类型 | 展示层按金额正负区分正数化，不新增类型 | 后端确认口径 | 待确认 |

同步登记到 `06-collaboration.md`；G5 前必须清零或标注延期。

## 9. 契约变更记录

| 日期 | 版本 / commit | 变更 | 前端同步动作 |
|------|--------------|------|-------------|
| 2026-08-07 | 复用现状接口 | 手续费率字段值域 `[0,100]`→`[-100,100]`；流水金额可为负（返佣）展示正数化 | G4 改 schema 去 `min(0)`、加正数化 mapper/纯函数、MSW 负值 fixture |
