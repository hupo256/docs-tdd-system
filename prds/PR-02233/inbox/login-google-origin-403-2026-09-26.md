# PR-02233 本地登录页 Google GSI 403

## 现象

在本地运行项目并访问 `/login` 路由时，浏览器控制台出现以下错误：

```text
Failed to load resource: the server responded with a status of 403 ()
[GSI_LOGGER]: The given origin is not allowed for the given client ID.
Permissions policy violation: unload is not allowed in this document.
```

Google 登录按钮请求中使用的 client ID 为：

```text
101389973071-afr2sl8qk7ip2ts01183gsle2i3a91gu.apps.googleusercontent.com
```

## 需求

定位本地 `/login` 页面 Google GSI 请求返回 403 的原因并修复，使本地允许的访问来源可以正常加载和使用 Google 登录入口。

## 验收

- 在约定的本地访问地址打开 `/login` 时，不再出现 Google GSI 的 origin-not-allowed 403。
- Google 登录入口可以正常加载并发起既有登录流程。
- 明确记录实际根因，以及本次修复适用的本地 origin 或环境配置。
- 单独判断 `Permissions policy violation: unload is not allowed in this document` 是否与 403 有关；没有证据时不将其视为同一根因。
- 不改变生产环境 Google 登录行为，不扩展到与该错误无关的登录功能。

