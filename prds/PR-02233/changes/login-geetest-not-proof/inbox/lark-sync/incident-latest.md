---
sourceName: "缺陷报告"
sourceType: "markdown"
sourceUrl: "/Users/aven/github/docs_tdd/prds/PR-02233/inbox/login-geetest-not-proof-2026-09-26.md"
syncedAt: "2026-09-26T18:38:31.889Z"
readOnly: true
command: "local-markdown ../docs_tdd/prds/PR-02233/inbox/login-geetest-not-proof-2026-09-26.md"
---

# PR-02233 本地登录页 Geetest not proof

## 现象

在本地运行项目并访问 `/login`，提交账号和密码拉起极验时，终端或浏览器日志出现：

```text
GeetestError: not proof
```

## 根因

同一个 Geetest v3 实例首次启动验证前调用了 `reset()`。首次验证尚无 proof 可重置，因此 SDK 报 `not proof`。

## 需求

修复验证码启动顺序：新 challenge 对应的实例首次打开只调用 `verify()`；用户关闭后复用同一实例再次打开时，调用 `reset()` 后再调用 `verify()`。

## 验收

- 本地 `/login` 首次拉起验证码的调用顺序为 `verify`。
- 关闭后再次拉起同一验证码实例的调用顺序为 `reset`、`verify`。
- 两次操作均不出现 `GeetestError: not proof`。
- 不修改登录接口、验证码参数接口、其他页面或全局测试基础设施。
