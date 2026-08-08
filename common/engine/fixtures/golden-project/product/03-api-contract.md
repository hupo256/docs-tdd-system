# PR-00000 API 契约（golden fixture）

## 1. 接口清单

| 接口 | 方法 | 用途 |
|------|------|------|
| /api/golden/board | GET | 榜单列表 |

## 6.1 MSW 路线 B 清单

本项目走 MSW 路线 B：handler 落在 `src/mocks/handlers`，删 handler 即切真实接口，
schema / mapper / 契约测试保留。

| handler | 场景 |
|---------|------|
| board | normal |
| board | empty |
| board | error |
| board | unauthorized |
| board | edge |

契约测试用真实 schema：`schema.parse(fixture)` 必须通过，字段缺失即失败。

worker 注册仅 dev 环境：`browser.ts` 只在 dev-only 分支启动，生产构建不注册。

## 7. 字段对账与文案契约

字段来源已按真实 API 契约核对；本夹具没有未决字段。

| 文案 ID | zh-CN key | 动态变量 |
|---------|-----------|----------|
| 榜单标题 | `golden:board.title` | 无 |
