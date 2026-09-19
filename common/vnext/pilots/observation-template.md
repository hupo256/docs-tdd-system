# Pilot 完成与 post-test observation 模板

> `pilot-registry.json` 同时记录执行证明和提测后观察。运行
> `node common/engine/agent-scripts/vnext-pilot.mjs --write` 刷新报告。
> 未真实完成的字段必须保持 `null`，禁止为补齐 R-13 追认历史样本或预填零逃逸。

## 1. v3.5 公共命令执行证明

只有样本已经通过公共 `docs-tdd` 命令完成 intake、review、implementation checkpoint、CLI evidence、enforced verify 和 delivery commit 后，才填写：

```json
{
  "release": "autopilot-v3.5",
  "publicCommandsOnly": true,
  "attestedBy": "填写人姓名/工号",
  "attestedAt": "YYYY-MM-DDTHH:mm:ssZ"
}
```

- `release` 必须等于 registry 的 `qualificationTarget.release`。
- `publicCommandsOnly` 只能在全流程未直接改写状态/结果、未绕过 public CLI 时填 `true`。
- `attestedBy` / `attestedAt` 由实际核对命令链的人填写。
- 仅有 PASS、旧版历史快照或 synthetic fixture 都不能构成该证明。

## 2. 提测后 observation

```json
{
  "confirmedBy": "填写人姓名/工号",
  "observedThrough": "YYYY-MM-DDTHH:mm:ssZ",
  "requirementOmissionEscapes": 0,
  "falseGreenEscapes": 0,
  "notes": ""
}
```

- `confirmedBy`：实际观察并确认的负责人。
- `observedThrough`：真实观察截止时间，不得晚于填表时间。
- `requirementOmissionEscapes`：提测后发现的 PRD 漏项数量。
- `falseGreenEscapes`：enforced PASS 后在提测中暴露的假绿次数。
- `notes`：补充漏项类型、修复批次或 QA 结论。

## 3. R-13 完成条件

`R13_PUBLIC_COMMAND_PILOTS` 只有在 V0、V1、V2 各至少一个样本同时满足以下条件时通过：

1. 三文件出口完整、签名与 run history 一致，结果为 authoritative PASS；
2. post-test observation 已由负责人填写；
3. `executionAttestation.release=autopilot-v3.5`；
4. `executionAttestation.publicCommandsOnly=true`。

当前历史 V0/V1 样本不自动追认为 v3.5；已纳入但尚未完成的项目允许保持 collecting。真实 clean-project/public-command V0/V1/V2 pilot 尚未完成，不得把 synthetic fixture 或旧快照填成执行证明。
