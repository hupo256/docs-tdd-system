# PR-02233 → web-next 实施计划与 Chat 交接

> 更新时间：2026-03-13  
> 当前结论：TR-02386 已合入；docs-tdd 已完成本期范围重定位并进入 implementing；业务只完成了第一批纯 TS 基础模块，UI 尚未开始。下一位执行者应立即转入业务组件和三页接入，不要继续批量制造证据占位文件。

## 1. 已确认决策（不要重新讨论或反向调整）

1. TR-02386 是纯技术迁移，随 PR-02233 一起上线。
2. 合并方向固定为 `feature/TR-02386` → `feature/PR-02233`，不反向合并；TR-02386 后续更新继续单向合入 PR-02233。
3. PR-02233 本期只交付：
   - web-next 通用安全验证封装件；
   - Login；
   - Register；
   - ResetPassword。
4. Account / Assets 等尚未迁移到 web-next 的消费面，本期 deferred，后续批次 `web-next-account-assets-migration` 再接入。
5. 限频后端契约依赖 PR-02189 / PR-02235；契约未落地前只允许保留结构和明确 mock，不得猜测或在前端伪造后端规则。

## 2. 仓库与分支事实

- 当前业务 worktree：`/Users/aven/github/PR-02233`
- 当前业务分支：`feature/PR-02233`
- `apps/web/docs_tdd` 是软链，实际属于独立仓库 `/Users/aven/github/docs_tdd`；它的变更不会显示在 fameex-web 的 `git status` 中。
- TR-02386 已合入：
  - ResetPassword 迁移提交：`6112209b25`
  - 合并提交：`bee7970706`
- 不要执行 `git push`。用户会自行检查和后续提交；如需提交必须先再次确认。

## 3. 当前真实落盘状态

### 3.1 fameex-web（未跟踪、未提交）

目录：`apps/web-next/src/components/verification/`

已新增：

- `methodResolver.ts`
  - 场景：`register | login | forced-double | sensitive`
  - 验证方式优先级：`ga > email > sms`
  - 返回 `methods` 和 `needsAdditionalMethod`
- `sendCodeError.ts`
  - 归一化未知异常；分类 `rate_limit / timeout / network_error / service_error`
  - 读取后端 `remainingDisabledSeconds`
- `countdown.ts`
  - 根据冷却截止时间戳计算向上取整的剩余秒数
- `tracking.ts`
  - 通过 web-next 既有 `PostHog.capture` 定义 8 个验证事件
- `test/methodResolver.test.ts`
- `test/sendCodeError.test.ts`
- `test/countdown.test.ts`
- `test/tracking.test.ts`

当前 `git status --short` 只显示：

```text
?? apps/web-next/src/components/verification/
```

说明：这些是业务基础逻辑，但还没有可见 UI，也尚未接入 Login / Register / ResetPassword。

### 3.2 docs_tdd 独立仓库（未提交）

- `prds/PR-02233/work-item.json` 已被重抽并修改：
  - `deliveryScope.kind = bounded-batch`
  - `batchId = PR-02233-web-next-auth-verification`
  - policy paths 已指向：
    - `apps/web-next/src/components/verification`
    - `apps/web-next/src/apps/Login`
    - `apps/web-next/src/apps/Register`
    - `apps/web-next/src/apps/ResetPassword`
  - Account / Assets 已记录 deferred。
- docs-tdd `run PR-02233` 此前已进入 `V2-implementing`，next action 为 `implement-current-scope`，无 blocker。
- `agent/browser-scenarios/*-dom-contract.json` 有 26 个未跟踪的机械占位文件，内容仍为 `TBD-实现后回填`，当前不能执行、不能提供证据。

## 4. 已纠正的执行策略

### 禁止继续做的事

- 不要继续为每个 R/S 复制 `*-dom-contract.json`。
- 不要在业务实现前补大量一对一占位 spec。
- 不要为了 docs-tdd 数量或格式而制造无真实断言的“证据”。
- 不要重做已完成的 re-scope 或重新讨论 TR-02386 合并方向。
- 不要先处理 online；用户已明确 TR-02386 随 PR-02233 上线。

### 26 个占位 DOM contract 的处理

这些文件均为当前会话机械生成、尚未跟踪，内容无效。下一位执行者应：

1. 只删除未跟踪的 `*-dom-contract.json` 占位文件；不要误删目录内原有、已跟踪且真实可执行的场景文件。
2. 检查 `work-item.json` 是否引用这些占位路径；若有，使用 docs-tdd 正规 extract 输入/流程移除或改为最小有效证据，不要直接造成悬空引用。
3. 这项清理不得再次演变为长时间的 docs-tdd 前置工作；优先写业务，最终阶段再补最小有效证据。

## 5. 剩余实施顺序（下一位 Chat 从这里开始）

### 阶段 A — 快速核对现有基础模块

- [ ] 对照 web-next 现有类型和 API，确认新增纯逻辑没有猜测字段。
- [ ] 检查 `tracking.ts` 的 import 顺序、事件名和属性名是否符合现有 PostHog 约定。
- [ ] 运行一次四个聚焦测试并记录真实退出结果。此前测试命令启动过，但会话没有保留下可确认的最终结果，因此不得写成“已通过”。
- [ ] 仅修复明确失败项，不扩展抽象。

建议命令：

```bash
pnpm --filter web-next test --run \
  apps/web-next/src/components/verification/test/methodResolver.test.ts \
  apps/web-next/src/components/verification/test/sendCodeError.test.ts \
  apps/web-next/src/components/verification/test/countdown.test.ts \
  apps/web-next/src/components/verification/test/tracking.test.ts
```

### 阶段 B — 重建 web-next 验证封装件（当前最高优先级）

开始前先阅读并复用：

- `apps/web-next/src/components/CodeVerifyDialog/`
- `apps/web-next/src/components/CodeVerifyDialog/verificationTypes.ts`
- `apps/web-next/src/utils/hooks/useCountdown.ts`
- `apps/web-next/src/platform/posthog/postHog.ts`
- Login / Register / ResetPassword 当前表单和各自验证弹窗/store

实现最小组件集合：

- [ ] `SwitchVerifyMethodDialog`
  - 显示可用验证方式；
  - 当前方式不可重复选择；
  - 切换后保持各方式自己的输入和倒计时状态；
  - 接入 switch-channel 埋点。
- [ ] `NoCodeGuideDialog`
  - 根据当前验证方式打开对应 tab；
  - 文案进入 `apps/web-next/src/i18n/resources/zh-CN/codeVerify.json`；
  - 只改简体中文 locale。
- [ ] `SendCodeButton`
  - 待发送、发送中、倒计时、限频冷却四态；
  - 禁用和重复点击保护；
  - 复用现有 `useCountdown`，不要创建第二套重复 hook；
  - 后端提供冷却时间时可恢复倒计时；
  - 接入发送成功/失败、限频埋点。
- [ ] 在既有 `CodeVerifyDialog` 基础上组合，而不是平移 legacy React/Next 组件实现。

组件 API 要保持小而明确；不要为单次使用引入巨型 Provider、万能配置对象或大量布尔 props。

### 阶段 C — 三个业务页面接入

#### Login

- [ ] 移除/替换旧切换入口。
- [ ] 登录默认验证方式使用 `resolveVerificationMethods({ scene: 'login' })`。
- [ ] 接入新切换方式、发送按钮、未收到验证码引导和 8 事件中的相应触发点。
- [ ] 保留现有登录 API、表单流程和错误处理，不顺手重构。

#### Register

- [ ] 完成 PR 文案改造。
- [ ] 注册验证方式来自用户注册渠道，不自行推断。
- [ ] 接入公共验证封装件。
- [ ] 保留现有注册接口和提交链路。

#### ResetPassword

- [ ] 保留 TR-02386 已迁移的页面形式、4 个 endpoint 契约和 payload 行为。
- [ ] 用公共验证封装件替换局部重复 UI/逻辑。
- [ ] 接入按钮四态、未收到验证码、倒计时恢复和埋点。
- [ ] 不改变本次需求无关的密码重置业务规则。

### 阶段 D — 最小可信验证

- [ ] 纯逻辑只保留有核心分支价值的聚焦 Vitest。
- [ ] 不新增 `*.test.tsx` 组件渲染测试。
- [ ] UI 文案、显隐、disabled、切换状态用少量 DOM-contract 脚本或真实浏览器验证；不要求每个 R/S 各建一个文件。
- [ ] 对触达文件批量运行一次 Biome。
- [ ] 运行 web-next 的最小 scoped typecheck/test；不要为局部改动跑全仓测试。
- [ ] 最后再执行 docs-tdd `changed PR-02233`；仅在阶段边界执行对应 gate。
- [ ] 未执行的检查必须写 `not-required` 或说明原因，不能写 passed/skipped。

## 6. 需求映射（本期）

- R-001：Register 文案/入口
- R-002：Login 旧入口移除
- R-003 / R-004 / R-005：切换验证方式入口和弹窗
- R-006：验证方式优先级；本期只接 Login/Register/ResetPassword 可落地 surface
- R-009：验证弹窗能力对齐
- R-010：未收到验证码引导
- R-011：简体中文文案
- R-012 / R-013 / R-014：发送按钮状态、倒计时和恢复
- R-015 / R-016：限频及服务异常回退（后端契约不足处明确 mock/待办）
- R-017：8 个验证埋点
- R-027：Login/Register 回归；Account/Assets 子场景 deferred
- R-029：简体中文 copy

## 7. Deferred 范围

后续批次 `web-next-account-assets-migration`：

- Assets 提币
- Account 安全设置
- 改密
- 绑定邮箱/手机
- API 管理
- 地址管理
- 注销
- BuyCrypto 等尚未迁移消费面

不要在本期通过修改 legacy `apps/web` 假装完成这些 surface。

## 8. 完成标准

1. Login / Register / ResetPassword 均实际消费新的 web-next 验证封装件。
2. 验证方式选择、切换、发送、倒计时、限频回退和未收到验证码路径可用。
3. 8 个埋点在正确用户动作上触发，不因 render/effect 重复上报。
4. 不改变 TR-02386 已迁移页面的 API payload 和主流程。
5. zh-CN 文案齐全；不修改其他 Web locale。
6. 聚焦测试、触达文件 Biome、最小类型检查有真实结果。
7. docs-tdd 只保留能够运行且断言真实契约的最小证据；无 `TBD` 占位证据。
8. 最终汇报包含：变更文件、执行命令、未执行检查、已知风险。

## 9. 当前已知风险

- 限频契约依赖 PR-02189 / PR-02235，未确认前不得猜 API 字段或业务码。
- Auth/security verification 属 P0，高风险点是 API payload、验证码状态隔离、重复发送与埋点重复触发；应做聚焦验证。
- 当前新增业务文件与 docs-tdd 修改都未提交，下一位开始前先看两个仓库各自的 `git status`，不要覆盖用户修改。
- 26 个 DOM-contract 占位文件是待清理垃圾，不代表已完成 26 个验收场景。
