# PRD Intake Evidence — PR-02273

> 富媒体逐项识别记录。事实源为 `agent/prd-source-manifest.json`；本文件为 intake 读取证据索引。初稿读取 2026-08-11（revision 2273）；**2026-08-13 因 PRD 更新重新同步 + 重跑 intake（revision 2547）**。

## 读取方式

- 表格/embed：`lark-cli docs +fetch --doc-format markdown`（markdown-parse）。
- 图片（9 张）：`lark-cli docs +media-download --token <src>` 下载至 `inbox/lark-sync/assets/`，用视觉读取（local-image-vision）。
- 内嵌 sheet（存量处理）：`lark-cli sheets +cells-get`，转存 `assets/embed-006-legacy-migration.md`。

## 图片清单

| sourceId | 资产 | 内容 | 映射 |
|----------|------|------|------|
| PRD-IMG-017 | assets/img-001.png | 福利中心增强体验金卡片（改造前+红框标注改点） | F02 |
| PRD-IMG-018 | assets/img-002.png | 领取卡券弹窗（待领取，含抵扣比例/使用方式旧字段） | F03 |
| PRD-IMG-019 | assets/img-003.png | 体验金详情弹窗（目标稿：可用/使用中体验金、配资比例、失效时间） | F04 |
| PRD-IMG-020 | assets/img-004.png | C 端体验金领取记录列表（增强体验金行 -- 列） | F05 |
| PRD-IMG-021 | assets/img-005.png | 现货后台配置申请：体验金类型下拉→不抵扣类型 | F09 |
| PRD-IMG-022 | assets/img-006.png | 现货后台配置申请下半：使用规则红框（隐藏） | F09 |
| PRD-IMG-023 | assets/img-007.png | **rev2 新增**（PM 2026-08-13 补充）：现货后台配置申请完整表单——配资比例(0,100)%+红字风险提示、使用规则「一次性使用」红框、支持收益类型等 | F09 |
| PRD-IMG-024 | assets/img-008.png | 现货后台卡券发放记录（已/剩余/到期未使用金额列） | F10 |
| PRD-IMG-025 | assets/img-009.png | 现货后台卡券使用记录（金额列，增强体验金无记录） | F11 |

## revision 2547 增量（2026-08-13 重新同步 + 重跑 intake）

> PRD 由 revision 2273 更新为 2547。已 `sync-lark-docs` 重新拉取 + `prd-intake --init` 重扫，manifest 重新 resolve 并重签 fingerprint。因 Lark 抽取为每张图注入 vision `alt`，图片 `raw` hash 变动，sourceId 顺延重编号（内容/PNG 字节未变，按 `assetHash` 桥接沿用原分类）。

| 变更类型 | delta | sourceId 映射 |
|----------|-------|---------------|
| §8.4 公式表重写 | 强平价/保证金率/爆仓价公式表改为 3 列（当前/改造后），全部 `增强体验金余额` 打删除线；「维持保证金率不计入总保证金」条删除；新增「现金余额不含体验金」「测试验证也要去掉体验金」注解 | 新 `PRD-TABLE-008`(评审记录, decorative)；PR-01319 引用 EMBED-007/008 → `PRD-EMBED-009`；新增 `PRD-EMBED-010`(FA当前强平流程整理, 参考) |
| 图片重编号 | 8 张原图 `alt` 注入致 hash 变动，按 assetHash 桥接沿用分类 | IMG-009→017, 010→018, 011→019, 012→020, 013→021, 014→022, 015→024, 016→025 |
| 新增截图 | 现货后台配置申请完整表单（含配资比例风险提示上下文、使用规则红框） | 新 `PRD-IMG-023`（img-007，F09） |
| PM 群补充逻辑 | 体验金申请配置配资比例后台不强制拦截，仅红字静态风险文案，选不可抵扣类型时配资比例字段下方展示（rev2 正文亦已含该条，逐字「请谨慎配置比例」） | F09/T09 + 03-api-contract §7 `copy.admin.rebateRatioRisk`；截图 mockup 作「合理」的逐字冲突记 06-collaboration §待确认 |
