# PR-02172 登录/注册第三方入口最终布局（2026-09-04）

## 1. 权威来源与覆盖关系

- 权威来源：负责人在当前会话提供的 17:48–18:15 飞书讨论截图，并明确要求“真实的需求来了，进行吧”。
- 最新确认：Facebook 入口隐藏后，四个可见入口分成两行，每个按钮尺寸一致。
- 本文件覆盖 `vnext-login-provider-visibility-2026-09-04.md` 中“第一行 3 个、第二行 Telegram 单按钮居中”的旧方案。

## 2. 锁定范围

1. 登录页和注册页均不渲染 Facebook 登录按钮。
2. 四个可见入口顺序保持为 Google、HiChat、Apple、Telegram。
3. 四个入口按两行两列布局：第一行 Google / HiChat，第二行 Apple / Telegram。
4. 四个按钮使用相同宽度和高度；沿用既有行间距、列间距、品牌图标、文案、loading 和 disabled 表现。
5. 首页第三方入口与个人中心绑定入口不改。
6. Telegram / Facebook 授权、绑定、SDK、API、埋点逻辑不改；本需求不新增或修改请求，不创建 MSW。

## 3. 验收标准

- 登录页和注册页只显示 Google、HiChat、Apple、Telegram，不显示 Facebook。
- 两行均恰好显示两个按钮，四个按钮尺寸一致。
- 第一行为 Google / HiChat，第二行为 Apple / Telegram。
- 首页、个人中心以及 Telegram / Facebook 能力代码无行为变化。
