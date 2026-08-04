# PR-02006 API Contract

## 当前状态

YApi project `467` / `futures-admin-api` 已于 2026-06-22 拉取，原始快照见 `../inbox/yapi/`，整理后的合约后台币种接口见 `product/api/admin-contract-coin.md`。Web 侧字段仍按 public_info / ticker 现有能力与 mock-first 预留。

## Web 侧字段需求

| 能力 | 需要字段 / 能力 | 当前来源假设 | 状态 |
|------|-----------------|--------------|------|
| TradFi 板块识别 | contract sectionIds + `configSectionList.section === TradFi` | `public_info` 已有 | 待复核 |
| TradFi 标签分类 | contract `symbolTag` 及标签展示名 | `public_info` 已有 `symbolTag`，展示名可能前端映射 | 待确认多语言 |
| 币种别名 | 当前语言的 alias / nickname | 币种配置接口或 public_info 扩展 | 待确认 |
| 24h 成交额 | 对应币对交易页已有成交额值 | ticker store / futures market list 数据 | 待确认字段名 |
| 最新价 / 涨跌 / 高低价 | ticker close / rose / high / low | 已有 | 待复核精度 |
| logo | coin icon | 已有 `coinResultVo.icon` | 需按行情页样式优化 |
| 语言参数 | 当前 locale 传入接口 | i18n locale / request headers / query | 待确认 |

## Admin 侧字段需求

| 能力 | 字段 | 说明 | 状态 |
|------|------|------|------|
| 归属板块 | `type` | `1` 默认 / USDT本位；`2` TradFi | 已按 YApi 确认 |
| 多语言别名 | `coinAliasI18nList[].content` | 仅归属板块为 TradFi 时展示并必填 | 已按 YApi 确认 |
| 国家语言列表 | `state.baseData.languageArr` | 动态读取后台多语言配置中的国家语言维度；缺失时降级默认语言 | 前端已有来源 |
| 保存校验 | 前端必填校验 | 失焦和保存均触发；提示英文文案 | 已实现 |

## Mock 场景矩阵

| 场景 | Web | Admin |
|------|-----|-------|
| 正常 | 多板块、多 TradFi 标签、别名完整、成交额不同 | TradFi 币种别名多语言完整 |
| 空分类 | 某标签下无有效币对，应隐藏标签 | 无 |
| 空搜索 | 当前 Tab 下无匹配，展示空态 | 无 |
| 缺别名 | Web 降级展示无标签或占位；Admin 阻止保存 | 必填报错 |
| 缺成交额 | 排序沉底，格式展示 `--` 或确认文案 | 无 |
| 多语言 | 当前语言切换后别名随接口返回变化 | 语言列表动态渲染 |

## 待确认

1. Web 别名字段是否进入 `public_info`、ticker、单独接口，还是由现有币种接口提供。
2. 24h 成交额字段名、单位、是否已是 USDT 折算值。
3. TradFi 标签展示名是否由后端多语言返回。
4. Admin 列表回显接口响应 schema 未完整展开，当前按保存接口字段与现有页面数据兼容处理。
5. PRD §七 验收 sheet 明细。
