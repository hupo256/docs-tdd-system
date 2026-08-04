# UI And Interaction — PR-02022 合约跟单引导页

继承 [../../common/ui-style-token-rules.md](../../common/ui-style-token-rules.md)。详细 Figma 规格见 [07-figma-spec.md](./07-figma-spec.md)。

## 页面 / 路由

| 页面 | 路由 | 说明 |
|------|------|------|
| 跟单广场（合约） | `/copy-trading/futures` | 容器 `apps/web/src/apps/CopyTrading/index.tsx`；新手引导 + 带单员弹窗均在此触发 |
| 带单交易页 | 待 G4 grep 确认（`COPY_TRADING_*` 常量，`constants/pathnames.ts`） | 带单员弹窗「去带单」跳转目标 |

## 新手引导（driver.js，3 步）

### 触发

- 已登录 + 引导状态 `not_triggered` + 页面主体加载完成 + 非「带单员未读弹窗」场景
- 全生命周期仅一次；`ended`/`completed` 后不再展示
- 未登录 / 加载未完成 / 接口异常 → 不展示

### 步骤交互（按钮矩阵见 07-figma-spec §3.2）

| 步骤 | 高亮目标 | 左 | 右 | 右上 |
|------|---------|----|----|------|
| 1/3 选择带单员 | 顶级交易员列表 | 跳过 | 下一步 | — |
| 2/3 一键配置，轻松入场 | 跟单 CTA | 跳过 | 上一步 / 下一步 | — |
| 3/3 跟单进展，尽在掌握 | 跟单概览卡片（沿用现有，新用户也在） | — | 上一步 / 完成 | 无（已去掉 ×） |

- 上一步 / 下一步：仅切 popover 内容，**不更新状态**
- 跳过（任意步）：状态→已结束，关闭
- 完成（第三步）：状态→已完成，关闭
- 中途退出页面（未点跳过/完成）：状态不变，下次重新从第一步

## 带单员强提醒弹窗（复用 Modal，见 07-figma-spec §5）

- 触发：已登录 + 身份带单员 + 弹窗状态 unread + 首次进入；与新手引导互斥（优先本弹窗）
- 点击遮罩**不可关闭**（`Modal isDismissable={false}`）
- × 关闭：状态→已读，停留广场页
- 去带单：状态→已读，跳转带单交易页
- 接口异常：不展示，不阻断主流程

## 状态矩阵

| 组件 | loading | error/异常 | success |
|------|---------|-----------|---------|
| 引导 | 页面加载完成前不触发 | 不展示（降级），不阻断 | driver 正常走 3 步 |
| 带单员弹窗 | 同上 | 不展示（降级） | 正常展示 |
| 广场列表 | 复用现有 | 复用现有 | 后端已过滤可见性，直接渲染 |

## i18n（namespace `copyTrading`，新增 key，文案见 PRD §5.5）

| key（已与实现对齐，见 `i18n/locales/zh-CN/copyTrading.json`） | 中文 |
|------|------|
| `copyTrading:guide.step1.title` | 选择带单员 |
| `copyTrading:guide.step1.desc` | 从众多优质交易员中，挑选最适合你的 |
| `copyTrading:guide.step2.title` | 一键配置，轻松入场 |
| `copyTrading:guide.step2.desc` | 设定跟单金额及相关参数，立即跟单 |
| `copyTrading:guide.step3.title` | 跟单进展，尽在掌握 |
| `copyTrading:guide.step3.desc` | 实时查看持仓与收益，随时调整跟单策略 |
| `copyTrading:guide.skip` | 跳过 |
| `copyTrading:guide.next` | 下一步 |
| `copyTrading:guide.prev` | 上一步 |
| `copyTrading:guide.done` | 完成 |
| `copyTrading:traderBecomeModal.title` | 恭喜您 |
| `copyTrading:traderBecomeModal.desc` | 您已成为合约带单员！完成首笔带单后，您的主页将正式展示在带单员列表中，赶快开始您的第一笔带单吧！ |
| `copyTrading:traderBecomeModal.goTrade` | 去带单 |

> 本期仅中文（其他语言由国际化团队处理）。

## H5 适配（PRD §5.5.2）

- driver.js popover 390px 不溢出、按钮可点；driver.js 自带响应式定位，需验证小屏箭头/定位
- 带单员弹窗按钮点击区 ≥44px；键盘唤起不遮挡（本弹窗无输入，风险低）
- 高亮目标在 H5 下若布局变化，需确认 data-tour 锚点仍存在
