# prd-to-commit 版本记录

skill 本体在 `~/.ai-rules/skills/prd-to-commit/`（独立 git 仓库），版本即该仓库的 tag `prd-to-commit-vX.Y[.Z]`。本文件只记每个版本**改了什么、为什么、用什么证据放行**；逐轮回放数据见 [iteration-ledger.md](./iteration-ledger.md)，回放基准见 [benchmarks/replay](../../benchmarks/replay/README.md)。

## 发版纪律

- **加规则的门槛**：同类问题出现 2 次，并且能在回放中复现。
- **放行条件**：改动后至少回放受影响的基准；得分不低于上一版，且陷阱零违反。没有改善就撤回。
- **体量上限**：SKILL.md ≤150 行、≤18KB。超了先精简再加。
- **记录**：每次打 tag，在本文件顶部追加一节，并在 [iteration-ledger.md](./iteration-ledger.md) 记录回放结果（不回放的要写明原因）；同时更新根 README「现状一览」的版本列和根 CHANGELOG。未打 tag 的提交记在「未发布」一节。

## 未发布

- `fcfd23e`（2026-10-11）：Codex 沙箱里 `.git` 只读、无法提交时，改为把提交打成 bundle 交回（Codex 中出现 3 次）。只改 SKILL.md 文字，未回放；下次打 tag 时并入。

## v1.2 — 2026-10-11

浏览器核对打通。

- 新增 `scripts/browser.mjs`、`browser-sites.json`、`dev.mjs` 和 `references/browser.md`：web、admin、legacy-admin、futures-legacy-admin 四个站点用固定端口的 dev server 加专用浏览器 profile，跑真实页面，连 test 环境。
- 后台共享登录态（localStorage / window.name），legacy 代理指向 test；只读接口放行，写操作默认拦截。
- 删除已下线的 futures-admin Next 站点配置。
- 证据：四个站点完成真实页面验证。改动集中在浏览器核对：新增脚本和参考文档，并在 SKILL.md 里补了核对步骤的说明（`ccae9bd`）。没有做基准回放，放行依据是四个站点的真实页面验证。后台各页面的验证脚本细节尚未补齐。

## v1.1 — 2026-10-11（正式版）

6 个回放基准全部达标，Claude 与 Codex 两侧均通过验收。详见 [最终报告](./reports/2026-10-11-final-report.md)。

- **规则缺陷修正**：多值枚举每个值使用不同的占位；siderItems 照兄弟页面登记，只禁止篡改后端菜单数据；冷读默认在前台运行。
- **按「出现 2 次」加入的规则**：验证已有值的入口不套用新校验；规则提示与提交校验保持一致；需要口径值时先找 schema 现成字段，禁止用兄弟字段做算术；写操作成功后刷新依赖它的服务端数据；冷读的顾虑不能撤回 PRD 明确要求的改动；PRD 内部矛盾以产品方案正文为准；区分「同因」和「范围外」。
- **效率**：默认串行，只把完全独立的批次派给子 agent；第 2 轮冷读改为满足条件才跑；串行时不再单独跑批次 0 的 tsc。
- **工具**：`fetch-prd` 展开内嵌表格；`check` 对 legacy 不再假通过；`worktree` 防止与远端分支撞名；新增 `stats.mjs`；新增回放工具链。
- **撤回**：「示例值即格式标准」，因为在 PR-02265 上连续 3 轮没有改善。
- 证据：Claude 平均得分 95.3%，陷阱 0；Codex 在 PR-02022 上得 12/12，在 PR-02306 上得 7/7。未达标项：PR-02172 的 token 为 33–36M，超出 30M 目标约 15%。

## v1.0.1 — 2026-10-10

- Codex 回放 PR-02306 时踩了 T1（找回或绑定入口给已有密码套了新的强校验），据此新增「验证已有值不套新规则」。
- `stats.mjs` 修正 Codex 子代理的 token 归属。

## v1.0 — 2026-10-10（切换为默认流程）

- `~/.ai-rules` 改为 git 管理，打第一个 tag。
- 修完正式化评估列出的 P0/P1 问题，见 [正式化评估](./reports/2026-10-10-readiness.md) §3：内嵌 sheet 展开、legacy 检查不再假通过、远端分支撞名检查、stats 统计口径、后台页面跟随兄弟工程、禁止 `git stash`、大需求主会话只做协调。
- docs_tdd 入口和 Web Lite 改为指向本 skill，docs_tdd 冻结，决策见 [decisions/2026-10-10-switch-to-prd-to-commit.md](../decisions/2026-10-10-switch-to-prd-to-commit.md)。
- 证据：回归回放 PR-01930 得 15/15，但用了 44 分钟、41.4M token，效率未达标，留到 v1.1 处理。

## v0.x — 2026-10-09 ~ 10-10（预发布，未打 tag）

- **v0.1–v0.2**：极简内核，包括 SKILL.md 和 fetch-prd、worktree、check 三个脚本，共约 280 行。回放 PR-02306 得 7/7（历史 5/7），用了 3.5M token（历史 73M）；回放 PR-01930 得 10/15（与历史持平），用了 22M token（历史 208M）。
- **v0.3**：plan 依赖分批，子 agent 并行。回放 PR-01930 得 15/15，墙钟 29.6 分钟。
- 动因见 [2026-10-09 现状审计](./reports/2026-10-09-status-audit.md)。
