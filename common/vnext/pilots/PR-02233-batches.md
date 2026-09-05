# PR-02233 登录/注册改造剩余 surface 与证据缺口追踪

> 状态：批次 01 已收敛；02–05 待按业务节奏推进；06 为 App owner 外部依赖，不在本仓闭环。
> 每完成一批后，镜像最新 work-item → 重新冷读审查 → 补定向/浏览器/视觉证据 → `vnext-verify --write`。

## 当前失败项（来源 `latest-result.json`）

### 缺 surface 证据

- S-021 App login verification
- S-023 *（工作项中定位待补）*
- S-025 *（工作项中定位待补）*
- S-026 *（工作项中定位待补）*
- S-027 App login verification method switch
- S-029 App login verification countdown state
- S-030 App login verification-method dialog
- S-031 *（工作项中定位待补）*
- S-033 *（工作项中定位待补）*
- S-097 *（工作项中定位待补）*
- S-100 *（工作项中定位待补）*
- S-122 *（工作项中定位待补）*
- S-124 *（工作项中定位待补）*
- S-126 *（工作项中定位待补）*
- S-128 *（工作项中定位待补）*

### 缺 requirement 证据

- R-002：无 browser-interaction 证据
- R-003：无 browser-interaction、无 visual 证据
- R-004：无 browser-interaction 证据
- R-007：无 browser-interaction 证据
- R-008：无 browser-interaction 证据
- R-010：无 browser-interaction 证据
- R-011：无 browser-interaction 证据
- R-030：无 browser-interaction、无 visual 证据

## 推进模板

| 批次 | 范围 | 负责方 | 状态 | 关闭条件 |
|------|------|--------|------|----------|
| 01 | 登录/注册 Web 改造核心 | 已收敛 | done | `latest-result` 通过 |
| 02 | *待业务 owner 确认* | TBD | pending | 代码实现 + 定向测试/MSW contract |
| 03 | *待业务 owner 确认* | TBD | pending | 代码实现 + 定向测试/MSW contract |
| 04 | *待业务 owner 确认* | TBD | pending | 代码实现 + 定向测试/MSW contract |
| 05 | *待业务 owner 确认* | TBD | pending | 代码实现 + 定向测试/MSW contract |
| 06 | App 端 surfaces（S-021 等） | App owner（external-deferred） | deferred | App 端实现/验证后，再镜像 work-item 回来 |

## 验收命令

```bash
node common/engine/agent-scripts/vnext-verify.mjs \
  --input common/vnext/pilots/PR-02233/work-item.json \
  --worktree <fameex-web-absolute-path> \
  --write --out common/vnext/pilots/PR-02233
```

注意：--out 目录必须已在 .gitignore 内或飞行员目录规则允许写入。
