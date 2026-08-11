<!-- template-version: 1 -->
<!-- template-effective-since: 2026-07-23 -->

# Verification Evidence — PR-02273 增强体验金改为保证金模式

## Summary

| 字段 | 值 |
|------|-----|
| 项目 | PR-02273 |
| 阶段 | G6 / G7 / G8 |
| 日期 | 2026-08-11 |
| 验证人 | 待填写 |
| 结论 | PASS / FAIL / BLOCKED |

## Command Evidence

| 命令 | 目标文件 / 场景 | 结果 | 备注 |
|------|-----------------|------|------|
| `pnpm exec biome ...` | 触达 JS/TS/JSON | PASS / FAIL / 未覆盖 | 若输出 `0 files`，补 `node --check` / 专项脚本 |
| `node apps/web/docs_tdd/common/engine/agent-scripts/verify-code-rules.mjs --project PR-02273` | 本次改动文件 | PASS / FAIL | findings 已修 / 已登记豁免 |
| `node apps/web/docs_tdd/common/engine/agent-scripts/verify-project-gate.mjs PR-02273 G6` | 项目 gate | PASS / FAIL | 阻塞项见下表 |

## Browser / UI Evidence

| 页面 / 场景 | URL | 视口 / 主题 | 操作步骤 | 结果 |
|-------------|-----|-------------|----------|------|
| 待填写 | 待填写 | desktop / 390px, dark / light | 待填写 | PASS / FAIL / BLOCKED |

## Code Review Evidence

| 时间 | 命令 | findings | 处理结论 | 备注 |
|------|------|----------|----------|------|
| 待填写 | `/code-review` | 待填写 | 已修 / 豁免 / 不适用 | 同步到 `product/06-collaboration.md` |

## Blockers / Risks

| 项 | 影响 | 责任人 | 下一步 | 状态 |
|----|------|--------|--------|------|
| 无 | | | | |
