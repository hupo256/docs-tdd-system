#!/usr/bin/env node

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parseAiExecutorDirective } from '../lark-gateway.mjs'
import {
  buildAiExecutorCommand,
  formatStructuredAiResult,
  resolveAiExecutor,
  validateAiExecutor,
} from '../lib/lark-ai-executor.mjs'
import { buildQueuedCard, buildResultCard } from '../lib/lark-cards.mjs'
import { scanDiffForViolations } from '../lib/lark-lint-diff.mjs'
import { buildTaskPrompt, buildValidationRequirements } from '../lark-worker.mjs'

describe('AI executor selection', () => {
  it('只接受 claude/codex 固定枚举', () => {
    assert.equal(validateAiExecutor(' Codex '), 'codex')
    assert.equal(validateAiExecutor('CLAUDE'), 'claude')
    assert.throws(() => validateAiExecutor('bash -c whoami'), /must be one of/)
  })

  it('优先级为 task > env > local config > wrapper > claude', () => {
    const worker = { aiExecutor: 'claude', localConfig: { aiExecutor: 'codex' } }
    assert.equal(resolveAiExecutor(worker, { aiExecutor: 'claude' }, { LARK_AI_EXECUTOR: 'codex' }), 'claude')
    assert.equal(resolveAiExecutor(worker, {}, { LARK_AI_EXECUTOR: 'claude' }), 'claude')
    assert.equal(resolveAiExecutor(worker, {}, {}), 'codex')
    assert.equal(resolveAiExecutor({ aiExecutor: 'claude', localConfig: {} }, {}, {}), 'claude')
  })

  it('群消息仅识别开头的安全选择指令', () => {
    assert.equal(parseAiExecutorDirective('[codex] 修复登录页'), 'codex')
    assert.equal(parseAiExecutorDirective(' [CLAUDE] 看这里'), 'claude')
    assert.equal(parseAiExecutorDirective('修复 [codex] 登录页'), undefined)
    assert.equal(parseAiExecutorDirective('[shell] whoami'), undefined)
  })
})

describe('Codex non-interactive command', () => {
  it('使用指定模型与推理强度，并保持 workspace-write、never、关闭工具网络', () => {
    const command = buildAiExecutorCommand({
      executor: 'codex',
      promptText: 'fix it',
      cwd: '/tmp/repo',
      resultPath: '/tmp/result.json',
      codexModel: 'gpt-5.6-sol',
      codexReasoningEffort: 'high',
    })
    assert.equal(command.cmd, 'codex')
    assert.equal(command.stdin, 'fix it')
    assert.equal(command.resultMode, 'structured')
    assert.ok(command.args.includes('--ephemeral'))
    assert.deepEqual(command.args.slice(command.args.indexOf('--sandbox'), command.args.indexOf('--sandbox') + 2), ['--sandbox', 'workspace-write'])
    assert.deepEqual(command.args.slice(0, 3), ['--ask-for-approval', 'never', 'exec'])
    assert.deepEqual(command.args.slice(command.args.indexOf('--model'), command.args.indexOf('--model') + 2), ['--model', 'gpt-5.6-sol'])
    assert.ok(command.args.includes('model_reasoning_effort="high"'))
    assert.ok(command.args.includes('sandbox_workspace_write.network_access=false'))
    assert.equal(command.args.at(-1), '-')
    assert.equal(command.args.includes('--dangerously-bypass-approvals-and-sandbox'), false)
  })

  it('Claude 保持现有无人值守参数', () => {
    const command = buildAiExecutorCommand({ executor: 'claude', promptText: 'fix it', cwd: '/tmp/repo' })
    assert.deepEqual(command.args, ['-p', '--dangerously-skip-permissions', 'fix it'])
    assert.equal(command.resultMode, 'gateway-callback')
  })
})

describe('risk-based validation policy', () => {
  it('L1 样式改动跳过 type-check，验证使用本地二进制并预防缓存/网络问题', () => {
    const policy = buildValidationRequirements()
    assert.match(policy, /L1 样式/)
    assert.match(policy, /无需 type-check/)
    assert.match(policy, /node_modules\/\.bin\/vitest run --no-cache/)
    assert.match(policy, /不要用会触发 Corepack\/registry 的 `pnpm exec`/)
    assert.match(policy, /同一检查最多执行一次/)
  })

  it('任务 Prompt 只保留风险分级策略，不再强制每个 apps\/web 改动跑 tsc', () => {
    const prompt = buildTaskPrompt(
      { projectId: 'PR-00001', projectName: 'test', projectDocs: [], cwd: '/tmp/repo', hotfixBranch: 'hotfix/test' },
      { id: 'task-1', text: '调整圆角', attachments: [] },
      'codex',
    )
    assert.match(prompt, /按最终 diff 风险分级/)
    assert.doesNotMatch(prompt, /cd apps\/web && pnpm exec tsc --noEmit/)
    assert.match(prompt, /必需检查完成后立即结束/)
  })
})

describe('structured result and cards', () => {
  const result = {
    status: 'done',
    summary: '修复登录按钮颜色。',
    checks: ['button.test.tsx 通过'],
    changedFiles: ['apps/web/button.tsx'],
  }

  it('Worker 把结构化结果转成稳定回执', () => {
    const text = formatStructuredAiResult(result, 'codex')
    assert.match(text, /^已完成。/)
    assert.match(text, /执行器：codex/)
    assert.match(text, /button.test.tsx 通过/)
  })

  it('排队卡与结果卡展示实际执行器', () => {
    const config = { project: 'PR-01947', title: 'Test' }
    const task = { project: 'PR-01947', summary: 'fix', aiExecutor: 'codex' }
    assert.match(JSON.parse(buildQueuedCard({ config, task })).elements[0].text.content, /执行器.*Codex/)
    assert.match(JSON.parse(buildResultCard({ config, task, status: 'done', result: 'ok' })).elements[0].text.content, /执行器.*Codex/)
  })
})

describe('unattended diff quality gate', () => {
  it('只拦新增代码行里的 arbitrary value 与失效裸色类', () => {
    const violations = scanDiffForViolations([
      '+++ b/apps/web/src/Button.tsx',
      '-<div className="rounded-[4px] text-green" />',
      '+<div className="rounded-[8px] text-green" />',
      '+++ b/README.md',
      '+rounded-[99px] text-red',
    ].join('\n'))
    assert.deepEqual(violations.map((item) => item.kind), ['arbitrary-value', 'invalid-color-class'])
  })

  it('合法项目 token 不误报', () => {
    const violations = scanDiffForViolations('+++ b/apps/web/src/Button.tsx\n+<div className="rounded-m text-sem-g" />')
    assert.deepEqual(violations, [])
  })
})
