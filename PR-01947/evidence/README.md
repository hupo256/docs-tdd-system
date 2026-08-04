# PR-01947 交付证据 — G4 前台编码 + MSW 试点

> 本轮范围：F01-F14/F16/F17 前台（apps/web）+ MSW 网络层 mock 试点（§8.4 路线 B，团队首次）。
> 记录时间：2026-07-09。验证方式按「验证分工」：Agent 跑逻辑/边界/契约（Vitest + type-check + gate），人工跑视觉/手感。

## 1. 代码进度

| 模块 | 交付 | 文件 |
|------|------|------|
| 共享参数控件（§2 复用硬门禁） | `useFollowParams` hook + 受控子组件 MarginModeField/LeverageField/CopyPositionField | `apps/web/src/apps/CopyTrading/components/CopySetting/FollowParams/` |
| 三表单重构 | Smart/Fixed/Proportional 逻辑抽到 `use*CopyForm` + `*AdvancedSettings`，消除 90% 镜像复制 | 同目录 |
| schema 扩展 | before-follow/save-follow/setting-save 四参数 + 杠杆范围 + hasFollowPosition，全标 `// ASSUMED:` | `apps/web/src/services/api/copyTrading/follow/` |
| F13/F16 | ConfirmCopyModal 加三行、OpenContractModal `hideCloseButton` 透传 | Modals / OpenContractModal |
| 枚举 | LeverageMode / CopyPositionMode | `apps/web/src/types/copyTrading.ts` |

## 2. MSW 试点验证（§8.4 路线 B 闭环）

**命题**：「关掉 handler = 切真实接口，业务代码 0 改动」。

| 验证点 | 方法 | 结果 |
|--------|------|------|
| 业务代码零 mock 耦合 | `rg 'USE_MOCK\|@mock-only\|isMock' CopyTrading services/api/copyTrading` | ✅ 空 |
| mock 与真实契约同源 | `copyTradingFollow.contract.test.ts` 用真实 `beforeFollowSchema.parse` 校验 handler response | ✅ 3/3 通过 |
| dev-only 不进生产 | `useMockWorker` 仅 `isEnvDevelopment()` start；production SW 互斥 | ✅ 静态确认 |
| SW 不误清 | `useServiceWorkerRegistration` 放行 scriptURL 含 `mockServiceWorker` 的注册 | ✅ 代码确认 |

**结论**：路线 B 零拆除税成立。拆除动作 = 删 handler（业务码 0 改动），见 03-api-contract §8。

## 3. 单元测试

| 测试 | 覆盖 | 结果 |
|------|------|------|
| `clampLeverage.test.ts` | 自定义杠杆超 [Min,Max] 钳制（F08 唯一前端自判校验） | ✅ 7/7 |
| `useFollowParams.test.ts` | 三参数受控 hook 逻辑/回填/默认 | ✅ 7/7 |
| `copyTradingFollow.contract.test.ts` | MSW handler ↔ schema 对账 | ✅ 3/3 |

## 4. Gate 结果

| Gate | 状态 |
|------|------|
| G3 | PASS 21/21 |
| code-rules | OK（0 finding，globalScan） |
| 本轮 31 改动文件 type-check | 0 error |

## 5. 责任目录外改动确认（CODE-SCOPE-001 warn，§1.1）

以下 4 个文件落在责任模块目录外，均为计划内合法的公共能力改动，非越界：

| 文件 | 改动 | 合法性 |
|------|------|--------|
| `app/[lang]/Providers.tsx` | 挂载 `useMockWorker()` | MSW 试点必须的 dev-only 启动点，2 行 |
| `components/modals/OpenContractModal/OpenContractModal.tsx` | 加 `hideCloseButton` 透传开关 | F16 明确需求，底层 Modal 已支持，纯透传 |
| `types/copyTrading.ts` | 加 LeverageMode/CopyPositionMode 枚举 | 计划 A 节第一步，类型定义 |
| `utils/hooks/useServiceWorkerRegistration.ts` | 放行 scriptURL 含 `mockServiceWorker` 的注册 | MSW SW 冲突处理，1 行 filter |

> CODE-MOCK-002 的 rg ENOENT 为 gate 脚本 spawn 环境问题（本地手动 `rg` 已验证责任模块零 mock 残留，见第 2 节）。

## 6. 人工待验（不阻塞代码门禁）

- 视觉/手感：原型 8411-1559 并排、Slider 手感、390px 窄屏
- 后端确认 Q3-Q7（见 06-collaboration）：hasFollowPosition 真实字段、isCopyPos→copyPositionMode 替换/并存、杠杆范围来源、保证金默认值、是否展示交易员杠杆

## 7. 后台 F19-F21 交付（futures-admin/legacy-admin，Vue2）

commit `4002bc85`（+35）KolListPanel.vue 展示层全落，字段全 ASSUMED（后台真实接口无此字段），登记见 03 §9.1。

| 功能 | 交付 | 落点 |
|------|------|------|
| F19 | KOL 列表加「支持跟随杠杆」列 + `formatSupportFollowLeverage` + `mapKolItem` 映射 | `fields()` / `mapKolItem` |
| F20 | 跟单者弹窗加「保证金模式/杠杆」列 + formatter + `mapFollowerItem` 映射 | `followerFields()` / `mapFollowerItem` |
| F21 | 跟单者弹窗加「复制全部仓位」列（三态 copyPositionMode，替旧 isCopyPos） | 同上 |

- **渲染路径核实**：三列均无 `#cell()` 自定义模板，走 `b-table` 默认渲染 `item[key]`；值在 mapper 阶段已 formatter 转文本（同该文件 `traderSinceTime` 风格）→ 直接显示 ✓
- **导出核实**：`buildExportParams`/`buildFollowerExportParams` 仅传查询条件，`outExcel` 后端生成 CSV（arraybuffer）→ 前端不拼列、无需改，后端加列即可
- **语法核实**：`node --check`（module 模式，含 import）通过；legacy-admin 无独立 node_modules，未跑 vue-cli lint（改动为标准增量对象/方法语法）

## 8. 下一轮

- G5 前后台一并对账：真实接口就绪后销 web `// ASSUMED:` + 删 MSW handler，并核对后台四字段真实名/值域（03 §9.1）+ 后端 CSV 加列
- F15（依赖读图 Q8，暂缓）：牵动 F21 后台展示口径
