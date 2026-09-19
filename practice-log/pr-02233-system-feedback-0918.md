# docs-tdd 门禁反馈（供下轮系统迭代）

> 记录人：AI 协作会话。场景：PR-02233 web-next 登录「切换验证方式」编码完成后，`git commit` 被
> husky pre-commit 的 docs-tdd 守卫拦下。以下为用户提出的三个问题 + 现场查到的事实证据。

## Q1. 「docs-tdd V2」是什么？系统不是已经 v3.x 了吗？

事实：

- 拦截依据的「版本」不是**引擎/系统版本**，而是**每个项目自己钉的 `workflowVersion`**。
- 本项目 `apps/web/docs_tdd/prds/PR-02233/work-item.json` 顶部写死：
  - `"schemaVersion": 1`
  - `"workflowVersion": 2`
- 引擎 `docs-tdd.mjs` 通过 `lib/workflow-version.mjs` 的 `workflowVersionForProject()` 读取该字段，
  据此决定走 v1 还是 v2 命令面板与守卫；`changed` 被判为「v1-only」而拒绝，正是因为该项目是 v2。
- 结论：即便系统/引擎升到 v3.x，只要 `work-item.json` 仍是 `workflowVersion: 2`，守卫就按 v2 语义运行。
  **待确认**：v3.x 引擎是否应自动迁移旧项目的 `workflowVersion`，或提示项目升级；否则新老版本语义会长期并存、易误解。

## Q2. 它凭什么拦我的 `git add` / `commit`？我没改项目状态。

事实（拦截来自 husky → lint-staged → `precommit-verify-code-rules.mjs`）：

- 该脚本自述：在 v2 分支上「read-only guard 默认走 checkpoint 模式：仅在**已存在**一次通过的 dev-check 时才强制」。
- 但本批次从未产出上游状态，于是守卫**fail-closed**，报出一串「缺失/过期」：
  - coverage audit source/requirements fingerprint is stale
  - coverage audit verdict is not pass
  - current scope has not passed independent review
  - current V2 scope approval is missing or stale
  - checkpoint commit requires a passing dev-check
  - staged paths differ from the dev-check pending commit paths
- 关键澄清：拦截**不是因为用户改了项目状态**，而是因为守卫要求的上游状态（review / scope-approval /
  dev-check / coverage fingerprint）从来没被生成，缺省即「未通过」。守卫是「默认拒绝」而非「检测到变更」。
- **体验问题**：一次普通的即时保存（用户主观无害）被一套重流程门禁挡死，且错误信息把「从未产出」表述得像
  「已损坏/过期」，容易让人误以为是自己破坏了状态。建议下轮：
  1. 区分「首次、从未建立 checkpoint」与「曾通过但已过期」两种文案；
  2. 为「WIP / 即时保存」提供官方轻量路径（如 `docs-tdd checkpoint --wip` 或允许 `DOCS_TDD_COMMIT_MODE`
     的非交付档位），避免用户被迫在 `--no-verify` 与「无法保存」之间二选一。

## Q3. deliveryScope policyPaths 与实际改动不匹配（可直接修的硬伤）

事实：本 PR `work-item.json` 的 `deliveryScope.policyPaths` 仅含：

```
apps/web-next/src/components/verification
apps/web-next/src/apps/Login
apps/web-next/src/apps/Register
apps/web-next/src/apps/ResetPassword
```

而登录「切换验证方式」实际必须触达、却被判「outside deliveryScope」的路径：

- `apps/web-next/src/components/VerifyInputs/*`（登录/注册验证步的核心共享组件，批次绕不开）
- `apps/web-next/src/i18n/resources/zh-CN/codeVerify.json`（新增文案 key）
- `apps/web-next/src/mocks/pr02233/handlers.ts`（本 PR 自带 mock）
- `apps/web-next/src/platform/domain/web/endpoints/loginInEndpoint.ts`（login_in 契约扩展）
- `apps/web-next/src/components/AccountInput/index.tsx`、`components/ThirdPartyLogin/ThirdPartyBtns.tsx`、
  `styles/tailwind-theme-legacy.css`（部分为更早会话已 staged 的关联改动）

问题：`policyPaths` 明显**低估了本批次的真实作用面**——`VerifyInputs`、该 PR 自己的 mock、自己的
i18n namespace、自己的 endpoint 契约都应在 scope 内。建议下轮：

- 由 scope 定义阶段基于「需求→受影响文件」推导 policyPaths，而不是只列几个 feature 目录；
- 或在守卫报「outside scope」时，提示「建议加入 policyPaths 的候选路径」，降低反复试错成本。

## 【stakeholder 决策】R-004 列表排序改为 Figma 顺序

- 背景：R-004 原文写「排序 GA→邮箱→手机」，但 Figma 设计稿（node 19834:3367 切换弹窗）列表顺序为
  **邮箱 → 手机 → 谷歌(GA)**，两者冲突。
- 决策：stakeholder（会话中用户，PRD 评审名单含 Aven.tong）明确指示「都要按 Figma」，列表展示顺序改为 Figma 顺序。
- 已落地：`switchMethod.ts` 的 `orderedVerifyTypes` 改为 `[Email, SMS, Google]`；`switchMethod.test.ts` 与
  `SwitchVerifyMethodDialog.browser.test.tsx` 同步。
- 待办（系统侧，intake 修复时）：同步更新 `work-item.json` 中 R-004 原文的排序子句，避免代码与需求长期不一致。
  （本次未直接改 work-item.json 需求原文，因其受 intake source-attribution 门管控，不宜 AI 单方面改写。）
- 区分：本次只改【弹窗展示顺序】；登录【默认选中方式优先级】（R-005/R-006，GA>邮箱>手机）在别处决定，未动。

## 【越 scope 修复】为解本地运行而改的 runtime 文件

- `src/platform/runtime/server/ServerCmsBaseUrl.ts`：用 `createIsomorphicFn` 隔离服务端专用 `getRequestHeader`，
  消除 `import-protection` 在 client 图拦截 `@tanstack/react-start/server` 的 warning（根因：`Runtime.ts` 顶层静态
  import ServerContext，把 server-only 图拉进 client）。已跑 `ServerCmsBaseUrl.test.ts` 3/3 无回归。
- 同模式未处理：`src/i18n/core/localeCookie.ts` 也 import 了 `@tanstack/react-start/server`（getCookie/setCookie），
  未在 trace 中则未动；属 i18n 基础设施，待确认。
- 这两个文件都不在本 PR deliveryScope，为解本地运行而改，交付时需归属清楚。

## 本次的即时保存位置（防丢）

- 补丁：`output-tdd/checkpoints/PR-02233-latest.patch`
- 可恢复 git 对象 ref：`refs/checkpoints/pr-02233-login-switch`（commit `cf9b75a`）
- 工作区未提交，改动原样保留；提交待 docs-tdd v2 门禁按流程走通或人工统一过。

## 【人工验收 MA-001】已发送态与设计图不一致

- 验收反馈：已发送态应按用户提供的设计图显示为输入框右侧动态文案「45秒后重新发送」并紧跟信息 icon；
  悬浮信息 icon 后 Tooltip 只显示「验证码有效期为10分钟」。
- 实际实现：主状态显示「验证码已发送」；动态倒计时被放入 Tooltip，文案为
  「{n}秒后可重新发送验证码，有效期为10分钟」。
- 判定：**failed → 已修复，等待人工复验**。关联 `R-012 / R-013`，影响共享 `SendCodeButton` 的登录、注册、通用校验弹窗与重置密码消费面。
- 抽取偏差：当前 `work-item.json` 的 R-012/R-013 明确写成了旧实现语义，与人工验收设计图冲突；不能只把它当作代码 bug，
  后续 intake/需求 reconciliation 应将正式契约纠正为「主区域显示动态重发倒计时，Tooltip 只说明 10 分钟有效期」。
- 修复范围：只调整已发送态展示与 zh-CN 文案/DOM 契约，不改变发送请求、倒计时状态、冷却截止时间或限频拦截逻辑。
- 修复结果：共享组件主区域改为动态「{n}秒后重新发送」，Tooltip 改为固定「验证码有效期为10分钟」；同步更新 zh-CN 与 DOM/copy 契约。
- 自动检查：Biome 无错误；`pr-02233-i18n-copy` 7/7、`pr-02233-verification-components` 25/25；web-next typecheck 退出码 0，
  仅输出仓库既有 Effect 建议/警告。
- 证据：用户在人工验收会话提供的目标态截图；等待用户复验，复验前不得标记 passed。

## 【人工验收 MA-002】验证码有效期 Tooltip 背景色错误

- 验收反馈：修复 MA-001 后，Tooltip 实际仍为浅色半透明背景、深色文字；设计目标为深色背景、白色文字。
- 根因：`web-next` 通用 Tooltip 默认继承 glass floating surface，在亮色主题下使用白色半透明背景；验证码场景未覆盖为旧版设计使用的 `bg-7 / text-6` 语义。
- 判定：**failed → 已修复，等待人工复验**。关联 `R-013`，影响共享 `SendCodeButton` 的全部消费面。
- 修复范围：为 convenience Tooltip 增加可选 `popupClassName` 透传能力，并仅在验证码有效期 Tooltip 上设置
  `--fx-floating-surface: var(--color-bg7)` 与 `text-t6`；不改变全站其他 Tooltip 默认主题。
- 证据：用户在人工验收会话提供的实际态截图；等待用户复验，复验前不得标记 passed。

## 【人工验收 MA-003】「没有收到验证码？」入口缺少手型光标

- 验收反馈：登录邮箱验证码页的「没有收到验证码？」为可点击入口，但 hover 时没有显示手型。
- 判定：**failed → 已修复，等待人工复验**。关联 `R-009 / R-010`，当前反馈页面为登录/注册共用的 `VerifyInputsView`。
- 修复范围：仅为该入口补充 `cursor-pointer`，不改点击处理、弹窗状态或其他验证逻辑。
- 证据：用户在人工验收会话提供的实际态截图；等待用户复验，复验前不得标记 passed。

## 【人工验收 MA-004】登录账号页输入控件细节与设计不一致

- 验收反馈：账号输入框、密码输入框与登录按钮高度均应为 48px；任一输入框有内容时应显示清空 `×`；账号错误文案应在输入框下方右对齐。
- 实际实现：登录账号与密码输入框使用 `lg`（40px），按钮虽以 `h-12` 覆盖高度但 size 仍为 `lg`；账号字段已有清空能力，密码字段只有显隐按钮；账号错误沿默认左侧排列。
- 判定：**failed → 已修复，等待人工复验**。影响登录账号步骤；共享密码输入组件的注册与重置密码消费面同步获得清空能力。
- 修复范围：登录账号、密码和按钮统一使用 `xl`（48px）；登录账号错误局部右对齐；`PasswordInput` 复用已有 `TextField` 清空能力，并保留密码显隐按钮。未改校验、提交及密码过滤逻辑。
- 证据：用户在人工验收会话提供的目标态截图；等待用户复验，复验前不得标记 passed。

## 【人工验收 MA-005】三方登录按钮图标与叠层显示异常

- 验收反馈：Google 按钮左侧透出 GSI 叠层水印；HiChat 图标与 online 环境不一致。用户明确要求直接复用 online 的正确实现/资源。
- 根因：`web-next` Google 叠层缺少 online 已使用的 `brightness-0` 隐藏规则，且裁剪样式与 online 不一致；HiChat 使用了首页 banner SVG，而非登录按钮使用的 `/static/icon/HiChat.png`。
- 判定：**failed → 已修复，等待人工复验**。影响登录/注册页共享的三方登录按钮。
- 修复范围：同步 online 的 GSI 叠层视觉隐藏与裁剪类；复制并使用 online 的 HiChat 登录图标资源。不改三方登录点击、SDK 初始化、授权或回跳流程。
- 自动检查：Biome 无错误；`pr-02233-auth-flows` 中对应图标资源与 GSI 叠层契约通过；web-next typecheck 退出码 0，仅输出仓库既有 Effect 建议/警告。
- 证据：用户在人工验收会话提供的实际态截图；等待用户复验，复验前不得标记 passed。

## 【人工验收 MA-006】密码显隐图标未垂直居中

- 验收反馈：48px 密码输入框内的眼睛图标应上下居中。
- 判定：**failed → 已修复，等待人工复验**。影响共享 `PasswordInput` 的登录、注册与重置密码消费面。
- 修复范围：仅为显隐按钮补充满高 flex 居中布局；不改显隐状态、清空能力或密码输入逻辑。
- 自动检查：对应 DOM contract 通过，并纳入 `pr-02233-auth-flows` 16/16。
- 证据：用户在人工验收会话提供的实际态截图；等待用户复验，复验前不得标记 passed。

## 【人工验收 MA-007】国家区号选择区缺少手型光标

- 验收反馈：账号识别为手机号后，国家/区号选择区域 hover 时应显示手型。
- 判定：**failed → 已修复，等待人工复验**。影响共享 `AccountInput` 中的国家区号选择触发区。
- 修复范围：只为可点击的 `CountryCallingCodePicker` 触发区补充 `cursor-pointer`；不改国家列表、号码识别、校验或选中逻辑。
- 自动检查：对应 DOM contract 通过，并纳入 `pr-02233-auth-flows` 16/16。
- 证据：用户在人工验收会话提供的实际态截图；等待用户复验，复验前不得标记 passed。

## 【人工验收 MA-008】清空图标尺寸及密码框图标间距不一致

- 首次验收反馈：账号和密码输入框的清空 `×` 图标应为 14px；密码框清空图标与眼睛图标之间应缩小为 12px。
- 二次校正：用户结合实际截图将清空 `×` 的最终规格修正为 16px，并要求账号清空图标可见边缘距 input 右边 16px；密码框两图标间距仍为 12px。
- 实际实现：`xl` 输入控件继承共享 `FxClearButton` 的 22px 图标和 48px 按钮宽度，导致清空图标偏大，且与密码显隐图标的可见间距过宽。
- 判定：**failed → 已按二次规格修复，等待人工复验**。影响共享 `AccountInput` 与 `PasswordInput` 的清空态。
- 修复范围：局部覆盖账号/密码清空图标为 16px，不修改全站 `FxClearButton` 默认规格；账号框保留 48px 清空按钮占位，使 16px 图标两侧各留 16px；密码框将清空按钮占位宽度设为 16px，并设置业务 suffix 起始间距为 12px。不改清空或密码显隐逻辑。
- 自动检查：Biome 无错误；`git diff --check` 通过；`pr-02233-auth-flows` 20/20，其中 16px 图标、16px 右边距与 12px 图标间距契约均通过。Typecheck 对本轮纯 Tailwind class 调整为 not-required；此前同一工作区 typecheck 已退出码 0。
- 证据：用户在人工验收会话提供的实际态截图与二次尺寸指令；等待用户复验，复验前不得标记 passed。

## 【人工验收 MA-009】国家区号控件与输入区域视觉不一致

- 验收反馈：国家 code 区域的下拉三角过大、右侧缺少竖分隔线；账号和密码的原生 input 区域出现了区别于外层控件的异常背景色。用户提供图 2 作为正确目标态。
- 根因：区号选择器在 `xl` 输入框内继承了 24px 通用下拉图标，且 plain trigger 未带区号/号码分隔结构；浏览器 autofill 对原生 input 单独绘制背景，覆盖了输入组统一底色。
- 判定：**failed → 已修复，等待人工复验**。当前反馈页面为登录账号步骤。
- 样式复验校正：用户进一步明确竖线须精确采用 `ml-2 h-4 w-px rounded bg-cc-1`，替代首次修复的 24px 高 divider 色方案。
- 修复范围：区号三角局部调整为 12px，并在触发器右侧按 `ml-2 h-4 w-px rounded bg-cc-1` 增加竖线；仅对登录账号和密码原生 input 抑制 autofill 背景覆盖。不改区号选择、输入校验、密码显隐或自动填充数据能力。
- 自动检查：Biome 无错误；`git diff --check` 通过；`pr-02233-auth-flows` 23/23，竖线精确样式契约通过。Typecheck 对本轮纯 Tailwind class 调整为 not-required；此前同一工作区 typecheck 已退出码 0。
- 证据：用户在人工验收会话提供的实际态、目标态截图及竖线精确规格；等待用户复验，复验前不得标记 passed。

## 【人工验收 MA-010】R-008 账号改绑页面与安全验证弹窗未落地

- 验收反馈：用户核对 PRD 图 1–5，要求确认三类安全验证弹窗，以及修改/绑定邮箱、修改/绑定手机页面的新流程是否已实现；未实现则本次直接补到 `apps/web`。
- 审计结论：**未实现**。图 1–3 对应的弹窗视觉虽可部分复用既有 `CodeVerifyModal`，但四个账号改绑页面尚未接入；图 4–5 及其对称场景仍是旧流程，账户身份验证码仍与“新绑定目标验证码”混放在表单页。
- 范围校正：`work-item.json` 曾把 Account/Assets 消费面标为等待迁移到 `web-next` 的后续批次；本次 stakeholder 明确要求落到 `apps/web`，该 defer 前提已经失效。实现集合应完整覆盖：修改邮箱、绑定邮箱、修改手机、绑定手机；其他提币/API/地址等敏感操作不随本次扩改。
- 目标流程：表单页只验证新邮箱/新手机本身；通过后再打开账户身份安全验证弹窗。弹窗需覆盖单一固定验证、双重固定验证、双重且邮箱/手机可切换三类。
- 当前状态：**blocked，未伪造完成**。现有提交 DTO 无法表达 PRD 的全部组合：
  - `EmailUpdateReq` 有旧邮箱、短信、GA 字段，但旧邮箱验证码当前为必填；
  - `EmailBindReq` 有短信、GA 字段；
  - `MobileUpdateReq` 只有旧手机 `authenticationCode`、短信与 GA，没有邮箱安全验证码字段，且旧手机/GA 当前均为必填；
  - `MobileBindReq` 只有新手机短信与可选 GA，没有首次绑手机所要求的邮箱安全验证码字段。
- 阻断原因：不能把邮箱验证码塞进 `authenticationCode` / `googleCode`，也不能凭字段命名猜测后端会接收新参数；这会形成 UI 看似完成、实际提交无效的假流程。`backend-integration.md` 也仍将这批 API 的字段/条件必填规则列为待联调确认。
- 解阻所需：后端/API owner 明确四个 endpoint 的最终 request contract（每种绑定状态下允许/必填的邮箱、手机、GA 字段），并确认“新目标验证码”和“账户身份验证码”的服务端校验顺序；契约确认后再一次性实现四页面与三弹窗，并做接口契约测试和人工视觉验收。

## Q4. `policyPaths` 白名单如何决定？为何 `CodeVerifyDialog` 等未纳入？

> 记录场景：PR-02233 在验证链路统一 `useStringTranslation` + 字符串 key 时，`git commit` 再次被
> docs-tdd checkpoint 守卫拦下；Biome 已通过，失败原因为 staged 路径 **outside deliveryScope.policyPaths**，
> 其中包含 `CodeVerifyDialog/CodeVerifyDialogBody.tsx`、`useCodeVerifyCopy.ts` 等。供 docs-tdd v3.5+
> 「deliveryScope 自动推导」迭代收集信息。

### 白名单由谁、怎样决定

1. **来源**：每个项目在 `work-item.json` → `deliveryScope.policyPaths` 里**人工维护**一批「仓库相对路径」；
   不是从 git diff 或 requirement 自动展开的全量列表（引擎侧自动推导见
   `practice-log/ITERATION-PLAN-v3.5-20260917.md` §4，状态为「已存在待改」）。
2. **匹配规则**（`common/engine/agent-scripts/lib/vnext-delivery-scope.mjs`）：
   - 路径先 normalize（去 `./`、统一 `/`、去尾斜杠）；
   - staged/changed 路径 **等于** 某条 policyPath，或 **以 `policyPath/` 为前缀**，则视为在 scope 内；
   - 单文件 policyPath（如 `.../loginInEndpoint.ts`）只覆盖该文件本身，不覆盖同目录兄弟文件；
   - `policyPaths` 为空数组时 **不做路径限制**（当前 PR-02233 非空，故 fail-closed）。
3. **谁消费**：`dev-check`、`checkpoint`、`precommit-verify-code-rules.mjs` / `vnext-delivery-guard.mjs`
   等层共用同一套 `outOfScopeDeliveryPaths`；任一层发现越界即报错，与「是否改动了 work-item 状态」无关。
4. **与需求的关系**：`deliveryScope.includedRequirementIds`、`deferred` 描述**需求/批次边界**；
   `policyPaths` 描述**允许改动的代码路径边界**。二者应一致，但 today 没有强制从 requirement→path 的生成链路，
   容易出现「业务上同属本 PR、路径上未写入 policyPaths」的落差。

### PR-02233 当前白名单（2026-09 会话核对）

`work-item.json` 中 `deliveryScope.policyPaths` 已为（相对上文 Q3 的初版有所扩充）：

```
apps/web-next/src/components/verification
apps/web-next/src/components/VerifyInputs
apps/web-next/src/components/AccountInput
apps/web-next/src/components/ThirdPartyLogin
apps/web-next/src/apps/Login
apps/web-next/src/apps/Register
apps/web-next/src/apps/ResetPassword
apps/web-next/src/mocks/pr02233
apps/web-next/src/i18n/resources/zh-CN/codeVerify.json
apps/web-next/src/platform/domain/web/endpoints/loginInEndpoint.ts
apps/web-next/src/styles/tailwind-theme-legacy.css
```

说明：Q3 中列出的「仅四个 feature 目录」已过时；VerifyInputs、mock、codeVerify.json、endpoint 等已在后续 scope 修订中补入。

### 为何 `CodeVerifyDialog` / `useCodeVerifyCopy` 等仍不在白名单

**直接原因**：上述列表按 **目录/feature 名** 枚举，未覆盖与「验证 UX」强相关、但 **物理路径并列** 的共享模块：

| 路径 | 与 PR-02233 的关系 | 未纳入的常见原因（归纳） |
| --- | --- | --- |
| `components/CodeVerifyDialog/*` | 注册/重置等场景的通用验证码弹窗；copy 与 `codeVerify` namespace 绑定 | 与 `verification/`、`VerifyInputs/` **不同目录**；初版 scope 只写了 `verification`（SendCode、SwitchMethod 等），未做「同因搜索」把弹窗壳一并列入 |
| `components/MailBinder/*` | 登录后邮箱绑定等 | 偏 Account 侧，易被 `deferred` 文案（Account/Assets 迁移批次）误当作「本批不改」 |
| `components/VerifyMan/*` | 三方绑定等人机校验 | 同上，路径不在 Login/Register app 目录下 |
| `components/PasswordRuleChecklist/*` | 注册设密规则文案 | 共享组件，不在 Register app 前缀下 |
| `apps/web-next/src/i18n/react/useStringTranslation.ts` | 本次 i18n 试点 hook | 基础设施路径；policyPaths 习惯列 **资源 json** 或 feature 目录，未列 `i18n/react` |
| `apps/shared/auth/LoginButton.tsx` 等 | 登录流入口按钮 copy | 在 `apps/shared` 而非 `apps/Login` |

**机制性原因**（供系统迭代）：

1. **bounded-batch + 手工 policyPaths**：策划/intake 阶段用「主要 feature 文件夹」框边界，而不是从
   surface/requirement 消费链反查全部 touched 模块；`CodeVerifyDialog` 在 legacy/web-next 里都是独立包名，
   不会出现在 `components/verification` 前缀下，前缀匹配天然漏掉。
2. **分批补全滞后于实现**：Q3 反馈后已补 VerifyInputs/mock/i18n 等，但 **同一业务波次** 的 CodeVerifyDialog、
   MailBinder 等未在同一轮 scope 修订中补齐，导致「verification 子树已白名单、弹窗 copy 仍越界」的分裂体验。
3. **deferred 叙事干扰**：`deliveryScope.deferred` 指向 Account/Assets 迁移，容易让人以为「所有 Account 相关 UI 都 defer」；
   实际上登录/注册/重置 **当前批次** 仍会触达 MailBinder、CodeVerifyDialog 等共享件，应与 deferred 解耦写清 policyPaths。
4. **自动推导未落地**：ITERATION-PLAN §4 目标是从 requirement/surface/deferred 生成批次边界；在落地前，
   越界错误仍依赖人工对照 `vnext-delivery-scope.mjs` 规则更新 `work-item.json`。

### 本次 commit 被拦的典型越界路径（i18n 统一批次，摘录）

- `apps/web-next/src/components/CodeVerifyDialog/CodeVerifyDialogBody.tsx`
- `apps/web-next/src/components/CodeVerifyDialog/useCodeVerifyCopy.ts`
- `apps/web-next/src/components/CodeVerifyDialog/index.tsx`（若 staged）
- `apps/web-next/src/components/MailBinder/index.tsx`、`store.ts`
- `apps/web-next/src/components/VerifyMan/index.tsx`
- `apps/web-next/src/components/PasswordRuleChecklist/index.tsx`、`passwordRules.ts`
- `apps/web-next/src/i18n/react/useStringTranslation.ts`
- 以及 `.vscode/settings.json`、其他 locale/Login 外围文件（若一并 staged）

（以守卫实际 stderr 为准；上表来自会话内 staged 集合与 Q3 同类问题归纳。）

### 产品/工程侧可选动作

- **扩 scope（推荐若本批确属交付）**：在 `work-item.json` 增加前缀，例如
  `apps/web-next/src/components/CodeVerifyDialog`、
  `apps/web-next/src/components/MailBinder`、
  `apps/web-next/src/components/VerifyMan`、
  `apps/web-next/src/components/PasswordRuleChecklist`、
  `apps/web-next/src/i18n/react/useStringTranslation.ts`（或整目录 `apps/web-next/src/i18n/react`）、
  以及已改动的 `apps/web-next/src/apps/shared/auth`（若 header 按钮 copy 属本 PR）。
- **拆 commit**：仅提交已在 policyPaths 内的 verification/VerifyInputs 等，其余留后续 scope 修订后再交。
- **非交付/WIP**：官方 `DOCS_TDD_COMMIT_MODE=off` 或文档化的 checkpoint 档位（见 Q2），避免与 `--no-verify` 混用无说明。

### 对 docs-tdd 系统迭代的建议（与 ITERATION-PLAN §4 对齐）

1. scope 定义或 scope-approval 步骤：**从 requirement/surface 消费图建议 policyPaths**，并高亮「与已列目录同级但未覆盖」的共享模块（如 CodeVerifyDialog vs verification）。
2. 守卫报错时输出：**候选 policyPath 前缀**（按目录聚类 staged 越界路径），而不是仅罗列单文件。
3. 区分 **deferred.batch** 与 **policyPaths**：deferred 不应暗示「所有 Account 命名空间代码不可改」，除非 explicit 排除列表写入 work-item。
4. 文档：`common/vnext/README.md` 已说明 policyPaths 为真实写入边界；可补一条 FAQ——「前缀匹配、单文件条目、空数组语义」链到 `vnext-delivery-scope.mjs` self-test 用例。
