# Frontend Tasks — PR-01947

> 每个「本期=做」的功能 ID（00-feature-inventory.md）至少一条任务。备注链到权威展示约束或 PRD 章节，不只链 Figma。JF\* = 95% UI 还原专项（L2 视觉，见 component-reuse-and-visual-fidelity §3）。

## 实现状态快照（2026-08-01 审计更新）

| 类别                 | 状态              | 说明                                                                           |
| -------------------- | ----------------- | ------------------------------------------------------------------------------ |
| F01–F14, F16, F17    | **逻辑已合码**    | `FollowParams/` + 三表单 + schema；MSW 试点已拆 handler，当前 dev 直连真实 API |
| **T-F17 提交层映射** | **✅ 已落码**     | `toParams()` marginMode 0/1/2 · leverageMode 0/1 · customLeverageLevel(number) |
| F19–F21 后台         | **展示代码已落，功能未完成** | `KolListPanel.vue` 已有列与 formatter；F20/F21 缺真实 `follower/page`、`follower/export` 契约和响应对账，三条后台 P0 用例均未执行 |
| F15                  | **✅ 已落码**     | 接真实接口 `lead-position-count.ts`（`8a71fde`，YApi 5752），复制全部取选中币对带单仓位数；仅余 Q8 读图 |
| F07（后端杠杆范围）  | **证伪**          | 前端硬编码 1–20x                                                               |
| **止盈止损/仓位风险单位** | **✅ 已对齐 online** | `badd923ff3`：止盈止损小数比例原样透传（placeholder 动态上下限）；仓位风险 UI 百分数 ↔ API 小数（50→"0.5"），见 `03-api-contract.md` §3.2 |
| **跟单单测**         | **37/37 通过**    | clampLeverage 7 + useFollowParams 16 + before-follow 2 + followRateParams 9 + resolveIsFollowed 3 |
| **Figma 规格**       | **✅ 2026-07-14** | 智能比例 Tab · `07-figma-spec.md` + `05-ui-and-interaction.md`                 |
| **JF1 / JF2**        | **✅ 已落码**     | `c3c0b3b19a` Select/Switch 范式 + 确认弹窗三行；P0 人工像素走查业务确认 2026-07-21 |
| **YApi 对账映射**    | **Web 前台已完成** | Cat-1489 只覆盖前台 follow 接口及 KOL 列表/导出；未覆盖后台 `cptrade/leader/follower/page` 与 `follower/export` |
| G5 对账              | **BLOCKED**       | Web 前台已对账；F19 导出后端待办，F20/F21 字段与导出契约未确认，ST-040～042 均待执行 |

交接给其他同学：**`agent/handoff-2026-07-14.md`**（AI 入口 · 含 JF1 编码指南）

## 前置（G2 确认 / G3 契约后开始）

- [x] G2 用户确认 06-collaboration.md A/B 清单（scope + 契约字段）· 2026-07-08
- [x] G3 与后端敲定 save_follow/setting_save 入参、before_follow 返回字段（Q3-Q7）· YApi Cat-1489 2026-07-14
- [x] G4 建 feature/PR-01947 worktree（基于 origin/online）

## 保证金模式（PRD 7.3）

- [x] **T-F01** 保证金模式选择器（全仓/逐仓），复用 `MarginModeEnum`(types/trade.ts)，受控 props → SettingForm/三表单 · 依据 PRD 7.3.3
- [x] **T-F02** 全仓选中风险提示文案（共享保证金/连锁强平），`copyTrading` i18n · PRD 7.3.3
- [ ] ~~**T-F03** 有跟随持仓时禁改保证金模式~~ · **前端不自判**：禁改由后端在提交时校验并返回失败原因（2026-07-21 定案，前端 disabled 判据已删）
- [x] **T-F04** 保证金模式在智能比例/固定额度/倍率三表单均渲染 · PRD 7.3.2

## 杠杆调整（PRD 7.4）

- [x] **T-F05** 杠杆模式二选一「跟随交易员/自定义」，默认跟随，参考 Futures LeverageSetting 布局 · PRD 7.4.3
- [x] **T-F06** 自定义杠杆滑块（拉杆↔输入联动），复用 `@fameex/ui` Slider · PRD 7.4.3
- [ ] ~~**T-F07** 杠杆范围/步长读后台配置（依赖 Q5 字段），步长跟随合约杠杆~~ · **证伪**：2026-07-10 需求变更，前端硬编码 1–20x（`CUSTOM_LEVERAGE_MIN/MAX/STEP`），后端不下发 · PRD 7.4.3
- [x] **T-F08** 自定义杠杆超 [Min,Max] 钳制 + Toast（前端唯一自判校验）· PRD 7.4.4（钳制目标 = 前端硬限制 1–20x）
- [ ] ~~**T-F09** 有跟随持仓时禁改杠杆~~ · **前端不自判**：同 T-F03，禁改由后端提交时校验（2026-07-21 定案）

## 复制仓位（PRD 7.5）

- [x] **T-F10** 复制仓位三选项单选列表（复制所有/复制更好价/不复制），新增 `CopyPositionMode` 枚举 · PRD 7.5.2
- [x] **T-F11** 默认选中「复制价格更好的持仓」· PRD 7.5.2
- [x] **T-F12** 选中态 ✓ + 展开列表三项可点切换 · PRD 7.5.2（按正式稿改 Switch + Select 范式，JF1）

## 确认弹窗 / 文案 / 优化（PRD 7.7-7.10）

- [x] **T-F13** ConfirmCopyModal 新增保证金模式/杠杆/复制仓位展示行（轻量封装+props）· PRD 7.7（JF2 `c3c0b3b19a`）
- [x] **T-F14** 删除三模式底部「保证金/杠杆与交易员一致」提示文案 · PRD 7.8
- [x] **T-F15** 「跟单后复制全部仓位」取值改为选中币对带单仓位数 · PRD 7.10 优化一（已接真实接口 `lead-position-count.ts` `8a71fde`；仅余 Q8 读图确认落点）
- [x] **T-F16** 进跟单广场触发开通合约弹窗（复用 OpenContractModal，隐藏关闭 icon + 点空白不关）· PRD 7.10 优化二

## 数据 / 契约（PRD 6.2 / 10.5）

- [x] **T-F17** save_follow/setting_save 扩 schema（marginMode/leverageMode/customLeverageLevel/copyPositionMode）；before_follow 回填 · 按交易员独立保存 · PRD 6.2
- [x] **T-F18** App/Web 读写同一接口保证同步（后端保证，前端接同一契约）· PRD 10.5

## 合约管理后台（PRD 7.9 / 10.6）— futures-admin/legacy-admin（Vue2，与 apps/web 隔离）

> 落点确认（agent 探查 2026-07-08）：**`apps/futures-admin/legacy-admin`**（`cptrade/*` 接口），非 `apps/admin`。KOL列表 + 跟单者详情弹窗均在 `viewsTemplate/copyTrading/components/KolListPanel.vue`。三字段+isCopyPos 后台当前不存在，属新增。导出后端生成 CSV，前端只触发下载。

- [ ] **T-F19** KOL列表展示代码已落并对账 `customLeverageRange`；仍需确认 `leaderExport` CSV 已加列并执行 ST-040/导出验收后才可完成 · PRD 7.9
- [ ] **T-F20** 跟单者详情弹窗展示代码已落；需取得 `cptrade/leader/follower/page` 真实契约/响应，确认 `marginMode` 值域与 `leverage` 类型，并核对 `followerExport` CSV 后执行 ST-041/042 · PRD 7.9
- [ ] **T-F21** 跟单者详情弹窗展示代码已落；需取得真实契约/响应确认 `copyPositionMode` 及历史 `isCopyPos` 兼容口径，并执行 ST-041/042 · PRD 7.9

## JF\*（G6 L2 视觉还原，基线 `product/07-figma-spec.md`）

- [x] **JF1** 保证金/杠杆/复制三控件与**正式三期稿**并排 L2（Select/行内 Radio/Switch 范式）· 已落 `c3c0b3b19a`；P0 人工像素走查业务确认 2026-07-21
- [x] **JF2** 确认弹窗新增三行（保证金/杠杆/复制仓位）+ i18n；`ConfirmCopyModal.tsx` 已落 `c3c0b3b19a`
