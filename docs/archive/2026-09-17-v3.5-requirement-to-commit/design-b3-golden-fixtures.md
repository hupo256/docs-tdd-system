# 附录 B-3：P0 golden fixtures + 失败案例（v3.5，纸面基线）

> 状态：纸面样本数据，不动引擎代码。配合 B-1（案例预期）、B-2（schema/状态机）使用。
>
> 用途：把 B-1 四案例落成可回归的 fixture 输入/输出对，覆盖 Phase 1 验收标准场景 A/B/C/D。
> 每个 fixture 给：`work-item 切片` + `代码树事实` + `期望 reconcile-result` + `期望状态` + `期望被拦截话术`。
> 实现阶段这些直接转成 `__fixtures__/` 下的 json + 断言，不需重新设计。

---

## Fixture 1：场景 A/B/C 主锚点 —— PR-02233 pivot + consumer wiring

> 对应 B-1 案例 1。一个 fixture 同时覆盖场景 A（provider covered/consumer missing）、B（pivot stale）、C（依赖局部阻塞）。

### 输入 · work-item 切片（结构化后）

```jsonc
{
  "deliveryTarget": { "app": "apps/web-next",
    "history": [{ "app": "apps/web", "reason": "pivot to web-next" }] },
  "apiDependency": [
    { "id": "API-COOLDOWN-TS", "ready": false },
    { "id": "API-RATE-LIMIT",  "ready": false }
  ],
  "requirements": [
    { "requirementId": "R-001", "status": "doing", "affectedSurfaces": [
      { "surfaceId": "S-001", "disposition": "implement",
        "codeLocator": { "kind": "component", "app": "apps/web-next",
          "symbol": "SendCodeButton", "role": "provider" } },
      { "surfaceId": "S-004", "disposition": "implement",
        "codeLocator": { "kind": "component", "app": "apps/web-next",
          "symbol": "SwitchVerifyMethodDialog", "role": "provider" } },
      { "surfaceId": "S-005", "disposition": "implement",
        "codeLocator": { "kind": "component", "app": "apps/web-next",
          "symbol": "LoginPage", "role": "consumer" },
        "wiring": { "role": "consumer", "dependsOn": ["S-004"],
          "wiringEvidence": "browser" } },
      { "surfaceId": "S-014", "disposition": "implement",
        "codeLocator": { "kind": "function", "app": "apps/web-next",
          "symbol": "resolveCooldownRemaining", "role": "standalone" },
        "blockedBy": ["API-COOLDOWN-TS"] }
    ]}
  ]
}
```

### 输入 · 代码树事实（fixture 用 stub 表达）

```text
apps/web-next/src/.../SendCodeButton.tsx        存在，导出 SendCodeButton
apps/web-next/src/.../SwitchVerifyMethodDialog  不存在（symbol 找不到）
apps/web-next/src/.../LoginPage.tsx             存在，但未 import SwitchVerifyMethodDialog
apps/web/src/...（旧 app）                        有历史实现，属 stale
API-COOLDOWN-TS / API-RATE-LIMIT                未就绪
```

### 期望 · reconcile-result

```jsonc
{
  "deliveryTargetApp": "apps/web-next",
  "surfaces": [
    { "surfaceId": "S-001", "codeStatus": "covered",  "wiringStatus": "n/a",     "runtimeStatus": "n/a" },
    { "surfaceId": "S-004", "codeStatus": "missing",  "wiringStatus": "n/a",     "runtimeStatus": "n/a",
      "notes": "symbol SwitchVerifyMethodDialog not found in apps/web-next" },
    { "surfaceId": "S-005", "codeStatus": "covered",  "wiringStatus": "missing", "runtimeStatus": "not-verified",
      "notes": "provider S-004 missing; LoginPage does not import dialog" },
    { "surfaceId": "S-014", "codeStatus": "covered",  "wiringStatus": "n/a",     "runtimeStatus": "n/a",
      "notes": "integration-pending: API-COOLDOWN-TS not ready" }
  ],
  "rollup": {
    "overall": "partially-implemented",
    "missingCount": 1, "partialCount": 1,
    "runtimeCriticalPending": ["S-005"],
    "integrationPending": ["S-014"]
  }
}
```

### 期望状态 / 拦截话术

- 状态停在 `partially-implemented`（S-004 missing、S-005 wiring missing）→ 不得进 implementation-complete / integration-pending。
- A1 拦截：「开发完成」「三页已接入」「已取得双视口回归」「验证方式切换流程已迁移完成」。
- A7 拦截：delivery commit 标题 `migrate verification flow` → overclaim（S-004 不存在）。
- A5 断言：旧 `apps/web` 历史实现不得计入 covered，S-005 若曾在旧 app verified 则标 stale 不继承。

---

## Fixture 2：场景 A 纯净版 —— provider covered / consumer missing

> 剥离 pivot 和依赖噪声，只验 A3 provider/consumer 关闭规则。

### 输入

```text
work-item: S-010 provider(Dialog, role=provider), S-011 consumer(role=consumer, dependsOn=[S-010], wiringEvidence=render)
代码树: Dialog 存在且导出；消费页存在但无 render 证据（未 import）
```

### 期望

```jsonc
{ "surfaces": [
  { "surfaceId": "S-010", "codeStatus": "covered", "wiringStatus": "n/a",     "runtimeStatus": "n/a" },
  { "surfaceId": "S-011", "codeStatus": "covered", "wiringStatus": "missing", "runtimeStatus": "n/a" }
], "rollup": { "overall": "partially-implemented", "runtimeCriticalPending": [] } }
```

- 断言：provider covered 不足以关闭 requirement；consumer wiring missing → overall incomplete。
- 反向 fixture（应通过）：消费页 import + render + 事件绑定齐全 → S-011 wiringStatus=covered，overall 可达 implementation-complete。

---

## Fixture 3：场景 B 纯净版 —— pivot 使旧完成度失效

> 只验 A5。

### 输入

```text
上一轮 reconcile-result.deliveryTargetApp = apps/web
当前 work-item.deliveryTarget.app = apps/web-next
旧 app 下 S-020/S-021 曾 codeStatus=covered, runtimeStatus=verified
新 app 下无对账记录
```

### 期望

```jsonc
{ "deliveryTargetApp": "apps/web-next", "surfaces": [
  { "surfaceId": "S-020", "codeStatus": "stale", "wiringStatus": "n/a", "runtimeStatus": "n/a" },
  { "surfaceId": "S-021", "codeStatus": "stale", "wiringStatus": "n/a", "runtimeStatus": "n/a" }
], "rollup": { "overall": "implementing" } }
```

- 断言：pivot 检测触发，旧 covered/verified 全重置为 stale；状态从任意 ≥implementing 回退到 implementing。
- 失败案例（应报错）：若对账器沿用旧 app 的 covered 计入新完成度 → fixture 判 fail。

---

## Fixture 4：场景 C 纯净版 —— 依赖只阻塞部分 surface

> 只验 A6 blast-radius。

### 输入

```text
apiDependency: [API-X ready=false]
S-030 blockedBy=[API-X], 代码树: 落点存在
S-031 无 blockedBy,     代码树: 落点存在
S-032 无 blockedBy,     代码树: 落点缺失
```

### 期望

```jsonc
{ "surfaces": [
  { "surfaceId": "S-030", "codeStatus": "covered", "runtimeStatus": "n/a", "notes": "integration-pending: API-X" },
  { "surfaceId": "S-031", "codeStatus": "covered" },
  { "surfaceId": "S-032", "codeStatus": "missing" }
], "rollup": { "overall": "partially-implemented",
  "integrationPending": ["S-030"], "missingCount": 1 } }
```

- 断言：只有 S-030 进 integration-pending；S-031 照常 covered；S-032 missing 使 overall 停在 partially-implemented。
- 反向 fixture：若 S-032 也 covered，则 overall = integration-pending（仅剩 S-030 集成项）。
- A1 拦截：「等待 API，整批不能继续」——因为存在无依赖的可实现项。

---

## Fixture 5：场景 D —— 有静态证据无真实交互

> 对应 B-1 案例 4，验 A4 runtime critical path + D3 overclaim + D4 scoped 展开。

### 输入

```text
R-040 声明 UI 交互（切换后输入区替换），evidencePlan 仅含 copy-literal + component-dom（runtimeRequired=false）
无 browser-interaction / human-check 证据
测试命令: "pnpm test --run x.test.ts"，但 package.json: test = "vitest run src"
```

### 期望

```jsonc
{ "surfaces": [
  { "surfaceId": "S-040", "codeStatus": "covered", "wiringStatus": "covered", "runtimeStatus": "not-verified",
    "notes": "critical interaction path requires browser-interaction or human-check" }
], "rollup": { "overall": "implementation-complete", "runtimeCriticalPending": ["S-040"] } }
```

- 断言：codeStatus/wiringStatus covered 但 runtimeStatus not-verified → 不得进 ready-for-human-acceptance。
- A4 拦截：静态字符串 + DOM contract 不能关闭 runtime critical path。
- D4 拦截：命令展开成 `vitest run src` 含目录入口 → 拒绝称 scoped，要求显式文件列表。
- 反向 fixture：补 browser-interaction 证据 → runtimeStatus=verified，overall 可达 ready-for-human-acceptance。

---

## Fixture 与验收标准覆盖表

| 场景 | 主 fixture | 纯净/反向 fixture |
|---|---|---|
| A provider/consumer | Fixture 1（S-004/S-005）| Fixture 2 |
| B pivot invalidation | Fixture 1（web→web-next）| Fixture 3 |
| C dependency blast-radius | Fixture 1（S-014）| Fixture 4 |
| D runtime critical path | —— | Fixture 5 |
| A1 completion-language | Fixture 1/4 拦截话术 | 各反向 fixture 的放行断言 |
| A7 commit overclaim | Fixture 1（migrate 标题）| —— |

> 说明：Fixture 1 是集成主锚点（A/B/C 同时命中真实事故形态）；Fixture 2–5 是单点纯净回归，各配一个反向（应通过）样本，保证守卫不误杀正常完成态。B-1 案例 2（Bugfix Lite）、案例 3（kickoff）属 Phase 2 流程弹性，不在 P0 fixture 集内，留待 Phase 2 单独立 fixture。

---

## 解锁编码的前置检查（三份中间物就位后）

- [x] B-1 四案例预期行为定义
- [x] B-2 schema/状态机草图（D-1/D-2/D-3 已冻结）
- [x] B-3 golden fixtures + 失败案例（本份）
- [ ] 人工评审通过本三份 → 才解锁 A2 实现（首个改动：`vnext-work-item.schema.json` surface 结构扩展，向后兼容）

> 三份纸面基线已齐，均未动引擎代码。下一步等待人工评审确认，再进入实现。
