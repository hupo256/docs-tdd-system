# PR-02006 Figma Spec

## 来源

| 类型 | 链接 / 状态 |
|------|-------------|
| 原型 | `https://www.figma.com/design/RpAKwiau1QYLimGkHRy5Vl/Lucky%E5%8E%9F%E5%9E%8B?node-id=8923-9176&t=F6F5EoPBANeyytbt-1` |
| UI 地址 | PRD 中为空，待提供 |
| PRD 截图 | 已随 Lark Markdown 同步为图片链接和 alt 文本，未下载原图 |

## 已识别画面

| PRD 章节 | 画面 | 覆盖内容 | 缺口 |
|---------|------|----------|------|
| 5.1 | Header 合约交易 TradFi hover 浮层 | 分类 Tab、搜索、交易对行、成交额、别名、涨跌 | 缺正式 UI 尺寸 / token |
| 5.2 | 交易页左上角交易对弹层 | 板块 Tab、分类 Tab、24h 成交额列、别名、hover 触发 | 缺组件精确状态图 |
| 5.3 | TradFi 落地页 | 永续标签、附属文案、24h 成交额、高低价排序 | 缺 H5 细节 |
| 5.4 | 行情页 TradFi | 附属文案、logo 样式优化 | 缺 logo 具体 token / 尺寸 |
| 6.1 | Admin 币种配置 | 归属板块、多语言别名区域、必填提示 | 需确认 Admin UI 风格与页面落点 |

## Token 规则

- Web 端颜色、间距、圆角优先使用现有 Tailwind 语义 token。
- UI 未提供正式节点前，不新增全局 token，不为单页改 `tailwind-preset.js`。
- Admin 页面按 Ant Design 后台风格，保持紧凑、克制、功能优先。

## 待补资料

1. 正式 UI/Figma 节点或确认按原型图实现。
2. H5 390px 设计细节。
3. 行情页 logo 优化的精确尺寸、背景、圆角和 fallback。
