# Git 分支流与合并规则

> AI 主用,**所有项目一律遵守**的公共强制规则。一句话:**功能分支是唯一真相源,只能由功能分支流向环境分支,环境分支的提交永不反向流回功能分支。** 章节号 §1/§4.1 被外链引用,勿改编号。

## 1. 分支模型

```
online ──┬─> feature/<PROJECT-ID>   （新需求，功能分支）
         └─> fix/<PROJECT-ID>       （bug 修复分支）
```

- 开新需求/修 bug:一律从**最新 `origin/online`** 切出。功能 `feature/<PROJECT-ID>`（如 `feature/PR-01685`）;修复 `fix/<PROJECT-ID>`。
- 切分支前先 `git fetch origin online`,基于 `origin/online` 创建,保证起点最新。
- **切完立即校验基线**:`git merge-base --is-ancestor origin/online HEAD`,退出码非 0 说明切错基线,必须重切,不得开始编码。（判据方向:`origin/online` 必须是 HEAD 的祖先——即 HEAD 基于最新 online;写反成 `HEAD origin/online` 会在「从陈旧本地 online 切出」这一唯一要拦的场景反而误判通过。gate `verify-project-gate.mjs` GIT-G4-002 用的就是此正确方向。）

## 2. 合并流向（关键）

功能/修复分支完成后按需分别合入各环境分支发布:

```
feature/xx  fix/xx  ➜  dev    （开发联调环境）
feature/xx  fix/xx  ➜  test   （测试环境）
feature/xx  fix/xx  ➜  pre    （预发环境）
feature/xx  fix/xx  ➜  online （生产，最终合入）
```

- 同一功能分支**分别**合入 dev/test/pre/online,是**并列的多次合并**,不是链式（不是 dev→test→pre→online）。
- 每个环境分支都直接从功能分支取内容。

## 3. 合并方向铁律（绝不可违反）

> **只能让功能分支的内容流入环境分支;绝不能让 dev/test/pre 的提交合回功能分支。**

原因:dev/test/pre 是多需求集成的「脏」环境分支,混入大量他人未上线提交。一旦它们的提交流回 `feature/<ID>`,功能分支就不再是干净、可独立合入 online 的单元,会把别人半成品一起带上生产。

因此:

- **禁止**在功能分支执行 `git merge origin/dev`、`git rebase origin/dev`、`git pull origin dev` 等把环境分支并入功能分支的操作。
- 合并动作**在环境分支上进行**,而非功能分支:

  ```bash
  # ✅ 正确：在 dev 上合入功能分支，合并提交落在 dev，feature 分支不受影响
  git fetch origin dev
  git checkout -B dev origin/dev          # 本地 dev 对齐远程
  git merge feature/<PROJECT-ID>          # 把功能分支内容并入 dev
  # …解决冲突…
  git push origin dev

  # ❌ 错误：会让 dev 的提交污染功能分支
  git checkout feature/<PROJECT-ID>
  git merge origin/dev
  ```

- 合并完成后,功能分支提交历史应与合并前**完全一致**（只多它自己的提交,无任何 dev/test/pre 提交）。

## 4. 冲突解决规则

- **MR 有冲突一律本地解决后再 push**,不依赖平台网页端在线合并/解冲突。
- 冲突解决在**环境分支**的本地合并过程进行（见 §3 正确示例）,解决完再 `git push origin <env>`。
- 冲突取舍:
  - **本需求改动的文件**（本期功能模块）:保留功能分支版本（ours/我方改动）,确保需求逻辑完整。
  - **与本需求无关的文件**（他人需求改的、环境分支比 online 新的存量文件）:取环境分支版本（theirs）,不要用功能分支旧版覆盖主线,否则把别人改动改回去。
  - **`pnpm-lock.yaml` 专项**:合入 `dev/test/pre` 时,一律以目标环境分支的 lock 为底,只增量重算本 PR 新增/更新的依赖;禁止用基于 `online` 的 feature 整份 lock 覆盖环境 lock,避免把环境已有依赖解析回滚或制造大面积冲突。
  - 无法判断归属的文件:逐个看 diff 或与对应需求负责人确认,不臆断。
- 合并前先确认功能分支基线:若 `feature/<ID>` 从最新 `origin/online` 切出,则与环境分支的冲突基本都是「环境分支比 online 新的存量差异」,按上面第二条取环境分支版本即可。

`pnpm-lock.yaml` 冲突处理推荐命令（在目标环境分支合并过程中执行,不要切回 feature）:

```bash
# 例如当前在 test 分支,正在 merge feature/<PROJECT-ID>
git checkout --ours pnpm-lock.yaml        # ours = 目标环境分支的 lock
pnpm install --lockfile-only --filter @fameex/web
git add pnpm-lock.yaml
```

## 4.1 反向污染自检（落实执行,强制）

方向铁律不能只写纸上——**每次本地做完 MR 合并/解冲突/push 后,必须机器自检功能分支没被环境分支污染**。原理:合并动作发生在环境分支上,功能分支**根本不该被动到**,所以其 SHA 必须与合并前完全一致。

**做法:合并前记录功能分支 SHA,push 环境分支后重新比对。**

```bash
# ① 开始前：记录功能分支基点
BEFORE=$(git rev-parse feature/<PROJECT-ID>)

# ② 在环境分支上完成合并 / 解冲突 / push（见 §3 正确示例）
#    全程不 checkout 功能分支、不在功能分支上 merge/rebase/pull 环境分支

# ③ 结束后：功能分支 SHA 必须没变
AFTER=$(git rev-parse feature/<PROJECT-ID>)
[ "$BEFORE" = "$AFTER" ] && echo "OK: feature 分支未被污染" \
  || { echo "❌ feature 分支被改动，疑似反向合并，立即停止并回退"; }
```

**兜底检查:功能分支相对 online 只应有自己的提交,且不含任何环境分支合并提交。**

```bash
# 功能分支领先 online 的提交——应全部是本需求自己的 commit，无他人未上线提交
git log --oneline origin/online..feature/<PROJECT-ID>

# 功能分支上不应出现把 dev/test/pre 并进来的 merge 提交（有输出即污染）
git log --oneline --merges origin/online..feature/<PROJECT-ID>
```

- 任一自检不通过（SHA 变了、出现他人提交或环境分支 merge 提交）:**立即停止 push 功能分支**,用 `git reset --hard $BEFORE` 或 `git reflog` 还原到污染前,重走 §3「在环境分支上合并」流程。
- 已误 push 被污染的功能分支:先还原本地到干净基点,再 `git push --force-with-lease origin feature/<PROJECT-ID>`（确认无他人基于该分支协作后再强推）。

## 5. 合并前检查清单

1. 功能分支工作树干净（`git status` 无未提交改动）,且已 `git push` 到 `origin/feature/<ID>`。
2. 本需求的测试/type-check/lint 全绿（见 [quality-checklist.md](./quality-checklist.md)）。
3. 真实接口/Mock 自测完成（见 [browser-e2e-mcp.md](./browser-e2e-mcp.md)）,报告落 `evidence/`。
4. `git fetch` 目标环境分支,确认基于其最新提交合并。
5. 合并、解决冲突、push 后**必须跑 §4.1 反向污染自检**:功能分支 SHA 与合并前一致、`origin/online..feature/<ID>` 无他人提交、无环境分支 merge 提交。不通过即回退重来,禁止就此 push 功能分支。

## 6. 一句话守则

- 切分支:从最新 `online` 切 `feature/xx`/`fix/xx`。
- 发布:功能分支**分别**合 dev/test/pre/online。
- 方向:**功能分支 → 环境分支,单向,永不反向**。
- 冲突:**本地解决再 push**;本需求文件取我方、无关文件取环境分支。
- 落实:合完必跑 **§4.1 反向污染自检**——功能分支 SHA 不变、无他人/环境分支提交,才算合格。

## 7. Git flow 口径

本仓库 git flow 是:从最新 `origin/online` 切出 `feature/xx` / `fix/xx`,需求开发和修复提交只落在该功能/修复分支;发布时由该分支分别合入 `dev`、`test`、`pre`、`online` 四类环境分支。

G4 的基线校验属于切分支阶段:确认新建的 `feature/xx` / `fix/xx` 起点来自当时最新 `origin/online`。进入开发阶段后,功能/修复分支就是本需求的交付单元;后续环境发布按“功能/修复分支 -> 环境分支”的流向执行。
