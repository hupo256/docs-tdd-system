# PR-02440 API 契约：API 权限与体验金互斥

## 业务背景

「合约体验金 / 增强体验金」与「API 权限」互斥：

- **场景 1**：用户已创建 API Key → 不允许再领取合约/增强体验金。
- **场景 2**：用户存在使用中的合约/增强体验金 → 不允许再创建 API Key。
- **场景 3**：存量同时存在 API + 使用中体验金的用户，由后端/运营排查处置；本期不在 API 交易链路补校验。

## 推荐方案：新增聚合查询接口

建议新增一个只读查询接口，统一返回两个布尔状态，避免前端从展示接口推断。

### 接口

```http
GET /fe-ex-api/openapi/api-trial-fee-mutex
```

- 需要登录鉴权。
- 幂等，建议缓存 5~30 秒；前端登录后自动查询。

### 响应契约

```json
{
  "hasApi": true,
  "hasUsingTrialFee": false
}
```

| 字段               | 类型      | 必填             | 语义                                                                                                           |
| ------------------ | --------- | ---------------- | -------------------------------------------------------------------------------------------------------------- |
| `hasApi`           | `boolean` | 否，默认 `false` | 当前用户是否已创建 API Key。只要存在任意一个有效 API Key 就为 `true`。                                         |
| `hasUsingTrialFee` | `boolean` | 否，默认 `false` | 是否存在使用中的合约/增强体验金，包括已激活且余额 > 0、持有体验金仓位/委托，或其他业务上视为「使用中」的状态。 |

**兼容性**：字段允许缺失或为 `null`，前端会兜底为 `false`，避免老接口格式差异导致页面空白。

## 前端使用位置

### 1. 创建 API 前阻断（场景 2）

文件：`apps/web/src/apps/ApiManagement/components/CreateApi.tsx`

若 `hasUsingTrialFee === true`，Toast：

> 存在使用中的体验金，暂无法创建 API，请在体验金使用结束后重试。

不再发起 `POST /fe-ex-api/openapi/create_open_api`。

### 2. 领取体验金前阻断（场景 1）

文件：`apps/web/src/apps/MyRewards/index.tsx`

若 `hasApi === true` 且当前卡券为合约/增强体验金，Toast：

> 已创建 API，暂无法领取体验金。请删除 API 后重试。

不再打开领取弹窗，也不发起 `POST /fe-ex-api/api/trial-fee-coupon/activate-check`。

## 备选方案（如后端不倾向新增接口）

### 备选 A：create_open_api 增加错误码

`POST /fe-ex-api/openapi/create_open_api` 在场景 2 时返回稳定错误码，前端直接按错误码 Toast。

### 备选 B：activate-check 增加 hasApi 字段

`POST /fe-ex-api/api/trial-fee-coupon/activate-check` 响应增加 `hasApi`，前端在弹窗内领取前阻断。相比推荐方案会多一次无效请求。

## 建议优先级

1. **首选**：新增 `GET /fe-ex-api/openapi/api-trial-fee-mutex`。
2. **次选**：在 `create_open_api` / `activate-check` 分别增加稳定错误码或字段。

## 需要后端确认

1. `hasApi` 是否包含子账号 API Key？是否区分只读/交易/提现权限？
2. `hasUsingTrialFee` 是否覆盖增强体验金？是否覆盖「部分使用」「激活中未交易」？
3. 存量用户处置方案是什么？强制失效体验金、强制删除 API，还是白名单放行？
4. 接口只返回布尔即可，文案由前端按语种自行拼接，是否需要后端按语言返回文案？
