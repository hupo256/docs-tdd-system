# 灰度样本 post-test observation 模板

> `pilot-registry.json` 中的 `observation` 字段必须用本模板格式填写；填完后运行 `node common/engine/agent-scripts/vnext-pilot.mjs --write` 刷新报告。
> 观察截止时间必须真实，填表人必须署名。

## 模板结构

```json
{
  "observedBy": "填写人姓名/工号",
  "observedThrough": "YYYY-MM-DD",
  "omissionEscapes": 0,
  "falseGreenEscapes": 0,
  "notes": ""
}
```

## 字段说明

- `observedBy`：实际观察并确认的负责人。
- `observedThrough`：观察截止时间，不得晚于实际填表日期。
- `omissionEscapes`：提测后发现的 PRD 漏项数量。
- `falseGreenEscapes`：提测前 vNext 出口 PASS、提测后实际失败的次数。
- `notes`：补充说明，如漏项类型、修复批次等。

## PR-02074-SEARCH-WIDTH（V0）

```json
{
  "sampleId": "PR-02074-SEARCH-WIDTH",
  "projectId": "PR-02074",
  "observedBy": "",
  "observedThrough": "",
  "omissionEscapes": null,
  "falseGreenEscapes": null,
  "notes": ""
}
```

## PR-02172-PROVIDER-VISIBILITY（V1）

```json
{
  "sampleId": "PR-02172-PROVIDER-VISIBILITY",
  "projectId": "PR-02172",
  "observedBy": "",
  "observedThrough": "",
  "omissionEscapes": null,
  "falseGreenEscapes": null,
  "notes": ""
}
```

## 使用方式

1. 确认/填写对应样本的 observation 对象。
2. 写入 `common/vnext/pilot-registry.json` 对应 `entries[].observation`。
3. 运行 `node common/engine/agent-scripts/vnext-pilot.mjs --write`。
