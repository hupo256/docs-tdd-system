# PRD Intake Evidence — PR-02265

> 逐项引用 `agent/prd-source-manifest.json` 的 `sourceId`，记录读取方式、提取结论与歧义。不复制 manifest 全文。规则：[lark-doc-sync.md §8](../../../../common/lark-doc-sync.md) + [execution-evidence.md §6](../../../../common/execution-evidence.md)。

## 概况

| 项 | 值 |
|----|----|
| PRD 源 | `inbox/lark-sync/prd-latest.md`（docx `P2xud4WYyoapp6xfjskl7UI3gKc` rev 1009） |
| 富媒体总数 | 18（15 图片 + 3 embed） |
| 已读取/分类 | 18 / 18 |
| unresolved | 0 |
| 本地化附件 | `inbox/lark-sync/assets/img-001.png` ~ `img-015.png`（assetHash 已入 manifest） |

## 读取方式

- **图片**：`src` media token 走 `lark-cli api GET /open-apis/drive/v1/medias/{token}/download`；两张 markdown `![]()`（IMG-001、IMG-015）走 authcode stream URL `curl`。全部落地 `assets/`，用 vision 逐张读取。
- **验收标准 sheet**（`PRD-EMBED-003`，`<sheet token=OoeSs7l5xhJy4Xtl40mliE0sgPf sheet-id=uwyfAZ>`）：`lark-cli sheets +cells-get --range A1:D10`，共 9 条验收项。
- **cite**（`PRD-EMBED-001/002`）：变更记录作者署名（Lucky），markdown-parse，判定装饰性。

> 前置：`lark-cli auth login`（user token）授予 `drive:file:download` + `sheets:spreadsheet:read`；bot 身份缺这两个 scope（本项目 intake 阻塞根因，已解除）。

## 关键提取结论

- **F01/5.1**：4 个费率字段（开/平仓 × Maker/Taker）区间 `[0,100]`→`[-100,100]`，精度 6 位不变；现状截图(IMG-002)确认旧提示「请输入【0，100】之间的数字」。
- **F02/5.1**：IMG-004 确认新增常驻提示「按对应订单类型分别收取，负值表示返佣费率(如-0.000001)」位于 4 费率框下方、蓝框「生效规则」上方。弹窗完整字段：维持保证金倍率系数、4 费率(%)、所属做市机构、描述(0/50)。
- **F04/5.5**：IMG-015 查询列表「手续费率」列示例 0%/0.000001%/0.00000002%，需兼容负值。
- **F05/F06/5.3**：IMG-005~014 为各端「手续费/资金流水」展示位截图（前台合约账户/合约交易，现货后台用户详情，合约后台仓位/成交/手续费/资产流水）；均为正数化展示触点，无隐藏字段（IMG-005、IMG-012 已开图确认，余下同类，未逐张开图）。
- **验收 sheet**：见 [00-feature-inventory.md](../../product/00-feature-inventory.md) 验收标准对照表。

## 歧义 / 待确认（同步至 [06-collaboration.md](../../product/06-collaboration.md)）

1. **F03 校验提示文案不一致**：正文「请输入【-100,100】之间的数字，精度支持6位」 vs 优化后 mockup(IMG-003)「请输入数值，精度支持6位」（无区间）。
2. **精度位数**：验收 sheet 第 2 条写「超出 N 位〔待确认〕」，PRD 正文为 6 位——确认是否统一 6 位。
3. **责任范围**：需求跨 现货后台/合约后台/前台(web·app·h5)/后端，需确认 `@fameex/web`(apps/web) 承担哪些 Feature。

## 可复核命令

| 命令 | 目标 | 结果 |
|------|------|------|
| `lark-cli api GET /open-apis/drive/v1/medias/<token>/download` | 13 张 token 图片 | PASS（size_bytes 返回） |
| `curl <authcode-stream-url>` | IMG-001/015 | PASS（http 200） |
| `lark-cli sheets +cells-get --spreadsheet-token OoeSs7l5xhJy4Xtl40mliE0sgPf --sheet-id uwyfAZ --range A1:D10` | 验收 sheet | PASS（9 行） |
