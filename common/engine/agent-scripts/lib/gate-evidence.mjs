// run-project-gate 的证据渲染层（纯函数）：markdown 单元格转义、命令/发现表、机器事实层单元格、
// evidence README 全文渲染，以及证据 run-id 格式化。

export function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '/').replace(/\n/g, '<br>')
}

function actionRows(checks = []) {
  const rows = checks.filter((check) => !check.ok)
  if (!rows.length) return '| 无 | PASS | 无阻塞项 | | |'
  return rows
    .map((check) => `| ${escapeCell(check.ruleId)} | ${escapeCell(check.severity)} | ${escapeCell(check.message)} | ${escapeCell(check.file)} | 待处理 / 已豁免 / 不适用 |`)
    .join('\n')
}

export function commandRows(commands) {
  return commands
    .map((item) => `| \`${escapeCell(item.label)}\` | ${escapeCell(item.target)} | ${item.result.ok ? 'PASS' : 'FAIL'} | exit=${item.result.status ?? 'null'} |`)
    .join('\n')
}

export function summarizeCommand(item) {
  return {
    label: item.label,
    status: item.result.status,
    ok: item.result.ok,
    startedAt: item.result.startedAt,
    finishedAt: item.result.finishedAt,
    logFile: item.result.logFile || null,
  }
}

export function formatEvidenceRunId(generatedAt, gateName) {
  const compactTime = generatedAt.slice(11, 19).replace(/:/g, '')
  return `${generatedAt.slice(0, 10)}-${compactTime}-${gateName.toLowerCase()}`
}

// 交付摘要要能一眼看出 biome/tsc/vitest 到底跑没跑，而不是只看到一堆 PASS。
export function buildQualityCell(buildQuality) {
  if (!buildQuality?.required) return '本阶段不要求（G6 起强制）'
  if (buildQuality.skipped) return `已跳过：${escapeCell(buildQuality.reason || '未填理由')}`
  return `${buildQuality.ok ? 'PASS' : 'FAIL'}（biome/tsc/vitest 实跑 ${buildQuality.checkCount ?? 0} 条结论）`
}

export function renderEvidence(payload, commands, reviewer) {
  const failed = payload.checks.filter((check) => !check.ok && check.severity === 'error')
  const conclusion = failed.length ? 'BLOCKED' : 'PASS'
  return `# Gate Evidence — ${payload.projectId} ${payload.gate}

## Summary

| 字段 | 值 |
|------|-----|
| 项目 | ${payload.projectId} |
| 阶段 | ${payload.gate} |
| 日期 | ${payload.generatedAt.slice(0, 10)} |
| 验证人 | ${escapeCell(reviewer)} |
| 结论 | ${conclusion} |
| 统计 | total=${payload.summary.total}, fail=${payload.summary.fail}, warn=${payload.summary.warn}, waived=${payload.summary.waived} |
| 分组 | documentation=${payload.groups?.documentation?.ok ?? 0}/${payload.groups?.documentation?.total ?? 0}, implementation=${payload.groups?.implementation?.ok ?? 0}/${payload.groups?.implementation?.total ?? 0} |
| 跳过代码规则 | ${payload.codeRules?.skipped ? `是：${escapeCell(payload.codeRules.reason)}` : '否'} |
| 机器事实层 | ${buildQualityCell(payload.buildQuality)} |

## Command Evidence

| 命令 | 目标文件 / 场景 | 结果 | 备注 |
|------|-----------------|------|------|
${commandRows(commands)}

## Gate Findings

| Rule ID | Severity | Message | File | Disposition |
|---------|----------|---------|------|-------------|
${actionRows(payload.checks)}

## Browser / UI Evidence

| 页面 / 场景 | URL | 视口 / 主题 | 操作步骤 | 结果 |
|-------------|-----|-------------|----------|------|
| 本脚本不执行浏览器自测 | 待人工补充 | 待人工补充 | 待人工补充 | 未覆盖 |

## Code Review Evidence

| 时间 | 命令 | findings | 处理结论 | 备注 |
|------|------|----------|----------|------|
| 待补充 | /code-review | 待补充 | 已修 / 豁免 / 不适用 | 同步到 \`product/06-collaboration.md\` |

## Blockers / Risks

| 项 | 影响 | 责任人 | 下一步 | 状态 |
|----|------|--------|--------|------|
${failed.length ? failed.map((check) => `| ${escapeCell(check.ruleId)} | 阻塞 ${payload.gate} | 待定 | ${escapeCell(check.message)} | OPEN |`).join('\n') : '| 无 | | | | CLOSED |'}
`
}
