# PR-02233 原子需求拆解草案（待 review）

> 交付目标：`apps/web`（@fameex/web，由 docs-tdd.config `productionBuild --filter @fameex/web` 锚定）。`apps/web-next` 不在本次 surface 范围（待用户确认）。
> App(iOS/Android) 全部 `deferred`（v3.1 不变量 #1，兄弟团队交付）。
> 风险初判 **V2**（funds/提币 + authentication-surface + password + multiple-entry-points + shared-component）。
> 依赖切分：限频策略→PR-02235；短信后台/有效期→PR-02189；通行密钥→PR-02234（本 PR 均 not-doing，仅前端消费其返回）。

## 已定位的真实复用点（surface 锚点）
- `components/VerifyInputs/`（登录/校验输入 + 获取验证码按钮 + useCountdown）
- `components/CodeVerifyDialog/`（CodeInput + store）、`components/CodeVerifyModal/`
- `utils/hooks/useCountdown`、`utils/hooks/useSmsErrorBar`
- `services/api/user`（useGetEmailValidCode / useGetSmsValidCode）
- `apps/Login/`（LoginForm / InputAccount）、`apps/Register/RegisterV2/`
- `apps/Balance/Trade/components/SecurityVerificationModal.tsx`（提币双重校验弹窗）
- `apps/Account/`、`apps/BindEmail/`、`apps/BindGoogle/`、`apps/ApiManagement*`、`apps/AddressManagement/`、`apps/DeleteAccount/`、`apps/BuyCrypto/`
- i18n：`i18n/locales/zh-CN/codeVerify.json`（已有 `no-get-code:"没有收到验证码？"`）

## 原子需求（doing = 本期做；deferred = App/延期；not-doing = 他 PR）

| ID | 语句（Web） | 关键 sourceIds | surface（locator） | evidence | 集合 |
|-|-|-|-|-|-|
| R-001 | 注册校验页「切换验证方式」文案→「没收到验证码？尝试邮箱注册」，点击回注册页首步、不保留已填验证码 | SRC-4CBCA7640099, SRC-976BC1717B44, SRC-A10EDBB3130B, SRC-E9340E359735, SRC-88AE784CEEE0 | apps/Register/RegisterV2 校验步骤 | copy-literal + component-dom + browser-interaction(runtime) | none |
| R-002 | 登录校验页移除旧「切换验证方式」(跳回登录页的无效入口) | SRC-069875091668, SRC-15FEF963C1CB, SRC-4E02866959D4 | apps/Login/LoginForm + VerifyInputs | component-dom | none |
| R-003 | 登录校验区【确认】下方新增【切换验证方式】入口，仅当绑定 ≥2 种方式时展示，单一方式隐藏 | SRC-766B6B55EA75, SRC-A3D32D48F59C | VerifyInputs / 登录校验区 | component-dom + pure-logic(展示条件) | none |
| R-004 | 点击弹出「切换验证方式」弹窗：标题/副标题、列表项(图标+名称+脱敏说明+【当前】)、GA显"30秒自动更新无需发送"、排序 GA→邮箱→手机、✕/遮罩关闭不改当前 | SRC-0CC76D6FFA98, SRC-766B6B55EA75, SRC-D1C2FCC8327C | 新组件 SwitchVerifyMethodDialog | copy-literal + component-dom + browser-interaction(runtime) | none |
| R-005 | 选择后弹窗关闭、校验区切换为所选方式输入样式；进入默认取最高优先级(GA>邮箱>手机) | SRC-D1C2FCC8327C, SRC-15FEF963C1CB | VerifyInputs 状态切换 | pure-logic + browser-interaction(runtime) | none |
| R-006 | 验证方式优先级规则(注册单一;登录单一可切换 GA>邮箱>手机;提币/改密强制双重取前两位;其他敏感单绑单一/双绑双重) | SRC-F3D6C645F528, SRC-C0746CE00864 | 优先级 resolver（新 util/hook） | pure-logic | explicit-set(4 场景) |
| R-007 | 除登录/注册外所有校验场景统一弹窗模式（登录注册保留页面） | SRC-BEC8EFD0E36A, SRC-55D95BA8AC0B, SRC-E714C1CABE9F + img-005~021 | SecurityVerificationModal + 各 Account/API/Address/Delete/BuyCrypto 入口 | component-dom + browser-interaction(runtime) | explicit-set(≈13 场景) |
| R-008 | 改/绑邮箱手机：表单页只验证"新绑定目标"(新邮箱/手机+验证码四态)，账户身份校验移到提交后弹窗；弹窗方式按优先级(改=GA+旧可切换; 首绑手机(仅邮箱)=邮箱单一固定; 首绑邮箱(有手机+GA)=GA+手机固定) | SRC-76838D100679, SRC-92A84661A698~SRC-FB35C5272486 | apps/BindEmail, apps/Account 改邮箱/手机, SecurityVerificationModal | component-dom + pure-logic + browser-interaction(runtime) | explicit-set(表单→弹窗流转分支) |
| R-009 | 验证码输入区下方固定展示【没有收到验证码？】入口，一个校验场景只出现一次(双重校验也只一个) | SRC-D02ADA9DD1B7 | VerifyInputs / CodeVerifyDialog | component-dom | none |
| R-010 | 点击弹「没有收到验证码？」引导弹窗：标题固定、邮箱/手机双Tab恒显、默认Tab按当前请求类型(邮箱+手机默认邮箱)、底部客服icon+已知晓、点Tab仅切正文、点客服打开客服、点已知晓关闭 | SRC-08A9C49EE710, SRC-D45835AF504D, SRC-F0DD46F2CF92, SRC-803C0C33923D, SRC-88BBE9AC8B14, SRC-00EDCEFE08AC | 新组件 NoCodeGuideDialog | copy-literal + component-dom + browser-interaction(runtime) | none |
| R-011 | 邮箱/手机 Tab 排查文案逐字（多语言，无 hardcode 中文） | SRC-F4D864E9F7B6, SRC-D468D1439B42, SRC-BB45F7C18D26, SRC-95016299905F | codeVerify.json + NoCodeGuideDialog | copy-literal | explicit-set(2 Tab 文案) |
| R-012 | 获取验证码按钮四态(初始/加载三点动画/已发送倒计时+icon/重新发送)，加载态+已发送态禁用 onclick | SRC-CA76DF87391B, SRC-F1E335E224CA | VerifyInputs 按钮 + useCountdown | component-dom + pure-logic | explicit-set(4 态) |
| R-013 | 已发送态 icon tooltip「{n}秒后可重新发送验证码，有效期为10分钟」，{n}每秒刷新；Web 悬浮显示/移出隐藏 | SRC-F1E335E224CA, SRC-7668A8B65525 | VerifyInputs tooltip | copy-literal + component-dom | none |
| R-014 | 切换方式后各方式倒计时独立、切回保留；刷新/重进由后端冷却截止时间戳恢复剩余秒数 | SRC-E16FF335C138, SRC-A3D32D48F59C, SRC-ACF9FEEB80B5 | VerifyInputs/useCountdown + services/api/user | pure-logic + payload-contract | none |
| R-015 | 限频类失败：Toast 提示原因 + 按钮冷却禁用，禁用期点击前端拦截不发请求再 Toast；冷却时长以后端为准 | SRC-31EE6F0F4EA3, SRC-728F13C27762 | VerifyInputs + useSmsErrorBar | pure-logic + component-dom | none |
| R-016 | 服务异常(网络/服务端)：按钮从加载态回退初始/重发态，Toast 错误码，不进倒计时可立即重试 | SRC-84C804D128DD, SRC-281C56C3C654 | VerifyInputs 错误处理 | pure-logic + component-dom | none |
| R-017 | 验证交互全事件埋点(verification_scene_view/click_get_code/code_send_result/hit_rate_limit/switch_channel/view_no_code_guide/code_verify_submit/code_verify_result) | SRC-9920F59580C2 | posthog 埋点(VerifyInputs 已用 posthog) | pure-logic + payload-contract | explicit-set(8 事件) |

## deferred（App，owner=App团队，batch 待定）
- D-A1 App 端验证码「快捷填充」重复填入修复（SRC-E4A700D2F82D, SRC-73D64CB69F5F, SRC-83AF8F66B3E0）
- D-A2 App 端 tooltip 点击交互、App 切换注册方式保持不变、App 新增切换验证方式入口（R-001/R-004/R-013 的 App 部分）

## not-doing（他 PR，仅引用/消费）
- 限频策略本体、错误码文案 → PR-02235（SRC-F5646D2E67BA）
- 短信下发渠道/有效期10分钟/多渠道降级 → PR-02189（需求背景 SRC-DA5AFF0BA7C8 优化目标）
- 通行密钥备用验证 → PR-02234

## 待用户确认
1. 交付目标 = `apps/web`，web-next 不做？
2. R-014/R-015 依赖后端返回「冷却截止时间戳」「限频类型/错误码」——若这些字段来自 PR-02189/PR-02235 尚未交付，apiDependency 该标 `pending-dependency`（阻断 ready-to-test）还是 `real-api`（字段已存在）？需要你确认后端契约现状。
3. R-007 的"所有场景"是 explicit-set，需逐一列全（≈13 个）才能防漏；我按验收标准+截图列，你补充遗漏场景。
