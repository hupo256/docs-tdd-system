# PRD Intake Evidence — PR-02273

> 富媒体逐项识别记录。事实源为 `agent/prd-source-manifest.json`；本文件为 intake 读取证据索引。读取时间 2026-08-11，PRD revision 2273。

## 读取方式

- 表格/embed：`lark-cli docs +fetch --doc-format markdown`（markdown-parse）。
- 图片（8 张）：`lark-cli docs +media-download --token <src>` 下载至 `inbox/lark-sync/assets/`，用视觉读取（local-image-vision）。
- 内嵌 sheet（存量处理）：`lark-cli sheets +cells-get`，转存 `assets/embed-006-legacy-migration.md`。

## 图片清单

| sourceId | 资产 | 内容 | 映射 |
|----------|------|------|------|
| PRD-IMG-009 | assets/img-001.png | 福利中心增强体验金卡片（改造前+红框标注改点） | F02 |
| PRD-IMG-010 | assets/img-002.png | 领取卡券弹窗（待领取，含抵扣比例/使用方式旧字段） | F03 |
| PRD-IMG-011 | assets/img-003.png | 体验金详情弹窗（目标稿：可用/使用中体验金、配资比例、失效时间） | F04 |
| PRD-IMG-012 | assets/img-004.png | C 端体验金领取记录列表（增强体验金行 -- 列） | F05 |
| PRD-IMG-013 | assets/img-005.png | 现货后台配置申请：体验金类型下拉→不抵扣类型 | F09 |
| PRD-IMG-014 | assets/img-006.png | 现货后台配置申请下半：使用规则红框（隐藏） | F09 |
| PRD-IMG-015 | assets/img-007.png | 现货后台卡券发放记录（已/剩余/到期未使用金额列） | F10 |
| PRD-IMG-016 | assets/img-008.png | 现货后台卡券使用记录（金额列，增强体验金无记录） | F11 |
