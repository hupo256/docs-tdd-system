# Startup Prompt

新需求在新会话（Claude 或 Codex）里发：

```text
用 prd-to-commit，项目号 <PROJECT-ID>，PRD：<Lark 链接>
```

可追加：Figma 链接、接口契约/YApi 文件、「只做 web / admin」、「这是 fix」。流程与约束以 `~/.ai-rules/skills/prd-to-commit/SKILL.md` 为准；你只需在需求清单出来时确认一次（尽量把枚举码、接口路径答全）。完整使用说明与实测数据见 [usage.md](/Users/aven/.ai-rules/labs/prd-to-commit/usage.md)。

存量项目按其 README `workflowVersion` 继续旧流程；旧的 Web Lite 口令已废弃。
