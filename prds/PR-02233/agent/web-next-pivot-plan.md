# PR-02233 → web-next 迁移与再定范围 实施计划

> 状态：阶段 0 已完成（TR-02386 已单向合入 PR-02233）。其余待执行。

## 决策基线（已拍板）

1. 职责边界：TR-02386 = 纯技术迁移（登录 + 注册 + 重置密码 → web-next）；PR-02233 = 安全验证校验交互优化，建在 TR-02386 之上，逻辑上不碰 Account。
2. 本期范围：PR-02233 只做「验证封装件 + 登录/注册/重置密码三页应用」。Account/Assets 全部 deferred，必须在 work-item 记录待补（否则过不了 QA）。
3. 分支拓扑：TR-02386 单向合入 PR-02233，不反向；后续 TR-02386 更新继续往 PR-02233 合。TR-02386 随 PR-02233 一起上线。
4. re-scope 走正规路径：更新抽取输入后跑 docs-tdd extract 重生 work-item（指纹自洽），不手改 work-item.json。

## 关键约束

- docs-tdd.config.json baseRef 是全局 origin/online，不改；合并后 PR-02233 已含 online，基线可过；不必再跑 worktree-prepare。
- dev-check/evidence 用 --base origin/online 算改动集，会含 TR-02386 迁移文件（决策 3 接受），以本 PR 自有 surface 人工甄别。
- work-item.json 受指纹保护，变更只能经 extract 重生 + run 重新过审。
- web-next = Vite 8 + TanStack Router + React 19；已有 CodeVerifyDialog(+store+CodeInput)、utils/hooks/useCountdown、platform/posthog/postHog.ts，须复用。
- 重置密码已迁到 apps/web-next/src/apps/ResetPassword（index/ResetForm/CodeVerifyDialog+store），路由 (main)/(with-footer)/login-resetpass，含 4 endpoint 契约 + payload 单测。

## 阶段 0 — 分支拓扑就位 [已完成]

- [x] TR-02386 补齐 /login-resetpass 迁移（提交 6112209b25）。
- [x] git merge --no-ff feature/TR-02386 → feature/PR-02233（合并提交 bee7970706），无冲突。
- [x] 验证：web-next 三页 + 路由就位；工作树 clean；HEAD 含 online。

## 阶段 1 — 正规 re-scope（extract 重抽 + 过审）

- [ ] 更新 agent/requirements-draft.md：交付目标 apps/web → apps/web-next（登录/注册/重置密码 + 验证封装件）。
- [ ] A1 保留+重定位（本期做）：
      R-001 S-001 → apps/web-next/src/apps/Register/
      R-002 S-002 → apps/web-next/src/apps/Login/LoginForm.tsx + 封装件
      R-003 S-003 → 封装件 + Login
      R-004 S-004/S-066 → 封装件 SwitchVerifyMethodDialog
      R-005 S-005 → 封装件 + Login
      R-006 S-006 → 封装件 methodResolver.ts；S-095/S-096 → Register/Login
      R-009 S-009 → 封装件（对齐 CodeVerifyDialog+store）
      R-010 S-010 → 封装件 NoCodeGuideDialog
      R-011 S-011 → apps/web-next/src/i18n/resources/zh-CN/codeVerify.json
      R-012 S-012 → 封装件 SendCodeButton + web-next useCountdown
      R-013 S-013 → 封装件
      R-014 S-014 → 封装件（web-next useCountdown）
      R-015 S-015/S-088 → 封装件（限频契约待 PR-02189/02235，先 mock）
      R-016 S-016 → 封装件
      R-017 S-017/070-076 → 封装件 tracking → postHog.ts
      R-027 S-060/061/064/065/102 → web-next 登录/注册回归
      R-029 S-089 → apps/web-next/src/i18n/resources/zh-CN/
- [ ] A2 defer+记录（批次 web-next-account-assets-migration）：
      R-006 S-007/S-097（Assets 提币）、S-086/S-098/S-099（Account）
      R-007 S-030~S-043 + S-042（全 14）
      R-008 S-050~S-054（全 5）
      R-027 S-062/S-063（提币/安全设置回归）
- [ ] 新增 ResetPassword 应用 surface（gap 1）：R-009~R-017 各加一条 apps/web-next/src/apps/ResetPassword；R-028 维持 not-doing。
- [ ] 证据 spec 迁移：apps/web/src/__tests__/PR-02233/*.spec.ts → web-next co-located（封装件 components/verification/test/；页面 apps/{Login,Register,ResetPassword}/test/；埋点 *.tracking.test.tsx）。A2 spec 挂起标 deferred。
- [ ] docs-tdd extract PR-02233 → docs-tdd run PR-02233 过审。

## 阶段 2 — 搬运纯逻辑模块（框架无关）

- methodResolver.ts(+test) → components/verification/（直搬）
- sendCodeError.ts(+test) → components/verification/（直搬）
- tracking.ts → components/verification/（改接 postHog.ts）
- countdown.ts(+test) → 并入 web-next useCountdown 生态（去重核对）
- 作废重写：CodeVerifyDialog/index.tsx、VerifyInputs/index.tsx、NoCodeGuideDialog.tsx、SendCodeButton.tsx、useCountdown.ts 的旧 apps/web 改动（阶段 5 清理）。

## 阶段 3 — 封装件重建（对齐 web-next）

- methodResolver（优先级解析）
- SwitchVerifyMethodDialog（R-003/004/005）
- NoCodeGuideDialog + codeVerify.json zh-CN（R-009/010/011）
- SendCodeButton 四态 + tooltip + 多方式独立倒计时 + 冷却恢复（R-012/013/014）
- 限频拦截 + 服务异常回退（R-015/016，契约 mock）
- tracking 8 事件（R-017）

## 阶段 4 — 三页应用

- Login：移除旧切换入口(R-002) + 新切换入口(R-003) + 默认优先级(R-006 登录) + 封装件
- Register：文案改造(R-001) + 注册优先级(R-006 注册) + 封装件
- ResetPassword：页面形式保留 + 封装件（按钮四态/没收到验证码/倒计时/埋点）

## 阶段 5 — 证据 / checkpoint / gate

- 逐 surface 补规范 spec。
- docs-tdd checkpoint 提交真实改动路径与覆盖 surface。
- 阶段边界 docs-tdd gate；Biome 只跑触达文件；旧 apps/web 死代码清理。

## 已知风险

- 限频契约（PR-02189/02235）未交付 → R-014(S-103)/R-015(S-088) 本期「结构就绪 + mock」，真实证据待契约。
- 合入 TR-02386 后 dev-check 改动集含迁移文件（决策 3 接受）。
- App/后台/运营 deferred 批次维持不变，非本 PR。
