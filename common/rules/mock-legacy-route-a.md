# Mock 路线 A：`if(USE_MOCK)` 拆除税（遗留功能适用）

> AI 主用。**新功能一律走 MSW 路线 B**（见 [architecture-and-state.md](./architecture-and-state.md) §8.4.1），本文只对「未采用 MSW 的遗留功能」适用。路线 A 是「mock 进了生产代码、事后拆干净」的一整套拆除税；MSW 让 mock 从不进生产代码路径，结构上不需要本文这套规则。
>
> 章节号沿用 architecture-and-state.md 历史编号（§8.0 / §8.0.1 / §8.0.3 / §8.3），供既有外链无缝指向；共用规则（字段假设标记 §8.0.2、字段对账 §8.1、禁兜底 §8.2）仍在 [architecture-and-state.md](./architecture-and-state.md)。

## 何时才用路线 A

- 默认不用。新功能走 MSW；无法采用 MSW 必须先在项目 `agent/rule-waivers.json` 登记豁免并说明替代方案，才允许用本文路线 A。
- 存量遗留功能（如 Campaign）按需迁移，不强制回填 MSW；未迁移前按本文规则拆干净。

## 8.0 五条隔离原则（阶段①②即做到，为阶段③零残留拆除铺路）

1. **单一接缝**：真假切换只在 service 层一个函数内（`if (USE_MOCK) return mockFetchXxx()`）。组件/hook/mapper 禁止任何 mock 判断。
2. **物理隔离 + 命名**：mock 代码进专属目录/文件（`services/api/<feature>/__mock__/` 或 `xxx.mock.ts`），绝不 inline。拆除 = `rm -rf __mock__/` + 删 service 的 import 与 `if`。
3. **Mock 产出 DTO 不产出 UI 模型**：造与真实接口一致的 DTO，流经真实 schema+mapper+UI 类型。切接口时 mapper/types/UI 不动；拆时只删假 DTO 工厂。
4. **统一标记 `// @mock-only`**：每处 mock-only 代码/文件/env 打标记。拆完 `grep -rn "@mock-only" apps/web/src/apps/<feature> apps/web/src/services/api/<feature>` 必须空。
5. **环境开关而非写死**：`NEXT_PUBLIC_<FEATURE>_USE_MOCK`。拆除时删掉 flag，而非留着设 `false`（防静默重启用）。

## 8.0.1 拆除的 vs 保留的（别把契约代码当 mock 删）

| 拆除（mock 脚手架，零残留） | 保留（真实契约代码） |
|------------------------------|----------------------|
| mock fixture / 假 DTO 工厂（`__mock__/`、`*.mock.ts`） | schema / zod 校验 |
| service 里 `if (USE_MOCK)` 分支 + mock import | mapper / selector |
| `NEXT_PUBLIC_<FEATURE>_USE_MOCK` env 与读取 | UI 领域类型 |
| Mock 场景矩阵接线、`?scenario=` 分支 | 纯函数（金额/排序/状态机/跳转） |
| 所有 `// @mock-only` 行 | 组件 / hook（本就只调 `fetchXxx()`） |

## 8.0.3 拆除三道闸（可证明拆干净）

| 闸 | 门禁 | 动作 |
|----|------|------|
| 登记 | G3 | 写 mock 同时在 `03-api-contract.md`「Mock 拆除清单」登记：每个 mock 文件/标记 → 对应真实接口 |
| 拆除 | G5 | 接口就绪 + [architecture-and-state.md](./architecture-and-state.md) §8.1 对账通过时逐行删 mock、勾清单、删 `USE_MOCK`；`grep -rn "@mock-only"` 空才算切完 |
| 交付 | G6 | Review 硬项：`grep -rn "@mock-only" <feature>` 空、flag 已删、拆除清单全绿；非空打回 |

## 8.3 生产构建物理排除 mock（纵深防御，CODE-MOCK-004）

§8.0-§8.2 都是「靠人+review 拆干净」的防线；本节加一道**机器兜底**：即使人忘了拆，mock 也不进生产包。原理 = 用平台原生的**编译期常量内联 + 死代码消除（DCE）**，不引额外构建配置。

1. **开关用 `NEXT_PUBLIC_<FEATURE>_USE_MOCK`，判断写成编译期可判定的显式比较**：`if (process.env.NEXT_PUBLIC_X_USE_MOCK === 'true') { …mock… }`。Next 把 `NEXT_PUBLIC_*` 在 build 时内联成字面量；prod 该值非 `'true'` → 整个 `if` 分支被 DCE 删除，mock import 一并 tree-shake 出包。**别写成运行时函数**（`const on = () => process.env... === 'true'` 再到处调）——函数边界会挡住 DCE，mock 仍进包。
2. **拆除时删 flag，不是设 `false`**（§8.0 第 5 条）：留 `=false` 会被 `CODE-MOCK-004`（error）打回。因为「设 false」= 拆除只做了一半（分支逻辑、mock 文件、import 往往都还在，见 PR-01685 Campaign：4 个 env 留 `=false`、1213 行 mock 代码全在、`useMock===false` 绕过而非删除）。flag 删干净会倒逼把读它的分支和 mock 脚手架一起清。
3. **`CODE-MOCK-004` 全量扫 env（非 diff）**：残留是存量问题，任何一次 gate 运行都检查 `.env.{dev,test,pre,prod}`，出现 `NEXT_PUBLIC_*USE_MOCK` 即 error。这弥补了 §8.0.3 `@mock-only` grep gate 的盲区——那个 gate 只在有人打标记时有效，标记为 0 时永远误报为空（PR-01685 即全项目 0 个 `@mock-only`，grep gate 形同虚设）。
4. **`CODE-MOCK-005` 全量扫 mock 泄漏（非 diff）**：mock 脚手架（`/mock/`、`__mock__/`、`*.mock.ts`、`mockXxx.ts`）被**非测试生产代码** `import` 即 error。这是比 flag 更根本的泄漏信号——只要生产文件引了 mock，无论开关真假，mock 都在生产依赖图里。同样不依赖人打标记（用「谁 import 了 mock」结构判定）。PR-01685 `campaign.ts` 直接 `import from './mockApi'` 即被此规则抓到。正解：mock 只由 service 层单一 `if (USE_MOCK)` 接缝引用（§8.0 第 1 条），拆除时连同接缝删除。

> 收益定级：本节把「忘拆 mock」从 P0 线上事故（mock 数据/逻辑进生产包）降到 P2 代码卫生（分支存在但已被 DCE 删除、env/泄漏 gate 会催删）。是 §8.0-§8.2 那套「拆除税」防线之外的最后一道物理网。
