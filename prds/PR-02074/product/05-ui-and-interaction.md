# UI And Interaction — PR-02074 预测市场三期

## 页面 / 路由

| 页面 | 路由 | 入口 | 备注 |
|------|------|------|------|
| 预测市场默认页 | `/prediction` | 站内 Prediction 入口 | 默认分类由现有路由规则决定 |
| Crypto | `/prediction/crypto` | 顶部 Crypto Tab | 复用主页面壳和通用事件模块 |
| Politics | `/prediction/politics` | 顶部 Politics Tab | 复用主页面壳和通用事件模块 |
| Sports | `/prediction/sports` | 顶部 Sports Tab | 体育事件复用既有体育模块 |
| Finance | `/prediction/finance` | 顶部 Finance Tab | 复用主页面壳和通用事件模块 |
| 搜索结果 | `/prediction/search?keyword=...` | 联想层“更多结果”或提交搜索 | 每批 50 条，触底加载 |

分类状态写入 URL：二级分类使用 `tag`，三级分类使用 `subTag`。刷新、前进和后退后应能从 URL 恢复筛选状态。

## 页面结构

| 区域 | Desktop | H5 |
|------|---------|-----|
| 顶部导航 | 一级分类 Tab 在左，搜索框在右；搜索框固定 `240px` | 允许纵向排列，搜索框占满可用宽度（`w-full`） |
| 主体 | 左侧分类树，右侧事件列表 | 分类与事件列表纵向排列，不横向溢出 |
| 事件模块 | 单市场、多市场使用既有事件卡；体育使用既有体育模块 | 保留同一信息层级，按容器宽度自适应 |
| 搜索联想 | 锚定搜索框的浮层 | 宽度受视口约束，内容保持可点击 |
| 搜索结果 | 面包屑、关键词标题、搜索框、纵向结果行 | 同序纵向排列 |

## 状态

| 场景 | 预期表现 | 验证方式 | 状态 |
|------|----------|----------|------|
| loading | 分类或列表显示既有 loading/skeleton；搜索请求期间保留输入状态，避免页面跳动 | Browser / MSW 延迟场景 | 待验证 |
| empty | 分类列表无事件时显示显式空态；搜索无匹配时显示搜索空态 | Browser / MSW empty | 待验证 |
| error | 请求失败展示既有错误反馈或可重试状态，不用空列表吞掉错误 | Browser / MSW error | 待验证 |
| disabled | 空关键词不发搜索请求；无下一页后停止触底请求 | Browser / Network | 待验证 |
| success | 分类、事件、联想和搜索结果均通过 schema → mapper → React Query → UI 链路展示 | Browser / MSW normal | 待验证 |
| unauthorized | 需要登录的交易动作沿用现有登录拦截；公开浏览和搜索不应被阻塞 | Browser / MSW unauthorized | 待验证 |

## 交互

| 操作 | 预期副作用 | 验证方式 | 状态 |
|------|------------|----------|------|
| 点击一级分类 Tab | 跳转对应 `/prediction/{category}`，复用页面壳并刷新分类与事件数据 | browser_click + URL | 待验证 |
| 点击二级分类 | 更新 `tag`，清理不再适用的 `subTag`，刷新事件列表 | browser_click + URL + request | 待验证 |
| 点击三级分类 | 更新 `subTag` 并刷新事件列表 | browser_click + URL + request | 待验证 |
| 输入搜索词 | debounce 后请求联想；展示最多 5 条匹配结果，命中词高亮 | browser_type + request count | 待验证 |
| 清空搜索词 | 关闭联想层并清理搜索请求展示状态 | browser_click + popup | 待验证 |
| 点击联想结果 | 在详情路由明确前，统一进入携带当前关键词的搜索结果页 | browser_click + URL | 待验证 |
| 点击“更多结果” | 进入 `/prediction/search?keyword=...` | browser_click + URL | 待验证 |
| 搜索结果页修改关键词 | URL 中 `keyword` 同步更新，并从第一页重新请求 | browser_type + URL + request | 待验证 |
| 滚动到结果列表底部 | 有下一页时加载 50 条并追加；没有下一页时停止 | browser_scroll + request count | 待验证 |

## 搜索展示规则

| 内容 | 联想层 | 更多结果页 |
|------|--------|------------|
| 数量 | 最多 5 条 | 每批 50 条，触底追加 |
| 信息 | 图标、标题、关键词高亮、占比、方向 | 分类标签、图标、标题、关键词高亮、成交量、占比、方向 |
| 排列 | 紧凑纵向行 + 底部更多结果入口 | 白底纵向结果行 + 轻分割，不使用厚重独立卡片 |
| 缺失值 | 可选图标/方向不渲染，必填缺失显式空值 | 同左，不伪造业务默认值 |

## 数据与 Mock

- API 文档未就绪期间使用 MSW 路线 B，fixture 保持覆盖 UI 所需的最小数据集。
- UI 必须经过真实 runtime schema、mapper 和 React Query，不在组件内直接 `fetch`，也不直接 import fixture。
- Mock 数据结构参考 BitMart Predict，并保持字段语义可与后端最终契约逐项对账。
- normal / empty / error / unauthorized / edge 场景由 Prediction MSW handler 提供。

## 视觉还原

| 模块 | Figma node | L1 功能 | L2 并排 | 当前偏差 / 处理 |
|------|------------|---------|---------|-----------------|
| 页面主骨架 | `17067:17867` | 待验证 | 待 Dev Mode/MCP | 按 PRD 截图和 BitMart 布局校准 |
| 一级分类与搜索 | 子节点待读取 | 待验证 | 待 Dev Mode/MCP | 相同 Tab 复用同一模块 |
| 分类侧栏与事件流 | 子节点待读取 | 待验证 | 待 Dev Mode/MCP | 复用现有业务卡片体系 |
| 搜索联想 | 子节点待读取 | 待验证 | 待 Dev Mode/MCP | 紧凑列表，固定 5 条和更多结果入口 |
| 搜索结果列表 | 子节点待读取 | 待验证 | 待 Dev Mode/MCP | 调整为白底纵向行和轻分割 |

Figma 原子尺寸、色值、圆角和变量定义无法在当前 Agent 会话读取；详见 [07-figma-spec.md](./07-figma-spec.md)。
