# 规则治理三合一分享（2026-07 ~ 08）

> 状态：已归档（只读） · 结论有效性：部分有效 · 后继：[v3.1–v3.3 实践期](../2026-09-12-v3.1-v3.3-practice/README.md)

## 一句话

一份会议分享幻灯片（单文件 HTML，浏览器打开，用方向键翻页），介绍 docs_tdd 在 v1/v2 时期做的三项规则治理：组件到 API 的架构规则、L1/L2/L3 分层统一管理 coding 规则、AI 内存与 Token 按需加载。

## 内容

| 主题 | 当时的做法 | 现在的状态 |
|---|---|---|
| 组件到 API 架构规则 | 把单链拆为「调用链 + 数据链」；五层契约表；设计前置门禁 DOC-G4-006/007；静态扫描 CODE-ARCH-003（warn-first） | 五层契约仍在 [api-and-mapper.md](../../../common/rules/api-and-mapper.md)；门禁随引擎冻结 |
| 统一管理 coding 规则 | 判据「纯手艺→L1，FameEX 锚点→L2，流程门禁→L3」；`~/.ai-rules` 软链给三个工具；effective 指纹 | **仍然有效**：分层判据见 [rule-inheritance.md](../../../common/rules/rule-inheritance.md)，L1 仍是 `~/.ai-rules/AGENT.md` 加 skills |
| AI 内存与 Token 规划 | 三级按需加载、确定性缓存、持久记忆 | 按场景加载演化为 `rule-router.md` 加 `docs-tdd context`；[2026-10-09 审计](../../prd-to-commit/reports/2026-10-09-status-audit.md)发现流程本身吃掉约一半 token，之后改用 prd-to-commit |

幻灯片里的测试计数和指纹（例如「92 Rule ID」「指纹 ac151721fade」）是当时的快照，不代表现状。

## 文件清单

| 文件 | 类型 | 内容 |
|---|---|---|
| [rule-governance-share.html](./rule-governance-share.html) | 分享幻灯片 | 原为根目录 `share/rule-governance-share.html`，自 2026-08-04 建仓起未修改 |
