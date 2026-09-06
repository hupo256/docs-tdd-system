# HANDOFF: vNext Phase 7 收尾（PR-02233 浏览器证据 + 切换评审）

> 写给下一个接手的 chat。状态截至 2026-09-05。完事后删除本文档（DOC-FRESH-001 会盯根目录 HANDOFF，本文在 common/vnext/ 下也请在完成后清理）。

## 一句话现状

Phase 0–6 全绿；Phase 7 灰度 3 个样本中 **V0（PR-02074）、V1（PR-02172）已 complete**;**只剩 V2（PR-02233）批次 01 缺浏览器运行时证据**，补齐后出口翻绿 → 提测后回填 observation → `vnext-pilot.mjs --write` 翻为 `eligible-for-human-cutover-review` → 按 `PHASE8-CUTOVER.md` 走人工评审。

## 已完成（本次会话，勿重做）

1. **规则**：`common/rules/change-scope-boundary.md` §1.2 新增「docs_tdd 只交付 Web 端；App 侧由兄弟团队交付」（用户 2026-09-05 明确，类比 i18n 只作中文）。`common/vnext/README.md` 不变量区有指针。
2. **observation 回填**:`common/vnext/pilot-registry.json` 两个样本 0 漏项 / 0 假绿（用户亲述：两项目已提测，PR-02172 临近 pre）。
3. **PR-02233 批次 01 重划范围**（两份镜像必须保持同步，勿只改一处）:
   - `common/vnext/pilots/PR-02233/work-item.json`
   - `prds/PR-02233/agent/vnext-work-items/01-login-register.json`
   - 15 个 App surface(S-021/023/025/026/027/029/030/031/033/097/100/122/124/126/128）全部 `disposition: "deferred"` + reason + owner + batch=06-app-delegated;
   - 纯 App 需求 **R-030 已移出**批次 01（本来就在 `06-app-delegated.json`);
   - V2 scopeApproval 已按`createScopeApproval` 重签（aven / 2026-09-05);
   - 独立冷读审查重做完，response 持久化在 **`prds/PR-02233/agent/vnext-work-items/b01-review-response-2026-09-05.json`**(verdict pass,F-001 批次外 deferred + F-002 App 移交）。接手续跑 verify 时直接复用此文件，**不要重新"假装"做一遍审查**。
4. **测试层证据已实测 PASS**（当前 HEAD 上）:
   - `cd /Users/aven/github/PR-02233 && pnpm vitest run <8 个改动相关 test 文件>` → 8 files / 33 tests 全过；
   - `git diff --name-only d0c528ecec..HEAD -- 'apps/web/src/**/*.{ts,tsx}' | xargs pnpm exec biome check` → exit 0;
   - MSW contract:`securityVerificationContract.test.ts` + `mocks/handlers/verification.test.ts` 已含在上述 33 tests 里。
5. **浏览器证据脚本已写好**并手动用 Playwright MCP 预演过核心交互（登录→GA 校验→切换弹窗，内容/排序/脱敏/当前标记均符合）:
   - 脚本：`/Users/aven/github/PR-02233/output-tdd/playwright/pr02233-b01/run.mjs`(playwright-core + 系统 Chrome,headless);
   - **未完成**:脚本对 dev server 的 `page.goto` 连续超时（当时 MCP 浏览器内部能开同一地址，怀疑 dev server 后台进程已退出）。接手第一件事：重启 dev server 后再跑。

## 下一步操作序列

### Step 1：起 dev server（注意两个坑）

```bash
cd /Users/aven/github/PR-02233/apps/web
NEXT_PUBLIC_MSW_ENABLED=true PORT=4000 pnpm exec next dev --webpack
# 确认：curl -s -o /dev/null -w '%{http_code}' http://localhost:4000/zh-CN/login 应为 200
```

- **坑 1（Turbopack)**：该 worktree 的 `node_modules` 是指向 `../PR-02074` 的软链，Turbopack 直接 panic,**必须 `--webpack`**;dev 脚本里的 env 复制/生成步骤上次已跑过，直接调 `next dev --webpack` 即可。
- **坑 2(MSW 开关）**:worker 只在 `NODE_ENV=development 且 NEXT_PUBLIC_MSW_ENABLED=true` 时启动；`public/mockServiceWorker.js` 已存在，不用再 `msw init`。

### Step 2：跑浏览器证据脚本

```bash
cd /Users/aven/github/PR-02233/output-tdd/playwright/pr02233-b01
node run.mjs            # 默认场景 ga-email-sms(3 个已绑定方式）
```

脚本断言覆盖：R-043(默认 GA)、R-044(确认禁用守卫 + 登录成功路径）、R-033（入口在确认键下方，boundingBox 比较）、R-003/005/006/009（弹窗/副标题/脱敏/GA 文案/当前标记/排序/仅已绑定）、R-042(X 与遮罩关闭不改变当前方式）、R-007（切邮箱）、R-011（同时单方式）、R-008（邮箱/手机倒计时独立+切回保留）、R-002/R-010/R-045（注册 SMS 校验步引导文案→点引导回第一步）。

- 若 `page.goto` 再超时：先确认 4000 端口活着；不行就把 dev server 完全杀掉重启（软链 worktree 下 webpack 冷启动较慢，首页首次编译可能要 30-60s，脚本已把 goto timeout 调到 90s)。兜底：用 Playwright MCP 手动走一遍同步骤，截图留证。
- **R-004 的单一方式隐藏态**:MSW 场景由 `NEXT_PUBLIC_MSW_VERIFICATION_SCENARIO` 控制（构建期内联）。需重启 dev server 时加 `NEXT_PUBLIC_MSW_VERIFICATION_SCENARIO=single-email`，再跑 `node run.mjs single-email` 断言入口隐藏。跑完把服务切回默认场景。
- 失败路径提示：mock 的 `confirm_login` 恒成功，脚本用「码不足 6 位确认禁用」作失败路径守卫；如要更完整，可给 handlers 补一个错误分支场景（改 mocks 代码会变 HEAD/dirtyHash → 所有证据作废重跑，**建议不改**)。

### Step 3：组装 verify input 并跑出口

关键事实（全部已验证过，直接复用）:

- `sourceDocuments`:`[{ path: 'https://qfglxo2m3dc.sg.larksuite.com/docx/QaBEditNroySaGxmywFl8CwXg6d', content: <prds/PR-02233/inbox/lark-sync/prd-latest.md 全文> }]`,`currentRevision: '670'`。normalize 后 sourceSnapshot hash 必须为 `a92a5c15949a2ef1ec9e427d6f0fcb133d1eb5c09140fa16273a755424dfdbbc`（可用 `--normalize-sources` 先验算）。
- `workItem`:pilots 镜像那份（重划范围后）。
- `reviewResponse`:`prds/PR-02233/agent/vnext-work-items/b01-review-response-2026-09-05.json`。
- `discoveredSurfaces: []`、`blockers: []`、`sourceOracle` 可省略。
- `implementation`:`coveredSurfaceIds` = 全部 15 个 Web implement surface(S-020, S-022, S-024, S-028, S-032, S-034, S-101, S-118, S-119, S-120, S-121, S-123, S-125, S-127, S-129);`msw: { workerIntegrated: true, handlerIds: ['verificationHandlers'], coveredContractIds: ['AUTH-METHODS-V1','AUTH-CHANNEL-SWITCH-V1','VERIFY-COOLDOWN-V1'] }`。
- `evidence.facts`：每条都要带 **当前实测 codeFingerprint**（先跑下面的 probe 拿值，verify 时 --worktree 会复测，不一致整体 fail):
  ```bash
  node --input-type=module -e "import('/Users/aven/github/docs_tdd/common/engine/agent-scripts/lib/fingerprint.mjs').then(m=>console.log(JSON.stringify(m.codeFingerprint('/Users/aven/github/PR-02233'))))"
  ```
  事实清单（kind → requirementIds/surfaceIds 绑定）:
  | evidenceId | kind | 覆盖 | producer |
  |---|---|---|---|
  | E-B01-QUALITY | directed-quality | 全需求可空绑（V2 必需类） | command: biome check,exit 0 |
  | E-B01-CONTRACT | contract-or-scenario-tests | 同上（V2 必需类） | command: securityVerificationContract+verification handler vitest |
  | E-B01-LOGIC | pure-logic | R-004/006/007/008/009/010/011/042/043 | command: verificationMethods/policy/login vitest |
  | E-B01-COPY | copy-literal | R-002, R-005 | command: verificationCopy vitest |
  | E-B01-DOM | component-dom | R-005, R-006, R-009 | command: LoginVerificationMethodDialog/CodeVerifyModal vitest |
  | E-B01-BROWSER | browser-interaction | R-002/003/004/007/008/010/011/033/042/043/044/045 + surfaces S-020/022/024/028/032/034/101/118-121/123/125/127/129 | command: `node run.mjs && node run.mjs single-email`,exit 0 |
  | E-B01-VISUAL | visual | R-003, R-033(+surfaces S-022/S-101) | command: 截图落盘于 output-tdd/playwright/pr02233-b01/shots/,run.mjs exit 0 |
  - producer 时间戳用真实实测值；`runId` 建议 `pr02233-b01-20260906-r1`。
  - evidenceRefs 指向：测试命令本身、`run-*.log`、`shots/*.png`（相对路径即可）。
- 跑出口（失败也只读，不写状态）:
  ```bash
  cd /Users/aven/github/docs_tdd
  node common/engine/agent-scripts/vnext-verify.mjs --input <input.json> --worktree /Users/aven/github/PR-02233
  # 全绿后:
  node common/engine/agent-scripts/vnext-verify.mjs --input <input.json> --worktree /Users/aven/github/PR-02233 --write --out common/vnext/pilots/PR-02233
  ```

### Step 4：收尾

1. `node common/engine/agent-scripts/vnext-pilot.mjs --write` → PR-02233 此时只欠 observation（提测后由 aven 回填，模板见 `common/vnext/pilots/observation-template.md`)。
2. 同步更新 `prds/PR-02233/agent/vnext-work-items/README.md` 批次 01 状态行。
3. 补 `common/CHANGELOG.md` 顶部条目（vNext Phase 7 进展 + 本次规则变更，按现有「改了什么+为什么+生效边界」写法，9-04 vNext 落地也未记过账，一并补）。
4. 验证链全绿：`vnext-self-test` + `check-doc-budget` + 三个 replay；提交（不 push)。
5. 删除本 HANDOFF。

## 诚实红线（不许破）

- 不得手改 `latest-result.json` 把 failed 改 passed——resultFingerprint 完整性校验会抓到。
- work-item / 审查 response / scope approval 任何内容变化都必须重新走脚本重算 fingerprint，不能手填。
- 浏览器证据必须真实跑过；MCP 手动兜底也要留截图和日志，在 evidenceRefs 里指对。
- PR-02233 在提测回填 observation 之前，pilot 报告保持 `collecting` 是**正确状态**，不要去动 `requiredLevels` 或 minimumSamples 凑绿。

## 当前工作量评估

PR-02233 剩余 = 重启 dev server + 两个场景脚本跑通 + 组装一个 input JSON + 一次 verify --write。PR-02233 提测后的 observation 是唯一纯等待项。
