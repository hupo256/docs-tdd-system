# PR-01947 交接记录 — G4 前台编码完成 / G5 待对账

> 面向接手方（AI 或人）。目的：在**另一个 PR-01947 工作副本**恢复本项目，不丢上下文。
> 记录时间：2026-07-09（更新）。初记 2026-07-08。记录人：Agent。

## 一句话现状

G0-G3 完成，**前台 F01-F17（除 F15）+ MSW 试点 + 后台 F19-F21 展示层全落码并 commit，G6 gate PASS（fail=0, warn=2）**。前后台共用同批 ASSUMED 字段。下一步 = G5 真实接口就绪后前后台一并对账销 ASSUMED。

## 已批准的完整计划

**权威计划在** `/Users/aven/.claude/plans/linear-coalescing-papert.md`（本地 plan 文件）。若接手环境读不到该路径，本文件末尾附**计划全文摘要**，按它执行。

## 本轮范围（用户 2026-07-08 确认「前台核心一轮」）

做：F01-F14、F16、F17（前台 apps/web）+ **MSW 试点**（用户选路线 B，团队首次）。
不做（下一轮/暂缓）：后台 F19-F21（Vue2 隔离）、F15（依赖读图 Q8）、滑点/通知/埋点。

## 代码进度（关键：已改了什么）

主体在 commit `93f35274c feat: add dom files without api`（+2672/-1348，31 个 ts/tsx）+ 枚举 `25b5f9e957`。

| 状态 | 模块 | 改动 |
|------|------|------|
| ✅ commit | `types/copyTrading.ts` | LeverageMode / CopyPositionMode 枚举 + schema |
| ✅ commit | `CopySetting/FollowParams/` | `useFollowParams` hook + 受控子组件 MarginModeField/LeverageField/CopyPositionField + clampLeverage（§2 复用硬门禁，消除三表单 90% 镜像） |
| ✅ commit | `use{Smart,Fixed,Proportional}CopyForm.ts` + `*AdvancedSettings.tsx` | 三表单逻辑抽离重构 |
| ✅ commit | `follow/{before,save,setting}-*.ts` | schema 扩四参数 + 杠杆范围 + hasFollowPosition，全标 `// ASSUMED:` |
| ✅ commit | `ConfirmCopyModal`（F13）/ `OpenContractModal hideCloseButton`（F16） | 确认弹窗加三行 / 透传关闭按钮开关 |
| ✅ commit | `src/mocks/` + `mockServiceWorker.js` + `useServiceWorkerRegistration` | MSW 路线 B（handler + dev-only worker + SW 放行） |
| ✅ commit | `futures-admin/legacy-admin/.../copyTrading/KolListPanel.vue` | 后台 F19-F21 展示+映射全落（`4002bc85f` +35）：`fields`/`followerFields` 加 4 列 + 4 formatter + `mapKolItem`/`mapFollowerItem` 映射，全标 ASSUMED；CSV 导出后端加列，前端 `outExcel` 纯触发不改 |

**当前 git 状态**（2026-07-13 更新）：分支 `feature/PR-01947`，worktree clean。最新 `8fc8d7bd88`（杠杆 1–20x + KYC）。**交接其他同学见 `agent/handoff-2026-07-13.md`。**

## 验证结果（2026-07-09）

- 单测 17/17：clampLeverage 7 + useFollowParams 7 + copyTradingFollow.contract 3
- 本轮 31 改动文件 type-check 0 error（仓库遗留 error 与本 PR 无关）
- G3 PASS 21/21，code-rules OK 0 finding，G6 PASS（warn：rg ENOENT + 4 文件 scope 外已在 evidence 确认合法）
- MSW 闭环：业务码零 mock 耦合（grep 空）+ 契约测试守 mock↔schema 同源 → 「关 handler=切真实接口 0 改动」成立，已写回 03 §7/§8

## 下一步（G5 对账为主，前后台已合流）

前台 F01-F17（除 F15）+ 后台 F19-F21 展示层**均已落码并 commit**，二者共用同一批 ASSUMED 字段，等真实接口一起在 G5 销账。

**A. G5 真实接口对账（前后台一并做）**：后端 before_follow/save_follow/`cptrade/leader{,/follower}/export` 就绪后：

- 前台按 03-api-contract §6 三列表逐行核对，销 `// ASSUMED:`（`rg '// ASSUMED:' apps/web/src/services/api/copyTrading` 应归零），删 MSW handler（业务码 0 改动）。
- 后台按 03 §9 对账表逐行核对 KolListPanel 四字段（supportFollowLeverage/marginMode/leverage/copyPositionMode）与后端真实字段名，销后台 ASSUMED 注释；确认后端 `leaderExport`/`followerExport` CSV 已加列（前端 `outExcel` 纯触发，不改）。
- 待确认 Q3-Q7 见 06 §B；后台 isCopyPos→copyPositionMode 布尔转三态映射待 Q4 定夺。

**B. F15（依赖读图 Q8，暂缓）**：跟单者「复制全部仓位」取值改为选中币对「带单仓位」数，牵动 F21 后台展示口径，读图确认区域后再动。

## 历史：G4 编码时的 schema 扩展指引（已完成，留档）

三个 schema 都是 `z.infer` 单源，照现有注释风格加字段，**每个新字段打 `// ASSUMED: 待真实接口确认`**（§8.0.2，本项目无后端文档起步）：

1. **`save-follow.ts` `saveFollowSchema`**：加 `marginMode`/`leverageMode`/`leverage`/`copyPositionMode`（建议 `.optional()`，ASSUMED 阶段不破坏现有调用）。用 `marginModeSchema`(types/trade)、`leverageModeSchema`、`copyPositionModeSchema`。
2. **`setting-save.ts` `saveSettingSchema`**：同步加同 4 字段（**注意**：此 schema 现无 `isCopyPos`，是契约不一致 §5，本次补齐 copyPositionMode）。
3. **`before-follow.ts`**：
   - `followSettingSchema`(:43) 加 `leverageMin`/`leverageMax`/`leverageStep`（`z.number()`，照 fixedAmountMax 风格）。
   - `myFollowSettingSchema`(:64) 加 `marginMode`/`leverageMode`/`leverage`/`copyPositionMode` 回填 + `hasFollowPosition`（用文件内 `nullableStringValueSchema` 风格）。

字段名全部**同名直传**（§3.1），03-api-contract.md §6 三列对账表已登记为 ASSUMED，真实接口到位后 G5 逐条销账。

## 关键技术决策（必须知道，否则会走弯路）

1. **三表单是 90% 镜像**（Smart/Fixed/ProportionalCopyForm）。三参数控件**必须抽共享**（`useFollowParams` hook + `FollowParams/` 受控子组件），不能三处复制粘贴（§2 复用硬门禁）。
2. **复用源只复用 UI 骨架，不复用数据层**：`MarginModeModal`/`LeverageModal`（Futures）强耦合 orderStore/userConfig/contract.id/独立接口，且 LeverageModal 标了 `@deprecated`。照它们的 JSX 骨架（MarginModeModal:85-130 两卡手写 div/span+cn；LeverageModal:163 Slider `minValue/maxValue/marks/step` + ±按钮/输入联动共享同一 leverage state）重写成受控 `value/onChange`。
3. **保证金复用现有 `MarginModeEnum`**（types/trade.ts:78 Cross=1/Isolated=2 + marginModeSchema），不新建。
4. **前端唯一自判校验** = 自定义杠杆超币对 [Min,Max] 钳制 + Toast（F08，PRD 7.4.4）。其余隔离/复制/最小开仓全后端判定，失败展示 `getSaveFollowForbiddenMessage` 返回原因。
5. **F16 改动极轻**：广场页 `CopyTrading/index.tsx:20` + `AllTraders.tsx:8` 已在用 `useOpenContractModal({autoOpen:true})`，`isDismissable={false}` 已硬编码（点空白已不关）。**只缺** `hideCloseButton`——给 OpenContractModal 加透传开关即可，底层 Modal.tsx:41/43 已支持。
6. **F14 删提示**：三表单的 `marginConsistentTips`（SmartCopyForm:599-602 / Fixed:558-561 / Prop:565-568）。
7. **F13 确认弹窗加行**：ConfirmCopyModal 逐行 label:value 范式（:131-190），加保证金/杠杆/复制仓位三行 + Props 加对应字段。

## MSW 试点（路线 B，团队首次，最需谨慎的部分）

- 现状：**零基建**（msw 未装、无 `src/mocks/`）。
- **关键利好发现**：现有 SW 注册是 **production-only**（`utils/hooks/useServiceWorkerRegistration.ts:7` `SW_ENV_ENABLED=NODE_ENV==='production'`），MSW 是 dev-only → 时间互斥，无同 scope 单 SW 冲突。
- **唯一要处理的冲突**：该文件 :96-104 dev 分支会主动 `unregister()` 掉**所有** SW——会误清 MSW 的 worker。落地时要么放行 scriptURL 含 `mockServiceWorker` 的注册，要么保证 MSW 在这段清理**之后**再 `worker.start()`。
- `useBeforeFollow` 是 client hook（useQuery，浏览器请求）→ 只需 **browser worker**（setupWorker），不要 server 端。
- 落点：`src/mocks/handlers/copyTradingFollow.ts`（mock before_follow 返回**已存四参数**测编辑态回填）+ `src/mocks/browser.ts`；dev-only 在 Providers 或 instrumentation-client 起。
- 验证目标：「关 handler = 切真实接口，业务代码 0 改动」成立 → 写进 architecture-and-state.md §8.4 升级默认路线；同时更新记忆 `todo_msw_trial_next_project.md`（试点已启动）。
- **无拆除税**：不写 `if(USE_MOCK)`、无 `@mock-only`、无 env flag。

## 已读透的源码锚点（省得接手方重读）

- `SettingForm.tsx`：三表单容器；`isFollowed`(:38)=有跟随近似判据；三参数并进各子表单。
- `SmartCopyForm.tsx`：主表单范式；executeSubmit(:298) isFollowed 分支 saveSetting vs saveFollow；isCopyPos(:327)。Fixed/Proportional 镜像（executeSubmit 分别在 :237/:247）。
- 三 schema 全文已读，均 `z.infer` 单源。
- `ConfirmCopyModal.tsx` 全文已读。
- 枚举文件 `types/copyTrading.ts`、`types/trade.ts:78` MarginModeEnum 已读。

## 验证方式（按记忆「验证分工」）

- Agent 跑：Vitest 逻辑/边界（钳制纯函数、枚举默认、回填映射）、`diffStrippedKeys` 对 before_follow realFixture 对账、type-check、lint、G6 gate。
- 人工跑：视觉/手感（原型 8411-1559 并排、Slider 手感、390px）。

## Gate 命令

```bash
cd /Users/aven/github/fameex-web   # 或对应工作副本根
node apps/web/docs_tdd/common/engine/agent-scripts/verify-project-gate.mjs PR-01947 G3   # 应 PASS 21/21
node apps/web/docs_tdd/common/engine/agent-scripts/verify-code-rules.mjs --project PR-01947
node apps/web/docs_tdd/common/engine/agent-scripts/verify-project-gate.mjs PR-01947 G6   # 编码后
```

## 待后端确认（Q3-Q7，见 06-collaboration.md，不阻塞本轮 UI）

- Q3 `hasFollowPosition` 真实字段（现用 isFollowed 近似禁改判据）
- Q4 isCopyPos→copyPositionMode 替换 or 并存
- Q5 杠杆范围来源（followSetting 新增 or 合约杠杆配置接口）
- Q6 保证金默认值 / Q7 跟随模式是否展示交易员杠杆
