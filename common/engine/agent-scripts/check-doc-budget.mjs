#!/usr/bin/env node
// 文档/脚本预算与覆盖校验：常驻小，按需文档和执行器均有硬上限。

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { auditDefaultContextPacks } from './lib/context-budget-audit.mjs'
import { createContextPack } from './lib/context-pack.mjs'
import { charCount, parseFrontmatter, validateSchema } from './lib/doc-budget-schema.mjs'
import { auditRuleIndex } from './lib/rule-index-audit.mjs'
import { undeclaredErrorRules } from './lib/rule-ledger.mjs'
import { CODING_SCENARIOS } from './lib/rule-session.mjs'
import { loadCursorRules, renderRuleContext, resolveRulePack } from './lib/l2-rule-resolver.mjs'
import { resolveRoots } from './lib/roots.mjs'
import { artifactCompatibilitySchemaDiagnostic } from './lib/vnext-artifact-compat.mjs'

const COMMON_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DOCS_TDD_DIR = join(COMMON_DIR, '..')
const PRDS_DIR = join(DOCS_TDD_DIR, 'prds') // 项目实例根（PR-* 已从仓库根收进 prds/）
const RULES_DIR = join(COMMON_DIR, 'rules') // 规则知识层（规则文档 + rule-index/ruleset/ownership 已从 common/ 收进 rules/）
const SCRIPTS_DIR = join(COMMON_DIR, 'engine', 'agent-scripts')
const TEMPLATES_DIR = join(DOCS_TDD_DIR, 'templates')
const LINK_CHECK_SCRIPT = join(SCRIPTS_DIR, 'check-doc-links.mjs')
const REQUIRED_SCRIPTS = [
  'check-doc-links.mjs',
  'docs-tdd.mjs',
  'effective-rules.mjs',
  'golden-run.mjs',
  'install-local-agent-rules.mjs',
  'prd-intake.mjs',
  'project-orchestrator.mjs',
  'publish-rule-chain.mjs',
  'rule-release.mjs',
  'render-delivery-summary.mjs',
  'rule-context-hook.mjs',
  'rule-context-probe.mjs',
  'rule-context.mjs',
  'run-project-gate.mjs',
  'schema-fixture-reconcile.mjs',
  'set-project-stage.mjs',
  'update-project-index.mjs',
  'update-context-summary.mjs',
  'verify-build-quality.mjs',
]
const SELF_TEST_SCRIPTS = [
  ['check-doc-links.mjs', '--self-test'],
  ['claude-posttooluse-gate.mjs', '--self-test'],
  ['docs-tdd.mjs', '--self-test'],
  ['effective-rules.mjs', '--self-test'],
  ['golden-run.mjs', '--self-test'],
  ['lib/agent-clients.mjs', '--self-test'],
  ['lib/agent-rule-adapters.mjs', '--self-test'],
  ['lib/acceptance-results.mjs', '--self-test'],
  ['lib/assumption-ledger.mjs', '--self-test'],
  ['lib/blockers.mjs', '--self-test'],
  ['lib/changed-detection.mjs', '--self-test'],
  ['lib/code-review.mjs', '--self-test'],
  ['lib/context-pack.mjs', '--self-test'],
  ['lib/context-budget-audit.mjs', '--self-test'],
  ['lib/context-policy.mjs', '--self-test'],
  ['lib/context-session.mjs', '--self-test'],
  ['lib/delivery-summary.mjs', '--self-test'],
  ['lib/doc-budget-schema.mjs', '--self-test'],
  ['lib/explain-rule.mjs', '--self-test'],
  ['lib/gate-doc-parsers.mjs', '--self-test'],
  ['lib/gate-heartbeat.mjs', '--self-test'],
  ['lib/hook-contract.mjs', '--self-test'],
  ['lib/hook-targets.mjs', '--self-test'],
  ['lib/g6-context-session.mjs', '--self-test'],
  ['lib/fast-track-policy.mjs', '--self-test'],
  ['lib/gate-partial.mjs', '--self-test'],
  ['lib/gate-payload.mjs', '--self-test'],
  ['lib/golden-verdict.mjs', '--self-test'],
  ['lib/lark-prd-drift.mjs', '--self-test'],
  ['lib/l2-rule-resolver.mjs', '--self-test'],
  ['lib/l2-rule-resolver-golden.mjs'],
  ['lib/pi-adapter.mjs', '--self-test'],
  ['lib/playwright-mcp-adapter.mjs', '--self-test'],
  ['lib/prd-manifest.mjs', '--self-test'],
  ['lib/project-decision.mjs', '--self-test'],
  ['lib/project-index.mjs', '--self-test'],
  ['lib/project-scaffold.mjs', '--self-test'],
  ['lib/requirement-coverage.mjs', '--self-test'],
  ['lib/rule-session.mjs', '--self-test'],
  ['lib/rule-chain-runtime.mjs', '--self-test'],
  ['lib/rule-ledger.mjs', '--self-test'],
  ['lib/rule-index-audit.mjs', '--self-test'],
  ['lib/rule-surface-visibility.mjs', '--self-test'],
  ['lib/effective-sources.mjs', '--self-test'],
  ['lib/l2-conflict-detect.mjs', '--self-test'],
  ['lib/effective-snapshot.mjs', '--self-test'],
  ['lib/effective-doctor.mjs', '--self-test'],
  ['lib/rule-maturity.mjs', '--self-test'],
  ['lib/rule-consumption.mjs', '--self-test'],
  ['lib/rule-consumption-pairing.mjs', '--self-test'],
  ['lib/rule-injection-telemetry.mjs', '--self-test'],
  ['lib/rule-consumption-regression.mjs', '--self-test'],
  ['lib/pinned-source.mjs', '--self-test'],
  ['lib/precommit-wiring.mjs', '--self-test'],
  ['lib/rule-pin.mjs', '--self-test'],
  ['lib/waiver-policy.mjs', '--self-test'],
  ['lib/warn-retirement.mjs', '--self-test'],
  ['lib/workflow-version.mjs', '--self-test'],
  ['lib/confirmation.mjs', '--self-test'],
  ['install-local-agent-rules.mjs', '--self-test'],
  ['prd-intake.mjs', '--self-test'],
  ['project-orchestrator.mjs', '--self-test'],
  ['publish-rule-chain.mjs', '--self-test'],
  ['rule-release.mjs', '--self-test'],
  ['render-delivery-summary.mjs', '--self-test'],
  ['rule-context-hook.mjs', '--self-test'],
  ['rule-context-probe.mjs', '--self-test'],
  ['run-project-gate.mjs', '--self-test'],
  ['set-project-stage.mjs', '--self-test'],
  ['update-project-index.mjs', '--self-test'],
  ['update-context-summary.mjs', '--self-test'],
  ['schema-fixture-reconcile.mjs', '--self-test'],
  ['verify-build-quality.mjs', '--self-test'],
  ['verify-code-rules.mjs', '--self-test'],
  ['verify-project-gate.mjs', '--self-test'],
  ['vnext-self-test.mjs', '--self-test'],
  ['lib/vnext-artifact-compat.mjs', '--self-test'],
  ['vnext-artifact-compat.mjs', '--self-test'],
  ['vnext-reconcile.mjs', '--self-test'],
  ['vnext-reconcile-e2e.mjs', '--self-test'],
  ['lib/vnext-reconcile-runtime.mjs', '--self-test'],
  ['lib/vnext-reconcile-actions.mjs', '--self-test'],
  ['lib/vnext-autonomous-validation.mjs', '--self-test'],
  ['verify-msw-manifest.mjs', '--self-test'],
  ['warn-ledger.mjs', '--self-test'],
]
// PR-00000 是 golden-run 的保留夹具 ID：它只在 golden-run 运行的几秒内物化在 docs_tdd 下，
// 不是真实项目。若正好被扫到（并发/异常退出残留），阶段链/schema 类检查会误报。
const RESERVED_FIXTURE_IDS = new Set(['PR-00000'])
const isRealProjectDir = (entry, pattern) => entry.isDirectory() && pattern.test(entry.name) && !RESERVED_FIXTURE_IDS.has(entry.name)

const RESIDENT_MARKER = '<!-- RESIDENT-DOC'
const RESIDENT_BUDGET = 5000 // 码点；改此值须同步 rule-router.md §4 的预算声明
const L1_FILE = join(homedir(), '.ai-rules', 'AGENT.md')
const L1_RESIDENT_BUDGET = 7000
const RESIDENT_ENVELOPE_BUDGET = 16000 // L1 + L3 router + L2 alwaysApply bodies
// 按需文档仍须有界；warn 提醒拆分，fail 阻断。引用型大文件可使用有余量的 override。
const DOC_BUDGET_DEFAULT = { warn: 9000, fail: 13000 }
const DOC_BUDGET_OVERRIDES = {
  // §5 完整 ID 台账已拆到 rule-id-ledger.md（单调增长、从不路由进 context），本文只剩 §1-4（会进上下文/被人读）。
  'rule-ids-and-gates.md': { warn: 18000, fail: 20000 },
  'rule-id-ledger.md': { warn: 20000, fail: 24000 }, // 阶段 gate ID 台账：随规则条目单调增长的纯查表，grandfather 带余量上限
  'architecture-and-state.md': { warn: 15000, fail: 17000 },
  'CHANGELOG.md': { warn: 15000, fail: 18000 }, // 轮转后保留近期条目；历史在 CHANGELOG-archive.md
}
const BUDGET_EXEMPT = new Set(['CHANGELOG-archive.md']) // 纯历史归档，不进 context、不参与覆盖/预算
// 门禁脚本须有界；大执行器可用 override。
const SCRIPT_BUDGET_DEFAULT = { warn: 24000, fail: 30000 }
const SCRIPT_BUDGET_OVERRIDES = {
  'verify-project-gate.mjs': { warn: 52000, fail: 58000 }, // 全 gate 判定聚合入口
  'verify-code-rules.mjs': { warn: 44000, fail: 50000 }, // 静态代码规则扫描
  'check-doc-budget.mjs': { warn: 44000, fail: 48000 }, // 本文件：文档/脚本预算 + 覆盖 + 台账自检
  'run-project-gate.mjs': { warn: 32000, fail: 36000 }, // 正式 gate runner（持久化/证据/阶段同步）
  'verify-build-quality.mjs': { warn: 32000, fail: 36000 }, // 实跑 biome/tsc/vitest 机器事实层
}
// 无 self-test 但可接受的脚本：纯 CLI/IO 包装或副作用型入口（逻辑靠 golden/集成实测覆盖）。
// 新增脚本若含可测纯逻辑，必须加 --self-test 并登记 SELF_TEST_SCRIPTS；否则显式加入本豁免集（一次有意识决定）。
const SELF_TEST_EXEMPT = new Set([
  'check-doc-budget.mjs', // 顶层校验入口本身：无导出纯函数，逻辑每次实跑即自检，并被 golden 间接覆盖
  'precommit-verify-code-rules.mjs', // lint-staged 参数转发薄包装（同 claude-posttooluse-gate.mjs 判定逻辑）
  'decommission-worktree.mjs', // worktree 回收 IO
  'log-exec.mjs', // 执行日志 IO
  'notify-lark.mjs', // Lark 发送薄包装（文档只读同步链路，非 bot）
  'rule-context.mjs', // L2 resolver/receipt 的人工诊断 CLI，核心纯逻辑各自在 lib 自测
  'prepare-coding-worktree.mjs', // worktree 准备 IO
  'start-new-project.mjs', // 项目骨架 IO
  'sync-lark-docs.mjs', // Lark 只读同步 IO
  // 注：AI 自动修 bug 的常驻服务已抽到 common/lark-bot/（含 lib/__tests__），不在本 agent-scripts 预算/自测扫描范围。
  'lib/fingerprint.mjs', // 指纹小工具（被 rule-release/effective-rules self-test 间接覆盖）
  'lib/roots.mjs', // 根解析（被多脚本 self-test 间接覆盖）
  'lib/golden-cases.mjs', // golden 变异用例数据表（apply/assert 闭包 + 数据，判定核心在 lib/golden-verdict.mjs 已自测；被 golden-run 端到端覆盖）
  'lib/gate-evidence.mjs', // gate 证据渲染（纯字符串），由 lib/gate-payload.mjs --self-test 经 renderEvidence 覆盖
  'lib/gate-cache.mjs', // gate 指纹/缓存/历史 IO，被 golden-run 聚合器烟测端到端覆盖
  'lib/run-log.mjs', // 子进程执行 + 日志 IO，被 golden-run 聚合器烟测端到端覆盖
  'lib/rule-session-runtime.mjs',
  'lib/cli-report.mjs', // CLI 报告打印小工具（只 console.log/warn，无导出纯逻辑）；行为由 capability/context 冒烟 + golden 覆盖
  'lib/project-status-report.mjs', // capability 体检报告 + worktree 解析（报告/IO 型）；由 docs-tdd capability 冒烟 + golden 覆盖
  'lib/lark-command.mjs', // Lark 只读同步命令构造/校验；validateSource 由 common/lark-bot/__tests__/lark-pure.test.mjs 经 sync-lark-docs re-export 覆盖
])
const ROUTER_FILE = 'rule-router.md'
const README_FILE = 'README.md'
const RULE_INDEX_FILE = 'rule-index.json'
const RULE_OWNERSHIP_FILE = 'rule-ownership.json'
const DEFAULT_CONFIG_FILE = join(DOCS_TDD_DIR, 'docs-tdd.config.default.json')
const LEDGER_FILE = 'rule-ids-and-gates.md' // rule ID 台账（脚本里的 ID 必须登记于此或其拆分文件）
const LEDGER_EXTENSION_FILE = 'rule-id-ledger.md' // 从 §5 拆出的阶段 gate 类 ID 台账（纯查表，不进 context）
const REQUIRED_TEMPLATES = [
  '01-scope-and-phases-template.md',
  '02-technical-design-template.md',
  '03-api-contract-template.md',
  '04-frontend-tasks-template.md',
  '05-ui-and-interaction-template.md',
  '06-collaboration-template.md',
  '07-figma-spec-template.md',
  'context-summary-template.md',
  'evidence-readme-template.md',
  'feature-doc-checklist.md',
  'feature-inventory-template.md',
  'notification-log-template.md',
  'project-readme-frontmatter-template.md',
  'real-fixture-reconcile-test-template.ts',
  'msw-handler-template.ts',
  'msw-mock-contract-test-template.ts',
]
const COVERAGE_EXEMPT = new Set([README_FILE, ROUTER_FILE, 'CHANGELOG-archive.md', 'rule-id-ledger.md']) // 索引/常驻本身不需被自己收录；归档纯历史、ID 台账纯查表都不进 context 索引
const SCRIPT_REF_RE = /(?:common\/agent-scripts\/|agent-scripts\/)([A-Za-z0-9_.-]+\.mjs)/g
const TEMPLATE_REF_RE = /(?:templates\/|\.\.\/templates\/)([A-Za-z0-9_.-]+\.(?:md|ts))/g
const FORBIDDEN_DUPLICATE_BLOCKS = {
  'development-rules.md': ['## 1. 工作顺序', '## 2. 架构、状态、API', '## 6. UI、Figma 与主题', '## 7. i18n', '## 9. Review Checklist'],
  'architecture-and-state.md': ['为何不现在全量引入', '下一个需要 mock 的新功能', '试点结论：MSW 升为新功能强制路线'],
  'new-project-kickoff.md': ['## 5. 默认产物清单', '## 6. 默认成功标准', 'apps/web/docs_tdd/<PROJECT-ID>/\n  README.md'],
  // 去重后锁位：以下签名内容各有唯一权威源，次要文件不得再复述（回潮即打回）。
  // A1/A4 通知规则源在 lark-active-notification.md §8/§9；A9 圆角映射源在 ui-style-token-rules.md §1.2。
  'collaboration-and-notifications.md': ['格式校验：当前阶段与下一阶段字段', 'dry-run 不等于已通知', 'real/dry-run'],
  'figma-mcp-read-workflow.md': ['若 cornerRadius === 16', 'rounded-lg（平替 Figma rounded-4）'],
}

function printHelp() {
  console.log(`usage: check-doc-budget.mjs [--help]

常驻上下文预算校验：确保 docs_tdd 规则体系"规则可变多，常驻恒定小"不漂移。
校验常驻文件大小、路由/README 覆盖、rule ID 台账、模板/脚本存在性、本地链接、阶段真值同步、项目元数据 schema。

Options:
  --help  Show this help message and exit`)
}

if (process.argv.includes('--help')) {
  printHelp()
  process.exit(0)
}

// 校验 10 配置：手动导航文件不得再手抄「项目清单表」——唯一真值源是自动生成的 PROJECTS.md。
// 判据只拦「表格数据行的第一格是 PR-编号」这种清单形态（被收敛掉的那种），
// 不误伤正文里对单个项目的指针引用（如链接 `[PR-01685](./PR-01685/README.md)` 或行内提及）。
const NAV_FILES_NO_PROJECT_TABLE = ['README.md', 'AGENTS.md', 'CONTEXT.md']
// 行首 `|` 后第一格即为 PR-编号（可带 markdown 链接/反引号包裹）。PROJECTS.md 自身豁免（它就是那张表）。
const PROJECT_TABLE_ROW_RE = /^\s*\|\s*\[?`?PR-\d{4,}/

// 校验 11 配置（DOC-SYNC-001/002/003）：阶段真值四面互锁，防「gate 已过但 README/摘要/索引说旧阶段」漂移。
// 根因实证：PR-02074 gate-results 已是 G6 PASS，README 仍写「G0 资料接收」，PROJECTS.md 派生自手工行随之失真。
// 正式写入口是 docs-tdd gate；runner 先追加成功历史，再调用 set-project-stage.mjs 同步四面真值。
const MACHINE_ROW_RE = /\|\s*(?:\*\*)?最新通过门禁(?:\*\*)?\s*\|\s*([^|]+)\|/
const SUMMARY_STAGE_RE = /\|\s*(?:\*\*)?当前阶段(?:\*\*)?\s*\|\s*(G[0-8])/
const MACHINE_SUMMARY_MARKER = 'update-context-summary.mjs'

/** 码点数、frontmatter 解析、轻量 JSON Schema 校验：纯逻辑抽到 lib 并 --self-test 直测（见 SELF_TEST_SCRIPTS）。 */

const errors = []
const mdFiles = readdirSync(RULES_DIR).filter((n) => n.endsWith('.md'))

// 扫描所有 common/*.md，找带常驻标记的文件
const residents = []
for (const name of mdFiles) {
  const text = readFileSync(join(RULES_DIR, name), 'utf8')
  if (text.includes(RESIDENT_MARKER)) residents.push({ name, size: charCount(text) })
}

// 校验 1：常驻文件恰好一个
if (residents.length === 0) {
  errors.push(`❌ 没有找到带 ${RESIDENT_MARKER} --> 标记的常驻文件（应为 ${ROUTER_FILE}）。`)
} else if (residents.length > 1) {
  errors.push(`❌ 出现 ${residents.length} 个常驻文件：${residents.map((r) => r.name).join(', ')}。` + `\n   常驻集只能一份，其余改为"按需读"并移除标记。`)
}

// 校验 2：常驻文件大小
for (const r of residents) {
  if (r.size > RESIDENT_BUDGET) {
    errors.push(`❌ ${r.name} = ${r.size} 字符，超预算 ${RESIDENT_BUDGET}（超 ${r.size - RESIDENT_BUDGET}）。` + `\n   常驻必须恒定小：把细则移到对应 on-demand 专题，§1 只留"违反即打回"的硬规则。`)
  } else {
    console.log(`✅ ${r.name} = ${r.size} / ${RESIDENT_BUDGET} 字符（余 ${RESIDENT_BUDGET - r.size}）`)
  }
}

// 校验 2.1：L1 也是每个 Codex/Claude 会话的真实常驻成本，不能留在 L3 闸外无限增长。
let l1Chars = 0
if (!existsSync(L1_FILE)) {
  errors.push(`❌ 缺少 L1 常驻规则：${L1_FILE}`)
} else {
  l1Chars = charCount(readFileSync(L1_FILE, 'utf8'))
  if (l1Chars > L1_RESIDENT_BUDGET) errors.push(`❌ L1 AGENT.md = ${l1Chars} 字符，超预算 ${L1_RESIDENT_BUDGET}（超 ${l1Chars - L1_RESIDENT_BUDGET}）。\n   把长清单移入按需 skill，只在 L1 保留跨仓高风险硬规则与路由。`)
  else console.log(`✅ L1 AGENT.md = ${l1Chars} / ${L1_RESIDENT_BUDGET} 字符（余 ${L1_RESIDENT_BUDGET - l1Chars}）`)
}

// 校验 2.2：报告跨层基础常驻面，避免各层分别不超限但合计失控；另报告代表性首次编辑 L2 注入量。
try {
  const roots = resolveRoots()
  const cursorRulesDir = roots.consumerRoot && join(roots.consumerRoot, roots.config.ruleSurfaces.cursorRulesDir)
  if (!cursorRulesDir || !existsSync(cursorRulesDir)) throw new Error('consumer .cursor/rules directory is unavailable')
  const alwaysApplyRules = loadCursorRules(cursorRulesDir).filter((rule) => rule.alwaysApply)
  const l2AlwaysApplyChars = alwaysApplyRules.reduce((sum, rule) => sum + charCount(rule.body), 0)
  const l3ResidentChars = residents.reduce((sum, rule) => sum + rule.size, 0)
  const residentEnvelopeChars = l1Chars + l3ResidentChars + l2AlwaysApplyChars
  const detail = `L1 ${l1Chars} + L3 ${l3ResidentChars} + L2 alwaysApply ${l2AlwaysApplyChars}`
  if (residentEnvelopeChars > RESIDENT_ENVELOPE_BUDGET) errors.push(`❌ 跨层基础常驻面 = ${residentEnvelopeChars} / ${RESIDENT_ENVELOPE_BUDGET} 字符（${detail}）。`)
  else console.log(`✅ 跨层基础常驻面 = ${residentEnvelopeChars} / ${RESIDENT_ENVELOPE_BUDGET} 字符（${detail}，余 ${RESIDENT_ENVELOPE_BUDGET - residentEnvelopeChars}）`)
  const representativeTargets = ['apps/web/src/Foo.tsx', 'apps/web/src/useFoo.ts', 'apps/web/src/foo.ts']
  for (const target of representativeTargets) {
    const pack = resolveRulePack({ worktree: roots.consumerRoot, targetFiles: [target], rulesDir: cursorRulesDir, conflictOverrides: roots.config.ruleConflictOverrides || [] })
    const rendered = renderRuleContext(pack)
    console.log(`ℹ L2 首次编辑样本 ${target}: ${pack.matchedRules.length} 条 / ${rendered.byteLength} bytes`)
  }
} catch (error) {
  errors.push(`❌ 无法计算首次代码编辑常驻面：${error.message}`)
}

// 校验 2.5：per-file on-demand 预算。常驻文件已由校验 2 管；其余专题文档各有天花板，防无限膨胀。
// 计量口径即整篇正文——单调增长的 ID 台账已物理拆到独立文件 rule-id-ledger.md（各有自己的 override），
// 不再靠「截掉 §5 再计量」这类障眼法（拆出去才真正减了本文行数）。
{
  const overCap = []
  for (const name of mdFiles) {
    if (BUDGET_EXEMPT.has(name) || residents.some((r) => r.name === name)) continue
    const size = charCount(readFileSync(join(RULES_DIR, name), 'utf8'))
    const budget = DOC_BUDGET_OVERRIDES[name] || DOC_BUDGET_DEFAULT
    if (size > budget.fail) {
      overCap.push(`❌ ${name} = ${size} 字符，超硬上限 ${budget.fail}（超 ${size - budget.fail}）。` + `\n   拆分为更小专题、把历史移出、或改指针；引用型大文件可在 check-doc-budget.mjs 的 DOC_BUDGET_OVERRIDES 调整并说明理由。`)
    } else if (size > budget.warn) {
      console.warn(`⚠ ${name} = ${size} 字符，超告警线 ${budget.warn}（硬上限 ${budget.fail}）：考虑瘦身/归档/拆指针。`)
    }
  }
  if (overCap.length) errors.push(...overCap)
  else console.log(`✅ on-demand 预算：${mdFiles.length - residents.length} 个专题文档均在硬上限内。`)
}

// 校验 2.6：门禁脚本体量预算 + self-test 覆盖门。脚本是机器强制层的实体，同样不能无限膨胀，
// 且每个含可测逻辑的脚本都应有 self-test（"规则即测试"）；无 self-test 的须显式登记豁免。
{
  const scriptFiles = [
    ...readdirSync(SCRIPTS_DIR)
      .filter((n) => n.endsWith('.mjs'))
      .map((n) => n),
    ...(existsSync(join(SCRIPTS_DIR, 'lib'))
      ? readdirSync(join(SCRIPTS_DIR, 'lib'))
          .filter((n) => n.endsWith('.mjs'))
          .map((n) => `lib/${n}`)
      : []),
  ]
  const selfTested = new Set(SELF_TEST_SCRIPTS.map((entry) => entry[0]))
  const overCap = []
  const missingSelfTest = []
  for (const rel of scriptFiles) {
    const size = charCount(readFileSync(join(SCRIPTS_DIR, rel), 'utf8'))
    const budget = SCRIPT_BUDGET_OVERRIDES[rel] || SCRIPT_BUDGET_DEFAULT
    if (size > budget.fail) {
      overCap.push(`❌ agent-scripts/${rel} = ${size} 字符，超硬上限 ${budget.fail}（超 ${size - budget.fail}）。` + `\n   抽公共 lib、拆子命令、或把纯逻辑移进可测 lib；确属大执行器可在 SCRIPT_BUDGET_OVERRIDES 调整并说明理由。`)
    } else if (size > budget.warn) {
      console.warn(`⚠ agent-scripts/${rel} = ${size} 字符，超告警线 ${budget.warn}（硬上限 ${budget.fail}）：考虑抽 lib/拆子命令。`)
    }
    const coveredByVnextSuite = rel.startsWith('vnext-') || rel.startsWith('lib/vnext-')
    if (!selfTested.has(rel) && !SELF_TEST_EXEMPT.has(rel) && !coveredByVnextSuite) missingSelfTest.push(rel)
  }
  if (overCap.length) errors.push(...overCap)
  if (missingSelfTest.length) {
    errors.push(`❌ 以下脚本既无 --self-test 也未登记豁免：${missingSelfTest.join(', ')}。` + `\n   含可测逻辑的加 --self-test 并登记 SELF_TEST_SCRIPTS；纯 CLI/IO 包装加入 SELF_TEST_EXEMPT（一次有意识决定）。`)
  }
  if (!overCap.length && !missingSelfTest.length) {
    console.log(`✅ 脚本预算与 self-test 覆盖：${scriptFiles.length} 个 .mjs 均在硬上限内且已 self-test 或登记豁免。`)
  }
}

// Router 只保留启动协议；专题覆盖由机器索引承担，避免常驻文件手抄全量文件名。
const routerText = readFileSync(join(RULES_DIR, ROUTER_FILE), 'utf8')

// 校验 3.1：README 人工总索引也必须覆盖每个专题 md。router 是机器入口，README 是人工查阅入口，二者都不能漂。
const readmeText = readFileSync(join(COMMON_DIR, README_FILE), 'utf8')
const readmeMissing = mdFiles.filter((n) => !COVERAGE_EXEMPT.has(n) && !readmeText.includes(n))
if (readmeMissing.length) {
  errors.push(
    `❌ 以下规则文件未被 ${README_FILE} 专题全索引收录（人工查阅会漏）：
   ${readmeMissing.join('\n   ')}` +
      `
   请在 ${README_FILE}「专题全索引」补链接。`,
  )
} else {
  console.log(`✅ README 索引覆盖：${mdFiles.length - COVERAGE_EXEMPT.size} 个专题文件全部被 ${README_FILE} 收录。`)
}

// 校验 4：机器可读路由索引必须可解析，且引用的 common 文档真实存在。
const ruleIndexPath = join(RULES_DIR, RULE_INDEX_FILE)
const indexedRuleRefs = new Set()
const knownScenarioNames = new Set()
if (!existsSync(ruleIndexPath)) {
  errors.push(`❌ 缺少 ${RULE_INDEX_FILE}（机器可读场景路由索引）。`)
} else if (!routerText.includes(RULE_INDEX_FILE)) {
  errors.push(`❌ ${RULE_INDEX_FILE} 未被 ${ROUTER_FILE} 收录。`)
} else {
  try {
    const ruleIndex = JSON.parse(readFileSync(ruleIndexPath, 'utf8'))
    const resolveSourceFile = (file) => {
      const rulesPath = join(RULES_DIR, file)
      if (existsSync(rulesPath)) return rulesPath
      const commonPath = join(COMMON_DIR, file)
      return existsSync(commonPath) ? commonPath : null
    }
    const indexAudit = auditRuleIndex({
      index: ruleIndex,
      residentFile: ROUTER_FILE,
      codingScenarios: CODING_SCENARIOS,
      resolveSourceFile,
      readSource: (file) => readFileSync(file, 'utf8'),
    })
    const { scenarioNames } = indexAudit
    for (const name of scenarioNames) knownScenarioNames.add(name)
    for (const ref of indexAudit.indexedRuleRefs) indexedRuleRefs.add(ref)
    for (const error of indexAudit.errors) errors.push(`❌ ${RULE_INDEX_FILE}.${error}`)
    // 默认路径必须对所有场景实际可生成且不越 hard limit。用 summary 硬上限构造最坏输入，避免活跃项目偏短掩盖回归。
    const release = { currentFingerprint: 'context-budget-audit' }
    const effective = {
      currentFingerprint: 'context-budget-audit',
      clientMatrix: {},
    }
    const contextAudit = auditDefaultContextPacks({
      index: ruleIndex,
      codingScenarios: CODING_SCENARIOS,
      buildPack: (name, mode, options = {}) =>
        createContextPack('PR-00000', name, release, effective, mode, {
          summaryText: 'x'.repeat(2200),
          write: false,
          ...options,
        }),
    })
    const packErrors = contextAudit.errors
    if (packErrors.length) errors.push(`❌ 默认 context pack 越界或无法生成：\n   ${packErrors.join('\n   ')}`)
    else console.log(`✅ 默认 context pack：${scenarioNames.length} 个场景均可生成且未超过 hard limit；编码中位缩减 ${contextAudit.medianReductionPercent}%，G6 顺序总量 ${contextAudit.g6SequentialChars} 字符。`)
    if (!errors.some((error) => error.includes(RULE_INDEX_FILE))) {
      console.log(`✅ ${RULE_INDEX_FILE}：${scenarioNames.length} 个场景索引可解析，引用文件均存在。`)
    }
  } catch (error) {
    errors.push(`❌ ${RULE_INDEX_FILE} 不是合法 JSON：${error.message}`)
  }
}

const indexOrphans = mdFiles.filter((name) => !COVERAGE_EXEMPT.has(name) && !indexedRuleRefs.has(name))
if (indexOrphans.length) {
  errors.push(`❌ 以下规则文件未被 ${RULE_INDEX_FILE} 任一场景收录（孤儿规则）：\n   ${indexOrphans.join('\n   ')}` + `\n   请把文件加入最匹配的 scenario。`)
} else {
  console.log(`✅ 机器路由覆盖：${mdFiles.length - COVERAGE_EXEMPT.size} 个专题文件全部被 ${RULE_INDEX_FILE} 收录。`)
}

// 校验 4.5：专题正文只有一个所有者；总览/启动文档不得重新复制已收敛规则块。
{
  const ownershipPath = join(RULES_DIR, RULE_OWNERSHIP_FILE)
  if (!existsSync(ownershipPath)) {
    errors.push(`❌ 缺少 ${RULE_OWNERSHIP_FILE}（专题唯一正文所有权表）。`)
  } else {
    try {
      const ownership = JSON.parse(readFileSync(ownershipPath, 'utf8'))
      const topics = ownership.topics || {}
      const topicNames = Object.keys(topics)
      const invalid = []
      for (const topic of topicNames) {
        const entry = topics[topic]
        if (!entry || typeof entry.source !== 'string' || !entry.source) {
          invalid.push(`${topic}: source 缺失`)
          continue
        }
        if (!existsSync(join(RULES_DIR, entry.source))) invalid.push(`${topic}: ${entry.source} 不存在`)
        if (entry.sections && !/^\d+(?:-\d+)?$/.test(entry.sections)) invalid.push(`${topic}: sections=${entry.sections} 无效`)
      }
      if (invalid.length) {
        errors.push(`❌ ${RULE_OWNERSHIP_FILE} 含无效专题所有权：\n   ${invalid.join('\n   ')}`)
      } else {
        console.log(`✅ 专题所有权：${topicNames.length} 个主题均有且仅有一个有效正文源。`)
      }
    } catch (error) {
      errors.push(`❌ ${RULE_OWNERSHIP_FILE} 不是合法 JSON：${error.message}`)
    }
  }

  const duplicateOffenders = []
  for (const [file, fragments] of Object.entries(FORBIDDEN_DUPLICATE_BLOCKS)) {
    const text = readFileSync(join(RULES_DIR, file), 'utf8')
    for (const fragment of fragments) {
      if (text.includes(fragment)) duplicateOffenders.push(`${file}: ${fragment}`)
    }
  }
  if (duplicateOffenders.length) {
    errors.push(`❌ 已收敛的重复规则块重新出现：\n   ${duplicateOffenders.join('\n   ')}\n   请改为引用 ${RULE_OWNERSHIP_FILE} 指向的正文源。`)
  } else {
    console.log('✅ 规则去重回归：总览、MSW 与启动协议未重新复制已收敛正文。')
  }
}

// 校验 5：脚本里实装的每个 rule ID 必须登记进台账。
// 防「脚本改了 ID、台账没跟」的脱节（此前 DOC-STRUCT-*/DOC-G0-* 等在台账 0 命中）。
// 台账跨两文件：rule-ids-and-gates.md（§3 CODE-*、§3.5 VERIFY-*、§4 DOC-WAIVER-*）+ rule-id-ledger.md（阶段 gate 类）。
const ledgerPath = join(RULES_DIR, LEDGER_FILE)
const ledgerExtensionPath = join(RULES_DIR, LEDGER_EXTENSION_FILE)
if (!existsSync(ledgerPath)) {
  errors.push(`❌ 缺少 ${LEDGER_FILE}（rule ID 台账）。`)
} else if (!existsSync(ledgerExtensionPath)) {
  errors.push(`❌ 缺少 ${LEDGER_EXTENSION_FILE}（rule ID 台账拆分文件）。`)
} else {
  const ledgerText = `${readFileSync(ledgerPath, 'utf8')}\n${readFileSync(ledgerExtensionPath, 'utf8')}`
  // 中段可含多节（DOC-G3-IMPL-006、DOC-ASSUM-001）：此前 `[A-Z0-9]+-\d+` 只认单节，
  // DOC-G3-IMPL-* 整族逃过登记校验。
  const idRe = /'((?:CODE|DOC|GIT|VERIFY)-[A-Z0-9]+(?:-[A-Z]+)*-\d+)'/g
  const scriptIds = new Set()
  // 顶层脚本 + lib/ 子模块都要扫：阻塞语义等纯规则实装在 lib/blockers.mjs，rule ID 台账不能漏掉它。
  const idSourceFiles = [
    ...readdirSync(SCRIPTS_DIR)
      .filter((n) => n.endsWith('.mjs'))
      .map((n) => join(SCRIPTS_DIR, n)),
    ...(existsSync(join(SCRIPTS_DIR, 'lib'))
      ? readdirSync(join(SCRIPTS_DIR, 'lib'))
          .filter((n) => n.endsWith('.mjs'))
          .map((n) => join(SCRIPTS_DIR, 'lib', n))
      : []),
  ]
  for (const file of idSourceFiles) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(idRe)) scriptIds.add(match[1])
  }
  const unregistered = [...scriptIds].filter((id) => !ledgerText.includes(id)).sort()
  if (unregistered.length) {
    errors.push(`❌ 以下 rule ID 在脚本里实装但未登记进台账（脱节，Review/通知无法引用）：\n   ${unregistered.join('\n   ')}` + `\n   请在 ${LEDGER_FILE} §3/§3.5/§4 或 ${LEDGER_EXTENSION_FILE} 补台账行。`)
  } else {
    console.log(`✅ rule ID 台账：${scriptIds.size} 个脚本 ID 全部登记于 ${LEDGER_FILE} + ${LEDGER_EXTENSION_FILE}。`)
  }

  // 校验 5b（反方向）：台账里每个 error 级 rule ID 必须在 ruleset.json 声明 blocking + waivable。
  // 判定源与动机见 lib/rule-ledger.mjs。
  const rulesetRules = (() => {
    try {
      return JSON.parse(readFileSync(join(RULES_DIR, 'ruleset.json'), 'utf8'))?.rules ?? null
    } catch {
      return null
    }
  })()
  if (!rulesetRules) {
    errors.push('❌ 无法解析 common/rules/ruleset.json，规则档位与豁免语义无法校验。')
  } else {
    const undeclared = undeclaredErrorRules({
      ledgerText: readFileSync(ledgerExtensionPath, 'utf8'),
      rulesetRules,
    })
    if (undeclared.length) {
      errors.push(`❌ 以下 error 级 rule ID 在 ${LEDGER_EXTENSION_FILE} 有台账行但 ruleset.json 未声明 blocking/waivable：\n   ${undeclared.join('\n   ')}\n   未声明的规则不接受豁免、也不参与档位定档（语义未定义）；请补 { maturity, blocking, waivable }。`)
    } else {
      console.log(`✅ ruleset 声明完整：${LEDGER_EXTENSION_FILE} 的 error 级 ID 均已声明 blocking + waivable。`)
    }
  }
}

// 校验 6.5：核心模板必须携带 template-version 与 template-effective-since 标记。
{
  const missingVersion = []
  for (const name of REQUIRED_TEMPLATES) {
    const text = readFileSync(join(TEMPLATES_DIR, name), 'utf8')
    if (!/template[-_]?version:\s*\d+/i.test(text) || !/template[-_]?effective[-_]?since:\s*\d{4}-\d{2}-\d{2}/i.test(text)) {
      missingVersion.push(name)
    }
  }
  if (missingVersion.length) {
    errors.push(`❌ 以下模板缺少 template-version / template-effective-since 标记：\n   ${missingVersion.join('\n   ')}`)
  } else {
    console.log(`✅ 模板版本标记：${REQUIRED_TEMPLATES.length} 个核心模板均携带 version + effectiveSince。`)
  }
}

// 校验 6：核心模板必须存在。模板不在 common/*.md 路由覆盖范围内，单独检查，防文档引用断链。
const missingTemplates = REQUIRED_TEMPLATES.filter((name) => !existsSync(join(TEMPLATES_DIR, name)))
if (missingTemplates.length) {
  errors.push(
    `❌ 缺少核心模板文件：
   ${missingTemplates.join('\n   ')}` +
      `
   请补齐 apps/web/docs_tdd/templates/ 下对应文件，或从 REQUIRED_TEMPLATES 移除并同步文档引用。`,
  )
} else {
  console.log(`✅ 模板存在性：${REQUIRED_TEMPLATES.length} 个核心模板均存在。`)
}

// 校验 7：本地 Markdown 链接目标文件必须存在。锚点不在此处校验，避免中文标题 slug 规则误报。
const missingScripts = REQUIRED_SCRIPTS.filter((name) => !existsSync(join(SCRIPTS_DIR, name)))
if (missingScripts.length) {
  errors.push(
    `❌ 缺少核心脚本文件：
   ${missingScripts.join('\n   ')}`,
  )
} else if (!existsSync(LINK_CHECK_SCRIPT)) {
  errors.push('❌ 缺少 check-doc-links.mjs（Markdown 本地链接检查脚本）。')
} else {
  console.log(`✅ 核心脚本存在性：${REQUIRED_SCRIPTS.length} 个核心脚本均存在。`)
  for (const [script, ...scriptArgs] of SELF_TEST_SCRIPTS) {
    const selfTest = spawnSync(process.execPath, [join(SCRIPTS_DIR, script), ...scriptArgs], {
      cwd: DOCS_TDD_DIR,
      encoding: 'utf8',
    })
    if (selfTest.status !== 0) {
      errors.push(selfTest.stderr.trim() || selfTest.stdout.trim() || `❌ ${script} ${scriptArgs.join(' ')} 自测失败。`)
    }
  }
  if (!errors.some((error) => error.includes('self-test') || error.includes('自测失败'))) {
    console.log(`✅ 核心脚本自测：${SELF_TEST_SCRIPTS.length} 个自测入口均通过。`)
  }
  const linkCheck = spawnSync(process.execPath, [LINK_CHECK_SCRIPT], {
    cwd: DOCS_TDD_DIR,
    encoding: 'utf8',
  })
  if (linkCheck.status !== 0) {
    errors.push(linkCheck.stderr.trim() || linkCheck.stdout.trim() || '❌ Markdown 本地链接检查失败。')
  } else {
    process.stdout.write(linkCheck.stdout)
  }
}

// 校验 8：文档/模板里直接写到的公共 agent-scripts/*.mjs 必须存在。
// Markdown 链接检查抓不到命令行里的脚本路径；这里补齐命令/代码块/JSON 字符串中的脚本断链。
const docFilesForScriptRefs = [
  ...mdFiles.map((name) => join(RULES_DIR, name)),
  join(RULES_DIR, RULE_INDEX_FILE),
  ...readdirSync(TEMPLATES_DIR)
    .filter((name) => ['.md', '.ts'].some((ext) => name.endsWith(ext)))
    .map((name) => join(TEMPLATES_DIR, name)),
]

// 文档里的字面量场景名必须真实存在于 rule-index。占位符 <SCENARIO> 不检查；
// 这里专门拦 `docs-tdd.mjs context PR-01234 typo_scenario` 这类能复制、但运行必失败的漂移。
{
  const invalidScenarioRefs = []
  const literalScenarioRe = /docs-tdd\.mjs\s+context\s+(?:(?:PR|TR)-\d{5}|<PROJECT-ID>)\s+([a-z][a-z0-9_]*)/g
  for (const file of docFilesForScriptRefs) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(literalScenarioRe)) {
      if (!knownScenarioNames.has(match[1])) {
        const line = text.slice(0, match.index).split('\n').length
        invalidScenarioRefs.push(`${file}:${line}: ${match[1]}`)
      }
    }
  }
  if (invalidScenarioRefs.length) {
    errors.push(`❌ 文档引用了 rule-index.json 中不存在的 context 场景：\n   ${invalidScenarioRefs.join('\n   ')}`)
  } else {
    console.log('✅ context 场景引用：文档中的字面量场景均存在于 rule-index.json。')
  }
}

// 默认绑定配置的核心键必须至少有一个运行时消费者，防止“配置看似可移植，脚本仍硬编码”。
{
  const coreConfigKeys = ['appSubpath', 'docsMountPath', 'baseRef', 'projectIdPattern', 'branchPrefix', 'defaultPort', 'portRangeStart', 'verifyPath', 'typecheckRoots', 'productionBuild', 'moduleImportAliases', 'larkOutputDir', 'ruleInjection']
  if (!existsSync(DEFAULT_CONFIG_FILE)) {
    errors.push('❌ 缺少 docs-tdd.config.default.json。')
  } else {
    const scriptFiles = [
      ...readdirSync(SCRIPTS_DIR)
        .filter((name) => name.endsWith('.mjs'))
        .map((name) => join(SCRIPTS_DIR, name)),
      ...readdirSync(join(SCRIPTS_DIR, 'lib'))
        .filter((name) => name.endsWith('.mjs'))
        .map((name) => join(SCRIPTS_DIR, 'lib', name)),
    ]
    const sources = scriptFiles.map((file) => readFileSync(file, 'utf8')).join('\n')
    const unused = coreConfigKeys.filter((key) => !sources.includes(`config.${key}`))
    if (unused.length) errors.push(`❌ 默认配置键无人消费（疑似伪配置）：${unused.join(', ')}`)
    else console.log(`✅ 配置消费：${coreConfigKeys.length} 个核心配置键均有运行时消费者。`)
  }
}

const missingScriptRefs = []
for (const file of docFilesForScriptRefs) {
  const text = readFileSync(file, 'utf8')
  for (const match of text.matchAll(SCRIPT_REF_RE)) {
    const scriptName = match[1]
    if (!existsSync(join(SCRIPTS_DIR, scriptName))) {
      missingScriptRefs.push(`${file}: ${scriptName}`)
    }
  }
}
if (missingScriptRefs.length) {
  errors.push(
    `❌ 文档引用了不存在的公共 agent script：
   ${missingScriptRefs.join('\n   ')}`,
  )
} else {
  console.log('✅ 公共脚本引用：文档/模板中引用的 common/engine/agent-scripts/*.mjs 均存在。')
}

// 校验 9：文档/模板里直接写到的 templates/* 必须存在。
// Markdown 链接检查能覆盖链接，但覆盖不到代码块、注释和脚手架字符串里的模板路径。
const missingTemplateRefs = []
for (const file of docFilesForScriptRefs) {
  const text = readFileSync(file, 'utf8')
  for (const match of text.matchAll(TEMPLATE_REF_RE)) {
    const templateName = match[1]
    if (!existsSync(join(TEMPLATES_DIR, templateName))) {
      missingTemplateRefs.push(`${file}: ${templateName}`)
    }
  }
}
if (missingTemplateRefs.length) {
  errors.push(
    `❌ 文档引用了不存在的模板文件：
   ${missingTemplateRefs.join('\n   ')}`,
  )
} else {
  console.log('✅ 模板引用：文档/模板中引用的 templates/* 文件均存在。')
}

// 校验 10：手动导航文件（README/AGENTS/CONTEXT）不得手抄项目清单表。
// 根因：同一「项目→状态→worktree」事实曾在 4 处手抄，新项目只进自动表、三处手动表全漏（drift）。
// 收敛后唯一真值源是自动生成的 PROJECTS.md；此 gate 焊死，防将来有人/AI 又抄回一份清单。
// 先做内联自测：正样例必须命中、反样例（单个指针引用）必须放行，防判据漂成误报或漏报。
{
  const positive = '| [PR-00001](./PR-00001/README.md) | G4 中 | 用户 |'
  const positiveBacktick = '| `PR-01947` | 未记录 |'
  const negativeLink = '各需求项目文档目录；完整清单见 [PR-01685](./PR-01685/README.md)'
  const negativeInline = '- 项目目录：`apps/web/docs_tdd/prds/PR-01685/`；worktree 见 PROJECTS.md'
  const selfOk = PROJECT_TABLE_ROW_RE.test(positive) && PROJECT_TABLE_ROW_RE.test(positiveBacktick) && !PROJECT_TABLE_ROW_RE.test(negativeLink) && !PROJECT_TABLE_ROW_RE.test(negativeInline)
  if (!selfOk) {
    errors.push('❌ 校验 10 自测失败：PROJECT_TABLE_ROW_RE 判据漂移（正/反样例不符预期），先修脚本再继续。')
  } else {
    const offenders = []
    for (const navFile of NAV_FILES_NO_PROJECT_TABLE) {
      const full = join(DOCS_TDD_DIR, navFile)
      if (!existsSync(full)) continue
      readFileSync(full, 'utf8')
        .split('\n')
        .forEach((line, idx) => {
          if (PROJECT_TABLE_ROW_RE.test(line)) offenders.push(`${navFile}:${idx + 1}: ${line.trim()}`)
        })
    }
    if (offenders.length) {
      errors.push(`❌ 手动导航文件出现手抄项目清单行（应删除，改指向自动生成的 PROJECTS.md）：\n   ${offenders.join('\n   ')}`)
    } else {
      console.log('✅ 导航单一源：README/AGENTS/CONTEXT 未手抄项目清单，项目索引唯一真值源为 PROJECTS.md。')
    }
  }
}

// 校验 10.4：手动导航文件不得再出现「按顺序全读这些规则文件」的多步阅读清单。
// 根因：CONTEXT.md 曾硬编码一份 10 步全读清单（含 common/README、rule-inheritance 等），
// 与 rule-router.md §1「禁止全读 common/」直接冲突；冷启动 Agent 命中哪份全看运气。
// 判据故意收窄成「≥4 个连续编号项，且每项几乎只是一条文档路径」——README 的流程清单是完整句子，不会命中。
{
  const READING_LIST_MIN = 4
  const isPathOnlyStep = (line) => {
    const match = /^\s*\d+\.\s+(.+)$/.exec(line)
    if (!match) return null
    const body = match[1].trim()
    if (body.length > 80) return false
    // 只保留「路径/链接 + 极少修饰词」的形态：去掉路径、链接和括注后基本不剩内容。
    const stripped = body
      .replace(/\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/`[^`]*`/g, '')
      .replace(/[\w./\-[\]]+\.(md|json|mjs)/g, '')
      .replace(/[（(][^）)]*[）)]/g, '')
      .replace(/[\s·、，,；;。.的]/g, '')
    return /\.md|\.json/.test(body) && stripped.length <= 6
  }
  const findReadingList = (text) => {
    let streak = []
    for (const [idx, line] of text.split('\n').entries()) {
      const verdict = isPathOnlyStep(line)
      if (verdict === null) continue // 非编号行：空行/正文不打断（清单常被空行分隔）
      if (verdict) streak.push(idx + 1)
      else streak = []
      if (streak.length >= READING_LIST_MIN) return streak
    }
    return null
  }
  const positive = '1. `apps/web/docs_tdd/AGENTS.md`\n2. `apps/web/docs_tdd/CONTEXT.md`\n3. `apps/web/docs_tdd/common/README.md`\n4. `apps/web/docs_tdd/common/rules/rule-inheritance.md`'
  const negative = '1. 读 [common/rules/rule-router.md](./common/rules/rule-router.md)（唯一常驻规则文件），按场景命中才展开专题正文，禁止全读。'
  if (!findReadingList(positive) || findReadingList(negative)) {
    errors.push('❌ 校验 10.4 自测失败：多步阅读清单判据漂移（正/反样例不符预期），先修脚本再继续。')
  } else {
    const offenders = []
    for (const navFile of NAV_FILES_NO_PROJECT_TABLE) {
      const full = join(DOCS_TDD_DIR, navFile)
      if (!existsSync(full)) continue
      const hit = findReadingList(readFileSync(full, 'utf8'))
      if (hit) offenders.push(`${navFile}:${hit[0]}-${hit[hit.length - 1]}`)
    }
    if (offenders.length) {
      errors.push(`❌ 手动导航文件出现多步「按顺序读这些规则文件」清单（与 rule-router.md §1 渐进披露冲突，应改为指向 router）：\n   ${offenders.join('\n   ')}`)
    } else {
      console.log('✅ 冷启动单一协议：README/AGENTS/CONTEXT 未再硬编码全读清单，启动顺序唯一真值源为 rule-router.md §1。')
    }
  }
}

// 校验 10.5：common/README.md「专题全索引」编号唯一性。
{
  const readmeText = readFileSync(join(COMMON_DIR, README_FILE), 'utf8')
  const sectionStart = readmeText.indexOf('## 专题全索引')
  const sectionEnd = readmeText.indexOf('## ', sectionStart + 1)
  const section = sectionStart === -1 ? '' : readmeText.slice(sectionStart, sectionEnd === -1 ? undefined : sectionEnd)
  const numRe = /^(\d+)\.\s+\[/gm
  const seen = new Map()
  const duplicates = []
  for (let match = numRe.exec(section); match !== null; match = numRe.exec(section)) {
    const num = match[1]
    if (seen.has(num)) duplicates.push(num)
    seen.set(num, (seen.get(num) || 0) + 1)
  }
  if (duplicates.length) {
    errors.push(`❌ common/README.md「专题全索引」存在重复编号：${[...new Set(duplicates)].sort((a, b) => Number(a) - Number(b)).join(', ')}。`)
  } else {
    console.log(`✅ common/README.md「专题全索引」编号唯一（${seen.size} 项）。`)
  }
}

// 校验 10.6（DOC-FRESH-001）：根目录 HANDOFF-*.md 的保鲜期。
// 根因：`HANDOFF-prd-intake-fingerprint-hardening.md` 自称「已批准，未开始实现」，而那批工作
// 早在 2f345c9 就落地了——交接文档天生是一次性的，交接完成后没人回来删，于是变成一份**主动说谎**
// 的根目录文件（新 chat 接手会照着它重做已完成的事）。判据用 git 最后提交日（不用 mtime：clone/checkout 会重置）。
// warn 不阻断：交接文档在有效期内是正当的，只是不该长住。
{
  const HANDOFF_STALE_DAYS = 7
  const handoffs = readdirSync(DOCS_TDD_DIR).filter((name) => /^HANDOFF-.*\.md$/.test(name))
  const stale = []
  for (const name of handoffs) {
    const log = spawnSync('git', ['log', '-1', '--format=%cs', '--', name], {
      cwd: DOCS_TDD_DIR,
      encoding: 'utf8',
    })
    const committedAt = log.status === 0 ? log.stdout.trim() : ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(committedAt)) continue // 未提交/无法判定 → 不猜
    const days = Math.floor((Date.now() - Date.parse(`${committedAt}T00:00:00Z`)) / 86400000)
    if (days > HANDOFF_STALE_DAYS) stale.push(`${name}（最后提交 ${committedAt}，${days} 天前）`)
  }
  if (stale.length) {
    console.warn(`⚠ DOC-FRESH-001：根目录交接文档超过 ${HANDOFF_STALE_DAYS} 天未更新：${stale.join('；')}。交接已完成就删掉它，未完成就更新状态或移进 prds/<PROJECT-ID>/。`)
  } else {
    console.log(`✅ 交接文档保鲜：根目录 ${handoffs.length} 个 HANDOFF-*.md 均在 ${HANDOFF_STALE_DAYS} 天保鲜期内。`)
  }
}

// 校验 11：阶段真值同步（'DOC-SYNC-001'/'DOC-SYNC-002'/'DOC-SYNC-003'）。
// 只检查「已有 gate-results.json 且 ok=true」的项目——没有机器真值的项目无从漂移。
{
  const syncErrors = []
  const projectNames = readdirSync(PRDS_DIR, { withFileTypes: true })
    .filter((entry) => isRealProjectDir(entry, /^(?:PR|TR)-\d{5}$/))
    .map((entry) => entry.name)
  let checkedGates = 0
  for (const name of projectNames) {
    const gateFile = join(PRDS_DIR, name, 'agent/gate-results.json')
    if (!existsSync(gateFile)) continue
    let gateData = null
    try {
      gateData = JSON.parse(readFileSync(gateFile, 'utf8'))
    } catch {
      continue // 解析失败由 verify-project-gate 的 DOC-STRUCT 系列负责报
    }
    if (!gateData.ok || !/^G[0-8]$/.test(gateData.gate || '')) continue
    checkedGates += 1
    const readmeText = readFileSync(join(PRDS_DIR, name, 'README.md'), 'utf8')
    const machineMatch = MACHINE_ROW_RE.exec(readmeText)
    const machineGate = machineMatch ? machineMatch[1].trim().replace(/^\*\*|\*\*$/g, '') : ''
    if (!machineMatch) {
      syncErrors.push(`❌ 'DOC-SYNC-001' ${name}：gate-results 已 ${gateData.gate} PASS，但 README 缺「最新通过门禁」机器行。` + `\n   修复：node apps/web/docs_tdd/common/engine/agent-scripts/set-project-stage.mjs ${name} ${gateData.gate}`)
    } else if (machineGate !== gateData.gate) {
      syncErrors.push(`❌ 'DOC-SYNC-001' ${name}：README 机器行=${machineGate}，gate-results=${gateData.gate}。` + `\n   修复：node apps/web/docs_tdd/common/engine/agent-scripts/set-project-stage.mjs ${name} ${gateData.gate}`)
    }
    const summaryFile = join(PRDS_DIR, name, 'agent/context-summary.md')
    if (existsSync(summaryFile)) {
      const summaryText = readFileSync(summaryFile, 'utf8')
      if (summaryText.includes(MACHINE_SUMMARY_MARKER)) {
        const stageMatch = SUMMARY_STAGE_RE.exec(summaryText)
        if (!stageMatch) {
          syncErrors.push(`❌ 'DOC-SYNC-002' ${name}：机器版 context-summary 缺「当前阶段」行，重跑 update-context-summary.mjs。`)
        } else if (stageMatch[1] !== gateData.gate) {
          syncErrors.push(`❌ 'DOC-SYNC-002' ${name}：context-summary 当前阶段=${stageMatch[1]}，gate-results=${gateData.gate}。` + `\n   修复：node apps/web/docs_tdd/common/engine/agent-scripts/set-project-stage.mjs ${name} ${gateData.gate}`)
        }
      }
      // 手写版摘要（无机器标记）不校验：阶段描述是人工叙述，跳过重写时已有警告。
    }
  }
  const projectsFile = join(DOCS_TDD_DIR, 'PROJECTS.md')
  if (existsSync(projectsFile)) {
    const regen = spawnSync(process.execPath, [join(SCRIPTS_DIR, 'update-project-index.mjs')], {
      cwd: DOCS_TDD_DIR,
      encoding: 'utf8',
    })
    if (regen.status === 0) {
      const normalize = (text) => text.replace(/at \d{4}-\d{2}-\d{2}T[\d:.]+Z/, 'at <TS>')
      if (normalize(regen.stdout) !== normalize(readFileSync(projectsFile, 'utf8'))) {
        syncErrors.push(`❌ 'DOC-SYNC-003' PROJECTS.md 与即时重生成结果不一致（内容漂移）。` + `\n   修复：node apps/web/docs_tdd/common/engine/agent-scripts/update-project-index.mjs --write`)
      }
    }
  }
  if (syncErrors.length) {
    errors.push(...syncErrors)
  } else {
    console.log(`✅ 阶段真值同步：${checkedGates} 个已通过 gate 的项目，README 机器行 / 机器版摘要 / PROJECTS.md 与 gate-results 互锁。`)
  }
}

// 校验 12：active 项目阶段链完整性（DOC-SYNC-004）。
// README 标到 G5+ 时，必须有 G5→当前阶段的连续成功历史，且每条历史证据文件真实存在。
// closed/archived 的历史项目不强制回填新规则前不存在的机器历史，避免伪造证据。
{
  const chainErrors = []
  const requiredSequence = ['G5', 'G6', 'G7', 'G8']
  const projectNames = readdirSync(PRDS_DIR, { withFileTypes: true })
    .filter((entry) => isRealProjectDir(entry, /^(?:PR|TR)-/))
    .map((entry) => entry.name)
  let checkedProjects = 0
  for (const name of projectNames) {
    const projectDir = join(PRDS_DIR, name)
    const readmeFile = join(projectDir, 'README.md')
    if (!existsSync(readmeFile)) continue
    const frontmatter = parseFrontmatter(readFileSync(readmeFile, 'utf8'))
    if (!frontmatter || frontmatter.status !== 'active') continue
    const stageIndex = requiredSequence.indexOf(frontmatter.stage)
    if (stageIndex === -1) continue
    checkedProjects += 1
    const historyFile = join(projectDir, 'agent/gate-history.json')
    if (!existsSync(historyFile)) {
      chainErrors.push(`❌ 'DOC-SYNC-004' ${name}：active 项目 stage=${frontmatter.stage}，但缺少 agent/gate-history.json。`)
      continue
    }
    let history
    try {
      history = JSON.parse(readFileSync(historyFile, 'utf8'))
    } catch (error) {
      chainErrors.push(`❌ 'DOC-SYNC-004' ${name}：agent/gate-history.json 无法解析：${error.message}`)
      continue
    }
    const runs = Array.isArray(history.runs) ? history.runs : []
    let previousIndex = -1
    for (const requiredGate of requiredSequence.slice(0, stageIndex + 1)) {
      const runIndex = runs.findIndex((run, index) => index > previousIndex && run?.gate === requiredGate && run?.ok === true && run?.summary?.fail === 0)
      if (runIndex === -1) {
        chainErrors.push(`❌ 'DOC-SYNC-004' ${name}：stage=${frontmatter.stage}，但缺少按顺序写入的 ${requiredGate} PASS 历史。`)
        break
      }
      const evidence = runs[runIndex].evidence
      if (!evidence || !existsSync(join(projectDir, evidence))) {
        chainErrors.push(`❌ 'DOC-SYNC-004' ${name}：${requiredGate} PASS 历史引用的证据不存在：${evidence || '(empty)'}`)
        break
      }
      previousIndex = runIndex
    }
  }
  if (chainErrors.length) errors.push(...chainErrors)
  else console.log(`✅ active 阶段链：${checkedProjects} 个 G5+ active 项目均有连续 PASS 历史与真实证据。`)
}

// 校验 13：项目元数据 schema 校验（frontmatter + agent JSON 状态文件）。
// 把「高质量但需启发式解析」升级为「机器可直接消费」，防止 AI 读写时格式漂移。
{
  const SCHEMA_DIR = join(COMMON_DIR, 'engine', 'schemas')
  const schemas = {
    frontmatter: { file: 'project-frontmatter.schema.json', data: null },
    gateResults: { file: 'gate-results.schema.json', data: null },
    ruleWaivers: { file: 'rule-waivers.schema.json', data: null },
    larkSources: { file: 'lark-sources.schema.json', data: null },
    projectManifest: { file: 'project-manifest.schema.json', data: null },
    prdSourceManifest: { file: 'prd-source-manifest.schema.json', data: null },
    mswManifest: { file: 'msw-manifest.schema.json', data: null },
    assumptions: { file: 'assumptions.schema.json', data: null },
    fastTrack: { file: 'fast-track.schema.json', data: null },
    stageStatus: { file: 'stage-status.schema.json', data: null },
    gateHistory: { file: 'gate-history.schema.json', data: null },
    blockers: { file: 'blockers.schema.json', data: null },
    codeReview: { file: 'code-review.schema.json', data: null },
    acceptanceResults: { file: 'acceptance-results.schema.json', data: null },
    deliveryStatus: { file: 'delivery-status.schema.json', data: null },
    runState: { file: 'run-state.schema.json', data: null },
    vnextWorkItem: { file: 'vnext-work-item.schema.json', data: null },
    vnextCoverageReview: { file: 'vnext-coverage-review.schema.json', data: null },
    vnextExitResult: { file: 'vnext-exit-result.schema.json', data: null },
    vnextReconcileResult: { file: 'vnext-reconcile-result.schema.json', data: null },
  }
  const schemaLoadErrors = []
  for (const [key, { file }] of Object.entries(schemas)) {
    const path = join(SCHEMA_DIR, file)
    if (!existsSync(path)) {
      schemaLoadErrors.push(`❌ schema 文件缺失：common/engine/schemas/${file}`)
      continue
    }
    try {
      schemas[key].data = JSON.parse(readFileSync(path, 'utf8'))
    } catch (error) {
      schemaLoadErrors.push(`❌ common/engine/schemas/${file} 不是合法 JSON：${error.message}`)
    }
  }
  if (schemaLoadErrors.length) {
    errors.push(...schemaLoadErrors)
  } else {
    const projectNames = readdirSync(PRDS_DIR, { withFileTypes: true })
      .filter((entry) => isRealProjectDir(entry, /^(?:PR|TR)-/))
      .map((entry) => entry.name)
    const schemaErrors = []
    for (const name of projectNames) {
      const projectDir = join(PRDS_DIR, name)
      const compatibility = artifactCompatibilitySchemaDiagnostic({ projectDir, projectId: name })
      const skipExitResultSchema = compatibility.skipExitResultSchema
      if (compatibility.problem) schemaErrors.push(compatibility.problem)
      const readmePath = join(projectDir, 'README.md')
      if (existsSync(readmePath)) {
        const fm = parseFrontmatter(readFileSync(readmePath, 'utf8'))
        if (fm === null) {
          schemaErrors.push(`❌ ${name}/README.md 缺少 YAML frontmatter`)
        } else {
          schemaErrors.push(...validateSchema(fm, schemas.frontmatter.data, `${name}/README.md frontmatter`).map((msg) => `❌ ${msg}`))
        }
      }
      for (const [fileName, schemaKey, location = 'agent'] of [
        ['gate-results.json', 'gateResults'],
        ['rule-waivers.json', 'ruleWaivers'],
        ['lark-sources.json', 'larkSources'],
        ['project-manifest.json', 'projectManifest'],
        ['prd-source-manifest.json', 'prdSourceManifest'],
        ['msw-manifest.json', 'mswManifest'],
        ['assumptions.json', 'assumptions'],
        ['fast-track.json', 'fastTrack'],
        ['stage-status.json', 'stageStatus'],
        ['gate-history.json', 'gateHistory'],
        ['blockers.json', 'blockers'],
        ['code-review.json', 'codeReview'],
        ['acceptance-results.json', 'acceptanceResults'],
        ['delivery-status.json', 'deliveryStatus'],
        ['run-state.json', 'runState'],
        ['work-item.json', 'vnextWorkItem', 'root'],
        ['coverage-review.json', 'vnextCoverageReview', 'root'],
        ['latest-result.json', 'vnextExitResult', 'root'],
        ['reconcile-result.json', 'vnextReconcileResult', 'root'],
      ]) {
        const file = join(projectDir, location === 'root' ? '' : 'agent', fileName)
        if (!existsSync(file)) continue
        if (schemaKey === 'vnextExitResult' && skipExitResultSchema) continue
        try {
          const data = JSON.parse(readFileSync(file, 'utf8'))
          const format = location === 'root' ? fileName : `agent/${fileName}`
          const schemaPath = `${name}/${format}`
          schemaErrors.push(...validateSchema(data, schemas[schemaKey].data, schemaPath).map((msg) => `❌ ${msg}`))
        } catch (error) {
          schemaErrors.push(`❌ ${name}/${location === 'root' ? fileName : `agent/${fileName}`} JSON 解析失败：${error.message}`)
        }
      }
    }
    if (schemaErrors.length) {
      errors.push(...schemaErrors)
    } else {
      console.log(`✅ 项目元数据 schema：${projectNames.length} 个项目的 frontmatter 与 agent JSON 状态文件均通过 schema 校验。`)
    }
  }
}

if (errors.length) {
  console.error(`\n常驻预算 / 路由覆盖校验未通过：\n${errors.join('\n')}`)
  process.exit(1)
}
console.log('✅ 校验通过：常驻集、路由/README 覆盖、索引、rule ID 台账、模板/引用、核心脚本/自测、脚本引用、本地链接/跨文件锚点策略、阶段真值同步、项目元数据 schema 均有效。')
