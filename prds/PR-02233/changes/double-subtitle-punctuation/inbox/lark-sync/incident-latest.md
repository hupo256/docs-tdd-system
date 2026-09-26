---
sourceName: "缺陷报告"
sourceType: "markdown"
sourceUrl: "/Users/aven/github/docs_tdd/prds/PR-02233/inbox/double-subtitle-punctuation-2026-09-26.md"
syncedAt: "2026-09-26T17:44:21.085Z"
readOnly: true
command: "local-markdown ../docs_tdd/prds/PR-02233/inbox/double-subtitle-punctuation-2026-09-26.md"
---

# PR-02233 双验证说明文案修正

## 需求

安全验证要求弹窗同时显示两项验证时，将说明文案修改为：

`为保障账户安全，本次操作需同时完成以下两项验证`

## 范围

- 仅修改该弹窗双验证状态下的说明文案。
- 不修改单验证状态文案。
- 不修改其他文案、样式、布局、交互或业务逻辑。
- 用户截图仅用于定位目标文案，不扩展修改范围。

## 验收

- 双验证状态下，目标说明文案逐字显示为 `为保障账户安全，本次操作需同时完成以下两项验证`。
