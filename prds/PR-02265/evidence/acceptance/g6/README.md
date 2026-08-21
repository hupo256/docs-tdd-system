# G6 自动检查记录

## 当前 HEAD

`c1145cf26f608bf3f7f29263cf27437c0a227228`

## 已执行

| 命令 | 目标文件 / 场景 | 结果 | 备注 |
|---|---|---|---|
| `pnpm exec biome check --write --no-errors-on-unmatched ...` | 本次触达的 JS / TS / JSON | PASS | Biome 实际覆盖 3 个受支持文件；legacy Vue/部分旧目录由定向 Vitest、源码结构断言和 `git diff --check` 补充 |
| `pnpm vitest run ...` | 费率校验、两后台正数化、流水类型、signed fee、F09–F13 文案与 F13 布局 | PASS | 6 files / 38 tests |
| `pnpm --filter @fameex/web typecheck` | Web 全量类型检查 | 基线失败，本需求改动文件 PASS | 仓库仍有 196 个存量错误；`FuturesHistoryTransactionOrder/helper.ts` 及其余本需求改动文件无错误命中 |
| `node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs changed PR-02265` | 规则与变更扫描 | PASS | G5 前执行 |
| `node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs gate PR-02265 G5` | G5 联调门禁 | PASS | 0 error，1 warning，7 waived；联调结论来源仅为用户确认 |

## Review 结论

- 已修：F09 生效规则文案与 PRD 不逐字一致。
- 已修：F13 提示框位于表单顶部，现已移动到最后字段之后、modal footer 之前。
- 已修：F09–F13 缺少固定文案逐字断言；新增 6 条逐字数据集与 F13 DOM 顺序断言。
- 已修：`toPositiveAmount` 无生产调用但仍保留，现已删除函数、测试及过期交叉注释。
- 已修：`margin.ts` 空注释。
- 已处理：合并最新 `origin/online`，保留 `formatFoldDecimal` 与 `formatSignedFee` 两组测试。
- 已修：`HistoryTradeOrderList` 可空时直接索引 `tradeHisList` 导致的 TS2339；改为先用 `NonNullable` 收窄后推导列表项类型。
- 未发现新的 high / medium / low 代码 finding。

## 未完成

- 人工视觉、真实页面交互和跨页面数据显示仍等待用户按 [`../../manual-walkthrough/README.md`](../../manual-walkthrough/README.md) 走查；因此 G6 不应在人工结果回填前宣告完成。
