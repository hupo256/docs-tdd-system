# PR-02265 编码交接（Coding Handoff）

> 用途：在**新 chat**接手 PR-02265 的实际编码（G4 已过，进入 coding→G5→G6）。新会话先读本文件 + `context-summary.md` + `product/02-technical-design.md`，再动手。
> 原始生成时间：2026-08-07；2026-08-10 因 Lark PRD revision 1009→1576 漂移而更新，并已按 F01~F13 重跑 G4。

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

- 阶段链：revision 1576 已重新 intake；2026-08-10 G2、G4 均重新 PASS。当前可按 F01~F13 编码。
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

**④ F05 — 前台 web 符号展示**（React）：`his_trade_list_v2.fee`、`history_position_list.tradeFee` 正常手续费负、返佣正，统一用 `formatSignedFee`（正数补 `+`、负数原样）；`get_transaction_list.amount` 直接保留后端符号，不做 `abs()`/取反。

**⑤ F06 — 后台正数化**：`apps/admin/.../userManager/other_information/i_contract_capital_flow.vue`(:50-51,159 amountClass+side) + `apps/futures-admin/.../mixin/reportManager/*`。同一正数化口径。

**F07**：后端，前端不做。

**⑥ F08~F10 — 外部做市商弹窗新增范围**
- F08：`/externalMmAccount/add|update` 保存后费率即时生效；前端保存后立即刷新，G5 用下一笔匹配交易验证服务端实际生效。
- F09/F10：`external_market_account_modal.vue` 的蓝框按合约/现货业务类型分别输出两条规则，逐字文案见 `product/04-frontend-tasks.md` T12/T13。

**⑦ F11/F12 — 会员等级白名单提示**
- 用户白名单：`apps/admin/legacy-admin/src/views/userManager/vip_level/components/userWhiteList.vue`（T14）。
- 币对白名单：`apps/admin/legacy-admin/src/views/userManager/vip_level/components/coinWhiteList.vue`（T15）。
- 两条主语不同，禁止共用错误文案。

**⑧ F13 — 合约手续费折扣提示**
- `apps/futures-admin/legacy-admin/src/viewsTemplate/futuresExchange/components/futuresFeeDiscountModal.vue` 添加/编辑弹窗表单末尾新增蓝框（T16）。

## 4. 关键决策 / 坑（务必遵守）

- **符号口径按接口区分**：Web `fee`/`tradeFee` 走 signed fee，`get_transaction_list.amount` 保留后端符号；两个 Vue 后台的 PRD 正数化触点保留 `positivizeAmount`，不得再统一套 `abs()`。
- **精度统一 6 位**（产品已确认）。
- **F03 文案以 PRD 正文为准**，弹窗 mockup(PRD-IMG-003)「请输入数值」文案作废。
- **F11/F13 也以相邻正文为准**：图片 OCR/alt 与正文存在差异，图片只决定样式和位置。
- 固定文案清单必须以 revision 1576 的 T12~T16 为准；旧交接只含 F01~F07，不能继续直接编码。
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

## 6. 联调状态

- 用户于 2026-08-21 明确确认 G5 联调已经通过。
- 本会话未取得可归档的环境地址、账号、交易 ID 或截图，因此只登记用户确认，不补造联调明细。
- 2026-08-20 后端最终字段语义已写入 `product/03-api-contract.md` 与 `engineering/frontend-followup-checklist.md`。

## 7. 环境坑（已知）

- `docs_tdd` 是软链接进 fameex-web；脚本已修复跟随软链接（prd-intake 等）。
- rule-waivers.json 的 `file` 字段若填了必须与 check.file 完全一致，否则豁免不生效——**省略 `file` 字段**按 ruleId 匹配最稳（本项目 7 条 MSW 豁免已这么做）。
- 提交 docs 改动时排除非本任务文件（如 `PR-01947/agent/notification-log.md`、根 `common/engine/agent-scripts/lark-gateway.mjs` 等他人在途改动）。
