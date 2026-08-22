<!-- template-version: 1 -->
<!-- template-effective-since: 2026-07-23 -->

# Scope And Phases — <PROJECT-ID> <TITLE>

## 本期范围

> 范围裁决（做/不做/延期）与裁剪明细的**唯一真相源是 `00-feature-inventory.md`**（功能清单「本期」列 + Scope 裁剪记录）。本节只写一段本期范围摘要，**不复述 per-F 裁决、不设结论列**，避免口径漂移。

待 G0 / G1 根据 PRD 写一段本期做什么的摘要；逐条 F-item 裁决见 `00-feature-inventory.md`。

## 阶段计划

| Gate | 目标 | 进入条件 | 退出证据 |
|------|------|----------|----------|
| G0 | 资料接收 | PRD 可读 | `00-feature-inventory.md` 初稿 |
| G2 | Scope 定稿 | 范围、责任模块、visualFidelity 已确认 | G2 确认人 & 日期 |
| G4 | 编码准备 | 复用盘点完成 | 技术方案无待检查 |
| G6 | 自测交付 | 实现完成 | `evidence/` 自测报告 + `/code-review` 处理结论 |
