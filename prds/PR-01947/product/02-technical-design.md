# Technical Design — PR-01947

> 继承 ../../common/rules/architecture-and-state.md、component-reuse-and-visual-fidelity.md。本期前端职责 = **参数配置 UI + 传参 + 展示合约返回失败原因**，不实现隔离/钳制/复制/最小开仓判定（PRD 7.4.5 末：跟单只传参，能否下单由合约判定）。

## 1. 责任模块

| 域 | 路径 |
|----|------|
| 跟单设置页壳 | apps/web/src/apps/CopyTrading/CopySetting.tsx |
| 三模式表单容器 | apps/web/src/apps/CopyTrading/components/CopySetting/SettingForm.tsx |
| 三模式表单 | components/CopySetting/{SmartCopyForm,FixedCopyForm,ProportionalCopyForm}.tsx |
| 确认弹窗 | components/Modals/ConfirmCopyModal.tsx |
| API | services/api/copyTrading/follow/{before-follow,save-follow,setting-save}.ts |
| 枚举 | types/copyTrading.ts（FollowType）、types/trade.ts（MarginModeEnum） |

## 2. 复用盘点（G4 前硬门禁）

| 类型 | 已检查位置 / 名称 | 结论 | 采用方式 | 不复用原因 |
|------|-------------------|------|----------|-----------|
| 组件-保证金模式 | grep `MarginModeModal`/`MarginModeEnum`/`marginMode` → `apps/Futures/components/OrderPanel/Modals/MarginModeModal.tsx`；枚举 `types/trade.ts` `MarginModeEnum{Cross=1,Isolated=2}` | 复用枚举；UI 轻量封装 | 轻量封装 | Futures 版耦合 orderStore/userConfig，跟单需改受控 props |
| 组件-杠杆滑块 | grep `LeverageModal`/`Slider`/`LeverageSelector` → `Futures/.../Modals/LeverageModal.tsx:163`（`@fameex/ui` Slider marks/min/max/step）；`LeverageSelectModal/LeverageSelector.tsx` | 滑块基础复用 | 轻量封装 | 容器与「跟随/自定义」二选一跟单侧无 |
| 组件-杠杆模式二选一 | grep `LeverageSetting`/`杠杆模式` → 跟单侧无；Futures `OrderPanel/LeverageSetting.tsx` 是保证金+杠杆组合范式 | 参考布局，新建 | 新建 | 全站 0-1 同类，无「跟随交易员/自定义」二选一控件 |
| 组件-复制仓位三选项 | grep `isCopyPos`/`复制仓位`/`copyPos` → 现仅布尔 `isCopyPos`（复制全部/否） | 新建单选列表 | 新建 | 现布尔无法表达三态、无「复制更好价」枚举 |
| 组件-确认弹窗 | grep `ConfirmCopyModal` → `components/Modals/ConfirmCopyModal.tsx`（逐行罗列参数 :131-190，三表单共用） | 加展示行 | 轻量封装 | 直接扩展 props，禁重写 |
| 组件-开通合约弹窗 | grep `useOpenContractModal`/`OpenContractModal` → `components/modals/OpenContractModal/OpenContractModal.tsx`（SettingForm 已引用） | 复用 | 直接复用 | 传 props 隐藏关闭 icon + 点空白不关 |
| hooks | `useBeforeFollow`/`useSaveFollow`/`useSaveSetting`（services/api/copyTrading/follow/） | 扩参 | 轻量封装 | schema 加字段 |
| services / API | copyTrading/follow/{before-follow,save-follow,setting-save}.ts | 扩 schema | 轻量封装 | 见 §3 |
| stores | 三表单本地 useState + RQ，无 Zustand | 沿用 | 直接复用 | 服务端态走 RQ，派生态不进 store |
| utils | `getSaveFollowForbiddenMessage`（save-follow.ts）失败原因展示范式 | 复用 | 直接复用 | — |

## 3. 数据 / 契约改动（详见 03-api-contract.md）

### 3.1 新增枚举

```ts
// 保证金模式：复用 types/trade.ts MarginModeEnum { Cross=1, Isolated=2 }
enum LeverageMode { FollowTrader = 1, Custom = 2 }        // 杠杆模式，默认 FollowTrader（新增）
enum CopyPositionMode { All = 1, BetterPrice = 2, None = 3 } // 复制模式，默认 BetterPrice（新增，替换布尔 isCopyPos）
```

### 3.2 save_follow / setting_save 入参新增（✅ YApi Cat-1489 已确认，详见 03 §0/§3）

| 字段 | 类型 | 说明 | 现状 |
|--------------|------|------|------|
| marginMode | 0\|1\|2 | 0=跟随交易员 / 1=全仓 / 2=逐仓 | 已落码 `toParams()` |
| leverageMode | 0\|1 | 0=跟随交易员 / 1=自定义 | 已落码 |
| customLeverageLevel | integer | 自定义杠杆倍数（leverageMode=1 时传；替换旧 `leverage` string，旧字段 @deprecated 兼容保留） | 已落码 |
| copyPositionMode | 1\|2\|3 | 复制模式；与旧 `isCopyPos` 并存（回填 copyPositionMode 优先、isCopyPos 兜底） | 已落码 |

### 3.3 before_follow 返回新增（✅ 已定案）

- ~~`followSetting` 增杠杆范围：`leverageMin`/`leverageMax`/`leverageStep`~~：**证伪删除**（2026-07-10 需求变更：前端硬编码 1-20x，后端无需下发，见 03 §4）。
- `myFollowSetting` 回填：`marginMode`/`leverageMode`/`customLeverageLevel`/`copyPositionMode`（✅ YApi 5713 确认，schema 已落 `before-follow.ts`）。
- ~~「当前对该交易员是否有跟随持仓」标志~~：**2026-07-21 定案**——有持仓禁改保证金/杠杆改由后端在提交时校验并返回失败原因，前端不再自判，`hasFollowPosition` 字段与 `locked` 判据已删。

## 3.4 合约管理后台落点（F19-F21，agent 探查确认 2026-07-08）

> **修正**：合约跟单后台在 **`apps/futures-admin/legacy-admin`**（Vue2 + BootstrapVue 主表格 + Element UI 弹窗，走 `cptrade/*` 接口），**不是** `apps/admin/legacy-admin`（那是运营后台「增值服务·合约跟单」，走 `/follow/*`，非本需求目标），也不是 React 的 `apps/futures-admin/src`（无跟单代码）。别选错。

| 落点 | 文件 : 锚点 | 说明 |
|------|------------|------|
| KOL 列表 Tab 壳 | `viewsTemplate/copyTrading/kolList.vue` | 「KOL列表 / 成为交易员审核」两 tab |
| **KOL 列表表格（F19）** | `copyTrading/components/KolListPanel.vue:347` `fields()` | 列定义，现无「支持跟随杠杆」列 → 新增 |
| KOL 导出（F19） | `KolListPanel.vue:885` `exportCsv()` → `url.js:588` `leaderExport='cptrade/leader/export'` | 后端 CSV 加列 |
| KOL 字段映射 | `KolListPanel.vue:501` `mapKolItem()` | 新字段后端→前端映射点 |
| **跟单者管理（F20/F21）** | `KolListPanel.vue:167` 「跟单人数详情」el-dialog；列定义 `:371` `followerFields()` | 现无「保证金模式/杠杆/复制全部仓位」三列 → 新增。**当前不是独立页，是 KOL 列表内弹窗** |
| 跟单者导出（F20/F21） | `KolListPanel.vue:875` `exportFollowerCsv()` → `url.js:592` `followerExport='cptrade/leader/follower/export'` | 后端 CSV 加列 |
| 跟单者字段映射 | `KolListPanel.vue:668` `mapFollowerItem()` | 新字段映射点 |
| API URL 集中定义 | `src/vuex/base/url.js:577` `copyTrading` 块 | 无独立 service，组件内 `this.$http` 直调 |
| 导出机制 | `src/apis/outExcel.js:51`（`responseType:'arraybuffer'` 后端生成 CSV） | **前端只触发下载，不拼 CSV**；新增列后端加，`outExcel` 无需改 |

**关键事实**：三个新字段（「支持跟随杠杆」「保证金模式」「杠杆」）+ `isCopyPos`（「跟单后复制全部仓位」）在合约后台**当前都不存在**（全库 grep 无命中）；`isCopyPos` 现仅存于 C 端 `apps/web`（save-follow.ts:17）。故 F19-F21 = 新增字段列 + 映射 + 后端导出加列，非「改现有列」。技术栈 Vue2，与 apps/web React 侧完全隔离，两侧改动互不影响。

## 4. 状态管理

沿用现状：三表单本地 `useState` + React Query，不新增 Zustand。新增三参数并入各表单本地 state + 提交 params。

## 5. 前端即时校验（唯一自判逻辑）

- 自定义杠杆输入 > 币对 Max → 钳制 Max + Toast；< Min → 钳制 Min + Toast（PRD 7.4.4）。
- 其余（隔离/复制判定/最小开仓/KYC 钳制/有持仓禁改）不自判，传参由合约判定，失败展示 `save_follow` 返回原因（2026-07-21 定案：有持仓禁改、交易员杠杆 KYC 场景前端专属通道均已删）。
