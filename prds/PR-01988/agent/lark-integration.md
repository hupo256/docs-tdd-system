# PR-01988 Lark 接入

> 项目差异配置；通用规则继承 [`../../../common/rules/lark-active-notification.md`](../../../common/rules/lark-active-notification.md) 和 [`../../../common/rules/collaboration-and-notifications.md`](../../../common/rules/collaboration-and-notifications.md)。

## 启用状态

| 能力 | 状态 | 说明 |
|------|------|------|
| 主动发群消息 | 已接入脚本，本机 webhook 配置已就绪 | 用于 G0-G8 进度、阻塞和补信息通知；已完成 G4 阻塞/补信息真实发送 |
| 群内 @ 应用转 task | 未启用 | Webhook 不能接收群内 @；如需启用必须另接 Lark 应用事件订阅 + Bot Gateway + Worker |

## 配置路径

| 文件 | 用途 | Git 策略 |
|------|------|----------|
| `.lark-fe-task/PR-01988.json` | 本机真实 `webhookUrl` / `secret` / 项目标题 | ignored，不提交 |
| `apps/web/docs_tdd/prds/PR-01988/agent/lark-config.example.json` | 占位示例 | 可提交，不含真实密钥 |
| `apps/web/docs_tdd/prds/PR-01988/agent/scripts/notify-lark.mjs` | 项目薄包装入口 | 只调用 common 公共脚本 |

本机真实配置格式：

```json
{
  "project": "PR-01988",
  "title": "预测市场二期",
  "webhookUrl": "https://open.larksuite.com/open-apis/bot/v2/hook/YOUR_HOOK_ID",
  "secret": "YOUR_LARK_BOT_SECRET",
  "autoNotify": true
}
```

## 发送命令

Dry-run：

```bash
node apps/web/docs_tdd/prds/PR-01988/agent/scripts/notify-lark.mjs G5 阻塞 "YApi 32 个接口已同步；请补真实联调环境、Admin permission code、带时间戳接口最终路径、PM fee 精度/错误码、Web 一期 Prediction 代码来源和测试账号。" --dry-run --config apps/web/docs_tdd/prds/PR-01988/agent/lark-config.example.json
```

真实发送：

```bash
node apps/web/docs_tdd/prds/PR-01988/agent/scripts/notify-lark.mjs G5 阻塞 "YApi 32 个接口已同步；请补真实联调环境、Admin permission code、带时间戳接口最终路径、PM fee 精度/错误码、Web 一期 Prediction 代码来源和测试账号。"
```

真实发送前必须确认 `.lark-fe-task/PR-01988.json` 存在且不含占位值。当前已将本机 PR-01988 配置放入该 ignored 路径；不要在文档中展示 webhook/secret。

## 当前补信息口径

1. 真实联调环境、Admin 测试账号和预测市场菜单 / 按钮 permission code；
2. YApi 中带时间戳后缀的 `alert-config` 路径是否为最终稳定路径；
3. PM fee、金额、份额、rate 的字段类型、精度、舍入规则和错误码；
4. Web 一期 Prediction 代码来源、分支、路径，或确认从当前结构新建；
5. 收入导出、分类删除 / 排序 / 启停、事件交易关闭用户侧字段、手动平账限额 / 白名单 / 审计规则。

## 通知记录

实际发送记录写入 [`notification-log.md`](./notification-log.md)。dry-run 只记录为调试结果，不等于已通知。
