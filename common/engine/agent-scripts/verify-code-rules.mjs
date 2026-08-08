#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { resolveProjectRoot, resolveRoots } from './lib/roots.mjs'

const scriptPath = fileURLToPath(import.meta.url)
const { docsSystemRoot: docsRoot, consumerRoot: repoRoot, config } = resolveRoots()
const worktreeRoot = (() => {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: process.cwd(), stdio: 'pipe', encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : repoRoot
})()
const args = process.argv.slice(2)

function readOption(name, fallback = '') {
  const index = args.indexOf(name)
  return index === -1 ? fallback : (args[index + 1] ?? fallback)
}

function hasFlag(name) {
  return args.includes(name)
}

const baseRef = readOption('--base', config.baseRef || 'origin/online')
// base ref 可解析性：origin/online 未 fetch 时 base…HEAD diff 静默为空，且无法证明某文件是「本次新建」。
// 用于 CODE-FILE-001：base 不可解析时不把存量超限 .tsx 误判成新引入 error（见 classifyFileSize 调用点）。
const baseResolvable = spawnSync('git', ['rev-parse', '--verify', '--quiet', `${baseRef}^{commit}`], { cwd: worktreeRoot, stdio: 'pipe', encoding: 'utf8' }).status === 0
const json = hasFlag('--json')
const explicitFiles = readOption('--files')
const projectId = readOption('--project')
const waiversPath = readOption('--waivers', projectId ? `${config.docsMountPath}/${projectId}/agent/rule-waivers.json` : '')
const globalScan = hasFlag('--global-scan') || (!hasFlag('--no-global-scan') && !explicitFiles)

function printHelp() {
  console.log(`usage: verify-code-rules.mjs [--project <PR-ID>] [--files <comma-list>] [--base <ref>] [--waivers <path>] [--global-scan] [--no-global-scan] [--json] [--self-test] [--help]

Static code rule scan for changed files. G5+ gate companion.

Options:
  --help            Show this help message and exit
  --project         Project ID to read visualFidelity/waivers from
  --files           Comma-separated list of files to scan (skips git diff)
  --base            Base ref for diff (default: origin/online)
  --waivers         Path to rule-waivers.json
  --global-scan     Include repo-wide env/mock leak scans
  --no-global-scan  Skip repo-wide scans
  --json            Output JSON result to stdout
  --self-test       Run inline self-test`)
}

if (args.includes('--help')) {
  printHelp()
  process.exit(0)
}

function readProjectText(pathFromProject) {
  if (!projectId) return ''
  const file = join(resolveProjectRoot(projectId), pathFromProject)
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

const projectVisualFidelityHigh = /\|\s*visualFidelity\s*\|\s*`?high`?\s*\||visualFidelity\s*:\s*high/i.test([
  readProjectText('README.md'),
  readProjectText('product/00-feature-inventory.md'),
].join('\n'))
const moduleImportAliases = Array.isArray(config.moduleImportAliases) ? config.moduleImportAliases.filter(Boolean) : ['@fameex/ui']

function runGit(gitArgs, { allowFailure = true } = {}) {
  const result = spawnSync('git', gitArgs, {
    cwd: worktreeRoot,
    stdio: 'pipe',
    encoding: 'utf8',
  })
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`git ${gitArgs.join(' ')} failed: ${result.stderr.trim()}`)
  }
  return result.status === 0 ? result.stdout.trim() : ''
}

function splitLines(value) {
  return value ? value.split('\n').map((line) => line.trim()).filter(Boolean) : []
}

function normalizeFile(value) {
  const absolute = resolve(worktreeRoot, value)
  const rel = relative(worktreeRoot, absolute)
  if (rel.startsWith('..')) return ''
  return rel
}

function collectChangedFiles() {
  if (explicitFiles) {
    return explicitFiles
      .split(',')
      .map((file) => normalizeFile(file.trim()))
      .filter(Boolean)
      .filter((file) => existsSync(resolve(worktreeRoot, file)))
  }

  const files = new Set()
  // base ref 不可解析（如 origin/online 未 fetch）时，base…HEAD diff 会静默为空 → 只剩本地改动，
  // 静默漏扫已合并到分支但未 push 的改动。显式告警到 stderr（不污染 --json stdout、不改退出码）。
  if (!baseResolvable) {
    console.error(`WARN: base ref \`${baseRef}\` 不可解析（未 fetch？）；仅扫本地 unstaged/staged/untracked 改动，base…HEAD diff 已跳过。运行 \`git fetch origin\` 或用 --base <ref> 指定可解析基线。`)
  }
  for (const file of splitLines(runGit(['diff', '--name-only', '--diff-filter=ACMR', `${baseRef}...HEAD`]))) files.add(file)
  for (const file of splitLines(runGit(['diff', '--name-only', '--diff-filter=ACMR']))) files.add(file)
  for (const file of splitLines(runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMR']))) files.add(file)
  for (const file of splitLines(runGit(['ls-files', '--others', '--exclude-standard']))) files.add(file)

  return [...files].filter((file) => existsSync(resolve(worktreeRoot, file)))
}

function isSourceFile(file) {
  return /\.(js|jsx|ts|tsx)$/.test(file)
}

// mapper（反腐层）文件：basename 形如 mapXxx.ts 或路径含 mapper。
function isMapperFile(file) {
  return /(^|\/)map[A-Za-z0-9]*\.ts$/.test(file) || /mapper/i.test(file)
}

// 属性访问但非字段映射（数组/字符串方法等），改名检查跳过，避免误报。
const RENAME_SAFE_PROPS = new Set([
  'length', 'map', 'filter', 'find', 'findIndex', 'includes', 'slice', 'sort', 'push', 'join', 'some',
  'every', 'reduce', 'trim', 'split', 'parse', 'toString', 'concat', 'flat', 'flatMap', 'keys', 'values', 'entries', 'at',
])

// CODE-MOCK-003 目标：展示层（apps/web/src/apps/**）与 mapper 文件。真实接口后禁假默认兜底。
function isDisplayLayerFile(file) {
  return /^apps\/web\/src\/apps\/.+\.(ts|tsx)$/.test(file) || isMapperFile(file)
}

function isApiServiceFile(file) {
  return /^apps\/web\/src\/services\/api\/.+\.(ts|tsx)$/.test(file)
}

function isFeatureComponentFile(file) {
  return /^apps\/web\/src\/apps\/.+\.tsx$/.test(file) && !isTestOrFixtureFile(file)
}

function collectModuleImports(content) {
  const imports = []
  const importRe = /(?:\b(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?|\brequire\s*\(|\bimport\s*\()(['"])([^'"]+)\1/g
  let match
  while ((match = importRe.exec(content)) !== null) {
    imports.push({
      line: content.slice(0, match.index).split('\n').length,
      source: match[2],
    })
  }
  return imports
}

function isLowLevelHttpImport(source) {
  return /^(?:axios|ky)$|(?:^|\/)(?:httpClient|requestClient)(?:$|\/)|(?:^|\/)services\/(?:request|http)(?:$|\/)/i.test(source)
}

function isSchemaOrDtoImport(source) {
  return /(?:^|\/)(?:schemas?|dto)(?:$|[/._-])|(?:Schema|Dto)(?:$|[/._-])/i.test(source)
}

function isUiImport(source) {
  return /(?:^|\/)components?(?:$|\/)|^@\/apps\//i.test(source)
    || moduleImportAliases.some((alias) => source === alias || source.startsWith(`${alias}/`))
}

function isMswFixtureImport(source) {
  return /(?:^|\/)(?:mocks?\/handlers|__fixtures__|fixtures?\/)|\.fixture(?:$|[./_-])/i.test(source)
}

// CODE-ARCH-003（warn-first）：changed-file 结构候选，只拦高置信 import 方向。
// 正则无法证明完整依赖图，命中项必须在 G6 Review 结合真实模块职责裁决。
function scanArchitectureImports(file, content, findings) {
  if (!isSourceFile(file) || isTestOrFixtureFile(file) || isMockFile(file)) return
  for (const { line, source } of collectModuleImports(content)) {
    if (isMapperFile(file) && (
      /^(?:react|react-dom|@tanstack\/react-query|zustand)(?:$|\/)/.test(source)
      || /(?:^|\/)(?:stores?|components?)(?:$|\/)/i.test(source)
      || isApiServiceFile(source)
      || /(?:^|\/)services\/api(?:$|\/)/i.test(source)
      || isLowLevelHttpImport(source)
    )) {
      addFinding(findings, 'CODE-ARCH-003', file, line, `Mapper import \`${source}\`，疑似反向依赖 API/React Query/store/UI；Mapper 应只依赖类型与纯 formatter/calc/resolver，并保持 DTO → UI Model 纯转换。`, 'warn')
      continue
    }
    if (isApiServiceFile(file) && isUiImport(source)) {
      addFinding(findings, 'CODE-ARCH-003', file, line, `API Service import UI/Feature 模块 \`${source}\`；请求层不得反向依赖组件，移动共享类型/常量到中立领域模块。`, 'warn')
      continue
    }
    if (isFeatureComponentFile(file) && (isSchemaOrDtoImport(source) || isLowLevelHttpImport(source) || /(?:^|\/)services\/api(?:$|\/)/i.test(source))) {
      addFinding(findings, 'CODE-ARCH-003', file, line, `Component import 低层契约/HTTP 模块 \`${source}\`；组件应消费 Hook Result/UI Model，请把 schema/DTO 校验与请求留在 service/query/mapper 链。`, 'warn')
      continue
    }
    if ((isFeatureComponentFile(file) || isApiServiceFile(file)) && isMswFixtureImport(source)) {
      addFinding(findings, 'CODE-ARCH-003', file, line, `生产 UI/API Service import MSW handler/fixture \`${source}\`；mock 数据只能停留在测试或 MSW 网络边界，不能进入真实业务链。`, 'warn')
    }
  }
}

// 允许的兜底字面量：空串（交 UI 决定）、-- / - 占位、纯标点/空白。非这些的字符串兜底 = 可疑假默认。
function isAllowedFallbackLiteral(literal) {
  const inner = literal.slice(1, -1)
  return inner === '' || inner === '--' || inner === '-' || /^[\s\p{P}]+$/u.test(inner)
}

const PRESET_ARBITRARY_CLASS_RE = /\b(?:w|h|min-w|min-h|max-w|max-h|size|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|rounded|rounded-[trbl]{1,2})-\[(\d+(?:\.\d+)?)px\]/g
const PRESET_ARBITRARY_ALLOWED_CONTEXT_RE = /calc\(|var\(|min\(|max\(|clamp\(|visualFidelity:\s*high|high fidelity|高保真|\/\/\s*(?:API:|style-exception|tailwind-exception)/i

function findPresetArbitraryClasses(text) {
  if (PRESET_ARBITRARY_ALLOWED_CONTEXT_RE.test(text)) return []
  PRESET_ARBITRARY_CLASS_RE.lastIndex = 0
  const hits = []
  let match
  while ((match = PRESET_ARBITRARY_CLASS_RE.exec(text)) !== null) {
    const token = match[0]
    // Fractions and odd pixel values may be deliberate visual-fidelity choices; common preset
    // multiples should be checked first because tailwind-preset.js already defines them.
    const px = Number(match[1])
    if (!Number.isFinite(px)) continue
    if (px % 2 !== 0 && !['1'].includes(match[1])) continue
    hits.push(token)
  }
  return hits
}

// CODE-COPY-001（warn）：apps 下 .tsx 新增行硬编码中文展示文案（非 t() / 非注释 / 非日志）。
// 固定文案须走 i18n + `03-api-contract.md §7 文案契约表`，并配「值===来源原文」字面断言（§7 强制项）。
// 直接写进 JSX/props 既绕过契约表、又给后续意译留口子（PR-02022 根因：有表仍意译，结构断言拦不住）。
// 只是「文案按原文不想当然」的一个实例，warn-first：存量多，先提示不阻断。
const COPY_EXCEPTION_RE = /\/\/\s*copy-exception/
// 剥掉整个 t(...) 调用（含所有实参与嵌套括号），而非只剥到第一个字符串。否则 `t('key', '中文默认')`
// 的默认值实参会残留 CJK 触发 CODE-COPY-001 误报——那恰是合法 i18n 形态（key + defaultValue）。
function stripTCalls(code) {
  let out = ''
  for (let i = 0; i < code.length; i += 1) {
    const isBoundary = i === 0 || !/[A-Za-z0-9_$]/.test(code[i - 1])
    if (code[i] === 't' && isBoundary && /^\s*\(/.test(code.slice(i + 1, i + 3))) {
      let j = i + 1
      while (j < code.length && code[j] !== '(') j += 1
      let depth = 0
      let k = j
      for (; k < code.length; k += 1) {
        if (code[k] === '(') depth += 1
        else if (code[k] === ')') { depth -= 1; if (depth === 0) { k += 1; break } }
      }
      if (depth === 0) { i = k - 1; continue } // 跳过整个已闭合的 t(...)
    }
    out += code[i]
  }
  return out
}

function hasHardcodedDisplayCJK(text) {
  if (COPY_EXCEPTION_RE.test(text)) return false
  const code = stripCommentsOnly(text) // 保留字符串（文案常在字符串/JSX 文本里），只剥注释
  if (/\b(?:console|logger|log)\s*\.|throw\b|new\s+Error\s*\(/.test(code)) return false // 日志/异常非展示文案
  const withoutT = stripTCalls(code) // 去掉整个 t(...) 调用（含 key 与 defaultValue 实参）
  return /[一-鿿]/.test(withoutT)
}

function isLikelyStaticBranchStart(text) {
  const stripped = stripCommentsAndStrings(text)
  if (!/\bif\s*\(/.test(stripped)) return false
  if (/typeof\s+window|process\.env|import\.meta|try\s*\{|catch\s*\(/.test(stripped)) return false
  return true
}

function hasElseIf(text) {
  return /\belse\s+if\s*\(/.test(stripCommentsAndStrings(text))
}

function isTextRuleTarget(file) {
  return /\.(js|jsx|ts|tsx|json|md|scss|less)$/.test(file)
}

// CODE-MOCK-004（error）：env 里残留 mock 开关 = 拆除未完成。按 §8.0 第 5 条 flag 该删不该留
// （设 false 也不行——防静默重启用）。全量扫 env（非 diff），残留是存量问题，任何一次 gate 运行都该抓到。
const ENV_GLOBS = [
  'apps/web/config/environments/.env.dev',
  'apps/web/config/environments/.env.test',
  'apps/web/config/environments/.env.pre',
  'apps/web/config/environments/.env.prod',
]
function scanEnvMockFlags(findings) {
  const flagRe = /^\s*(?:#\s*)?(NEXT_PUBLIC_\w*USE_MOCK)\s*=/
  for (const file of ENV_GLOBS) {
    const absolute = resolve(worktreeRoot, file)
    if (!existsSync(absolute)) continue
    const lines = readFileSync(absolute, 'utf8').split('\n')
    lines.forEach((text, index) => {
      const match = flagRe.exec(text)
      if (!match) return
      addFinding(findings, 'CODE-MOCK-004', file, index + 1, `env 残留 mock 开关 \`${match[1]}\`；按 §8.0 第 5 条 mock 拆除时该删掉 flag（设 false 也不行，防静默重启用）。删除此行，并确认代码里读该 flag 的分支与 mock 脚手架已一并清除。`)
    })
  }
}

// mock 脚手架文件约定：路径含 /mock(s)/ 或 /__mock(s)__/（含 MSW 的 src/mocks/handlers 复数目录），
// 或 basename 形如 xxx.mock.ts / xxx.fixture.ts / mockApi.ts / mockXxx.ts。
function isMockFile(file) {
  return /(^|\/)(mocks?|__mocks?__)\//i.test(file) || /(^|\/)mock[A-Z]\w*\.tsx?$/.test(file) || /\.(mock|fixture)\.tsx?$/.test(file)
}
function isTestOrFixtureFile(file) {
  return /\.(test|spec)\.tsx?$/.test(file) || /__fixtures__\//.test(file) || /\.(test|spec)-/.test(file)
}

// 纯数据文件（常量/i18n/locale/fixture/生成代码）：不算组件，不受 300 行上限约束（见 development-rules.md §「组件行数」）。
function isDataFile(file) {
  return /(^|\/)(constants?|i18n|locales?|fixtures?|generated|__generated__)(\/|\.|$)/i.test(file) || /\.(gen|generated)\.tsx?$/.test(file)
}

// 颜色 token 定义文件：合法定义 hex（主题/调色板/tailwind 配置），不应被 CODE-STYLE-002 硬编码色规则误伤。
function isColorTokenDefFile(file) {
  return /tailwind\.config\.[cm]?[jt]s$/.test(file) || /(^|\/)(theme|tokens?|palette|colors?)(\/|\.)/i.test(file) || /\/(theme|tokens?)\//i.test(file)
}

// 剥掉行内注释与字符串/模板字面量，避免注释、字符串里的关键字触发内容规则（如 `// returns any`、`// see #1234`）。
// 逐行粒度：JSDoc/块注释续行（以 * 开头或含未闭合 /* ）也整行剥掉。
function stripCommentsAndStrings(text) {
  if (/^\s*\*/.test(text)) return '' // JSDoc / 块注释续行
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '') // 单行内的块注释
    .replace(/\/\/.*$/g, '') // 行注释
    .replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '') // 字符串 / 模板字面量
}

// 只剥注释、保留字符串：用于颜色规则（硬编码色常写成字符串字面量 '#fff'，不能连字符串一起剥）。
function stripCommentsOnly(text) {
  if (/^\s*\*/.test(text)) return ''
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/g, '')
}

// CODE-MOCK-005（error）：mock 脚手架被非测试生产代码 import = mock 泄漏进生产路径。
// 不依赖人打 `@mock-only`（PR-01685 证明标记为 0 时 grep gate 形同虚设）；改用「谁 import 了 mock」结构信号。
// 全量扫（存量泄漏不能靠碰到才查），用 git grep 一次性找所有 mock import，再排除 mock 文件内部互引与测试。
function scanMockLeaks(findings) {
  const grep = runGit(['grep', '-nE', "from ['\"][^'\"]*(mock|__mock__)[^'\"]*['\"]", '--', 'apps/web/src', 'packages'])
  if (!grep) return
  for (const row of grep.split('\n')) {
    const m = /^([^:]+):(\d+):(.*)$/.exec(row)
    if (!m) continue
    const [, file, lineStr, text] = m
    if (isMockFile(file) || isTestOrFixtureFile(file)) continue // mock 内部互引、测试引 mock 合法
    // 提取被引路径，确认它确实指向 mock 模块（避免 from './formock-helper' 之类误伤）。
    // 复数 mocks/ 覆盖 MSW 的 src/mocks/handlers 目录（PR 评审发现单数正则漏 MSW 泄漏）。
    const importPath = /from\s+['"]([^'"]+)['"]/.exec(text)?.[1] ?? ''
    if (!/(^|\/)(mocks?|__mocks?__)\//i.test(importPath) && !/(^|\/)mock[A-Z]\w*$/.test(importPath) && !/\.mock$/.test(importPath) && !/mockapi$/i.test(importPath)) continue
    addFinding(findings, 'CODE-MOCK-005', file, Number(lineStr), `非测试生产代码 import mock 脚手架（\`${importPath}\`）：mock 已泄漏进生产路径。真实接口就绪应删此 import 与对应 mock 分支（§8.0 单一接缝 / §8.3）；未就绪则把 mock 收进 service 层单一 \`if (USE_MOCK)\` 接缝，不在此文件直接引 mock。`)
  }
}

// CODE-MOCK-006（warn）：复用环境名（NEXT_PUBLIC_ENV_NAME === 'dev' / 'pre' …）当 mock 开关。
// PR-01988 admin 菜单踩过：mock 合并/fallback 挂在运行时 `ENV_NAME==='dev'` 函数上，既非专用 flag
// （CODE-MOCK-004 只认 *USE_MOCK 命名 → 漏），又是运行时函数边界挡 DCE（§8.3 禁），于是 mock 分支随
// 需求进 online 成技术债。全量 git grep（存量残留任何一次运行都该抓），命中「ENV_NAME 环境判断」且
// 同处（同行或紧邻上一行）出现 mock/fallback 语义时告警。warn-first：admin 存量多，先提示不阻断。
const ENV_NAME_SWITCH_RE = /process\.env\.NEXT_PUBLIC_ENV_NAME\s*(?:===|!==|==|!=)\s*['"](?:dev|pre|test|prod)['"]/
const MOCK_CONTEXT_RE = /mock|fallback/i
function scanEnvNameMockSwitch(findings) {
  const grep = runGit(['grep', '-nE', "process\\.env\\.NEXT_PUBLIC_ENV_NAME", '--', 'apps/web/src', 'apps/admin/src', 'packages'])
  if (!grep) return
  // 先按 file:line:text 收集所有命中行，供「邻行也算上下文」判断。
  const rows = []
  for (const row of grep.split('\n')) {
    const m = /^([^:]+):(\d+):(.*)$/.exec(row)
    if (!m) continue
    rows.push({ file: m[1], line: Number(m[2]), text: m[3] })
  }
  for (const { file, line, text } of rows) {
    if (isMockFile(file) || isTestOrFixtureFile(file)) continue
    if (!ENV_NAME_SWITCH_RE.test(stripCommentsOnly(text))) continue
    // 上下文窗口：本行 + 紧邻上一行（`if (shouldUseMock())` 常把关键词写在被调用处的定义行）。
    const prev = rows.find((r) => r.file === file && r.line === line - 1)?.text ?? ''
    if (!MOCK_CONTEXT_RE.test(text) && !MOCK_CONTEXT_RE.test(prev)) continue
    addFinding(findings, 'CODE-MOCK-006', file, line, `复用 \`NEXT_PUBLIC_ENV_NAME\` 环境判断当 mock 开关：既非专用 \`NEXT_PUBLIC_<FEATURE>_USE_MOCK\` flag（CODE-MOCK-004 扫不到），又是运行时判断挡 DCE（§8.3 禁）。改用编译期 \`process.env.NEXT_PUBLIC_<FEATURE>_USE_MOCK === 'true'\` 显式比较，真实接口就绪时连 flag 带 mock 分支一并删除（§8.0 零残留）。`, 'warn')
  }
}

function diffAddedLines(file) {
  const outputs = []
  const isTracked = runGit(['ls-files', '--error-unmatch', file])
  if (!isTracked) {
    return readFileSync(resolve(worktreeRoot, file), 'utf8')
      .split('\n')
      .map((text, index) => ({ line: index + 1, text }))
  }

  outputs.push(runGit(['diff', '--unified=0', '--no-ext-diff', `${baseRef}...HEAD`, '--', file]))
  outputs.push(runGit(['diff', '--unified=0', '--no-ext-diff', '--', file]))
  outputs.push(runGit(['diff', '--cached', '--unified=0', '--no-ext-diff', '--', file]))

  const added = []
  for (const output of outputs.filter(Boolean)) {
    let newLine = 0
    for (const line of output.split('\n')) {
      const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
      if (hunk) {
        newLine = Number(hunk[1])
        continue
      }
      if (line.startsWith('+++') || line.startsWith('---')) continue
      if (line.startsWith('+')) {
        added.push({ line: newLine || 1, text: line.slice(1) })
        newLine += 1
      } else if (!line.startsWith('-') && newLine) {
        newLine += 1
      }
    }
  }
  return added
}

function addFinding(findings, ruleId, file, line, message, severity = 'error') {
  findings.push({ severity, ruleId, file, line, message })
}

function collectMapperFallbackSources(added) {
  const sources = new Map()
  const sourceRe = /(?:\?\?|\|\|)\s*([a-z_$][\w$]*)\??\.(\w+)\b/gi
  for (const { line, text } of added) {
    const outMatch = /^\s*(\w+):/.exec(text)
    if (!outMatch || /\/\/\s*API:/.test(text) || /@mock-only/.test(text)) continue
    const outKey = outMatch[1]
    sourceRe.lastIndex = 0
    let sourceMatch
    while ((sourceMatch = sourceRe.exec(text)) !== null) {
      const sourceKey = `${sourceMatch[1]}.${sourceMatch[2]}`
      const entries = sources.get(sourceKey) || []
      if (!entries.some((entry) => entry.outKey === outKey)) entries.push({ outKey, line })
      sources.set(sourceKey, entries)
    }
  }
  return [...sources.entries()].filter(([, entries]) => new Set(entries.map((entry) => entry.outKey)).size >= 2)
}

const MAPPER_RENAME_REASON_RE = /\/\/\s*(?:API-RENAME:\s*cross-source\b|API-DERIVED:\s*sources\s*=)/

function hasMapperRenameReason(text, previousText = '') {
  return MAPPER_RENAME_REASON_RE.test(text) || MAPPER_RENAME_REASON_RE.test(previousText)
}

function scanMapperAddedLines(file, added, findings) {
  if (!isMapperFile(file)) return
  for (let i = 0; i < added.length; i += 1) {
    const { line, text } = added[i]
    const match = /^\s*(\w+):\s*([a-z_$][\w$]*)\??\.(\w+)\b/.exec(text)
    if (!match) continue
    const [full, outKey, , prop] = match
    if (outKey === prop || RENAME_SAFE_PROPS.has(prop)) continue
    if (/^\s*\(/.test(text.slice(match.index + full.length))) continue // 方法调用，非字段取值
    const prevText = i > 0 ? added[i - 1].text : ''
    if (hasMapperRenameReason(text, prevText)) continue
    addFinding(
      findings,
      'CODE-NAMING-001',
      file,
      line,
      `mapper 输出字段 \`${outKey}\` 与契约字段 \`${prop}\` 不同名；单一来源应保持 API 同名。仅跨来源统一或多字段派生可改名，并分别写 // API-RENAME: cross-source source=<fields> 或 // API-DERIVED: sources=<fields>。普通 // API: 不豁免。`,
      'warn',
    )
  }

  for (const [sourceKey, entries] of collectMapperFallbackSources(added)) {
    const uniqueKeys = [...new Set(entries.map((entry) => entry.outKey))]
    addFinding(
      findings,
      'CODE-MAPPER-001',
      file,
      entries[0].line,
      `mapper 中多个语义字段（${uniqueKeys.map((key) => `\`${key}\``).join(', ')}）兜底到同一契约字段 \`${sourceKey}\`；这通常是 mock 臆造字段或契约缺口。请删除/合并字段，或补 API 契约后再映射。`,
    )
  }
}

function hasExportedQueryKeyFactory(content) {
  return /export\s+const\s+\w*QueryKey\w*\s*=/.test(content)
}

function addedUseQueryHasExplicitKey(added, startIndex) {
  for (let index = startIndex; index < added.length; index += 1) {
    const text = added[index].text
    if (index > startIndex && /\buse(?:Infinite)?Query\s*\(/.test(text)) return false
    if (/\bqueryKey\s*:/.test(text)) return true
  }
  return false
}

function scanQueryAddedLines(file, added, findings, content = added.map(({ text }) => text).join('\n')) {
  if (!isApiServiceFile(file)) return
  for (let index = 0; index < added.length; index += 1) {
    const { line, text } = added[index]
    if (!/\buse(?:Infinite)?Query\s*\(/.test(text)) continue
    if (hasExportedQueryKeyFactory(content) && addedUseQueryHasExplicitKey(added, index)) continue
    addFinding(
      findings,
      'CODE-QUERY-001',
      file,
      line,
      '新增 useQuery 时请导出稳定 queryKey 工厂，并在 useQuery options 中显式传 queryKey，避免 SSR/客户端 key 漂移或重复请求。',
      'warn',
    )
  }
  for (const { line, text } of added) {
    if (!/transfer\s*:\s*\(?\s*(?:data|d)\s*\)?\s*=>\s*(?:data|d)\b|transfer\s*:\s*\(?\s*data\s*\)?\s*=>\s*data\s+as\b/.test(text)) continue
    addFinding(
      findings,
      'CODE-QUERY-002',
      file,
      line,
      '新增 API transfer 直接返回 data / data as T；请优先接 schema.parse/toCamel/zCamel 或显式 narrow，避免 raw DTO 未收窄进入 UI。',
      'warn',
    )
  }
}

function readBaseFile(file) {
  const result = spawnSync('git', ['show', `${baseRef}:${file}`], { cwd: worktreeRoot, stdio: 'pipe', encoding: 'utf8' })
  return result.status === 0 ? result.stdout : ''
}

function classifyFileSize(currentLines, baseLines) {
  if (currentLines <= 300) return { report: false, severity: 'error' }
  if (baseLines > 300) return { report: true, severity: 'warn' }
  return { report: true, severity: 'error' }
}

function countLines(content) {
  if (!content) return 0
  const lines = content.split(/\r?\n/).length
  return /\r?\n$/.test(content) ? lines - 1 : lines
}

// 逐行 diff 规则（CODE-TYPE-001/002、ARCH-001、STYLE-002/003、ARCH-002、E2E-001、DOC-REUSE-001）。
// 纯函数：同 (file, line, text) 恒产出同 findings，不碰 git/disk。抽出以便 --self-test 用 +/- 锚点用例
// 逐条守正则漂移（历史假阳性根因）。visualFidelityHigh 默认取项目级判定，self-test 可覆盖以测两态。
function scanAddedLine(file, line, text, findings, { visualFidelityHigh = projectVisualFidelityHigh } = {}) {
  // CODE-TYPE-001：禁裸 `any` 类型注解。放行 `.any(`（`z.any()`/`expect.any()` 是方法调用非类型洞），
  // 且不扫测试/fixture 文件（mock 转型常需 any，且本规则是 error 级，误伤会直接卡 gate）。
  if (/\.(ts|tsx)$/.test(file) && !isTestOrFixtureFile(file) && /(?<!\.)\bany\b/.test(stripCommentsAndStrings(text))) {
    addFinding(findings, 'CODE-TYPE-001', file, line, 'Added line contains `any`; use a named type or a narrower unknown-safe type.')
  }
  if (/\.tsx$/.test(file) && /\bfetch\s*\(/.test(text)) {
    addFinding(findings, 'CODE-ARCH-001', file, line, 'Added component line calls fetch directly; move request logic to service/query layer.')
  }
  // CODE-TYPE-002：禁 `schema.parse(x) as T`（含 safeParse）。.parse() 静默剥离 schema 未声明字段
  // + as 蒙蔽 type = 字段全程消失且编译无报错（PR-01685 rewardDescription 根因，api-and-mapper.md §1）。
  // 放行 `as const`（不蒙蔽字段结构）与 `JSON.parse`（全量返回不剥字段，非本规则靶子）。
  // 修法：删 as 让 type 从 schema 推导（z.infer），或补齐 schema 字段。
  if (/(?<!JSON)\.(?:safeParse|parse)\s*\(.*\)\s+as\s+(?!const\b)/.test(text)) {
    addFinding(findings, 'CODE-TYPE-002', file, line, '`schema.parse(x) as T` 组合：.parse() 会静默剥离 schema 未声明字段、as 又蒙蔽 type，字段将全程消失且编译无报错（PR-01685 根因，§3）。删 as 让 type 从 schema 推导（z.infer），或补齐 schema 字段。')
  }
  // CODE-STYLE-002：拦字面色（hex / 数字 rgb()）。放行 `rgb(var(--token))`——这是 Tailwind
  // 引用 CSS 变量的语义 token 写法（全库 45+ 处约定），恰是本规则推荐形态，不应误伤。
  if (isSourceFile(file) && !isColorTokenDefFile(file) && !isTestOrFixtureFile(file) && /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(\s*(?!var\()/.test(stripCommentsOnly(text))) {
    addFinding(findings, 'CODE-STYLE-002', file, line, 'Added line appears to hard-code color; use semantic token or existing Tailwind preset class.')
  }
  if (/\.(js|jsx|ts|tsx)$/.test(file)) {
    const arbitraryHits = visualFidelityHigh ? [] : findPresetArbitraryClasses(stripCommentsOnly(text))
    if (arbitraryHits.length) {
      addFinding(
        findings,
        'CODE-STYLE-003',
        file,
        line,
        `新增 Tailwind arbitrary class ${arbitraryHits.map((hit) => `\`${hit}\``).join(', ')}；先查 packages/config/tailwind-preset.js，能用 preset spacing/radius 平替或相近值时不要写硬编码数值。高保真/公式例外请加 // tailwind-exception 说明。`,
        'warn',
      )
    }
  }
  if (/\.(ts|tsx)$/.test(file) && hasElseIf(text)) {
    addFinding(
      findings,
      'CODE-ARCH-002',
      file,
      line,
      '新增 `else if` 分支；若是在做静态状态/文案/样式映射，请改用 `Record`/常量表/resolver 查表，避免 JSX 或 handler 里堆多层 if。确属边界流程控制可忽略此 warn。',
      'warn',
    )
  }
  if (/package\.json$/.test(file) && /"(playwright|playwright-core|puppeteer)"/.test(text)) {
    addFinding(findings, 'CODE-E2E-001', file, line, 'Do not add Playwright/Puppeteer dependencies to the monorepo; use MCP/system Chrome workflow.')
  }
  if (/\.md$/.test(file) && /跳过复用/.test(text)) {
    addFinding(findings, 'DOC-REUSE-001', file, line, 'Project docs must not declare skipped reuse; record checked candidates and non-reuse reason instead.')
  }
  if (/^apps\/web\/src\/apps\/.+\.tsx$/.test(file) && hasHardcodedDisplayCJK(text)) {
    addFinding(
      findings,
      'CODE-COPY-001',
      file,
      line,
      '新增行含硬编码中文展示文案；固定文案须走 i18n `t(\'ns:key\')` + `03-api-contract.md §7` 文案契约表，并配「值===来源原文」字面断言测试（§7 强制项,PR-02022 意译根因）。确属非展示文本（如 aria/调试）请加 // copy-exception 说明。',
      'warn',
    )
  }
}

function scanFile(file, findings) {
  const absolute = resolve(worktreeRoot, file)
  const content = readFileSync(absolute, 'utf8')
  const added = isTextRuleTarget(file) ? diffAddedLines(file) : []

  if (/\.tsx$/.test(file) && !isTestOrFixtureFile(file) && !isDataFile(file)) {
    const lineCount = countLines(content)
    const baseContent = readBaseFile(file)
    const baseLineCount = countLines(baseContent)
    const sizeFinding = classifyFileSize(lineCount, baseLineCount)
    if (sizeFinding.report) {
      // base 不可解析时 baseLineCount 恒为 0，无法区分「新建超限」与「存量超限」；不误判成阻断 error。
      const severity = sizeFinding.severity === 'error' && !baseResolvable ? 'warn' : sizeFinding.severity
      const context = baseLineCount > 300
        ? `existing oversized .tsx file has ${lineCount} lines (base=${baseLineCount}, delta=${lineCount - baseLineCount}); extract the touched responsibility where practical, but do not attribute the full legacy file debt to this change.`
        : !baseResolvable
          ? `.tsx file has ${lineCount} lines; base ref \`${baseRef}\` 不可解析，无法确认是否本次新建，暂按 warn（fetch 基线后重跑以判定）。`
          : `.tsx file has ${lineCount} lines (base=${baseLineCount || 'new'}); new or newly oversized TSX files must stay within 300 lines.`
      addFinding(findings, 'CODE-FILE-001', file, 1, context, severity)
    }
  }

  if (/\.(scss|less)$/.test(file) && file.startsWith('apps/web/src/')) {
    addFinding(findings, 'CODE-STYLE-001', file, 1, 'Changed apps/web source adds or modifies .scss/.less; use Tailwind/token rules instead.')
  }

  for (const { line, text } of added) scanAddedLine(file, line, text, findings)

  if (/\.(ts|tsx)$/.test(file)) {
    const branchStarts = added.filter(({ text }) => isLikelyStaticBranchStart(text))
    if (branchStarts.length >= 3) {
      addFinding(
        findings,
        'CODE-ARCH-002',
        file,
        branchStarts[0].line,
        `本次新增 ${branchStarts.length} 个 if 分支；若这些分支在映射状态/文案/class/action，请收敛为 \`Record\`/resolver 查表。少量边界校验或流程控制可保留。`,
        'warn',
      )
    }
  }

  // CODE-NAMING-001（warn）：mapper 单一来源输出字段名应与契约同名。
  // 改名只接受 §3.1 的跨来源统一或多字段派生结构化理由；普通 `// API:` 不豁免。
  scanMapperAddedLines(file, added, findings)
  scanQueryAddedLines(file, added, findings, content)
  scanArchitectureImports(file, content, findings)

  // CODE-MOCK-003（warn）：真实接口后禁假默认兜底（architecture-and-state.md §8.2）。
  // 扫展示层/mapper 新增行里 `?? '文案'` / `|| '文案'`，字面量非 -- / 空串等占位即疑似假默认。
  if (isDisplayLayerFile(file)) {
    const fallbackRe = /(\?\?|\|\|)\s*(['"`])((?:\\.|(?!\2).)*)\2/g
    for (const { line, text } of added) {
      if (/@mock-only/.test(text)) continue // 已标记临时 mock，由 §8.0 拆除闸管
      if (/\/\/\s*API:/.test(text)) continue // 已注释说明的安全默认（§8.2 第 3 条）
      if (/\bt\s*\(|i18n|https?:\/\/|import\s|require\(/.test(text)) continue // i18n key / URL / import 非展示兜底
      if (/\b(lang|locale|language)\b/i.test(text)) continue // 语言/locale 路由默认，非接口数据兜底
      if (/\bkey\s*=/.test(text)) continue // React identity key，不是展示/API 字段默认值
      fallbackRe.lastIndex = 0
      let match
      while ((match = fallbackRe.exec(text)) !== null) {
        const literal = `${match[2]}${match[3]}${match[2]}`
        if (isAllowedFallbackLiteral(literal)) continue
        addFinding(
          findings,
          'CODE-MOCK-003',
          file,
          line,
          `疑似假默认兜底 \`${match[1]} ${literal}\`；真实接口后必填缺失应显示 '--'、可选缺失不渲染，不用假文案/常量兜底掩盖数据缺失（§8.2）。确属安全默认请加 // API: 或 // @mock-only 注释说明。`,
          'warn',
        )
      }
    }
  }
}

// --self-test：用内联 +/- 锚点用例逐条守规则正则，不碰 git/disk。每条规则至少一正一反，
// 覆盖历史假阳性形态（注释/字符串里的关键字、as const、JSON.parse、rgb(var())、奇数 px）。
// 纳入 check-doc-budget 的 SELF_TEST_SCRIPTS，规则正则回归即在 pre-commit/hook 处 fail。
function runSelfTest() {
  const failures = []
  let ruleCases = 0
  let predicateCases = 0
  const ids = (file, text, opts) => {
    const out = []
    scanAddedLine(file, 1, text, out, opts || {})
    return out.map((f) => f.ruleId).sort()
  }
  const fileRuleIds = (file, added, content) => {
    const out = []
    scanMapperAddedLines(file, added, out)
    scanQueryAddedLines(file, added, out, content)
    return out.map((f) => f.ruleId).sort()
  }
  const architectureRuleIds = (file, content) => {
    const out = []
    scanArchitectureImports(file, content, out)
    return out.map((f) => f.ruleId).sort()
  }
  const eq = (label, actual, expected) => {
    ruleCases += 1
    const a = JSON.stringify(actual)
    const e = JSON.stringify([...expected].sort())
    if (a !== e) failures.push(`${label}: expected ${e}, got ${a}`)
  }
  const truthy = (label, cond) => { predicateCases += 1; if (!cond) failures.push(label) }

  // 逐行规则：一正一反
  eq('CODE-TYPE-001 pos', ids('a.ts', 'const x: any = 1'), ['CODE-TYPE-001'])
  eq('CODE-TYPE-001 neg comment', ids('a.ts', 'const x = 1 // returns any'), [])
  eq('CODE-TYPE-001 neg string', ids('a.ts', "const s = 'any'"), [])
  eq('CODE-TYPE-001 neg z.any method', ids('a.ts', 'const s = z.any()'), [])
  eq('CODE-TYPE-001 neg expect.any', ids('a.ts', 'expect.any(String)'), [])
  eq('CODE-TYPE-001 neg test file any', ids('a.test.ts', 'const x: any = 1'), [])
  eq('CODE-ARCH-001 pos tsx', ids('a.tsx', 'const r = fetch("/x")'), ['CODE-ARCH-001'])
  eq('CODE-ARCH-001 neg ts', ids('a.ts', 'const r = fetch("/x")'), [])
  eq('CODE-TYPE-002 pos', ids('a.ts', 'const v = userSchema.parse(x) as User'), ['CODE-TYPE-002'])
  eq('CODE-TYPE-002 neg plain', ids('a.ts', 'const v = userSchema.parse(x)'), [])
  eq('CODE-TYPE-002 neg as-const', ids('a.ts', 'const v = schema.parse(x) as const'), [])
  eq('CODE-TYPE-002 neg JSON', ids('a.ts', 'const v = JSON.parse(x) as User'), [])
  eq('CODE-STYLE-002 pos hex', ids('a.ts', "const c = '#ffffff'"), ['CODE-STYLE-002'])
  eq('CODE-STYLE-002 neg token', ids('a.ts', 'const c = "rgb(var(--brand))"'), [])
  eq('CODE-STYLE-002 neg test file hex', ids('a.test.ts', "const c = '#ffffff'"), [])
  eq('CODE-STYLE-003 pos even', ids('a.tsx', '<div className="w-[400px]" />'), ['CODE-STYLE-003'])
  eq('CODE-STYLE-003 neg fidelity', ids('a.tsx', '<div className="w-[400px]" />', { visualFidelityHigh: true }), [])
  eq('CODE-STYLE-003 neg odd', ids('a.tsx', '<div className="w-[401px]" />'), [])
  eq('CODE-ARCH-002 pos else-if', ids('a.ts', '} else if (x) {'), ['CODE-ARCH-002'])
  eq('CODE-E2E-001 pos', ids('package.json', '    "playwright": "^1.0.0",'), ['CODE-E2E-001'])
  eq('CODE-E2E-001 neg', ids('package.json', '    "playnice": "^1.0.0",'), [])
  eq('DOC-REUSE-001 pos', ids('x.md', '本模块跳过复用'), ['DOC-REUSE-001'])
  eq('CODE-COPY-001 pos jsx', ids('apps/web/src/apps/Spot/x.tsx', '<span>立即报名</span>'), ['CODE-COPY-001'])
  eq('CODE-COPY-001 neg t-call', ids('apps/web/src/apps/Spot/x.tsx', "<span>{t('spot:join.now')}</span>"), [])
  eq('CODE-COPY-001 neg t default arg', ids('apps/web/src/apps/Spot/x.tsx', "const s = t('spot:join.now', '立即报名')"), [])
  eq('CODE-COPY-001 neg t defaultValue obj', ids('apps/web/src/apps/Spot/x.tsx', "const s = t('spot:join.now', { defaultValue: '立即报名' })"), [])
  eq('CODE-COPY-001 pos cjk outside t', ids('apps/web/src/apps/Spot/x.tsx', "<span>{t('spot:a')}报名</span>"), ['CODE-COPY-001'])
  eq('CODE-COPY-001 neg comment', ids('apps/web/src/apps/Spot/x.tsx', 'const n = 1 // 立即报名按钮'), [])
  eq('CODE-COPY-001 neg exception', ids('apps/web/src/apps/Spot/x.tsx', 'const label = "调试" // copy-exception'), [])
  eq('CODE-COPY-001 neg non-apps', ids('apps/web/src/services/api/x.tsx', '<span>立即报名</span>'), [])

  eq('CODE-MAPPER-001 pos same fallback', fileRuleIds('apps/web/src/services/mapUser.ts', [
    { line: 1, text: 'createdAt: dto.createdAt ?? dto.displayTime,' },
    { line: 2, text: 'filledAt: dto.filledAt ?? dto.displayTime,' },
  ]), ['CODE-MAPPER-001'])
  eq('CODE-MAPPER-001 neg distinct fallback', fileRuleIds('apps/web/src/services/mapUser.ts', [
    { line: 1, text: 'createdAt: dto.createdAt ?? dto.createdTime,' },
    { line: 2, text: 'filledAt: dto.filledAt ?? dto.filledTime,' },
  ]), [])
  eq('CODE-NAMING-001 pos plain rename', fileRuleIds('apps/web/src/services/mapUser.ts', [
    { line: 1, text: 'amount: dto.rewardAmount,' },
  ]), ['CODE-NAMING-001'])
  eq('CODE-NAMING-001 pos plain API comment', fileRuleIds('apps/web/src/services/mapUser.ts', [
    { line: 1, text: 'amount: dto.rewardAmount, // API: rewardAmount' },
  ]), ['CODE-NAMING-001'])
  eq('CODE-NAMING-001 neg cross-source reason', fileRuleIds('apps/web/src/services/mapUser.ts', [
    { line: 1, text: '// API-RENAME: cross-source source=taskGroupId,campaignId' },
    { line: 2, text: 'id: dto.taskGroupId,' },
  ]), [])
  eq('CODE-NAMING-001 neg derived reason', fileRuleIds('apps/web/src/services/mapUser.ts', [
    { line: 1, text: 'displayName: dto.name, // API-DERIVED: sources=firstName,lastName' },
  ]), [])
  eq('CODE-QUERY-001 pos useQuery', fileRuleIds('apps/web/src/services/api/demo.ts', [
    { line: 1, text: 'return useQuery({' },
  ]), ['CODE-QUERY-001'])
  eq('CODE-QUERY-001 neg explicit key', fileRuleIds('apps/web/src/services/api/demo.ts', [
    { line: 1, text: 'return useQuery({' },
    { line: 2, text: '  queryKey: demoQueryKey(req),' },
  ], 'export const demoQueryKey = (req: Req) => [\'demo\', req.id] as const'), [])
  eq('CODE-QUERY-002 pos raw transfer', fileRuleIds('apps/web/src/services/api/demo.ts', [
    { line: 1, text: 'transfer: (data) => data,' },
  ]), ['CODE-QUERY-002'])
  eq('CODE-QUERY-002 neg schema transfer', fileRuleIds('apps/web/src/services/api/demo.ts', [
    { line: 1, text: 'transfer: (data: unknown) => demoSchema.parse(toCamel(data)),' },
  ]), [])
  eq('CODE-ARCH-003 pos mapper query', architectureRuleIds('apps/web/src/services/mapUser.ts', "import { useQuery } from '@tanstack/react-query'"), ['CODE-ARCH-003'])
  eq('CODE-ARCH-003 pos mapper store', architectureRuleIds('apps/web/src/apps/User/mapper/userMapper.ts', "import { useUserStore } from '../store'"), ['CODE-ARCH-003'])
  eq('CODE-ARCH-003 pos api UI', architectureRuleIds('apps/web/src/services/api/user.ts', "import { UserCard } from '@/components/UserCard'"), ['CODE-ARCH-003'])
  eq('CODE-ARCH-003 pos component schema', architectureRuleIds('apps/web/src/apps/User/UserCard.tsx', "import { userSchema } from '@/services/api/user/schema'"), ['CODE-ARCH-003'])
  eq('CODE-ARCH-003 pos component API', architectureRuleIds('apps/web/src/apps/User/UserCard.tsx', "import { getUser } from '@/services/api/user'"), ['CODE-ARCH-003'])
  eq('CODE-ARCH-003 pos production fixture', architectureRuleIds('apps/web/src/services/api/user.ts', "import { userResponse } from '@/mocks/handlers/user.fixture'"), ['CODE-ARCH-003'])
  eq('CODE-ARCH-003 neg mapper pure', architectureRuleIds('apps/web/src/services/mapUser.ts', "import { formatAmount } from '@/utils/formatAmount'"), [])
  eq('CODE-ARCH-003 neg hook API', architectureRuleIds('apps/web/src/apps/User/useUser.ts', "import { getUser } from '@/services/api/user'"), [])
  eq('CODE-ARCH-003 neg test fixture', architectureRuleIds('apps/web/src/apps/User/UserCard.test.tsx', "import { userResponse } from '@/fixtures/user'"), [])

  // 纯谓词：文件分类与兜底字面量（CODE-FILE/NAMING/MOCK-003/005 的判定核心）
  truthy('isMapperFile pos', isMapperFile('apps/web/src/services/mapUser.ts'))
  truthy('isMapperFile neg', !isMapperFile('apps/web/src/services/user.ts'))
  truthy('isDataFile pos', isDataFile('apps/web/src/constants/x.ts'))
  truthy('isDataFile neg', !isDataFile('apps/web/src/apps/Spot/x.ts'))
  truthy('isMockFile pos', isMockFile('apps/web/src/__mock__/x.ts'))
  truthy('isMockFile mocks plural', isMockFile('apps/web/src/mocks/handlers/user.ts'))
  truthy('isMockFile fixture', isMockFile('apps/web/src/apps/User/user.fixture.ts'))
  truthy('isMockFile neg', !isMockFile('apps/web/src/apps/x.ts'))
  truthy('isAllowedFallbackLiteral pos', isAllowedFallbackLiteral("'--'"))
  truthy('isAllowedFallbackLiteral neg', !isAllowedFallbackLiteral("'N/A'"))
  truthy('findPresetArbitrary pos', findPresetArbitraryClasses('w-[400px]').length > 0)
  truthy('findPresetArbitrary neg', findPresetArbitraryClasses('w-[401px]').length === 0)
  truthy('file size new oversized blocks', classifyFileSize(301, 0).severity === 'error')
  truthy('file size newly oversized blocks', classifyFileSize(301, 299).severity === 'error')
  truthy('file size legacy oversized warns', classifyFileSize(993, 975).severity === 'warn')
  truthy('file size under limit silent', !classifyFileSize(299, 500).report)
  truthy('countLines trailing newline', countLines('a\nb\n') === 2)
  truthy('countLines no trailing newline', countLines('a\nb') === 2)

  // CODE-MOCK-006 上下文正则：环境名判断 + mock/fallback 语义（scanEnvNameMockSwitch 判定核心）
  truthy('MOCK-006 env-switch pos', ENV_NAME_SWITCH_RE.test("process.env.NEXT_PUBLIC_ENV_NAME === 'dev'"))
  truthy('MOCK-006 env-switch neg feature-flag', !ENV_NAME_SWITCH_RE.test("process.env.NEXT_PUBLIC_X_USE_MOCK === 'true'"))
  truthy('MOCK-006 context pos', MOCK_CONTEXT_RE.test('const shouldUseMockMenuFallback = () =>'))
  truthy('MOCK-006 context neg', !MOCK_CONTEXT_RE.test('export const isDevEnvironment = () =>'))

  if (failures.length) {
    console.error(`verify-code-rules self-test FAILED (${failures.length}):\n  ${failures.join('\n  ')}`)
    process.exit(1)
  }
  console.log(`verify-code-rules self-test passed (${ruleCases} rule cases + ${predicateCases} predicate cases).`)
  process.exit(0)
}

if (hasFlag('--self-test')) runSelfTest()

const changedFiles = collectChangedFiles().filter((file) => file.startsWith('apps/') || file.startsWith('packages/') || file === 'package.json')
const findings = []

for (const file of changedFiles) scanFile(file, findings)

// CODE-MOCK-004 / 005 是全量存量扫描（env mock 开关 + mock 泄漏），不受 changedFiles 限制。
// 默认只在完整 gate 中开启；--files 模式默认跳过，避免别处存量残留阻断无关编辑。
// 需要手动控制时用 --global-scan / --no-global-scan。
if (globalScan) {
  scanEnvMockFlags(findings)
  scanMockLeaks(findings)
  scanEnvNameMockSwitch(findings)
}

// 豁免：--waivers <path> 指向 rule-waivers.json（见 rule-ids-and-gates.md §4）。命中的 error
// finding 降级为 waived（保留在输出、不计入 ok）；过期 / 无 expiresAt / 文件非法一律不生效。
function applyWaivers(list) {
  const waiverFile = waiversPath ? resolve(worktreeRoot, waiversPath) : ''
  const localOnlyWaiverFile = projectId ? join(resolveProjectRoot(projectId), 'agent/rule-waivers.json') : ''
  const resolvedWaiverFile = existsSync(waiverFile) ? waiverFile : localOnlyWaiverFile
  if (!resolvedWaiverFile || !existsSync(resolvedWaiverFile)) return
  let waivers
  try {
    waivers = JSON.parse(readFileSync(resolvedWaiverFile, 'utf8'))
  } catch {
    return
  }
  if (!Array.isArray(waivers)) return
  const today = new Date().toISOString().slice(0, 10)
  const active = waivers.filter((w) => w && w.ruleId && w.expiresAt && w.expiresAt >= today)
  for (const finding of list) {
    if (finding.severity !== 'error') continue
    if (active.some((w) => w.ruleId === finding.ruleId && (!w.file || w.file === finding.file))) {
      finding.severity = 'waived'
    }
  }
}

applyWaivers(findings)

const result = {
  ok: findings.filter((finding) => finding.severity === 'error').length === 0,
  baseRef,
  projectId: projectId || null,
  waiversPath: waiversPath || null,
  globalScan,
  changedFiles,
  findings,
}

if (json) {
  console.log(JSON.stringify(result, null, 2))
} else {
  console.log(`verify-code-rules: ${changedFiles.length} changed file(s), base=${baseRef}, globalScan=${globalScan}`)
  if (!findings.length) {
    console.log('OK: no changed-file static rule findings.')
  } else {
    for (const finding of findings) {
      console.log(`${finding.severity.toUpperCase()} ${finding.ruleId} ${finding.file}:${finding.line} ${finding.message}`)
    }
  }
}

process.exit(result.ok ? 0 : 1)
