<!-- template-version: 2 -->
<!-- template-effective-since: 2026-07-23 -->

# Frontend Tasks — PR-02306 注册登录密码规则修改

## 任务清单

| ID | 功能 ID | 需求依据 | 任务 | 状态 | 验收证据 |
|----|---------|----------|------|------|----------|
| T01 | F01 | PRD intake | G0/G1 完成 PRD intake、功能清单、技术设计 | ✅ 已完成 | `prd-source-manifest.json` + `00-feature-inventory.md` + `02-technical-design.md` |
| T02 | F01/F03 | PRD §产品方案 2 | 单一源并入 `constants/regex.ts`（`PASSWORD_SPECIAL_CHARS` + `PASSWORD_SPECIAL_CLASS` 派生 `passwordPattern`/`passwordAllowedCharPattern`/`PASSWORD_SPECIAL_RE`/`PASSWORD_LETTER_RE`/`PASSWORD_DIGIT_RE`/长度常量），特殊符号扩为含 `^ _ + [ ] { }`；删死代码 `PASSWORD` | ✅ 已完成 | `regex.ts` diff + 12 单测通过 |
| T03 | F01/F03 | PRD §产品方案 4 | 4 处副本改为消费单一源：`Register/common/const.ts`(re-export `passwordPattern` + `TEMP_SPECIALS=PASSWORD_SPECIAL_CHARS`)、`RegisterV2/CreatePassword.tsx`(删本地 `ALLOWED_SYMBOL_RE`/`DIGIT_RE`/`LETTER_RE`/`MIN`/`MAX`)、`constants/regex.ts`(`passwordAllowedCharPattern` 派生自单一源) | ✅ 已完成 | diff + `grep '@$!%*#?&'` 全仓仅剩单一源 |
| T04 | F01/F03 | PRD §测试需要注意 | 6 场景一致性验证：登录输入过滤、注册清单、重置/设置/修改提交、随机密码生成；单测覆盖新增符号放行 + 边界 7/8/20/21 | ✅ 已完成 | vitest 12 passed + tsc 与基线 271 持平（0 新增） |
| T05 | F02 | `PRD-IMG-002` / §产品方案 3 | 文案 `passwordRule.special` 改「至少1个特殊符号（{{chars}}）」，`chars` 从 `PASSWORD_SPECIAL_CHARS` 插值；**本地仅改 zh-CN，其余 locale 交国际化团队** | ✅ 已完成（zh-CN） | zh-CN `register.json` diff + `CreatePassword.tsx` t() 插值 |

## 实现检查

- [ ] 特殊字符集收敛到单一常量源（`Record`/常量 + 派生正则），4 处副本清零。
- [ ] 正则字符类转义正确：`]``[` 转义、`^` 不置首位、`-` 置末尾，逐字符单测放行。
- [ ] 数字必填 / 长度 8-20 / 字母必填保持不变（PRD §产品方案 2）。
- [ ] 登录 `passwordAllowedCharPattern` 过滤不再剔除 `^ _ + [ ] { }`。
- [ ] 文案与实际校验一致；未擅自新增/编造字符列表文案（Q3 未确认前不加）。
