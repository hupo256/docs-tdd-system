<!-- template-version: 1 -->
<!-- template-effective-since: 2026-07-23 -->

# Scope And Phases — PR-02233 【用户端】安全验证校验交互优化

## 本期范围

本仓负责 Web：先建设共享验证码交互基座并交付登录/注册闭环，再将非登录注册场景按资金、账户安全、其他业务入口分批迁移。已有发送、确认和用户信息逻辑优先复用；只有“可用验证方式/切换上下文/冷却恢复”等新增或变更契约使用 MSW 路线 B。App 端在 PRD 范围内，但不由 `@fameex/web` 仓实现。逐项做/不做裁决只见 `00-feature-inventory.md`。

## 阶段计划

| 批次 / Gate | 目标 | 进入条件 | 退出证据 |
|-------------|------|----------|----------|
| G0 | PRD 原文、图片和表格可读 | Lark 文档可访问 | manifest 51 项完整、本地图片 27 张 |
| G2 | Web 范围与 API 策略定稿 | 人工确认 | inventory 确认人/日期 + intake fingerprint |
| P0 / G3-G4 | 共享能力与 MSW 契约 | G2 通过 | resolver/state tests、handler contract tests、技术方案无悬空项 |
| P1 | 登录/注册闭环 | P0 可用 | 组件/Browser/视觉证据，可独立提测 |
| P2-A | 资金场景（提币、内部转账、白名单、地址） | P1 回归通过 | 每入口 Browser 证据 |
| P2-B | 账户安全（密码、邮箱、手机、GA、三方、注销、API） | P2-A 共享问题已收敛 | 每入口 Browser 证据 |
| P2-C | 买币等其余场景 | P2-B 共享组件稳定 | 每入口 Browser 证据 |
| G5 | 真实 API 对账 | 后端契约 ready | DTO/字段/错误码/cooldown 逐行销账；handler 停用或转测试 |
| G6-G7 | 自测与提测 | 实现完成 | lint/typecheck/tests + Browser/视觉 + QA 结果 |

## 分批原则

- P1 不等待所有 19 类场景改完即可独立提测，但不能据此宣称整单完成。
- 每批复用同一共享组件和状态机，不在业务模块复制发送/倒计时逻辑。
- 资金/账号安全入口必须逐入口验证调用参数和失败不生效语义。
