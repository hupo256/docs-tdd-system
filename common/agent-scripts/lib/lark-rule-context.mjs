/**
 * 从现有 L1/L3 权威源按任务语义抽取小段规则，避免把整包规则交给无人值守 AI。
 * 本文件只维护“任务信号 -> 现有章节”的路由，不复制规则正文。
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { docsSystemRoot } from './roots.mjs'

const SIGNALS = {
  copy: /(?:文案|标题|按钮|提示|说明|tips?|tooltip|toast|placeholder|label|hover)/i,
  style: /(?:样式|颜色|圆角|间距|尺寸|背景|边框|字号|图标|布局|响应式|class|color|radius|padding|margin)/i,
  ui: /(?:页面|组件|表单|弹窗|浮层|tab|输入框|下拉|switch|hover|UI|UX)/i,
  api: /(?:API|接口|schema|DTO|mapper|字段|请求|响应|契约)/i,
  mapper: /(?:mapper|映射|DTO|schema)/i,
  query: /(?:React Query|query|mutation|hook|请求状态|缓存)/i,
  state: /(?:Zustand|store|状态管理|状态派生|state)/i,
  mock: /(?:MSW|mock|fixture|handler)/i,
}

const sourcePath = (relativePath) => join(docsSystemRoot, relativePath)
const globalPath = (relativePath) => join(homedir(), '.ai-rules', relativePath)

const BASE_REFS = [
  { file: globalPath('AGENT.md'), label: '~/.ai-rules/AGENT.md', heading: '## React / TypeScript Hard Rules' },
  { file: sourcePath('common/rule-router.md'), label: 'common/rule-router.md', heading: '## 2. 常驻硬规则' },
]

const UI_REFS = [
  { file: globalPath('skills/coding-quality/SKILL.md'), label: '~/.ai-rules/skills/coding-quality/SKILL.md', heading: '## 0. Pre-Code Quality Card' },
  { file: globalPath('skills/coding-quality/SKILL.md'), label: '~/.ai-rules/skills/coding-quality/SKILL.md', heading: '## 0.1 Output Quality Gate' },
  { file: globalPath('skills/coding-quality/SKILL.md'), label: '~/.ai-rules/skills/coding-quality/SKILL.md', heading: '## 5. Reuse Before New UI' },
  { file: sourcePath('common/architecture-and-state.md'), label: 'common/architecture-and-state.md', heading: '## 1. 默认分层' },
  { file: sourcePath('common/architecture-and-state.md'), label: 'common/architecture-and-state.md', heading: '## 2. 复用优先级' },
]

const COPY_REFS = [
  { file: globalPath('skills/coding-quality/SKILL.md'), label: '~/.ai-rules/skills/coding-quality/SKILL.md', heading: '## 4. i18n Keys Are What-You-See-In-Source (i18n Ally WYSIWYG)' },
  { file: globalPath('skills/coding-quality/SKILL.md'), label: '~/.ai-rules/skills/coding-quality/SKILL.md', heading: '## 9. Copy Contracts' },
  { file: sourcePath('common/architecture-and-state.md'), label: 'common/architecture-and-state.md', heading: '## 7.1 文案契约：像接口 contract 一样管理' },
]

const STYLE_REFS = [
  { file: globalPath('skills/coding-quality/SKILL.md'), label: '~/.ai-rules/skills/coding-quality/SKILL.md', heading: '## 8. Styling And Visual QA' },
  { file: sourcePath('common/ui-style-token-rules.md'), label: 'common/ui-style-token-rules.md', heading: '## 1. 设计契约' },
  { file: sourcePath('common/ui-style-token-rules.md'), label: 'common/ui-style-token-rules.md', heading: '## 2. 颜色与主题' },
  { file: sourcePath('common/ui-style-token-rules.md'), label: 'common/ui-style-token-rules.md', heading: '## 3. 尺寸、间距、圆角' },
  { file: sourcePath('common/ui-style-token-rules.md'), label: 'common/ui-style-token-rules.md', heading: '## 4. Arbitrary Value 边界' },
]

const API_REFS = [
  { file: sourcePath('common/api-and-mapper.md'), label: 'common/api-and-mapper.md', heading: '## 1. 调用链与数据链' },
  { file: sourcePath('common/api-and-mapper.md'), label: 'common/api-and-mapper.md', heading: '## 2. Mapper 命名' },
  { file: sourcePath('common/api-and-mapper.md'), label: 'common/api-and-mapper.md', heading: '## 3. 字段对账' },
  { file: globalPath('skills/coding-quality/SKILL.md'), label: '~/.ai-rules/skills/coding-quality/SKILL.md', heading: '## 6. API Schema And Mapper Checks' },
]

const STATE_REFS = [
  { file: sourcePath('common/architecture-and-state.md'), label: 'common/architecture-and-state.md', heading: '## 4. 状态管理' },
  { file: sourcePath('common/architecture-and-state.md'), label: 'common/architecture-and-state.md', heading: '## 5. Zustand 使用边界' },
  { file: sourcePath('common/architecture-and-state.md'), label: 'common/architecture-and-state.md', heading: '## 6. 状态推导与查表' },
  { file: globalPath('skills/coding-quality/SKILL.md'), label: '~/.ai-rules/skills/coding-quality/SKILL.md', heading: '## 2. State Derivation And Lookup Resolvers' },
]

const MOCK_REFS = [
  { file: sourcePath('common/architecture-and-state.md'), label: 'common/architecture-and-state.md', heading: '## 8. Mock 策略：默认 MSW 路线 B，临时脚手架、零残留' },
]

const headingLevel = (heading) => heading.match(/^#+/)?.[0].length || 2

export const extractMarkdownSection = (text, heading) => {
  const lines = String(text || '').split('\n')
  const start = lines.findIndex((line) => line.trim() === heading)
  if (start < 0) return ''
  const level = headingLevel(heading)
  let end = lines.length
  for (let index = start + 1; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#+)\s+/)
    if (match && match[1].length <= level) {
      end = index
      break
    }
  }
  return lines.slice(start, end).join('\n').trim()
}

export const classifyLarkTask = (taskText) => {
  const text = String(taskText || '')
  const signals = Object.entries(SIGNALS)
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name)
  const signalSet = new Set(signals)
  const scenario = signalSet.has('mock')
    ? 'write_msw'
    : signalSet.has('mapper')
      ? 'write_mapper'
      : signalSet.has('query')
        ? 'write_query_hook'
        : signalSet.has('state')
          ? 'write_state'
          : signalSet.has('api')
            ? 'write_api'
            : signalSet.has('ui') || signalSet.has('copy') || signalSet.has('style')
              ? 'write_ui'
              : 'g4_coding_worktree'
  return { scenario, signals }
}

const refsFor = ({ scenario, signals }) => {
  const signalSet = new Set(signals)
  const refs = [...BASE_REFS]
  if (scenario === 'write_ui') refs.push(...UI_REFS)
  if (signalSet.has('copy')) refs.push(...COPY_REFS)
  if (signalSet.has('style')) refs.push(...STYLE_REFS)
  if (['write_api', 'write_mapper', 'write_query_hook'].includes(scenario)) refs.push(...API_REFS)
  if (['write_state', 'write_query_hook'].includes(scenario)) refs.push(...STATE_REFS)
  if (scenario === 'write_msw') refs.push(...MOCK_REFS, ...API_REFS)
  return refs
}

export const buildFocusedRuleContext = ({ taskText }) => {
  const classification = classifyLarkTask(taskText)
  const sources = []
  const excerpts = []
  const seen = new Set()

  for (const ref of refsFor(classification)) {
    const key = `${ref.file}#${ref.heading}`
    if (seen.has(key) || !existsSync(ref.file)) continue
    seen.add(key)
    const excerpt = extractMarkdownSection(readFileSync(ref.file, 'utf8'), ref.heading)
    if (!excerpt) continue
    const sha256 = createHash('sha256').update(excerpt).digest('hex')
    sources.push({ path: ref.label, section: ref.heading, sha256 })
    excerpts.push(`### Source: ${ref.label} · ${ref.heading}\n\n${excerpt}`)
  }

  return {
    ...classification,
    sources,
    fingerprint: createHash('sha256').update(sources.map((item) => `${item.path}#${item.section}:${item.sha256}`).join('\n')).digest('hex').slice(0, 16),
    text: excerpts.join('\n\n'),
  }
}
