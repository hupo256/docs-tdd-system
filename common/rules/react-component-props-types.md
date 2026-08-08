# React 组件入参类型定义 → 已上移全局

> **状态**：本规则为**纯通用编码手艺**，已按 [rule-inheritance.md §0](./rule-inheritance.md) 上移到 **L1 全局**，此文件仅留指针防断链，不再维护正文。

## 规则现所在

- **唯一真值源**：全局 `~/.claude/CLAUDE.md`「命名入参类型」条 —— React 组件 / hook / 分发器 **≥2 个入参（含回调）** 时，先声明命名 `XxxProps` / `XxxParams`，签名写 `props: XxxProps` 再在函数体解构；禁参数列表内联匿名对象类型、禁 `Record<string, unknown>` 绕过；仅 1 个简单入参（如 `children`）可内联。
- 仓库锚定（`apps/web` glob 触发）：无需单独 `.cursor/rules`，此规则无 fameex 锚点，L1 已覆盖。

## 为什么不留正文

纯编码手艺与任何仓库无关，绑在 docs_tdd 会导致换仓即失效、且与全局规则双写漂移（见 [rule-inheritance.md §0 载体分层](./rule-inheritance.md)）。示例（`TaskRendererParams` 等）见提交历史与全局规则说明。
