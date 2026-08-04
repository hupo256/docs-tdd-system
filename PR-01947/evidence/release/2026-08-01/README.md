# PR-01947 环境发布核验

> 核验时间：2026-08-01。目的：区分“dev/test 部署与提测”和“pre/online 生产发布”。

## 结论

- PR-01947 **已部署到 dev/test 并进入真实 API 联调、提测**。
- PR-01947 **未进入 pre/online，因此尚未生产上线**。
- 项目继续保持 `status: active`、`stage: G4`、G5 blocked；不得因测试环境可访问而关闭归档。

## Git 证据

| 检查 | 结果 | 结论 |
|------|------|------|
| `git fetch origin online feature/PR-01947 --prune` | `origin/online=c5d5ef2dbc`，`origin/feature/PR-01947=f4a2bc6f18` | 使用 2026-08-01 最新远端引用 |
| `git branch -r --contains feature/PR-01947` | 无 `origin/online` / `origin/pre` | feature 分支未整体合入生产线 |
| `git cherry -v origin/online feature/PR-01947` | 33 个项目提交全部为 `+` | online 不含这些提交的等价 patch |
| `git branch -r --contains af9dcf3a02` | 包含 `origin/dev`、`origin/test`，不含 pre/online | Web API 实现进入测试环境 |
| `git branch -r --contains 2fedbedd8e` | 包含 `origin/dev`、`origin/test`，不含 pre/online | F19 后台字段修复进入测试环境 |
| `git branch -r --contains f4a2bc6f18` | 包含 `origin/test`、`origin/feature/PR-01947` | 最新远端表单改造只进入 test |

## 代码存在性证据

对特征符号 `FollowParamsSelectTriangle`、`CUSTOM_LEVERAGE_MAX`、`customLeverageRange` 执行分支内容搜索：

| 分支 | 命中特征文件数 |
|------|----------------|
| `origin/online` | 0 |
| `origin/pre` | 0 |
| `origin/dev` | 8 |
| `origin/test` | 8 |
| `feature/PR-01947` | 7 |

这排除了“feature 没合入，但功能已由其他提交在 online 重新实现”的解释。

## 误解来源

- 提交历史包含多条 `add node for deploy`，实际用于部署联调/测试节点。
- `product/03-api-contract.md` 明确记录“后端已部署 dev”“dev 接口确认字段”。
- `product/14-self-test-cases.md` 的用途是“提测、联调与人工验收”。

因此此前口语中的“上线”应准确改写为：**已部署测试环境并提测，未生产上线**。
