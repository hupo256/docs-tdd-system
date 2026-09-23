---
sourceName: "需求 PRD"
sourceType: "wiki"
sourceUrl: "https://qfglxo2m3dc.sg.larksuite.com/wiki/RRKYwXfDxiv0Yek6fh4lyme2gAc"
syncedAt: "2026-09-23T12:17:04.413Z"
readOnly: true
command: "lark-cli docs +fetch --api-version v2 --doc https://qfglxo2m3dc.sg.larksuite.com/wiki/RRKYwXfDxiv0Yek6fh4lyme2gAc --doc-format markdown --as user --format json"
---

# 【PR-02419】公司做市用户的用户类型禁止修改

## 一. 变更记录

<sheet sheet-id="fchPMc" token="EULfsp4EDhDJbltCQ44lDyJ2gqf"></sheet>

---

## 二. 需求背景与目标

### 2.1 背景与问题

1. 运营可在用户管理场景支持修改用户类型
2. 已确认业务规则：若系统识别该用户为“公司做市用户”，不得完成用户类型修改
3. 当前用户类型修改流程未增加该限制，可能导致公司做市用户被误修改，产生脏数据及后续清理成本

### 2.2 目标与非目标

1. **目标：**

   1.  运营提交用户类型修改时，系统识别当前用户是否为公司做市用户
   2.  若为公司做市用户，阻止本次用户类型修改，并提示运营人员
   3. 服务端增加最终校验，确保无法通过直接调用接口绕过前端限制
   4. 非公司做市用户继续沿用现有用户类型修改流程
2. **成功指标：**

上线后修改公司做市用户至其他类型时，修改请求被拒绝，用户类型保持原值

1. **非目标：**

   1. 本期不定义公司做市用户的创建、注销规则
   2. 本期不调整现有用户类型体系
   3. 本期不变更运营人员既有页面访问权限，仅限制公司做市用户的用户类型修改动作



---

## 三. 需求 List

<sheet sheet-id="pTegV6" token="EULfsp4EDhDJbltCQ44lDyJ2gqf"></sheet>

---

## 四. 产品方案

### 4.1 【优化】运营后台用户类型编辑

**操作路径 ：** 运营后台 → 用户管理 → 用户详情/用户列表 → 修改用户类型 → 选择目标用户类型 → 确认修改

**功能说明：** 对用户类型修改请求执行公司做市用户校验；命中时提示运营人员并阻止修改。

![The image shows the user type editing interface in the operation backend. A pop-up window titled "设置类型" (Set Type) is displayed, with the current user type "普通用户" (Ordinary User) highlighted. Below, there is a list of user types including "公司做市用户" (Company Market Maker User). The interface also shows basic user information such as ID, certification status, and registration time. This corresponds to the context describing the operation path of modifying user types in the operation backend and the function of company market maker user verification when modifying user types.](https://feishu.cn/file/NQjbbU4ZDodrkax6aVmluXbngbf)

![The image shows the user management interface of the operation backend. It includes fields like "提现地址", "站内转入UID", "站内转出UID", "首次合约交易时间", "最近合约交易时间", "第三方绑定", "用户标签", "邀请人UID", "VIP等级", with options to "搜索" and "重置". At the bottom, there are buttons labeled "导出", "批量设置类型", "批量管理", and "批量设置标签", with "批量设置类型" highlighted in red. A note states "数据每5分钟更新一次" in red. This relates to the context about modifying user types in the operation backend, where company做市 users' types can't be modified.](https://feishu.cn/file/YqVybCUI6oGnFYxvA4llYXVXgaf)

#### 4.1.1 业务规则

1. **提交触发：**

   1. 运营人员点击“确认”或触发等效的用户类型保存动作时，系统发起校验
   2. 校验对象为本次被修改的用户，online已有批量修改用户类型的操作，也需要执行此项校验，如批量操作10个用户，仅2个用户命中禁止修改，则其余修改成功，此2个用户修改失败，弹出提示如：111111111，11111111修改失败。
   3. 批量修改的页面包括：用户管理-批量设置类型、用户管理-用户批量管理
2. **公司做市用户识别：**

   1. 以用户当前**账户类型**作为公司做市用户的权威识别依据
   2. 若账户类型判定为公司做市用户，则命中禁止修改规则
3. **命中拦截：**

   1. 系统自动弹出拦截提示
   2. 弹出toast：该用户为公司做市用户，禁止修改用户类型
   3. 本次修改请求不得成功保存
   4. 用户类型保持原值
   5. 提示关闭后，运营人员可返回继续查看用户信息
4. **未命中处理：**

   1. 非公司做市用户不适用本需求新增的拦截规则
   2. 继续进入现有用户类型修改流程
   3. 其他已有校验及保存逻辑沿用现有规则，本需求不重新定义

#### 4.1.2 页面反馈

<sheet sheet-id="Nd1i1f" token="EULfsp4EDhDJbltCQ44lDyJ2gqf"></sheet>

### 4.2 【优化】服务端修改保护

1. **服务端校验：**

   1.  用户类型修改接口在实际写入前，必须独立校验当前用户账户类型。
   2. 若识别为公司做市用户，直接拒绝本次修改请求。
   3. 不得仅依赖：

   - 前端按钮控制；
   - 前端传入参数；
   - 前端校验结果。

   1. 即使运营绕过前端页面直接调用接口，公司做市用户仍不得完成用户类型修改
2. **拒绝结果：**

   1. 命中规则时，服务端拒绝写入用户类型
   2. 接口错误码、错误信息，以及前端提示与接口返回的映射关系
3. **并发处理：**

   1. 若用户账户类型在修改过程中发生变化，以服务端实际写入前的最新有效账户类型作为最终判断依据
   2. 若写入前识别为公司做市用户，则拒绝修改
   3. 具体采用锁、版本号或其他并发控制方式由研发根据现有架构确定，本需求不限定技术实现

---

## 五. 影响、日志与确认项

### 5.1 历史数据与上线

1. 已存在的公司做市用户及其当前用户类型不因本需求自动修改
2. 本需求仅约束上线后发起的用户类型修改请求
3. 历史上已被错误修改的公司做市用户，本期不自动修复
4. 如需历史数据清查及修复，由业务另行提出数据治理需求

### 5.2 操作日志

1. 本需求不新增独立操作日志
2. 被拦截的修改尝试是否进入现有运营操作日志，沿用当前 Online 日志机制，可不新增
3. 若现有日志已记录用户类型修改请求，则无需新增日志字段

### 5.3 埋点、灰度与回滚

1. 埋点：此需求无埋点
2. 发布方式：全量发布
3. 灰度：暂不考虑灰度
4. 回滚：发布异常时回滚本次代码变更，再额外通知运营，禁止擅自修改公司做市用户的账户类型

### 5.4 已确认事项

<sheet sheet-id="CdfE9b" token="EULfsp4EDhDJbltCQ44lDyJ2gqf"></sheet>

---

## 六. 验收标准

<sheet sheet-id="BLj3v9" token="EULfsp4EDhDJbltCQ44lDyJ2gqf"></sheet>

---

## 七. 其他

1. 需求评审录屏：https://qfglxo2m3dc.sg.larksuite.com/minutes/obsg6l758e5x9w969e5vt8l8
2. 在研发或测试过程中，因各类型原因导致的需求修正/变更，将以黄色底色标注。
