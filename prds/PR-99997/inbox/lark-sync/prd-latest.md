---
sourceName: "需求 PRD"
sourceType: "markdown"
sourceUrl: "common/vnext/sentinel/PR-99997-prd.md"
syncedAt: "2026-09-09T15:35:44.422Z"
readOnly: true
command: "local-markdown ../docs_tdd/common/vnext/sentinel/PR-99997-prd.md"
---

# 预测市场 · 搜索联想弹窗间距优化（哨兵需求）

## 背景

预测市场顶部搜索框输入关键词后，会弹出联想结果下拉（SearchPopup）。每条结果为一行：左侧币种图标 + 中间高亮标题 + 右侧占比/方向。

## 需求

1. 搜索联想弹窗中，每条结果里「币种图标」与「标题文字」之间的横向间距过大，视觉松散，需要减少一半。当前为 gap-7（28px），应改为 gap-3.5（14px）。仅调整该间距，不改动图标尺寸、标题字号、右侧占比列、行高与悬停态。

## 范围与验收

- 影响文件：apps/web 预测市场 SearchBox 下的 SearchPopup 结果行容器 className。
- 验收：图标与标题间距为原值的一半；其余布局像素不变；下拉整体高度与「更多结果」入口不受影响。
- 不在范围：apps/web-next 的同名组件（其间距为 gap-4，属另一实现，本需求不覆盖）。
