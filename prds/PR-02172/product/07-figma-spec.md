<!-- template-version: 1 -->
<!-- template-effective-since: 2026-07-23 -->

# 07 — Figma 设计规格

> 读取流程：[figma-mcp-read-workflow.md](../../../common/rules/figma-mcp-read-workflow.md)
> Token 规则：[ui-style-token-rules.md](../../../common/rules/ui-style-token-rules.md)；本项目 `visualFidelity: standard`，不为单页修改 preset。
>
> **最新覆盖（2026-09-04）**：本文件记录的 3+2 是 2026-08-21 Figma 原始规格；最终会话需求将登录/注册改为等尺寸 2×2（Google/HiChat、Apple/Telegram，Facebook 隐藏），不影响首页、个人中心和授权能力。

## 0. 元信息

| 字段 | 值 |
|------|-----|
| 项目 | `PR-02172` |
| 读取时间 | 2026-08-21 |
| 读取方式 | Figma Dev Mode 原子节点：层级、box model、CSS、颜色变量、Assets 与画布截图交叉核对 |
| Figma fileKey | `KzvWxAYxqfgpoiYuKdxMAE` |
| 页面 | `↳PR-02172 【登录注册】增加第三方tg fb` |
| 还原策略 | `standard`：尺寸/间距/token 精确；12px 圆角和 15px blur 映射最近 preset |

## 1. 读取 Checklist

- [x] 已确认登录/注册、账户绑定、首页三个主节点
- [x] 已读取各按钮、图标容器、弹窗和操作按钮原子节点
- [x] 已记录宽高、padding、gap、cornerRadius、fill 与图标身份
- [x] 已把 Figma 颜色映射到 `CC-3` / `BG-3` / `BG-B` / `Text-7` / `Divider-2`
- [x] 已记录 12px 圆角、15px blur 的 standard fidelity 映射
- [x] 已检查 `ThirdPartyLogin`、`HomeThirdLogin`、`ThirdBindModal` 与共享 `Modal`
- [x] 已把响应式、长文案截断和空值规则回填到 §7
- [x] PRD / Figma 差异已回填 `06-collaboration.md`

## 2. 链接与节点索引

| 模块 | 主 nodeId | 尺寸 (W×H) | 备注 |
|------|-------------|------------|------|
| 登录/注册三方入口 | `19782:4920` | 480×142 | 分隔文案 + 3+2 按钮组 |
| 账户绑定弹窗 | `19936:2518` | 400×409 | 仅用户标注红框范围调整，其他结构/交互不变 |
| 首页整体 | `19800:10744` | 主画板 | 本期只实现 Banner 登录工具条 |
| 首页 Banner 登录区 | `19800:11133` | 620×153 | 输入/注册区域 + 登录工具条 |

## 3. 控件几何表

| 模块 | nodeId | W×H | radius | Figma 布局 | preset / 实现 | 填充 | 代码落点 |
|------|--------|-----|--------|------------|---------------|------|----------|
| 登录按钮组 | `19782:4925` | 480×100 | — | column gap 20 | `flex flex-col gap-5` | — | `ProviderLoginButtons` |
| 登录第一行 | `19934:20044` | 480×40 | — | row gap 20，子项 `flex: 1` | `flex h-10 gap-5` | — | `ProviderLoginButtons` |
| Google | `19828:2564` | 131×40（选中实例） | 12 | px 8，gap 4，flex 1 | `h-10 flex-1 px-2 gap-1 rounded-m` | `CC-3` | `ProviderLoginButton` |
| HiChat | `19782:4932` | 131×40（选中实例） | 12 | 同 Google | 同 Google | `CC-3` | `ProviderLoginButton` |
| Apple | `19782:4937` | 131×40（选中实例） | 12 | 同 Google | 同 Google | `CC-3` | `ProviderLoginButton` |
| 登录第二行 | `19934:20043` | 480×40 | — | row gap 20，子项 `flex: 1` | `flex h-10 gap-5` | — | `ProviderLoginButtons` |
| Telegram | `19934:20034` | 222×40（选中实例） | 12 | px 8，gap 4，flex 1 | `h-10 flex-1 px-2 gap-1 rounded-m` | `CC-3` | `ProviderLoginButton` |
| Facebook | `19934:20045` | 222×40（选中实例） | 12 | 同 Telegram | 同 Telegram | `CC-3` | `ProviderLoginButton` |
| 绑定弹窗 | `19936:2518` | 400×409 | 16 | bottom padding 24 | `size="xs"` + 共享 `Modal` `rounded-lg` | `BG-3` | `ThirdBindModal` |
| 绑定行 | `19936:2520` 等 | 内容宽 352，高约 46 | 8 | px 12 / py 8 / gap 8 | `rounded-m px-3 py-2 gap-2` | 既有行背景/描边不变 | `ThirdPartyLogin` modal branch |
| Telegram 绑定行 | `19936:2977` | 352×46 | 8 | 图标 18 | `ProviderIcon size="sm"` | 同绑定行 | 同上 |
| Facebook 绑定行 | `19936:2991` | 352×46 | 8 | 图标 24 | `ProviderIcon size="md"` | 同绑定行 | 同上 |
| 行内信息区 | `19936:2993` | auto | — | horizontal gap 8 | `gap-2` | — | 同上 |
| 绑定操作按钮 | `19936:3037` | auto×28 | 8 | px 12，垂直居中 | `h-7 px-3 rounded-m` | `BG-B` / `Text-7` | 同上 |
| 首页工具条 | `19800:11138` | 620×40 | — | 主区域 gap 20 | 保持父级现有布局 | — | Banner `AccountReg` |
| 首页登录外壳 | `19800:11142` | content 256×40 + px 12 | 12 | px 12，gap 8 | `h-10 px-3 gap-2 rounded-m backdrop-blur-lg` | white 25% | `HomeThirdLogin` |
| 首页渠道组 | `19800:11143` | 200×40 | — | 五个 40×40 | `h-10 w-50` + 子项 `size-10` | transparent | `HomeThirdLogin` |
| 首页 Telegram | `19800:11159` | 40×40 | 8 | 图标 24 | `size-10 rounded-m` | transparent | `HomeProviderButton` |
| 首页 Facebook | `19800:11164` | 40×40 | 8 | 图标 24 | `size-10 rounded-m` | transparent | `HomeProviderButton` |
| 首页二维码 | `19800:11170` | 40×40 | 8 | padding 12，图标 18 | `size-10 rounded-m` + `size-4.5` | transparent | `HomeThirdLogin` |

> Figma 中个别选中实例宽度与父行 `flex: 1` 同时出现；实现以父行宽度、gap 与 `flex: 1 0 0` CSS 为准，从而同时满足 480px 桌面稿和窄屏等分布局。

## 4. Figma → Tailwind preset 映射

| Figma 值 | 数值 | 采用 class | 类型 | 结论 |
|-----------|------|------------|------|------|
| 按钮/首页外壳 radius | 12px | `rounded-m`（8px） | 最近 preset | `standard` 不新增 `rounded-[12px]` |
| 弹窗 radius | 16px | `rounded-lg` | 精确 | 移除局部 12px override，使用共享 Modal |
| 行/操作按钮 radius | 8px | `rounded-m` | 精确 | — |
| 主按钮高度 | 40px | `h-10` | 精确 | — |
| 绑定按钮高度 | 28px | `h-7` | 精确 | — |
| Telegram 小图标 | 18px | `size-4.5` | 精确 | 登录/绑定使用 |
| 常规品牌图标 | 24px | `size-6` | 精确 | — |
| 行距 / 横向 gap | 20px | `gap-5` | 精确 | — |
| 首页 blur | 15px | `backdrop-blur-lg`（16px） | 最近 preset | 差 1px，不用 arbitrary |

## 5. Design Token 对齐链

| Figma 变量 | 浅色 / 深色 | CSS 源变量 | Tailwind token | class | 用途 |
|------------|-------------|------------|----------------|-------|------|
| `CC-3` | `#F9F9FB` / `#2D2F39` | `--fx-cc-3` | `cc.3` | `bg-cc-3` | 登录/注册按钮底色 |
| `BG-3` | `#FFFFFF` / `#22232B` | `--fx-bg-3` | `bg.3` | 共享 Modal | 账户绑定弹窗 |
| `BG-B` | `#F1EAFE` / `#2D1462` | `--fx-bg-b` | `bg.b` | `bg-bg-b` | 绑定/解绑操作按钮 |
| `Text-7` | `#7132F4` / `#8D5BF6` | `--fx-text-7` | `text.7` | `text-7` | 操作按钮文字 |
| `Divider-2` | 黑 8% / 白 12% | `--fx-divider-2` + opacity | `divider.2` | `bg-divider-2` | 首页登录与二维码分隔线 |
| 白 25% | `rgba(255,255,255,.25)` | Tailwind opacity | white/25 | `bg-white/25` | 首页登录外壳 |

## 6. 图标与品牌资源映射

| Provider | Figma asset | 实现资源 | 尺寸 |
|----------|-------------|----------|------|
| Google | `Google2` | `icon-[fx--google-brand]` | 24 |
| HiChat | `hc-logo 2` / 首页 `Group 2147215296` | `/static/icon/HiChat.png`；首页沿用 `icon_hichat_new.svg` | 24；首页 16×18.5 |
| Apple | `Apple` | `icon-[fx--apple]` | 24 |
| Telegram | `telegram2` | `/static/icon/telegram2.svg`，源自 `packages/figma-icon/svg-files/logo/telegram2.svg` | 登录/绑定 18；首页 24 |
| Facebook | `facebook2` | `/static/icon/facebook2.svg`，源自 `packages/figma-icon/svg-files/logo/facebook2.svg` | 24 |
| QR code | Figma QR asset | `icon-[fx--qrcode]` | 18 |

禁止以单色 `icon-[fx--telegram]` / `icon-[fx--facebook]` 替代品牌双色 SVG。

## 7. 模块规则

### 7.1 登录 / 注册

- 最新顺序与分行：第一行 Google、HiChat；第二行 Apple、Telegram。Facebook 登录按钮不渲染。
- 两行均为两个 `flex-1` 按钮，四个按钮宽高一致，沿用 20px 行距与列距。
- 标签继续使用现有 `thirdLogin:*` literal i18n key；单行 `truncate`，窄屏不撑破按钮。
- 授权逻辑仍保留 TG/FB 能力；loading、Google 透明 SDK 层与埋点不变。

### 7.2 账户绑定

- 用户标注红框是本轮唯一变更范围：TG/FB 品牌图标与五行右侧关联/解除按钮样式。
- 行标题、账号/未绑定文案、绑定/解绑分发、安全验证、列表顺序与接口数据不变。
- `name` 缺失继续展示现有 `unBindText`；不构造第三方账号假默认值。

### 7.3 首页

- 顺序固定：Google、Apple、HiChat、Telegram、Facebook；每个 provider 都有完整 40×40 点击区。
- 二维码按钮保持下载浮层、埋点与跳转逻辑，只同步尺寸与图标大小。
- 外壳使用白色 25% 与 16px preset blur；不改 Banner 其他布局。

## 8. 响应式 / H5

| 断点 | 设计依据 | 实现要求 |
|------|----------|----------|
| 390px | 无独立原子稿；沿用同组件 | 登录/注册按钮以 `flex-1` 等分，标签截断，无横向溢出 |
| `<768px` 绑定弹窗 | 既有 bottom-center 行为 | 保持既有 placement；本轮不改弹窗交互 |
| Desktop | 上表原子节点 | 480px 表单宽度、400px 弹窗、首页 40px 工具条对齐 |

## 9. PRD / Figma 差异与结论

| # | PRD / 旧实现 | Figma | 结论 |
|---|----------------|-------|------|
| 1 | 登录/注册为一排圆形图标 + 下方文字 | 2026-08-21 Figma 为两行 3+2；2026-09-04 最终会话改为 2×2 | 以最终需求为准：隐藏 Facebook，Google/HiChat、Apple/Telegram 等尺寸分行 |
| 2 | 首页只有 Google/Apple/HiChat，点击区按图标尺寸 | 五渠道各 40×40，后接 QR | 新增 TG/FB 并扩大统一点击区 |
| 3 | 绑定弹窗局部强制 12px；操作按钮白底描边定宽 | 弹窗 16px；按钮 `BG-B` / `Text-7` / 自适应宽 | 仅改红框相关区域，其他不变 |
| 4 | PRD 竞品截图形态不一致 | FameEX 正式设计已到位 | Figma 为本轮视觉真值源 |

## 10. 走查清单

- [x] 登录页 light / dark 与 Figma 对照
- [x] 注册页 light / dark 与 Figma 对照
- [x] 首页五渠道 + QR 工具条与 Figma 对照
- [ ] 账户绑定弹窗红框范围与 Figma 对照，非红框区域无回归
- [ ] 390px 无溢出，长语言标签可截断
- [x] 未修改 `packages/config/tailwind-preset.js`
