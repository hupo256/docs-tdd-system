#!/usr/bin/env node
// 规则消费去全局单例锁的回归矩阵（Phase 4 · item 13）。
//
// 把「目标行为表」的 8 条不变量固化成一个可回归入口，防止未来重构悄悄把项目钉版
// 退回成全局单例锁。能在临时 git 仓 / 临时 manifest 上真实断言的直接跑真行为；
// 纯授权守卫类（本项目代码变化仍失效）在本层做「钉版不吸收代码身份」的正交性断言，
// 并交叉引用固化它的既有自测（gate-cache / g6-context-session / rule-session）。
//
// 运行：node lib/rule-consumption-regression.mjs --self-test
//
// 依赖的可注入根：pinned-source 的 `root`、rule-pin 的 `manifestFile`/`releaseFile`
// 均为可选参数（默认真实 docsSystemRoot / 真实 rule-release.json），本文件只在自测里注入临时根。

import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { currentDocsCommit, pinnedFileExists, readPinnedFile } from './pinned-source.mjs'
import { latestReleasePin, resolveRulePin, upgradeRulePin } from './rule-pin.mjs'

// --- 临时 git 仓夹具 -------------------------------------------------------
function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' })
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${(result.stderr || '').trim()}`)
  return result.stdout.trim()
}

function writeFile(root, relPath, content) {
  const abs = join(root, relPath)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
}

function initFixtureRepo() {
  const root = mkdtempSync(join(tmpdir(), 'docs-tdd-regress-'))
  git(root, ['init', '-q'])
  git(root, ['config', 'user.email', 'regress@docs-tdd.local'])
  git(root, ['config', 'user.name', 'docs-tdd regression'])
  git(root, ['config', 'commit.gpgsign', 'false'])
  return root
}

function writeManifest(dir, name, rulePolicy) {
  const file = join(dir, `${name}.json`)
  const body = rulePolicy ? { rulePolicy } : {}
  writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`)
  return file
}

// --- 回归矩阵 --------------------------------------------------------------
function selfTest() {
  const assert = (cond, label) => {
    if (!cond) {
      console.error(`[rule-consumption-regression] FAIL: ${label}`)
      process.exit(1)
    }
  }

  const gitRepo = initFixtureRepo()
  const manifestDir = mkdtempSync(join(tmpdir(), 'docs-tdd-manifests-'))
  try {
    // 共享临时 git 仓：规则文档 x.md 三个版本（commit1 已发布 / commit2 未发布草稿 / 工作副本脏改）。
    writeFile(gitRepo, 'common/rules/x.md', 'v1\n')
    git(gitRepo, ['add', '.'])
    git(gitRepo, ['commit', '-q', '-m', 'release v1'])
    const commit1 = git(gitRepo, ['rev-parse', 'HEAD'])
    writeFile(gitRepo, 'common/rules/x.md', 'v2 DRAFT\n')
    git(gitRepo, ['add', '.'])
    git(gitRepo, ['commit', '-q', '-m', 'draft v2'])
    const commit2 = git(gitRepo, ['rev-parse', 'HEAD'])
    writeFile(gitRepo, 'common/rules/x.md', 'v3 WORKING\n') // 脏工作副本，未提交

    // Case 3 — 改未发布规则：已 pin 旧项目读 pinned commit 内容，不被 commit2/工作副本污染。
    assert(readPinnedFile({ commit: commit1, relPath: 'common/rules/x.md', root: gitRepo }) === 'v1\n', 'case3 pinned read stays at commit1 despite later drift')
    assert(readPinnedFile({ commit: commit2, relPath: 'common/rules/x.md', root: gitRepo }) === 'v2 DRAFT\n', 'case3 a different pin reads its own commit')
    assert(pinnedFileExists({ commit: commit1, relPath: 'common/rules/x.md', root: gitRepo }), 'case3 pinned file exists at commit1')

    // Case 6 — pinned commit 缺文件 → 硬阻塞（调用方据此判 pinned release 损坏/缺失）。
    let threw = false
    try {
      readPinnedFile({ commit: commit1, relPath: 'common/rules/missing.md', root: gitRepo })
    } catch {
      threw = true
    }
    assert(threw, 'case6 missing file at pinned commit throws (hard block)')
    assert(!pinnedFileExists({ commit: commit1, relPath: 'common/rules/missing.md', root: gitRepo }), 'case6 pinnedFileExists false for missing path')
    assert(currentDocsCommit(gitRepo) === commit2, 'case6 currentDocsCommit resolves HEAD of the injected root')

    // Case 2 — 改 common/engine/** ：项目冻结身份是 policyFingerprint，不含 engine 指纹；
    // engine 漂移不移动项目所钉的政策身份（业务命令因此不被 engine freshness 掐停）。
    const engA = latestReleasePin({ commit: 'c1', policyFingerprint: 'POL', engineFingerprint: 'ENG_A' })
    const engB = latestReleasePin({ commit: 'c1', policyFingerprint: 'POL', engineFingerprint: 'ENG_B' })
    assert(engA.policyFingerprint === engB.policyFingerprint && engA.policyFingerprint === 'POL', 'case2 engine drift does not change pinned policy identity')

    // 发布基线：v2 manifest 带 commit + policyFingerprint。
    const releaseOld = writeManifest(manifestDir, 'release-old', undefined)
    writeFileSync(releaseOld, `${JSON.stringify({ version: 2, commit: 'oldcommit', policyFingerprint: 'POL_OLD' }, null, 2)}\n`)
    const releaseNew = writeManifest(manifestDir, 'release-new', undefined)
    writeFileSync(releaseNew, `${JSON.stringify({ version: 2, commit: 'newcommit', policyFingerprint: 'POL_NEW' }, null, 2)}\n`)

    // 两个已 pin 到旧政策的业务项目。
    const manA = writeManifest(manifestDir, 'PR-A', { commit: 'oldcommit', policyFingerprint: 'POL_OLD', upgradeMode: 'explicit' })
    const manB = writeManifest(manifestDir, 'PR-B', { commit: 'oldcommit', policyFingerprint: 'POL_OLD', upgradeMode: 'explicit' })

    // Case 4 — 发布新规则后：已 pin 项目不自动升级（explicit 模式），resolveRulePin 仍返回旧政策。
    const pinAfterNewRelease = resolveRulePin('PR-A', { manifestFile: manA, releaseFile: releaseNew, persist: false })
    assert(pinAfterNewRelease.policyFingerprint === 'POL_OLD' && pinAfterNewRelease.source === 'manifest', 'case4 newer release does not auto-upgrade a pinned project')

    // Case 1 — 其他项目/发布基线变化不影响本项目冻结身份：同一 manifest 在 releaseFile 前后不同版本下，
    // 解析出的 pin 恒定（钉版身份只来自本项目 manifest.rulePolicy）。
    const pinVsOld = resolveRulePin('PR-A', { manifestFile: manA, releaseFile: releaseOld, persist: false })
    assert(pinVsOld.policyFingerprint === pinAfterNewRelease.policyFingerprint, 'case1 pinned identity invariant to external release/other-project changes')

    // Case 5 — rules upgrade PR-A：仅 PR-A 的 manifest 迁到新政策；PR-B 字节不变。
    const manBBefore = readFileSync(manB, 'utf8')
    const { previous, next } = upgradeRulePin('PR-A', { manifestFile: manA, releaseFile: releaseNew })
    assert(previous?.policyFingerprint === 'POL_OLD' && next.policyFingerprint === 'POL_NEW', 'case5 upgrade moves PR-A onto the latest policy')
    assert(readFileSync(manB, 'utf8') === manBBefore, 'case5 upgrade of PR-A leaves PR-B manifest byte-identical')

    // Case 8 — 两项目并行：惰性 pin 只写自己的 manifest，不覆盖兄弟项目。
    const legacyA = writeManifest(manifestDir, 'PR-legacyA', undefined)
    writeFileSync(legacyA, `${JSON.stringify({ some: 'other-field' }, null, 2)}\n`) // 旧项目：无 rulePolicy
    const legacyB = writeManifest(manifestDir, 'PR-legacyB', undefined)
    writeFileSync(legacyB, `${JSON.stringify({ some: 'other-field' }, null, 2)}\n`)
    const legacyBBefore = readFileSync(legacyB, 'utf8')
    const lazyPin = resolveRulePin('PR-legacyA', { manifestFile: legacyA, releaseFile: releaseOld, persist: true })
    assert(lazyPin.policyFingerprint === 'POL_OLD' && lazyPin.source === 'lazy', 'case8 legacy project lazily pins to the published release')
    const legacyAAfter = JSON.parse(readFileSync(legacyA, 'utf8'))
    assert(legacyAAfter.rulePolicy?.policyFingerprint === 'POL_OLD' && legacyAAfter.some === 'other-field', 'case8 lazy pin persists into PR-legacyA without clobbering existing fields')
    assert(readFileSync(legacyB, 'utf8') === legacyBBefore, 'case8 lazy pin of PR-legacyA leaves PR-legacyB untouched')

    // Case 7 — 本项目代码/PRD/契约变化仍正确失效：由 gate-cache 的 createFingerprint（含 headSha+dirtyHash）
    // 与 rule-session 的 codeReadinessFingerprint 守卫，见对应 --self-test。此处做正交性回归：
    // 钉版身份绝不吸收代码状态字段，否则会掩盖代码失效信号。若未来有人把 headSha 折进 pin，本断言即失败。
    const codeKeys = ['headSha', 'dirtyHash', 'codeReadinessFingerprint']
    assert(codeKeys.every((k) => !(k in pinAfterNewRelease)), 'case7 pin identity excludes code state (code-invalidation signal not absorbed)')

    console.log('PASS rule-consumption-regression (8/8 target behaviors)')
  } finally {
    rmSync(gitRepo, { recursive: true, force: true })
    rmSync(manifestDir, { recursive: true, force: true })
  }
}

if (process.argv[1] && process.argv[1].endsWith('rule-consumption-regression.mjs') && process.argv.includes('--self-test')) selfTest()
