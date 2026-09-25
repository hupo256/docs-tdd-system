#!/usr/bin/env node

import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { listProjectIds, resolveProjectRoot, resolveRoots } from './lib/roots.mjs';
import { assertSafeWorkContext } from './lib/vnext-work-context-runtime.mjs';
import { evaluateWorktreeBaseline, readProjectGitBinding } from './lib/project-status-report.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const { docsSystemRoot, consumerRoot: repoRoot, config } = resolveRoots();
const projectId = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
const skipInstall = process.argv.includes('--skip-install');
const skipVerify = process.argv.includes('--skip-verify');

function readOption(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function frontmatterValue(file, key) {
  if (!existsSync(file)) return '';
  return readFileSync(file, 'utf8').match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))?.[1]?.replace(/^['"]|['"]$/g, '').trim() || '';
}

function allocatePort() {
  const projectReadme = projectId ? join(resolveProjectRoot(projectId), 'README.md') : join(docsSystemRoot, 'README.md');
  const existing = frontmatterValue(projectReadme, 'port');
  if (/^\d+$/.test(existing)) return existing;
  const used = new Set();
  for (const name of listProjectIds()) {
    const value = frontmatterValue(join(resolveProjectRoot(name), 'README.md'), 'port');
    if (/^\d+$/.test(value)) used.add(Number(value));
  }
  let candidate = Number(config.portRangeStart || config.defaultPort || 4101);
  while (used.has(candidate)) candidate += 1;
  return String(candidate);
}

function printHelp() {
  console.log(`usage: prepare-coding-worktree.mjs <PROJECT-ID> [--dry-run] [--skip-install] [--skip-verify] [--port <port>] [--verify-path <path>] [--base-ref <ref>] [--help]

Create ${config.branchPrefix || 'feature/'}<PR-ID> worktree from the configured base ref, symlink docs_tdd, install deps, and verify dev server.

Options:
  --help          Show this help message and exit
  --dry-run       Print planned commands without running them
  --skip-install  Skip pnpm install
  --skip-verify   Skip dev server health check
  --port          Dev server port (auto-allocated from ${config.portRangeStart || config.defaultPort || 4101})
  --verify-path   Health-check URL path (default: ${config.verifyPath || '/zh-CN'})
  --base-ref      Base ref to branch from (CLI override, then project README, then ${config.baseRef || 'origin/online'})`)
}

if (process.argv.includes('--help')) {
  printHelp()
  process.exit(0)
}

function fail(message) {
  console.error(`[prepare-coding-worktree] ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const printable = [command, ...args].join(' ');
  if (dryRun) {
    console.log(`[dry-run] ${printable}`);
    return { status: 0, stdout: '', stderr: '' };
  }
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    stdio: options.capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    fail(`command failed: ${printable}`);
  }
  return result;
}

function output(command, args, cwd = repoRoot) {
  const result = spawnSync(command, args, { cwd, stdio: 'pipe', encoding: 'utf8' });
  if (result.status !== 0) {
    fail(`command failed: ${[command, ...args].join(' ')}\n${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

function tryOutput(command, args, cwd = repoRoot) {
  const result = spawnSync(command, args, { cwd, stdio: 'pipe', encoding: 'utf8' });
  if (result.status !== 0) return '';
  return result.stdout.trim();
}

const projectIdPattern = new RegExp(`^(?:${config.projectIdPattern || '(?:PR|TR)-\\d{5}'})$`);
if (!projectId || !projectIdPattern.test(projectId)) {
  fail('usage: prepare-coding-worktree.mjs <PROJECT-ID> [--dry-run] [--skip-install] [--skip-verify] [--port 4001] [--verify-path /zh-CN] [--base-ref origin/online]');
}

const port = readOption('--port', '') || allocatePort();
const verifyPath = readOption('--verify-path', config.verifyPath || '/zh-CN');
// 新 change-set 默认使用其 README 固化的基线；CLI 可显式覆盖。已有 feature/fix 不要求该基线
// 是 HEAD 祖先，但必须与所选基线有共同历史。环境分支和无共同历史仍由 worktree 安全校验拒绝。
const projectBinding = readProjectGitBinding(projectId);
const baseRef = readOption('--base-ref', '') || projectBinding.baseRef || config.baseRef || 'origin/online';

const gitRoot = output('git', ['rev-parse', '--show-toplevel']);
if (realpathSync(resolve(gitRoot)) !== realpathSync(repoRoot)) {
  fail(`script must run inside repo root ${repoRoot}, got ${gitRoot}`);
}

const parentDir = dirname(repoRoot);
const worktreeDir = projectBinding?.worktree || join(parentDir, projectId);
const branchName = projectBinding?.branch || `${config.branchPrefix || 'feature/'}${projectId}`;
const mainDocsTdd = docsSystemRoot;
const linkedDocsTdd = join(worktreeDir, config.docsMountPath);
const webDir = join(worktreeDir, config.appSubpath || 'apps/web');

console.log(`projectId: ${projectId}`);
console.log(`branch: ${branchName}`);
console.log(`base ref: ${baseRef}`);
console.log(`worktree: ${worktreeDir}`);
console.log(`docs_tdd link: ${linkedDocsTdd} -> ${mainDocsTdd}`);
console.log(`verify url: http://localhost:${port}${verifyPath}`);

for (const command of ['git', 'node', 'pnpm']) {
  run(command, ['--version'], { capture: true });
}

// 更新配置基线，供新分支创建和已有 worktree 的共同历史校验使用。
const [baseRemote, ...baseBranchParts] = baseRef.split('/');
const baseBranch = baseBranchParts.join('/');
if (baseRemote && baseBranch) {
  run('git', ['fetch', baseRemote, baseBranch]);
} else {
  run('git', ['fetch', '--all', '--prune']);
}

if (!existsSync(worktreeDir)) {
  const localBranches = output('git', ['branch', '--list', branchName]);
  if (localBranches) {
    // 已存在同名本地分支：校验其基线是否落在 baseRef 上，避免复用一条切错基线的旧分支。
    const sharesHistoryWithBase =
      spawnSync('git', ['merge-base', baseRef, branchName], { cwd: repoRoot }).status === 0;
    if (!sharesHistoryWithBase) {
      fail(
        `local branch ${branchName} shares no history with ${baseRef}. ` +
          `Per git-branch-flow.md §1 feature branches must fork from ${baseRef} lineage (not dev/test). ` +
          `Delete/rename the stale branch, then re-run.`,
      );
    }
    run('git', ['worktree', 'add', worktreeDir, branchName]);
  } else {
    run('git', ['worktree', 'add', worktreeDir, '-b', branchName, baseRef]);
  }
} else {
  console.log(`worktree directory exists: ${worktreeDir}`);
  const existingRoot = tryOutput('git', ['rev-parse', '--show-toplevel'], worktreeDir);
  const existingBranch = tryOutput('git', ['branch', '--show-current'], worktreeDir);
  const matchesWorktreeRoot =
    existingRoot && realpathSync(resolve(existingRoot)) === realpathSync(worktreeDir);
  if (!matchesWorktreeRoot || existingBranch !== branchName) {
    fail(`${worktreeDir} exists but is not on ${branchName}; got root=${existingRoot || 'unknown'} branch=${existingBranch || 'unknown'}`);
  }
}

// 基线校验：须与 baseRef 有共同历史；不要求 HEAD 包含最新 online（online 正常前进不算失败）。
if (!dryRun) {
  const baseline = evaluateWorktreeBaseline(worktreeDir, baseRef);
  if (!baseline.ok) {
    fail(
      `baseline check failed: ${baseline.note} ` +
        `Per git-branch-flow.md §1 fix the branch base before coding.`,
    );
  }
  if (baseline.severity === 'warn') console.log(`baseline note: ${baseline.note}`);
  else console.log(`baseline check passed: HEAD shares history with ${baseRef}`);
  const workItemFile = join(resolveProjectRoot(projectId), 'work-item.json');
  const workItem = existsSync(workItemFile) ? JSON.parse(readFileSync(workItemFile, 'utf8')) : { workflowVersion: 2, projectId };
  assertSafeWorkContext({
    projectId,
    workItem,
    worktree: worktreeDir,
    baseRef,
    commitMode: 'no-commit',
    actionId: 'prepare-coding-worktree',
    targetPaths: [],
  });
}

if (dryRun) {
  console.log(`[dry-run] ensure symlink ${linkedDocsTdd} -> ${mainDocsTdd}`);
} else {
  mkdirSync(dirname(linkedDocsTdd), { recursive: true });
  if (existsSync(linkedDocsTdd)) {
    const stat = lstatSync(linkedDocsTdd);
    if (stat.isSymbolicLink()) {
      const currentTarget = resolve(dirname(linkedDocsTdd), readlinkSync(linkedDocsTdd));
      if (currentTarget !== mainDocsTdd) {
        rmSync(linkedDocsTdd);
      }
    } else {
      fail(`${linkedDocsTdd} exists and is not a symlink; move it before continuing`);
    }
  }
  if (!existsSync(linkedDocsTdd)) {
    run('ln', ['-s', mainDocsTdd, linkedDocsTdd], { cwd: worktreeDir });
  }
}

if (skipInstall) {
  console.log('skip install: --skip-install');
} else {
  run('pnpm', ['install', '--frozen-lockfile'], { cwd: worktreeDir });
}

async function waitForHealthyPage(url, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      const html = await response.text();
      if (response.status === 404) {
        lastError = `HTTP 404 from ${url}`;
      } else if (!response.ok) {
        lastError = `HTTP ${response.status} from ${url}`;
      } else if (!html.trim() || !html.includes('<body')) {
        lastError = `blank or invalid HTML from ${url}`;
      } else {
        return;
      }
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 3000));
  }
  fail(`dev server verification failed: ${lastError}`);
}

async function assertPortFree(url) {
  try {
    const response = await fetch(url);
    if (response.status) {
      fail(`port ${port} already serves ${url}; choose another --port to avoid verifying the wrong dev server`);
    }
  } catch {
    // Expected: no server is listening before we start this worktree's dev server.
  }
}

async function verifyDevServer() {
  const url = `http://localhost:${port}${verifyPath}`;
  if (skipVerify) {
    console.log('skip dev server verification: --skip-verify');
    return;
  }
  if (dryRun) {
    console.log('[dry-run] prepare apps/web env from config/environments/.env.test');
    console.log(`[dry-run] start dev server: pnpm exec next dev with PORT=${port}`);
    console.log(`[dry-run] verify non-404 non-blank page: ${url}`);
    return;
  }
  await assertPortFree(url);
  run('pnpm', ['exec', 'shx', 'cp', 'config/environments/.env.test', '.env.development.local'], { cwd: webDir });
  run('node', ['scripts/pwa-clean.mjs', '.env.development.local'], { cwd: webDir });
  run('node', ['scripts/generate-key-modules.mjs'], { cwd: webDir });
  const gitVer = output('git', ['describe', '--tags', '--always'], worktreeDir);
  const child = spawn('pnpm', ['exec', 'next', 'dev'], {
    cwd: webDir,
    env: { ...process.env, GIT_VER: gitVer, PORT: port },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  try {
    await waitForHealthyPage(url);
    console.log(`dev server verified: ${url}`);
  } finally {
    child.kill('SIGTERM');
  }
}

await verifyDevServer();

function updateProjectMetadata() {
  const readme = join(resolveProjectRoot(projectId), 'README.md');
  if (!existsSync(readme)) fail(`project README missing: ${readme}`);
  if (dryRun) {
    console.log(`[dry-run] update README frontmatter worktree=${worktreeDir} port=${port} branch=${branchName} baseRef=${baseRef}`);
    return;
  }
  let text = readFileSync(readme, 'utf8');
  const update = (key, value) => {
    const line = `${key}: ${JSON.stringify(String(value))}`;
    const pattern = new RegExp(`^${key}:.*$`, 'm');
    if (pattern.test(text)) {
      text = text.replace(pattern, line);
      return;
    }
    const branchPattern = /^branch:.*$/m;
    if (!branchPattern.test(text)) fail(`README frontmatter missing branch: ${readme}`);
    text = text.replace(branchPattern, (branchLine) => `${branchLine}\n${line}`);
  };
  update('worktree', worktreeDir);
  update('port', port);
  update('branch', branchName);
  update('baseRef', baseRef);
  writeFileSync(readme, text);
  console.log(`project metadata updated: ${readme}`);
}

updateProjectMetadata();

console.log('coding worktree is ready');
