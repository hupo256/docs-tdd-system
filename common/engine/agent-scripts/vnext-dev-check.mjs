#!/usr/bin/env node
// Implementation-stage feedback for workflowVersion 2. It runs reviewed non-browser commands,
// reports path/surface coverage, and persists only the latest development checkpoint.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  changedCodePaths,
  codeFingerprint,
  matchesEffectiveCodeState,
  pendingCodePaths,
} from "./lib/fingerprint.mjs";
import {
  evidenceCommandRuntimeProblem,
  executeReviewedCommand,
  selectDevelopmentCommands,
} from "./lib/vnext-command-contract.mjs";
import {
  deliveryPolicyPaths,
  deliveryScopePathProblems,
  outOfScopeDeliveryPaths,
} from "./lib/vnext-delivery-scope.mjs";
import { persistVNextWorkItem } from "./lib/vnext-persistence.mjs";
import { scopeApprovalFingerprint } from "./lib/vnext-risk-route.mjs";
import {
  effectiveCoverageReview,
  sealCoverageAuditForFixture,
} from "./lib/vnext-work-item.mjs";

const DEFERRED_COMMAND_KINDS = new Set(["browser-interaction", "visual"]);

function outputTail(value, limit = 2000) {
  const text = String(value || "");
  return text.length <= limit ? text : text.slice(-limit);
}

function defaultExecute(spec, worktree) {
  return executeReviewedCommand(spec, worktree);
}

function locatorMatchesPath(locator, path) {
  const normalized = String(locator || "")
    .replaceAll("\\", "/")
    .toLowerCase();
  const normalizedPath = path.replaceAll("\\", "/").toLowerCase();
  const stem = basename(normalizedPath).replace(
    /\.(?:test\.)?[cm]?[jt]sx?$/,
    "",
  );
  const parent = basename(dirname(normalizedPath));
  return (
    normalized.includes(normalizedPath) ||
    (stem !== "index" && stem.length >= 5 && normalized.includes(stem)) ||
    (stem === "index" && parent.length >= 5 && normalized.includes(parent))
  );
}

function explicitPathCoverage(workItem, changedPaths, pathMappings = []) {
  if (!Array.isArray(pathMappings))
    throw new Error("dev-check path mappings must be an array");
  const changed = new Set(changedPaths);
  const surfaceOwners = new Map();
  for (const requirement of workItem.requirements || []) {
    if (requirement.status !== "doing") continue;
    for (const surface of requirement.affectedSurfaces || []) {
      if (surface.disposition === "implement")
        surfaceOwners.set(surface.surfaceId, requirement.requirementId);
    }
  }
  const mapped = new Map();
  for (const entry of pathMappings) {
    const path = String(entry?.path || "")
      .replaceAll("\\", "/")
      .replace(/^\.\//, "");
    if (!path || !changed.has(path))
      throw new Error(
        `path mapping is not a changed path: ${path || "<empty>"}`,
      );
    if (mapped.has(path)) throw new Error(`duplicate path mapping: ${path}`);
    if (!Array.isArray(entry.surfaceIds) || !entry.surfaceIds.length)
      throw new Error(`path mapping requires surfaceIds: ${path}`);
    const unknown = entry.surfaceIds.filter(
      (surfaceId) => !surfaceOwners.has(surfaceId),
    );
    if (unknown.length)
      throw new Error(
        `path mapping references non-doing or non-implement surfaces for ${path}: ${unknown.join(", ")}`,
      );
    const surfaceIds = [...new Set(entry.surfaceIds)].sort();
    mapped.set(path, {
      requirementIds: [
        ...new Set(surfaceIds.map((surfaceId) => surfaceOwners.get(surfaceId))),
      ].sort(),
      surfaceIds,
    });
  }
  return mapped;
}

export function parseTypecheckDiagnostics(text) {
  const diagnostics = [];
  const seen = new Set();
  const pattern =
    /(?:^|\n)([^\n()]+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s*([^\n]*)/g;
  for (const match of String(text || "").matchAll(pattern)) {
    const diagnostic = {
      file: match[1].trim().replaceAll("\\", "/").replace(/^\.\//, ""),
      line: Number(match[2]),
      column: Number(match[3]),
      code: match[4],
      message: match[5].trim(),
    };
    const key = `${diagnostic.file}:${diagnostic.line}:${diagnostic.column}:${diagnostic.code}`;
    if (!seen.has(key)) diagnostics.push(diagnostic);
    seen.add(key);
  }
  return diagnostics;
}

function diagnosticTouchesChangedPath(diagnostic, changedPaths) {
  return changedPaths.some(
    (path) =>
      path === diagnostic.file ||
      path.endsWith(`/${diagnostic.file}`) ||
      diagnostic.file.endsWith(`/${path}`),
  );
}

export function baselineAwareTypecheck({
  output,
  exitCode,
  changedPaths,
  previousSummary = null,
}) {
  const diagnostics = parseTypecheckDiagnostics(output);
  if (exitCode !== 0 && !diagnostics.length) {
    return {
      ok: false,
      baselineErrors: previousSummary?.baselineErrors ?? null,
      currentErrors: 0,
      changedPathErrors: 0,
      newErrors: null,
      baselineSource: previousSummary ? "previous-dev-check" : "unavailable",
      diagnostics: [],
      reason: "typecheck exited non-zero without parseable diagnostics",
    };
  }
  const changed = diagnostics.filter((diagnostic) =>
    diagnosticTouchesChangedPath(diagnostic, changedPaths),
  );
  const outsideChanged = diagnostics.length - changed.length;
  const baselineErrors = Number.isInteger(previousSummary?.baselineErrors)
    ? previousSummary.baselineErrors
    : outsideChanged;
  const rippleErrors = Math.max(0, outsideChanged - baselineErrors);
  const newErrors = changed.length + rippleErrors;
  return {
    ok: newErrors === 0,
    baselineErrors,
    currentErrors: diagnostics.length,
    changedPathErrors: changed.length,
    newErrors,
    baselineSource: previousSummary
      ? "previous-dev-check"
      : "initialized-current-outside-changed",
    diagnostics: diagnostics.slice(0, 20),
    reason: newErrors ? `${newErrors} typecheck regression(s) detected` : "",
  };
}

function isTypecheckCommand(command) {
  return /(?:^|\s)(?:tsc|typecheck)(?:\s|$)/i.test(command.argv.join(" "));
}

const samePaths = (left, right) =>
  JSON.stringify([...new Set(left || [])].sort()) ===
  JSON.stringify([...new Set(right || [])].sort());

export function checkpointCommitProblems({
  projectId,
  workItem,
  currentCodeState,
  changedPaths,
  baseAvailable = true,
  dependencies = {},
} = {}) {
  const problems = [];
  const matchesCode = dependencies.matchesCode || matchesEffectiveCodeState;
  if (!baseAvailable)
    problems.push(
      "configured base ref is unavailable; cannot prove the complete changed-path set",
    );
  if (workItem?.projectId !== projectId)
    problems.push("work item does not match the branch project");
  // checkpoint 提交是 WIP 中间态，不要求已经通过覆盖审查 / 独立评审 / scope 审批。
  // 这些门禁只在最终 delivery 时由 deliveryGuardProblems 统一检查。
  const devCheck = workItem?.autopilot?.lastDevCheck;
  if (!devCheck || devCheck.status !== "passed" || devCheck.ok !== true)
    problems.push("checkpoint commit requires a passing dev-check");
  if (devCheck && !matchesCode(currentCodeState, devCheck.codeState))
    problems.push(
      "current code content differs from the last passing dev-check",
    );
  if (devCheck && !samePaths(changedPaths, devCheck.pendingCommitPaths))
    problems.push(
      "staged paths differ from the dev-check pending commit paths",
    );
  if (devCheck?.unmappedPaths?.length)
    problems.push(
      `checkpoint commit has paths without requirement/surface mapping: ${devCheck.unmappedPaths.join(", ")}`,
    );
  problems.push(...deliveryScopePathProblems(workItem, changedPaths));
  return [...new Set(problems)];
}

export function developmentPreflightProblems(workItem) {
  const problems = [];
  if (workItem?.workflowVersion !== 2)
    problems.push("dev-check requires workflowVersion 2");
  if (!(workItem?.requirements || []).some((item) => item.status === "doing"))
    problems.push("dev-check requires at least one doing requirement");
  problems.push(...effectiveCoverageReview(workItem).problems);
  if (!effectiveCoverageReview(workItem).ok)
    problems.push("current scope has not passed independent review");
  if (workItem?.routing?.riskSignals?.includes("unclassified"))
    problems.push("scope/risk routing is still unclassified");
  if (
    workItem?.routing?.verificationLevel === "V2" &&
    workItem?.scopeApproval?.fingerprint !== scopeApprovalFingerprint(workItem)
  ) {
    problems.push("current V2 scope approval is missing or stale");
  }
  return [...new Set(problems)];
}

export function runDevelopmentCheck({
  workItem,
  worktree,
  baseRef = "origin/online",
  generatedAt = new Date().toISOString(),
  pathMappings = [],
  dependencies = {},
} = {}) {
  const preflightProblems = developmentPreflightProblems(workItem);
  if (preflightProblems.length)
    throw new Error(
      `development check preflight failed: ${preflightProblems.join("; ")}`,
    );
  if (!Array.isArray(pathMappings))
    throw new Error("dev-check path mappings must be an array");
  const measure = dependencies.measure || codeFingerprint;
  const listChanged = dependencies.changedPaths || changedCodePaths;
  const listPending = dependencies.pendingPaths || pendingCodePaths;
  const execute = dependencies.execute || defaultExecute;
  const before = measure(worktree, baseRef);
  if (!before?.isGitRepo || !before.headSha)
    throw new Error("dev-check requires a valid Git worktree");
  const changedPaths = listChanged(worktree, baseRef);
  const pendingCommitPaths = listPending(worktree);
  const surfaces = (workItem.requirements || []).flatMap((requirement) =>
    (requirement.affectedSurfaces || [])
      .filter(
        (surface) =>
          requirement.status === "doing" && surface.disposition === "implement",
      )
      .map((surface) => ({
        requirementId: requirement.requirementId,
        ...surface,
      })),
  );
  const inheritedMappings = (
    workItem.autopilot?.lastDevCheck?.pathCoverage || []
  )
    .filter(
      (entry) => entry.surfaceIds?.length && changedPaths.includes(entry.path),
    )
    .map((entry) => ({ path: entry.path, surfaceIds: entry.surfaceIds }));
  const explicitCoverage = explicitPathCoverage(
    workItem,
    changedPaths,
    pathMappings.length ? pathMappings : inheritedMappings,
  );
  const pathCoverage = changedPaths.map((path) => {
    const locatorMatches = surfaces.filter((surface) =>
      locatorMatchesPath(surface.locator, path),
    );
    const explicit = explicitCoverage.get(path);
    return {
      path,
      requirementIds:
        explicit?.requirementIds ||
        [
          ...new Set(locatorMatches.map((surface) => surface.requirementId)),
        ].sort(),
      surfaceIds:
        explicit?.surfaceIds ||
        [...new Set(locatorMatches.map((surface) => surface.surfaceId))].sort(),
      mappingSource: explicit ? "input" : "locator",
    };
  });
  const unmappedPaths = pathCoverage
    .filter((entry) => !entry.surfaceIds.length)
    .map((entry) => entry.path);
  const policyPaths = deliveryPolicyPaths(workItem);
  const outOfScopePaths = outOfScopeDeliveryPaths(workItem, changedPaths);
  const commandSelection = selectDevelopmentCommands(
    workItem.evidenceCommands || [],
    DEFERRED_COMMAND_KINDS,
  );
  const commands = commandSelection.commands;
  const commandResults = [];
  let typecheckSummary = null;
  for (const command of commands) {
    const commandProblem = evidenceCommandRuntimeProblem(command, worktree);
    const result = commandProblem
      ? { exitCode: 127, signal: "", stdout: "", stderr: commandProblem }
      : execute(command, worktree);
    const afterCommand = measure(worktree, baseRef);
    if (!matchesEffectiveCodeState(before, afterCommand))
      throw new Error(
        `${command.evidenceId} changed effective code content during dev-check`,
      );
    const typecheck = isTypecheckCommand(command)
      ? baselineAwareTypecheck({
          output: `${result.stdout || ""}\n${result.stderr || ""}`,
          exitCode: result.exitCode,
          changedPaths,
          previousSummary:
            workItem.autopilot?.lastDevCheck?.typecheckSummary || null,
        })
      : null;
    if (typecheck) typecheckSummary = typecheck;
    const passed = typecheck ? typecheck.ok : result.exitCode === 0;
    commandResults.push({
      evidenceId: command.evidenceId,
      kind: command.kind,
      argv: command.argv,
      result: passed ? "pass" : "fail",
      exitCode: result.exitCode,
      ...(commandProblem
        ? { evaluation: "command-preflight" }
        : typecheck
          ? { evaluation: "baseline-aware-typecheck" }
          : {}),
      ...(result.signal ? { signal: result.signal } : {}),
      ...(passed
        ? {}
        : {
            stdoutTail: outputTail(result.stdout),
            stderrTail: outputTail(result.stderr),
          }),
    });
    if (commandProblem || result.exitCode === 124) break;
  }
  const after = measure(worktree, baseRef);
  if (!matchesEffectiveCodeState(before, after))
    throw new Error("development check changed effective code content");
  const blockers = (workItem.autopilot?.implementation?.blockers || []).filter(
    (blocker) => blocker.status === "open",
  );
  const problems = [
    ...(!changedPaths.length
      ? ["no changed paths were found against the configured base"]
      : []),
    ...(!commands.length
      ? ["no reviewed non-browser development commands are configured"]
      : []),
    ...unmappedPaths.map(
      (path) =>
        `changed path has no doing requirement/implement surface mapping: ${path}`,
    ),
    ...outOfScopePaths.map(
      (path) => `changed path is outside deliveryScope.policyPaths: ${path}`,
    ),
    ...commandResults
      .filter((result) => result.result === "fail")
      .map((result) =>
        result.evaluation === "command-preflight"
          ? result.stderrTail
          : `${result.evidenceId} failed with exit code ${result.exitCode}`,
      ),
  ];
  const report = {
    schemaVersion: 1,
    projectId: workItem.projectId,
    runId: `dev-check-${generatedAt.replace(/[^0-9]/g, "").slice(0, 14)}`,
    checkedAt: generatedAt,
    status: blockers.length ? "blocked" : problems.length ? "failed" : "passed",
    ok: blockers.length === 0 && problems.length === 0,
    codeState: {
      headSha: before.headSha,
      contentHash: before.contentHash,
      dirtyHash: before.dirtyHash,
    },
    changedPaths,
    pendingCommitPaths,
    pathCoverage,
    unmappedPaths,
    pathPolicy: {
      status: policyPaths.length ? "enforced" : "not-configured",
      policyPaths,
      outOfScopePaths,
    },
    commandSelection: {
      plannedCount: (workItem.evidenceCommands || []).filter(
        (command) => !DEFERRED_COMMAND_KINDS.has(command.kind),
      ).length,
      selectedCount: commands.length,
      executedCount: commandResults.length,
      supersededCommandIds: commandSelection.supersededCommandIds,
      notRunCommandIds: commands
        .slice(commandResults.length)
        .map((command) => command.evidenceId),
    },
    commandResults,
    ...(typecheckSummary ? { typecheckSummary } : {}),
    blockers,
    problems,
  };
  return report;
}

export function applyDevelopmentCheck(workItem, report) {
  if (report?.projectId !== workItem?.projectId || report?.schemaVersion !== 1)
    throw new Error("dev-check report does not match work item");
  const next = structuredClone(workItem);
  next.autopilot = {
    ...(next.autopilot || {}),
    lastDevCheck: report,
    lastCheckpointAt: report.checkedAt,
  };
  return next;
}

export function selfTest() {
  const requirement = {
    requirementId: "R-001",
    status: "doing",
    sourceAnchors: [{ type: "text", sourceId: "SRC-1" }],
    statement: "Fix reset.",
    affectedSurfaces: [
      { surfaceId: "S-001", locator: "src/login.ts", disposition: "implement" },
    ],
    evidencePlan: [{ type: "pure-logic", runtimeRequired: false }],
    collectionSemantics: { kind: "none", expectedCount: 0 },
  };
  const base = {
    schemaVersion: 1,
    workflowVersion: 2,
    projectId: "PR-00001",
    sourceSnapshot: {
      revision: "1",
      contentHash: "source",
      sources: [{ path: "incident.md", contentHash: "source" }],
    },
    requirements: [requirement],
    requirementsAuthor: { kind: "human", id: "tester" },
    coverageAudit: { unresolved: [] },
    routing: {
      scopeClass: "local",
      riskSignals: [],
      verificationLevel: "V1",
      routerVersion: 1,
    },
    apiDependency: { mode: "no-request", reason: "local fix" },
    deliveryScope: {
      kind: "bounded-batch",
      batchId: "fix",
      includedRequirementIds: ["R-001"],
      deferred: { owner: "none", batch: "none", reason: "none" },
      policyPaths: ["src"],
    },
    evidenceCommands: [
      {
        evidenceId: "E-1",
        kind: "pure-logic",
        argv: ["node", "test.mjs"],
        requirementIds: ["R-001"],
        surfaceIds: ["S-001"],
      },
    ],
    autopilot: {
      phase: "implementing",
      implementation: { status: "in-progress", changedPaths: [] },
      repairAttempts: { code: 0, browser: 0 },
      lastCheckpointAt: "2026-09-01T00:00:00Z",
    },
  };
  const workItem = sealCoverageAuditForFixture(base);
  const code = {
    isGitRepo: true,
    headSha: "head",
    contentHash: "a".repeat(64),
    dirtyHash: "dirty",
  };
  const report = runDevelopmentCheck({
    workItem,
    worktree: "/tmp/worktree",
    generatedAt: "2026-09-12T01:02:03Z",
    dependencies: {
      measure: () => code,
      changedPaths: () => ["src/login.ts"],
      pendingPaths: () => ["src/login.ts"],
      execute: () => ({ exitCode: 0, signal: "", stdout: "pass", stderr: "" }),
    },
  });
  assert.equal(report.ok, true, JSON.stringify(report));
  assert.deepEqual(report.pathCoverage[0].surfaceIds, ["S-001"]);
  assert.equal(
    applyDevelopmentCheck(workItem, report).autopilot.lastDevCheck.runId,
    report.runId,
  );
  const selected = selectDevelopmentCommands(
    [
      {
        evidenceId: "E-file",
        kind: "pure-logic",
        argv: ["pnpm", "test", "--run", "tests/a.spec.ts"],
        requirementIds: ["R-001"],
        surfaceIds: ["S-001"],
      },
      {
        evidenceId: "E-same",
        kind: "contract-or-scenario-tests",
        argv: ["pnpm", "test", "--run", "tests/a.spec.ts"],
        requirementIds: ["R-001"],
        surfaceIds: ["S-001"],
      },
      {
        evidenceId: "E-type",
        kind: "directed-quality",
        argv: [
          "node",
          "scripts/check-touched-types.mjs",
          "--files",
          "src/login.ts",
        ],
        requirementIds: ["R-001"],
        surfaceIds: ["S-001"],
      },
      {
        evidenceId: "E-browser",
        kind: "browser-interaction",
        argv: ["node", "browser.mjs"],
        requirementIds: ["R-001"],
        surfaceIds: ["S-001"],
      },
    ],
    DEFERRED_COMMAND_KINDS,
  );
  assert.deepEqual(
    selected.commands.map((command) => command.evidenceId),
    ["E-file", "E-type"],
  );
  assert.deepEqual(selected.supersededCommandIds, ["E-same"]);
  assert.match(
    evidenceCommandRuntimeProblem(
      {
        evidenceId: "E-missing",
        kind: "pure-logic",
        argv: ["pnpm", "test", "--run", "missing-tests.spec.ts"],
      },
      "/tmp",
    ),
    /does not exist/,
  );
  const unmapped = runDevelopmentCheck({
    workItem,
    worktree: "/tmp/worktree",
    dependencies: {
      measure: () => code,
      changedPaths: () => ["src/unknown.ts"],
      pendingPaths: () => ["src/unknown.ts"],
      execute: () => ({ exitCode: 0, signal: "", stdout: "", stderr: "" }),
    },
  });
  assert.equal(unmapped.ok, false);
  assert.match(unmapped.problems.join(" "), /no doing requirement/);
  const explicitlyMapped = runDevelopmentCheck({
    workItem,
    worktree: "/tmp/worktree",
    pathMappings: [{ path: "src/unknown.ts", surfaceIds: ["S-001"] }],
    dependencies: {
      measure: () => code,
      changedPaths: () => ["src/unknown.ts"],
      pendingPaths: () => ["src/unknown.ts"],
      execute: () => ({ exitCode: 0, signal: "", stdout: "", stderr: "" }),
    },
  });
  assert.equal(explicitlyMapped.ok, true);
  assert.equal(explicitlyMapped.pathCoverage[0].mappingSource, "input");
  const baselineOutput = Array.from(
    { length: 132 },
    (_, index) => `legacy/file-${index}.ts(1,1): error TS2322: debt`,
  ).join("\n");
  const baselineTypecheck = baselineAwareTypecheck({
    output: baselineOutput,
    exitCode: 1,
    changedPaths: ["src/login.ts"],
  });
  assert.deepEqual(
    {
      baselineErrors: baselineTypecheck.baselineErrors,
      currentErrors: baselineTypecheck.currentErrors,
      newErrors: baselineTypecheck.newErrors,
      ok: baselineTypecheck.ok,
    },
    { baselineErrors: 132, currentErrors: 132, newErrors: 0, ok: true },
  );
  const regressionTypecheck = baselineAwareTypecheck({
    output: `${baselineOutput}\nsrc/login.ts(2,3): error TS2345: regression`,
    exitCode: 1,
    changedPaths: ["src/login.ts"],
    previousSummary: baselineTypecheck,
  });
  assert.equal(regressionTypecheck.newErrors, 1);
  assert.equal(regressionTypecheck.ok, false);
  const outside = runDevelopmentCheck({
    workItem,
    worktree: "/tmp/worktree",
    dependencies: {
      measure: () => code,
      changedPaths: () => ["scripts/unrelated.mjs"],
      pendingPaths: () => ["scripts/unrelated.mjs"],
      execute: () => ({ exitCode: 0, signal: "", stdout: "", stderr: "" }),
    },
  });
  assert.equal(outside.ok, false);
  assert.deepEqual(outside.pathPolicy.outOfScopePaths, [
    "scripts/unrelated.mjs",
  ]);
  const checkpointItem = { ...workItem, autopilot: { lastDevCheck: report } };
  assert.deepEqual(
    checkpointCommitProblems({
      projectId: workItem.projectId,
      workItem: checkpointItem,
      currentCodeState: code,
      changedPaths: ["src/login.ts"],
    }),
    [],
  );
  assert.match(
    checkpointCommitProblems({
      projectId: workItem.projectId,
      workItem: checkpointItem,
      currentCodeState: code,
      changedPaths: ["src/other.ts"],
    }).join(" "),
    /staged paths/,
  );
  assert.match(
    checkpointCommitProblems({
      projectId: workItem.projectId,
      workItem: {
        ...checkpointItem,
        autopilot: {
          lastDevCheck: { ...report, unmappedPaths: ["src/unknown.ts"] },
        },
      },
      currentCodeState: code,
      changedPaths: ["src/login.ts"],
    }).join(" "),
    /without requirement\/surface mapping/,
  );
  assert.match(
    developmentPreflightProblems({
      ...workItem,
      coverageAudit: {
        ...workItem.coverageAudit,
        requirementsFingerprint: "stale",
      },
    }).join(" "),
    /stale/,
  );
  console.log("vnext-dev-check self-test passed");
}

function argumentValue(flag) {
  const index = process.argv.indexOf(flag);
  return index < 0 ? "" : process.argv[index + 1] || "";
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv.includes("--self-test")) selfTest();
  else
    try {
      const projectDir = resolve(argumentValue("--project"));
      const worktree = resolve(argumentValue("--worktree"));
      const workItem = JSON.parse(
        readFileSync(join(projectDir, "work-item.json"), "utf8"),
      );
      const pathMapFile = argumentValue("--path-map");
      const pathMapInput = pathMapFile
        ? JSON.parse(readFileSync(resolve(pathMapFile), "utf8"))
        : [];
      const pathMappings = Array.isArray(pathMapInput)
        ? pathMapInput
        : pathMapInput.mappings;
      const report = runDevelopmentCheck({
        workItem,
        worktree,
        baseRef: argumentValue("--base") || "origin/online",
        pathMappings,
      });
      const persisted = persistVNextWorkItem(
        projectDir,
        applyDevelopmentCheck(workItem, report),
      );
      console.log(JSON.stringify({ ...report, persisted }, null, 2));
      process.exitCode = report.ok ? 0 : 1;
    } catch (error) {
      console.error(`vNext dev-check failed: ${error.message}`);
      process.exitCode = 2;
    }
}
