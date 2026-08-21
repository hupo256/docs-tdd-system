<!-- template-version: 1 -->
<!-- template-effective-since: 2026-07-23 -->

# UI And Interaction — PR-02172 【登录注册】增加第三方（tg、facebook）

## 页面与入口结论

| 页面 | 代码入口 | 2026-08-21 Figma 结论 | 交互约束 |
|------|----------|------------------------|----------|
| 登录页 | `apps/web/src/apps/Login/InputAccount.tsx` → `ThirdPartyLogin` | 五渠道改为两行整宽按钮：第一行 Google / HiChat / Apple，第二行 Telegram / Facebook | 授权方式、Google One Tap、埋点与三态流程不变 |
| 注册页 | `apps/web/src/apps/Register/RegisterV2/CreateAccount.tsx` → `ThirdPartyLogin` | 与登录页共用同一 3+2 按钮组件 | 条款、邀请码、Google One Tap 与注册流程不变 |
| 首页 | `HomeThirdLogin` | 沿用 Banner 入口；顺序为 Google / Apple / HiChat / Telegram / Facebook，五个入口均为 40×40 点击区，后接分隔线与 40×40 二维码按钮 | 授权、下载二维码浮层与跳转逻辑不变 |
| 授权后选择 | `SelThirdType` | 本期 Figma 未要求变更 | 继续复用注册新账户 / 关联已有账户状态机 |
| 补填注册 | `RegByThird` / `CreateByThird` | 本期 Figma 未要求变更 | Telegram 无邮箱、Facebook email 可选等逻辑沿用现状 |
| 关联已有账户 | `UniteByThird` | 本期 Figma 未要求变更 | 账号密码、二次验证和错误处理不变 |
| 个人中心 | `ThirdBindModal` → `ThirdPartyLogin isModal` | 只改标注红框：补齐 TG/FB 行品牌图标并统一五行右侧关联按钮；弹窗其他区域不变 | 绑定、解绑、安全验证与 `authUsers` 数据逻辑不变 |
| 管理后台 | legacy admin 已有实现 | 本轮 Web Figma 不涉及 | 保持既有交付 |

## 已确认视觉规格

| 模块 | 布局 / 尺寸 | 颜色 / 圆角 | 图标 |
|------|-------------|-------------|------|
| 登录/注册按钮组 | 480×100；两行高 40，行距 20；行内 gap 20；按钮 `flex: 1` | `CC-3`；Figma 12px 圆角按 standard fidelity 映射 `rounded-m` | Google/HiChat/Apple/Facebook 24；Telegram 18 |
| 账户绑定弹窗 | 400×409；内容宽 352；行 `px-3 py-2`；按钮高 28、`px-3` | 弹窗 `BG-3` / 16px；关联按钮 `BG-B` + `Text-7` / 8px | Telegram 18；其余 24 |
| 首页登录入口 | 外壳高 40、`px-3`、gap 8；五渠道各 40×40；二维码 40×40 | 白色 25%；blur 15px 映射 `backdrop-blur-lg`；12px 圆角映射 `rounded-m` | 五渠道 24（HiChat 原资源 16×18.5）；二维码 18 |

完整原子节点和 token 映射见 `07-figma-spec.md`。

## 必测状态

| 场景 | 预期表现 | 契约状态 |
|------|----------|----------|
| SDK 未加载 / popup 被拦截 | 对应按钮 disabled；授权中渠道显示 loading，避免重复点击 | 已落地 |
| 用户取消授权 | 回到原页面，不打开后续流程，不残留临时 token | 沿用既有实现 |
| 第三方服务超时 | “第三方服务暂时不可用，请稍后重试” | `thirdLogin:serviceUnavailable`，已落地 |
| 已绑定正常账户 | 直接登录成功 | 沿用 `authStatus=1` |
| 未绑定 / 强制关联 | 分别进入注册选择或关联已有账户 | 沿用 `authStatus=0/2` |
| 绑定/解绑 | 进入既有安全验证；操作中按钮 loading | 沿用既有实现 |
| 390px 窄屏 | 3+2 按钮保持等分，不横向溢出；长语言标签截断 | UI 验收项 |
| light / dark | `CC-3`、`BG-B`、`Text-7` 随主题 token 切换 | UI 验收项 |

## 视觉资料

- 登录/注册：[Figma node 19782:4920](https://www.figma.com/design/KzvWxAYxqfgpoiYuKdxMAE/%E3%80%8CFameEX%E4%B8%89%E6%9C%9F%E3%80%8D----WEB?node-id=19782-4920&m=dev)
- 账户绑定：[Figma node 19936:2518](https://www.figma.com/design/KzvWxAYxqfgpoiYuKdxMAE/%E3%80%8CFameEX%E4%B8%89%E6%9C%9F%E3%80%8D----WEB?node-id=19936-2518&m=dev)
- 首页：[Figma node 19800:10744](https://www.figma.com/design/KzvWxAYxqfgpoiYuKdxMAE/%E3%80%8CFameEX%E4%B8%89%E6%9C%9F%E3%80%8D----WEB?node-id=19800-10744&m=dev)
- `PRD-IMG-001`～`035` 仅作竞品流程参考；`036`～`040` 仍作为个人中心、后台和日志需求佐证，不覆盖本轮正式 Figma。
