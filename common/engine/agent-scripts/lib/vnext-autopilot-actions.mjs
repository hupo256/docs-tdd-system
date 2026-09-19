export const AUTOPILOT_PHASES = Object.freeze([
  'intake',
  'planning',
  'implementing',
  'implementation-ready',
  'validating',
  'ready-to-test',
  'delivered',
  'blocked',
])

export const AUTOPILOT_ACTIONS = Object.freeze([
  'extract-requirements',
  'repair-intake-extraction',
  'classify-scope-and-risk',
  'bound-implementation-scope',
  'complete-independent-review',
  'repair-review-findings',
  'resume-review-after-human-repair',
  'escalate-review-failure',
  'complete-deferred-human-review',
  'complete-pretest-human-run',
  'repair-manual-test-omissions',
  'resolve-manual-test-blockers',
  'repair-manual-functional-failures',
  'repair-manual-visual-failures',
  'repair-manual-test-failures',
  'collect-scope-approval',
  'prepare-coding-worktree',
  'implement-current-scope',
  'reconcile-current-code',
  'await-surface-dependencies',
  'await-late-dependencies',
  'reconcile-late-sources',
  'capture-cli-evidence',
  'repair-failed-checks',
  'escalate-repair-failure',
  'blocked-user-decision',
  'blocked-external-dependency',
  'failed-infrastructure',
  'resolve-blockers',
  'refresh-invalid-verification',
  'revalidate-current-code-evidence',
  'commit-ready-change',
  'complete',
])

if (process.argv.includes('--self-test')) {
  if (new Set(AUTOPILOT_ACTIONS).size !== AUTOPILOT_ACTIONS.length) throw new Error('duplicate Autopilot action')
  console.log('vnext-autopilot-actions self-test passed')
}
