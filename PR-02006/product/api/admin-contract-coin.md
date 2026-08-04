# PR-02006 Admin Contract Coin API

> 来源：YApi project `467` / `futures-admin-api`，2026-06-22 已拉取本地快照到 `inbox/yapi/`，后续无需每次重新访问 YApi。

## 接口清单

| YApi ID | Method | Path | 用途 | 本期用途 |
|---------|--------|------|------|----------|
| 4750 | POST | `/config_coin_list` | 合约后台币种分页列表 | 列表查询 / 编辑回显数据来源；response 在 YApi 备注中 |
| 4753 | POST | `/add_config_coin_sub` | 添加币种 | TradFi 币种新增提交 |
| 4756 | POST | `/edit_config_coin_sub` | 币种编辑提交 | TradFi 币种编辑提交 |
| 4759 | POST | `/get_config_coin_list` | 获取币种列表 | 备选列表接口 |

## 6.1 字段对齐

| PRD 字段 / 能力 | YApi 字段 | 类型 / 枚举 | 前端处理 |
|-----------------|-----------|-------------|----------|
| 归属板块 | `type` | `1` 默认 / USDT本位；`2` TradFi | UI 仍展示 USDT本位 / TradFi；提交前映射为数字 |
| 币种别名 | `coinAlias` | string | 保留原币种别名输入值 |
| 币种别名多语言 | `coinAliasI18nList` | array | 仅 `type=2` 时必填并提交 |
| 多语言项语言 | `coinAliasI18nList[].langKey` | `zh_CN` / `en_US` 等下划线格式 | UI 使用短横线，提交前转换为下划线 |
| 多语言项内容 | `coinAliasI18nList[].content` | string | 每个国家语言都必填 |
| 多语言项币种 | `coinAliasI18nList[].coin` | string | 取当前币种编码 |
| 币种概况 | `overviewMode` / `overviewManualList` | number / array | 手动概况提交时转为合约后台列表结构，`bizType=2` |

## 列表请求与响应

`/config_coin_list` 请求体：

```json
{
  "pageNum": 1,
  "pageSize": 20,
  "searchValue": "TFUSD",
  "configKey": "",
  "isMarginCoin": 1,
  "visibleRange": 3
}
```

`/config_coin_list` 响应在 YApi 备注中，核心结构：

```json
{
  "code": "0",
  "msg": "成功",
  "data": {
    "pageInfo": {
      "total": 65,
      "rows": [
        {
          "id": 65,
          "coin": "TFUSD01111",
          "icon": "https://static.example.com/icons/tfusd01.png",
          "type": 2,
          "coinAlias": "测试美元",
          "isBond": 1,
          "fundsInStatus": 1,
          "fundsOutStatus": 1,
          "precious": 2,
          "whiteStatus": 0,
          "overviewMode": 1,
          "overviewManualList": null,
          "coinAliasI18nList": [
            {
              "id": 6,
              "coin": "TFUSD01111",
              "langKey": "en_US",
              "content": "Test US Dollar",
              "brokerId": 1
            }
          ],
          "visibleRange": 3,
          "whiteUserIdList": []
        }
      ]
    }
  }
}
```

## 新增 / 编辑请求核心字段

`/add_config_coin_sub` 与 `/edit_config_coin_sub` 请求体字段一致：

```json
{
  "id": 1,
  "coin": "TSLA",
  "icon": "https://...",
  "type": 2,
  "coinAlias": "Tesla",
  "isBond": 0,
  "fundsInStatus": 1,
  "fundsOutStatus": 1,
  "precious": 4,
  "whiteStatus": 0,
  "overviewMode": 1,
  "overviewManualList": [
    {
      "coinSymbol": "TSLA",
      "langKey": "en_US",
      "bizType": 2,
      "description": "Tesla overview"
    }
  ],
  "coinAliasI18nList": [
    {
      "coin": "TSLA",
      "langKey": "en_US",
      "content": "Tesla"
    }
  ],
  "visibleRange": 2,
  "whiteUserIdList": [10001]
}
```

## 接入决策

- 币种列表走合约后台域名 `VUE_APP_FUTURES_API_ORIGIN` 的 `/config_coin_list`，并使用 `data.pageInfo.rows` 作为编辑回显数据。
- TradFi 币种新增 / 编辑走合约后台域名 `VUE_APP_FUTURES_API_ORIGIN`，接口分别为 `/add_config_coin_sub`、`/edit_config_coin_sub`。
- 非 TradFi 币种保持原现货后台 `/transaction/add_coin_symbol_submit`、`/transaction/edit_coin_symbol_submit`，避免影响既有币币配置。
- UI 内部仍使用 `belongSection=USDT/TRADFI`，提交前统一转为 YApi `type=1/2`。
- 编辑回显兼容 `type=1/2`、旧假设字段 `belongSection/section/marketSection/symbolSection`，多语言回显优先读取 `coinAliasI18nList`。

## 未关闭事项

- `get_config_coin_list` 仍未给出详细请求/响应 schema，当前仅作为备选接口沉淀。
- 国家语言列表仍复用当前后台 `state.baseData.languageArr`，缺失时降级到项目内默认语言列表。
