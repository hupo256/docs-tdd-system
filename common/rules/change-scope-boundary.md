# 改动边界与影响半径（Change Scope & Blast Radius）

> AI 主用。**核心**:改动限定在**责任模块**内。一旦触碰责任模块之外——无论**公共/共享模块**还是**其他业务模块**——都必须先发**警告**并进**重点 check**,证明不影响无关功能/模块/调用方。章节号 §1.1 被外链引用,勿改编号。

## 1. 术语

- **责任模块**:当前需求 G2 定稿后明确「做」的功能所归属的目录/feature。通常是某个 `apps/<app>/src/apps/<Feature>/**` 或 `apps/<app>/src/app/<route>/**`,及该功能私有的 service/hook/util/i18n key。
- **责任模块外**:任何不属于当前需求责任模块的代码,分两类,都受本规则约束:
  - **公共/共享模块**（外溢面最大）:
    - `packages/**`（`ui`/`utils`/`types`/`icon`/`config`/`be-shared` 等）
    - `apps/web/src/components/**`（跨业务通用组件,如 `Modal.tsx`）
    - `apps/web/src/utils/**`、`hooks/**`、`services/**` 里被多处 import 的通用能力
    - `apps/web/src/i18n/**` 公共 namespace、`packages/config/tailwind-preset.js`
    - 全局 store、全局 provider、路由表 `constants/pathnames.ts` 等全局契约文件
  - **其他业务模块**:不属于本需求的其它 feature 目录（`apps/**/src/apps/<OtherFeature>/**` 等）。

### 1.1 责任模块目录如何机器判定（消除歧义）

不靠 Agent 临场猜。判定来源按优先级:

1. **首选:G2 定稿时显式登记**。在 `product/00-feature-inventory.md` 元信息区加一行 `| 责任模块目录 | apps/web/src/apps/Campaign/**, services/api/campaign/** |`,多个逗号分隔。此表即目录白名单:改动落白名单内 = 责任模块内,落外 = 越界。
2. **兜底:从功能清单反推**。无显式登记时,取 `00-feature-inventory.md`「实现页面/路由」列涉及的所有路由,映射到对应 `apps/**/src/apps/<Feature>/**` 与其私有 service/hook/util 目录,合成白名单。
3. **判定示例**:改 `apps/web/src/apps/Campaign/**` → 白名单内,正常改;改 `apps/web/src/components/Modal.tsx` → 不在白名单且是公共组件 → 越界,走 §2.2 警告 + §4 重点 check。

Agent 在 G4 编码前先确认白名单（首选读第 1 项,缺失则按第 2 项现推并回写第 1 项）,后续判「是否越界」一律对照这份白名单。

### 1.2 客户端责任边界：docs_tdd 只交付 Web 端

- docs_tdd 管理的需求默认只交付 `apps/web`；App（Native/RN）侧由兄弟团队交付，不在本仓实现，也不从本仓验收。
- 类比 i18n 只考虑中文（quality-checklist.md）：本地开发与验收只覆盖 Web；App 侧 PRD 条目不丢弃、不默写，显式移交。
- vNext work-item 中，locator 为 App 的 surface 一律标 `disposition: "deferred"` 并带 `reason` + `owner`（App owner）+ `batch`；纯 App 需求从 Web 批次移出、记入 App 交接批次，不阻塞 Web 出口。

## 2. 硬规则

1. **默认收敛**:新增/修改功能原则上只改**责任模块**内文件。能在责任模块内解决的不外扩。
2. **越界即警告**:任何改动落责任模块之外（公共/共享 **或** 其他业务模块）,Agent 必须**动手前显式警告**,说明:改的哪个文件/导出符号、属公共还是哪个其他业务模块;为什么责任模块内解决不了必须越界;影响半径（哪些功能/模块/调用方依赖它,见 §3 grep）。
3. **重点 check**:确需越界时进**重点 check**（§4）,**核心目标是证明「不影响无关的功能/模块/调用方」**,并把决策与影响面写入 `product/06-collaboration.md` 与 `engineering/development-rules.md`。
4. **优先非侵入方案**:越界前先评估能否用**扩展**而非**修改**——新增可选 prop（带默认值、保旧行为）、包 wrapper、责任模块内组合,而非改既有分支/默认值/签名。
5. **禁止顺手改**:不得借当前需求「顺手」重命名/重构/格式化/调整责任模块之外无关代码;此类改动单独立项。
6. **锚点注入例外**:为引导/埋点在既有组件加**纯附加、无行为副作用**的锚点（如 `data-tour-*`、`data-testid`）视为低风险,仍需在方案列明落点,但不触发完整重点 check。

### 2.1 越界后是继续还是阻塞（gating 语义）

发警告不等于自动放行。按改动性质分档:

| 改动性质 | Agent 行为 |
|---------|-----------|
| 纯扩展（新增可选 prop 带默认值/wrapper/新增文件）,且 §4 重点 check 全绿、typecheck 通过 | 可继续实现,无需等人工批准;但必须把警告+影响面写入 `06-collaboration.md` |
| 改既有行为/默认值/签名/删除,或 §4 重点 check 有任一项无法自证无回归 | **阻塞**:停止该越界改动,在 `06-collaboration.md` 记待确认,启用 Lark 发「阻塞中」@ 责任人;**得确认前不落这部分代码**,可先做责任模块内不依赖该越界的部分 |
| 触碰 `tailwind-preset.js`、全局 store、`pathnames.ts` 等全局契约文件 | **一律阻塞**并等人工确认,无论改动多小 |

判据:**能自证「无关功能不受影响」就可继续,不能自证就阻塞等确认**——不允许「先改了再说」。

## 3. 影响半径评估（越界改动前必做）

改任一责任模块之外的文件/导出符号前,先 grep 出被谁引用,估爆炸半径:

```bash
# 谁 import 了这个模块 / 组件 / 符号
grep -rn "from '@/components/Modal'" apps/web/src --include=*.tsx --include=*.ts | wc -l
grep -rn "ComponentName" apps/web/src packages --include=*.tsx --include=*.ts
```

- 引用方包含本功能之外的功能 → 属外溢,走 §2.2 警告 + §4 重点 check。
- 把「受影响的其他功能/模块/调用方清单」写进 `06-collaboration.md`,逐个确认不回归。

## 4. 重点 check 清单（越界改动时逐条过）

- [ ] 已 grep 出全部引用方,列出受影响的其他功能/模块/调用方（§3）。
- [ ] 优先用**新增可选参数/扩展**而非改既有行为;默认值保旧调用方行为不变。
- [ ] 未改与本需求无关的既有分支、默认值、类型签名。
- [ ] 若改了公共类型/签名,全部调用方已同步、typecheck 通过。
- [ ] 受影响的其他功能已抽样验证无回归（关键路径/快照/取值比对）——**明确证明无关功能未被波及**。
- [ ] 决策、原因、影响面已写入 `06-collaboration.md`;项目特殊约束写入 `engineering/development-rules.md`。
- [ ] 触达文件已跑 Biome;公共包改动确认不破坏其它 app 构建。

## 5. 与其他规则的关系

- 与 [component-reuse-and-visual-fidelity.md](./component-reuse-and-visual-fidelity.md):复用盘点解决「要不要新建」,本规则解决「改到哪、允许改多大范围」。复用已有模块时**只读不改**是理想态;一旦需改它（无论公共还是其他业务）触发本规则。
- 与 [architecture-and-state.md](./architecture-and-state.md):分层规定代码放哪层,本规则规定改动的横向边界。
- 与 [verification-division-of-labor.md](./verification-division-of-labor.md):重点 check 的回归验证按验证分工执行（Agent 跑逻辑/契约,人工跑视觉/手感）。
