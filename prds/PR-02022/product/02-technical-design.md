# Technical Design — PR-02022 合约跟单引导页

继承 [../../common/rules/architecture-and-state.md](../../../common/rules/architecture-and-state.md)。

## 0. 方案总览

三块功能、两套 UI 机制：

| 功能 | UI 机制 | 复用 / 新建 |
|------|---------|------------|
| 新手引导（3 步，F01-F06） | **driver.js**（遮罩 + 挖空高亮 + popover） | 新引入 driver.js + 自定义 popover 样式与 hook |
| 带单员强提醒弹窗（F07-F11） | **现有 `components/Modal.tsx`** | 直接复用 |
| 交易员可见性（F13-F16） | 后端接口处理，前端直接渲染 | 无前端改动（G2 已确认） |
| 删除旧引导节点（F12） | 删除 `LeaderSummary.tsx` 首次进入触发 | 改现有代码 |

## 1. 复用盘点（G4 前必填，已 grep `apps/web/src`）

| 待实现 UI / 能力 | 已检查位置 | 结论 | 采用方式 |
|------------------|-----------|------|----------|
| 跟单广场页容器 | `apps/web/src/apps/CopyTrading/index.tsx`（路由 `/copy-trading/futures`） | 在此挂引导触发 + 带单员弹窗 | 组合新组件 |
| 通用弹窗 | `apps/web/src/components/Modal.tsx`（`isDismissable`、`size`、`useModalStatus`） | 带单员弹窗直接复用 | **直接复用** |
| 步骤引导 / tour 库 | 全仓 grep 无 driver/tour/shepherd/intro/onboarding | 无现成 | **新引入 driver.js**（组长指定） |
| 交易员列表/卡片 | `CopyTrading/components/CopyTrading/TraderListSection/`、`TraderList/` | 引导高亮目标，加 data-tour 锚点 | 复用 + 加锚点 |
| 首次进入机制 | `services/api/copyTrading/leader/change-first-page.ts`、`leader/user-info.ts`（`isFirstPage`） | 旧机制属带单员协议，**不能直接复用**为新引导状态；新引导需独立状态接口 | 参考形态，新建 hook |
| 带单员身份查询 | `services/api/copyTrading/check-kol.ts`（`useUserIsKol`） | 带单员弹窗的身份判断可参考/复用 | 复用 / 轻量封装 |
| 埋点 | PostHog：`posthog.capture(event, params)`（见 `CopyTrading/index.tsx:21`） | 直接复用 | **直接复用** |
| i18n | `i18n/locales/zh-CN/copyTrading.json`（namespace `copyTrading`） | 直接复用，新增 key | **直接复用** |
| React Query 写法 | `services/api/copyTrading/**`（`getQuery` + `zCamel(schema)`） | 新接口照此写 | 照现有范式 |
| Zustand | `CopyTrading/stores/copyTradingStore.ts` | 引导/弹窗的瞬时 UI 状态可本地 state，不入全局 store | 不滥用 store |

## 2. driver.js 引入

| 项 | 说明 |
|----|------|
| 包名 | `driver.js`（npm，MIT，1.x，轻量 ~5-18kb gzip，TypeScript 原生） |
| 安装 | `pnpm --filter @fameex/web add driver.js`（仅 web app，G4 安装时取最新 latest） |
| 样式 | 引入 `driver.js/dist/driver.css` 基础样式 + 项目自定义 `popoverClass` 覆盖 |
| 禁止 | 不在 monorepo 根装；不与「Browser/Playwright 禁装」规则冲突（那条针对 e2e 工具，driver.js 是业务运行时依赖，合规） |

### driver.js 能力与需求映射

| 需求 | driver.js 能力 |
|------|---------------|
| 遮罩 + 挖空高亮 | 内置 overlay + highlight（`overlayColor`/`overlayOpacity` 调 `--BG-6` 效果） |
| 三步骤切换 | `driver({ steps:[...] })` + `drive()` / `moveNext()` / `movePrevious()` |
| 指向箭头 | popover 自带 arrow，自动定位 |
| 步骤指示 N/3 | `showProgress` + `progressText: '{{current}}/{{total}}'`，或自定义渲染 |
| 各步不同按钮 | `popover.showButtons` 按步配置 + `nextBtnText`/`prevBtnText`/`doneBtnText` |
| 自定义「跳过」按钮 | `onPopoverRender` 注入跳过按钮（driver.js 无内置 skip） |
| 第三步右上 × | **去掉**（已确认 2026-06-30）：第三步 popover 不显示 close，仅「上一步 / 完成」 |
| 翻页不改状态 | `onNextClick`/`onPrevClick` 仅 `moveNext/movePrevious` + 埋点，不调状态接口 |
| 完成/跳过改状态 | `onDoneClick`（完成）/ 自定义跳过按钮 → 调状态上报接口 + `destroy()` |
| 中途退出不改状态 | 不监听路由离开做上报；仅显式跳过/完成才上报（PRD §5.1） |

> ⚠️ driver.js 一旦覆盖 `onNextClick`/`onPrevClick`，按钮不再自动导航，必须在回调里手动 `moveNext()`/`movePrevious()`。

## 3. 状态机

### 引导状态（F01-F06）

```
未触发(not_triggered) ──跳过──▶ 已结束(ended)      [不可逆]
                      ──完成──▶ 已完成(completed)  [不可逆]
```

- 进入广场 → 查询引导状态
- `not_triggered` 且（非带单员未读弹窗场景）→ 页面加载完成后 `driver.drive()` 起第一步
- `ended` / `completed` → 不展示
- 上一步/下一步：仅切 step，**不调接口**
- 跳过（任意步）→ 上报 `ended` + `destroy()`
- 完成（第三步）→ 上报 `completed` + `destroy()`
- 中途关页面未操作 → 不上报，下次重新从第一步
- 接口异常 → 默认不展示，不阻断主流程（try/catch 兜底）

### 带单员弹窗状态（F07-F11）

```
未读(unread) ──点 × 或 去带单──▶ 已读(read)  [不可逆]
```

### 互斥与优先级（PRD §5.2）

```
进入跟单广场页（已登录 + 页面主体加载完成）
  │
  ├─ 查询：带单员身份 + 弹窗状态、引导状态（可并发）
  │
  ├─ if (身份==带单员 && 弹窗状态==unread)
  │       → 只展示【带单员弹窗】，不展示引导
  │
  └─ else if (引导状态==not_triggered)
          → 展示【新手引导】driver.drive()
```

> 未登录、加载未完成、接口异常 → 都不展示。

## 4. 组件 / hook 拆分

```
apps/web/src/apps/CopyTrading/
  guide/                                  # 本期新增引导域
    useCopyGuide.ts                       # 引导编排：查状态→判定→driver 实例→埋点→上报
    copyGuideSteps.ts                     # 三步 step 配置（target 选择器、文案、按钮矩阵）
    copyGuidePopover.ts                   # onPopoverRender：注入「跳过」、组织按钮/进度
    copyGuide.css （或 tailwind via popoverClass）  # popover 样式还原 Figma
  components/Modals/
    TraderBecomeModal/                    # 带单员强提醒弹窗（复用 Modal 壳）
      index.tsx
  index.tsx                               # 挂载点：调用 useCopyGuide + 渲染 TraderBecomeModal
services/api/copyTrading/guide/           # 本期新增接口（先 Mock）
    guide-status.ts                       # useGuideStatus（查询）
    guide-status-report.ts                # useReportGuideStatus（上报）
    trader-popup-status.ts                # useTraderPopupStatus（身份+弹窗状态查询）
    trader-popup-report.ts                # useReportTraderPopup（上报已读）
```

> 单文件 ≤300 行；popover 注入逻辑、step 配置、埋点分文件。每个 hook/组件/function 顶部加一句业务职责活注释。

## 5. 埋点映射（PRD §5.4 → driver.js 回调 → PostHog）

| PRD 事件 | 触发点（driver.js） | PostHog capture |
|----------|--------------------|-----------------|
| copytrade_guide_show | 首次 `drive()` 起第一步 | `('copytrade_guide_show', { step: 1 })` |
| copytrade_guide_step_view | `onHighlighted`（每步高亮，含第一步） | `('copytrade_guide_step_view', { step })` |
| copytrade_guide_next | `onNextClick`（先埋点取 from_step 再 moveNext） | `('copytrade_guide_next', { from_step })` |
| copytrade_guide_prev | `onPrevClick` | `('copytrade_guide_prev', { from_step })` |
| copytrade_guide_skip | 自定义跳过按钮 | `('copytrade_guide_skip', { skip_step })` |
| copytrade_guide_complete | `onDoneClick`（第三步完成） | `('copytrade_guide_complete')` |
| trader_become_popup_show | 弹窗展示 | `('trader_become_popup_show')` |
| trader_become_popup_close | 点 × | `('trader_become_popup_close')` |
| trader_become_popup_go_trade | 点去带单 | `('trader_become_popup_go_trade')` |

> 公参 platform/page_name/time 跟随现有 PostHog 公共属性；`user_id` 跟随现有上报上下文（确认现有 capture 是否已带 distinct_id）。仅 **Web 端**（G2 确认）。

## 6. 删除旧引导节点（F12，G2 已确认范围）

**目标**：移除「成为交易员后 → 首次进入跟单广场」路径下自动弹出的旧引导。

- 已定位触发点：`apps/web/src/apps/CopyTrading/components/CopyTrading/Banner/LeaderSummary.tsx:36-51`
  —— `useEffect` 中 `setIsOpen(data?.isFirstPage === 1)` 在首次进入时自动弹 `TraderPrivacyModal`（交易员带单协议）。
- 涉及弹层：**交易员带单协议**（`Modals/TraderPrivacyModal`）、**合约带单设置**（`leader-setting` 跳转 / `LeadSettingConfirmModal`）。
- ⚠️ **安全边界**：
  - 只移除「首次自动弹出」这条触发（`isFirstPage===1` 自动 setIsOpen）。
  - **保留**用户主动点「开启带单 / 设置带单参数」时的协议与设置弹层（`handleRedirect`、`handleConfirm` 等用户主动路径）。
  - 两个弹层组件本身不删除。
- G4 编码前必须再 grep 全部触发点逐一确认归属，列清单后再改。

## 7. 风险与待确认（详见 06-collaboration）

1. API 未出 → 全程 Mock（schema/mapper 同链路，见 03-api-contract）。
2. 第三步 popover 右上 `×` 语义未定（完成 / 仅关闭不改状态）。
3. 第三步高亮目标「跟单进展/持仓区」在**新用户**首次进入时是否存在（新用户可能无持仓卡片）。
4. driver.js 作为新依赖需负责人/组长最终拍板（组长已建议，待正式同意安装）。
5. F12 删除需 grep 全触发点确认，防止误删用户主动路径。
