# PR-02006 Collaboration

## 已完成

| 时间 | 事项 | 结论 |
|------|------|------|
| 2026-06-20 | Lark PRD 同步 | 成功，同步到 `inbox/lark-sync/prd-latest.md`，并提取 `prd-content.md` |
| 2026-06-20 | 规则继承检查 | 已读公共规则，已对照 PR-01988；暂无需新增 common 的通用规则 |
| 2026-06-20 | 代码基线初查 | 已定位 TradFi / Markets / Futures MarketList / Header 相关现有模块 |
| 2026-06-20 | 用户 | 初始 G2 确认：F01-F23 全部本期做；API 未齐前 mock-first；Admin 本期同做；先按 PRD 原型开发；正式 UI 后补；Lark 通知不启用；数据先 Mock | Codex |
| 2026-06-20 | Web Mock 自测 | `pnpm install` 修复本地依赖链接，清理 `.next/dev` 修复 Next dev 子路由 manifest；`/api/tradfi/public-info` 200（17 个合约，TradFi section），`/zh-CN/tradfi`、`/zh-CN/markets/tradfi`、`/zh-CN/markets/swap`、`/zh-CN/swap/E-BTC-USDT` 均 200；TradFi 纯函数单测 37/37 通过，Biome 通过 |
| 2026-06-20 | 浏览器自测替代 | 内置浏览器连接失败（`node_repl` 缺 `sandboxPolicy` 元数据）；已补跑 `MarketList` 相关单测（List / Sorter / section tabs）并用 HTTP SSR 验证关键路由 200，后续浏览器能力恢复后再补真实 hover / H5 / 主题矩阵截图 |
| 2026-06-20 | TradFi 落地页排序补齐 | 补齐 24h 成交额 UI 模型 / formatter / 默认成交额倒序；高价、低价表头接入三态排序 icon 和排序逻辑；`pnpm exec vitest run src/apps/TradFi/common/market.test.ts src/apps/TradFi/common/format.test.ts --root apps/web` 38/38 通过；`pnpm exec biome check --write --no-errors-on-unmatched <touched TradFi files>` 通过；`pnpm --filter @fameex/web typecheck` 被既有非 PR-02006 类型错误阻断 |
| 2026-06-20 | Mock / 真实 API 开关校准 | 修正 `shouldUseTradFiMock`：有 `NEXT_PUBLIC_ENV_NAME` 时按 env name 决定，`dev/test` 走 mock，`pre/prod` 即使在本地 dev server 也走真实 API；无 env name 的本地开发仍走 mock；`pnpm exec vitest run src/apps/TradFi/common/env.test.ts src/apps/TradFi/common/market.test.ts src/apps/TradFi/common/format.test.ts --root apps/web` 41/41 通过；Biome 通过 |
| 2026-06-22 | 阶段同步 | 当前 PR-02006 已完成 G4 Web/Admin 实现与 G6 定向自测；最新提交 `ea8c24750 feat: PR-02006 tradfi market experience`，worktree 干净；下一阶段为 G7 QA / 真实 API / 正式 UI 联调准入 | Codex |
| 2026-06-22 | 合约后台 YApi 对齐 | 已登录 YApi project `467`，拉取接口 `4750/4753/4756/4759`；本地快照落到 `inbox/yapi/`，整理文档落到 `product/api/admin-contract-coin.md`；Admin TradFi 保存字段对齐为 `type=2` + `coinAliasI18nList` | Codex |

## 待确认项

| ID | 类型 | 问题 | 影响 | 建议责任人 |
|----|------|------|------|------------|
| N01 | G2 scope | 本仓范围为 F01-F23，包含 legacy admin 币种编辑页 F19-F21；允许 mock-first | 已确认，后台项需保留并随本期提交 | 用户 / 2026-06-20 |
| N02 | 验收 | PRD §七 是嵌入 sheet，当前同步未展开；需提供 sheet 导出或验收明细 | G6/G7 无法逐项验收 | 产品 / QA |
| N03 | UI | 正式 UI 后期补，当前先按 PRD 原型链接和截图实现 | 已确认；正式 UI 后续差异再补 | 用户 / 2026-06-20 |
| N04 | API | API 文档没有，数据先 Mock；真实字段后续联调校准 | 已确认 mock-first；真实 API 待后端 | 用户 / 后端 |
| N05 | Admin | Admin F19-F21 要求本期同做，当前由 legacy admin 币种编辑页承接 | YApi 已确认并接入：TradFi 保存走合约后台 `/add_config_coin_sub`、`/edit_config_coin_sub` | 用户 / Admin FE / 后端 |
| N06 | Lark | Lark 通知不启用 | 已确认；人工同步 | 用户 / 2026-06-20 |

## PRD / Figma / API 差异

| 项 | PRD | 当前资料 | 处理 |
|----|-----|----------|------|
| UI 正式地址 | 需求 List 中 UI 地址为空 | 只有原型链接与文档截图 | 已确认先按原型做，正式 UI 后补 |
| 验收标准 | §七 嵌入 sheet | Markdown 同步只保留 sheet token | 待补导出 |
| Web + H5 | 明确多语言、H5 都需要处理 | 缺 H5 UI 细节 | G2 确认后按现有响应式规则补 |
| Admin 多语言 | PRD 6.1 明确后台配置 | 当前 `coin_manager_edit.vue` 已新增归属板块、TradFi 多语言别名区域、动态语言列表、失焦/保存必填校验与提交字段 | 用户 2026-06-21 确认后台功能属于本需求，保留并随 PR-02006 提交 |
| 自测路由 | PRD 涉及 `/markets/tradfi` 和交易页弹层 | 清理 `.next/dev` 前 Next dev manifest 未识别子路由导致 404；清理后路由恢复 | 记录为本地缓存问题；后续继续真实浏览器交互矩阵 |

## Lark 协作决策

| 能力 | 当前状态 | 说明 |
|------|----------|------|
| Lark 文档同步 | 已启用 | 只读同步成功 |
| 主动发群消息 | 不启用 | 本期人工同步 |
| 群内 @ 应用转 task | 未启用 | 需要另接 Lark 应用事件订阅 + Bot Gateway |

## 当前门禁

G6 已完成：本仓范围 F01-F23 已实现并提交 `ea8c24750`，包含 legacy admin 币种编辑页 F19-F21。进入 G7 前仍需 QA sheet / 正式 UI / 真实 API 与 Admin 字段联调。

## 2026-06-20 Admin 审计记录

- PRD 6.1 指向【合约管理后台】-【合约配置】-【币种】-【添加或编辑】。
- 当前仓库 `apps/admin/legacy-admin/src/router/index.js` 中 `/contract_transaction` 通过 `window.open(`${Api.contract}/#/login`, token)` 跳转到 `VUE_APP_FUTURES_API_ORIGIN`，没有合约配置币种编辑源码。
- 当前仓库可定位到的 `coin_manager_edit.vue` 属于交易配置-币币交易-币种配置，只存在普通“币种别名”，不包含 `TradFi` / `归属板块` / `symbolTag` / `sectionIds` / 多语言别名配置。
- 2026-06-21 重新核对：当前 `coin_manager_edit.vue` 改动与 PRD 6.1 的归属板块、多语言别名和必填校验一致，应保留。

## 2026-06-21 范围确认

- 用户确认：PR-02006 确实有后台功能，不能漏掉。
- 当前本仓完成判断覆盖 Web/Header/交易页/行情页/落地页、Admin F19-F21 和 mock-first / real API switch 预留。

## 2026-06-22 阶段同步

- 当前阶段：G6 自测完成，等待 G7 QA / 联调准入。
- 代码状态：`feature/PR-02006` 最新提交 `ea8c24750 feat: PR-02006 tradfi market experience`，worktree 干净。
- 已验证：Biome touched files 通过；PR-02006 定向 Vitest 通过（5 files / 46 tests）；历史 Web 定向单测与 headless Chrome evidence 已记录。
- 未关闭风险：PRD §七嵌入 sheet 明细未展开；正式 UI 地址为空；合约后台接口需真实环境联调；全量 typecheck 被范围外既有错误阻断。

## 2026-06-22 合约后台 API 对齐

- YApi 获取：已重新登录 `http://35.240.211.100:3333/project/467/interface/api` 并拉取更新后的 `configCoinList`、`add_config_coin_sub`、`edit_config_coin_sub`、`getConfigCoinList`。
- 本地沉淀：原始 JSON 快照在 `inbox/yapi/`；整理后的开发文档在 `product/api/admin-contract-coin.md`。
- 字段结论：`configCoinList` 的 response 在备注中，列表数据为 `data.pageInfo.rows`；归属板块使用 `type`（1 默认 / 2 TradFi），TradFi 多语言别名使用 `coinAliasI18nList[{ coin, langKey, content }]`。
- 接入结论：币种列表走 `/config_coin_list`；TradFi 新增 / 编辑走合约后台域名 `VUE_APP_FUTURES_API_ORIGIN` 的 `/add_config_coin_sub`、`/edit_config_coin_sub`。

## 2026-06-22 Admin API 自测

- YApi 登录与接口拉取：成功，接口快照已保存到 `inbox/yapi/`。
- 文档完整性：`product/api/admin-contract-coin.md` 已覆盖 `/add_config_coin_sub`、`/edit_config_coin_sub`、`type=1/2`、`coinAliasI18nList`。
- 代码静态契约：脚本校验通过，确认 TradFi 新增/编辑切换到合约后台接口，字段映射包含 `type`、`coinAliasI18nList`、`overviewManualList`。
- 语法解析：`digitalDigitalTrade.js` 与 `coin_manager_edit.vue` script 均通过 Node `new Function` 解析。
- Biome：`pnpm exec biome check --write --no-errors-on-unmatched <admin touched files>` 返回 0，但当前 Biome 未匹配 `.js/.vue` 文件（输出 `Checked 0 files`）。
- Admin typecheck：`pnpm --filter @fameex/admin exec tsc --project ./tsconfig.json --noEmit --pretty false` 超过 35 秒未返回，已按“卡住重试/不干等”原则中止；未得到 PR-02006 相关诊断。

## 2026-06-23 合约后台 API 更新自测

- YApi 更新版已重新拉取；`configCoinList` 的 response 从备注中解析，确认列表结构为 `data.pageInfo.total` + `data.pageInfo.rows[]`。
- 文档已更新：`product/api/admin-contract-coin.md` 补充 `/config_coin_list` 请求体与备注 response 样例；`inbox/yapi/` 快照已覆盖更新版 JSON。
- 接入已更新：币种列表走合约后台 `/config_coin_list`；新增/编辑走 `/add_config_coin_sub`、`/edit_config_coin_sub`；编辑回显兼容 `coinAliasI18nList`。
- 静态自测通过：API JS 与两个 Vue script 均可解析；关键契约 token（`data.pageInfo.rows`、`type=1/2`、`coinAliasI18nList`、三条接口路径）均命中。
- Biome 命令返回 0，但 legacy `.js/.vue` 未被当前 Biome 配置匹配（`Checked 0 files`）。
