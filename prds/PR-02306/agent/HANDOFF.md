# HANDOFF — PR-02306 注册登录密码规则修改

> 交接给下一个 chat。目标：把 docs_tdd 流程从 **G6（进行中/BLOCK）** 推到 G8 收尾。代码已写完并提交，剩下的是 G6 三个门禁项 + 一个待决策点。
> 生成时间：2026-08-18。

## 0. TL;DR（下一个 chat 先做什么）

1. **先决策 [§4 待决策点]**：`VERIFY-TYPE-001` 因 `constants/regex.ts` 里一处**既有** TS1501（`/gu` flag）被归因到改动文件而 FAIL。要么接受「拆分到新文件让 regex.ts 不进 changed 集」（但违背 G2「并入 regex.ts」决策，需用户点头），要么给该既有错误登记 waiver，要么顺手修掉那行 `u` flag。**这是唯一卡住 G6 的机器事实项，必须先定方向。**
2. 跑真实 code review，改写 `agent/code-review.json`（清掉占位 CR-1，`head` 改 `90caf1fa94`）。
3. 填 `agent/acceptance-results.json`（F01/F02/F03 验收结果 + 证据，`head` 改 `90caf1fa94`）。
4. 重跑 `gate PR-02306 G6`，绿了继续 `G7`（QA 用例，stage-status 已预置 pending，可标 not-applicable）→ `G8`。

## 1. 需求与关键决策（已确认，勿重开）

- PRD：https://qfglxo2m3dc.sg.larksuite.com/wiki/KCyhwSvN7idfRCkTbI9lhZUNgbd
- 内容：密码允许特殊字符从 `@ $ ! % * # ? & - . = ( ) , /` **新增** `^ _ + [ ] { }`，合并为 `@$!%*#?&-.=(),/^_+[]{}`。长度 8-20、字母必填、**数字必填保持不变**。更新规则展示文案。排查所有前端密码场景一致。
- 用户明确：**小改动、前端可闭环、不需要后端**；注意封装/重用。
- G2 已确认决策：
  - 数字必填**保留**。
  - 文案**展示完整字符列表**：`至少1个特殊符号（{{chars}}）`，`chars` 从单一源插值。
  - 单一源**并入现有 `apps/web/src/constants/regex.ts`**（不新建文件）。← 注意这条与 §4 决策点相关。
  - 在**主仓 `feature/PR-02306`** 继续（不用独立 worktree）。
- i18n：**本地只改简体中文 zh-CN**，其余语种交国际化团队（用户中途明确要求，已回退误改的 en-US/zh-TW）。

## 2. 代码改动（已完成，已提交为 `90caf1fa94 feat: add files by opus`）

仓库 `/Users/aven/github/fameex-web`，分支 `feature/PR-02306`，工作树 clean。

- `apps/web/src/constants/regex.ts` —— **单一事实源**：
  - 新增 `PASSWORD_SPECIAL_CHARS='@$!%*#?&-.=(),/^_+[]{}'`（可读展示串）、私有 `PASSWORD_SPECIAL_CLASS='@$!%*#?&.=(),/^_+\\[\\]{}-'`（正则字符类，`][` 转义、`^` 不置首、`-` 置末）。
  - 派生 `passwordPattern`、`passwordAllowedCharPattern`、`PASSWORD_SPECIAL_RE`、`PASSWORD_LETTER_RE`、`PASSWORD_DIGIT_RE`、`PASSWORD_MIN_LENGTH=8`、`PASSWORD_MAX_LENGTH=20`。
  - **删除死代码 `export const PASSWORD`**（无引用，且旧值含 `&-.` 误当范围的 bug）。
- `apps/web/src/apps/Register/common/const.ts` —— `export { passwordPattern } from '@/constants/regex'`（re-export 保持 4 个消费者 import 路径不变）；`TEMP_SPECIALS = PASSWORD_SPECIAL_CHARS`。
- `apps/web/src/apps/Register/RegisterV2/CreatePassword.tsx` —— 删本地 `ALLOWED_SYMBOL_RE/DIGIT_RE/LETTER_RE/MIN_LENGTH/MAX_LENGTH`，改用单一源；`passwordRule.special` 的 `t()` 传 `{ chars: PASSWORD_SPECIAL_CHARS }`。
- `apps/web/src/constants/regex.test.ts` —— 追加 12 条密码单测（逐符号放行含新增 `^ _ + [ ] { }`、字母/数字/特殊三者缺一必挂、非法字符拦截、长度 7/8/20/21 边界、登录过滤保留新符号）。**全绿**。
- `apps/web/src/i18n/locales/zh-CN/register.json` —— `passwordRule.special` 改 `至少1个特殊符号（{{chars}}）`。

消费者一致性（F03）：`Login/InputAccount.tsx`（`passwordAllowedCharPattern`）、`ResetPassword/ResetForm.tsx`、`SetLoginPassword/index.tsx`、`UpdatePassword/index.tsx`（均 `passwordPattern`，经 const.ts re-export）全部间接指向单一源。全仓 `grep '@$!%*#?&'` 已仅剩单一源，无残留副本。

### 验证结论（已实测）
- `pnpm exec vitest --run apps/web/src/constants/regex.test.ts` → **12 passed**。
- 全项目 tsc：**基线 271 = 改动后 271，delta 0**（改动文件本身零新增类型错误；唯一命中的是既有 `/gu` 行，见 §4）。
- `biome check` 4 文件 → 通过。
- `CODE-ARCH-003` warn（`CreatePassword.tsx:21` import `@/services/api/registerV2`）是**改动前就有**的 mutation hook 导入，因文件进 changed 集被 globalScan 扫到，warn-first 非阻断，与本次无关。

## 3. docs_tdd 流程进度

引擎在本仓 `/Users/aven/github/docs_tdd`，命令：`node common/engine/agent-scripts/docs-tdd.mjs <cmd> PR-02306 [...]`。项目文档在 `prds/PR-02306/`。

- **G0–G4：PASS**。
- **G5：PASS**（`stage-status.json` G5 标 `not-applicable`：纯前端无 API 联调）。
- **G6：BLOCK**（fail=3）。
- coding rule session 已建（scenario `g4_coding_worktree`）；`changed PR-02306` 之前 PASS。若 session 过期报 `VERIFY-RULE-002`，重跑 `context PR-02306 g4_coding_worktree`。
- G3 的 `DOC-G3-006/007`（MSW N/A）已在 `agent/rule-waivers.json` 登记豁免（owner 用户，至 2026-09-18），后续门禁会一直显示 waived=1，正常。

### G6 剩余 BLOCK 项
1. `VERIFY-TYPE-001`（error）→ 见 §4 决策点。
2. `DOC-CR-002`（error）：`agent/code-review.json` 还是占位 `CR-1(other) disposition=open`。需跑真实 review、清理 findings（修/waive/标 N/A），`reviewer` 改实名、`head` 改 `90caf1fa94`。
3. `DOC-AC-002`（error）：`agent/acceptance-results.json` 的 `items` 为空，缺 F01/F02/F03 验收结果。`head` 改 `90caf1fa94`。
   - 验收标准见 `product/00-feature-inventory.md` §验收标准对照；证据可引用单测（regex.test.ts 12 passed）+ 手测（登录粘贴含新符号不被过滤、注册清单勾选、重置/设置/修改提交、随机密码生成）。
4. warn（非阻断，可选清）：`CODE-MOCK-001` 责任模块目录未填精确路径；`DOC-CR-003`/`DOC-AC-006` head 全零不一致（改 head 后即消）。

## 4. ⚠️ 待决策点：VERIFY-TYPE-001 / regex.ts 的既有 TS1501

- 现象：`verify-build-quality` 报 `apps/web/src/constants/regex.ts:22 TS1501 This regular expression flag is only available when targeting 'es6' or later`。
- 真相：这是 `export const chainAddressDisallowedCharPattern = /[\s<>"'\`\p{C}]/gu` 的 `u` flag，**既有代码**（改动前在 line 9），我把密码单一源加在它上方使其移到 line 22。全仓多处同类（`CopyTrading/helper.ts`、`sanitizeName.ts`）都有此错，是 tsconfig target 低于 ES2015 的仓库级历史问题。
- 为什么卡：`VERIFY-TYPE-001` 按**文件级**归因——只要 tsc 错误落在「本次改动文件」里就报 error。我动了 regex.ts，于是这条既有错误被算进来。`VERIFY-TYPE-002`（存量基线）已 PASS（改动外 270 ≤ 基线 270）。
- 三个候选处置（**建议按此顺序评估，需要时问用户**）：
  1. **登记 waiver**（最省、最诚实）：给 `VERIFY-TYPE-001` 在 `agent/rule-waivers.json` 加豁免，理由「regex.ts:22 TS1501 为既有 `/gu` flag 历史问题，本次改动 delta=0（基线 271=改动后 271），非本 PR 引入」。**注意先确认该 rule 是否 `waivable`**（若 `rule.waivable===false` 会报 DOC-WAIVER-004 失效）——机器事实层的 rule 有可能不可豁免，需实测。
  2. **顺手修掉那行**：把 `chainAddressDisallowedCharPattern` 的 `u` flag 去掉并改写 `\p{C}` 为等价非 Unicode 写法（会略微改变语义，需谨慎，且超出本需求范围——不推荐，除非用户同意）。
  3. **拆分到新文件**：把密码单一源移到新 `apps/web/src/constants/passwordRule.ts`，并让 `passwordAllowedCharPattern` 也搬过去、Login 改从新文件 import，使 **regex.ts 完全不进 changed 集**。这样 TS1501 不再被归因。**但违背 G2「并入 regex.ts」决策**，需用户重新拍板；且要同步改 `02-technical-design.md`、`04-frontend-tasks.md` 的单一源位置描述。

我倾向 **候选 1（waiver）**：改动 delta 为 0，问题客观上不是本 PR 引入，waiver 是 docs_tdd 为这种情况提供的正规出口。

## 5. 命令备忘

```bash
cd /Users/aven/github/docs_tdd
node common/engine/agent-scripts/docs-tdd.mjs status PR-02306
node common/engine/agent-scripts/docs-tdd.mjs gate PR-02306 G6
# 若 session 过期：
node common/engine/agent-scripts/docs-tdd.mjs context PR-02306 g4_coding_worktree
# 单测（在 fameex-web 根跑，配置 include 是 apps/**）：
cd /Users/aven/github/fameex-web && pnpm exec vitest --run apps/web/src/constants/regex.test.ts
# 机器事实层单独跑：
cd /Users/aven/github/fameex-web && node /Users/aven/github/docs_tdd/common/engine/agent-scripts/verify-build-quality.mjs --project PR-02306
```

- 环境坑：macOS 无 `timeout` 命令（用会 exit 127）；tsc 要在 `apps/web` 目录跑或用 `pnpm --filter web typecheck`；vitest 要在**仓库根**跑（include glob 是 `apps/**`）。
