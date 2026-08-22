# Scope And Phases — PR-01930 体验金手动失效功能（重做）

> **范围裁决以 `00-feature-inventory.md` 为准**（功能清单「本期」列 + Scope 裁剪记录是唯一真相源）；本节只写范围摘要，不复述逐条 F-item 裁决。

## 本期范围

G2 已确认（用户 / 2026-07-20）：第一轮做 **F01-F13 后台核心闭环**（现货后台 · 福利中心-卡券记录 · 体验金手动失效管理）。不做国际化、不用 Figma，以 PRD 真图/白板（`inbox/prd-assets/`）为视觉真值。API 未 ready，走 MSW 路线 B 占位，真实接口到位后对账。

第二轮已确认（用户 / 2026-07-21）：追加 **F17-F23 流水枚举注入**（现货后台/C 端 web 在各资金流水/交易记录/卡券记录里加「手动失效」流水类型），只做 web 不做 app，文案口径后台记「手动失效（体验金）」、C 端记「系统回收」。逐条 F-id 的做/移出/延后裁决（含 F18/F20 随 PRD 划删移出范围、落点A 跳过、F24 延期）与确认记录见 `00-feature-inventory.md`。

## 阶段计划

| Gate | 目标 | 退出证据 |
|------|------|----------|
| G2 | Scope 定稿 | 本文件 + feature-inventory 确认人已填 |
| G3 | API/Mock 准备 | 03-api-contract MSW 路线 B 清单 |
| G4 | 编码准备 | 02-technical-design 复用盘点 + worktree |
| G6 | 自测交付 | 逐屏对齐真图 + 单测 + Browser 走查 + gate |
