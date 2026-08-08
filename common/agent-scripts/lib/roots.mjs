// Root & config resolver for the docs_tdd system.
//
// Splits the single "repoRoot" (which historically did triple duty via a fragile
// up-5 path climb) into three explicit roots plus a consumer binding config, so the
// system can live physically anywhere and still guide any consuming project:
//   - docsSystemRoot : this docs repo's own root, derived from THIS file's location
//                      (never via the host tree) so a physical move can't break it.
//   - consumerRoot   : the guided project's main repo (e.g. fameex-web), derived from
//                      the git common dir of the current worktree.
//   - consumerWorktree: the worktree the agent is actually coding in (git toplevel of cwd).
//   - config         : consumer binding (docs-tdd.config.json), merged over bundled defaults.

import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url)) // <docs>/common/agent-scripts/lib
export const docsSystemRoot = resolve(here, '../../..') // -> <docs> root, host-independent
const defaultConfigFile = join(docsSystemRoot, 'docs-tdd.config.default.json')

// --- Domain roots (three-domain reorg indirection layer) ---
// The system splits into three internal domains under common/ (rules / lark-bot /
// engine) plus project instances (prds/). Callers must resolve those locations
// through THESE helpers, never by hand-joining docsSystemRoot, so a physical move
// flips one constant here instead of chasing scattered path joins. Values below
// point at the PRE-reorg locations, so introducing this layer is zero behavior
// change; each later phase flips exactly one line:
//   Phase 1 (engine): engineRoot   -> join(docsSystemRoot, 'common', 'engine')
//   Phase 2 (prds):   resolveProjectRoot -> join(docsSystemRoot, 'prds', projectId)
//   Phase 3 (rules):  rulesRoot     -> join(docsSystemRoot, 'common', 'rules')
export const rulesRoot = join(docsSystemRoot, 'common')
export const engineRoot = join(docsSystemRoot, 'common', 'agent-scripts')
export const prdsRoot = docsSystemRoot
export function resolveProjectRoot(projectId) {
  if (typeof projectId !== 'string' || !projectId.trim()) throw new Error('projectId is empty')
  return join(prdsRoot, projectId.trim())
}

function isInside(parent, child) {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

// Resolve a path that belongs to docs_tdd whether callers provide:
// - the physical standalone docs path,
// - a consumer-repo mount path such as apps/web/docs_tdd/PR-xxxxx/..., or
// - a docs-root-relative path such as PR-xxxxx/inbox/prd.md.
// Existing inputs are realpath-resolved so a legitimate symlink mount is accepted without
// weakening the boundary check; output paths are mapped to the physical docs root first.
export function resolveDocsPath(value, { consumerRoot, docsMountPath = 'apps/web/docs_tdd', mustExist = false } = {}) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('docs path is empty')
  const input = value.trim()
  const mountPrefix = `${docsMountPath.replace(/\/$/, '')}/`
  const absoluteMount = consumerRoot ? resolve(consumerRoot, docsMountPath) : ''
  let candidate
  if (isAbsolute(input)) {
    candidate = absoluteMount && isInside(absoluteMount, input)
      ? join(docsSystemRoot, relative(absoluteMount, input))
      : input
  } else if (input === docsMountPath || input.startsWith(mountPrefix)) {
    candidate = join(docsSystemRoot, input === docsMountPath ? '' : input.slice(mountPrefix.length))
  } else if (/^(?:PR-[^/]+|common|templates)(?:\/|$)/.test(input)) {
    candidate = join(docsSystemRoot, input)
  } else {
    candidate = resolve(consumerRoot || docsSystemRoot, input)
  }

  if (mustExist) {
    if (!existsSync(candidate)) throw new Error(`docs path does not exist: ${candidate}`)
    candidate = realpathSync(candidate)
  } else {
    candidate = resolve(candidate)
  }
  const realDocsRoot = realpathSync(docsSystemRoot)
  if (!isInside(realDocsRoot, candidate)) throw new Error(`docs path must stay inside ${realDocsRoot}: ${candidate}`)
  return candidate
}

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' })
  return r.status === 0 ? r.stdout.trim() : null
}

function expandTilde(value) {
  if (typeof value !== 'string') return value
  if (value === '~') return homedir()
  if (value.startsWith('~/')) return join(homedir(), value.slice(2))
  return value
}

// Resolve the guided project's main repo root from the git common dir. In a linked
// worktree, --git-common-dir points at the MAIN repo's .git (absolute); in the main
// repo it is relative to cwd (e.g. "../../.git"), so resolve it against the worktree.
function resolveConsumerRoot(consumerWorktree) {
  if (!consumerWorktree) return null
  const common = git(['rev-parse', '--git-common-dir'], consumerWorktree)
  if (!common) return consumerWorktree
  const abs = isAbsolute(common) ? common : resolve(consumerWorktree, common)
  return basename(abs) === '.git' ? dirname(abs) : consumerWorktree
}

// Walk up from a directory looking for docs-tdd.config.json.
function findConfigUpwards(fromDir) {
  let dir = fromDir
  while (dir) {
    const candidate = join(dir, 'docs-tdd.config.json')
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

function readJsonSafe(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}

// Discover the consumer config independent of consumerRoot (which we may still be
// resolving): explicit env override, an installation pointer at the docs repo root,
// and a walk-up from both the cwd and the consumer worktree. Later sources win.
// Missing keys always fall back to the bundled defaults, so a missing/partial config
// is zero-regression.
export function loadConfig({ cwd, consumerWorktree } = {}) {
  const defaults = readJsonSafe(defaultConfigFile)
  const envPath = process.env.DOCS_TDD_CONFIG ? resolve(process.env.DOCS_TDD_CONFIG) : null
  // Increasing priority: bundled default < docs-repo pointer < worktree walk-up < cwd walk-up < env.
  const candidates = [
    join(docsSystemRoot, 'docs-tdd.config.json'),
    consumerWorktree ? findConfigUpwards(consumerWorktree) : null,
    cwd ? findConfigUpwards(cwd) : null,
    envPath,
  ].filter(Boolean)
  let merged = { ...defaults }
  let configPath = null
  const seen = new Set()
  for (const file of candidates) {
    if (seen.has(file) || !existsSync(file)) continue
    seen.add(file)
    merged = { ...merged, ...readJsonSafe(file) }
    configPath = file
  }
  if (merged.globalAdapters) {
    merged.globalAdapters = Object.fromEntries(
      Object.entries(merged.globalAdapters).map(([key, value]) => [key, expandTilde(value)]),
    )
  }
  if (merged.consumerRoot) merged.consumerRoot = expandTilde(merged.consumerRoot)
  return { config: merged, configPath }
}

// Resolve the full root trio + config for a running script.
export function resolveRoots(opts = {}) {
  const cwd = opts.cwd || process.cwd()
  const consumerWorktree = git(['rev-parse', '--show-toplevel'], cwd)
  const { config, configPath } = loadConfig({ cwd, consumerWorktree })
  // An explicit config.consumerRoot is the authoritative binding — this is what lets a
  // script running INSIDE the docs repo (e.g. check-doc-budget with cwd=docsSystemRoot,
  // which is its own git repo) still target the real consumer instead of the docs repo.
  let consumerRoot = config.consumerRoot || null
  if (!consumerRoot) {
    const cwdConsumer = resolveConsumerRoot(consumerWorktree)
    if (cwdConsumer && cwdConsumer !== docsSystemRoot) consumerRoot = cwdConsumer
    else if (consumerWorktree && consumerWorktree !== docsSystemRoot) consumerRoot = consumerWorktree
  }
  return { docsSystemRoot, consumerRoot, consumerWorktree, config, configPath }
}

// `node lib/roots.mjs --self-test` — prints the resolved trio + config source.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const roots = resolveRoots()
  const out = {
    docsSystemRoot: roots.docsSystemRoot,
    consumerRoot: roots.consumerRoot,
    consumerWorktree: roots.consumerWorktree,
    configPath: roots.configPath || '(bundled default)',
    docsMountPath: roots.config.docsMountPath,
    baseRef: roots.config.baseRef,
  }
  console.log(JSON.stringify(out, null, 2))
  const ok = Boolean(roots.docsSystemRoot && roots.consumerRoot)
  console.log(ok ? 'roots: OK' : 'roots: INCOMPLETE')
  process.exit(ok ? 0 : 1)
}
