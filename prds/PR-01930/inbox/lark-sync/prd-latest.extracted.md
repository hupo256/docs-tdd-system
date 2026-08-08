<title>体验金手动失效功能</title>

# 前言

<callout emoji="📋">
运营人员需对已发放的体验金进行手动失效处理，
输入：UID（单个或批量粘贴）+ 体验金（全部 / 指定单个体验金配置编码 /指定多个体验金配置编码）&批量上传
失效后的体验金处理规则：
- **待激活状态：** 直接回收，后端流水记手动失效，用户端记系统回收
- **可用体验金**：直接回收，后端流水记手动失效，用户端记系统回收
- **委托单体验金**：系统自动撤单，直接回收，后端流水记手动失效，用户端记系统回收
- **仓位占用体验金**：不触发自动平仓，保留已有仓位直至用户自行平仓,再自动回收（同线下过期失效的逻辑），后端流水记手动失效，用户端记系统回收
- **体验金卡券状态：**处理同线上的过期失效场景，用仓位占用未全部回收时，卡券状态不变
</callout>



#  版本信息

<grid>
<column width-ratio="0.333333">
<callout emoji="⏰">
版本号：V1.0
</callout>
</column>
<column width-ratio="0.333333">
<callout emoji="📆">
创建日期 2026-06-23
</callout>
</column>
<column width-ratio="0.333333">
<callout emoji="👮">
审核人
</callout>
</column>
</grid>



# 变更日志

<table><colgroup><col/><col/><col/><col/></colgroup><tbody><tr><td><b>时间</b></td><td><b>版本号</b></td><td><b>变更人</b></td><td><b>主要变更内容</b></td></tr><tr><td>2026-06-23</td><td></td><td><cite type="user" user-id="ou_6b295010c8a0d7dfff43fcf8ae25ecb3" user-name="Iris.ex"></cite></td><td>创建文稿</td></tr><tr><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td></tr></tbody></table>

# 评审记录

| 评审**时间** | 参与人员 | **结论** |
|-|-|-|
| 2026-07-15 |  | 评审，通过  <br/>https://qfglxo2m3dc.sg.larksuite.com/minutes/obsgty2wpaw356fb4825a5ua?from=from_copylink |
|  |  |  |
|  |  |  |



# 文档说明

## 名词解释

| 术语 | 说明 |
|-|-|
| **手动失效** | 运营在后台主动将体验金置为不可用状态，区别于系统自动过期。后台流水类型记录为"手动失效" ；用户端记 “系统回收” （全文以系统回收为准，如遇“系统失效”请以“系统回收”处理） |
| **体验金配置编号** | 体验金批次号，同一批次可多次发放，运营按此维度发放和失效 |
| **可用体验金** | 已发放至用户账户但尚未被仓位占用的体验金余额 |
| **仓位占用体验金** | 体验金已被用户用于开仓，形成持仓仓位 |
| **委托单冻结体验金** | 体验金被用户用于委托开单但尚未成交的冻结额度 |
| **待领取/待使用** | 卡券已发放到福利中心，用户尚未领取或已领取但未激活到合约账户 |
| **激活中（使用中）** | 体验金已激活到合约账户，处于可用状态，可正常开仓；或已实际使用中 |
| **已使用/已用完** | 体验金金额全部消耗完毕 |
| **已失效** | 因有效期到期、手动过期、划转失效、平仓失效等原因过期、 管理后台操作手动回收 |

---

# 需求背景

##  产品现状

**当前存在的问题：**

用户领取体验金后，可能存在滥用活动规则、恶意套利、批量注册等异常行为。后台无任何撤回能力，需找研发改数据库，操作风险高，响应慢

## **优化目标：**

在后台支持按指定用户维度，将用户账户下所有体验金统一失效；按指定体验金批次维度，将持有该体验金的用户账户下该批次体验金统一失效 ；支持UID+体验金双维度的指定失效，以及进行批量上传的失效，便于运营及时处理



# 需求范围

## 信息架构

```HTML
现货后台 - 体验金手动失效功能
├─ 1、功能入口
│  ├─ 菜单路径：福利中心 → 卡券记录 → 体验金手动失效管理
│  └─ 页面触发：点击【手动失效】打开操作弹窗
│
├─ 2、四种操作执行维度
│  ├─ 单/多用户ID：清空该用户全部批次体验金
│  ├─ 单/多体验金配置代码：清空所有持有该批次体验金的用户账户下的该批次体验金
│  ├─ 单/多用户ID + 单/多体验金配置编号：仅失效指定批次
│  ├─ 批量上传文件：用户ID+对应指定体验金批次失效
│  ├─ 批量上传文件：批量体验金批次失效，清空所有持有该批次体验金的用户账户下的该批次体验金
│  └─ 批量上传文件：批量用户，清空该用户全部批次体验金
│
├─ 3、弹窗必填配置项
│  ├─ 失效标识：用户ID、体验金配置编号
│  └─ 备注框（必填）：记录本次失效业务原因
│
├─ 4、提交前二次确认展示信息
│  ├─ 本次受影响用户总数
│  ├─ 可直接回收体验金总额（待激活+可用余额+委托冻结）
│  └─ 持仓占用、暂时无法回收的体验金总额
│
├─ 5、按体验金当前状态差异化处理逻辑
│  ├─ 待领取/待使用：直接标记手动失效，C端卡券流水标注“系统回收”
│  ├─ 已激活、无持仓无委托：回收全部可用余额，标记失效，流水标注系统回收
│  ├─ 存在未成交委托：自动撤单 → 回收冻结额度，标记失效，流水标注系统回收
│  ├─ 存在持仓占用：标记「失效处理中」，用户平仓后自动回收
│  ├─ 已全部使用完毕：跳过不处理
│  └─ 已过期：跳过不处理
│
└─ 6、用户通知机制
   └─ 静默执行，不向用户推送任何通知
```

## 本期包含 

| 包含 |  |
|-|-|
| B端-现货后台-福利中心-卡券记录 | 新增体验金手动失效管理 |
| B端-现货后台-增值服务-体验金流水明细 | 新增【手动失效】的流水明细 |
| B端-现货后台-用户管理-用户管理-数据概览-合约账户-支出折合-来源明细 | 体验金失效的统计，新增【体验金手动失效】的流水的统计类型 |
| B端-现货后台-用户管理-用户管理-合约账户-资金流水 | 新增【手动失效（体验金）】的流水 |
| B端-现货后台-统计报表-财务审计-资金流水 | 新增【手动失效（体验金）】的流水 |
| C端-福利中心-卡券中心-卡券记录-体验金类型卡券（web/app） | 新增类型为【过期】的记录，【说明】为【系统回收】  |
| C端-资产-合约账户-资金流水（右上角）（web/app） | 新增【系统回收（体验金）】的流水 |
| C端-合约交易-交易记录-资金流水（web/app） | 新增【系统回收（体验金）】的流水 |
| C端-资产-合约账户-资金列表- USDT >  ---资金流水（app） | 新增【系统回收（体验金）】的流水 |

---

# 功能详细说明

## 核心原则

<callout emoji="📋">
手动失效仅回收用户当前未使用的体验金权益，  
不影响已产生的交易结果、已扣减金额、已结算手续费、资金费及平仓盈亏。  
  
若存在未成交委托，系统自动撤销全部委托（不限类型）后回收对应冻结体验金。  
  
若存在已成交持仓，系统不自动平仓；  
该体验金被标记，待用户平仓后回收剩余体验金。
体验金流水记录字段精度，与线上一致，保留8位数
用户通知：暂静默处理，不发送通知。
</callout>

## 状态定义

<table><colgroup><col/><col/><col/></colgroup><tbody><tr><td>模块</td><td>状态</td><td>说明</td></tr><tr><td>福利中心</td><td>待激活（待领取）</td><td>卡券已发放到福利中心，用户尚未领取或已领取但未激活到合约账户</td></tr><tr><td rowspan="6">合约业务</td><td>激活中（使用中）</td><td>体验金已激活至用户账户，可被使用</td></tr><tr><td>└ 可用</td><td>体验金余额未占用，可供开仓/抵扣</td></tr><tr><td>└ 仓位占用</td><td>体验金已被用于开仓，形成持仓</td></tr><tr><td>└ 委托冻结</td><td>体验金已被用于委托开单，冻结中</td></tr><tr><td>已使用（完）</td><td>体验金已被用户消耗完</td></tr><tr><td>已失效</td><td>超过有效期（过期回收）、划转失效（划转回收）、手动过期（用户激活第二张，第一张失效）、平仓失效（回收）、系统回收（管理后台手动失效）（新增）</td></tr></tbody></table>

## **当前体验金的全生命周期状态流转**

<whiteboard token="M7cjwmzuJhJklnbjvEaldVIwg6M"></whiteboard>



## 体验金状态机（含手动失效）

<whiteboard token="VHXTwQCRuhbHbobPK8tlPGkSgCf"></whiteboard>

### 5.5 各状态处理矩阵

| 体验金状态 | 是否允许手动失效 | 处理方式 |
|-|-|-|
| 待领取/待使用（福利中心） | 允许 | 直接置为手动失效，用户无法再领取， |
| 已激活无占用（合约账户可用余额>0，无委托无持仓） | 允许 | 直接回收剩余可用体验金，置为手动失效 |
| 已激活有委托（有冻结余额） | 允许（自动撤单） | 不区分委托类型，统一撤单释放冻结→回收→置为手动失效 |
| 已激活有持仓（有占用余额） | 不允许（用户平仓后，回收） | 持仓占用的体验金打标记,**不自动平仓，**用户平仓后自动回收 并完成手动失效 |
| 已激活有委托+有持仓 | 部分允许 | 委托冻结部分：统一撤单释放冻结→回收→置为手动失效  <br/>持仓占用的体验金打标记,**不自动平仓，**用户平仓后自动回收 并完成手动失效 |
| 已使用/已用完（余额=0） | 不处理 | 已使用金额不可追回 |
| 已过期 | 不处理 | 无需重复处理 |

1. **前端展示**：用户端 C 端已失效体验金展示为灰色「已失效」，流水说明及名称为 【系统回收】
2. **后台存储 / 报表字段：**手动失效
3. **已用完、各类失效（过期回收、划转回收、（平仓）回收、手动过期（用户操作激活第二张 第一张过期））均为不可逆终态**，无状态回退路径。

## 产品流程图



<whiteboard token="W8gHwo6K0hmShEbP4HlltMbUgMc"></whiteboard>

### **关键规则说明**

三种模式： 

- 模式一：只输入UID，一次性失效某用户全部体验金
- 模式二：只输入体验金卡券代码，一次性失效所有持有该批次体验金的用户的改体验金
- 模式三：指定1 个 / 多个用户+ 1 个 / 多个配置编码的体验金，失效多人多张
- 模式三：大批量多用户 & 大批量多体验金批次 & 批量用户+批量配置编码体验金，Excel 批量导入处理

### 数据要求

- 操作前后需保留完整的状态记录
- 多 UID 场景单次不超过 100 个 UID
- 多 体验金批次 场景单次不超过 100 个 配置编码
- 多 UID 失效支持「多张体验金（多个批次）」同时失效
- 查询接口需返回影响汇总数据供二次确认弹窗展示

# 产品方案

## 管理后台

### 体验金手动失效管理



<table><colgroup><col/><col/><col/><col/></colgroup><tbody><tr><td>模块</td><td>功能</td><td>功能详细说明</td><td></td></tr><tr><td>入口</td><td>体验金手动失效管理入口</td><td>现货后台-福利中心-卡券记录-新增体验金管理页面<br/>新增「手动失效」入口按钮</td><td rowspan="15"><img name="image.png" alt="The image shows the &#34;Experience Points Manual Expiry Management&#34; interface. It has a table with columns like UID, Name, Activity Name, Experience Points, Type, Quantity, Expiry Quantity, Expiry Time, and Operator. There are also input fields for UID, Name, Activity Name, and Expiry Time at the top. A blue &#34;Add&#34; button is present, and the table has a row with UID 13008172, Name &#34;123@gmail.com&#34;, Activity Name &#34;6月体验活动&#34;, Experience Points 100, Type &#34;合作体验券&#34;, Quantity 100, Expiry Quantity 60, Expiry Time 2024-06-23 23:23, and Operator &#34;Jim&#34;." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=Mjg4NTFjZjRkODZlNjQ4N2Y4YmY3N2U3NTI2NjhkMTZfY2JiNzcwMDVmYzJlMWQzOGVmNjBmZTA3ZGFjMDljMDVfSUQ6NzY1NDU0Nzg1MzU2MTQ4Mjk3NF8xNzg0NTQ5NTg5OjE3ODQ1NTMxODlfVjM" mime="image/png" scale="1.000000" src="RTNEbr8DnoCbCZxczv0lz8fugke"/></td></tr><tr><td rowspan="4">筛选条件</td><td>uid</td><td>精确搜索，输入框，仅支持数字 UID</td></tr><tr><td>配置编码</td><td>精确搜索，输入框</td></tr><tr><td>时间区间</td><td>筛选失效操作时间范围</td></tr><tr><td>操作</td><td><ul><li><b>重置： </b>清空 UID、配置编码、时间区间所有筛选条件，刷新列表为全部数据</li><li><b>搜索 ：</b>携带当前筛选参数请求接口，刷新列表，无数据展示空状态提示</li></ul></td></tr><tr><td rowspan="10">列表字段</td><td rowspan="9">列表字段</td><td rowspan="9"><ul><li>序号：分页自增序号</li><li>UID：用户账号 ID</li><li>phone/email：用户绑定手机号或邮箱（脱敏展示）</li><li>活动名称：体验金所属活动标题</li><li>配置编码：对应体验金批次号</li><li>体验金名称：该批次体验金展示名称</li><li>类型：体验金/增强体验金</li><li>数量：发放的面值</li><li>失效数量：<b>动态累加，可变值，</b>8为小数，运营手动失效操作时，先计入可用余额+委托冻结余额；标记持仓占用的打标记；用户全部平仓后，释放的体验金回收处理，自动累加进实时失效总额。展示动态最终失效总量，单笔变动流水明细，统一通过体验金资金明细 查看。</li><li>仓位占用：手动失效操作那一刻的仓位占用快照锁定</li><li>备注：运营操作时填写的追溯备注</li><li>操作人：执行本次失效的后台账号</li><li>失效时间：操作提交并处理完成的时间戳</li></ul></td></tr><tr></tr><tr></tr><tr></tr><tr></tr><tr></tr><tr></tr><tr></tr><tr></tr><tr><td>操作</td><td><b>手动失效</b>：新增操作入口（筛选栏左上角）（紫色） 点击弹窗打开「添加失效任务弹窗」<br/><b>导出：</b>批量导出：列表右上角 / 筛选栏增加【批量导出】，批量导出筛选的结果数据<br/><b>导出规则通用导出遵循：</b><br/><cite doc-id="L3HSdrpXxoXhLAxhvfglgPf3gqf" file-type="docx" title="【PR-01524】【福利中心】卡券新增用户维度统计数据及前端新增卡券流水" type="doc"></cite></td></tr><tr><td></td><td></td><td></td><td></td></tr></tbody></table>

### 添加页面

<table><colgroup><col/><col/><col/><col/></colgroup><tbody><tr><td>模块</td><td>功能</td><td>功能详细说明</td><td>原型图</td></tr><tr><td rowspan="4">添加页面</td><td>UID 录入区域</td><td><ol><li seq="1">条件必填</li><li>字段后备注：空=按配置批次，失效该批次全部用户；填写UID=仅失效指定用户</li><li>输入框提示文案：多个UID用英文逗号分隔，单次最多100个；留空则操作整批用户</li><li>功能详情</li></ol><ul><li>支持单/多UID手动输入或批量粘贴 （英文逗号隔开)</li><li>空值逻辑：输入框为空 = （按体验金编码批次，失效全部用户的该批次体验金）</li><li>有值逻辑：输入UID = （失效制定UID ）</li><li><b>上限拦截：</b> 超过 100 个时禁止输入，弹出提示：单次操作UID不可超过100个</li><li>拦截提示：详见</li></ul><img name="image.png" alt="The image presents the core input item two-way check rules for the manual expiration function. It shows a table with four columns: UID input box status, configuration code input box status, triggered business mode, and backend core action. The table covers four scenarios: UID with value (single/multiple) and configuration code empty, UID with value (single/multiple) and configuration code with value, UID empty and configuration code with value, UID empty and configuration code empty. Each scenario specifies the corresponding business mode and backend action, with the empty scenario first triggering a report error if both input boxes are empty." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=NGVmODAyNGMzNDg5NTQyYzk0NGFiMzI0NmIyNmE3ZWFfMjFiZGQ0OTBkYjZmMzc3ODI4YjI1ZWRlYjJjYzk3ODJfSUQ6NzY1NjM4OTQ5MzY1OTQ1NTIwMF8xNzg0NTQ5NTg5OjE3ODQ1NTMxODlfVjM" mime="image/png" scale="1.000000" src="PwxVbe83QoECp2xda8JlELaOgZY"/></td><td rowspan="4"><img name="image.png" alt="The image shows the &#34;添加失效任务&#34; (Add Expiry Task) interface. It contains three input fields: &#34;UID&#34; (with instructions for using commas to separate multiple UID, max 100 per batch, and leaving empty to operate the whole batch), &#34;体验金配置编号&#34; (with instructions for using commas to separate multiple configuration codes, max 100 per batch, and leaving empty to operate the whole batch), and &#34;备注&#34; (with a limit of 200 characters and a prompt to input the reason for expiry). There are &#34;取消&#34; (Cancel) and &#34;确认&#34; (Confirm) buttons at the bottom. This interface is related to the &#34;批量手动失效&#34; (Batch Manual Expiry) function in the product scheme, where users can upload and download templates to manually expire experience points." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=NDlkOGRkNzY0YmZmMzJiMDU3NzFhMWJkNGQ3ODEyODVfMjA5N2I0ZmQ3NGYwYzhhYjQzNDkzMmNkMjkzYjUwYzVfSUQ6NzY1NjM4NjQxODg1OTYyNjIxN18xNzg0NTQ5NTg5OjE3ODQ1NTMxODlfVjM" mime="image/png" scale="1.000000" src="DTSObZU86oR7jCxMjOflmD0Jgrc"/></td></tr><tr><td>体验金配置编码</td><td><ol><li seq="1">条件必填</li><li>字段后备注：空=按用户维度，失效该用户全部批次，填写编号=仅失效指定批次</li><li>输入框提示文案：多个编号用英文逗号分隔，单次最多100个；留空则操作该用户全批次</li><li>功能详情 </li></ol><ul><li>支持单个批次号输入；支持英文逗号分隔多个配置批次号</li><li>空值逻辑：输入框为空 = （按 UID维度，失效用户全部批次的体验金）</li><li>有值逻辑：输入体验金配置编码 =（指定批次，仅失效对应批次可用体验金）</li><li><b>上限拦截：</b> 超过 100 个时禁止输入，弹出提示：单次操作批次，不可超过100个</li><li>拦截提示：详见：</li></ul><img name="image.png" alt="The image presents the core input item two-way check rules for the manual expiration function. It shows a table with four columns: UID input box status, configuration code input box status, triggered business mode, and backend core action. The table covers four scenarios: UID with value (single/multiple) and configuration code empty, UID with value (single/multiple) and configuration code with value, UID empty and configuration code with value, UID empty and configuration code empty. Each scenario specifies the corresponding business mode and backend action, with the empty scenario first triggering a report error if both input boxes are empty." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=MTIyYWI3M2Y1OGU3Y2JlMGMxMzA0ZTBlMjVjNWYyMjNfOWE3YmQwYmYzNTAzZTA1ZDNiMTZjMjc1Zjg0YWYxZmRfSUQ6NzY1NjM4OTQ5MzgwODY5NzA1NV8xNzg0NTQ5NTg5OjE3ODQ1NTMxODlfVjM" mime="image/png" scale="1.000000" src="UepUblP1rodSxlx9KjVl1LIEgpe"/></td></tr><tr><td>备注</td><td><ol><li seq="1">必填</li><li>输入框提示文案：请输入失效原因，</li><li>功能详情 <ul><li seq="auto">文本输入框，限制输入上限 200 字符</li><li seq="auto">提交后<del>备注同步存入操作流水，C 端流水展示「系统失效」</del>弹确认弹窗</li></ul></li></ol></td></tr><tr><td>操作</td><td><b>按钮 1：取消</b><ul><li>点击逻辑：关闭弹窗，清空当前所有输入内容，返回手动失效列表页</li></ul><br/><b>按钮 2：确定</b><ul><li>位置：弹窗右下角右侧，紫色填充主按钮</li><li><b>点击确定提交时校验：</b> <ol><li seq="1">UID 空值校验,配置编码是否存在<ol><li seq="1"><del>标红输入框提示「请输入有效 UID」</del></li><li>配置编码格式校验（有输入时），如填写的配置编码不存在，标红输入框提示「体验金配置编码不存在」</li></ol></li><li></li></ol><img name="image.png" href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=MjhmMjc4NWE1MWUwZmM1Mzk2ZjA5ZGRlNjZmMDZkYTZfMjI5ZjI1NjNjZWI2MzI1YjRmZTBlOWQwODk5NGE1NDFfSUQ6NzY2Mjc1NDA0OTI1MDM5NzkyOF8xNzg0NTQ5NTg5OjE3ODQ1NTMxODlfVjM" mime="image/png" scale="1.000000" src="T3nmbMo8bo6QRwxzZzgltXdjgNb"/></li><li><b>校验通过后逻辑： </b><ol><li seq="1">后台预校验数据，汇总本次失效统计数据（影响用户数、总金额、可用 / 委托冻结 / 仓位占用金额）</li><li>弹出二次风险确认弹窗</li><li>用户在确认弹窗点击【确认失效】，才执行后台失效逻辑；点击取消返回添加弹窗</li></ol></li><li><b>同时填写两组多值时处理逻辑：</b><ol><li seq="1"><b>同时填写两组多值时，执行笛卡尔积匹配 ，后端逐条校验每组「UID + 配置编码」是否存在对应可用/委托冻结体验金；</b></li></ol><p> （例：输入 UID=[A, B]，batchNo=[X, Y] → 处理 (A,X), (A,Y), (B,X), (B,Y)</p><ol><li>若 U2+B1 无匹配数据（该用户从未领取 / 无此批次体验金、或该批次已全部冻结 / 过期失效），直接跳过这条，不执行任何失效操作；</li><li>最终仅对有效配对执行失效逻辑，无效配对不入库、不产生操作流水。</li></ol></li></ul></td></tr><tr><td rowspan="2">批量手动失效</td><td>弹窗上传和下载模版弹窗</td><td>标题：批量手动过期<br/>csv文件模版<br/>下载模版：可下载模版<br/>点击上传：可上传模版<br/>X： 关闭弹窗</td><td><img name="image.png" alt="The image shows the &#34;批量发放&#34; (Batch Distribution) interface for importing Excel. There is a purple upward arrow icon in the center, with the text &#34;将文件拖到此处，或点击上传&#34; (Drag the file here or click to upload) below it. It also states that the supported file formats are .xlsx, .xls, .csv and the file size should not exceed 10MB. On the right side, there is a &#34;下载模板&#34; (Download Template) button. This interface is related to the &#34;批量手动失效&#34; (Batch Manual Expiry) function in the product scheme, which involves uploading and downloading templates." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=OWRmNjk3OTQ5YTU4M2U5YzQ1ZTczMTI0NTg5MDMzOGJfYmQ5Yzc0NjA0ZDA0YzNjYmU1M2ZmNjNkMTFmYTQ0MGFfSUQ6NzY1NDQ5NTE0NTE3NzcxNDM5NV8xNzg0NTQ5NTg5OjE3ODQ1NTMxODlfVjM" mime="image/png" scale="1.000000" src="EjHcbVlZsooFLRxCBFmlzXpOgQc"/></td></tr><tr><td>上传模版样式</td><td>字段包含 uid 、 couponcode、remark <br/>UID 条件必填，coupon不填代表所有该UID账户下的所有体验金失效<br/>couponcode 条件必填<br/>Remark 必填<br/>校验同输入框的校验一致：不能uid 和 couponcode 同时为空<br/>提示语：<code>用户UID”与“体验金配置编码”不能同时为空，请至少填写一项</code></td><td><img name="image.png" alt="The image shows a table with three columns: &#34;uids&#34;, &#34;couponCode&#34;, and &#34;remark&#34;. The &#34;uids&#34; column contains two values: &#34;333333&#34; and &#34;333331&#34;. The &#34;couponCode&#34; column has four entries, all starting with &#34;fc258888888&#34;. The &#34;remark&#34; column has four entries, all marked as &#34;示例备注信息&#34; (example note information). This table is related to the &#34;upload template&#34; function in the &#34;batch manual expiration&#34; feature, where fields include uid, couponcode, and remark, with uid being a required condition." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=MzY4MWJkMTlhMDk0MDRiOWEwZDI3ZjcwNDY3N2JiNWRfYTdjNzZiNmVlN2NlNmRjNGEyNDQ2NjQ0OWZiMjdlOTVfSUQ6NzY1NDQ5ODc2ODQxMDQzMTIwOF8xNzg0NTQ5NTg5OjE3ODQ1NTMxODlfVjM" mime="image/png" scale="1.000000" src="KCHLbeNwNoqNACxEr5ulSYF9gMg"/></td></tr><tr><td rowspan="6">二次确认弹窗</td><td>影响用户数</td><td>正常可操作的 UID 数</td><td rowspan="5"><img name="image.png" alt="The image shows a confirmation pop-up window for deactivating experience points (不可逆). It displays the number of affected users as 5, the total affected amount in 1,200.00 USDT, with available experience points at 800.00 USDT, frozen experience points at 400.00 USDT, and position occupied amount at 300.00 USDT. The window also includes a note that available experience points will immediately deactivate, frozen experience points will automatically cancel and deactivate, and position occupied experience points will not automatically liquidate, requiring user liquidation before deactivation. There are two buttons at the bottom: &#34;Cancel&#34; and &#34;Confirm Deactivation&#34;." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=YzMzZTRiZmRlZjlhNDA2NWI2NDUwOWEwZjI5ZmU5M2RfNzM2ZTFlZGE3MzAxYWJjZGMxYTI5Y2IwNmRlNDc3NDVfSUQ6NzY1NDUzNjc5MTUzMTA0ODY2OV8xNzg0NTQ5NTg5OjE3ODQ1NTMxODlfVjM" mime="image/png" scale="1.000000" src="HFtqbkB11ohq6UxzYe9lkXp6g9f"/></td></tr><tr><td>影响总金额</td><td>可用开仓的体验金 + 委托冻结的体验金</td></tr><tr><td>可用体验金</td><td>立即失效部分，展示可用开仓的体验金</td></tr><tr><td>委托冻结体验金</td><td>自动撤单回收部分，展示委托冻结的体验金</td></tr><tr><td>仓位占用金额</td><td>不自动平仓，单独展示（不计入总金额）</td></tr><tr><td>结果反馈</td><td>Toast 提示 操作成功</td><td></td></tr></tbody></table>

#### 核心输入项二选一校验规则

界面保持【UID 录入区】与【体验金配置编码】两个文本框。点击提交时，系统执行以下**条件分流判定：**

| **UID 输入框状态** | **配置编码输入框状态** | **触发业务模式** | **后端核心动作** |
|-|-|-|-|
| 有值（单/多值） | **留空** | 模式一：按用户维度全量失效 | 失效该 UID 名下所有批次的可用/委托体验金 |
| 有值（单/多值） | 有值（单/多值） | 模式二：笛卡尔积精准回收 | 逐一匹配 UID + 配置编码，仅失效对应用户对应的批次。  |
| **留空**  | 有值（单/多值） | **模式三：按体验金批次维度全量失效** | 系统无视 UID，直接将该配置编码下所有用户已领取、未领取的该批次体验金一键失效！ |
| **留空** | **留空** | **第一步提交时，拦截报错** | 若均为空，两个输入框同时标红，拦截并提示：`“用户UID”与“体验金配置编码”不能同时为空，请至少填写一项` |

#### 边界兜底规则

1. 同一 UID 重复录入：执行时自动去重，不重复生成配对
2. 配置编码存在重复值：执行时自动去重，避免重复失效同一批次
3. 超限拦截：系统计算「有效 UID 数量 × 有效配置编号数量」笛卡尔积总配对行数：示例：输入 50 个不重复 UID + 3 个不重复配置编号 配对总行数 = 50×3=150 ≤200，允许提交； 输入 80 个 UID + 3 个配置编号 配对总行数 = 80×3=240 ＞200，弹窗拦截，不允许确认提交。

   - 若总配对行数 ＞ 10000，直接弹窗拦截，提示：当前待处理配对总量超出 10000条上限，请拆分批次批量上传操作；
   - 仅当总配对行数 ≤~~200~~10000 时，才可正常提交执行失效任务。

   1. 开发侧逻辑补充说明（笛卡尔积举例）
4. 仓位占用体验金自动平仓，待平仓后变更卡券状态。



### 体验金明细

路径：现货后台-增值服务 -体验金明细

新增一条【手动失效】的流水明细

导出报表也新增这个类型数据

![The image shows a user interface of the experience gold manual expiration function in the management backend. It presents a list of流水 (transactions) with columns including ID, time, user ID, transaction type, etc. A red box highlights the "体验金失效" (Experience Gold Expiry) type, which is the new type added for manual expiration. This corresponds to the context mentioning that the experience gold manual expiration function adds a new type of transaction record and a new filter type in the user management - contract account - fund flow section.](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=MmFkMjI0MDJmZTNiZGQyNzM2ZjAyNGJmYWU4MjMwODlfOTQ4M2RiMDM4YjU0MzA0MzdjYThkMmE2MmY0OTQzMzNfSUQ6NzY1NDU0OTYzMDEwNTA0Njc1Ml8xNzg0NTQ5NTg5OjE3ODQ1NTMxODlfVjM)



###  用户管理-用户管理-合约账户-资产信息

1. 在来源明细的【体验金失效】统计新增【系统回收】的类型

![](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=NDE0YjM2ZjcxM2ZhNWYzMzM4MTdjNjljZGQ5MTg1MWZfY2RiOTg5NjdmNTdmNTcwZjcyZGM5NjRjMGNjODE2MDVfSUQ6NzY2MjY4OTY4ODM0MzQ4MjA4OF8xNzg0NTQ5NTg5OjE3ODQ1NTMxODlfVjM)

![](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=OTE4NzQ5NmM5YTQ0OGJjMTgxZGExNzc0YTg5ODA1MGZfMDNiMTdiYTdhZWFmYzI4NGM0ZDE3NTg0ZDE1NmViZjNfSUQ6NzY2MjY5MDE0MjYxMjExNTE3MF8xNzg0NTQ5NTg5OjE3ODQ1NTMxODlfVjM)

### 用户管理-合约账户历史支出折合 (USDT) 

路径：现货后台-用户管理-用户管理--数据概览-合约账户-合约账户历史支出折合 (USDT) 

1. 合约账户历史支出折合 (USDT) 的统计中，也加入该【体验金手动失效】类型流水的统计

参考：          <cite doc-id="Y85tdadzjo0yHbxt8eglnhQSgAd" file-type="docx" title="PR-02015 【现货后台】预测市场&amp;体验金流水新增" type="doc"></cite>

![](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=ODk2OGQ5YjRkNzkzNzhjZTNhYjlhM2FiZjQzMDRjNzhfZTVkMWM3Yzc1NTE0Y2M4OTI4MzdlZjZhZjFkMGRjZWNfSUQ6NzY2MjY5MDk1MTI3Nzk3MzIxNF8xNzg0NTQ5NTg5OjE3ODQ1NTMxODlfVjM)

### 用户管理-合约账户-资金流水

路径：现货后台-用户管理-用户管理--合约账户-资金流水

新增【系统回收（体验金）】类型流水记录

新增筛选类型【体验金系统回收】

![The image shows a user management interface in the platform, likely related to the "user management - contract account - funding flow" path mentioned in the context. It displays basic information such as ID, name, email, etc., with a blue-highlighted "体验金手动失效" (Experience Gold Manual Expiry) option under the "筛选类型" (filter type) section. There are also time filters set from 2020-08-17 00:00:00 to 2020-08-23 23:59:59, and a table below showing records with columns like "时间" (Time), "类型" (Type), and "金额" (Amount).](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=Mjc0OGJhNGY4MjEwYWNkZGQwMzcyNjhkMDc4ODk4MWRfZWE5YjkxNGZiNGUxYjBiNDk5YmEzZGYxNjQ0ZTgxNzRfSUQ6NzY1NDU1MjAzOTU3NzQwNzIwMF8xNzg0NTQ5NTg5OjE3ODQ1NTMxODlfVjM)

![](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=MDYxMmYwNTQyZDJjMjg4MDQzYzk1YTg3MjMxZjAyZTFfODQ0MDkwYTRiNWEwNzhlNGUxYmQzMDcyMzMzYjE3MzdfSUQ6NzY2MjY5MTE3MDUxODQyMTIxMV8xNzg0NTQ5NTg5OjE3ODQ1NTMxODlfVjM)

### 财务审计-资金流水

路径：现货后台-统计报表-财务审计-资金流水

新增【系统回收（体验金）】类型流水记录

新增筛选类型【体验金系统回收】

![The image shows a user interface of a management backend system. On the left side, there is a navigation bar with multiple options including "财务审计" (Financial Audit), "资产-流水查询" (Asset - Flow Query), etc. The main area has a search form with fields like "UID", "用户类型" (User Type), "资产" (Asset), "类型" (Type), "时间" (Time), and a "查询" (Search) button. Below the form, there is a table with columns "UID", "用户类型" (User Type), "资产" (Asset), "类型" (Type), "时间" (Time), and "操作" (Operation).](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=YTJiMWYyOGJhODgyYjFjMmRmY2M2YjIyZjU0OGI5ZmZfMWViMTNiYTJlZGQyZGY3NGJmNDQwYWQ4ZjliMTNhNGZfSUQ6NzY1NDU1NjQ5NTA3MzM4MjExMV8xNzg0NTQ5NTg5OjE3ODQ1NTMxODlfVjM)

### 资产-流水查询

路径：合约账户-资产-流水查询

新增【系统回收（体验金）】类型流水记录

新增筛选类型【体验金系统回收】

![The image shows a webpage interface of the management backend, specifically the "Asset - Flow Query" section under the "Contract Account" path. It displays a table titled "Flow Query" with columns including "Flow ID", "Symbol", "Type", "Time", "Account", "Direction", and "Amount". There are several rows of flow records, with the last row highlighted in red, showing a "Manual Failure (Experience Gold)" status. This corresponds to the context mentioning the addition of "Manual Failure (Experience Gold)" flow records and filter type in the management backend's financial audit and asset flow query sections.](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=YzdkY2Y3ZjZkZmQ3Y2VhZjExMmE5MzRiZDI1YTM4ZDRfMGNjN2I5ODQ4ZGFiN2U4NDdhMGY0NzVkY2FmZTRjZDhfSUQ6NzY1NDU1NDYxNzAzNTkxOTA3Ml8xNzg0NTQ5NTg5OjE3ODQ1NTMxODlfVjM)

### C端-web/app

新增类型为【 系统回收】  的[体验金] 流水记录

<table><colgroup><col/><col/><col/></colgroup><tbody><tr><td>模块</td><td>web</td><td>app</td></tr><tr><td>合约账户-资金流水-记录</td><td><img name="image.png" alt="The image shows a &#34;资金流水&#34; (Funds Flow) interface. It has filters for &#34;合约账户&#34; (Contract Account), &#34;类型&#34; (Type) set to &#34;全部&#34; (All), &#34;币种&#34; (Currency) as &#34;USDT&#34;, and date range &#34;2026/4/1 - 2026/7/4&#34;. The table lists transactions: &#34;Tether 划转-转出 -71.000000000&#34; on 2026-06-22 10:35:09, &#34;Tether 划转失效 -100.000000000 (体验金) on the same day, and &#34;Tether 体验金激活 +100.000000000 (体验金)&#34; on 2026-06-22 10:16:38. This relates to the context about &#34;体验金手动失效功能&#34; (Experience Gold Manual Failure Function) in the product scheme." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=ZGQ4MzM3YTY5YjE4M2ZmNDk5MzZmMmQzZDA2ZDRlNTFfNmUxZTZkMDkwOGEyYjRiMGFlODI2NWM4YTFhMzExYmNfSUQ6NzY1NDU2MDM2ODk0Njc2MTQ0NV8xNzg0NTQ5NTg5OjE3ODQ1NTMxODlfVjM" mime="image/png" scale="1.000000" src="RHSobAu8Fo7a8ixguKdlvz75gRc"/><img name="image.png" href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=YWQ4NTZhOGMyMWExZTAzZjZjZGY0OTI3ZTQzZWRlMzVfMjNjNzQ4N2Q0MDJkODg2YWQ1N2RhOGU2ZjAyY2UxMWFfSUQ6NzY2MjY5MTUzNDI3Mzc2MDk5N18xNzg0NTQ5NTg5OjE3ODQ1NTMxODlfVjM" mime="image/png" scale="1.000000" src="UvlrbxvByodQKnxNpAFlMfJCg7c"/><br/>新增 记录： 类型： 系统回收   ，  数量：  -100 .00000000（体验金）<br/>新增筛选类型： 体验金系统回收</td><td><img name="image.png" alt="The image shows the &#34;合约资金流水&#34; page with the currency type set to &#34;USDT&#34; and the transaction type to &#34;全部&#34;. It lists multiple transactions on 06/23 20:24, including a &#34;划转失效&#34; transaction of -96.87267356 (体验金) at 06/23 20:24:01, highlighted in red. Other transactions include &#34;划转-转出&#34; of -10, &#34;平仓盈亏抵扣&#34; of -0.0093, -0.0217, -0.1402722, -0.3273018, and &#34;开仓手续费抵扣&#34; of -0.14027918. This corresponds to the context describing the &#34;体验金手动失效功能&#34; in the management backend, where system失效 (体验金) transactions are added, such as -100.00000000 (体验金) in the contract account&#39;s fund flow records." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=NzNmYzIxNzY1YTM3YWM2YzJkZmZiMDdlYjYxZDEyNTBfYzliNjk4YThhYmQ0YjNiMDNlZDFlMzRmYzBjNDkzYjVfSUQ6NzY1NDU2NzMxNjUxNjExNDE0M18xNzg0NTQ5NTg5OjE3ODQ1NTMxODlfVjM" mime="image/png" scale="0.066667" src="ZUPObC8bQoFtK0xtjzNl43ojgHf"/><img name="image.png" alt="The image shows the &#34;Contract Fund Flow&#34; interface with a red box highlighting the &#34;Type: All&#34; dropdown menu. Below, there are multiple entries of USDT fund flows, including a &#34;Transfer Failure&#34; type with a quantity of -96.87267356 (Experience Gold) on 06/23 20:24:01, and other entries like &#34;Profit/Loss Offset&#34; and &#34;Profit/Loss Fee Offset&#34; with corresponding quantities. This relates to the context about adding a new record of type &#34;System Failure&#34; for Experience Gold in the contract account&#39;s fund flow records." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=ZDdjNWM0YzM2MWJlYTg2M2Y3ZDVmNzRiNDU4N2YwNzFfNzQxNjExNjhlYzZjYjg1OTk4YzUwNThhOTdiM2I3YzZfSUQ6NzY1NDg5OTU2Mzk4NzQzOTMyNl8xNzg0NTQ5NTg5OjE3ODQ1NTMxODlfVjM" mime="image/png" scale="0.507772" src="Wl8ebYTUjogAhMxzjHglbbpxgEh"/><br/>新增 记录： 类型：： 系统回收   ，  数量：  -100 （体验金）<br/>新增筛选类型： 体验金系统回收</td></tr><tr><td>合约交易-订单-交易记录-资金流水</td><td><img name="image.png" alt="The image shows a table of transaction records under the &#34;资金流水&#34; (Funding Flow) section. It lists multiple entries with columns including time, type, amount, currency, and remarks. Notably, there is a red arrow pointing to a record with the type &#34;系统失效&#34; (System Failure) and an amount of &#34;-100.00000000 (体验金)&#34; (100.00000000 Experience Gold), which is the key focus of the image. This record corresponds to the context describing the &#34;体验金手动失效功能&#34; (Experience Gold Manual Failure Function) in the product scheme, demonstrating the system&#39;s handling of失效 (expiration) transactions." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=ZGE4Njc3ZWQyMTczMWRlYWQ4NGUzMDM5MmZlNzkwMTNfNTRlNmFkMzA4ODE3MzlhZTk3ZGExZGZiMDg5NGRiM2FfSUQ6NzY1NDU2MDkyOTc2NTU5Mjc5NV8xNzg0NTQ5NTg5OjE3ODQ1NTMxODlfVjM" mime="image/png" scale="1.000000" src="OSPCbStgeoo32OxY0E2lcsYJgwx"/><br/>新增 记录： 类型： 系统失效   ，  数量：  -100 .00000000（体验金）<br/>新增筛选类型： 体验金系统回收</td><td><img name="image.png" alt="The image shows a mobile app interface of the &#34;交易记录&#34; (Transaction Records) section, specifically the &#34;资金流水&#34; (Funding Flow) tab. It displays multiple USDT transactions on 06/23 20:24, including a &#34;划转失效&#34; (Transfer Failed) transaction with a large negative amount of -96.87267356 (体验金, Experience Gold) highlighted in red, which is related to the context of &#34;体验金手动失效功能&#34; (Experience Gold Manual Failure Function). Other transactions include &#34;划转-转出&#34; (Transfer - Transfer Out), &#34;平仓盈亏抵扣&#34; (Close Position Profit/Loss Offset), and &#34;平仓手续费抵扣&#34; (Close Position Commission Offset) with smaller negative amounts." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=NWM0NDdmOGU0MmQ0YzBlMGEyMGFlNzI0OGU1NjhjOGJfZTg5OWJmNGVhZWVkYTQ3NjM3MjE4ZjQwYTQwNTlmZmJfSUQ6NzY1NDU2Njg4NTYzMjgwNjYxOV8xNzg0NTQ5NTg5OjE3ODQ1NTMxODlfVjM" mime="image/png" scale="0.071023" src="Ao9Cbu1NpoGGL8xr9oOlHLiQgnh"/><br/>新增 记录： 类型： 系统失效   ，  数量：  -100 .00000000（体验金）<br/>新增筛选类型： 体验金系统回收</td></tr><tr><td>合约</td><td>/</td><td><img name="image.png" alt="The image shows a mobile app interface with a red arrow pointing to the &#34;资金流水&#34; (Funds Flow) section. The time displayed is 20:24, and the date is 2026-06-23. The funds flow includes multiple entries: a transfer-out of -10, a transfer失效 (transfer失效) of -96.87267356 (体验金), a平仓盈亏抵扣 (Position Profit/Loss Offset) of -0.0093 (体验金), a平仓盈亏 (Position Profit/Loss) of -0.0217, and a平仓手续费抵扣 (Position Commission Offset) of -0.1402722 (体验金)." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=NWUyY2NmNDlkZDM1Yzg0M2E0YjE0ZWMzNzRlY2E4NzNfMDIzYmZiMzMwZDI2ZjZjYzQzMTliMDY3YjA5MzkwMzBfSUQ6NzY1NDU2NzE4MzI0MjA1NTM5MV8xNzg0NTQ5NTg5OjE3ODQ1NTMxODlfVjM" mime="image/png" scale="0.228659" src="UbZAb8ifAoRugex3ElZltq4Ygbb"/><br/>新增 记录： 类型： 系统回收   ，  数量：  -100 .00000000（体验金）</td></tr><tr><td>福利中心-卡券中心-卡券记录</td><td><img name="image.png" alt="The image shows a webpage interface of the system, specifically the &#34;Card Vouchers&#34; section under the &#34;Benefits Center&#34;. It displays a list of card voucher records with columns including card type, amount, status, and time. The card type is &#34;Contract Voucher&#34;, the amount is 100, the status is &#34;Expired&#34;, and the time ranges from 2020-06-17 to 2020-06-23. There is a red box highlighting the &#34;Expired&#34; status column, which is related to the context mentioning &#34;新增记录：类型：过期，说明：系统失效&#34; (New record: type: expired, reason: system failure)." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=MzUwZjg2ZWY2YmRlNjE5N2JkNzNmNGFlYzIyNmM0MzJfMWFlYmFjNTAwM2MxZDFkYjNlMWQ4MzFjNGJhOTBlZjNfSUQ6NzY1NDU3NDA5MjkwNTEwNzE2NV8xNzg0NTQ5NTg5OjE3ODQ1NTMxODlfVjM" mime="image/png" scale="1.000000" src="KewUbKjs0olxOpx46pilf9xCgad"/><br/>新增 记录：类型：过期  ，  说明： 系统回收</td><td><img name="image.png" alt="The image shows a card voucher record interface with a red box highlighting the &#34;说明&#34; (Description) column. The interface displays multiple records of &#34;合约体验金&#34; (Contract Experience Fund) with amounts of 100 USDT, currency as USDT, type as &#34;获得&#34; (Received), and times such as 2026-06-23 17:56:06, 2026-06-22 23:05:21, and 2026-06-22 10:13:30, all marked as &#34;空投发放&#34; (Airdrop Issued). This relates to the context of adding a &#34;过期&#34; (Expired) record with &#34;系统失效&#34; (System Failure) in the card voucher record, as mentioned in the document." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=YmQwYjlhODIwNjYxMGIxMDE3MWFlMGFhNDc2YWFlYjlfMDU1YmQxMjUyM2ZmN2ZhYzU3NGI3NDM5ZTE3MjBkZmJfSUQ6NzY1NDU3NDMxOTcwMzUxMDc2MF8xNzg0NTQ5NTg5OjE3ODQ1NTMxODlfVjM" mime="image/png" scale="0.258621" src="WmIRb6UzTodGdRxDnyolyP3Qg3j"/><br/>新增 记录： 类型：过期  ，  说明： 系统回收</td></tr></tbody></table>



### 通知策略

#### 通知规则（静默处理，不主动通知）

#### 用户可感知渠道

| 入口 | 展示内容 | 说明 |
|-|-|-|
| **卡券列表** | 卡券列表展示「已失效」状态标签 | 用户主动进入福利中心查看时可见 |
| **卡券记录** | 卡券记录流水列表中【说明】展示「系统回收」流水记录 | 含流水类型、时间、金额变化 |

---

# 边界条件及异常处理

## 业务边界处理规则

### 跳过处理场景（不失效、不生成流水）

- 体验金状态为【已用完】【已过期】
- 传入 UID / 批次号不存在，参数校验失败直接报错
- 持仓占用部分：做标记，暂缓回收，待用户用户平仓后，自动失效回收

### 立即执行失效场景

- 状态为待领取（待使用）的
- 已激活且可用的体验金数量大于 0
- 存在未成交委托冻结：自动撤单后回收

## 幂等性机制

- 每次请求生成唯一 requestId，重复提交自动拦截，避免重复失效、重复记账

## 事务补偿机制

- 余额扣减、状态变更、流水写入采用分布式事务最终一致性方案
- 失败自动重试 3 次，重试失败进入异常队列，支持人工对账兜底

### 并发竞争处理方案

针对「用户同时开仓、挂单、撤单，后台同步执行手动失效」并发场景：

- 优先保证资金状态一致性，避免一边冻结、一边失效导致账务错乱

### 核心计算规则

本次失效分为两个统计口径，固定快照金额 + 实时动态累计金额，保证审计溯源与财务实时对账兼顾：

**~~1、即时失效金额（固定快照，永久不变）~~**~~：操作提交瞬间即时生效金额 = 可用体验金余额 + 可撤销委托冻结体验金余额（持仓占用体验金不计入），为运营操作时刻的固定快照数据，用于溯源。~~

**2、实时累计失效金额（动态实时变动）**：初始值等于即时失效金额；用户后续对持仓占用体验金完成平仓后，系统自动将原持仓冻结额度累加至该字段，实时更新最终全部失效总额，用于财务实时对账、前端展示最终失效总量。

# 清洗数据维护

# <cite doc-id="H9WsdHvwZoLWc0xVEg1lK0w7gsf" file-type="docx" title="业务-数据组上下游对照表" type="doc"></cite>



# 验收准备

| 事项 | 说明 |
|-|-|
| 测试账号 | 准备不同状态的体验金卡券（待领取，已激活无占用、已有委托、已有持仓、已过期、已用完） |
| 合约账户 | 测试账号需有持仓+委托单，覆盖组合场景 |
| 委托类型覆盖 | 限价单、条件单等至少准备一笔，验证统一撤单 |
| 数据准备 | 准备一批模拟误发的历史数据，测试批量失效（100条边界测试） |



## 非功能需求

### 权限需求

| 需求 | 说明 |
|-|-|
| 权限点 | 新增「manual_invalidate_trial_fund」权限点 |

### 安全需求

| 需求 | 说明 |
|-|-|
| 二次确认 | 所有手动失效操作必须经过二次确认弹窗 |
| 批量限制 | 单次批量上限100条卡券，防止误操作波及大量用户 |

### 风控需求

| 需求 | 说明 |
|-|-|
| 不影响正常交易 | 有持仓时不自动平仓，避免用户投诉 |
| 不追回已使用金额 | 已消耗的体验金不追溯回收 |

### 运营需求

| 需求 | 说明 |
|-|-|
| 操作记录可查 | 手动失效记录操作人和时间 |

## 埋点需求

### 无

## To-Do List（评审用）



---

## 附录

### 关键决策记录

| 决策项 | 决策结果 | 决策理由 |
|-|-|-|
| 命名 | 手动失效（系统回收）而非手动过期 | 系统逻辑和用户感知都更准确 |
| 持仓处理 | 不自动平仓，标记失效处理中 | 避免强平用户仓位引发投诉 |
| 委托处理 | 自动撤单，**不区分委托类型**统一撤销 | 所有未成交委托（限价/市价/止盈止损/条件单等）统一处理 |
| 已使用金额 | 不追溯回收 | 已用于交易的金额不可逆 |
| 批量处理上限 | **100条/次** | 防误操作+系统压力控制 |
| 用户通知 | **暂静默处理**，不通知用户 | 简化一期范围 |
| 撤回能力 | 本期不做 | 运营操作需审慎，二次确认机制已降低误操作风险 |