# API Contract — PR-01947

> 继承 ../../../common/rules/architecture-and-state.md §3（schema 单源）/§8（Mock 生命周期）。  
> **YApi 已同步（2026-07-14）**：原始 JSON → [`../inbox/yapi/project-587-cat-1489/`](../inbox/yapi/project-587-cat-1489/) · 整理稿 → [`../inbox/yapi/yapi-cat-1489-follow-setting.md`](../inbox/yapi/yapi-cat-1489-follow-setting.md) · [Project 587 Cat 1489](http://35.240.211.100:3333/project/587/interface/api/cat_1489)

## 0. YApi 确认口径（2026-07-14；前台字段 G5 文档对账 2026-07-21 通过）

后端 **单字段** `marginMode` / `leverageMode` 与前端 UI **双字段 + 1-based enum** 不一致，提交层须映射（见 §0.3）。`copyPositionMode` 1/2/3 与前端一致。

### 0.1 后端枚举（YApi Project 587）

| 字段               | 值  | 含义                 |
| ------------------ | --- | -------------------- |
| `marginMode`       | 0   | 跟随交易员保证金模式 |
|                    | 1   | 全仓                 |
|                    | 2   | 逐仓                 |
| `leverageMode`     | 0   | 跟随交易员杠杆       |
|                    | 1   | 自定义杠杆           |
| `copyPositionMode` | 1   | 复制所有持仓         |
|                    | 2   | 仅复制价格更好的持仓 |
|                    | 3   | 不复制现有持仓       |

### 0.2 YApi 已收录接口

| YApi ID | 方法 | 路径                            | 说明                                                           |
| ------- | ---- | ------------------------------- | -------------------------------------------------------------- |
| 5713    | GET  | `/cptrade/follow/before_follow` | 跟单前查询；`myFollowSetting` 含四参数 + `customLeverageLevel` |
| 5710    | POST | `/cptrade/follow/setting_save`  | 编辑保存；入参含四参数 + `customLeverageLevel`                 |
| 5716    | GET  | `/cptrade/leader/page`          | Admin KOL 列表 · `customLeverageRange`                         |
| 5728    | POST | `/cptrade/leader/export`        | Admin 导出 · CSV 列 `customLeverageRange`                      |
| 5752    | POST | `/cptrade/follow/lead_position_count` | 按选中币对范围查带单仓位数（跟单币对确认后刷新 `curLeadPosCount`） |

**5752 `lead_position_count`（countLeadPositions）**：Req `{ leaderUserId: integer, followSymbolList: string[] }`（跟单者选中币对 ID 列表）；Res `data.curLeadPosCount: integer`（所选范围内交易员带单仓位数）。进跟单设置页初值取 `before_follow.leaderDetail.curLeadPosCount`，跟单币对弹窗确认后调此接口刷新。代码 `services/api/copyTrading/follow/lead-position-count.ts`。

`save_follow` **未**出现在 Cat 1489，口径待后端确认是否与 `setting_save` 相同。

### 0.3 提交层映射（已落码 `useFollowParams.toParams()`，2026-07-14）

```ts
// setting_save / save_follow body
marginMode: marginSettingMode === FollowTrader ? 0 : marginMode; // Cross=1, Isolated=2
leverageMode: leverageMode === FollowTrader ? 0 : 1;
customLeverageLevel: Number(leverage); // 替换字段名 leverage
copyPositionMode: copyPositionMode; // 1/2/3 直传
```

### 0.4 before_follow 新增字段（YApi 5713）

**followSetting**：`positionRiskRateMin/Max`、`customLeverageLevelMin/Max`、`followSymbolList`、`rate`、`maxNumber`  
**leaderDetail**：`curLeadPosCount`  
**myFollowSetting**：`marginMode`(0/1/2)、`leverageMode`(0/1)、`customLeverageLevel`、`copyPositionMode`(1/2/3)

---

> 下文 §1–§9 为 G4 阶段草案；§0 为 YApi 确认后优先对账依据。未在 §0 出现的 ASSUMED 项仍按 §6 三列对账表销账。

## 1. API 状态

| 接口          | 方法 / 路径                                   | 现状                                                | 本期改动                                                                                  |
| ------------- | --------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| before_follow | GET `/fe-ex-api/cptrade/follow/before_follow` | 返回 leaderDetail / followSetting / myFollowSetting | 自定义杠杆前端硬限制 1-20x（不再依赖后端范围）；myFollowSetting 加四参数回填（~~有持仓标志~~ `hasFollowPosition` 已删，2026-07-21 定案见 §4） |
| save_follow   | POST `/fe-ex-api/cptrade/follow/save_follow`  | 有 isCopyPos，无 marginMode/leverage                | 入参加 marginMode/leverageMode/customLeverageLevel/copyPositionMode（旧 `leverage` @deprecated 兼容保留） |
| setting_save  | POST `/fe-ex-api/cptrade/follow/setting_save` | **无 isCopyPos**、无三参数                          | 入参加同上四字段（已落码 `setting-save.ts`）                                              |

四参数字段名/值域已经 YApi Cat-1489 确认（§0/§3）；历史 ASSUMED 项销账见 §6。Q3（有持仓禁改）/ Q5（杠杆范围）已定案前端不自判/不下发，见 06-collaboration。

## 2. 新增枚举（前端侧，types/copyTrading.ts）

```ts
// 复用 types/trade.ts MarginModeEnum { Cross = 1, Isolated = 2 }
export enum LeverageMode {
  FollowTrader = 1,
  Custom = 2,
} // 默认 FollowTrader
export enum CopyPositionMode {
  All = 1,
  BetterPrice = 2,
  None = 3,
} // 默认 BetterPrice
```

## 3. save_follow / setting_save 入参新增（✅ YApi Cat-1489 已确认）

| 字段                | 类型      | 说明                                  | 状态              |
| ------------------- | --------- | ------------------------------------- | ----------------- |
| marginMode          | `0\|1\|2` | 0=跟随交易员 / 1=全仓 / 2=逐仓        | ✅ YApi 5710 确认 |
| leverageMode        | `0\|1`    | 0=跟随交易员 / 1=自定义               | ✅ YApi 5710 确认 |
| customLeverageLevel | integer   | 自定义杠杆倍数（leverageMode=1 时传） | ✅ YApi 5710 确认 |
| copyPositionMode    | `1\|2\|3` | 1=全部 / 2=更好价 / 3=不复制          | ✅ YApi 5710 确认 |

> **提交层映射已落码**（`useFollowParams.ts` `toParams()`，2026-07-14）：`marginMode 0/1/2`、`leverageMode 0/1`、`customLeverageLevel: Number(leverage)`。三表单通过 `...followParams.toParams()` 透传，无需独立改动。

### 3.1 save_follow / setting_save 错误码 · 交易员杠杆需 KYC（需求1，2026-07-10）

> PRD 7.4.5 #1 补充：**跟单员为子账户，无 KYC 概念**——前端**不做任何跟单员 KYC 预判**。特殊情况：跟单设置选【随交易员杠杆】(`LeverageMode.FollowTrader`) 而交易员使用需 KYC 的杠杆 → 后端拒绝，跟单失败。
>
> **2026-07-21 业务方定案**：本需求不考虑该场景，前端**不做专属错误码通道**。已删除 `FOLLOW_LEADER_LEVERAGE_KYC_CODE` / `isLeaderLeverageKycError` / `CopySetting.leaderLeverageKycFailed`；若后端真返回该错误码，前端回落平台通用错误通道（`barError(code)`）展示。

| 项       | 值                              | 说明                                                     |
| -------- | ------------------------------- | -------------------------------------------------------- |
| 前端处理 | `barError((error).code)` 通用通道 | 三个 form hook 的 catch，仅保留 forbidden(102074) + 通用 |
| 专属文案 | ~~`leaderLeverageKycFailed`~~   | 已删除（本需求不考虑此场景）                             |

### 3.2 止盈止损 / 仓位风险单位口径（2026-07-23 对齐 online，`badd923ff3`）

> 工具函数单源：`services/api/copyTrading/follow/followRateParams.ts`（9 个单测守）。YApi 5710/5713 只标字段类型未写单位，本节为与 online 实际行为核对后的口径。

| 字段 | UI 输入 | API 值 | 换算 |
| ---- | ------- | ------ | ---- |
| `stopProfitRate` / `stopLossRate` | 小数比例（0.15 = 15%） | 小数比例 | **不换算，原样透传**（`toOptionalApiRate` / `apiRateToDisplay`）；空或 "0" = 未设置不传 |
| `positionRiskRate` | 整数百分数（50 = 50%） | 小数比例 | 提交 ÷100：`positionRiskToApiRate`（setting_save，number）/ `positionRiskToApiString`（save_follow，"0.5"）；回填 `positionRiskToDisplay` |

- 止盈止损上下限：`followSetting.stopProfitRateMin/Max`、`stopLossRateMin/Max` 直用（`resolveRateBounds`，缺省 0.01–4），输入框 placeholder 动态渲染（撤掉硬编码「1～400」）。
- 仓位风险上下限：API 小数 ×100 转 UI 百分数（`resolvePositionRiskBounds`，缺省 5–95，对应 `DEFAULT_POSITION_RISK_MIN/MAX` 0.05–0.95）。
- 兼容存量：历史 `save_follow` 可能存过整数百分数（如 "50"），`positionRiskToDisplay` 对 ≤1 按小数 ×100、>1 原样展示，不会重复换算。
- 曾用名已删：`percentToApiRate` / `apiRateToPercentDisplay` / `apiRateBoundsToPercent`（旧版把止盈止损也按百分数换算，与 online 不符）。

## 4. before_follow 返回新增

> 历史 ASSUMED 项已全部定案：杠杆范围证伪删除（前端硬编码）、myFollowSetting 四参数 YApi 5713 确认、`hasFollowPosition` 删除。

**~~followSetting 加杠杆范围~~（已证伪删除，2026-07-10 需求变更）**：

> PRD 7.4.5 补充：后台配置杠杆改为**前端硬限制只能配置 1-20x**（用户拍板：前端硬编码，不依赖后端下发范围）。原 ASSUMED 字段 `leverageMin/leverageMax/leverageStep` 被证伪，已从 schema/mock/契约测试/UI 全链路删除。自定义杠杆边界改由前端常量 `CUSTOM_LEVERAGE_MIN=1 / MAX=20 / STEP=1`（`FollowParams/constants.ts`）提供，`clampLeverage` 钳到 [1,20]。**后端 before_follow 无需下发杠杆范围字段。**

| 字段             | 类型       | 状态                     |
| ---------------- | ---------- | ------------------------ |
| ~~leverageMin~~  | ~~number~~ | 证伪删除 · 前端硬编码 1  |
| ~~leverageMax~~  | ~~number~~ | 证伪删除 · 前端硬编码 20 |
| ~~leverageStep~~ | ~~number~~ | 证伪删除 · 前端硬编码 1  |

**myFollowSetting 回填**（现有 isCopyPos 保留；四参数已加，schema 见 `before-follow.ts`；旧 `leverage` string @deprecated 兼容保留）：

| 字段                | 类型              | 说明                                                | 待确认                         |
| ------------------- | ----------------- | --------------------------------------------------- | ------------------------------ |
| marginMode          | nullable integer  | 回填保证金模式（0/1/2）                             | ✅ YApi 5713 确认              |
| leverageMode        | nullable integer  | 回填杠杆模式（0=跟随/1=自定义）                     | ✅ YApi 5713 确认              |
| customLeverageLevel | nullable integer  | 回填自定义杠杆倍数（替换旧 `leverage` string 字段） | ✅ YApi 5713 确认              |
| copyPositionMode    | nullable integer  | 回填复制模式（1/2/3，替换/兼容 isCopyPos）          | ✅ YApi 5713 确认              |
| ~~hasFollowPosition~~ | ~~`1\|0`~~      | ~~有跟随持仓禁改判据~~                              | **删除**：Q3 禁改改由后端提交时校验，前端不自判（2026-07-21） |

## 5. 契约不一致（须后端处理）

- **setting_save 缺 isCopyPos**：现 `save_follow` 有、`setting_save` 无。✅ **前端已闭环**：`setting_save` 入参已含 `copyPositionMode`（`setting-save.ts`，2026-07-14 落码），跟单设置页改复制模式有接口可存；旧布尔缺失由三态字段覆盖，后端是否补 isCopyPos 不再阻塞前端。
- **isCopyPos → copyPositionMode（Q4）**：布尔(1/0) → 三态(1/2/3)。✅ **前端兼容已落码**：回填 `copyPositionMode` 优先、`isCopyPos` 兜底（1→All / 其他→None，`useFollowParams.resolveCopyPositionMode`，与 YApi 5713 一致，G5 2026-07-21）；提交侧 `resolveIsCopyPos` 由三态反推旧字段并存（`save_follow` 仍需 isCopyPos）。后端「替换 or 并存」以 YApi 5713 现状为准——两字段并存。

## 6. 三列对账表 · 字段对账（§8.1，从 Mock 阶段起建，G5 逐行核对销账）

> 前端字段 → mapper 取值 → 契约字段。改名字段标四类之一（§3.1），未归类 = 无理由改名。全部 ASSUMED 项须 G5 对账销账，残留 = 对账没做完。
> **字段来源**：G4 均为 MSW handler（`src/mocks/handlers/copyTradingFollow.ts`）返回，与真实 `beforeFollowSchema` 同源（契约对账测试 `copyTradingFollow.contract.test.ts` 守）。真实接口到位后逐行改「契约来源」为后端字段并销账。

| 前端字段 (UI/type)             | mapper 取值                                  | 契约字段                          | 改名类别      | 状态                                              |
| ------------------------------ | -------------------------------------------- | --------------------------------- | ------------- | ------------------------------------------------- |
| marginMode（提交）             | `marginSettingMode===Fixed ? marginMode : 0` | marginMode 0/1/2                  | 语义合并      | ✅ YApi 确认 · 已落码 `toParams()` 2026-07-14     |
| leverageMode（提交）           | `LeverageMode.Custom ? 1 : 0`                | leverageMode 0/1                  | 值域偏移      | ✅ YApi 确认 · 已落码 `toParams()` 2026-07-14     |
| leverage → customLeverageLevel | `Number(leverage)`                           | customLeverageLevel (integer)     | 字段改名+类型 | ✅ YApi 确认 · 已落码 `toParams()` 2026-07-14     |
| copyPositionMode               | 直传 1/2/3                                   | copyPositionMode                  | 同名直传      | **YApi 确认**                                     |
| ~~leverageMin/Max/Step~~       | —                                            | —                                 | —             | **证伪删除**（需求变更：前端硬限制 1-20x，见 §4） |
| ~~hasFollowPosition~~          | —                                            | —                                 | —             | **删除**：Q3 禁改改由后端提交时校验，前端不自判（2026-07-21） |

## 7. Mock 隔离方案（§8.4 路线 B / MSW，G4 编码时落地）

> 决策变更：本项目是 §8.4 MSW 路线 B 的**首个固化范例**（试点已结项、策略已晋级为新功能强制标准路线），**放弃**原 §8.0 路线 A（`if(USE_MOCK)` + `__mock__/` 工厂 + env flag）。以下为实际落地。

- **网络层拦截**：`src/mocks/handlers/copyTradingFollow.ts` 用 MSW `http.get` 拦截 `*/fe-ex-api/cptrade/follow/before_follow` 返回 mock response；`onUnhandledRequest: 'bypass'` → 未声明的请求照打真实接口。
- **零业务耦合**：service/hook/mapper/组件**无任何 mock 判断**（`grep USE_MOCK|@mock-only|isMock` 全空）。`useBeforeFollow` 只写真实请求逻辑。
- **dev-only 启动**：`src/mocks/useMockWorker.ts` 仅 `isEnvDevelopment()` 时 `worker.start()`，挂在 `Providers.tsx`；production 永不注册，天然不进生产包。
- **SW 冲突**：生产 SW（`useServiceWorkerRegistration`）dev 分支清理时**放行** scriptURL 含 `mockServiceWorker` 的注册，避免误清 mock worker。
- **契约同源**：mock response 已导出，`copyTradingFollow.contract.test.ts` 用真实 `beforeFollowSchema.parse` 守其形状 = 关 handler 切真实接口零改动的机器断言。

## 8. Mock 拆除清单（§8.4 路线 B = 零拆除税）

> 路线 B 下 mock **从不进生产代码路径**，§8.0.3 拆除三道闸对本功能自然失效——无 flag、无 `@mock-only`、无 `__mock__/` 工厂需拆。
> **当前状态**：后端已部署 dev，PR-01947 已切换真实 API。`copyTradingFollowHandlers`、契约测试、worker、Provider 启动点、service worker 文件与 `msw` 依赖均已删除，当前 dev 不再拦截 `before_follow`。

| 拆除动作  | 操作                                                                      | 触发（G5 对账通过）                        | 状态                  |
| --------- | ------------------------------------------------------------------------- | ------------------------------------------ | --------------------- |
| 关 mock   | 删 `copyTradingFollowHandlers` 里对应 handler（或清空 `browser.ts` 列表） | before_follow 真实接口 ready + §6 对账销账 | ✅ 2026-07-15 已删除  |
| 停 worker | 删 `Providers.tsx` 的 `useMockWorker()` 调用及 worker 相关文件/依赖       | 全部 handler 拆除后                        | ✅ 已删除             |
| 契约哨兵  | `copyTradingFollow.contract.test.ts` 随 handler 一并删                    | mock 拆除时                                | ✅ 2026-07-15 已删除  |

## 9. 后台导出契约（F19-F21，futures-admin/legacy-admin，Vue2）

后台走 `cptrade/*`，与 apps/web 隔离。三新字段（支持跟随杠杆/保证金模式/杠杆）+ isCopyPos 后台当前均无。导出**后端生成 CSV**（`outExcel.js` responseType:arraybuffer），前端只加列定义 + 字段映射，不拼 CSV。落点见 02 §3.4。后端在 `leaderExport`/`followerExport` CSV 加列。

### 9.1 后台字段对账登记（§8.1，与 §6 前台表并行，G5 逐行销账）

> G4 展示层已落码（`4002bc85` KolListPanel.vue），字段全 ASSUMED（后台真实接口无此字段）。真实接口到位后逐行核对「后端字段名/值域」并销账；后台无 mock 层，`item.xxx` 直接来自 `cptrade/*` 响应。

| 功能 | 前端列 (label)     | mapper 取值                                               | 假定后端字段            | 假定值域                                                       | 状态    |
| ---- | ------------------ | --------------------------------------------------------- | ----------------------- | -------------------------------------------------------------- | ------- |
| F19  | 自定义杠杆         | `formatCustomLeverageRange(item.customLeverageRange)`     | `customLeverageRange`   | 杠杆范围字符串（如 `"1-125"`，展示为 `1x–125x`）              | ✅ 已对账（dev 接口 2026-07-28 确认返回 `customLeverageRange`；纠正早期 ASSUMED `supportFollowLeverage` 1/0） |
| F20  | 保证金模式         | `formatMarginMode(item.marginMode)`                       | `marginMode`            | 1 全仓 / 2 逐仓（对齐 web MarginModeEnum）                     | ASSUMED |
| F20  | 杠杆               | `formatLeverage(item.leverage)`                           | `leverage`              | 数值（`Nx` 展示）                                              | ASSUMED |
| F21  | 跟单后复制全部仓位 | `formatCopyPositionMode(item.copyPositionMode)`           | `copyPositionMode`      | 1/2/3（对齐 web CopyPositionMode，替旧 isCopyPos 布尔，待 Q4） | ASSUMED |

**导出加列 = 后端职责**：`buildExportParams`/`buildFollowerExportParams` 仅传查询条件，`outExcel` 后端生成 CSV → 前端不改。G5 核对后端 `leaderExport`/`followerExport` CSV 已加对应列即可，无前端销账项。

**F21 布尔转三态待 Q4**：后台原「跟单后复制全部仓位」若后端仍回布尔 isCopyPos，需定 `1→All / 0→None?` 映射；现前端按三态 `copyPositionMode` 假定，与 web 端统一。

## 10. 文案契约

### 10.1 2026-08-09 Lark 增量：跟单方式 Tab Tooltip

> 来源：Lark 群任务 `om_x100b684561b020a0e2e687a8ef26b0c`；要求 Tooltip 内容就是对应 label。现有 label 逐字复用，不新增文案或动态变量。

| 文案 ID | 页面 / 组件 | 来源 | owner | zh-CN key | 默认中文 | 动态变量 | 展示条件 | 状态 |
|----------|-------------|------|-------|-----------|----------|----------|----------|------|
| copy-setting-tab-smart | `SettingForm` 智能比例 Tab 与 Tooltip | 现有 label + Lark 增量任务 | 产品 | `CopySetting.smartRate` | 智能比例 | 无 | Tab 常驻；hover 展示同文 Tooltip | 已确认 |
| copy-setting-tab-fixed | `SettingForm` 固定额度 Tab 与 Tooltip | 现有 label + Lark 增量任务 | 产品 | `CopySetting.fixedAmount` | 固定额度 | 无 | Tab 常驻；hover 展示同文 Tooltip | 已确认 |
| copy-setting-tab-proportional | `SettingForm` 倍率 Tab 与 Tooltip | 现有 label + Lark 增量任务 | 产品 | `CopySetting.multiplier` | 倍率 | 无 | Tab 常驻；hover 展示同文 Tooltip | 已确认 |

变更记录：2026-08-09 仅增加三个现有 label 的 hover 展示条件；key、默认中文和变量均未变。
