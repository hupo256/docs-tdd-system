# 05 — UI 与交互

## 1. 订单簿面板宽度

| 项 | 行为 |
|----|------|
| 目标宽度 | 桌面（`xl`/`lg`）固定 **260px** |
| 视口变化 | 视口变宽时订单簿保持 260px，**K 线区吸收所有差额**；下单面板保持原比例（9 列） |
| 只缩不放 | 视口窄到「260px 需要的列数 > 原 9 列」时，回退为原比例，避免挤占下单面板 |
| 缩放交互 | 订单簿禁用横向缩放（`isResizable: false`）；其余面板拖拽/缩放不变 |
| 持久化 | 订单簿宽度不受 localStorage 历史布局影响（刷新、改过别的面板后仍是 260px） |
| 窄屏（<1024，`md` 及以下） | 维持原拆分/堆叠布局，不固定宽度 |

### 视觉对照（实测，容器 ≈2263px）

| 面板 | 改动前（比例） | 改动后 |
|------|----------------|--------|
| 订单簿 | 随视口放大（宽屏 >300px） | **260px** |
| 下单面板 | 9 列 | 9 列（不变，~422px） |
| K 线（TradingView） | 30 列 | 吸收订单簿差额，明显变宽（~1574px） |

## 2. 分享入口

### 2.1 位置与触发

- 位置：K 线工具栏左侧图标簇内，**设置齿轮之后、「最新价格」下拉之前**（与产品截图一致）。
- 图标：`icon-[fx--share]`，按钮尺寸 `28×28`，与同组图标统一。
- 显隐：继承同组条件 `!isDepth && width > 510`（深度图模式、过窄时隐藏）。
- 交互：点击展开 Popover 下拉；点击任一项后关闭。

### 2.2 菜单结构（两段式，分割线分隔）

| 分区 | 项 | 文案 key | 图标 |
|------|----|----------|------|
| 社交 | 分享至 X | `ShareToX` | `fx--twitter` |
| 社交 | 分享至 Telegram | `ShareToTelegram` | `fx--telegram` |
| 社交 | 分享至 Discord | `ShareToDiscord` | `fx--discord` |
| 社交 | 分享至 Facebook | `ShareToFacebook` | `fx--facebook` |
| —— 分割线 —— | | | |
| 图片 | 储存图片 | `SaveImage` | `fx--download` |
| 图片 | 复制图表图片 | `CopyChartImage` | `fx--copy` |
| 图片 | 复制图片链接 | `CopyImageLink` | `fx--link` |
| 图片 | 在新页中打开图片 | `OpenImageInNewTab` | `fx--share` |

### 2.3 当前行为（P1）

- 8 项均可点击，点击后菜单关闭；具体动作为占位（`handleShareAction(type)`，无实际副作用）。
- 真实动作见 [02-technical-design.md §4](./02-technical-design.md) 下一阶段扩展点。

## 3. i18n

- 开发期维护 zh-CN / en-US；其余语言走 en-US 回退。
- 文案 key 列表见上表 §2.2 与 [02-technical-design.md §2.3](./02-technical-design.md)。
