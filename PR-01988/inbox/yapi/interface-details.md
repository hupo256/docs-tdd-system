# PR-01988 YApi Interface Details

> Source: http://35.240.211.100:3333/project/459/interface/api
> Fetched at: 2026-06-25
> Count: 32

## Polymarket 预警配置 / 查询 Polymarket 预警配置

- Method: GET
- Path: /polymarket/alert-config/get
- YApi ID: 4615
- Status: done
- Response Body:
```json
{
  "properties": {
    "code": {
      "type": "integer",
      "description": "业务状态码，成功时通常为 0"
    },
    "data": {
      "properties": {
        "orderErrorThreshold": {
          "type": "integer",
          "description": "下单连续失败次数阈值，默认 3"
        },
        "larkWebhookUrl": {
          "type": "string",
          "description": "Lark 群机器人 Webhook 地址"
        },
        "orderErrorWindowMinutes": {
          "type": "integer",
          "description": "下单失败统计窗口，单位分钟，默认 5"
        },
        "positionDiffRate": {
          "type": "string",
          "description": "持仓差异率告警阈值，默认 0.1"
        },
        "walletWarningBalance": {
          "type": "string",
          "description": "钱包余额警告阈值，默认 50000"
        },
        "walletCriticalBalance": {
          "type": "string",
          "description": "钱包余额紧急阈值，默认 10000"
        }
      },
      "description": "Polymarket 预警配置",
      "type": "object"
    },
    "msg": {
      "type": "string",
      "description": "响应消息"
    }
  },
  "type": "object",
  "required": [
    "code",
    "msg",
    "data"
  ]
}
```

## Polymarket 预警配置 / 更新 Polymarket 预警配置

- Method: POST
- Path: /polymarket/alert-config/update_1782211023564
- YApi ID: 5215
- Status: done
- Request Body:
```json
{
  "properties": {
    "orderErrorThreshold": {
      "description": "下单连续失败次数阈值。统计窗口内连续失败次数达到该值时触发紧急告警，默认 3",
      "example": 3,
      "type": "integer"
    },
    "larkWebhookUrl": {
      "description": "Lark 群机器人 Webhook 地址，用于发送钱包余额、下单失败和持仓差异告警",
      "example": "https://open.larksuite.com/open-apis/bot/v2/hook/xxxx",
      "type": "string"
    },
    "orderErrorWindowMinutes": {
      "description": "下单失败统计窗口，单位分钟。默认 5 分钟",
      "example": 5,
      "type": "integer"
    },
    "positionDiffRate": {
      "description": "持仓差异率告警阈值，单位为百分比数值。差异率超过该值时触发 Lark 告警，默认 0.1",
      "example": "0.1",
      "type": "string"
    },
    "walletWarningBalance": {
      "description": "钱包余额警告阈值。USDC 余额低于该值时触发警告告警，默认 50000",
      "example": "50000",
      "type": "string"
    },
    "walletCriticalBalance": {
      "description": "钱包余额紧急阈值。USDC 余额低于该值时触发紧急补资告警，默认 10000",
      "example": "10000",
      "type": "string"
    }
  },
  "type": "object",
  "required": [
    "larkWebhookUrl",
    "walletWarningBalance",
    "walletCriticalBalance",
    "positionDiffRate",
    "orderErrorThreshold",
    "orderErrorWindowMinutes"
  ]
}
```
- Response Body:
```json
{
  "properties": {
    "code": {
      "type": "integer",
      "description": "业务状态码，成功时通常为 0"
    },
    "data": {
      "type": "object",
      "description": "成功时可能为空",
      "properties": {}
    },
    "msg": {
      "type": "string",
      "description": "响应消息"
    }
  },
  "type": "object"
}
```

## 分类管理 / 支持的语言列表&code

- Method: GET
- Path: /polymarket/category/locale/list
- YApi ID: 4624
- Status: undone
- Response Body:
```json
{
  "code": "0",
  "msg": "成功",
  "data": [
    {
      "appLocale": "en-US",
      "polymarketLocale": "en",
      "countryName": "美国",
      "languageName": "英文"
    },
    {
      "appLocale": "en-AU",
      "polymarketLocale": "en",
      "countryName": "澳大利亚",
      "languageName": "英文"
    },
    {
      "appLocale": "zh-TW",
      "polymarketLocale": "zh-Hant",
      "countryName": "中国台湾",
      "languageName": "繁体中文"
    },
    {
      "appLocale": "zh-CN",
      "polymarketLocale": "zh",
      "countryName": "中国大陆",
      "languageName": "中文"
    },
    {
      "appLocale": "tr-TR",
      "polymarketLocale": "tr",
      "countryName": "土耳其",
      "languageName": "土耳其文"
    },
    {
      "appLocale": "vi-VN",
      "polymarketLocale": "vi",
      "countryName": "越南",
      "languageName": "越南文"
    },
    {
      "appLocale": "es-ES",
      "polymarketLocale": "es",
      "countryName": "西班牙",
      "languageName": "西班牙文"
    },
    {
      "appLocale": "ru-RU",
      "polymarketLocale": "ru",
      "countryName": "俄罗斯",
      "languageName": "俄文"
    },
    {
      "appLocale": "ko-KR",
      "polymarketLocale": "ko",
      "countryName": "韩国",
      "languageName": "韩文"
    },
    {
      "appLocale": "pt-BR",
      "polymarketLocale": "pt",
      "countryName": "巴西",
      "languageName": "葡萄牙文"
    }
  ],
  "message": null,
  "succ": true
}
```

## 分类管理 / 一级分类删除

- Method: GET
- Path: /polymarket/category/delete
- YApi ID: 5233
- Status: undone
- Request Query:
```json
[
  {
    "required": "1",
    "_id": "6a3bccb806f2ee4bfe08a57c",
    "name": "id",
    "example": "1",
    "desc": ""
  }
]
```
- Response Body:
```json
{
  "type": "object",
  "title": "title",
  "properties": {}
}
```

## 分类管理 / 按等级查询分类列表

- Method: GET
- Path: /polymarket/category/category/list
- YApi ID: 5245
- Status: done
- Request Query:
```json
[
  {
    "required": "0",
    "_id": "6a3cc9f606f2ee79f408a5c8",
    "name": "level",
    "example": "1",
    "desc": "分类层级：1 一级分类，2 二级分类，3 三级分类"
  }
]
```
- Response Body:
```json
{
  "properties": {
    "code": {
      "type": "integer",
      "description": "业务状态码，成功时通常为 0"
    },
    "msg": {
      "type": "string",
      "description": "响应消息"
    },
    "data": {
      "type": "array",
      "description": "分类列表",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "example": 1,
            "format": "int64",
            "description": "分类 ID",
            "type": "integer"
          },
          "parentId": {
            "example": 0,
            "format": "int64",
            "description": "父级分类 ID，0 表示一级分类",
            "type": "integer"
          },
          "pathIds": {
            "description": "分类路径 ID，如 /1/ 或 /1/2/",
            "example": "/1/",
            "type": "string"
          },
          "level": {
            "description": "分类层级：1 一级分类，2 二级分类，3 三级分类",
            "example": 1,
            "type": "integer"
          },
          "code": {
            "description": "分类编码",
            "example": "sports",
            "type": "string"
          },
          "sort": {
            "description": "排序值，数值越小越靠前",
            "example": 1,
            "type": "integer"
          },
          "status": {
            "description": "状态：1 启用，0 禁用",
            "example": 1,
            "type": "integer"
          },
          "createTime": {
            "example": "2026-06-25 10:00:00",
            "format": "date-time",
            "description": "创建时间",
            "type": "string"
          },
          "updateTime": {
            "example": "2026-06-25 10:00:00",
            "format": "date-time",
            "description": "更新时间",
            "type": "string"
          }
        }
      }
    }
  },
  "type": "object",
  "required": [
    "code",
    "msg",
    "data"
  ]
}
```
- Description:

根据分类层级查询分类列表。level 可传 1、2、3，分别表示一级、二级、三级分类。

## 分类管理 / 一级创建

- Method: POST
- Path: /polymarket/category/createLevelOne
- YApi ID: 4630
- Status: undone
- Request Body:
```json
{
  "level": 1,
  "code": "crypto",
  "sort": 2,
  "nameMap": {
    "en-US": "Crypto",
    "en-AU": "Crypto",
    "zh-TW": "加密貨幣",
    "zh-CN": "加密货币",
    "tr-TR": "Kripto",
    "vi-VN": "Tiền mã hóa",
    "es-ES": "Cripto",
    "ru-RU": "Криптовалюта",
    "ko-KR": "암호화폐",
    "pt-BR": "Cripto"
  }
}
```
- Response Body:
```json
{
  "code": "0",
  "msg": "成功",
  "data": 22,
  "message": null,
  "succ": true
}
```

## 分类管理 / 二，三级创建

- Method: POST
- Path: /polymarket/category/saveChildren
- YApi ID: 4633
- Status: undone
- Request Body:
```json
"{\n  \"levelOneId\": 1, // 一级分类ID，这里表示 Sports/体育    --- 必传\n  \"children\": [ // 二级分类列表\n    {\n      \"level\": 2, // 分类层级：二级\n      \"code\": \"football\", // 分类编码：足球\n      \"sort\": 1, // 排序值，越小越靠前\n      \"nameMap\": { // 多语言名称\n        \"en-US\": \"Football\", // 英语-美国\n        \"en-AU\": \"Football\", // 英语-澳大利亚\n        \"zh-TW\": \"足球\", // 繁体中文\n        \"zh-CN\": \"足球\", // 简体中文\n        \"tr-TR\": \"Futbol\", // 土耳其语\n        \"vi-VN\": \"Bóng đá\", // 越南语\n        \"es-ES\": \"Fútbol\", // 西班牙语\n        \"ru-RU\": \"Футбол\", // 俄语\n        \"ko-KR\": \"축구\", // 韩语\n        \"pt-BR\": \"Futebol\" // 葡萄牙语-巴西\n      },\n      \"children\": [ // 三级分类列表，足球下的联赛\n        {\n          \"level\": 3, // 分类层级：三级\n          \"code\": \"premier_league\", // 分类编码：英超\n          \"sort\": 1, // 排序值\n          \"nameMap\": { // 多语言名称\n            \"en-US\": \"Premier League\", // 英语-美国\n            \"en-AU\": \"Premier League\", // 英语-澳大利亚\n            \"zh-TW\": \"英超\", // 繁体中文\n            \"zh-CN\": \"英超\", // 简体中文\n            \"tr-TR\": \"Premier Lig\", // 土耳其语\n            \"vi-VN\": \"Ngoại hạng Anh\", // 越南语\n            \"es-ES\": \"Premier League\", // 西班牙语\n            \"ru-RU\": \"Премьер-лига\", // 俄语\n            \"ko-KR\": \"프리미어리그\", // 韩语\n            \"pt-BR\": \"Premier League\" // 葡萄牙语-巴西\n          }\n        },\n        {\n          \"level\": 3, // 分类层级：三级\n          \"code\": \"la_liga\", // 分类编码：西甲\n          \"sort\": 2, // 排序值\n          \"nameMap\": { // 多语言名称\n            \"en-US\": \"La Liga\", // 英语-美国\n            \"en-AU\": \"La Liga\", // 英语-澳大利亚\n            \"zh-TW\": \"西甲\", // 繁体中文\n            \"zh-CN\": \"西甲\", // 简体中文\n            \"tr-TR\": \"La Liga\", // 土耳其语\n            \"vi-VN\": \"La Liga\", // 越南语\n            \"es-ES\": \"La Liga\", // 西班牙语\n            \"ru-RU\": \"Ла Лига\", // 俄语\n            \"ko-KR\": \"라리가\", // 韩语\n            \"pt-BR\": \"La Liga\" // 葡萄牙语-巴西\n          }\n        }\n      ]\n    },\n    {\n      \"level\": 2, // 分类层级：二级\n      \"code\": \"basketball\", // 分类编码：篮球\n      \"sort\": 2, // 排序值，足球之后\n      \"nameMap\": { // 多语言名称\n        \"en-US\": \"Basketball\", // 英语-美国\n        \"en-AU\": \"Basketball\", // 英语-澳大利亚\n        \"zh-TW\": \"籃球\", // 繁体中文\n        \"zh-CN\": \"篮球\", // 简体中文\n        \"tr-TR\": \"Basketbol\", // 土耳其语\n        \"vi-VN\": \"Bóng rổ\", // 越南语\n        \"es-ES\": \"Baloncesto\", // 西班牙语\n        \"ru-RU\": \"Баскетбол\", // 俄语\n        \"ko-KR\": \"농구\", // 韩语\n        \"pt-BR\": \"Basquete\" // 葡萄牙语-巴西\n      },\n      \"children\": [ // 三级分类列表，篮球下的赛事\n        {\n          \"level\": 3, // 分类层级：三级\n          \"code\": \"nba\", // 分类编码：NBA\n          \"sort\": 1, // 排序值\n          \"nameMap\": { // 多语言名称\n            \"en-US\": \"NBA\", // 英语-美国\n            \"en-AU\": \"NBA\", // 英语-澳大利亚\n            \"zh-TW\": \"NBA\", // 繁体中文\n            \"zh-CN\": \"NBA\", // 简体中文\n            \"tr-TR\": \"NBA\", // 土耳其语\n            \"vi-VN\": \"NBA\", // 越南语\n            \"es-ES\": \"NBA\", // 西班牙语\n            \"ru-RU\": \"НБА\", // 俄语\n            \"ko-KR\": \"NBA\", // 韩语\n            \"pt-BR\": \"NBA\" // 葡萄牙语-巴西\n          }\n        }\n      ]\n    }\n  ]\n}"
```

## 分类管理 / 分类列表

- Method: POST
- Path: /polymarket/category/pageList
- YApi ID: 4621
- Status: undone
- Request Body:
```json
{
  "pageNum": 1,
  "pageSize": 2
}
```
- Response Body:
```json
"{\n\t\"code\": \"0\",\n\t\"msg\": \"Succeed\",\n\t\"data\": {\n\t\t\"count\": 1,\n\t\t\"list\": [\n\t\t\t{\n\t\t\t\t\"id\": 1,\n\t\t\t\t\"code\": \"sports\",\n\t\t\t\t\"name\": \"Sports\",    //一级名称\n\t\t\t\t\"nameMap\": {\n\t\t\t\t\t\"en-AU\": \"Sports\",\n\t\t\t\t\t\"en-US\": \"Sports\",\n\t\t\t\t\t\"es-ES\": \"Deportes\",\n\t\t\t\t\t\"ko-KR\": \"스포츠\",\n\t\t\t\t\t\"pt-BR\": \"Esportes\",\n\t\t\t\t\t\"ru-RU\": \"Спорт\",\n\t\t\t\t\t\"tr-TR\": \"Spor\",\n\t\t\t\t\t\"vi-VN\": \"Thể thao\",\n\t\t\t\t\t\"zh-CN\": \"体育\",\n\t\t\t\t\t\"zh-TW\": \"體育\"\n\t\t\t\t},\n\t\t\t\t\"levelTwoTotal\": 2,     //二级数量\n\t\t\t\t\"levelThreeTotal\": 2,   //三级数量\n\t\t\t\t\"sort\": 1\n\t\t\t}\n\t\t]\n\t},\n\t\"message\": null,\n\t\"succ\": true\n}"
```

## 分类管理 / 修改一，二，三分类级别

- Method: POST
- Path: /polymarket/category/update/full
- YApi ID: 4636
- Status: undone
- Request Body:
```json
"{\n  \"id\": 1,     //修改id都有必传\n  \"level\": 1,\n  \"code\": \"sports\",\n  \"sort\": 1,\n  \"nameMap\": {\n    \"en-US\": \"Sports\",\n    \"en-AU\": \"Sports\",\n    \"zh-TW\": \"體育\",\n    \"zh-CN\": \"体育\",\n    \"tr-TR\": \"Spor\",\n    \"vi-VN\": \"Thể thao\",\n    \"es-ES\": \"Deportes\",\n    \"ru-RU\": \"Спорт\",\n    \"ko-KR\": \"스포츠\",\n    \"pt-BR\": \"Esportes\"\n  },\n  \"children\": [\n    {\n      \"id\": 2,\n      \"level\": 2,\n      \"code\": \"football\",\n      \"sort\": 1,\n      \"nameMap\": {\n        \"en-US\": \"Football\",\n        \"en-AU\": \"Football\",\n        \"zh-TW\": \"足球\",\n        \"zh-CN\": \"足球\",\n        \"tr-TR\": \"Futbol\",\n        \"vi-VN\": \"Bóng đá\",\n        \"es-ES\": \"Fútbol\",\n        \"ru-RU\": \"Футбол\",\n        \"ko-KR\": \"축구\",\n        \"pt-BR\": \"Futebol\"\n      },\n      \"children\": [\n        {\n          \"id\": 3,\n          \"level\": 3,\n          \"code\": \"premier_league\",\n          \"sort\": 1,\n          \"nameMap\": {\n            \"en-US\": \"Premier League\",\n            \"en-AU\": \"Premier League\",\n            \"zh-TW\": \"英超\",\n            \"zh-CN\": \"英超\",\n            \"tr-TR\": \"Premier Lig\",\n            \"vi-VN\": \"Ngoại hạng Anh\",\n            \"es-ES\": \"Premier League\",\n            \"ru-RU\": \"Премьер-лига\",\n            \"ko-KR\": \"프리미어리그\",\n            \"pt-BR\": \"Premier League\"\n          }\n        },\n        {\n          \"level\": 3,\n          \"code\": \"la_liga\",\n          \"sort\": 2,\n          \"nameMap\": {\n            \"en-US\": \"La Liga\",\n            \"en-AU\": \"La Liga\",\n            \"zh-TW\": \"西甲\",\n            \"zh-CN\": \"西甲\",\n            \"tr-TR\": \"La Liga\",\n            \"vi-VN\": \"La Liga\",\n            \"es-ES\": \"La Liga\",\n            \"ru-RU\": \"Ла Лига\",\n            \"ko-KR\": \"라리가\",\n            \"pt-BR\": \"La Liga\"\n          }\n        }\n      ]\n    },\n    {\n      \"level\": 2,\n      \"code\": \"basketball\",\n      \"sort\": 2,\n      \"nameMap\": {\n        \"en-US\": \"Basketball\",\n        \"en-AU\": \"Basketball\",\n        \"zh-TW\": \"籃球\",\n        \"zh-CN\": \"篮球\",\n        \"tr-TR\": \"Basketbol\",\n        \"vi-VN\": \"Bóng rổ\",\n        \"es-ES\": \"Baloncesto\",\n        \"ru-RU\": \"Баскетбол\",\n        \"ko-KR\": \"농구\",\n        \"pt-BR\": \"Basquete\"\n      },\n      \"children\": []\n    }\n  ]\n}"
```
- Description:

<p>一，二，三级 的id值都有必传</p>


## 分类管理 / 某一级分类树桩结构

- Method: GET
- Path: /polymarket/category/treeByLevelOneId
- YApi ID: 4642
- Status: undone
- Request Query:
```json
[
  {
    "required": "1",
    "_id": "6a352ddb06f2ee817708a32d",
    "name": "id",
    "example": "41",
    "desc": ""
  }
]
```
- Response Body:
```json
{
  "code": "0",
  "msg": "成功",
  "data": [
    {
      "id": 41,
      "parentId": 0,
      "pathIds": "41",
      "level": 1,
      "code": "sports",
      "name": "Sports",
      "nameMap": {
        "en-US": "Sports",
        "en-AU": "Sports",
        "zh-TW": "體育",
        "zh-CN": "体育",
        "tr-TR": "Spor",
        "vi-VN": "Thể thao",
        "es-ES": "Deportes",
        "ru-RU": "Спорт",
        "ko-KR": "스포츠",
        "pt-BR": "Esportes"
      },
      "sort": 1,
      "children": [
        {
          "id": 42,
          "parentId": 41,
          "pathIds": "41_42",
          "level": 2,
          "code": "football",
          "name": "Football",
          "nameMap": {
            "en-US": "Football",
            "en-AU": "Football",
            "zh-TW": "足球",
            "zh-CN": "足球",
            "tr-TR": "Futbol",
            "vi-VN": "Bóng đá",
            "es-ES": "Fútbol",
            "ru-RU": "Футбол",
            "ko-KR": "축구",
            "pt-BR": "Futebol"
          },
          "sort": 1,
          "children": [
            {
              "id": 43,
              "parentId": 42,
              "pathIds": "41_42_43",
              "level": 3,
              "code": "premier_league",
              "name": "Premier League",
              "nameMap": {
                "en-US": "Premier League",
                "en-AU": "Premier League",
                "zh-TW": "英超",
                "zh-CN": "英超",
                "tr-TR": "Premier Lig",
                "vi-VN": "Ngoại hạng Anh",
                "es-ES": "Premier League",
                "ru-RU": "Премьер-лига",
                "ko-KR": "프리미어리그",
                "pt-BR": "Premier League"
              },
              "sort": 1,
              "children": []
            },
            {
              "id": 44,
              "parentId": 42,
              "pathIds": "41_42_44",
              "level": 3,
              "code": "la_liga",
              "name": "La Liga",
              "nameMap": {
                "en-US": "La Liga",
                "en-AU": "La Liga",
                "zh-TW": "西甲",
                "zh-CN": "西甲",
                "tr-TR": "La Liga",
                "vi-VN": "La Liga",
                "es-ES": "La Liga",
                "ru-RU": "Ла Лига",
                "ko-KR": "라리가",
                "pt-BR": "La Liga"
              },
              "sort": 2,
              "children": []
            }
          ]
        },
        {
          "id": 45,
          "parentId": 41,
          "pathIds": "41_45",
          "level": 2,
          "code": "basketball",
          "name": "Basketball",
          "nameMap": {
            "en-US": "Basketball",
            "en-AU": "Basketball",
            "zh-TW": "籃球",
            "zh-CN": "篮球",
            "tr-TR": "Basketbol",
            "vi-VN": "Bóng rổ",
            "es-ES": "Baloncesto",
            "ru-RU": "Баскетбол",
            "ko-KR": "농구",
            "pt-BR": "Basquete"
          },
          "sort": 2,
          "children": [
            {
              "id": 46,
              "parentId": 45,
              "pathIds": "41_45_46",
              "level": 3,
              "code": "nba",
              "name": "NBA",
              "nameMap": {
                "en-US": "NBA",
                "en-AU": "NBA",
                "zh-TW": "NBA",
                "zh-CN": "NBA",
                "tr-TR": "NBA",
                "vi-VN": "NBA",
                "es-ES": "NBA",
                "ru-RU": "НБА",
                "ko-KR": "NBA",
                "pt-BR": "NBA"
              },
              "sort": 1,
              "children": []
            }
          ]
        }
      ]
    }
  ],
  "message": null,
  "succ": true
}
```

## 分类管理 / 全量分类树桩结构

- Method: GET
- Path: /polymarket/category/tree
- YApi ID: 4627
- Status: undone
- Response Body:
```json
{
  "code": "0",
  "msg": "成功",
  "data": [
    {
      "id": 41,
      "parentId": 0,
      "pathIds": "41",
      "level": 1,
      "code": "sports",
      "name": "Sports",
      "nameMap": {
        "en-US": "Sports",
        "en-AU": "Sports",
        "zh-TW": "體育",
        "zh-CN": "体育",
        "tr-TR": "Spor",
        "vi-VN": "Thể thao",
        "es-ES": "Deportes",
        "ru-RU": "Спорт",
        "ko-KR": "스포츠",
        "pt-BR": "Esportes"
      },
      "sort": 1,
      "children": [
        {
          "id": 42,
          "parentId": 41,
          "pathIds": "41_42",
          "level": 2,
          "code": "football",
          "name": "Football",
          "nameMap": {
            "en-US": "Football",
            "en-AU": "Football",
            "zh-TW": "足球",
            "zh-CN": "足球",
            "tr-TR": "Futbol",
            "vi-VN": "Bóng đá",
            "es-ES": "Fútbol",
            "ru-RU": "Футбол",
            "ko-KR": "축구",
            "pt-BR": "Futebol"
          },
          "sort": 1,
          "children": [
            {
              "id": 43,
              "parentId": 42,
              "pathIds": "41_42_43",
              "level": 3,
              "code": "premier_league",
              "name": "Premier League",
              "nameMap": {
                "en-US": "Premier League",
                "en-AU": "Premier League",
                "zh-TW": "英超",
                "zh-CN": "英超",
                "tr-TR": "Premier Lig",
                "vi-VN": "Ngoại hạng Anh",
                "es-ES": "Premier League",
                "ru-RU": "Премьер-лига",
                "ko-KR": "프리미어리그",
                "pt-BR": "Premier League"
              },
              "sort": 1,
              "children": []
            },
            {
              "id": 44,
              "parentId": 42,
              "pathIds": "41_42_44",
              "level": 3,
              "code": "la_liga",
              "name": "La Liga",
              "nameMap": {
                "en-US": "La Liga",
                "en-AU": "La Liga",
                "zh-TW": "西甲",
                "zh-CN": "西甲",
                "tr-TR": "La Liga",
                "vi-VN": "La Liga",
                "es-ES": "La Liga",
                "ru-RU": "Ла Лига",
                "ko-KR": "라리가",
                "pt-BR": "La Liga"
              },
              "sort": 2,
              "children": []
            }
          ]
        },
        {
          "id": 45,
          "parentId": 41,
          "pathIds": "41_45",
          "level": 2,
          "code": "basketball",
          "name": "Basketball",
          "nameMap": {
            "en-US": "Basketball",
            "en-AU": "Basketball",
            "zh-TW": "籃球",
            "zh-CN": "篮球",
            "tr-TR": "Basketbol",
            "vi-VN": "Bóng rổ",
            "es-ES": "Baloncesto",
            "ru-RU": "Баскетбол",
            "ko-KR": "농구",
            "pt-BR": "Basquete"
          },
          "sort": 2,
          "children": [
            {
              "id": 46,
              "parentId": 45,
              "pathIds": "41_45_46",
              "level": 3,
              "code": "nba",
              "name": "NBA",
              "nameMap": {
                "en-US": "NBA",
                "en-AU": "NBA",
                "zh-TW": "NBA",
                "zh-CN": "NBA",
                "tr-TR": "NBA",
                "vi-VN": "NBA",
                "es-ES": "NBA",
                "ru-RU": "НБА",
                "ko-KR": "NBA",
                "pt-BR": "NBA"
              },
              "sort": 1,
              "children": []
            }
          ]
        }
      ]
    }
  ],
  "message": null,
  "succ": true
}
```

## 每日收入统计 / 每日统计列表

- Method: POST
- Path: /tradeDailyIncome/pageList
- YApi ID: 4645
- Status: undone
- Request Body:
```json
"{\n  // 页码，从 1 开始\n  \"pageNum\": 1,\n\n  // 每页条数\n  \"pageSize\": 20,\n\n  // 统计开始日期，格式 yyyy-MM-dd；对应 SQL：stat_date >= statDateStart\n  \"statDateStart\": \"2026-06-01\",\n\n  // 统计结束日期，格式 yyyy-MM-dd；对应 SQL：stat_date <= statDateEnd\n  \"statDateEnd\": \"2026-06-19\"\n}"
```
- Response Body:
```json
"{\n\t\"code\": \"0\",\n\t\"msg\": \"Succeed\",\n\t\"data\": {\n\t\t\"count\": 2,\n\t\t\"list\": [\n\t\t\t  // 主键\n      \"id\": 1,\n\n      // 统计日期，格式 yyyy-MM-dd\n      \"statDate\": \"2026-06-19\",\n\n      // buy 订单总数\n      \"buyOrderCount\": 120,\n\n      // sell 订单总数\n      \"sellOrderCount\": 80,\n\n      // settled 订单总数\n      \"settledOrderCount\": 15,\n\n      // 成交额，按 ABS(amount) 汇总\n      \"tradeAmount\": 23500.500000,\n\n      // 买入加价收入\n      \"buyPlatformAmount\": 320.120000,\n\n      // 卖出抽水收入\n      \"sellPlatformAmount\": 210.450000,\n\n      // 结算抽水收入\n      \"settledPlatformAmount\": 55.000000,\n\n      // Polymarket 收取的成交手续费\n      \"polymarketAmountFee\": 18.350000,\n\n      // 毛利 = 买入加价 + 卖出抽水 + 结算抽水\n      \"grossProfit\": 585.570000,\n\n      // 创建时间\n      \"createdAt\": \"2026-06-19 00:10:01\",\n\n      // 更新时间\n      \"updatedAt\": \"2026-06-19 00:10:01\"\n\t\t]\n\t},\n\t\"message\": null,\n\t\"succ\": true\n}"
```

## 每日收入统计 / 毛利趋势和统计

- Method: POST
- Path: /tradeDailyIncome/summary
- YApi ID: 4648
- Status: undone
- Request Body:
```json
"{\n  // 统计开始日期，格式 yyyy-MM-dd；对应 SQL：stat_date >= statDateStart\n  \"statDateStart\": \"2026-06-01\",\n\n  // 统计结束日期，格式 yyyy-MM-dd；对应 SQL：stat_date <= statDateEnd\n  \"statDateEnd\": \"2026-06-19\"\n}"
```
- Response Body:
```json
"{\n  // 区间总收入，即所选时间区间内的毛利汇总\n  \"totalIncome\": 1200.00,\n\n  // 买入加价收入，所选时间区间内 buy 类型订单的 platform_amount 汇总\n  \"buyPlatformAmount\": 500.00,\n\n  // 买入加价收入占比 = buyPlatformAmount / totalIncome，四舍五入保留 2 位小数\n  \"buyPlatformAmountRatio\": 0.42,\n\n  // 卖出抽水收入，所选时间区间内 sell 类型订单的 platform_amount 汇总\n  \"sellPlatformAmount\": 400.00,\n\n  // 卖出抽水收入占比 = sellPlatformAmount / totalIncome，四舍五入保留 2 位小数\n  \"sellPlatformAmountRatio\": 0.33,\n\n  // 结算抽水收入，所选时间区间内 settled 类型订单的 platform_amount 汇总\n  \"settledPlatformAmount\": 300.00,\n\n  // 结算抽水收入占比 = settledPlatformAmount / totalIncome，四舍五入保留 2 位小数\n  \"settledPlatformAmountRatio\": 0.25,\n\n  // 毛利趋势列表，用于折线图；按统计日期升序返回\n  \"grossProfitTrendList\": [\n    {\n      // 统计日期，格式 yyyy-MM-dd\n      \"statDate\": \"2026-06-15\",\n\n      // 当天毛利\n      \"grossProfit\": 300.00\n    },\n    {\n      // 统计日期，格式 yyyy-MM-dd\n      \"statDate\": \"2026-06-16\",\n\n      // 当天毛利\n      \"grossProfit\": 400.00\n    },\n    {\n      // 统计日期，格式 yyyy-MM-dd\n      \"statDate\": \"2026-06-17\",\n\n      // 当天毛利\n      \"grossProfit\": 500.00\n    }\n  ]\n}"
```

## 每日收入统计 / 每日统计导出

- Method: POST
- Path: /tradeDailyIncome/export
- YApi ID: 5239
- Status: undone
- Request Body:
```json
"{\n  // 统计开始日期，格式 yyyy-MM-dd；对应 SQL：stat_date >= statDateStart\n  \"statDateStart\": \"2026-06-01\",\n\n  // 统计结束日期，格式 yyyy-MM-dd；对应 SQL：stat_date <= statDateEnd\n  \"statDateEnd\": \"2026-06-19\"\n}"
```

## 事件 / 同步查询事件

- Method: POST
- Path: /polymarket/event/eventSync
- YApi ID: 4651
- Status: undone
- Request Query:
```json
[
  {
    "required": "0",
    "_id": "6a394bb906f2ee2d5e08a53a",
    "name": "eventsId",
    "example": "351744",
    "desc": "二选一"
  },
  {
    "required": "0",
    "_id": "6a394bb906f2eebddb08a539",
    "name": "slug",
    "example": "will-neymar-play-in-the-world-cup",
    "desc": "二选一"
  }
]
```
- Response Body:
```json
{
  "type": "object",
  "required": [
    "code",
    "msg",
    "data"
  ],
  "properties": {
    "code": {
      "type": "string",
      "description": "业务状态码，0=成功，非0=失败"
    },
    "msg": {
      "type": "string",
      "description": "处理结果描述"
    },
    "data": {
      "type": "object",
      "description": "Polymarket 事件多语言同步返回结构，用于后台新增/编辑事件前回显多语言模板",
      "properties": {
        "eventId": {
          "type": "string",
          "description": "Polymarket 事件 ID"
        },
        "tableType": {
          "type": "number",
          "description": " 0: 无效赛事  1赛事  2普通事件"
        },
        "slug": {
          "type": "string",
          "description": "Polymarket 事件 slug"
        },
        "eventName": {
          "type": "string",
          "description": "Polymarket 原始英文事件名称"
        },
        "eventNameI18n": {
          "type": "array",
          "description": "事件名称多语言模板列表；en-US 默认填充 eventName，其他语言默认空字符串",
          "items": {
            "type": "object",
            "required": [
              "appLocale",
              "content"
            ],
            "properties": {
              "appLocale": {
                "type": "string",
                "description": "系统语言标识，例如 en-US、en-AU、zh-TW、zh-CN、tr-TR、vi-VN、es-ES、ru-RU、ko-KR、pt-BR"
              },
              "content": {
                "type": "string",
                "description": "多语言内容；en-US 默认填充 Polymarket 原始英文名称，其他语言默认空字符串，供后台补充翻译"
              },
              "contentOne": {
                "type": "string",
                "description": "备用展示内容或扩展文案，当前同步逻辑一般为 null 或空"
              }
            }
          }
        },
        "markets": {
          "type": "array",
          "description": "事件下市场集合，每个市场包含原始问题和市场名称多语言模板",
          "items": {
            "type": "object",
            "description": "事件下的市场信息及市场名称多语言模板",
            "properties": {
              "marketId": {
                "type": "string",
                "description": "Polymarket 市场 ID"
              },
              "eventId": {
                "type": "string",
                "description": "Polymarket 事件 ID，与外层 data.eventId 一致"
              },
              "groupItemTitle": {
                "type": "string",
                "description": "市场分组项标题，例如 Netherlands、Draw、Sweden"
              },
              "groupItemThreshold": {
                "type": "string",
                "description": "分组项阈值/排序标识；为空时后端默认返回 \"0\""
              },
              "question": {
                "type": "string",
                "description": "Polymarket 原始市场问题，即市场英文名称/下单后标题"
              },
              "marketNameI18n": {
                "type": "array",
                "description": "市场名称多语言模板列表",
                "items": {
                  "type": "object",
                  "required": [
                    "appLocale",
                    "content"
                  ],
                  "properties": {
                    "appLocale": {
                      "type": "string",
                      "description": "系统语言标识，例如 en-US、en-AU、zh-TW、zh-CN、tr-TR、vi-VN、es-ES、ru-RU、ko-KR、pt-BR"
                    },
                    "content": {
                      "type": "string",
                      "description": "多语言内容；en-US 默认填充 Polymarket 原始英文名称，其他语言默认空字符串，供后台补充翻译"
                    },
                    "contentOne": {
                      "type": "string",
                      "description": "备用展示内容或扩展文案，当前同步逻辑一般为 null 或空"
                    }
                  }
                }
              }
            }
          }
        }
      },
      "required": [
        "tableType"
      ]
    },
    "message": {
      "type": "string",
      "description": "兼容消息字段，可能为空"
    },
    "succ": {
      "type": "boolean",
      "description": "兼容成功标识；如果序列化时包含该字段，true 表示成功"
    }
  }
}
```
- Description:

<p>返回 data 字段说明：</p>
<ul>
<li>eventId：Polymarket 事件 ID。</li>
<li>slug：Polymarket 事件 slug。</li>
<li>eventName：Polymarket 原始英文事件名称。</li>
<li>eventNameI18n：事件名称多语言模板；en-US 默认填充英文标题，其他语言默认空，供后台补充翻译。</li>
<li>markets：事件下市场集合。</li>
<li>markets[].marketId：Polymarket 市场 ID。</li>
<li>markets[].eventId：市场所属事件 ID。</li>
<li>markets[].groupItemTitle：市场分组项标题。</li>
<li>markets[].groupItemThreshold：分组项阈值/排序标识。</li>
<li>markets[].question：Polymarket 原始市场问题。</li>
<li>markets[].marketNameI18n：市场名称多语言模板。</li>
</ul>
<p>返回示例：</p>
<pre><code data-language="json" class="lang-json">{
  "code": "0",
  "msg": "成功",
  "data": {
    "eventId": "351747",
    "slug": "netherlands-vs-sweden",
    "eventName": "Netherlands vs. Sweden",
    "eventNameI18n": [
      { "appLocale": "en-US", "content": "Netherlands vs. Sweden", "contentOne": null },
      { "appLocale": "zh-CN", "content": "", "contentOne": null }
    ],
    "markets": [
      {
        "marketId": "1897144",
        "eventId": "351747",
        "groupItemTitle": "Netherlands",
        "groupItemThreshold": "0",
        "question": "Will Netherlands win on 2026-06-20?",
        "marketNameI18n": [
          { "appLocale": "en-US", "content": "Will Netherlands win on 2026-06-20?", "contentOne": null },
          { "appLocale": "zh-CN", "content": "", "contentOne": null }
        ]
      }
    ]
  },
  "message": null,
  "succ": true
}
</code></pre>


## 事件 / 新增Polymarket事件配置

- Method: POST
- Path: /polymarket/event/addEvent
- YApi ID: 4669
- Status: done
- Request Body:
```json
{
  "type": "object",
  "required": [
    "eventId",
    "field_2"
  ],
  "properties": {
    "eventId": {
      "type": "string",
      "description": "Polymarket 事件 ID；用于关联已同步的事件基础信息"
    },
    "field_2": {
      "type": "string",
      "description": " 0: 无效赛事  1赛事  2普通事件"
    },
    "tagType": {
      "type": "string",
      "description": "一级分类 code，例如 sports（体育）"
    },
    "tagTypeTow": {
      "type": "string",
      "description": "二级分类 code，例如 soccer（足球）"
    },
    "tagTypeThree": {
      "type": "string",
      "description": "三级分类 code，例如 worldcup（世界杯）"
    },
    "tagTypeJoin": {
      "type": "string",
      "description": "分类归属集合，例如 sports_soccer_worldcup"
    },
    "status": {
      "type": "integer",
      "description": "状态：0=下线，1=仅可见，2=开启交易",
      "enum": [
        0,
        1,
        2
      ]
    },
    "tableType": {
      "type": "integer",
      "description": "事件类型：1=赛事，2=其他事件类型",
      "enum": [
        1,
        2
      ]
    },
    "eventNameI18n": {
      "type": "array",
      "description": "事件名称多语言配置列表",
      "items": {
        "type": "object",
        "required": [
          "appLocale",
          "content"
        ],
        "properties": {
          "appLocale": {
            "type": "string",
            "description": "系统语言标识，例如 zh-CN、en-US"
          },
          "content": {
            "type": "string",
            "description": "多语言展示内容，例如事件名称或市场名称"
          },
          "contentOne": {
            "type": "string",
            "description": "备用展示内容或扩展文案，可为空"
          }
        }
      }
    },
    "markets": {
      "type": "array",
      "description": "市场名称多语言配置列表；marketId 可不传，不传时按已同步市场排序匹配",
      "items": {
        "type": "object",
        "properties": {
          "marketId": {
            "type": "string",
            "description": "Polymarket 市场 ID；可为空，为空时按已同步市场顺序匹配"
          },
          "marketNameI18n": {
            "type": "array",
            "description": "该市场名称多语言配置列表",
            "items": {
              "type": "object",
              "required": [
                "appLocale",
                "content"
              ],
              "properties": {
                "appLocale": {
                  "type": "string",
                  "description": "系统语言标识，例如 zh-CN、en-US"
                },
                "content": {
                  "type": "string",
                  "description": "多语言展示内容，例如事件名称或市场名称"
                },
                "contentOne": {
                  "type": "string",
                  "description": "备用展示内容或扩展文案，可为空"
                }
              }
            }
          }
        }
      }
    }
  }
}
```
- Response Body:
```json
{
  "type": "object",
  "properties": {
    "code": {
      "type": "string",
      "description": "业务状态码，0=成功，非0=失败"
    },
    "msg": {
      "type": "string",
      "description": "处理结果描述"
    },
    "message": {
      "type": "string",
      "description": "兼容消息字段，可能为空"
    },
    "data": {
      "description": "业务数据；新增成功时返回服务端 addOrUpdateEvent 的处理结果"
    }
  }
}
```
- Description:

<p>新增后台 Polymarket 事件展示/交易配置。</p>
<p>业务说明：</p>
<ul>
<li>事件和市场基础信息来自已同步的 polymarket_event / polymarket_market。</li>
<li>本接口只接收事件 ID、分类、状态、事件名称多语言和市场名称多语言配置。</li>
<li>marketId 可不传；不传时后端按已同步市场排序匹配 marketNameI18n。</li>
<li>需要后台登录态；未登录返回 NotLogin 对应错误码。</li>
<li>status：0=下线，1=仅可见，2=开启交易；tableType：1=赛事，2=其他事件类型。</li>
</ul>
<p>NameI18n 字段：</p>
<ul>
<li>appLocale：系统语言标识，例如 en-US、zh-CN。</li>
<li>content：多语言展示内容。</li>
<li>contentOne：备用展示内容或扩展文案，可为空。</li>
</ul>
<p>请求示例：</p>
<pre><code data-language="json" class="lang-json">{
  "eventId": "12345",
  "tagType": "sports",
  "tagTypeTow": "soccer",
  "tagTypeThree": "worldcup",
  "tagTypeJoin": "sports_soccer_worldcup",
  "status": 1,
  "tableType": 1,
  "eventNameI18n": [
    { "appLocale": "zh-CN", "content": "世界杯冠军预测", "contentOne": "" },
    { "appLocale": "en-US", "content": "World Cup Winner", "contentOne": "" }
  ],
  "markets": [
    {
      "marketId": "98765",
      "marketNameI18n": [
        { "appLocale": "zh-CN", "content": "阿根廷夺冠？", "contentOne": "" },
        { "appLocale": "en-US", "content": "Argentina to win?", "contentOne": "" }
      ]
    }
  ]
}
</code></pre>


## 事件 / 修改Polymarket事件配置

- Method: POST
- Path: /polymarket/event/updateEvent
- YApi ID: 4675
- Status: done
- Request Body:
```json
{
  "type": "object",
  "required": [
    "eventId"
  ],
  "properties": {
    "eventId": {
      "type": "string",
      "description": "Polymarket 事件 ID；用于关联已同步的事件基础信息"
    },
    "tagType": {
      "type": "string",
      "description": "一级分类 code，例如 sports（体育）"
    },
    "tagTypeTow": {
      "type": "string",
      "description": "二级分类 code，例如 soccer（足球）"
    },
    "tagTypeThree": {
      "type": "string",
      "description": "三级分类 code，例如 worldcup（世界杯）"
    },
    "tagTypeJoin": {
      "type": "string",
      "description": "分类归属集合，例如 sports_soccer_worldcup"
    },
    "status": {
      "type": "integer",
      "description": "状态：0=下线，1=仅可见，2=开启交易",
      "enum": [
        0,
        1,
        2
      ]
    },
    "tableType": {
      "type": "integer",
      "description": "事件类型：1=赛事，2=其他事件类型",
      "enum": [
        1,
        2
      ]
    },
    "eventNameI18n": {
      "type": "array",
      "description": "事件名称多语言配置列表",
      "items": {
        "type": "object",
        "required": [
          "appLocale",
          "content"
        ],
        "properties": {
          "appLocale": {
            "type": "string",
            "description": "系统语言标识，例如 zh-CN、en-US"
          },
          "content": {
            "type": "string",
            "description": "多语言展示内容，例如事件名称或市场名称"
          },
          "contentOne": {
            "type": "string",
            "description": "备用展示内容或扩展文案，可为空"
          }
        }
      }
    },
    "markets": {
      "type": "array",
      "description": "市场名称多语言配置列表；marketId 可不传，不传时按已同步市场排序匹配",
      "items": {
        "type": "object",
        "properties": {
          "marketId": {
            "type": "string",
            "description": "Polymarket 市场 ID；可为空，为空时按已同步市场顺序匹配"
          },
          "marketNameI18n": {
            "type": "array",
            "description": "该市场名称多语言配置列表",
            "items": {
              "type": "object",
              "required": [
                "appLocale",
                "content"
              ],
              "properties": {
                "appLocale": {
                  "type": "string",
                  "description": "系统语言标识，例如 zh-CN、en-US"
                },
                "content": {
                  "type": "string",
                  "description": "多语言展示内容，例如事件名称或市场名称"
                },
                "contentOne": {
                  "type": "string",
                  "description": "备用展示内容或扩展文案，可为空"
                }
              }
            }
          }
        }
      }
    }
  }
}
```
- Response Body:
```json
{
  "type": "object",
  "properties": {
    "code": {
      "type": "string",
      "description": "业务状态码，0=成功，非0=失败"
    },
    "msg": {
      "type": "string",
      "description": "处理结果描述"
    },
    "message": {
      "type": "string",
      "description": "兼容消息字段，可能为空"
    },
    "data": {
      "description": "业务数据；修改成功时返回服务端 addOrUpdateEvent 的处理结果"
    }
  }
}
```
- Description:

修改已存在的后台 Polymarket 事件展示/交易配置。

业务说明：
- 事件和市场基础信息来自已同步的 polymarket_event / polymarket_market。
- 本接口只接收事件 ID、分类、状态、事件名称多语言和市场名称多语言配置。
- marketId 可不传；不传时后端按已同步市场排序匹配 marketNameI18n。
- 需要后台登录态；未登录返回 NotLogin 对应错误码。
- status：0=下线，1=仅可见，2=开启交易；tableType：1=赛事，2=其他事件类型。

NameI18n 字段：
- appLocale：系统语言标识，例如 en-US、zh-CN。
- content：多语言展示内容。
- contentOne：备用展示内容或扩展文案，可为空。

请求示例：

```json
{
  "eventId": "12345",
  "tagType": "sports",
  "tagTypeTow": "soccer",
  "tagTypeThree": "worldcup",
  "tagTypeJoin": "sports_soccer_worldcup",
  "status": 1,
  "tableType": 1,
  "eventNameI18n": [
    { "appLocale": "zh-CN", "content": "世界杯冠军预测", "contentOne": "" },
    { "appLocale": "en-US", "content": "World Cup Winner", "contentOne": "" }
  ],
  "markets": [
    {
      "marketId": "98765",
      "marketNameI18n": [
        { "appLocale": "zh-CN", "content": "阿根廷夺冠？", "contentOne": "" },
        { "appLocale": "en-US", "content": "Argentina to win?", "contentOne": "" }
      ]
    }
  ]
}
```

## 事件 / 查看Polymarket事件配置详情

- Method: GET
- Path: /polymarket/event/viewEvent
- YApi ID: 4678
- Status: done
- Request Query:
```json
[
  {
    "required": "1",
    "_id": "6a369b1506f2ee940808a376",
    "name": "eventId",
    "example": "12345",
    "desc": "Polymarket 事件 ID"
  }
]
```
- Response Body:
```json
{
  "type": "object",
  "required": [
    "code",
    "msg",
    "data"
  ],
  "properties": {
    "code": {
      "type": "string",
      "description": "业务状态码，0=成功，非0=失败"
    },
    "msg": {
      "type": "string",
      "description": "处理结果描述"
    },
    "message": {
      "type": "string",
      "description": "兼容消息字段，可能为空"
    },
    "data": {
      "type": "object",
      "description": "Polymarket 后台事件配置详情；结构与新增/修改入参基本一致，方便前端表单回显",
      "properties": {
        "eventId": {
          "type": "string",
          "description": "Polymarket 事件 ID"
        },
        "tagType": {
          "type": "string",
          "description": "一级分类 code，例如 sports（体育）"
        },
        "tagTypeTow": {
          "type": "string",
          "description": "二级分类 code，例如 soccer（足球）"
        },
        "tagTypeThree": {
          "type": "string",
          "description": "三级分类 code，例如 worldcup（世界杯）"
        },
        "tagTypeJoin": {
          "type": "string",
          "description": "分类归属集合，例如 sports_soccer_worldcup"
        },
        "status": {
          "type": "integer",
          "description": "状态：0=下线，1=仅可见，2=开启交易",
          "enum": [
            0,
            1,
            2
          ]
        },
        "tableType": {
          "type": "integer",
          "description": "事件类型：1=赛事，2=其他事件类型",
          "enum": [
            1,
            2
          ]
        },
        "eventNameI18n": {
          "type": "array",
          "description": "事件名称多语言配置列表",
          "items": {
            "type": "object",
            "required": [
              "appLocale",
              "content"
            ],
            "properties": {
              "appLocale": {
                "type": "string",
                "description": "系统语言标识，例如 zh-CN、en-US"
              },
              "content": {
                "type": "string",
                "description": "多语言展示内容，例如事件名称或市场名称"
              },
              "contentOne": {
                "type": "string",
                "description": "备用展示内容或扩展文案，可为空"
              }
            }
          }
        },
        "markets": {
          "type": "array",
          "description": "市场名称多语言配置列表；按市场 groupItemThreshold 升序返回，便于前端回显",
          "items": {
            "type": "object",
            "properties": {
              "marketId": {
                "type": "string",
                "description": "Polymarket 市场 ID"
              },
              "marketNameI18n": {
                "type": "array",
                "description": "该市场名称多语言配置列表",
                "items": {
                  "type": "object",
                  "required": [
                    "appLocale",
                    "content"
                  ],
                  "properties": {
                    "appLocale": {
                      "type": "string",
                      "description": "系统语言标识，例如 zh-CN、en-US"
                    },
                    "content": {
                      "type": "string",
                      "description": "多语言展示内容，例如事件名称或市场名称"
                    },
                    "contentOne": {
                      "type": "string",
                      "description": "备用展示内容或扩展文案，可为空"
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```
- Description:

按 Polymarket 事件 ID 查看后台事件配置详情。

业务说明：
- eventId 为必传 query 参数。
- 返回结构与新增/修改接口入参基本一致，用于后台编辑表单回显。
- eventNameI18n 为事件名称多语言列表。
- markets 为事件下市场名称多语言列表，后端按市场 groupItemThreshold 升序返回。
- 如果 eventId 为空会返回参数错误；如果事件不存在会返回“事件不存在”。
- 该接口当前不校验后台登录态，调用方仍建议在后台系统内使用。

返回 data 字段说明：
- eventId：Polymarket 事件 ID。
- tagType/tagTypeTow/tagTypeThree：一级/二级/三级分类 code。
- tagTypeJoin：分类归属集合，例如 sports_soccer_worldcup。
- status：0=下线，1=仅可见，2=开启交易。
- tableType：1=赛事，2=其他事件类型。
- eventNameI18n：事件名称多语言配置，元素包含 appLocale、content、contentOne。
- markets：市场多语言配置列表，元素包含 marketId、marketNameI18n。

返回示例：

```json
{
  "code": "0",
  "msg": "成功",
  "data": {
    "eventId": "12345",
    "tagType": "sports",
    "tagTypeTow": "soccer",
    "tagTypeThree": "worldcup",
    "tagTypeJoin": "sports_soccer_worldcup",
    "status": 1,
    "tableType": 1,
    "eventNameI18n": [
      { "appLocale": "zh-CN", "content": "世界杯冠军预测", "contentOne": "" },
      { "appLocale": "en-US", "content": "World Cup Winner", "contentOne": "" }
    ],
    "markets": [
      {
        "marketId": "98765",
        "marketNameI18n": [
          { "appLocale": "zh-CN", "content": "阿根廷夺冠？", "contentOne": "" },
          { "appLocale": "en-US", "content": "Argentina to win?", "contentOne": "" }
        ]
      }
    ]
  }
}
```

## 事件 / 后台分页查询Polymarket事件配置

- Method: POST
- Path: /polymarket/event/findAdminByPage
- YApi ID: 4681
- Status: done
- Request Body:
```json
{
  "type": "object",
  "properties": {
    "pageNum": {
      "type": "integer",
      "description": "页码，默认 1"
    },
    "pageSize": {
      "type": "integer",
      "description": "每页数量，默认 40"
    },
    "eventId": {
      "type": "string",
      "description": "Polymarket 事件 ID，精确筛选"
    },
    "tableType": {
      "type": "integer",
      "description": "事件类型：1=赛事，2=其他事件类型",
      "enum": [
        1,
        2
      ]
    },
    "status": {
      "type": "string",
      "description": "事件状态：0=下线，1=仅可见，2=开启交易"
    },
    "tagType": {
      "type": "string",
      "description": "一级分类 code，例如 sports"
    },
    "tagTypeTow": {
      "type": "string",
      "description": "二级分类 code，例如 soccer"
    },
    "tagTypeThree": {
      "type": "string",
      "description": "三级分类 code，例如 worldcup"
    },
    "startDateNum": {
      "type": "number",
      "description": "上线时间开始",
      "mock": {
        "mock": "1779552000000"
      }
    },
    "endDateNum": {
      "type": "number",
      "description": "上线时间结束",
      "mock": {
        "mock": "1779552000000"
      }
    },
    "settleStartDateNum": {
      "type": "number",
      "description": "结算时间开始",
      "mock": {
        "mock": "1779552000000"
      }
    },
    "settleEndDateNum": {
      "type": "number",
      "description": "结算时间结束",
      "mock": {
        "mock": "1779552000000"
      }
    }
  }
}
```
- Response Body:
```json
{
  "type": "object",
  "required": [
    "code",
    "msg",
    "data"
  ],
  "properties": {
    "code": {
      "type": "string",
      "description": "业务状态码，0=成功，非0=失败"
    },
    "msg": {
      "type": "string",
      "description": "处理结果描述"
    },
    "message": {
      "type": "string",
      "description": "兼容消息字段，可能为空"
    },
    "data": {
      "type": "object",
      "description": "分页查询结果",
      "properties": {
        "count": {
          "type": "integer",
          "description": "符合筛选条件的总记录数"
        },
        "list": {
          "type": "array",
          "description": "当前页事件配置列表",
          "items": {
            "type": "object",
            "description": "后台 Polymarket 事件配置列表项",
            "properties": {
              "id": {
                "type": "integer",
                "description": "本地 polymarket_event 表主键 ID"
              },
              "eventId": {
                "type": "string",
                "description": "Polymarket 事件 ID"
              },
              "title": {
                "type": "string",
                "description": "事件标题，来自 Polymarket 同步数据或后台配置"
              },
              "tagType": {
                "type": "string",
                "description": "一级分类 code，例如 sports（体育）"
              },
              "tagTypeTow": {
                "type": "string",
                "description": "二级分类 code，例如 soccer（足球）"
              },
              "tagTypeThree": {
                "type": "string",
                "description": "三级分类 code，例如 worldcup（世界杯）"
              },
              "tagTypeJoin": {
                "type": "string",
                "description": "分类归属集合，例如 sports_soccer_worldcup"
              },
              "status": {
                "type": "integer",
                "description": "状态：0=下线，1=仅可见，2=开启交易",
                "enum": [
                  0,
                  1,
                  2
                ]
              },
              "settleTime": {
                "type": "string",
                "description": "结算时间"
              },
              "settleStatus": {
                "type": "number",
                "description": "市场全部结算状态，0未结算，1已结算"
              },
              "startDate": {
                "type": "string",
                "description": "事件开始时间，格式 yyyy-MM-dd HH:mm:ss，GMT+0"
              },
              "endDate": {
                "type": "string",
                "description": "事件结束时间，格式 yyyy-MM-dd HH:mm:ss，GMT+0"
              },
              "createTime": {
                "type": "string",
                "description": "本地记录创建时间"
              }
            }
          }
        }
      }
    }
  }
}
```

## 事件 / 修改Polymarket事件状态

- Method: POST
- Path: /polymarket/event/updateEventStatus
- YApi ID: 4684
- Status: done
- Request Body:
```json
{
  "type": "object",
  "required": [
    "eventId",
    "status"
  ],
  "properties": {
    "eventId": {
      "type": "string",
      "description": "Polymarket 事件 ID"
    },
    "status": {
      "type": "integer",
      "description": "事件状态：0=下线，1=仅可见，2=开启交易"
    }
  }
}
```
- Response Body:
```json
{
  "type": "object",
  "properties": {
    "code": {
      "type": "string",
      "description": "业务状态码，0=成功，非0=失败"
    },
    "msg": {
      "type": "string",
      "description": "处理结果描述"
    },
    "message": {
      "type": "string",
      "description": "兼容消息字段，可能为空"
    },
    "data": {
      "description": "业务数据，不同接口结构不同"
    }
  }
}
```
- Description:

修改后台 Polymarket 事件状态。

业务说明：
- 通过 eventId 定位事件，只更新状态字段。
- status：0=下线，1=仅可见，2=开启交易。
- 开启交易前请确保事件和市场已同步、名称配置完整。
- 需要后台登录态；未登录返回 NotLogin 对应错误码。

请求示例：

```json
{
  "eventId": "12345",
  "status": 2
}
```

## 订单管理 / 预测市场订单管理列表

- Method: POST
- Path: /polymarket/order/pageList
- YApi ID: 4654
- Status: done
- Request Body:
```json
{
  "properties": {
    "tradeTimeStartNum": {
      "example": 1780247400000,
      "format": "int64",
      "description": "成交时间区间开始，毫秒时间戳",
      "type": "integer"
    },
    "txHash": {
      "description": "链上成交哈希，支持按哈希搜索",
      "example": "0x0a3f...",
      "type": "string"
    },
    "orderNo": {
      "description": "订单 ID，本地订单号",
      "example": "PM2026050000",
      "type": "string"
    },
    "opTradeType": {
      "enum": [
        "buy",
        "sell",
        "settled"
      ],
      "description": "类型：buy 买入、sell 卖出、settled 结算",
      "example": "buy",
      "type": "string"
    },
    "uid": {
      "description": "用户 UID",
      "example": 100382,
      "type": "integer"
    },
    "ctimeEndNum": {
      "example": 1780333800000,
      "format": "int64",
      "description": "创建时间区间结束，毫秒时间戳，左闭右开",
      "type": "integer"
    },
    "pageSize": {
      "description": "每页条数",
      "example": 20,
      "type": "integer"
    },
    "tradeTimeEndNum": {
      "example": 1780333800000,
      "format": "int64",
      "description": "成交时间区间结束，毫秒时间戳，左闭右开",
      "type": "integer"
    },
    "ctimeStartNum": {
      "example": 1780247400000,
      "format": "int64",
      "description": "创建时间区间开始，毫秒时间戳",
      "type": "integer"
    },
    "statusType": {
      "enum": [
        "success",
        "failed",
        "processing"
      ],
      "description": "状态：success 成功、failed 失败、processing 成交中",
      "example": "success",
      "type": "string"
    },
    "pageNum": {
      "description": "当前页码，从 1 开始",
      "example": 1,
      "type": "integer"
    }
  },
  "type": "object",
  "required": [
    "pageNum",
    "pageSize"
  ]
}
```
- Response Body:
```json
{
  "properties": {
    "code": {
      "type": "integer",
      "description": "业务状态码，成功时通常为 0"
    },
    "data": {
      "properties": {
        "count": {
          "type": "integer",
          "description": "总条数"
        },
        "list": {
          "description": "订单列表，仅包含页面列表展示字段",
          "items": {
            "properties": {
              "txHash": {
                "description": "链上成交哈希",
                "example": "0x0a3f...",
                "type": "string"
              },
              "orderNo": {
                "description": "订单 ID，本地订单号",
                "example": "PM2026050000",
                "type": "string"
              },
              "platformAmount": {
                "description": "平台收入",
                "example": 0.1,
                "type": "number"
              },
              "opTradeType": {
                "description": "类型原始值：buy 买入、sell 卖出、settled 结算",
                "example": "buy",
                "type": "string"
              },
              "statusTypeDesc": {
                "description": "状态文案：成功、失败、成交中",
                "example": "成交中",
                "type": "string"
              },
              "tradeShares": {
                "description": "份额",
                "example": 2,
                "type": "number"
              },
              "displayTime": {
                "example": "2026-05-30 09:10:00",
                "format": "date-time",
                "description": "创建/成交时间同一列展示：有成交时间取成交时间，否则取创建时间",
                "type": "string"
              },
              "statusType": {
                "description": "状态原始值：success 成功、failed 失败、processing 成交中",
                "example": "processing",
                "type": "string"
              },
              "displayTimeNum": {
                "example": 1780103400000,
                "format": "int64",
                "description": "创建/成交时间同一列展示对应的毫秒时间戳",
                "type": "integer"
              },
              "eventDirectionDisplay": {
                "description": "事件 / 方向，展示为事件名 + Yes/No 方向",
                "example": "事件 0 No",
                "type": "string"
              },
              "uid": {
                "description": "用户 UID",
                "example": 100382,
                "type": "integer"
              },
              "amount": {
                "description": "金额，买入为下单金额，卖出/结算为返还或结算金额",
                "example": 20,
                "type": "number"
              }
            },
            "type": "object"
          },
          "type": "array"
        }
      },
      "description": "分页数据",
      "type": "object",
      "required": [
        "count",
        "list"
      ]
    },
    "msg": {
      "type": "string",
      "description": "响应消息"
    }
  },
  "type": "object",
  "required": [
    "code",
    "msg",
    "data"
  ]
}
```

## 订单管理 / 预测市场订单管理导出

- Method: POST
- Path: /polymarket/order/export
- YApi ID: 4657
- Status: done
- Request Body:
```json
{
  "properties": {
    "tradeTimeStartNum": {
      "example": 1780247400000,
      "format": "int64",
      "description": "成交时间区间开始，毫秒时间戳",
      "type": "integer"
    },
    "txHash": {
      "description": "链上成交哈希，支持按哈希搜索",
      "example": "0x0a3f...",
      "type": "string"
    },
    "orderNo": {
      "description": "订单 ID，本地订单号",
      "example": "PM2026050000",
      "type": "string"
    },
    "opTradeType": {
      "enum": [
        "buy",
        "sell",
        "settled"
      ],
      "description": "类型：buy 买入、sell 卖出、settled 结算",
      "example": "buy",
      "type": "string"
    },
    "ctimeEndNum": {
      "example": 1780333800000,
      "format": "int64",
      "description": "创建时间区间结束，毫秒时间戳，左闭右开",
      "type": "integer"
    },
    "tradeTimeEndNum": {
      "example": 1780333800000,
      "format": "int64",
      "description": "成交时间区间结束，毫秒时间戳，左闭右开",
      "type": "integer"
    },
    "ctimeStartNum": {
      "example": 1780247400000,
      "format": "int64",
      "description": "创建时间区间开始，毫秒时间戳",
      "type": "integer"
    },
    "statusType": {
      "enum": [
        "success",
        "failed",
        "processing"
      ],
      "description": "状态：success 成功、failed 失败、processing 成交中",
      "example": "success",
      "type": "string"
    },
    "uid": {
      "description": "用户 UID",
      "example": 100382,
      "type": "integer"
    }
  },
  "type": "object",
  "required": []
}
```
- Response Body:
```json
{
  "properties": {
    "code": {
      "type": "string",
      "description": "失败时业务状态码；导出成功时直接返回 Excel 文件流，不返回 JSON"
    },
    "msg": {
      "type": "string",
      "description": "失败原因，例如暂无可导出数据、导出失败"
    }
  },
  "type": "object"
}
```

## 订单管理 / 预测市场订单管理统计数据

- Method: POST
- Path: /polymarket/order/stats
- YApi ID: 4660
- Status: done
- Request Body:
```json
{
  "type": "object",
  "title": "title",
  "properties": {}
}
```
- Response Body:
```json
{
  "properties": {
    "code": {
      "type": "integer",
      "description": "业务状态码，成功时通常为 0"
    },
    "data": {
      "properties": {
        "successOrderCount": {
          "example": 9980,
          "format": "int64",
          "description": "历史成功订单数，order_status=3",
          "type": "integer"
        },
        "todayOrderCount": {
          "example": 128,
          "format": "int64",
          "description": "今日订单数：按 Asia/Shanghai 今日自然日、订单创建时间统计新增订单数",
          "type": "integer"
        },
        "todayTradeAmount": {
          "description": "今日成交额：今日成功订单 amount 合计",
          "example": 123456.78,
          "type": "number"
        },
        "successRatePercent": {
          "description": "成交成功率百分比展示值，例如 97.46 表示 97.46%",
          "example": 97.46,
          "type": "number"
        },
        "processingOrderCount": {
          "example": 12,
          "format": "int64",
          "description": "历史成交中订单数，order_status in (1,2)",
          "type": "integer"
        },
        "totalOrderCount": {
          "example": 10240,
          "format": "int64",
          "description": "历史订单总数，用于计算成交成功率",
          "type": "integer"
        },
        "successRate": {
          "description": "成交成功率小数值：历史成功订单数 / 历史总订单数，保留 6 位计算精度",
          "example": 0.974609,
          "type": "number"
        }
      },
      "description": "订单管理顶部统计卡片数据",
      "type": "object"
    },
    "msg": {
      "type": "string",
      "description": "响应消息"
    }
  },
  "type": "object",
  "required": [
    "code",
    "msg",
    "data"
  ]
}
```

## 仓位管理 / 预测市场仓位管理列表

- Method: POST
- Path: /polymarket/position/pageList
- YApi ID: 4663
- Status: done
- Request Body:
```json
{
  "properties": {
    "positionId": {
      "example": 12345,
      "format": "int64",
      "description": "仓位 ID，对应 polymarket_order_position.id",
      "type": "integer"
    },
    "uid": {
      "description": "用户 UID",
      "example": 100382,
      "type": "integer"
    },
    "ctimeEndNum": {
      "example": 1780333800000,
      "format": "int64",
      "description": "创建时间区间结束，毫秒时间戳，左闭右开",
      "type": "integer"
    },
    "pageSize": {
      "description": "每页条数",
      "example": 20,
      "type": "integer"
    },
    "ctimeStartNum": {
      "example": 1780247400000,
      "format": "int64",
      "description": "创建时间区间开始，毫秒时间戳",
      "type": "integer"
    },
    "updatedEndNum": {
      "example": 1780333800000,
      "format": "int64",
      "description": "最后更新时间区间结束，毫秒时间戳，左闭右开",
      "type": "integer"
    },
    "positionStatusType": {
      "enum": [
        "holding",
        "closed"
      ],
      "description": "状态：holding 持仓中、closed 已平仓",
      "example": "holding",
      "type": "string"
    },
    "updatedStartNum": {
      "example": 1780247400000,
      "format": "int64",
      "description": "最后更新时间区间开始，毫秒时间戳",
      "type": "integer"
    },
    "pageNum": {
      "description": "当前页码，从 1 开始",
      "example": 1,
      "type": "integer"
    }
  },
  "type": "object",
  "required": [
    "pageNum",
    "pageSize"
  ]
}
```
- Response Body:
```json
{
  "properties": {
    "code": {
      "type": "integer",
      "description": "业务状态码，成功时通常为 0"
    },
    "data": {
      "properties": {
        "count": {
          "type": "integer",
          "description": "总条数"
        },
        "list": {
          "description": "仓位列表，仅包含页面列表展示字段",
          "items": {
            "properties": {
              "statusType": {
                "description": "状态原始值：holding 持仓中、closed 已平仓",
                "example": "holding",
                "type": "string"
              },
              "betShares": {
                "description": "份额",
                "example": 2,
                "type": "number"
              },
              "id": {
                "example": 12345,
                "format": "int64",
                "description": "仓位 ID",
                "type": "integer"
              },
              "platformAmount": {
                "description": "平台收入，按 position_id 汇总订单 platform_amount",
                "example": 0.1,
                "type": "number"
              },
              "statusTypeDesc": {
                "description": "状态文案：持仓中、已平仓",
                "example": "持仓中",
                "type": "string"
              },
              "betAmount": {
                "description": "保证金(USDT)",
                "example": 20,
                "type": "number"
              },
              "createdAt": {
                "example": "2026-05-30 09:10:00",
                "format": "date-time",
                "description": "创建时间",
                "type": "string"
              },
              "createdTime": {
                "example": 1780103400000,
                "format": "int64",
                "description": "创建时间毫秒时间戳",
                "type": "integer"
              },
              "updatedAt": {
                "example": "2026-05-31 09:10:00",
                "format": "date-time",
                "description": "最后更新时间",
                "type": "string"
              },
              "eventDirectionDisplay": {
                "description": "事件 / 方向，展示为事件名 + Yes/No 方向",
                "example": "事件 1 Yes",
                "type": "string"
              },
              "uid": {
                "description": "用户 UID",
                "example": 100382,
                "type": "integer"
              },
              "updatedTime": {
                "example": 1780189800000,
                "format": "int64",
                "description": "最后更新时间毫秒时间戳",
                "type": "integer"
              }
            },
            "type": "object"
          },
          "type": "array"
        }
      },
      "description": "分页数据",
      "type": "object",
      "required": [
        "count",
        "list"
      ]
    },
    "msg": {
      "type": "string",
      "description": "响应消息"
    }
  },
  "type": "object",
  "required": [
    "code",
    "msg",
    "data"
  ]
}
```

## 仓位管理 / 预测市场仓位管理导出

- Method: POST
- Path: /polymarket/position/export
- YApi ID: 4666
- Status: done
- Request Body:
```json
{
  "properties": {
    "ctimeEndNum": {
      "example": 1780333800000,
      "format": "int64",
      "description": "创建时间区间结束，毫秒时间戳，左闭右开",
      "type": "integer"
    },
    "updatedEndNum": {
      "example": 1780333800000,
      "format": "int64",
      "description": "最后更新时间区间结束，毫秒时间戳，左闭右开",
      "type": "integer"
    },
    "uid": {
      "description": "用户 UID",
      "example": 100382,
      "type": "integer"
    },
    "ctimeStartNum": {
      "example": 1780247400000,
      "format": "int64",
      "description": "创建时间区间开始，毫秒时间戳",
      "type": "integer"
    },
    "positionId": {
      "example": 12345,
      "format": "int64",
      "description": "仓位 ID，对应 polymarket_order_position.id",
      "type": "integer"
    },
    "positionStatusType": {
      "enum": [
        "holding",
        "closed"
      ],
      "description": "状态：holding 持仓中、closed 已平仓",
      "example": "holding",
      "type": "string"
    },
    "updatedStartNum": {
      "example": 1780247400000,
      "format": "int64",
      "description": "最后更新时间区间开始，毫秒时间戳",
      "type": "integer"
    }
  },
  "type": "object",
  "required": []
}
```
- Response Body:
```json
{
  "properties": {
    "code": {
      "type": "string",
      "description": "失败时业务状态码；导出成功时直接返回 Excel 文件流，不返回 JSON"
    },
    "msg": {
      "type": "string",
      "description": "失败原因，例如暂无可导出数据、导出失败"
    }
  },
  "type": "object"
}
```

## 手动平账 / 持仓差异列表

- Method: POST
- Path: /positionDiff/pageList
- YApi ID: 5191
- Status: done
- Request Body:
```json
{
  "type": "object",
  "properties": {
    "pageNum": {
      "type": "integer",
      "description": "当前页码，从 1 开始",
      "example": 1
    },
    "pageSize": {
      "type": "integer",
      "description": "每页条数",
      "example": 40
    },
    "tokenId": {
      "type": "string",
      "description": "tokenId",
      "example": "1234567890"
    },
    "eventId": {
      "type": "string",
      "description": "事件 ID",
      "example": "event_1"
    },
    "marketId": {
      "type": "string",
      "description": "市场 ID",
      "example": "market_1"
    },
    "status": {
      "type": "integer",
      "description": "状态：0 待平账，1 已平账；当前接口后端固定为 0",
      "example": 0
    }
  },
  "required": [
    "pageNum",
    "pageSize"
  ]
}
```
- Response Body:
```json
{
  "type": "object",
  "properties": {
    "code": {
      "type": "integer",
      "description": "业务状态码，成功时通常为 0"
    },
    "msg": {
      "type": "string",
      "description": "响应消息"
    },
    "data": {
      "type": "object",
      "description": "响应数据",
      "properties": {
        "count": {
          "type": "integer",
          "description": "总条数",
          "example": 0
        },
        "list": {
          "type": "array",
          "description": "持仓差异列表",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "integer",
                "format": "int64",
                "description": "持仓差异记录 ID",
                "example": 1
              },
              "marketTitle": {
                "type": "string",
                "description": "市场标题",
                "example": "Will BTC hit $100k?"
              },
              "eventDirection": {
                "type": "string",
                "description": "方向，如 Yes/No/Up 等",
                "example": "Yes"
              },
              "exchangePosition": {
                "type": "number",
                "description": "交易所持仓",
                "example": 10
              },
              "chainPosition": {
                "type": "number",
                "description": "链上持仓",
                "example": 8
              },
              "diffValue": {
                "type": "number",
                "description": "差异值",
                "example": 2
              },
              "diffRate": {
                "type": "number",
                "description": "差异率",
                "example": 0.2
              },
              "suggestAction": {
                "type": "string",
                "description": "建议动作",
                "example": "买入 2 份"
              },
              "tokenId": {
                "type": "string",
                "description": "tokenId",
                "example": "1234567890"
              },
              "eventId": {
                "type": "string",
                "description": "事件 ID",
                "example": "event_1"
              },
              "marketId": {
                "type": "string",
                "description": "市场 ID",
                "example": "market_1"
              },
              "status": {
                "type": "integer",
                "description": "状态：0 待平账，1 已平账",
                "example": 0
              },
              "createdAt": {
                "type": "string",
                "format": "date-time",
                "description": "创建时间",
                "example": "2026-06-22 10:00:00"
              },
              "updatedAt": {
                "type": "string",
                "format": "date-time",
                "description": "更新时间",
                "example": "2026-06-22 10:10:00"
              },
              "opType": {
                "type": "string",
                "description": "操作类型/买卖方向：BUY/SELL",
                "enum": [
                  "BUY",
                  "SELL"
                ],
                "example": "BUY"
              },
              "conditionId": {
                "type": "string",
                "description": "conditionId",
                "example": "0xabc"
              },
              "tradeDiffValue": {
                "type": "number",
                "description": "实际交易差异值",
                "example": 2
              }
            }
          }
        }
      },
      "required": [
        "count",
        "list"
      ]
    }
  },
  "required": [
    "code",
    "msg",
    "data"
  ]
}
```
- Description:

查询待平账持仓差异列表。后端会固定 status=0，只返回待平账记录。

## 手动平账 / 手动平仓操作记录列表

- Method: POST
- Path: /positionDiff/balanceRecordPageList
- YApi ID: 5194
- Status: done
- Request Body:
```json
{
  "type": "object",
  "properties": {
    "pageNum": {
      "type": "integer",
      "description": "当前页码，从 1 开始",
      "example": 1
    },
    "pageSize": {
      "type": "integer",
      "description": "每页条数",
      "example": 40
    },
    "balanceNo": {
      "type": "string",
      "description": "平账编号",
      "example": "PBb5f5bd093af3"
    },
    "positionDiffId": {
      "type": "integer",
      "format": "int64",
      "description": "持仓差异记录 ID",
      "example": 1
    },
    "side": {
      "type": "string",
      "description": "买卖方向：BUY/SELL",
      "enum": [
        "BUY",
        "SELL"
      ],
      "example": "BUY"
    },
    "operatorName": {
      "type": "string",
      "description": "操作人",
      "example": "admin"
    },
    "result": {
      "type": "integer",
      "description": "结果：0 执行中，1 已完成，2 失败",
      "enum": [
        0,
        1,
        2
      ],
      "example": 1
    }
  },
  "required": [
    "pageNum",
    "pageSize"
  ]
}
```
- Response Body:
```json
{
  "type": "object",
  "properties": {
    "code": {
      "type": "integer",
      "description": "业务状态码，成功时通常为 0"
    },
    "msg": {
      "type": "string",
      "description": "响应消息"
    },
    "data": {
      "type": "object",
      "description": "响应数据",
      "properties": {
        "count": {
          "type": "integer",
          "description": "总条数",
          "example": 0
        },
        "list": {
          "type": "array",
          "description": "手动平仓操作记录列表",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "integer",
                "format": "int64",
                "description": "记录 ID",
                "example": 1
              },
              "balanceNo": {
                "type": "string",
                "description": "平账编号",
                "example": "PBb5f5bd093af3"
              },
              "positionDiffId": {
                "type": "integer",
                "format": "int64",
                "description": "持仓差异记录 ID",
                "example": 1
              },
              "marketTitle": {
                "type": "string",
                "description": "市场标题",
                "example": "Will BTC hit $100k?"
              },
              "eventDirection": {
                "type": "string",
                "description": "方向，如 Yes/No/Up 等",
                "example": "Yes"
              },
              "suggestAction": {
                "type": "string",
                "description": "动作（建议动作）",
                "example": "买入 2 份"
              },
              "side": {
                "type": "string",
                "description": "买卖方向：BUY/SELL",
                "enum": [
                  "BUY",
                  "SELL"
                ],
                "example": "BUY"
              },
              "price": {
                "type": "number",
                "description": "单价",
                "example": 0.52
              },
              "operatorName": {
                "type": "string",
                "description": "操作人",
                "example": "admin"
              },
              "startedAt": {
                "type": "string",
                "format": "date-time",
                "description": "发起平账时间",
                "example": "2026-06-22 10:00:00"
              },
              "completedAt": {
                "type": "string",
                "format": "date-time",
                "description": "完成时间",
                "example": "2026-06-22 10:01:00"
              },
              "result": {
                "type": "integer",
                "description": "结果：0 执行中，1 已完成，2 失败",
                "enum": [
                  0,
                  1,
                  2
                ],
                "example": 1
              }
            }
          }
        }
      },
      "required": [
        "count",
        "list"
      ]
    }
  },
  "required": [
    "code",
    "msg",
    "data"
  ]
}
```
- Description:

分页查询手动平仓/平账操作记录。

## 手动平账 / 手动平账

- Method: POST
- Path: /positionDiff/markBalanced
- YApi ID: 5197
- Status: done
- Request Body:
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "integer",
      "format": "int64",
      "description": "持仓差异记录 ID",
      "example": 1
    }
  },
  "required": [
    "id"
  ]
}
```
- Response Body:
```json
{
  "type": "object",
  "properties": {
    "code": {
      "type": "integer",
      "description": "业务状态码，成功时通常为 0"
    },
    "msg": {
      "type": "string",
      "description": "响应消息"
    },
    "data": {
      "type": "boolean",
      "description": "是否平账成功",
      "example": true
    }
  },
  "required": [
    "code",
    "msg",
    "data"
  ]
}
```
- Description:

<p>对指定持仓差异记录发起手动平账。成功后返回 true；失败时返回业务错误信息。</p>


## 手动平账 / 手动平仓操作记录导出

- Method: POST
- Path: /positionDiff/export
- YApi ID: 5203
- Status: done
- Request Body:
```json
{
  "type": "object",
  "properties": {
    "pageNum": {
      "type": "integer",
      "description": "当前页码，从 1 开始",
      "example": 1
    },
    "pageSize": {
      "type": "integer",
      "description": "每页条数",
      "example": 40
    },
    "balanceNo": {
      "type": "string",
      "description": "平账编号",
      "example": "PBb5f5bd093af3"
    },
    "positionDiffId": {
      "type": "integer",
      "format": "int64",
      "description": "持仓差异记录 ID",
      "example": 1
    },
    "side": {
      "type": "string",
      "description": "买卖方向：BUY/SELL",
      "enum": [
        "BUY",
        "SELL"
      ],
      "example": "BUY"
    },
    "operatorName": {
      "type": "string",
      "description": "操作人",
      "example": "admin"
    },
    "result": {
      "type": "integer",
      "description": "结果：0 执行中，1 已完成，2 失败",
      "enum": [
        0,
        1,
        2
      ],
      "example": 1
    }
  },
  "required": [
    "pageNum",
    "pageSize"
  ]
}
```
- Response Body:
```json
{
  "type": "object",
  "properties": {}
}
```
- Description:

<p>分页查询手动平仓/平账操作记录。</p>


## 手动平账 / 持仓差异统计

- Method: GET
- Path: /positionDiff/statistics
- YApi ID: 5218
- Status: done
- Response Body:
```json
{
  "properties": {
    "code": {
      "type": "integer",
      "description": "业务状态码，成功时通常为 0"
    },
    "msg": {
      "type": "string",
      "description": "响应消息"
    },
    "data": {
      "type": "object",
      "description": "持仓差异顶部统计数据",
      "required": [
        "unEventCount",
        "sumDiffValue",
        "todayBalancedCount",
        "latestTime"
      ],
      "properties": {
        "unEventCount": {
          "description": "未平事件数量，统计 status=0 的持仓差异记录数",
          "example": 12,
          "type": "integer"
        },
        "sumDiffValue": {
          "description": "待平账差异额，统计 status=0 的 diff_value 绝对值合计",
          "example": 1234.56,
          "type": "number"
        },
        "todayBalancedCount": {
          "description": "今日已平数量，统计今日完成且 result=1 的平账记录数",
          "example": 8,
          "type": "integer"
        },
        "latestTime": {
          "description": "最近同步事件时间",
          "example": "2026-06-23 10:00:00",
          "type": "string"
        }
      }
    }
  },
  "type": "object",
  "required": [
    "code",
    "msg",
    "data"
  ]
}
```
- Description:

<p>查询持仓差异页面顶部统计数据：未平事件数量、待平账差异额、今日已平数量、最近同步事件时间。</p>


## 通用参数管理 / 更新通用参数配置

- Method: POST
- Path: /polymarket/alert-config/fee/update
- YApi ID: 4618
- Status: done
- Request Body:
```json
{
  "properties": {
    "settlementFee": {
      "description": "结算费率，对应 polymarket_settlement_fee",
      "example": 3,
      "type": "integer"
    },
    "sellFee": {
      "description": "卖出费率，对应 polymarket_sell_fee",
      "example": "https://open.larksuite.com/open-apis/bot/v2/hook/xxxx",
      "type": "string"
    },
    "buyFee": {
      "description": "买入费率，对应 polymarket_buy_fee",
      "example": 5,
      "type": "integer"
    }
  },
  "type": "object",
  "required": [
    "sellFee",
    "settlementFee",
    "buyFee"
  ]
}
```
- Response Body:
```json
{
  "properties": {
    "code": {
      "type": "integer",
      "description": "业务状态码，成功时通常为 0"
    },
    "data": {
      "type": "object",
      "description": "成功时可能为空",
      "properties": {}
    },
    "msg": {
      "type": "string",
      "description": "响应消息"
    }
  },
  "type": "object"
}
```

## 通用参数管理 / 查询通用参数配置

- Method: GET
- Path: /polymarket/alert-config/get_1782211018309
- YApi ID: 5212
- Status: done
- Response Body:
```json
{
  "properties": {
    "code": {
      "type": "integer",
      "description": "业务状态码，成功时通常为 0"
    },
    "data": {
      "properties": {
        "settlementFee": {
          "type": "integer",
          "description": "结算费率，对应 polymarket_settlement_fee"
        },
        "sellFee": {
          "type": "string",
          "description": "卖出费率，对应 polymarket_sell_fee"
        },
        "buyFee": {
          "type": "integer",
          "description": "买入费率，对应 polymarket_buy_fee"
        }
      },
      "description": "Polymarket 预警配置",
      "type": "object",
      "required": []
    }
  },
  "type": "object",
  "required": [
    "code",
    "data"
  ]
}
```

