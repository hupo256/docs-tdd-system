# 附录 B-2：A2 surface→code 对账地基的 schema / 状态迁移草图（v3.5 P0）

> 状态：纸面草图，不动代码。字段名与 `common/engine/schemas/vnext-work-item.schema.json` 现状对齐；标注「新增 / 扩展 / 复用」。
>
> 目的：先冻结 A2 地基字段，A3/A5/A6/A7 挂在其上，避免边写边改结构。
>
> **冻结状态：本份已通过 P0 评审（见计划附录 C），D-1/D-2/D-3 三项拍板结论已回填。§7 六项契约进入 frozen 状态，作为实现契约。**
>
> 现状核对（已读 schema）：
> - `requirements[].affectedSurfaces[]` 已存在，含 `surfaceId / locator / disposition / reason / owner / batch`。
>   `locator` 目前是自由字符串 `minLength:1`，**无结构化落点类型，无真实代码绑定** → 这是 A2 缺口所在。
> - `collectionSemantics{kind,expectedCount}` 已存在 → A3「discovered-set 成员计数」可复用。
> - `apiDependency`、`sourceReadiness` 已存在但为**项目级**，非 surface 级 → A6 需要下沉到 surface。
> - 无 delivery target / pivot 字段 → A5 需新增。
> - 无 surface 级 implementation/evidence 结论字段 → A2/A3/A4 需新增（对账结果不应写回 work-item 手填字段，落到独立 `reconcile-result.json`）。

---

## 1. surface locator 结构化（A2 核心，扩展 affectedSurfaces[].locator）

把自由字符串 locator 升级为可机器解析的结构化落点。保留旧 string 作为 `displayHint` 兼容。

```jsonc
// requirements[].affectedSurfaces[]  —— 扩展
{
  "surfaceId": "S-004",
  "disposition": "implement",              // 复用现有 enum
  "displayHint": "Login 绑定≥2方式时显示切换入口",  // 新增：原 locator 字符串迁移到此
  "codeLocator": {                          // 新增：结构化落点
    // D-2 冻结枚举（并集）：component | hook | function | export | route
    //                    | style-token | copy-key | api-call | test | browser-scenario
    // 已去掉 path-prefix（退化为 expectPath glob）；symbol 并入 function/export
    "kind": "component",
    "app": "apps/web-next",                 // 新增：绑定 delivery target（配合 A5）
    "symbol": "SwitchVerifyMethodDialog",   // 组件/函数/导出名（kind=function|export 时即原 symbol）
    "expectPath": "src/**/SwitchVerifyMethodDialog.tsx", // 可选 glob 提示（原 path-prefix 归此）
    "role": "provider"                      // provider | consumer | standalone（配合 A3）
  }
}
```

对账不在 work-item 里写结论，产出独立结果文件（见 §4）。

---

## 2. provider/consumer 关系（A3，新增 wiring 块）

component 类 surface 需声明「谁提供、谁消费」，避免「组件写了=完成」。

```jsonc
// requirements[].affectedSurfaces[].wiring  —— 新增（仅 role != standalone 时必填）
{
  "role": "consumer",
  "dependsOn": ["S-004"],       // 该 consumer 依赖的 provider surfaceId
  "wiringEvidence": "import"    // import | render | event-binding | browser  —— 关闭 consumer 所需的最低证据档
}
```

关闭规则（写在对账器，不写死 schema）：
- provider surface：符号在目标 app 树中存在且导出 → `provider=covered`。
- consumer surface：provider 存在 **且** 满足 `wiringEvidence` 档位（import→静态可查；render/event→需 DOM contract；browser→需真实交互）→ 才可 `consumer=covered`。
- 任一 consumer 未达标 → 该 requirement 整体 `incomplete`，即使 provider 已 covered（案例 1 主锚点）。

---

## 3. delivery target 与 pivot 失效（A5，新增顶层 deliveryTarget）

```jsonc
// 顶层新增
"deliveryTarget": {
  "app": "apps/web-next",
  "history": [
    { "app": "apps/web", "invalidatedAt": "2026-09-17T...", "reason": "pivot to web-next" }
  ]
}
```

pivot 判定：当前 `deliveryTarget.app` 与最近一次对账结果记录的 app 不同 → 触发 invalidation：
- 旧 app 下所有 surface 的对账结论重置为 `stale`。
- 旧 app 绑定的 evidence receipts / acceptance 结果标 `stale`，不得计入完成度。
- 新 app 下未产生对账的 surface 默认 `uncovered`。

---

## 4. 对账结果文件（A2/A3/A4 产出，新增 reconcile-result.json）

对账结论是**派生事实**，不回填 work-item（避免手填与机器结论混淆）。新增独立文件，schema 类比 `latest-result.json`。

> **D-1 冻结：对账结论采用三维正交**，不用单一 6 态枚举。
> - `codeStatus`：代码落点是否存在（`covered | partial | missing | stale`）。
> - `wiringStatus`：consumer 接线是否达标（`covered | partial | missing | n/a`）。
> - `runtimeStatus`：临界交互是否验证（`verified | not-verified | n/a`）；人工签认落 `verified` 且 `verifiedBy: human`。
> - `not-applicable` 归 disposition，不进 status。原 6 态枚举里 `human-confirmed` = runtimeStatus verified(by-human)，`partially-covered` 拆成 code/wiring 两维。

```jsonc
// prds/<ID>/reconcile-result.json  —— 新增文件
{
  "schemaVersion": 1,
  "reconciledAt": "2026-09-17T...",
  "headSha": "…", "dirtyHash": "…",       // 绑定当前树，与 verify 一致
  "deliveryTargetApp": "apps/web-next",
  "surfaces": [
    {
      "surfaceId": "S-004",
      "codeStatus": "missing",             // covered | partial | missing | stale
      "wiringStatus": "n/a",               // covered | partial | missing | n/a
      "runtimeStatus": "not-verified",     // verified | not-verified | n/a（A4 临界路径）
      "verifiedBy": null,                  // null | "human" | "browser"（runtimeStatus=verified 时必填）
      "resolvedPaths": [],                 // 命中的真实文件；missing 时为空
      "notes": "symbol SwitchVerifyMethodDialog not found in apps/web-next"
    }
  ],
  "rollup": {
    "overall": "implementation-incomplete", // 见 §5 状态机
    "coveredCount": 8, "partialCount": 3, "missingCount": 5, "staleCount": 0,
    "runtimeCriticalPending": ["S-004", "S-011"]
  }
}
```

---

## 5. work-item 生命周期状态机（A1/A7 完成话术背书）

对账结论 rollup 映射到受控状态；Agent 完成话术必须引用此状态，不能自造。

> **D-3 冻结：以下十态 + 四守卫 + pivot 回退为准**，写入 stage/状态引擎。`integration-pending` 排在 `implementation-complete` 之后：仅当纯前端项全 covered、只剩 `blockedBy` 集成项未就绪时进入；若仍有未实现的无依赖纯前端项，停在 `partially-implemented`，不得进 `integration-pending`。

```
not-started
  → scoped                     (需求+surface 抽取完成)
  → approved                   (human scope approval 绑定当前 fingerprint)
  → implementing               (开始落码)
  → partially-implemented      (部分 surface covered，仍有 missing/partial)
  → implementation-complete    (全部 implement surface = covered，含 consumer wiring)
  → integration-pending        (仅剩 API/依赖阻塞项，纯前端项已 covered)
  → ready-for-human-acceptance (runtime critical path 已验证或人工签认)
  → delivery-ready             (verify: mode=enforced,status=passed,ok=true)
  → delivered
```

### 状态跃迁守卫（由对账 rollup 驱动，禁止手动跳级）

| 目标状态 | 准入条件（全部满足）|
|---|---|
| implementation-complete | `missingCount=0 && partialCount=0 && staleCount=0`；所有 consumer wiring covered |
| integration-pending | 仅 `apiDependency`/`sourceReadiness` 阻塞的 surface 未 covered，其余全 covered（A6 局部阻塞，禁止整批停工）|
| ready-for-human-acceptance | `runtimeCriticalPending=[]`（A4：临界交互路径已 browser-verified 或 human-check 签认）|
| delivery-ready | verify enforced+passed+ok，且 headSha/dirtyHash 与 reconcile-result 一致 |

### A5 pivot 回退

deliveryTarget.app 变更 → 无论当前处于哪个 ≥implementing 状态，一律回退到 `implementing`，旧 app 完成度作废，重新对账。

### A1 完成话术守卫映射

| 允许的完成类话术 | 要求的最低状态 |
|---|---|
| 「开发完成」 | implementation-complete |
| 「仅剩接口依赖 / integration-pending」 | integration-pending 且 pending 项均在 apiDependency/sourceReadiness |
| 「可进人工验收」 | ready-for-human-acceptance |
| 「可交付 / 已交付」 | delivery-ready / delivered |

低于对应状态时出现该话术 → A1 阻断（案例 1 的四条错误话术即命中此表）。

---

## 6. A6 依赖爆炸半径下沉（扩展 apiDependency → surface 级）

现有 `apiDependency` 为项目级。新增 surface 级引用，使 pending 只作用于真正依赖的 surface。

```jsonc
// requirements[].affectedSurfaces[].blockedBy  —— 新增（可选）
{
  "blockedBy": ["API-COOLDOWN-TS", "API-RATE-LIMIT"]  // 指向项目级 apiDependency 条目 id
}
```

对账规则：只有 `blockedBy` 非空且对应依赖未就绪的 surface 才可标 `integration-pending`；无 `blockedBy` 的 surface 必须照常 covered，不得借依赖名义停工（案例 1 切换弹窗/入口显隐/排序属此类）。

---

## 7. 冻结清单（进入编码前需评审确认）

以下字段结构一旦评审通过即冻结，作为 P0 实现契约：

1. `affectedSurfaces[].codeLocator{kind,app,symbol,expectPath,role}`（扩展）
2. `affectedSurfaces[].wiring{role,dependsOn,wiringEvidence}`（新增）
3. `affectedSurfaces[].blockedBy[]`（新增）
4. 顶层 `deliveryTarget{app,history[]}`（新增）
5. `reconcile-result.json` 全量 schema（新增文件）
6. 状态机十态 + 四条跃迁守卫 + pivot 回退（新增，落到 stage/状态引擎）

> 未列入 P0：evidence kind 细化（A4 producer=human / D2 structural）在 Phase 3 单独定，本份只锁 A2 地基与其直接依赖 A3/A5/A6/A1。

### 冻结确认（P0 评审拍板，见计划附录 C.2）

- D-1 对账结论三维正交：`codeStatus + wiringStatus + runtimeStatus`（+`verifiedBy`），rollup 供话术层。已回填 §4。
- D-2 locator kind 并集枚举：`component | hook | function | export | route | style-token | copy-key | api-call | test | browser-scenario`。已回填 §1。
- D-3 十态状态机 + 四守卫 + pivot 回退；`integration-pending` 语义已注明。已回填 §5。
