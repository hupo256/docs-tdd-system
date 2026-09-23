import { buildVNextContextV4 } from './common/engine/agent-scripts/lib/vnext-context-v4.mjs'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const workItem = JSON.parse(readFileSync('prds/TEST-V4-LITE-001/work-item.json', 'utf-8'))

const context = buildVNextContextV4({ workItem }, {
  includeRules: true,
  rulesRoot: resolve('common/rules'),
})

console.log('━━━━ Context Stats ━━━━')
console.log(`efficiencyRoute: ${context.efficiencyRoute}`)
console.log(`base chars: ${context.chars}`)
console.log(`rule chars: ${context.ruleSelection.ruleChars}`)
console.log(`total chars: ${context.totalChars}`)
console.log(`files loaded: ${context.ruleSelection.filesCount}`)
console.log(`within budget: ${context.budgetStatus}`)

console.log('\n━━━━ 规则文件预览（前 3 个）━━━━')
const lines = context.text.split('\n')
let fileCount = 0
for (let i = 0; i < lines.length && fileCount < 3; i++) {
  if (lines[i].startsWith('## [')) {
    console.log(lines[i])
    console.log(lines.slice(i+1, i+5).join('\n'))
    console.log('...\n')
    fileCount++
  }
}
