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
