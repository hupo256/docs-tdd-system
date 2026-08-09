# 新项目编码 worktree 规则

> AI 主用。主仓只做资料/规则沉淀，业务代码在独立分支 + 独立 worktree 完成，编码前本地页面已能跑。章节号 §7 被外链引用，勿改编号。

## 1. 触发时机

满足以下且准备进 G4 前，必须先建/确认编码 worktree：① `00-feature-inventory.md` G2 scope 已确认；② `04-frontend-tasks.md` 已明确本期任务；③ 负责人确认「可开始写代码」；④ 需改业务代码/装依赖/启本地服务/跑联调。

只整理 `docs_tdd/**` 文档时不需建 worktree。

## 2. 目录、分支与端口规范

以主仓 `/Users/aven/github/fameex-web` 为例：

| 项 | 规则 | 示例 |
| --- | --- | --- |
| 主仓目录 | 保持不改业务代码 | `/Users/aven/github/fameex-web` |
| worktree 父目录 | 与主仓同级 | `/Users/aven/github` |
| worktree 目录名 | 项目编号，字母大写 | `/Users/aven/github/PR-01234` |
| 开发分支 | `feature/<PROJECT-ID>` | `feature/PR-01234` |
| 文档来源 | 主仓 `apps/web/docs_tdd` | `/Users/aven/github/fameex-web/apps/web/docs_tdd` |
| worktree 文档入口 | **必须**软链到主仓 `docs_tdd`（§6） | `/Users/aven/github/PR-01234/apps/web/docs_tdd` |

### 端口分配

`prepare-coding-worktree.mjs` 默认从 `docs-tdd.config.json.portRangeStart` 起扫描项目 README 已占用端口，选择首个空闲值，并在 worktree 验证成功后原子回写项目 README 的 `worktree`、`branch`、`port`。并行启动仍由实际端口占用检查兜底；无需人工先改注册表。

以下表仅保留历史实例，不再作为分配真值：

每个 worktree 占一个固定端口，新建前核对取下一个空闲端口。

| 项目 | worktree 路径 | 分支 | 端口 | 状态 |
| --- | --- | --- | --- | --- |
| PR-01685 | `/Users/aven/github/PR-01685` | `feature/PR-01685` | 4101 | 裸 worktree 已删，工作并入 PR-01685-1 |
| PR-01685-1 | `/Users/aven/github/PR-01685-1` | `feature/PR-01685-1` | 4101 | 已关闭（上线 2026-07-30，worktree 已回收） |
| PR-01832 | `/Users/aven/github/PR-01832` | `feature/PR-01832` | 4102 | 预留 |
| PR-01822 | `/Users/aven/github/PR-01822` | `feature/PR-01822` | 4103 | 预留 |
| PR-01988 | `/Users/aven/github/PR-01988` | `feature/PR-01988` | 4104 | 已回收（上线 2026-07-11） |
| PR-02006 | `/Users/aven/github/PR-02006` | `feature/PR-02006` | 4105 | 已关闭（上线 2026-07-01，worktree 已回收） |
| PR-PricePanel | `/Users/aven/github/PR-PricePanel` | `feature/PR-PricePanel` | 4106 | 已回收（上线 2026-07-04） |
| PR-02022 | `/Users/aven/github/PR-02022` | `feature/PR-02022` | 4107 | 已关闭（已上线，worktree 已回收） |
| PR-02074 | `/Users/aven/github/PR-02074` | `feature/PR-02074` | 4108 | 活跃（预测市场三期，2026-07-22 建）|

> **规则**：新项目取编号最小、端口最小的空闲行；已归档行保留（历史查询），状态改「已关闭」。下一个空闲端口从 4109 开始。

> **端口是环境差异，不是提交内容**：端口只通过 `PORT` 环境变量传入，**禁止**为换端口改 `package.json`/`next.config`/`.env.dev` 等 git 跟踪文件（会污染 `git status`/diff、甚至误提交 online）。见 §2.1。

禁止在主仓工作区直接改业务代码。发现主仓已有业务改动先确认来源，不得为建 worktree 擅自回滚。

## 2.1 端口与启动（不改 tracked 文件）

**背景**：`apps/web` 的 `dev` 脚本历史上 inline 硬编码 `PORT=4000`，换端口只能改 git 跟踪的 `package.json`，每个 worktree 改它都污染工作区。正解是把端口解耦为环境变量。

### 一次性基础设施改动（落 online，全员受益）

把 `package.json` 的 `dev`/`dev:test`/`dev:pre`/`dev:prod` inline `PORT=4000` 改为可覆盖：

```diff
- ... cross-env GIT_VER=$(git describe --tags --always) PORT=4000 next dev
+ ... cross-env GIT_VER=$(git describe --tags --always) PORT=${PORT:-4000} next dev
```

- `${PORT:-4000}` 由 shell 展开：不设 → 仍 4000（默认不变）；设了 → 用外部值。
- **一次性**改动，优先独立 `chore/*` 从 `origin/online` 切单独合入；也可搭一条即将上线的分支顺路带上（本次搭 `feature/PR-PricePanel`，2026-07-02 应用）。**不得混进长期开发的 feature 分支**（见 [change-scope-boundary.md](./change-scope-boundary.md)）。改完后所有 worktree 永不再动 `package.json`。

### 日常启动（改造后）

每个 worktree 只用环境变量指定端口，tracked 文件零改动：

```bash
# 在对应 worktree 仓库根执行，端口取注册表分配值
PORT=4107 pnpm dev            # 或 pnpm dev:test / dev:pre 按需
```

### 兜底（改造前 / 不用 pnpm dev 脚本）

直接调 `next dev`（读 `PORT` 环境变量，绕过脚本 inline 值），也是 `prepare-coding-worktree.mjs` verify 的做法：

```bash
cd <worktree>/apps/web
pnpm exec shx cp config/environments/.env.test .env.development.local
node scripts/pwa-clean.mjs .env.development.local && node scripts/generate-key-modules.mjs
GIT_VER=$(git describe --tags --always) PORT=4107 pnpm exec next dev
```

> `prepare-coding-worktree.mjs` 的 `--port` 只在启动/校验时传 `PORT` 环境变量，脚本本身**不写** `package.json`；任何「为换端口改 tracked 文件」的实现均属违规。

## 3. 标准命令

推荐用公共脚本，先 dry-run 再真正创建：

```bash
node apps/web/docs_tdd/common/engine/agent-scripts/prepare-coding-worktree.mjs PR-01234 --dry-run
node apps/web/docs_tdd/common/engine/agent-scripts/prepare-coding-worktree.mjs PR-01234
```

可选参数：

```bash
node apps/web/docs_tdd/common/engine/agent-scripts/prepare-coding-worktree.mjs PR-01234 --port 4001 --verify-path /zh-CN
```

脚本必须完成/检查：

1. 编号格式 `PR-xxxxx`。
2. 新分支 `feature/PR-xxxxx`，**从最新 `origin/online` 切出**（默认 `--base-ref origin/online`，切前先 `git fetch origin online`）。
3. **基线校验**：`git merge-base --is-ancestor origin/online HEAD` 通过（基线方向语义见 [git-branch-flow.md](./git-branch-flow.md) §1）；不通过即切错基线，脚本立即失败。
4. worktree 与主仓同级，目录名 `PR-xxxxx`。
5. worktree 内 `apps/web/docs_tdd` 是指向主仓的软链。
6. 依赖就绪，优先 `pnpm install --frozen-lockfile`。
7. 具备 `node`/`pnpm`/`git`。
8. `apps/web` 能启 dev server，访问指定页得 2xx HTML。
9. 页面非 404、非空 HTML、非白屏；需登录/特殊路由时至少先验 `/zh-CN` 基础页，再补目标路由。
10. 成功后自动回写项目 README frontmatter；`docs-tdd changed/gate` 必须解析到该 worktree，不能回退到主仓误扫。

脚本因网络/权限/依赖/端口/启动/404/白屏不能完成时，把原因写入 `product/06-collaboration.md`；启用 Lark 则同步发群说明阻塞。

## 4. 手动兜底命令

脚本不可用时手动执行：

```bash
cd /Users/aven/github/fameex-web
git fetch origin online
git worktree add ../PR-01234 -b feature/PR-01234 origin/online
cd ../PR-01234
# 基线校验：HEAD 必须是 origin/online 后代，否则切错基线，停止
git merge-base --is-ancestor origin/online HEAD \
  && echo "baseline OK" \
  || { echo "ERROR: feature 分支未基于 origin/online，禁止编码"; exit 1; }
rm -rf apps/web/docs_tdd
ln -s /Users/aven/github/fameex-web/apps/web/docs_tdd apps/web/docs_tdd
pnpm install --frozen-lockfile
pnpm exec shx cp apps/web/config/environments/.env.test apps/web/.env.development.local
cd apps/web
node scripts/pwa-clean.mjs .env.development.local
node scripts/generate-key-modules.mjs
GIT_VER=$(git describe --tags --always) PORT=4001 pnpm exec next dev
curl -i http://localhost:4001/zh-CN
```

> **基线铁律**：功能分支一律从最新 `origin/online` 切（见 [git-branch-flow.md](./git-branch-flow.md) §1）。`git worktree add` **必须显式带 `origin/online` 基线**，切前先 `git fetch`。不带基线时 git 从主仓当前 HEAD 切——主仓常停在 `test`/`dev`，会把他人未上线提交带进功能分支，违反单向合并铁律。

远端已有 `feature/PR-01234` 时不要强制覆盖；用已有分支建 worktree 或向负责人确认。**复用已有分支前必须跑基线校验**（`git merge-base --is-ancestor feature/PR-01234 origin/online`），不通过说明切错基线，先修再编码。

## 5. Agent 执行约束

- **基线校验是 worktree ready 前置硬条件**：进编码前确认当前分支基于最新 `origin/online`（`git merge-base --is-ancestor origin/online HEAD`，基线方向语义见 [git-branch-flow.md](./git-branch-flow.md) §1）。基线不对一律不算 ready。
- G4-G8 的业务代码修改、Biome、typecheck、test、dev server、Playwright 自测都在项目 worktree 执行。
- worktree ready = 基线校验通过 + 依赖装完 + dev server 可启 + 基础页非 404/空白；只建目录分支不算 ready。
- `docs_tdd` 以主仓为准，worktree 只软链读取，不复制新副本。
- 项目文档、通知记录、PRD 同步产物仍写主仓 `docs_tdd/prds/<PROJECT-ID>/`。
- 交付摘要写清 worktree 路径、分支名、验证命令、未完成项。
- 只做文档整理可留主仓；一旦写业务代码必须切到对应 worktree。

## 6. docs_tdd symlink 必做规则

**新建 worktree 后第一步就是挂软链**（无论是否立即启 dev server）。worktree 的 `apps/web/docs_tdd/` 默认空目录（git 不跟踪），不挂 symlink 则 Agent 读不到任何公共规则/模板/项目文档 = 盲跑。

`prepare-coding-worktree.mjs` 已自动挂链。仅手动建时需：

```bash
cd /Users/aven/github/PR-01234
rm -rf apps/web/docs_tdd           # 若已存在真实目录，先备份内容
ln -s /Users/aven/github/fameex-web/apps/web/docs_tdd apps/web/docs_tdd
```

验证：`ls apps/web/docs_tdd/README.md` 能读到即 OK。

worktree 已有真实 docs_tdd 目录时（之前手动建过子目录），不整体替换，改为逐项挂链：

```bash
src=/Users/aven/github/fameex-web/apps/web/docs_tdd
dst=/path/to/worktree/apps/web/docs_tdd
for item in "$src"/*; do
  name=$(basename "$item")
  [ ! -e "$dst/$name" ] && ln -s "$item" "$dst/$name" && echo "linked: $name"
done
```

Agent 检查点：① 基线校验通过（见 §5，方向语义见 [git-branch-flow.md](./git-branch-flow.md) §1），不过即切错基线不得编码；② `apps/web/docs_tdd/common/rules/coding-worktree.md` 可读，否则视为未就绪。

## 7. 退役 / 回收（上线后）

需求**已合入 `origin/online` 并线上验证通过**后，worktree 是完成使命的一次性脚手架，留着只是负债（跨 worktree 搜索返回陈旧副本、AI 误读过期代码、注册表变长）。**上线后回收 worktree，只保留 `docs_tdd/<PROJECT>/` 开发文档。**

> 收益定位（别高估）：对 AI 上下文/token 几乎无直接影响（worktree 文件不主动进上下文）；真正价值是代码卫生 + 防误读陈旧副本 + 注册表干净。固定收尾动作，非大杀器。

### 7.1 退役前置（全绿才能删）

1. `feature/<PROJECT-ID>` 已合入 `origin/online`（`git merge-base --is-ancestor feature/<ID> origin/online` 通过）。
2. 无未 push 提交、工作树干净。
3. worktree 内 `apps/web/docs_tdd` 确认是 **symlink**（真实文档在主仓，删目录不丢）；若是真实目录先搬回主仓。
4. 未登记残留已处理或登记（如 mock 未拆 → 要么拆要么记 `06-collaboration.md`）。

### 7.2 退役动作（用脚本，先 dry-run）

```bash
node apps/web/docs_tdd/common/engine/agent-scripts/decommission-worktree.mjs PR-01234 --dry-run
node apps/web/docs_tdd/common/engine/agent-scripts/decommission-worktree.mjs PR-01234
```

脚本做：跑 7.1 前置校验（不过即 abort，除非 `--force`）→ `git worktree remove`（**不 `rm -rf`**，避免 git 元数据孤儿）→ `git worktree prune` → 打印待手改项。

- **保留 `feature/*` 分支**（本地 + 远端不删），便于回查/补丁；只删工作树目录。
- 脚本**不代改文字文档**，退役后 Agent 按打印手动更新：① 本文件 §2 端口注册表该行状态改「已回收（上线 `<日期>`）」；② `CONTEXT.md` 项目移到「非活跃历史」并从 worktree symlink 表移除；③ 顶层 `README.md` 项目索引状态改「已上线/已关闭」；④ `docs_tdd/prds/<PROJECT-ID>/` 文档**保留**。

### 7.3 端口回收

释放端口不立即复用；注册表行保留供历史查询，状态改「已回收」。新项目仍取当前最小空闲端口（见 §2 规则）。
