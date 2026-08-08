# PR-02265 编码交接（Coding Handoff）

> 用途：在**新 chat**接手 PR-02265 的实际编码（G4 已过，进入 coding→G5→G6）。新会话先读本文件 + `context-summary.md` + `product/02-technical-design.md`，再动手。
> 生成时间：2026-08-07。分支/文档均已提交（docs 仓库 `dev` 分支，最新 commit `8321fcd`）。

## 0. 新 chat 如何恢复（照做）

1. 工作目录/脚本一律从 **`/Users/aven/github/fameex-web`** 跑（`apps/web/docs_tdd` 是指向 `/Users/aven/github/docs_tdd` 的软链接）。
2. 读路由与本项目场景：
   ```bash
   cd /Users/aven/github/fameex-web
   node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs context PR-02265 g4_coding_worktree
   ```
3. 代码在 **worktree**：`/Users/aven/github/PR-02265`，分支 `feature/PR-02265`（基线 `origin/online`），dev 端口 `4101`。**所有代码改动在这个 worktree 里做**，不要在主 checkout 改。
4. 读 `apps/web/docs_tdd/prds/PR-02265/product/02-technical-design.md`（改点 file:line 全在里面）和 `03-api-contract.md`。

## 1. 当前状态

- 阶段链：G0✅ G1✅ G2✅ G3✅ **G4✅**（`docs-tdd gate` 均 PASS；G3/G4 各 waived=6 = MSW 豁免，正常）。
- 未写任何业务代码；worktree 干净。
- 下一步：**按 02-technical-design §方案 分片编码**，先做第一片。

## 2. 技术栈事实（关键，别搞错）

| App | 栈 | 承载 |
|-----|----|------|
| `apps/admin/legacy-admin` | **Vue2 + Element UI** | F01/F02/F03/F04 + F06(现货后台展示) |
| `apps/futures-admin/legacy-admin` | **Vue2** | F06(合约后台展示) |
| `apps/web` | React/TS + heroui | F05(前台 web 展示) |

接口全部**已存在、复用现状、仅放开负值**。**MSW 已豁免**（不用 mock，直连 test 后端 + 纯函数单测）。

## 3. 编码分片顺序 + 精确改点（file:line 相对 worktree）

**① F01/F03 — 合约费率放开负值（先做这片）**
文件：`apps/admin/legacy-admin/src/views/operateManager/marketMakerAccount/external_market_account_modal.vue`
- `FEE_MIN`（:282）`0` → `-100`；`FEE_MAX` 保持 `100`。
- `isValidFuturesFeeValue`（:572）正则 `/^\d+(\.\d{1,6})?$/` → `/^-?\d+(\.\d{1,6})?$/`；范围沿用 `num>=FEE_MIN && num<=FEE_MAX`。
- `sanitizeFuturesFeeInput`（:548）保留首位负号（照现货侧 `sanitizeSpotFeeInput`:524 现成模式），精度仍 `slice(0,6)`。
- `handleFeeInput` 非法字符（:897）futures 分支 `/[^\d.]/` → `/[^\d.\-]/`。
- 校验失败文案统一「请输入【-100,100】之间的数字，精度支持6位」（**以 PRD 正文为准**）。
- **抽纯函数 + 单测**：负值、边界 `±100`、6 位精度、超 6 位截断、多负号、非法、空值。
- 参照物：**现货侧 `isValidSpotFeeValue`(:563) 已支持负号**（`/^-?\d+/`+`Math.abs`），合约侧对齐它即可。

**② F02 — 常驻提示文案**（同弹窗）：4 费率输入框下方加「按对应订单类型分别收取，负值表示返佣费率(如-0.000001)」。

**③ F04 — 列表负值显示**：`market_maker_account.vue` `formatExternalFee`(:1563)，确认负号拼接/列宽正常。

**④ F05 — 前台 web 正数化**（React）：`apps/web/src/utils/formatNumber.ts`（抽正数化纯函数）+ `apps/web/src/apps/Futures/components/FuturesOrders/FundsFlow/index.tsx`(:24 formatAmount)、`PositionHistory/Card.tsx`(:171 tradeFee)、`CashFlow/futures/FuturesCashFlow.tsx`。返佣（负金额）取绝对值+正号，不出负号。复用 `UpOrDownText`。

**⑤ F06 — 后台正数化**：`apps/admin/.../userManager/other_information/i_contract_capital_flow.vue`(:50-51,159 amountClass+side) + `apps/futures-admin/.../mixin/reportManager/*`。同一正数化口径。

**F07**：后端，前端不做。

## 4. 关键决策 / 坑（务必遵守）

- **正数化口径是跨 3 app 的副本**（React/Vue2×2 无法共享代码）：口径 `符号 + |金额|`、返佣不出负号，必须三处**各自补单测**保证一致（见 02 技术方案「单一事实源」表）。
- **精度统一 6 位**（产品已确认）。
- **F03 文案以 PRD 正文为准**，弹窗 mockup(PRD-IMG-003)「请输入数值」文案作废。
- 固定文案**逐字** PRD 原文 + 「值===原文」字面断言测试；apps/web 开发期只改 zh-CN。
- Vue admin 非 TS/zod/React Query 体系，别套 apps/web 的 schema/mapper 规则；F05 React 侧才走那套（但本次复用现状请求链，不新增 hook/schema）。

## 5. 门禁 / 命令速查（从 /Users/aven/github/fameex-web 跑）

```bash
# 改代码后（无自动 hook）
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs changed PR-02265
# 阶段门禁
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs gate PR-02265 G5   # 联调
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs gate PR-02265 G6   # review + biome/tsc/vitest
```
- G6 会实跑 biome/tsc/vitest，findings 必须清零或登记 waiver。
- Lark 素材需重拉时：`lark-cli auth login`（user token，drive/sheets scope），图片走 `drive/v1/medias/{token}/download`。

## 6. 待确认（新 chat 需向负责人/后端拿）

1. **test 后端环境信息**（负责人说「有」，本会话未录入）——用于 G5 联调验证负费率账户配置→成交→返佣展示全链路。**新 chat 第一件事问负责人要**，按下方模板填入本节：
   ```
   环境地址(现货后台):
   环境地址(前台web):
   登录账号/权限:
   已配置的负费率做市账户(现货UID/合约UID):
   触发负费率成交的方式:
   后端"放开负值"是否已部署: 是/否
   ```
2. **后端「放开负值」是否已部署**（否则前端配负值会被后端拒）。见 03-api-contract §8 #1。
3. A4/A5 前台/后台流水接口真实 path + 金额/side 字段名（编码时从现有代码确认）。

## 7. 环境坑（已知）

- `docs_tdd` 是软链接进 fameex-web；脚本已修复跟随软链接（prd-intake 等）。
- rule-waivers.json 的 `file` 字段若填了必须与 check.file 完全一致，否则豁免不生效——**省略 `file` 字段**按 ruleId 匹配最稳（本项目 7 条 MSW 豁免已这么做）。
- 提交 docs 改动时排除非本任务文件（如 `PR-01947/agent/notification-log.md`、根 `common/engine/agent-scripts/lark-gateway.mjs` 等他人在途改动）。
