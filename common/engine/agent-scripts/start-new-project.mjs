#!/usr/bin/env node

import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDocsPath, resolveProjectRoot, resolveRoots } from './lib/roots.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const { docsSystemRoot: docsRoot, consumerRoot: repoRoot, config } = resolveRoots();

const args = process.argv.slice(2);
const projectId = args[0];
const dryRun = args.includes('--dry-run');

function printHelp() {
  console.log(`usage: start-new-project.mjs <PR-01234> --prd <Lark URL or local md path> [--title <name>] [--dry-run] [--help]

Scaffold a new docs_tdd project directory with templates, frontmatter, and Lark sync scripts.

Options:
  --help     Show this help message and exit
  --prd      PRD source: Lark URL or path relative to repo root inside docs_tdd
  --title    Human-readable project title (default: <PR-ID>)
  --dry-run  Print planned files without writing`)
}

if (process.argv.includes('--help')) {
  printHelp()
  process.exit(0)
}

function readOption(name, fallback = '') {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

function fail(message) {
  console.error(`[start-new-project] ${message}`);
  process.exit(1);
}

function assertProjectId(value) {
  if (!new RegExp(`^(?:${config.projectIdPattern || 'PR-\\d{5}'})$`).test(value || '')) {
    fail('usage: start-new-project.mjs PR-01234 --prd <Lark URL or local md path> [--title <name>] [--dry-run]');
  }
}

function assertInside(parent, child, label) {
  const relative = path.relative(parent, child);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    fail(`${label} must stay inside ${parent}: ${child}`);
  }
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function rewriteTemplateLinksForProjectDoc(content) {
  return content.replaceAll('(../common/', '(../../common/').replaceAll('(../templates/', '(../../templates/');
}

async function readTemplate(templateName, fallback, replacements = {}) {
  const templatePath = path.join(docsRoot, 'templates', templateName);
  try {
    let content = await fs.readFile(templatePath, 'utf8');
    for (const [from, to] of Object.entries(replacements)) {
      content = content.replaceAll(from, to);
    }
    return content;
  } catch {
    console.warn(`[start-new-project] missing template: ${templatePath}, using fallback ${templateName}`);
    return fallback;
  }
}

async function writeFileIfMissing(filePath, content) {
  assertInside(docsRoot, filePath, 'output');
  if (existsSync(filePath)) {
    console.log(`exists: ${path.relative(repoRoot, filePath)}`);
    return;
  }
  if (dryRun) {
    console.log(`[dry-run] write ${path.relative(repoRoot, filePath)}`);
    return;
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}

async function ensureDir(dirPath) {
  assertInside(docsRoot, dirPath, 'directory');
  if (dryRun) {
    console.log(`[dry-run] mkdir ${path.relative(repoRoot, dirPath)}`);
    return;
  }
  await fs.mkdir(dirPath, { recursive: true });
}

function sourceTypeFromPrd(prd) {
  if (/larksuite\.com\/wiki\//i.test(prd)) return 'wiki';
  if (/larksuite\.com\/(docx?|docs?)\//i.test(prd)) return 'doc';
  if (/\.md($|[?#])/i.test(prd) || prd.endsWith('.md')) return 'markdown';
  return 'doc';
}

function validatePrdSource(prd) {
  if (/^https?:\/\//i.test(prd)) return;
  try {
    resolveDocsPath(prd, { consumerRoot: repoRoot, docsMountPath: config.docsMountPath, mustExist: true });
  } catch (error) {
    fail(`invalid local PRD: ${error.message}`);
  }
}

assertProjectId(projectId);

const prd = readOption('--prd');
const title = readOption('--title', projectId);
if (!prd) fail('--prd is required');
validatePrdSource(prd);

const projectDir = resolveProjectRoot(projectId);
const sourceType = sourceTypeFromPrd(prd);
const lowerProjectId = projectId.toLowerCase();
const today = new Date().toISOString().slice(0, 10);
const ruleset = JSON.parse(await fs.readFile(path.join(docsRoot, 'common/ruleset.json'), 'utf8'));
const branchName = `${config.branchPrefix || 'feature/'}${projectId}`;
const docsMountPath = config.docsMountPath || 'apps/web/docs_tdd';
const larkOutputDir = String(config.larkOutputDir || `${docsMountPath}/prds/\${projectId}/inbox/lark-sync`)
  .replaceAll('${projectId}', projectId);
const templateReplacements = {
  '<PROJECT-ID>': projectId,
  '<TICKET-ID>': projectId,
  '<TITLE>': title,
  '<需求名>': title,
  '<PRD-SOURCE>': prd,
  'YYYY-MM-DD': today,
};

const dirs = [
  projectDir,
  path.join(projectDir, 'inbox/lark-sync'),
  path.join(projectDir, 'product'),
  path.join(projectDir, 'engineering'),
  path.join(projectDir, 'evidence/ui-ux'),
  path.join(projectDir, 'agent/scripts'),
];

for (const dir of dirs) {
  await ensureDir(dir);
}

await writeFileIfMissing(path.join(projectDir, 'README.md'), `---\nprojectId: ${projectId}\nstatus: active\nstage: G0\nbranch: ${branchName}\nworktree: ""\nport: ""\nvisualFidelity: standard\nprdSource: ${prd}\nfigmaNode: ""\nlarkEnabled: false\n---\n\n# ${projectId} ${title}\n\n> 本文件顶部 YAML frontmatter 是机器可读的元数据真值源，修改后请运行 \`node ${docsMountPath}/common/engine/agent-scripts/update-project-index.mjs --write\` 刷新 PROJECTS.md。\n\n## 状态\n\n| 字段 | 值 |\n|------|-----|\n| 当前阶段 | G0 资料接收 |\n| 最新通过门禁 | |\n| 公共规则 | 继承 ../common/README.md |\n| PRD 来源 | ${prd} |\n| visualFidelity | standard |\n\n## 文档地图\n\n- product/00-feature-inventory.md\n- product/01-scope-and-phases.md\n- product/02-technical-design.md\n- product/03-api-contract.md\n- product/04-frontend-tasks.md\n- product/05-ui-and-interaction.md\n- product/06-collaboration.md\n- product/07-figma-spec.md\n- engineering/development-rules.md\n- agent/README.md\n\n## 待确认\n\n- [ ] G2 scope 确认人和日期\n- [ ] Figma / API / QA 资料是否补充\n- [ ] API 未 ready 时是否按 MSW 路线 B 落地 handler / 契约测试 / dev-only worker\n- [ ] Lark 主动通知是否启用\n- [ ] 群内 @ 应用转 task 是否启用\n`);

const featureInventoryTemplate = await readTemplate(
  'feature-inventory-template.md',
  `# Feature Inventory — ${projectId} ${title}\n\n> 规则：../../common/prd-feature-inventory.md。\n\n| 字段 | 值 |\n|------|-----|\n| 工单 | ${projectId} |\n| PRD 来源 | ${prd} |\n| Figma 主画板 | 待补 |\n| 清单维护人 | Agent |\n| G2 确认人 & 日期 | 待确认 |\n| 责任模块目录 | 待 G2 确认 |\n| visualFidelity | standard |\n\n## 功能清单\n\n| ID | PRD 来源锚点 | PRD 章节 | 功能简述 | 页面 / 路由 | Figma | 与主画板关系 | 本期 | 确认 | 任务 / 代码 |\n|----|--------------|---------|---------|------------|-------|-------------|------|------|------------|\n| F01 | 待读取 | 待读取 | 待填写 | 待确认 | 待确认 | 待确认 | 待 G2 确认 | | |\n`,
  templateReplacements,
)
const featureInventoryContent = featureInventoryTemplate
  .replace('| 工单 | |', `| 工单 | ${projectId} |`)
  .replace('| PRD 来源 | `inbox/...md` / Lark 链接 |', `| PRD 来源 | ${prd} |`)
  .replace('| 清单维护人 | |', '| 清单维护人 | Agent |')
  .replace('| visualFidelity | `standard` / `high`（高保真判定见 [component-reuse-and-visual-fidelity.md §3.0](../common/component-reuse-and-visual-fidelity.md)） |', '| visualFidelity | standard |')
const projectFeatureInventoryContent = rewriteTemplateLinksForProjectDoc(featureInventoryContent)
await writeFileIfMissing(path.join(projectDir, 'product/00-feature-inventory.md'), projectFeatureInventoryContent);

const figmaSpecContent = await readTemplate(
  '07-figma-spec-template.md',
  '# Figma Spec\n\n## Figma 来源\n\n待补。\n\n## 还原要求\n\n若要求 95% 还原，必须提供 Figma node / 截图 / 验收口径，并在 Browser / Playwright 中验证。\n',
  templateReplacements,
);

const apiContractContent = await readTemplate(
  '03-api-contract-template.md',
  '# API Contract\n\n## API 状态\n\n待确认。\n\n## Mock 策略\n\n新功能默认 MSW 路线 B；真实 API 未确认前，mock response 必须走与真实 API 相同的 schema / mapper。\n\n## 6.1 MSW 路线 B 清单（强制，G3 建，G5 切真实）\n\n| # | 检查项 | 状态 |\n|---|--------|------|\n| 1 | `src/mocks/handlers/<feature>.ts` 已覆盖 normal / empty / error / unauthorized / edge | 待填 |\n| 2 | service / hook / mapper / 组件无 `USE_MOCK` / `@mock-only` / `isMock` / mock import | 待填 |\n| 3 | handler response 通过真实 schema 契约测试 | 待填 |\n| 4 | dev-only 启动 MSW；production 不注册 handler / worker | 待填 |\n| 5 | 真实接口 ready 后，删/停 handler 即可切真实接口，业务代码 0 改动 | 待填 |\n',
  templateReplacements,
);

const contextSummaryContent = (await readTemplate(
  'context-summary-template.md',
  `# ${projectId} Context Summary\n\n> 由 \`update-context-summary.mjs\` 生成（机器版，可被脚本重写）。\n\n## Current State\n\n| 字段 | 值 |\n|------|-----|\n| 项目 | ${projectId} |\n| 当前阶段 | G0 资料接收 |\n| PRD 来源 | ${prd} |\n| 责任模块目录 | 待 G2 确认 |\n\n## Read Next\n\n1. ../../common/rule-router.md\n2. ../product/00-feature-inventory.md\n3. ../product/06-collaboration.md\n`,
  templateReplacements,
)).replace('| PRD 来源 | 待补 |', `| PRD 来源 | ${prd} |`);

const evidenceReadmeContent = await readTemplate(
  'evidence-readme-template.md',
  `# Verification Evidence — ${projectId} ${title}\n\n## Summary\n\n| 字段 | 值 |\n|------|-----|\n| 项目 | ${projectId} |\n| 阶段 | G6 / G7 / G8 |\n| 日期 | ${today} |\n| 验证人 | 待填写 |\n| 结论 | PASS / FAIL / BLOCKED |\n`,
  templateReplacements,
);

const productDocs = {
  '01-scope-and-phases.md': await readTemplate('01-scope-and-phases-template.md', '# Scope And Phases\n\n## 本期范围\n\n待 G0 / G1 根据 PRD 填写。\n\n## 不做 / 延期\n\n待 G2 确认。\n', templateReplacements),
  '02-technical-design.md': await readTemplate('02-technical-design-template.md', '# Technical Design\n\n## 复用盘点（G4 前必填）\n\n> 规则：实现前必须优先复用已有逻辑、工具、组件；相近能力先轻量封装或组合，只有明显不适配时才新建。新建必须写明不复用原因。\n\n| 类型 | 已检查位置 / 名称 | 结论 | 采用方式 | 不复用原因（仅新建时必填） |\n|------|-------------------|------|----------|----------------------------|\n| 组件 | 待检查 | 待确认 | 直接复用 / 轻量封装 / 抽公共能力 / 新建实现 | |\n| hooks | 待检查 | 待确认 | 直接复用 / 轻量封装 / 抽公共能力 / 新建实现 | |\n| services / API | 待检查 | 待确认 | 直接复用 / 轻量封装 / 抽公共能力 / 新建实现 | |\n| stores / selectors | 待检查 | 待确认 | 直接复用 / 轻量封装 / 抽公共能力 / 新建实现 | |\n| utils / formatter / mapper | 待检查 | 待确认 | 直接复用 / 轻量封装 / 抽公共能力 / 新建实现 | |\n| 历史项目实现 | 待检查 | 待确认 | 直接复用 / 轻量封装 / 抽公共能力 / 新建实现 | |\n\n## 方案\n\n待填写。\n', templateReplacements),
  '03-api-contract.md': apiContractContent,
  '04-frontend-tasks.md': await readTemplate('04-frontend-tasks-template.md', '# Frontend Tasks\n\n## 任务清单\n\n| ID | 功能 ID | 需求依据 | 任务 | 状态 | 验收证据 |\n|----|---------|----------|------|------|----------|\n| T01 | F01 | PRD sourceId | G0 完成 PRD intake 并填充功能清单 | 待办 | `agent/prd-source-manifest.json` + `00-feature-inventory.md` |\n| T02 | F01 | F01 sourceId | G2 确认 scope 后进入编码 worktree | 待办 | G2 gate |\n| T03 | F01 | API 契约 | G3 API 未 ready 时补齐 MSW handler / 契约测试 / dev-only worker 注册 | 待办 | G3 gate + `03-api-contract.md` §6.1 |\n', templateReplacements),
  '05-ui-and-interaction.md': await readTemplate('05-ui-and-interaction-template.md', '# UI And Interaction\n\n## 页面 / 路由\n\n待确认。\n\n## 状态\n\n待补充 loading / empty / error / disabled / success。\n', templateReplacements),
  '06-collaboration.md': await readTemplate('06-collaboration-template.md', '# Collaboration\n\n## 待确认\n\n| 时间 | 问题 | 影响 | 责任人 | 状态 |\n|------|------|------|--------|------|\n| 待填写 | Figma / API / QA 是否补充 | 影响 G2 / G3 / G7 | 项目负责人 | 待确认 |\n| 待填写 | API 未 ready 时的 MSW 路线 B 落地清单是否齐全 | 影响 G3 / G5 | 项目负责人 | 待确认 |\n\n## 假设\n\n暂无。\n', templateReplacements),
  '07-figma-spec.md': figmaSpecContent,
};

for (const [name, content] of Object.entries(productDocs)) {
  await writeFileIfMissing(path.join(projectDir, 'product', name), rewriteTemplateLinksForProjectDoc(content));
}

await writeFileIfMissing(path.join(projectDir, 'engineering/development-rules.md'), `# ${projectId} 开发规则\n\n继承 ../../common/README.md。本文只记录项目特殊约束，不复制公共规则。\n\n## 项目特殊约束\n\n暂无。（若本期确无特殊约束，保留本文件并写「暂无」；不要删除此文件，否则 G0 gate 会报缺失。）\n`);

await writeFileIfMissing(path.join(projectDir, 'agent/README.md'), `# ${projectId} Agent 恢复说明\n\n## 必读顺序\n\n1. ../../common/rule-router.md\n2. 执行 \`node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs context ${projectId} <SCENARIO>\`\n3. 读取命令生成的临时 context pack\n4. ./handoff-*.md（最新交接文件，若无则跳过）\n\ncontext pack 自动包含 ./context-summary.md 与场景专题；不要一次性读取整个 common。\n\n## 交接文件索引\n\n> 按 handoff-YYYY-MM-DD[-seq].md 命名；新交接产生时在此追加索引。\n\n- 暂无\n\n## Lark 能力\n\n- 主动发群消息：待确认\n- 群内 @ 应用转 task：待确认\n\n## 编码环境\n\nG2 scope 确认后，按 ../../common/coding-worktree.md 创建 feature/${projectId} 同级 worktree。\n\n## Gate 命令\n\n\`\`\`bash\nnode apps/web/docs_tdd/common/engine/agent-scripts/prd-intake.mjs ${projectId} --init --source <repo-relative-prd.md>\nnode apps/web/docs_tdd/common/engine/agent-scripts/prd-intake.mjs ${projectId} --approve\nnode apps/web/docs_tdd/common/engine/agent-scripts/verify-project-gate.mjs ${projectId} G2\nnode apps/web/docs_tdd/common/engine/agent-scripts/verify-code-rules.mjs --project ${projectId}\nnode apps/web/docs_tdd/common/engine/agent-scripts/verify-project-gate.mjs ${projectId} G6\nnode apps/web/docs_tdd/common/engine/agent-scripts/update-context-summary.mjs ${projectId} --stage G6 --write\n\`\`\`\n`);

await writeFileIfMissing(path.join(projectDir, 'agent/context-summary.md'), contextSummaryContent);
await writeFileIfMissing(path.join(projectDir, 'evidence/ui-ux/README.md'), evidenceReadmeContent);

// 不预建 gate-results.json：VERIFY-G8-001 要求它由 verify-project-gate.mjs --write 真实产出
// （含 generatedAt + tool）。开工桩文件会让 G8 证据检查形同虚设。

await writeFileIfMissing(path.join(projectDir, 'agent/rule-waivers.json'), json([]));
await writeFileIfMissing(path.join(projectDir, 'agent/project-manifest.json'), json({
  projectId,
  createdAt: today,
  rulesetVersion: ruleset.version,
  templateVersion: 2,
  pilot: { msw: true, prdIntake: true },
  gatePolicy: {
    legacyRules: 'blocking',
    currentTouchedRules: 'blocking',
  },
}));
await writeFileIfMissing(path.join(projectDir, 'agent/stage-status.json'), json({
  projectId,
  stages: {
    G5: {
      status: 'pending',
      reason: '待完成真实 API 联调，或确认本项目无 API 联调范围。',
      evidence: [],
      updatedAt: today,
    },
    G7: {
      status: 'pending',
      reason: '待收到 QA 用例后执行，或明确记录未提供 QA 用例而跳过。',
      evidence: [],
      updatedAt: today,
    },
  },
}));
await writeFileIfMissing(path.join(projectDir, 'agent/gate-history.json'), json({
  projectId,
  runs: [],
}));
await writeFileIfMissing(path.join(projectDir, 'agent/msw-manifest.json'), json({
  projectId,
  route: 'msw',
  lifecycle: 'planned',
  sourceRoot: '',
  assets: {
    handler: '',
    fixture: '',
    contractTest: '',
    registration: 'apps/web/src/mocks/browser.ts',
    workerHook: 'apps/web/src/mocks/useMockWorker.ts',
    provider: 'apps/web/src/app/[lang]/Providers.tsx',
    handlerExport: '',
  },
  endpoints: [],
  retirement: { retiredAt: '', reconciliationEvidence: '' },
}));
await writeFileIfMissing(path.join(projectDir, 'agent/assumptions.json'), json({ projectId, assumptions: [] }));
await writeFileIfMissing(path.join(projectDir, 'agent/blockers.json'), json([]));
await writeFileIfMissing(path.join(projectDir, 'agent/code-review.json'), json({
  projectId,
  reviewedAt: today,
  reviewer: 'pending',
  head: '0000000000000000000000000000000000000000',
  findings: [
    {
      id: 'CR-1',
      category: 'other',
      severity: 'high',
      summary: 'G6 code review 尚未执行',
      disposition: 'open',
      evidence: [],
    },
  ],
}));
await writeFileIfMissing(path.join(projectDir, 'agent/acceptance-results.json'), json({ projectId, head: '0000000000000000000000000000000000000000', items: [] }));
await writeFileIfMissing(path.join(projectDir, 'agent/delivery-status.json'), json({
  projectId,
  mode: 'local',
  branch: branchName,
  headSha: '',
  pullRequestUrl: '',
  evidence: [],
  note: 'G8 前更新为 pushed / merged / released；gate 会用 Git 实际状态复核。',
}));

await writeFileIfMissing(path.join(projectDir, 'agent/lark-integration.md'), `# ${projectId} Lark 集成\n\n继承 ../../common/collaboration-and-notifications.md。\n\n## 启用状态\n\n- 主动发群消息：待确认\n- 群内 @ 应用转 task：待确认\n\n## 配置路径\n\n- 自定义机器人配置：agent/scripts/${lowerProjectId}.json（本机 ignored，禁止提交密钥）\n- 通知记录：agent/notification-log.md\n`);

await writeFileIfMissing(path.join(projectDir, 'agent/notification-log.md'), `# ${projectId} 通知记录\n\n| 时间 | 门禁 | 状态 | 摘要 | 方式 | 结果 |\n|------|------|------|------|------|------|\n`);

await writeFileIfMissing(path.join(projectDir, 'agent/lark-sources.json'), json({
  projectId,
  outputDir: larkOutputDir,
  sources: [
    {
      type: sourceType,
      operation: 'read',
      name: '需求 PRD',
      url: prd,
      target: 'prd-latest.md',
    },
  ],
}));

await writeFileIfMissing(path.join(projectDir, 'agent/scripts/sync-lark-docs.mjs'), `#!/usr/bin/env node\n\nimport { runSyncLarkDocs } from '../../../../common/engine/agent-scripts/sync-lark-docs.mjs'\n\nrunSyncLarkDocs({\n  defaultConfigPath: '${docsMountPath}/prds/${projectId}/agent/lark-sources.json',\n}).catch((error) => {\n  console.error(error.message)\n  process.exit(1)\n})\n`);

await writeFileIfMissing(path.join(projectDir, 'agent/scripts/notify-lark.mjs'), `#!/usr/bin/env node\n\nimport { runNotifyLark } from '../../../../common/engine/agent-scripts/notify-lark.mjs'\n\nrunNotifyLark({\n  defaultConfigPath: '${docsMountPath}/prds/${projectId}/agent/scripts/${lowerProjectId}.json',\n}).catch((error) => {\n  console.error(error.message)\n  process.exit(1)\n})\n`);

if (!dryRun) {
  await fs.chmod(path.join(projectDir, 'agent/scripts/sync-lark-docs.mjs'), 0o755);
  await fs.chmod(path.join(projectDir, 'agent/scripts/notify-lark.mjs'), 0o755);
}

console.log(JSON.stringify({
  ok: true,
  dryRun,
  projectId,
  projectDir: path.relative(repoRoot, projectDir),
  prd,
  next: `node ${docsMountPath}/common/engine/agent-scripts/update-project-index.mjs --write`,
}, null, 2));
