# Rule IDs And Machine Gates

> AI 主用:把 `docs_tdd` 关键规则固定成可引用 ID,并定义哪些由机器 gate 执行,让规则出现在脚本输出、Lark 通知、交付报告、Review 结论里,而非只靠自然语言记忆。
> 规则从触发到失败处理的完整执行契约见 [rule-execution-model.md](./rule-execution-model.md)；本文只维护 Rule ID、严重度和机器 gate 真值。

## 1. Rule ID 约定

| 前缀 | 范围 | 示例 |
|------|------|------|
| `DOC-*` | 文档结构、阶段状态、功能清单、复用盘点 | `DOC-G2-004` |
| `CODE-*` | 代码静态规则,只检查新增或已修改文件 | `CODE-TYPE-001` |
| `GIT-*` | 分支、worktree、合并方向 | `GIT-G4-001` |
| `VERIFY-*` | 自测证据、交付证据、Review 记录 | `VERIFY-G6-001` |

新增硬规则必须给 ID;能机器判断的必须加入对应 gate;暂不能机器判断的必须说明证据格式和人工确认责任。

## 2. 项目阶段 gate

当前本地规则集见 `common/rules/ruleset.json`。试点规则按 `experimental → trial → stable` 晋级：`experimental` 只诊断，`trial` 默认只阻断新项目，`stable` 才进入常规阻断。项目在 `agent/project-manifest.json` 固定 `rulesetVersion` 与 gate policy；规则升级默认不回查阻断存量项目。

公共入口:

```bash
node apps/web/docs_tdd/common/engine/agent-scripts/verify-project-gate.mjs PR-01234 G2
node apps/web/docs_tdd/common/engine/agent-scripts/verify-project-gate.mjs PR-01234 G6 --json
node apps/web/docs_tdd/common/engine/agent-scripts/verify-project-gate.mjs PR-01234 G6 --verbose  # 全量逐条
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs gate PR-01234 G5              # 正式落证据并推进
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs gate PR-01234 G6 --no-cache
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs gate PR-01234 G7
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs gate PR-01234 G8
```

默认瘦输出:只打印需行动行（`FAIL`/`WARN`/`WAIV`）+ 一行 summary,通过项折叠成计数;`--verbose` 才逐条全量,`--json` 输出结构化结果不受影响。

当前覆盖范围:

| Gate | 机器检查重点 | 说明 |
|------|--------------|------|
| G0/G1 | G0 验项目骨架、PRD 来源、功能清单与验收映射；G1 另验 scope、复用盘点、任务清单和协作记录已形成可评审初稿 | 区分资料接收与文档生成出口 |
| G2/G3 | `00-feature-inventory.md` 无阻断占位;每条功能 `本期=做/不做/延期`;G2 确认人和日期;本期做的功能 ID 进入 `04-frontend-tasks.md` | 阻止 scope 未定稿就写代码 |
| G4 | 技术方案复用盘点无占位；模板 v2 的单一事实源所有权表存在且无占位；不出现 `跳过复用`；当前分支是 `feature/<PROJECT-ID>` 且基于 `origin/online` | 阻止未完成复用/所有权盘点或在错误分支编码 |
| G5 | `stage-status.json` 的 G5 为 `completed`/`not-applicable`；真实联调有证据，或 N/A 有具体原因；API 契约、字段对账、Mock/ASSUMED 状态一致 | 阻止关键词占位冒充真实联调完成 |
| G6 | 已有 G5 PASS 历史；结构化验收结果覆盖每个本期功能，`code-review.json` findings 清零；**并实跑 biome/tsc/vitest（§3.5 机器事实层）** | 阻止跳过联调、验收或靠散文冒充 review |
| G7 | 已有 G6 PASS 历史；G7 为 `completed`/`skipped`，完成项有 QA 证据，跳过项有具体原因；机器事实层同 G6 | 阻止复用 G6 校验冒充 QA 完成 |
| G8 | 已有 G7 PASS 历史；实跑 production build；交付模式为 pushed/merged/released；工作树干净且 Git 远端状态可验证 | G8 仍是唯一终点，同时证明代码真正可交付 |

这些检查只覆盖机器可判定部分;PRD 语义、视觉手感、复杂复用判断仍需人工或 `/code-review` 兜底,但必须留证据。

### 2.1 严重度与时点检查

- 检查分 `error`（阻断,`ok=false` 让 gate 退出码非 0）与 `warn`（不阻断,只提示）。可选字段未填、可选章节缺失、无法扫描等用 `warn`,避免「未填可选项」卡交付。当前 `warn` 项:`DOC-G0-004`（PRD 未完全可读章节）、`CODE-MOCK-001`（责任模块目录未填时）、`CODE-MOCK-002`（`rg` 不可用时）、`CODE-MSW-003`（MSW handler 处置记录,不同项目阶段可能先转测试再删除）、`CODE-NAMING-001`（mapper 改名无跨来源/派生结构化理由,渐进 warn-first）、`CODE-MOCK-003`（真实接口后假默认兜底,渐进 warn-first）、`CODE-ARCH-003`（分层反向依赖的 changed-file import 候选,渐进 warn-first + G6 裁决）、`CODE-ASSUMED-001`（责任模块残留 `// ASSUMED:`,「接口是否 ready」靠人判故 warn）、`CODE-SCOPE-001`（改动越出责任模块目录,跨模块重构可能合法故 warn + 重点 check）、`CODE-COPY-001`（apps 下硬编码中文展示文案,存量多故 warn-first,催走 i18n+§7 契约表）、`VERIFY-TYPE-002`（存量 tsc 涟漪,改共享类型可能合法故 warn）、`VERIFY-TEST-002`（逻辑文件缺单测,「值不值得测」靠人判故 warn）。
- **warn → error 晋级判据（防「永久 warn」）**:渐进 warn-first 的规则不是永远 warn。满足全部即提 error:① 连续 **2 个真实 PR** 命中该规则且**零误报**（误报=规则报了但人工判定不该报,如 §3 提到的 lang-locale 类、流程控制类 if）;② 命中项都能给出明确修法（非「无法处理」）。达标后把脚本里该 finding 的 `'warn'` 改 `'error'`、更新本节列表、在 PR 里记一句「CODE-XXX warn-first 达标,提 error」。**未达标不提**——误报会 error 卡正常交付,比漏报更伤信任。
- **晋级台账（机器记录，取代手填表）**:判据 ① 靠人脑记不住也无法复核,且手填表长期为空(见 CHANGELOG 2026-08-03)。改为机器台账 `common/warn-ledger.json`,由 `warn-ledger.mjs` 维护:
  - **自动记录**:`docs-tdd gate --write`(G5+)命中可晋级 warn 规则时,自动按 `(ruleId, PR)` 入账(一 PR 一格,verdict 默认 `unreviewed`),无论 gate PASS/BLOCK。
  - **人工复核**:`node warn-ledger.mjs --mark <RULE> <PR-xxxxx> <true-positive|false-positive> --write` 标注该命中是真命中还是误报(误报请在 PR/CHANGELOG 记形态供改正则)。
  - **晋级候选**:`node warn-ledger.mjs --report` 计算——某规则满 **≥2 个 true-positive PR 且零 false-positive** 即列为 `ELIGIBLE`;任一 false-positive 使其失格(对应「误报归零重计」)。达标后人工把脚本里该 finding 的 `'warn'` 改 `'error'` 并在此更新。
  - **范围**:仅登记计划晋级的 warn-first 规则(`warn-ledger.mjs` 的 `PROMOTABLE` 集:`CODE-NAMING-001`/`CODE-MOCK-003`/`CODE-ARCH-002`/`CODE-ARCH-003`/`CODE-STYLE-003`/`CODE-QUERY-001`/`CODE-QUERY-002`/`CODE-MOCK-006`/`CODE-COPY-001`);`CODE-MOCK-001/002`、`CODE-MSW-003`、`CODE-ASSUMED-001`、`CODE-SCOPE-001` 等「按阶段/场景合法」的永久 warn 不进台账。
  - `warn-ledger.json` 是可变执行状态,不参与规则内容指纹(已在 `rule-release` 排除),同 `gate-results.json` 一类。
- **直接 error 不走 warn-first 的例外**:数据正确性 bug 根因类规则一步到位判 error,不给缓冲期。`CODE-TYPE-002`（`schema.parse(x) as T` 字段静默消失,§3）即属此类——它不是风格偏好,命中即真 bug,正则精确（负向前瞻放行 `as const`)无误报空间。
- `GIT-G4-001`（分支身份）、`GIT-G4-002`（基线基于 `origin/online`）是**时点检查**:只描述 G4 正在编码那一刻的状态,只有**显式请求 `G4`** 时才执行;累积校验 G5-G8 或复检已交付项目（此时人在 `online`/已合并分支）不再触发,避免假失败。`GIT-G4-001` 对同名 `feature/<PROJECT-ID>` 判 `error`,对其他 `feature/*`（共享/改名分支）降级为 `warn`,非 feature 分支仍 `error`。`GIT-G4-002` 区分两种偏离:与 `origin/online` **无共同历史**（从 dev/test 或无关分支切）判 `error` 阻断;有共同历史但 `origin/online` 已前进（切出后主线正常推进,基线仍合法）降 `warn` 只提示「合入前可同步基线」,不阻断——避免把「主线前进」误判为「切错基线」。
- **阶段证据职责分离**：`docs-tdd.mjs gate` 是唯一正式写入口。`gate-results.json` 只保存最近一次运行（PASS 或 BLOCK），`gate-history.json` 只追加成功阶段且记录 fingerprint/evidence，`stage-status.json` 保存 G5/G7 人工事实状态。G6/G7/G8 分别要求此前 G5/G6/G7 PASS 历史；任何文件都不能用当前阶段结果证明自身前置条件。

## 3. Changed-file-only 代码静态扫描

公共入口:

```bash
node apps/web/docs_tdd/common/engine/agent-scripts/verify-code-rules.mjs
node apps/web/docs_tdd/common/engine/agent-scripts/verify-code-rules.mjs --project PR-01234
node apps/web/docs_tdd/common/engine/agent-scripts/verify-code-rules.mjs --base origin/online --json
node apps/web/docs_tdd/common/engine/agent-scripts/verify-code-rules.mjs --files apps/web/src/foo.tsx,package.json
node apps/web/docs_tdd/common/engine/agent-scripts/verify-code-rules.mjs --no-global-scan
```

默认收集文件集合:① `origin/online...HEAD` 中新增/修改/重命名的文件;② 当前 unstaged 修改;③ 当前 staged 修改;④ 当前 untracked 文件。

默认 changed-file-only:文件级规则只作用在新加或已改文件上;内容类规则只检查 diff 新增行,避免历史债务阻断本次需求。

**安全全量扫描例外**:`CODE-MOCK-004` / `CODE-MOCK-005` 默认在完整 gate 中全量扫描,用于抓 env mock flag 与生产 import mock 这类上线风险。PostToolUse 单文件 `--files` 默认关闭全量扫描;手动可用 `--global-scan` / `--no-global-scan` 控制。

**全量扫描 vs 新项目（存量债不背在新项目头上）**:004/005/006 是全局上线风险体检,故意跨项目、跟改动无关——任何一次运行都该抓到 mock 残留(如未拆的 Campaign)。但这与 MSW 新项目冲突:新项目从第一天 mock 就在 `src/mocks/handlers/` 从不进生产路径,结构上不可能产出 004/005 命中,可它跑完整 gate 时仍会照出**遗留功能**的存量残留。口径:
1. **走 MSW 的新功能自身对 004/005/006 恒为 N/A**——mock 从不进生产代码路径,不可能命中;命中的一定是别处存量。
2. **存量命中按「归属」判,不背在当前项目交付上**:finding 的 `file` 落在当前项目责任模块外(如 Campaign `campaign.ts`)= 既有债,不是本次需求引入。用 `agent/rule-waivers.json` 登记为 known-debt(带 `expiresAt` + 指向拆除计划),让当前项目 gate 绿,同时台账不失忆;严禁改成关闭全量扫描来「消音」——那会连带盖住本项目真引入的泄漏。
3. **落在当前责任模块内的 004/005 命中不可豁免**:那说明本项目真在生产路径引了 mock,按 mock-legacy-route-a §8.0/§8.3 拆,或迁 MSW。豁免只用于「别人的存量」,不用于「自己的新债」。

| Rule ID | 机器检查 | 作用范围 |
|---------|----------|----------|
| `CODE-FILE-001` | 新建或本次跨过 300 行的 `.tsx` 阻断；基线已超限的存量文件保留 WARN 并报告 base/delta，要求优先抽离本次职责但不把整份历史债归因当前改动（豁免 test/spec/fixture 与纯数据文件 constants/i18n/locale/generated）。`baseRef` 不可解析时无法判定新建，超限一律降 WARN 提示先 fetch 基线 | 文件级,比较 `baseRef` 与 changed `.tsx` |
| `CODE-STYLE-001` | 不新增/修改 `apps/web/src/**/*.scss`/`.less` | 文件级,只看 changed style files |
| `CODE-TYPE-001` | 新增行不引入 `any`（先剥注释/字符串再匹配,不误报 `// returns any`、`'any'`；放行 `.any(` 方法如 `z.any()`/`expect.any()`；不扫 test/spec/fixture 文件） | diff 新增行 |
| `CODE-TYPE-002` | 新增行不出现 `schema.parse(x) as T` / `.safeParse(x) as T`（`.parse()` 剥离未声明字段 + `as` 蒙蔽 type = 字段静默消失,§3 落地；放行 `as const`） | diff 新增行 |
| `CODE-ARCH-001` | `.tsx` 新增行不直接 `fetch(` | diff 新增行 |
| `CODE-ARCH-002`（warn） | 新增多层 `else if` 或同文件新增多个 `if` 时提示：静态状态/文案/class/action 映射应优先 `Record`/resolver 查表 | diff 新增行 |
| `CODE-ARCH-003`（warn） | changed source 的 import 出现高置信反向依赖候选：Mapper → API/React Query/store/UI、API Service → Feature/UI、Component → API service/schema/DTO/低层 HTTP、生产 UI/service → MSW fixture/handler；正则不替代依赖图，命中由 G6 Review 裁决 | changed 文件全量内容 |
| `CODE-STYLE-002` | 新增行不硬编码 hex/rgb/rgba 颜色 | diff 新增行 |
| `CODE-STYLE-003`（warn） | 新增 Tailwind arbitrary 尺寸/间距/圆角（如 `w-[400px]`、`rounded-[16px]`）时提示先查 `tailwind-preset.js`，能平替/相近则不用硬编码；`visualFidelity=high` 项目或公式例外可放行 | diff 新增行 |
| `CODE-E2E-001` | `package.json` 新增行不添加 `playwright`/`playwright-core`/`puppeteer` | diff 新增行 |
| `CODE-NAMING-001`（warn） | mapper（`mapXxx.ts`/含 `mapper`）新增行输出字段名≠单一契约字段名，且无 `API-RENAME: cross-source` / `API-DERIVED: sources=` 结构化理由（普通 `// API:` 不豁免） | diff 新增行 |
| `CODE-MAPPER-001` | mapper 新增行中 ≥2 个语义不同 UI 字段兜底到同一 `dto.xxx`，疑似 mock 臆造字段或 API 契约缺口 | diff 新增行 |
| `CODE-QUERY-001`（warn） | `apps/web/src/services/api/**` 新增 `useQuery(` 时提示导出稳定 queryKey 工厂并显式传 `queryKey` | diff 新增行 |
| `CODE-QUERY-002`（warn） | `apps/web/src/services/api/**` 新增 `transfer: (data) => data` / `data as T` 时提示接 schema/toCamel/zCamel 或显式 narrowing | diff 新增行 |
| `CODE-MOCK-003`（warn） | 真实接口后禁 mock/假默认兜底：`apps/**` 与 mapper 新增行里 `?? '字面量'` 或 `\|\| '非-- 文案'` 等可疑展示兜底（§8.2 落地）；React identity `key`、i18n/URL/locale 等非展示默认放行 | diff 新增行 |
| `CODE-MOCK-004` | env 文件残留 `NEXT_PUBLIC_*USE_MOCK`（不论 true/false/注释）= 拆除未完成；mock 拆除时该删 flag 而非设 false（mock-legacy-route-a §8.0 第 5 条 / §8.3 落地） | 全量扫 env（非 diff,抓存量残留） |
| `CODE-MOCK-005` | mock 脚手架（`/mock/`、`__mock__/`、`*.mock.ts`、`mockXxx.ts`）被非测试生产代码 `import` = mock 泄漏进生产路径（mock-legacy-route-a §8.0 单一接缝 / §8.3 落地） | 全量 `git grep`（非 diff,抓存量泄漏） |
| `CODE-MOCK-006`（warn） | 复用 `NEXT_PUBLIC_ENV_NAME` 环境判断当 mock/fallback 开关，绕过专用 mock flag 与 DCE 拆除规则 | 全量 `git grep`（非 diff,抓存量泄漏） |
| `CODE-COPY-001`（warn） | `apps/web/src/apps/**.tsx` 新增行硬编码中文展示文案（非 `t()`/注释/日志）；固定文案须走 i18n + `03-api-contract.md §7 文案契约表` + 「值===原文」字面断言（§7 强制项,PR-02022 意译根因）。非展示文本加 `// copy-exception` | diff 新增行 |
| `DOC-REUSE-001` | Markdown 新增行不写 `跳过复用` | diff 新增行 |

### 3.1 `CODE-ARCH-003` 执行契约

- **Trigger**：新增或修改 Component、React Query Hook、API Service、schema/DTO、Mapper，或生产代码的 mock 边界 import。
- **Source**：[api-and-mapper.md §1](./api-and-mapper.md) 是调用链、数据链和层依赖的唯一正文源；本表只登记机器覆盖。
- **Loader**：编码前按 `write_ui`、`write_query_hook`、`write_api` 或 `write_mapper` 加载；G6 加载 `quality-checklist.md`。
- **Executor**：编辑后由 `verify-code-rules.mjs`/`docs-tdd changed` 扫 changed 文件全量 import，阶段出口由 G6 gate 与 code review 共同执行。
- **Evidence**：扫描 finding 包含 Rule ID、文件、行号和 import source；G6 在 `06-collaboration.md` 记录已修、误报或有期限豁免，并关联 gate fingerprint。
- **Failure**：当前为 warn-first，不单独阻断；高置信命中优先移动依赖或抽中立类型模块。人工判定合法时登记理由与误报形态；连续 2 个真实 PR 零误报后按 §2.1 晋级 error。

## 3.5 机器事实层（真跑 biome / tsc / vitest）

`VERIFY-*` 里 §2 那批只检查「证据文档有没有写命令」;本节这批**自己执行工具链**,退出码来自真实子进程,不接受任何自述。公共入口:

```bash
node apps/web/docs_tdd/common/engine/agent-scripts/verify-build-quality.mjs --project PR-01234
node apps/web/docs_tdd/common/engine/agent-scripts/verify-build-quality.mjs --project PR-01234 --json
node apps/web/docs_tdd/common/engine/agent-scripts/verify-build-quality.mjs --files apps/web/src/foo.ts --skip TYPE
node apps/web/docs_tdd/common/engine/agent-scripts/verify-build-quality.mjs --project PR-01234 --write-baseline
```

`docs-tdd gate` 在 **G6/G7/G8 自动调用**（G5 之前代码还在联调,存量报错会让它天天红,反而训练出「习惯性忽略」）。它的 checks 直接并入 `gate-results.json` 的 `checks`,因此 summary / 证据表 / warn 台账 / BLOCK 判定复用同一条链路,不存在第二套结论口径。跳过用 `--skip-build-quality` + `--skip-build-quality-reason`,无理由跳过判 `error`。

| Rule ID | 机器检查 | 作用范围 |
|---------|----------|----------|
| `VERIFY-BIOME-001` | 对本次改动的 JS/TS/JSON 文件实跑 `biome check`,退出码非 0 即 fail;候选文件 >0 但 `Checked 0 files` 也判 fail（0 files 不算通过证据） | changed 文件,真实子进程 |
| `VERIFY-TYPE-001` | 实跑 `tsc --noEmit`,把报错路径换算成 worktree 相对路径后**只归因本次改动文件**;存量债不阻断,也无法通过删基线洗白（报错归属来自 git,不来自基线文件） | changed 文件,真实子进程 |
| `VERIFY-TYPE-002`（warn） | 存量涟漪:改动之外的 tsc 报错总数不得超过 `agent/tsc-baseline.json`;抓「改共享类型把没碰过的文件搞挂」。只做 warn,故基线被篡改的收益上限是「少一个 warn」 | 全量 tsc 计数 vs 项目基线 |
| `VERIFY-TEST-001` | 实跑 `vitest run` 于相关测试文件（changed 测试文件 ∪ changed 源文件的同名/同目录 `__tests__` 测试）;有选中文件却 `No test files found` 或退出码非 0 即 fail | changed 文件推导出的测试集 |
| `VERIFY-TEST-002`（新模板 error；旧项目 warn） | 改动的 `.ts` 逻辑文件（`utils/helpers/mappers/lib`、`mapXxx.ts`、`use*Store.ts`、`format/calc/schema/selector`）导出了函数但无对应单测。`.tsx` 不在范围内（交互/视觉由结构化验收承接） | changed `.ts` 逻辑文件 |
| `VERIFY-BUILD-001` | 缺席守卫:G6+ 要求本层但被跳过 / 未执行 / 输出无法解析时补一条显式失败,不允许静默当成「本阶段没有这一层」。有理由跳过 = warn,无理由 = error | gate 编排层 |
| `VERIFY-PROD-BUILD-001` | G8 使用 `docs-tdd.config.json.productionBuild` 实跑生产构建，缺配置或退出码非 0 均阻断 | G8 真实子进程 |

### 3.5.1 执行契约

- **Trigger**：`docs-tdd gate <PROJECT-ID> G6|G7|G8`;也可手动跑单个改动文件集。
- **Source**：本脚本即 Executor,不存在「文档说跑过」这条通路。
- **Loader**：G6 场景 `g6_verify` 加载 [quality-checklist.md](./quality-checklist.md) 与本节。
- **Evidence**：命令、退出码、日志路径写入 `evidence/gate/**/README.md` 的 Command Evidence 与 Summary「机器事实层」行;完整输出落 `/tmp/docs-tdd-logs/<PROJECT-ID>/`。
- **Failure**：`VERIFY-BIOME-001`/`VERIFY-TYPE-001`/`VERIFY-TEST-001`/`VERIFY-BUILD-001`（无理由跳过）阻断 gate,当场修或按 §4 登记有期限豁免;两条 warn 进 warn 台账。

## 3.6 阻塞与变更登记（`agent/blockers.json`）

阻塞和需求变更此前只存在于 `06-collaboration.md §7` 的散文表格里——交付摘要靠 grep「待修复/未处理」字样（改口径就漏），gate 也拦不住「待后端销账」这类项飘到 G8。改为机器可读单一源 `agent/blockers.json`，语义与协议见 [blocking-and-change-protocol.md](./blocking-and-change-protocol.md)。判定纯函数集中在 `agent-scripts/lib/blockers.mjs`，`verify-project-gate.mjs`（每个 gate）与 `render-delivery-summary.mjs`（G8 第 4/5 段）共用，不各写一份。

- **三条规则**：`DOC-BLOCK-001`（结构合法，不可豁免）、`DOC-BLOCK-002`（无 open 且 `blocksGate ≤ 当前 gate` 的项，可豁免——豁免=owner 具名带期限担责，走 §4 的 `rule-waivers.json`）、`DOC-BLOCK-003`（其余 open 项可见性 warn）。聚合式：每条规则一条 check，`DOC-BLOCK-002` 的 message 列出命中 id。
- **缺文件即合法**：无 `blockers.json` 不发任何 check，存量项目零回填。
- **与 `stage-status.blocked` 分工**：`stage-status` 是 G5/G7 的阶段处置结论；`blockers.json` 是跨阶段的结构化登记（谁、何时、卡在哪、什么能解）。两者不重复。
- **生命周期**：`open → resolved` 必须带非空 `resolution` + `resolvedAt`，禁止静默清零；`open` 的 `blocker` 必须填 `blocksGate`（否则 gate 无从拦截）。

## 3.7 结构化 Review 与验收结果

- `agent/code-review.json` 是 G6 review 真值源；模板 v2 起缺文件即阻断，旧项目才允许回退 `06-collaboration.md` 散文判定。`DOC-CR-001/002/003` 分别验证结构（含必填 `head`）、未处理 finding、HEAD 新鲜度。
- `agent/acceptance-results.json` 把本期 Feature 映射到具体场景、验证方式、结果和 evidence。`DOC-AC-001/002/003/004/005/006` 分别验证结构（含必填 `head`）、Feature 覆盖、无 failed/blocked、PASS 有 evidence、PASS 的 evidence 有真实存在的文件锚点、验收覆盖当前 HEAD。
- 两者都由 `verify-project-gate.mjs` 直接消费；不能只在 evidence README 写“已 review/已自测”。


## 3.8 Golden run（回归 gate 机器自己）

各脚本的 `--self-test` 只覆盖导出的纯谓词，覆盖不到「规则 ID 有没有真的连到判定、聚合器还能不能跑起来、规则改宽后有没有误伤旁边的项」。`golden-run.mjs` 填这一层：把 `common/engine/fixtures/golden-project` 物化成保留 ID 项目 `PR-00000`（模板 v2 基线刚好通过 G0/G1/G2/G3/G6），再逐个变异用例只破坏一处，断言预期规则 ID 正好命中且不牵连基线之外的 error 规则。

```bash
docs-tdd golden                 # 完整跑（含聚合器烟测，需指纹链已发布）
docs-tdd golden --verbose       # 逐条打印用例结论
docs-tdd golden --keep          # 保留 PR-00000 供手工排查
```

- **变异用例（22 条）**：覆盖结构、G0/G1/G2/G3、阻塞/豁免，以及 G6 的 `DOC-CR-002`、`DOC-AC-002/004/005` 接线；每条只破坏一处。
- **双向断言**：规则失效（该红不红）与规则变宽（连带误伤）都会 fail。故障注入实测：把 `DOC-G3-005` 改成恒真、把 `DOC-G0-003` 改宽，两类都被抓出。
- **发布即强制**：`rule-release.mjs --write` 在 `check-doc-budget` 之后跑 `golden-run --skip-aggregator`，不通过就拒绝发布。聚合器烟测（`run-project-gate PR-00000 G2`）需要**已发布**的新指纹，发布前跑不了，所以那一条留给发布后的 `docs-tdd golden`。
- **边界（不遮掩）**：G6 只覆盖结构化 Review/验收接线；G4+ 的真实分支 / 改动文件 / 工具链由 §3.5 的真实执行负责。`prd-intake` 与 MSW 子链路在夹具里显式关闭，各自有 fixtures 与自测。
- **副作用**：不传 `--write`，不写 `gate-results.json` / `evidence/**` / `PROJECTS.md` / warn 台账；`PR-00000` 在 `finally` 里删除，且被 `check-doc-budget` 与 `update-project-index.mjs` 的项目扫描显式排除。

## 4. 豁免原则

规则确需豁免不要删 gate。在项目 `agent/rule-waivers.json` 记录:

```json
[
  {
    "ruleId": "CODE-FILE-001",
    "file": "apps/web/src/apps/Example/index.tsx",
    "reason": "历史文件本次只改 3 行，拆分另开任务",
    "owner": "负责人",
    "expiresAt": "2026-07-20"
  }
]
```

两个脚本都已接入 `rule-waivers.json`:
- **项目 gate**:`verify-project-gate.mjs` 自动读 `<PROJECT-ID>/agent/rule-waivers.json`;命中的 `error` 失败项降级 `waived`（输出标 `WAIV`,不计入退出码）,需 `ruleId` 匹配、`file` 省略或精确匹配、且未过期。
- **代码静态扫描**:`verify-code-rules.mjs --project <PROJECT-ID>` 默认读取 `apps/web/docs_tdd/prds/<PROJECT-ID>/agent/rule-waivers.json`;也可用 `--waivers <path>` 显式指定。命中的 `error` finding 降级 `waived`,不计入 `ok`。

`common/rules/ruleset.json` 可把高风险事实校验标为 `waivable: false`；此类规则即使出现在项目 waiver 中也不会降级。当前 MSW 注册链完整性与生命周期阻断假设清零属于不可豁免项，试点期仍可由 `blocking: false` 保持诊断态，晋级后才转阻断。

四重防护防「永久/静默绕过」:无 `expiresAt` → 忽略;已过期 → 仍拦截;文件非法 JSON → 忽略;命中 non-waivable 规则 → 忽略。其中 **`verify-project-gate.mjs`** 分别发 `DOC-WAIVER-002` / `DOC-WAIVER-003` / `DOC-WAIVER-001` / `DOC-WAIVER-004` 的 `WARN` 明示;**`verify-code-rules.mjs`** 对失效豁免静默忽略（不发 WARN、无 `DOC-WAIVER` ID）,但同样仍强制原规则。豁免必须写 `reason`、`owner`、`expiresAt`。

## 5. 项目阶段 gate 完整 ID 台账

> `verify-project-gate.mjs` 实装的全部 ID(§3 已列 `CODE-*` 代码扫描类、§4 已列 `DOC-WAIVER-*`,本节补齐阶段 gate 类)。**新增/删除脚本里的 ID 必须同步本台账**,否则 `check-doc-budget.mjs` 校验失败(脚本 ID ⊄ 台账)。

| Rule ID | 触发 gate | 机器检查 | 严重度 |
|---------|-----------|----------|--------|
| `DOC-PRD-001` | G0+（pilot） | PRD source manifest 存在，项目 ID、sources、items 结构有效 | error（experimental） |
| `DOC-PRD-002` | G0+（pilot） | manifest 登记的 PRD source 文件存在且位于 `docs_tdd` | error（experimental） |
| `DOC-PRD-003` | G0+（pilot） | PRD 图片、表格和 embed 均进入 intake 清单且无陈旧项 | error（experimental） |
| `DOC-PRD-004` | G0+（pilot） | PRD rich-media source ID 唯一 | error（experimental） |
| `DOC-PRD-005` | G2+（pilot） | rich-media 输入均已读取、分类、摘要并关联证据 | error（experimental） |
| `DOC-PRD-006` | G2+（pilot） | requirement 输入映射 Feature ID，decorative 输入有处置结论 | error（experimental） |
| `DOC-PRD-007` | G2+（pilot） | requirement source ID 与 Feature ID 可追溯到前端任务 | error（experimental） |
| `DOC-PRD-008` | G0+（pilot） | PRD source 内容 hash 未相对 manifest 漂移 | error（experimental） |
| `DOC-PRD-009` | G2+（pilot） | 已确认的 PRD intake fingerprint 与当前输入一致 | error（experimental） |
| `DOC-STRUCT-001` | G0+ | 项目目录存在 | error |
| `DOC-STRUCT-002` | G0+ | `README.md` 存在 | error |
| `DOC-STRUCT-003` | G0+ | `product/00-feature-inventory.md` 存在 | error |
| `DOC-STRUCT-004` | G0+ | `product/01-scope-and-phases.md` 存在 | error |
| `DOC-STRUCT-005` | G0+ | `product/02-technical-design.md` 存在 | error |
| `DOC-STRUCT-006` | G0+ | `product/03-api-contract.md` 存在 | error |
| `DOC-STRUCT-007` | G0+ | `product/04-frontend-tasks.md` 存在 | error |
| `DOC-STRUCT-008` | G0+ | `product/05-ui-and-interaction.md` 存在 | error |
| `DOC-STRUCT-009` | G0+ | `product/06-collaboration.md` 存在 | error |
| `DOC-STRUCT-010` | G0+ | `product/07-figma-spec.md` 存在 | error |
| `DOC-STRUCT-011` | G0+ | `engineering/development-rules.md` 存在 | error |
| `DOC-STRUCT-012` | G0+ | `agent/README.md` 存在 | error |
| `DOC-G0-001` | G0+ | 功能清单记录 PRD 来源 | error |
| `DOC-G0-002` | G0+ | 有 `## 功能清单` 章节 | error |
| `DOC-G0-003` | G0+ | 有 `## 验收标准对照` 章节 | error |
| `DOC-G0-004` | G0+ | 有 `## PRD 未完全可读内容` 章节 | warn |
| `DOC-G1-001` | G1+ | scope 文档记录本期范围 | error |
| `DOC-G1-002` | G1+ | 技术方案包含复用盘点初稿 | error |
| `DOC-G1-003` | G1+ | 前端任务文档包含任务清单 | error |
| `DOC-G1-004` | G1+ | 协作文档记录决策、差异或待确认项 | error |
| `DOC-G2-001` | G2+ | 功能清单无阻断占位 | error |
| `DOC-G2-002` | G2+ | G2 确认人和日期已填 | error |
| `DOC-G2-003` | G2+ | 功能清单至少一行 | error |
| `DOC-G2-004` | G2+ | 每条功能 `本期=做/不做/延期` | error |
| `DOC-G2-005` | G2+ | 本期做的功能 ID 都进 `04-frontend-tasks.md` | error |
| `DOC-G3-001` | G3+ | API 契约记录 mock 路线为 MSW 路线 B | error |
| `DOC-G3-002` | G3+ | API 契约包含 MSW 清单 / 落地前置 | error |
| `DOC-G3-003` | G3+ | API 契约记录 normal/empty/error/unauthorized/edge 场景 | error |
| `DOC-G3-004` | G3+ | API 契约记录真实 schema 契约测试 | error |
| `DOC-G3-005` | G3+ | API 契约记录 dev-only worker 注册 | error |
| `DOC-G3-006` | G3+ | 前端任务包含 MSW fallback 任务 | error |
| `DOC-G3-007` | G3+ | 协作记录包含 MSW fallback 决策 / 清单 | error |
| `DOC-G3-IMPL-001` | G3+ | `agent/msw-manifest.json` 可解析 | warn（experimental） |
| `DOC-G3-IMPL-002` | G3+ | active 生命周期的 handler/fixture/contract test/注册/worker/provider 文件存在 | warn（experimental） |
| `DOC-G3-IMPL-003` | G3+ | handler export 已注册且 Provider 挂载 worker hook | warn（experimental） |
| `DOC-G3-IMPL-004` | G3+ | endpoint 场景结构有效，N/A 有理由，retired 有对账证据 | warn（experimental） |
| `DOC-G3-IMPL-005` | G3+ | `agent/assumptions.json` 可解析 | warn（experimental） |
| `DOC-G3-IMPL-006` | G3+ | API ready/reconciling/retired 时无阻断假设 | warn（experimental） |
| `DOC-G4-001` | G4+ | 复用盘点无 `待检查/待确认` 占位 | error |
| `DOC-G4-002` | G4+ | 技术方案含复用盘点 | error |
| `DOC-G4-003` | G4+ | 技术方案不含 `跳过复用` | error |
| `DOC-G4-004` | G4+ | 技术方案模板 v2 含单一事实源所有权表 | error |
| `DOC-G4-005` | G4+ | 单一事实源所有权表无 `待确认/待填写` 占位 | error |
| `DOC-G4-006` | G4+ | 技术方案模板 v3 含数据流与分层契约表；纯 UI 可明确写 `N/A` 与数据来源 | error |
| `DOC-G4-007` | G4+ | 数据流与分层契约表无 `待确认/待填写/待检查` 占位 | error |
| `DOC-G4-008` | G4+ | 功能清单含 PRD 面包屑路径时，技术方案含「PRD 路径核验」表（见 [architecture-and-state.md](./architecture-and-state.md) §2.2） | error |
| `DOC-G4-009` | G4+ | 功能清单里的每条面包屑路径均在技术方案里原文出现（未被静默顶替/收敛） | error |
| `GIT-G4-001` | G4(时点) | 当前分支是 `feature/<PROJECT-ID>`(其他 `feature/*` 降 warn) | error/warn |
| `GIT-G4-002` | G4(时点) | 基线基于 `origin/online`(无共同历史 error;主线前进降 warn) | error/warn |
| `DOC-G5-001` | G5+ | API 契约记录字段对账 | error |
| `DOC-G5-002` | G5+ | API 契约记录 mock 状态 | error |
| `DOC-G5-003` | G5+ | API 契约记录文案契约表 | error |
| `DOC-G5-004` | G5+ | 已勾选完成的任务不得同行保留 `ASSUMED`、待后端/待对账、后端侧待办或契约未完成 | error |
| `CODE-MOCK-001` | G5+ | 责任模块目录未填→无法扫 mock 残留 | warn |
| `CODE-MOCK-002` | G5+ | `rg` 不可用/mock 残留 grep（`@mock-only`/`USE_MOCK`/`isMock`） | warn/error |
| `CODE-MSW-001` | G5+ | MSW 路线 B 在 API 契约中记录契约测试/schema 验证 | error |
| `CODE-MSW-002` | G5+ | MSW 路线 B 责任模块无业务 mock switch 残留 | error |
| `CODE-MSW-003` | G5+ | MSW 路线 B 记录 handler 删除/停用/转测试处置 | warn |
| `CODE-MSW-004` | G5+ | API 契约记录新功能 mock 路线为 MSW 路线 B | error |
| `CODE-ASSUMED-001` | G5+ | 责任模块残留 `// ASSUMED:`（对账未销账，§8.0.2） | warn |
| `CODE-SCOPE-001` | G5+ | 改动落在责任模块目录白名单外（越界，change-scope-boundary §1.1） | warn |
| `VERIFY-G5-001` | G5+ | `agent/stage-status.json` 存在 G5 结构化结论 | error |
| `VERIFY-G5-002` | G5+ | G5 状态为 `completed` 或 `not-applicable`，`blocked` 不得进入 G6 | error |
| `VERIFY-G5-003` | G5+ | G5 完成项存在证据路径；不适用项存在具体原因 | error |
| `VERIFY-G5-004` | G5+ | 报告态 `frontend-complete-pending-reconcile`（前端完成、仅待真实字段对账）须有前端 evidence 路径与待对账原因；此态不放行 G6，仅供索引/交付摘要正向显示 | warn |
| `VERIFY-G6-001` | G6+ | `evidence/` 下有自测 README | error |
| `VERIFY-G6-002` | G6+ | `06-collaboration.md` 记录 code-review findings + 处理结论，且无未处理悬空项（`待修复/未处理` 即 fail，须当场修或进 `rule-waivers.json`） | error |
| `VERIFY-G6-003` | G6+ | 自测证据记录命令、目标文件/场景、结果，含 Biome 或 fallback | error |
| `VERIFY-G6-004` | G6+ | `evidence/` 下不出现 `.png/.jpg/.html` 等二进制/临时文件（应放 `/tmp/` 或 `.gitignore` 目录） | warn |
| `DOC-AC-001` | G6+ | `agent/acceptance-results.json` 结构合法；模板 v2 起必须存在 | error |
| `DOC-AC-002` | G6+ | 每个本期做 Feature 至少有一条 passed 验收结果 | error |
| `DOC-AC-003` | G6+ | 验收结果无 failed/blocked | error |
| `DOC-AC-004` | G6+ | 每条 passed 验收都有 evidence | error |
| `DOC-AC-005` | G6+（`lib/acceptance-results.mjs`） | 每条 passed 验收的 evidence 至少有一个真实存在的文件锚点（截图/报告/DOM 比对），且不含指向不存在文件的路径 | error |
| `DOC-AC-006` | G6+（`lib/acceptance-results.mjs`） | `acceptance-results.json.head` 覆盖当前 HEAD（缺 currentSha 不判定），防验收过时 | warn |
| `VERIFY-STAGE-001` | G6+ | `agent/gate-history.json` 存在此前真实写入的 G5 PASS | error |
| `VERIFY-STAGE-002` | G7+ | `agent/gate-history.json` 存在此前真实写入的 G6 PASS | error |
| `VERIFY-G7-001` | G7+ | `agent/stage-status.json` 存在 G7 结构化结论 | error |
| `VERIFY-G7-002` | G7+ | G7 状态为 `completed` 或 `skipped` | error |
| `VERIFY-G7-003` | G7+ | G7 完成项存在证据路径；跳过项存在具体原因 | error |
| `VERIFY-STAGE-003` | G8 | `agent/gate-history.json` 存在此前真实写入的 G7 PASS，禁止当前 G8 自证 | error |
| `VERIFY-BIOME-001` | G6+（`verify-build-quality.mjs`） | 改动文件实跑 `biome check` 通过，且 `Checked` 文件数 >0 | error |
| `VERIFY-TYPE-001` | G6+（`verify-build-quality.mjs`） | 实跑 `tsc --noEmit`，改动文件零报错（存量债不阻断） | error |
| `VERIFY-TYPE-002` | G6+（`verify-build-quality.mjs`） | 改动之外的 tsc 报错数未超 `agent/tsc-baseline.json`（存量涟漪） | warn |
| `VERIFY-TEST-001` | G6+（`verify-build-quality.mjs`） | 实跑 `vitest run` 于相关测试文件全绿 | error |
| `VERIFY-TEST-002` | G6+（`verify-build-quality.mjs`） | 改动的 `.ts` 逻辑文件导出函数须有对应单测 | warn |
| `VERIFY-BUILD-001` | G6+（`run-project-gate.mjs`） | 机器事实层缺席守卫：未执行/输出不可解析/无理由跳过即 fail，有理由跳过降 warn | error/warn |
| `VERIFY-PROD-BUILD-001` | G8（`verify-build-quality.mjs`） | 按配置实跑 production build | error |
| `DOC-BLOCK-001` | G0+（`lib/blockers.mjs`） | `agent/blockers.json` 结构合法：字段合规、id 唯一、resolved 带 resolution+resolvedAt；缺文件不发 check | error（不可豁免） |
| `DOC-BLOCK-002` | G0+（`lib/blockers.mjs`） | 无 `open` 且 `blocksGate ≤ 当前 gate` 的阻塞/变更未解除 | error（可豁免） |
| `DOC-BLOCK-003` | G0+（`lib/blockers.mjs`） | 其余 `open` 登记（尚不卡当前 gate）可见性提示 | warn |
| `DOC-SYNC-001` | —（`check-doc-budget.mjs`） | 已通过 gate 项目的 README 机器行与 `gate-results.json.gate` 一致 | error |
| `DOC-SYNC-002` | —（`check-doc-budget.mjs`） | 机器版 `context-summary.md` 的当前阶段与 `gate-results.json.gate` 一致 | error |
| `DOC-SYNC-003` | —（`check-doc-budget.mjs`） | `PROJECTS.md` 与即时重生成结果一致 | error |
| `DOC-SYNC-004` | —（`check-doc-budget.mjs`） | active 项目 stage=G5+ 时存在 G5→当前阶段连续 PASS 历史，且历史证据文件真实存在 | error |
| `DOC-CR-001` | G6+（`lib/code-review.mjs`） | `agent/code-review.json` 结构合法：字段合规（含必填 `head`）、finding id 唯一、fixed 带 resolution；缺文件不发 check | error |
| `DOC-CR-002` | G6+（`lib/code-review.mjs`） | code-review 无未处理 finding（open 项须当场修或 waive/标 N/A） | error |
| `DOC-CR-003` | G6+（`lib/code-review.mjs`） | `code-review.json.head` 覆盖当前 HEAD（head 现为必填，缺 currentSha 不判定），防 review 过时 | warn |
| `VERIFY-G8-001` | G8 | `agent/delivery-status.json` 的 project/mode/branch/headSha/evidence 结构合法；模板 v2 起必须存在 | error |
| `VERIFY-G8-002` | G8 | 交付模式不是 local，而是 pushed/merged/released | error |
| `VERIFY-G8-003` | G8 | 实际 Git 工作树干净 | error |
| `VERIFY-G8-004` | G8 | 非 local 交付具备证据；pushed 模式远端分支、当前 HEAD 与记录 SHA 一致；merged/released 模式记录 SHA 已进入基线分支 | error |

> `GIT-G4-*` 定位说明见 §2.1(时点检查、worktree cwd 求值);责任模块目录字段可填在 `00-feature-inventory.md` 或 `agent/context-summary.md`。
