# 07 — 视觉规格来源

## 元信息

| 字段 | 值 |
|------|-----|
| 项目 | PR-02233 |
| 读取时间 | 2026-09-04 |
| 读取方式 | Lark PRD revision 670 导出 + 本地图片读取 |
| Figma fileKey / nodeId | 未提供 |
| 还原目标 | standard；复用现有 Web token 与 `Modal`，以 PRD 截图做 L2 对照 |

## 本地参考图

| 模块 | sourceId | 本地文件 | 关键规格 |
|------|----------|----------|----------|
| Web 注册验证码现状 | `PRD-IMG-001` | `inbox/lark-sync/assets/M1t8bVEJponR5Bx7vWElwc3igXd.png` | 六格输入、确认按钮、底部引导 |
| 注册引导目标 | `PRD-IMG-002` | `inbox/lark-sync/assets/FEAqbVITho7WtnxkwWhlf6MPgQh.png` | 底部“尝试邮箱注册” |
| Web 登录 GA 页 | `PRD-IMG-003` | `inbox/lark-sync/assets/ERmCbXk7ZoxB6BxgAVclaz3qgPd.png` | 六格输入、粘贴、确认、切换入口 |
| 方法选择弹窗 | `PRD-IMG-004` | `inbox/lark-sync/assets/Fi29byMCdoy21ux9Efyljjy7gqe.png` | 圆角弹窗、三方式卡片、当前描边/标记 |
| 邮箱帮助弹窗 | `PRD-IMG-026` | `inbox/lark-sync/assets/OdvcboGVTobxkMxx5ralDygNgje.png` | 双 Tab、列表、客服 icon、主按钮 |
| 手机帮助弹窗 | `PRD-IMG-027` | `inbox/lark-sync/assets/SvVKb96hFokllJxdANalqAMrgac.png` | 手机 Tab 和五条排查说明 |

## 组件映射

| UI | 采用组件 / token | 约束 |
|----|------------------|------|
| 页面验证码输入 | 现有 `CodeVerifyDialog/CodeInput` | 维持 6 格和既有响应式，不复制输入组件 |
| 弹窗 | 现有 `Modal` | 使用项目尺寸/圆角 preset，不新增全局 token |
| 方法项 | button + `border-cc-1` / `border-brand-1` / semantic text | 当前态不能只靠颜色，需文字标记 |
| 主按钮 | `@fameex/ui Button` | loading/disabled 用组件原生属性 |
| Tab | 项目现有 Tabs 或轻量语义按钮 | 键盘可操作，active 有文本/aria 状态 |
| 图标 | 已有 `icon-[fx--google/email/phone]` 与客服资源 | 禁止无关占位图标 |

## 响应式

| 断点 | 规则 |
|------|------|
| PC | 沿用 Login/Register 内容列宽；弹窗采用现有 `size="xs"` 起点并按截图核对 |
| H5 | 六格等分可用宽度，不横向溢出；弹窗两侧保留现有安全间距；长语言允许换行 |

## 缺口与验证

- 无 Figma 原子 node，不能声称像素级 Figma 还原；不得补造 nodeId 或变量。
- 编码时先查 `packages/config/tailwind-preset.js`，不为本页修改 preset，不优先使用 arbitrary class。
- G6 对以上六张图片做功能 L1 + 并排 L2；dark/light、PC/H5 各覆盖核心状态。
