# PR-02233 开发规则

继承 `../../../common/README.md`。本文只记录本项目特殊约束。

## 项目特殊约束

1. `@fameex/web` 仅实现 Web；不得在本仓伪造 App 完成证据。
2. 既有登录/注册/发码/确认 API 优先复用；新增或变更契约只通过 MSW 路线 B推进，组件和 service 禁止 `USE_MOCK` 分支。
3. 登录 bootstrap 新字段必须后向兼容：字段缺失时维持当前单方式登录并隐藏切换入口。
4. 邮箱和手机 cooldown 独立，以绝对截止时间为事实源；切换方式、组件 remount 或页面刷新不得无条件重置。
5. 资金与账户安全 mutation 只能在身份验证成功后触发；取消、错误、关闭弹窗均不得提前生效。
6. 一个验证场景最多一个“没有收到验证码？”入口，即使有两个验证码字段。
7. 新增固定文案只改 zh-CN；其他 locale 由翻译流程处理。所有 PRD 固定中文配 literal test。
8. `VerifyInputs`、`CodeVerifyDialog`、`CodeVerifyModal` 先收敛共享 resolver/state，不允许再新增第四套验证码发送状态实现。
9. 开发途中默认不 rebase / merge `online`；仅当存在无法继续的明确基线依赖，或负责人明确要求时才同步，并须先说明原因与影响。
