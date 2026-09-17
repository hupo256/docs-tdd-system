# PR-02074 开发规则

继承 ../../../common/README.md。本文只记录项目特殊约束，不复制公共规则。

## 项目特殊约束

- test 环境集成若使共享 Runtime 静态连到 server-only 模块，只允许在 Runtime 组合根增加 TanStack server/client 边界；不得在 Prediction 业务模块复制 Runtime、修改 CMS host 规则或关闭 import protection。
