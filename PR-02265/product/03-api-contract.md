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
| 契约来源 | YApi 分类 / Swagger / 后端约定文档链接 |
| 契约版本 | 拉取日期 / commit / cat_id |
| 前端 service 目录 | `apps/web/src/services/api/<feature-domain>/` |
| Mock 路线 | MSW 路线 B（强制）；handler：`apps/web/src/mocks/handlers/<feature>.ts`；不用 MSW 须登记豁免 |
| 环境策略 | dev/test 可启 MSW；pre/prod 不注册 handler / worker；无 `USE_MOCK` 业务开关 |
| 待确认登记入口 | `06-collaboration.md §<x>` |

## 0.1 MSW 落地前置（G3 必填）

> 新项目若 API 未 ready，本节必须在 G3 先填满，再进入实现。

| 项 | 需要落地的内容 |
|----|----------------|
| handler | `src/mocks/handlers/<feature>.ts` 覆盖 normal / empty / error / unauthorized / edge |
| schema | mock response 与真实 schema 同链路，契约测试可复核 |
| worker | `useMockWorker()` 仅 dev 启用，`browser.ts` 注册 handler |
| 切真实 | 后端 ready 后按 handler 粒度删除 / 停用，并保留 schema / mapper |

## 1. 接口清单

| ID | Method | Path | 用途 | 登录要求 | 状态 |
|----|--------|------|------|---------|------|
| A1 | GET | `/api/xxx` | | 未登录可看 / 需登录 | 待联调 / 已联调 / 阻塞 |

## 2. 通用约定

| 项 | 契约口径 |
|----|---------|
| 网关前缀 | `/fe-ex-api/` / `/api/` |
| Header | `language`、`Authorization`、`X-Trace-Id` 等 |
| 成功响应 | `code: "0"`、`succ: true`、`data: object \| array \| null` |
| 失败响应 | `code` 非 `"0"` 或 `succ: false`；前端展示 `msg` |
| 时间字段 | 毫秒时间戳 / ISO / 秒；分页 `pageNum` / `pageSize` |
| 枚举编码 | 大写 `SNAKE_CASE` / 小写 kebab / 数字 |

不一致或未确认项列入 §7。

## 3. 核心 DTO（YApi / 后端契约原文）

按接口分节粘贴 DTO 定义。**不改名、不省略字段**——本节是"契约原样"，命名规范化落到 §5 对账表里。

### 3.1 `A1 GET /api/xxx` 响应

```ts
interface FooDetailDTO {
  fooId: string
  fooName: string
  // ... 直接照抄 YApi 字段
}
```

## 4. UI 领域模型

按 [api-and-mapper.md](../../common/api-and-mapper.md) §2：**单一来源默认与 API 同名**。类型/格式变化与消歧也默认保持原名；仅跨来源统一或多字段派生允许新字段名。

```ts
type FooView = {
  fooId: string       // API 同名，直传
  fooName: string     // API 同名，直传
  startTime: string      // 同名转换：number → 格式化字符串
  displayName: string    // 多字段派生：firstName + lastName
  // ...
}
```

## 5. 字段对账表（强制，Mock 阶段就建）

**规则**：
- 每个 UI 领域字段一行。
- 「mapper 取值」列写清 fallback 链，例如 `dto.rewardName ?? dto.rewardType`。
- 「契约字段」列必须是 §3 DTO 里真实存在的字段路径。**找不到唯一来源的字段是 mock 阶段臆造，必须删除或与其它字段合并**（[architecture-and-state.md](../../common/architecture-and-state.md) §8.1 反面案例）。
- 「映射类型」四选一：`同名直传` / `同名转换` / `跨来源统一` / `多字段派生`。后两类必须在 mapper 写 §3.1 结构化理由；类型变化和消歧不是改名理由。

### 5.1 `FooView` ← `FooDetailDTO`（`A1`）

| UI 字段 | mapper 取值 | 契约字段 | 映射类型 | 备注 |
|---------|-------------|---------|---------|------|
| `fooId` | `dto.fooId` | `fooId` | 同名直传 | |
| `fooName` | `dto.fooName` | `fooName` | 同名直传 | |
| `startTime` | `formatTime(dto.startTime)` | `startTime` | 同名转换 | number → string |
| `displayName` | `joinName(dto.firstName, dto.lastName)` | `firstName` / `lastName` | 多字段派生 | `// API-DERIVED: sources=firstName,lastName` |
| `id` | `dto.taskGroupId` | `taskGroupId` | 跨来源统一 | 任务卡/子活动/活动统一叫 `id`，服务多处通用消费 |

**G5 联调收尾自检**：
- [ ] 表格所有 column、type 字段都在本表出现且映射类型非空。
- [ ] 无两个 UI 字段兜底到同一 `dto.xxx`（禁止双列显示同值）。
- [ ] mock 阶段臆造、契约无来源的字段已删除；相关 UI 列同步删除。

### 5.2 真实 fixture schema 对账（推荐）

若已拿到真实响应 fixture，复制 [real-fixture-reconcile-test-template.ts](../../templates/real-fixture-reconcile-test-template.ts) 建 `*.realFixture.test.ts`，用 `schema-fixture-reconcile.mjs` 检查 `.parse()` 是否剥离了真实字段：

```ts
expect(diffStrippedKeys(rawPayload, detailSchema.parse(rawPayload))).toEqual([])
```

- [ ] 已接入真实 fixture schema 对账测试；或记录不适用原因：`<无真实 fixture / schema 含 transform / 接口未 ready>`。

## 6. Mock 场景矩阵

> 强制路线：新功能使用 MSW（[architecture-and-state.md §8.4.1](../../common/architecture-and-state.md) 路线 B）。service / hook / mapper 从第一天只写真实请求；mock 只在 `src/mocks/handlers/<feature>.ts`，并用真实 schema 做契约测试。无法采用 MSW 时，必须先在 `agent/rule-waivers.json` 登记豁免，才允许使用 §6.2 路线 A。

| 场景 | 说明 | Mock 触发 | 覆盖字段 |
|------|------|----------|---------|
| normal | 正常数据 | MSW handler 场景参数 / fixture | 全字段有值 |
| empty | 空数据 | MSW handler 场景参数 / fixture | 列表 / 排行榜为空 |
| error | 后端错误 | MSW handler 场景参数 / fixture | `code != "0"`、`msg` 非空 |
| unauthorized | 未登录 / 未报名 | MSW handler 场景参数 / fixture | 隐藏 CTA、脱敏字段 |
| edge | 极值 / 长文案 / 精度 | MSW handler 场景参数 / fixture | 大数、长标题、多档位 |

Mock response 必须过真实 schema；建议新增 `<feature>.contract.test.ts` 断言 handler response 与 schema 同源。fixture 位置、schema、mapper 必须与真实接口同链路（[architecture-and-state.md](../../common/architecture-and-state.md) §8）。

## 6.1 MSW 路线 B 清单（强制，G3 建，G5 切真实）

| # | 检查项 | 状态 |
|---|--------|------|
| 1 | `src/mocks/handlers/<feature>.ts` 已覆盖 normal / empty / error / unauthorized / edge | 待填 |
| 2 | service / hook / mapper / 组件无 `USE_MOCK` / `@mock-only` / `isMock` / mock import | 待填 |
| 3 | handler response 通过真实 schema 契约测试 | 待填 |
| 4 | dev-only 启动 MSW；production 不注册 handler / worker | 待填 |
| 5 | 真实接口 ready 后，删/停 handler 即可切真实接口，业务代码 0 改动 | 待填 |

**切真实完成判定（G5→G6）**：
- [ ] handler 已删、停用或转入测试专用路径；业务代码无 mock 分支。
- [ ] 契约测试仍保留并更新为真实 fixture / schema 对账。
- [ ] schema / mapper / UI 类型 / 纯函数**保留未动**（它们是真实契约代码，不是 mock）。

## 6.2 遗留路线 A 拆除清单（仅无法采用 MSW 时使用）

> 使用本节前必须已有 `agent/rule-waivers.json` 豁免记录，说明为什么不能采用 MSW、替代隔离方案、owner、过期时间。

Mock 是临时脚手架，真实接口就绪 + §5 对账通过后**立即删光、零残留**（路线 A 见 [mock-legacy-route-a.md §8.0.3](../../common/mock-legacy-route-a.md)；MSW 删 handler 即可）。写 mock 时同步登记每个待删点：

| # | mock 待删点（文件 / 分支 / env / 标记） | 替换它的真实接口 | 标记 | 状态 |
|---|------------------------------------------|------------------|------|------|
| 1 | `services/api/<feature>/__mock__/xxx.mock.ts` | `A1 GET /api/xxx` | `@mock-only` | 待删 |
| 2 | `xxx.ts` 里 `if (USE_MOCK)` 分支 + import | `A1` | `@mock-only` | 待删 |
| 3 | `NEXT_PUBLIC_<FEATURE>_USE_MOCK` env 与读取 | — | `@mock-only` | 待删 |
| 4 | `?scenario=` mock 分支接线 | — | `@mock-only` | 待删 |

**拆除完成判定（G5→G6）**：
- [ ] 每行状态 = 已删。
- [ ] `grep -rn "@mock-only" apps/web/src/apps/<feature> apps/web/src/services/api/<feature>` 返回空。
- [ ] `USE_MOCK` flag 已从代码删除（不是留着设 `false`）。
- [ ] schema / mapper / UI 类型 / 纯函数**保留未动**（它们是真实契约代码，不是 mock）。

## 7. 文案契约表（强制）

> 固定文案按 [architecture-and-state.md §7.1](../../common/architecture-and-state.md) 管理；未入表的新文案不要直接落 JSX 或 locale。实现阶段只维护 zh-CN。
> **逐字硬性**：「默认中文」列必须逐字 copy 自 PRD/Figma/运营原文，禁意译/复述/改写；固定文案实现必须配「值 === 来源原文」字面断言测试（`it.each` + `toBe`）。反面案例 PR-02022：有表仍意译、结构断言拦不住。

| 文案 ID | 页面/组件 | 来源 | Owner | zh-CN key | 默认中文（逐字原文） | 动态变量 | 展示条件 | 状态 |
|---------|-----------|------|-------|-----------|----------|----------|----------|------|
| `copy.foo.title` | `FooHeader` | PRD §x / Figma node | PM / Design | `<namespace>:foo.title` | `待填` | 无 | 始终展示 | 待确认 / 已确认 / 已落地 |
| `copy.foo.amountTip` | `FooCard` | API `rewardDescription` / PRD §x | Backend / PM | `<namespace>:foo.amountTip` | `待填 {{amount}} {{coin}}` | `amount: string`；`coin: string` | `rewardDescription` 为空则不渲染 | 待确认 / 已确认 / 已落地 |

**自检**：
- [ ] 页面新增固定文案均已入表，并有来源与 owner。
- [ ] 「默认中文」逐字取自来源原文，无意译/改写/增删标点；PRD↔Figma 冲突已记 `06-collaboration.md`，未在代码自造。
- [ ] 已建「值 === 来源原文」字面断言测试（`it.each` + `toBe`，覆盖标题/按钮/toast/弹窗每条固定文案）。
- [ ] 动态变量名称、类型、格式化来源已声明。
- [ ] locale 只更新 zh-CN；其他语言未跟改。
- [ ] 接口/运营配置文案缺失时显 `--` 或不渲染，没有本地假默认文案兜底。

## 8. 待确认 / 契约差异

| # | 接口 / 字段 | 现状 | 期望 | 待谁确认 | 状态 |
|---|------------|------|------|---------|------|
| 1 | | | | 后端 / 产品 / 设计 | 待确认 |

同步登记到 `06-collaboration.md`；G5 前必须清零或标注延期。

## 9. 契约变更记录

| 日期 | 版本 / commit | 变更 | 前端同步动作 |
|------|--------------|------|-------------|
| 2026-08-07 | | 新增 / 删除 / 改名字段 | 已改 service / schema / mapper / mock / 对账表第几行 |
