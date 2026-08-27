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

当前本地规则集见 `common/rules/ruleset.json`：每条规则声明 `{ maturity, blocking, waivable }`，定档单一真值源是 `lib/rule-maturity.mjs`（`resolveSeverity`）。`stable` 与 `experimental` 按 `blocking` 定档（`experimental` 想只诊断就置 `blocking:false`；标了 `experimental` 但 `blocking:true` 的规则仍照常阻断）。`trial` 在 `blocking` 基础上再按可选的 `since`（规则引入时的模板版本）向下收窄：项目 `agent/project-manifest.json` 的 `templateVersion` **低于** `since` 时降为 warn——即「规则升级默认不回查阻断存量项目」。不带 `since` 的 trial 规则（`since=0`）对任何项目都阻断。新脚手架写 `templateVersion:3`，故 `since:3` 的规则（如 `DOC-CONFIRM-*`）只阻断新项目、存量 v1/v2 项目 warn。

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

- 检查分 `error`（阻断,`ok=false` 让 gate 退出码非 0）与 `warn`（不阻断,只提示）。可选字段未填、可选章节缺失、无法扫描等用 `warn`,避免「未填可选项」卡交付。当前 `warn` 项:`DOC-G0-004`（PRD 未完全可读章节）、`CODE-MOCK-001`（责任模块目录未填时）、`CODE-MOCK-002`（`rg` 不可用时）、`CODE-MSW-003`（MSW handler 处置记录,不同项目阶段可能先转测试再删除）、`CODE-NAMING-001`（mapper 改名无跨来源/派生结构化理由,渐进 warn-first）、`CODE-MOCK-003`（真实接口后假默认兜底,渐进 warn-first）、`CODE-ARCH-003`（分层反向依赖的 changed-file import 候选,渐进 warn-first + G6 裁决）、`CODE-ASSUMED-001`（责任模块残留 `// ASSUMED:`,「接口是否 ready」靠人判故 warn）、`CODE-SCOPE-001`（改动越出责任模块目录,跨模块重构可能合法故 warn + 重点 check）、`CODE-COPY-001`（apps 下硬编码中文展示文案,存量多故 warn-first,催走 i18n+§7 契约表）、`VERIFY-TYPE-002`（存量 tsc 涟漪,改共享类型可能合法故 warn）、`VERIFY-TEST-002`（逻辑文件缺单测,「值不值得测」靠人判故 warn）、`DOC-CONFIRM-001..004`（人工确认签名缺失,warn-first 见 §3.7）。
- **warn-first 规则的生命周期真值源在 [rule-execution-model.md](./rule-execution-model.md) §6**：晋级判据（连续 2 个真实 PR 零误报）、机器台账 `common/warn-ledger.json`（`warn-ledger.mjs`）、满 90 天无裁决自动降 `note` 并列待退休（`lib/warn-retirement.mjs`）、`docs-tdd rule-health` 体检——均见该节；本节只维护 gate 的 Rule ID 与严重度。
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
| `CODE-MAPPER-002`（warn / experimental） | 展示组件（`apps/*/src/**.tsx`）新增行「后端根因→前端凑数」两种指纹：①对 ≥2 个后端字段做加减反推权威值（BigNumber `.minus/.plus` 链 ≥2 或 `dto.a-dto.b-dto.c`）；②以 `*StatusText`/`*StateLabel` 等展示文案字符串反推枚举状态（`=== '已过期'`）。根因在后端字段本身时应上报 blocker+忠实透出，勿前端补偿；纯计算下沉 `.ts` 纯 helper 放行，`status` 枚举直接比较放行（PR-01930 commit 3b26/284261/c04016 反例） | diff 新增行 |
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
| `VERIFY-TASK-001` | Lark worker 结果解析层（`lark-ai-result.mjs`）缺陷分诊门禁：结构化结果的 `rootCauseLayer=backend-*/cross-boundary` 时必带完整 `evidence`（userSeenValue/apiActualValue/contractExpectedValue/dataFlowFirstErrorLocation），否则拒收；`taskState=completed` 且根因在后端 / 跨层时，无 `blockers` 转交项不得关单（须改 awaiting_owner_fix）。文件数 / typecheck / 截图不构成根因证据。防「后端根因→前端凑数关单」（PR-01930） | Lark worker 结果解析,非项目 G-gate |

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
- **人工确认签名**（`DOC-CONFIRM-001..004`，`lib/confirmation.mjs`）：G5-G8 以人工确认为锚点，但判断层文件此前无签名字段，机器无法区分「人看过」与「AI 声称人看过」。现在 `stage-status.json`（G5/G7 处置态）、`acceptance-results.json`（`manual`/`manual-visual`/`browser` 的 passed 项）、`code-review.json` 都可写 `confirmedBy` + `confirmedAt`（`YYYY-MM-DD`）；`reviewer` 不能兼任签收（它记谁做的 review，通常是 Agent 自己）；**AI 客户端名与 `TBD`/`N/A` 占位符不算人工确认**（`classifySignature`，按独立词匹配以免误伤真人名）。**已接线**：四条在 `ruleset.json` 登记为 `trial + since:3`，经 `resolveSeverity` 定档——新脚手架（`templateVersion:3`）缺签名即 error、存量 v1/v2 项目 warn（走 waiver）；空签名槽位已随 `project-scaffold` 落入骨架，逼真人在处置态转 completed/skipped 时补签。


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

`common/rules/ruleset.json` 是规则档位表：每条规则声明 `{ maturity, blocking, waivable }`。`waivable: false` 的高风险事实校验即使出现在项目 waiver 中也不会降级；**未在 ruleset.json 声明的规则一律不接受豁免**（`waivable !== true` 即拒绝），并由 `check-doc-budget.mjs` 校验 5b 反向强制「rule-id-ledger.md 的每个 error 级 ID 必须有 blocking + waivable 声明」——漏声明视为规则语义未定义，加规则时即拦。当前 MSW 注册链完整性与生命周期/gate 阻断假设清零属不可豁免或需具名担责项。

四重防护防「永久/静默绕过」,由 `lib/waiver-policy.mjs` 判生命周期:缺 `reason`/`owner`/`expiresAt` 之一或 `expiresAt` 非 `YYYY-MM-DD` → 不生效 + `DOC-WAIVER-002` **error**;已过期 → 不生效、原规则照旧阻断 + `DOC-WAIVER-003` **error**;文件非法 JSON / 非数组 → 全部豁免不生效 + `DOC-WAIVER-001` **error**;命中 non-waivable 规则 → 忽略 + `DOC-WAIVER-004` `WARN`（该条常见于给 `verify-code-rules` 写的豁免,那边不读 ruleset,故只提示不阻断）。前三条判 error 而非 warn 的理由:失效豁免本来就不会被套用（原规则照旧红）,error 追加的是**清理台账**的压力——用 warn 表达时,「还没写全」和「已经过期」两个方向都指向「不用管」,台账只会越腐化;出口很便宜:续期、补 `owner`/`reason`,或删掉这条。**`verify-code-rules.mjs`** 对失效豁免静默忽略（不发 WARN、无 `DOC-WAIVER` ID）,但同样仍强制原规则。

### 4.1 项目级 report-only 开关（与豁免的分工）

`agent/project-manifest.json` 的 `gatePolicy` 有两个 report-only 开关，它们是**接入期**手段，粒度比豁免粗得多——无 owner、无期限、无规则粒度，且作用在 `applyWaivers()` 之前：

| 开关 | 作用 | 适用条件 |
|---|---|---|
| `legacyRules: report-only` | 把 `DOC-G3-001..007`（MSW 路线 B 文档要求）的失败降为 `warn` | 机制上线前就存在的存量项目，其 G3 文档按旧模板写成 |
| `currentTouchedRules: report-only` | 把 ruleset.json 已声明规则的失败整体降为 `warn` | 项目创建时固定的规则集之后新引入的横向规则，不回查阻断本次交付 |

**不适用范围（免疫 report-only）**：`waivable: false` 的规则，以及声明了 `reportOnlyExempt: true` 的规则（当前是 `DOC-ASSUM-001/002`——项目自己的假设台账不属于「别人新加的横向规则」，但它需要保留具名豁免出口，故不能靠 `waivable:false` 取得免疫）。

**退出条件**：项目 G5 之后不应再新增 report-only；改为 `blocking` 后仍需绕过的单条规则走 `rule-waivers.json`（有 owner、有 `expiresAt`、有 `DOC-WAIVER-*` 明示）。**分工一句话**：report-only 回答「这批规则本项目还没接」，豁免回答「这一条我知道且我担责」。

## 5. 项目阶段 gate 完整 ID 台账

> 阶段 gate 类的完整 ID 台账（全部 Rule ID、触发 gate、机器检查、严重度）已拆到 [rule-id-ledger.md](./rule-id-ledger.md)——它随规则条目单调增长、且从不路由进 context pack，独立成文以免撑大本文。§3 的 `CODE-*`、§3.5 的 `VERIFY-*`、§4 的 `DOC-WAIVER-*` 仍在本文内。
> 新增/删除脚本 ID 时同步 rule-id-ledger.md；`check-doc-budget.mjs` 校验 5 跨本文件与 rule-id-ledger.md 一起核对「脚本 ID ⊆ 台账」。
