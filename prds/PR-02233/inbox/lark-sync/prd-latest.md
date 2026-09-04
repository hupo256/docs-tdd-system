---
sourceName: "需求 PRD"
sourceType: "doc"
sourceUrl: "https://qfglxo2m3dc.sg.larksuite.com/docx/QaBEditNroySaGxmywFl8CwXg6d"
syncedAt: "2026-09-04T10:28:25.519Z"
readOnly: true
command: "lark-cli docs +fetch --api-version v2 --doc https://qfglxo2m3dc.sg.larksuite.com/docx/QaBEditNroySaGxmywFl8CwXg6d --doc-format markdown --as user --format json"
---

<title>PR-02233 【用户端】安全验证校验交互优化</title>

# 版本信息

<grid>
<column width-ratio="0.333333">
<callout emoji="⏰">
版本号：V_1.0.0
</callout>
</column>
<column width-ratio="0.333333">
<callout emoji="📆">
创建日期：2026-08-03
</callout>
</column>
<column width-ratio="0.333333">
<callout emoji="👮">
审核人
</callout>
</column>
</grid>



# 变更日志

<callout emoji="🍉">
需求评审完毕后，每次更改/新增以评论的方式标记新增内容点，@相关人员，同时在对应需求群同步内容 。
</callout>

<table><colgroup><col/><col/><col/><col/></colgroup><thead><tr><th><b>时间</b></th><th><b>版本号</b></th><th><b>变更人</b></th><th><b>主要变更内容</b></th></tr></thead><tbody><tr><td>2026-08-03</td><td>V_1.0.0</td><td><cite type="user" user-id="ou_f7ba9a4140c817669b9c90a22d7f757b" user-name="Sissie"></cite></td><td>新建</td></tr><tr><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td></tr></tbody></table>

# 评审记录

<table><colgroup><col/><col/><col/><col/></colgroup><thead><tr><th>评审</th><th>评审<b>时间</b></th><th>参与人员</th><th><b>结论</b></th></tr></thead><tbody><tr><td>需求沟通</td><td></td><td></td><td></td></tr><tr><td>需求内审</td><td>2026年8月14日</td><td><cite type="user" user-id="ou_f7ba9a4140c817669b9c90a22d7f757b" user-name="Sissie"></cite><cite type="user" user-id="ou_6e76055c146cbd51e1c0ef8793caef2b" user-name="Lucky"></cite><cite type="user" user-id="ou_9673ca5947df46dca27550d9f88012c6" user-name="George"></cite></td><td>会议：<br/>https://qfglxo2m3dc.sg.larksuite.com/minutes/obsgfg3fv2c4f6l62c143ekc<br/>结论：<ol><li seq="1">登录页保留「切换验证方式」，补充相关功能需求内容</li><li>倒计时交互回退</li><li> APP 验证码快捷填充问题</li></ol></td></tr><tr><td>需求评审</td><td>2026-08-31</td><td><cite type="user" user-id="ou_3ff7cb42ee8639e5ad09e35906e7a09f" user-name="Willem"></cite><cite type="user" user-id="ou_be270e1eb1997efc8ac4797fbb28b2bd" user-name="Andy"></cite><cite type="user" user-id="ou_18b99b7ac24aa4d98fa8212eea46f96e" user-name="Knox"></cite><cite type="user" user-id="ou_91861d6da6cf6822e08045ba1868241e" user-name="Aven.tong"></cite><cite type="user" user-id="ou_873197d29bc985a0e0b8b8eedbba10fa" user-name="Max (前端）"></cite><cite type="user" user-id="ou_8e4061bba550ab2fc1b132bc3aa7f69a" user-name="Fly"></cite><cite type="user" user-id="ou_6b295010c8a0d7dfff43fcf8ae25ecb3" user-name="Iris.ex"></cite><cite type="user" user-id="ou_1e4137bb6918dd9b146e0a40fa16d265" user-name="Alce"></cite></td><td>会议：https://qfglxo2m3dc.sg.larksuite.com/minutes/obsgq17muc67a55ikbqbyt39<br/>结论：<ol><li seq="1">补充验证码现状 -- 仅产品侧留存记录</li><li>补充各页面请求验证码截图 </li></ol></td></tr></tbody></table>

#  需求背景

<table><colgroup><col/><col/><col/><col/></colgroup><thead><tr><th>#</th><th>当前现状</th><th>问题</th><th>优化目标</th></tr></thead><tbody><tr><td>1</td><td><readonly-block token="w0yRXwi4ZoFrdcxZCTxPZfQEqIjAk3dIo7CA" type="url_preview"></readonly-block></td><td><ol><li seq="1">IP 限频误伤正常用户：用户第一次点击就提示「发送过于频繁」，因为该 IP 已被其他账号的请求打满（IP 100 条/24h），用户本人一次都没发过，完全是被误伤</li><li>提示语与实际情况不符：「发送过于频繁」暗示用户自己发多了，但实际上用户是第一个请求就被挡——底层是 IP 被限而不是用户行为被限，文案有误导</li><li>错误码提示传达不足： 60 秒限频、UID 限频、IP 限频，提示不足够信息区分展示，导致用户和客服都看不懂原因</li><li>限频拦截后无日志可追溯：请求验证码的 IP 与登录 IP 不一致，且缺少日志记录具体是哪个 IP 触发限制及对应的请求记录，排查链路断裂</li><li>发送失败不进入倒计时，用户可无限点击：只有发送成功才启动 60 秒倒计时，失败时按钮保持可点，用户反馈「按钮没反应」就会一直点，造成无意义的重复报错</li><li>提币场景体验不足：验证码收不到时用户没有替代方案（切邮箱/手机、通行密钥等），只能求助客服</li><li>Fameex后台看不到被拦截的请求具体原因，客服无法判断 ，待研发排查下来，时间过了大半</li></ol></td><td><ol><li seq="1"><b>限频策略</b><ol><li seq="1"><cite doc-id="VEh4dzNDVoAQ2Xx4eMelxtl7g8b" file-type="docx" title="PR-02235 【用户端】 验证码请求频繁/错误提示优化" type="doc"></cite></li></ol></li></ol><callout emoji="🍇"><ol><li seq="1"><b>交互</b><ol><li seq="1">发送按钮加「发送中」disabled 状态</li><li>发送失败也进倒计时（限频类失败）</li><li>全平台验证码场景交互统一修正</li><li>验证码获取增加切换方式 ，邮箱收不到可切手机号，手机收不到可切邮箱</li></ol></li></ol></callout><ol><li><b>客服</b><ol><li seq="1">后台验证码研发新增第三方返回状态告知 ，可供查询，或登录第三方官网查询更详细信息 。<cite doc-id="T9lVdWbFUotT24xOrIclddptgjc" file-type="docx" title="PR-02189 【现货后台】用户短信优化（有效期/请求/后台状态展示）" type="doc"></cite></li></ol></li></ol></td></tr><tr><td>2</td><td><readonly-block token="w0ynb2PCf1w2EoSNn2D2vsS8q0Iw33OT4xDg" type="url_preview"></readonly-block></td><td><ol><li seq="1">短信验证码延迟/过期：用户提币时验证码迟迟不到或到了已过期，直接阻断提币流程</li><li>手动下发缺乏标准 SOP：客服手动下发时不知道优先选哪个渠道、间隔多久、失败后下一步做什么，整个过程靠临时沟通推进</li><li>渠道切换无固定策略：先阿里云再华为、短信再邮件，都靠人工判断，没有按国家/运营商/后缀自动路由的机制</li><li>故障归属不清：短信链路涉及平台→短信商→用户端三层，出问题时缺乏快速定位手段，每次都要找 TG 群 Waltor 协助排查</li><li>无主动监控：依赖用户投诉才被动介入，缺乏对短信到达率、延迟、失败率的主动监控和告警</li></ol></td><td><ol><li seq="1"><b>手动下发 SOP 固化</b><ol><li seq="1">每个渠道间隔 3-5 分钟依次下发 → 全渠道失败 → 人工手动提币 + 人工冲销，形成标准流程</li></ol></li><li><b>后台下发渠道优化</b><ol><li seq="1">过滤不使用渠道</li></ol></li><li><b>验证码多渠道自动降级</b><ol><li seq="1">主渠道失败自动切备用渠道重发，减少客服手动介入</li></ol></li><li><b>验证码失效</b><ol><li seq="1">与竞品靠齐 ，增加短信验证码有效值至10分钟</li></ol><p></p><p>2/3/4都已在<cite doc-id="T9lVdWbFUotT24xOrIclddptgjc" file-type="docx" title="PR-02189 【现货后台】用户短信优化（有效期/请求/后台状态展示）" type="doc"></cite>处理</p></li></ol><callout emoji="🍇"><ol><li seq="1"><b>通行密钥作为备用验证方式</b><ol><li seq="1">PR-02234 【用户端】新增通行密钥</li></ol></li></ol></callout></td></tr><tr><td>3</td><td><readonly-block token="w0yafUnze4P7BsjuxyQOb7TfahwDz4qFfdng" type="url_preview"></readonly-block></td><td><ol><li seq="1">延迟/收不到：短信商到运营商到用户端链路延迟 10+ 分钟，到了已过期</li><li>运营商日上限无感知：用户触达运营商侧限频，平台日志显示调用成功，但平台完全不感知、不告警、不切换渠道</li><li>重复点击发新码：每次点都生成新验证码，旧码还在路上新码又发了，用户同时收到多个不知道用哪个</li></ol></td><td>当前问题都已在<cite doc-id="T9lVdWbFUotT24xOrIclddptgjc" file-type="docx" title="PR-02189 【现货后台】用户短信优化（有效期/请求/后台状态展示）" type="doc"></cite>处理</td></tr></tbody></table>

# 需求范围

| 维度 | 范围 |
|-|-|
| 端口 | App（iOS / Android）、Web（H5 / PC） |
| 场景 | 全平台调用验证码校验的所有场景（登录、注册、提币、安全设置变更、绑定/解绑等） |
| 验证方式 | 邮箱验证码、手机短信验证码、GA |
| 语言 | 支持平台多语言 |

# 需求详情

## 原型图

<readonly-block href="https://pr-02233.netlify.app" type="iframe"></readonly-block>

### Web-UI：<cite type="user" user-id="ou_27935ec2da8ec2627f04b033482a0657" user-name="Aniya"></cite>



### App-UI：<cite type="user" user-id="ou_27935ec2da8ec2627f04b033482a0657" user-name="Aniya"></cite>



## 切换**注册方式**引导

<grid>
<column width-ratio="0.500000">
![当前现状](https://feishu.cn/file/M1t8bVEJponR5Bx7vWElwc3igXd)
</column>
<column width-ratio="0.500000">
![优化后](https://feishu.cn/file/FEAqbVITho7WtnxkwWhlf6MPgQh)
</column>
</grid>

- **现状**

  - App支持切换注册方式引导，web不支持；且在注册的时候并展示切换验证方式 ，在注册时只有一个验证方式 ，故功能提示错误 。
- **优化**

  - App保持不变，Web端“切换验证方式”修改为“没收到验证码？尝试邮箱注册”
  - 点击回到注册页面，两端保持功能一致

## 切换登录校验引导

![当前现状](https://feishu.cn/file/ERmCbXk7ZoxB6BxgAVclaz3qgPd)

### **现状**

- Web 有"切换验证方式"但点击**跳回登录页**(等于无效);App 无此入口。登录实际不支持真正切换。

### **优化**

- 登录校验页新增【切换验证方式】入口,**采用弹窗形式**选择验证方式。**App 新增、Web 修复**为真正的方法切换(不再跳回登录页)。切换范围＝用户已绑定的其他验证方式。

### **交互**

![The image shows the "切换验证方式" (Switch Verification Method) pop-up window. The title is "切换验证方式" and the subtitle is "选择一种已绑定的验证方式完成登录". It lists three verification methods: Google Authenticator (GA) with "30秒自动更新,无需发送" (30-second auto-update, no need to send), Email Verification Code with the email address "kev****8@fameex.com" (current) and phone number "+86 138****8888". The Email Verification Code is highlighted with a blue border.](https://feishu.cn/file/Fi29byMCdoy21ux9Efyljjy7gqe)

- **入口**:校验区【确认】按钮下方展示【换验证方式】,web/app 一致。
- **展示条件**:仅当用户绑定 **≥2 种**方式时展示;只绑定单一方式时隐藏(无可切换项)。
- **点击后**:弹出「切换验证方式」弹窗——

  - 标题「切换验证方式」, 副标题「选择一种已绑定的验证方式完成登录」。
  - 列出用户**已绑定**的方式,每项含:图标 + 方式名称 + 说明(邮箱/手机需要脱敏；GA 显示"30秒自动更新,无需发送"),当前正在使用的方式标注【当前】。
  - 列表排序 GA → 邮箱 → 手机 。
  - 可通过 ✕ 或点击遮罩关闭,关闭不改变当前方式。
- **选择后**:弹窗关闭,校验区切换为所选方式的输入样式。
- **默认方式**:进入登录默认取最高优先级(GA>邮箱>手机,见 6.4);切换是用户主动改用其他已绑定方式。

### **边界**

- 仅绑定一种方式 → 不展示"切换验证方式"。
- 切换后再切回 → 各方式**倒计时独立、切回保留**。

  - 现状：非同场景下获取验证码当下是共用一个倒计时 -- 比如说修改邮箱请求了验证码，提币也请求了验证码，60s只能只能请求1次验证码 。当前是共用1个（请求接口是1个，不细分业务场景）
  - 现状：用户切换邮箱到手机 ，验证码倒计时是否共用一个。--    不共用，邮箱是邮箱，手机是手机
- 切换列表不展示未绑定的方式。

## 验证方式优先级

| 场景 | 校验方式 | 默认验证方式 |
|-|-|-|
| 注册 | 单一校验 | 使用注册时选择的手机号或邮箱作为验证渠道（此时账户尚未创建，无法使用GA） |
| 登录 | 单一校验，可切换 | 按优先级取已绑定的最高优先级方式：**GA --> 邮箱 --> 手机** |
| 提币/修改密码.. | 强制双重校验 | 必须完成两种验证方式；按优先级取已绑定方式中的前两位（如GA+邮箱-->GA+手机 -- > 邮箱+手机）  |
| 其他敏感操作 | 单绑单一 / 双绑及以上双重 | 单绑情况下使用该方式单一校验 |

## Web校验交互优化

- **现状**

  - web除登录注册验证形式不统一，页面和弹窗形式均有
- **优化**

  - **统一原则**

    | 场景 | 交互形式 |
    |-|-|
    | 登录 / 注册 | 保留**页面**形式（左右布局，与现有结构一致，不做弹窗化改造） |
    | 除登录注册外的其他所有校验场景 | 统一优化为**弹窗**模式 |

    <table><colgroup><col/><col/><col/><col/></colgroup><tbody><tr><td>提币 （含内部）<img name="image.png" alt="The image shows a webpage interface of the FomeEX platform during the &#34;提币&#34; (withdrawal) process. The main content area displays the withdrawal steps, including selecting the withdrawal currency (USDT), entering the recipient address, and setting the withdrawal amount (10). A pop-up window titled &#34;安全验证&#34; (Security Verification) is prominently displayed, requiring the input of email verification code and phone verification code. The background shows related questions and answers on the right side, and there is a &#34;发送成功&#34; (Send Successful) button at the top right of the pop-up window." mime="image/png" scale="1.000000" src="ZIJObZO8OoJLFox85cGlwiUOgRg"/></td><td>修改密码 / 设置密码<img name="image.png" alt="The image shows a webpage interface for modifying the login password. At the top, there is a navigation bar with options like &#34;首页&#34; (Home), &#34;我的&#34; (My), &#34;帮助&#34; (Help), etc. The main content area has a title &#34;修改登录密码&#34; (Modify Login Password) in bold. Below it, there are input fields for the old password, new password, and confirm new password, each with corresponding placeholder text. At the bottom, there is a purple &#34;提交&#34; (Submit) button. This interface is part of the Web校验交互优化 (Web Verification Interaction Optimization) mentioned in the document, which includes modifying passwords, emails, phones, etc." mime="image/png" scale="1.000000" src="DgRtbK8kFo4wCxx2OzqljhoEgse"/></td><td>修改邮箱/设置邮箱<img name="image.png" alt="The image shows a webpage interface of the FameX platform. The top navigation bar includes options like &#34;首页&#34; (Home), &#34;行情&#34; (Charts), &#34;我的&#34; (My), &#34;设置&#34; (Settings), &#34;帮助&#34; (Help), &#34;交易&#34; (Trading), &#34;社区&#34; (Community), &#34;更多&#34; (More). The left sidebar has sections such as &#34;账号管理&#34; (Account Management), &#34;资产活动&#34; (Asset Activities), &#34;身份认证&#34; (Identity Authentication), and &#34;API管理&#34; (API Management). The main content area displays a &#34;修改邮箱&#34; (Modify Email) form with an email input field and several &#34;获取验证码&#34; (Get Verification Code) buttons. The bottom has a footer with links to &#34;关于我们&#34; (About Us), &#34;系列产品&#34; (Product Series), &#34;服务支持&#34; (Service Support), &#34;新手学堂&#34; (Newbie Hall), &#34;社区&#34; (Community), and social media icons." mime="image/png" scale="1.000000" src="OCUrbU5mGoJ9bSxfqGGlLExTgFh"/></td><td>修改手机/设置手机<img name="image.png" alt="The image shows a webpage interface of the FameX platform. At the top, there is a navigation bar with options like &#34;首页&#34; (Home), &#34;行情&#34; (Charts), &#34;我的&#34; (My), etc. The main content area displays a &#34;修改手机号&#34; (Modify Phone Number) section, where a phone number &#34;152****9910&#34; is entered, and there are fields for entering a verification code and a confirmation code, with a red dot highlighting the verification code field. At the bottom, there are sections for &#34;关于我们&#34; (About Us), &#34;系列&#34; (Series), &#34;服务支持&#34; (Service Support), &#34;新手学堂&#34; (Newbie Classroom), and &#34;社区&#34; (Community), along with some icons and contact information." mime="image/png" scale="1.000000" src="PIe5bGEV5ozBYsxxzDGljeRtgrg"/></td></tr><tr><td>绑定第三方/解绑第三方<img name="image.png" alt="The image shows a screenshot of the &#34;Account Management&#34; page in the FomeEX system. The main interface displays the user information &#34;西西2号&#34; with UID 10819103. Below, the &#34;Security Settings&#34; section lists options like &#34;Email&#34;, &#34;Phone&#34;, &#34;Password&#34;, &#34;Two-Factor Authentication&#34;, &#34;API Management&#34;, and &#34;Payment Method&#34;. A pop-up window titled &#34;Account Binding&#34; is open, showing three binding methods: &#34;Use Google Login&#34;, &#34;Use WeChat Login&#34;, and &#34;Use API Login&#34;, each with a &#34;Bind&#34; button. This corresponds to the Web校验交互优化 context, which mentions统一优化为弹窗模式，如关闭谷歌验证等场景。" mime="image/png" scale="1.000000" src="PmgPb3fcgoCgOoxvDGTlwYO7gJe"/></td><td>关闭谷歌验证<img name="image.png" alt="The image shows a screenshot of the &#34;账号管理&#34; (Account Management) page in the FomeEX system. The page displays the user &#34;西西2号&#34; with UID 10819103. The &#34;安全设置&#34; (Security Settings) section is highlighted, and a pop-up window titled &#34;关闭谷歌验证&#34; (Disable Google Verification) is open, showing the verification code &#34;123456&#34; and options to &#34;确定&#34; (Confirm) or &#34;取消&#34; (Cancel). This screenshot corresponds to the &#34;关闭谷歌验证&#34; (Disable Google Verification) scenario in the Web校验交互优化 (Web Verification Interaction Optimization) context, which is part of the overall security verification interaction optimization plan." mime="image/png" scale="1.000000" src="RuXhb2WvyoiArtxYwkclSSFXgYg"/></td><td>关闭手机验证<img name="image.png" alt="The image shows a screenshot of the &#34;账号管理&#34; (Account Management) page in the FomeEX system. The page displays the user &#34;西西2号&#34; with UID 10819103. The &#34;安全设置&#34; (Security Settings) section is expanded, showing options like &#34;登录密码&#34; (Login Password), &#34;邮箱&#34; (Email), &#34;手机号&#34; (Phone Number), etc. A prominent pop-up window titled &#34;安全验证&#34; (Security Verification) is in the center, with fields for &#34;验证码&#34; (Verification Code) and a &#34;获取验证码&#34; (Get Verification Code) button. This pop-up is part of the Web校验交互优化 (Web Verification Interaction Optimization) mentioned in the context, which aims to unify other verification scenes into a pop-up mode except for login/register." mime="image/png" scale="1.000000" src="EXQ8brnOMo7HIsxgDpLlhaULgKh"/></td><td>提币白名单开启 / 关闭<img name="image.png" alt="The image shows a webpage interface with a &#34;安全设置&#34; (Security Settings) section. A pop-up window titled &#34;安全验证&#34; (Security Verification) is displayed, containing fields like &#34;验证码&#34; (Verification Code) and &#34;验证码验证码&#34; (Verification Code Verification Code), with a &#34;确定&#34; (Confirm) button. The background page has sections such as &#34;API管理&#34; (API Management) and &#34;收付方式&#34; (Payment Methods), and the top shows a user profile with &#34;西西2号&#34; (Xixi2) and a UID. This relates to the Web校验交互优化 context, where other than login/register, all verification scenarios are unified as pop-up modes." mime="image/png" scale="1.000000" src="L7flbBhigoLwrwxxVgWlPeXwggc"/></td></tr><tr><td>添加地址任改地址（含内部）<img name="image.png" alt="The image shows a webpage interface with a pop-up window titled &#34;添加提现地址&#34; (Add Withdrawal Address). The window includes fields for &#34;币种&#34; (Currency) set to &#34;USDT&#34;, &#34;地址&#34; (Address), &#34;选择网络&#34; (Select Network), and &#34;地址备注 (选填)&#34; (Address Note (Optional)). There are &#34;取消&#34; (Cancel) and &#34;确定&#34; (Confirm) buttons at the bottom. This relates to the Web校验交互优化 context, which mentions统一除登录注册外的其他校验场景为弹窗模式，如添加地址任改地址（含内部）等场景。" mime="image/png" scale="1.000000" src="AaesbgFrtovIcOx7kCSlTGZKgxc"/></td><td>注销账号<img name="image.png" alt="The image shows a webpage interface of the &#34;注销账号&#34; (Account Deletion) page. At the center, there is a prominent pop-up window titled &#34;安全验证&#34; (Security Verification) with a checkbox labeled &#34;我已阅读并同意&#34; (I have read and agree). Below the checkbox, there is a text input field and a purple &#34;下一步&#34; (Next) button. The background page displays the &#34;注销账号&#34; title and some related text. This image is related to the Web校验交互优化 context, specifically the &#34;注销账号&#34; (Account Deletion) scenario which is unified to the pop-up mode as per the optimization plan." mime="image/png" scale="1.000000" src="V46UbTx8soGSowxpv64lWBazgQd"/></td><td>APi管理<img name="image.png" alt="The image shows the &#34;API Management&#34; page of the platform. At the top, there is a navigation bar with options like &#34;Home&#34;, &#34;Account&#34;, &#34;API Management&#34;, &#34;VIP Center&#34;, etc. Below the navigation, there is a section labeled &#34;API Management&#34; with input fields for &#34;API Name&#34;, &#34;API Description&#34;, and &#34;API URL&#34;, along with a &#34;Get API Key&#34; button. At the bottom, there is a &#34;API Key&#34; section displaying &#34;API Key&#34; and &#34;Secret Key&#34; fields, and a &#34;Save&#34; button. This page is part of the API management functionality mentioned in the document&#39;s context about Web校验交互优化." mime="image/png" scale="1.000000" src="LLpwbbUawoRhyNx5kzkleNlugqf"/></td><td>查看API<img name="image.png" alt="The image shows the &#34;查看API&#34; (View API) page of the FAMEX system. At the top, there is a navigation bar with options like &#34;首页&#34; (Home), &#34;我的&#34; (My), &#34;资产&#34; (Assets), etc. Below the navigation bar, there is a section labeled &#34;查看API&#34; with a search bar. At the bottom, there are several columns including &#34;关于我们&#34; (About Us), &#34;系列产品&#34; (Product Series), &#34;服务支持&#34; (Service Support), &#34;新手学堂&#34; (Newbie Classroom), and &#34;社区&#34; (Community), each containing relevant information and icons." mime="image/png" scale="1.000000" src="ByBlbaH7ro0uvOxGiJtl8dIZg7d"/></td></tr><tr><td>修改API<img name="image.png" alt="The image shows a webpage interface of a platform with a purple and white color scheme. The left sidebar has options like &#34;API/Key Management&#34;, &#34;API Key&#34;, &#34;API Management&#34;, etc. The main content area displays &#34;修改APIKey&#34; (Modify APIKey) with input fields for &#34;API Key&#34; and &#34;Secret Key&#34;, and a &#34;获取验证码&#34; (Get Verification Code) button below. At the bottom, there are sections such as &#34;关于我们&#34; (About Us), &#34;系列产品&#34; (Product Series), &#34;服务支持&#34; (Service Support), and &#34;新手学堂&#34; (Newbie Hall), along with social media icons." mime="image/png" scale="1.000000" src="UT7LbICEoo2ebExQ56Wlkw3igdn"/></td><td>买币<b>三个板块</b>的出售购买<img name="image.png" alt="The image shows a webpage interface of a platform, likely related to cryptocurrency trading. On the left side, there are sections for &#34;Buy&#34; with fields like &#34;Self-Pay&#34; and &#34;Expected to Receive&#34; both set to 0, and a &#34;Payment Method&#34; dropdown. Below, &#34;Choose Service Provider&#34; is set to &#34;Alchemy Pay&#34; with a note about手续费. On the right, &#34;Payment Details&#34; includes &#34;Alchemy Pay&#34; and &#34;Alchemy Pay&#34; again, along with a &#34;Confirm&#34; button. At the bottom, &#34;Quick Buy Flow&#34; is displayed. This interface is part of the &#34;Web校验交互优化&#34; context, possibly illustrating a payment or buy flow scenario." mime="image/png" scale="1.000000" src="Hcg1bdCtNo2C4ixdPczlc4bwgQe"/></td><td></td><td></td></tr><tr><td>登录<img name="image.png" alt="The image shows the login page of FameEX. On the left, there is a &#34;扫码登录&#34; (Scan to Login) section with a QR code. In the middle, there is a &#34;登录FameEX&#34; (Login FameEX) section, which includes input fields for username (email or phone number) and password, a &#34;忘记密码?&#34; (Forgot Password?) link, and a purple &#34;登录&#34; (Login) button. Below the input fields, there are social login options for Google, WeChat, and Apple. This page is part of the Web校验交互优化 (Web Verification Interaction Optimization) mentioned in the document, which includes login and other verification scenarios." mime="image/png" scale="1.000000" src="XcyBbAokNokwvkxif2jlAwZxghb"/></td><td>注册<img name="image.png" alt="The image shows the registration page of FameEX. On the left, there is a gift box with a ribbon and the text &#34;注册立享最高$1000现金&#34; (Register and get up to $1000 in cash). Below it, there&#39;s a note &#34;完成新手任务，100%中奖&#34; (Complete new user tasks, 100% win). On the right, the text &#34;欢迎来到FameEX&#34; (Welcome to FameEX) is displayed, followed by input fields for email, password, and other registration information. At the bottom, there are social media icons for Google, WeChat, and Apple." mime="image/png" scale="1.000000" src="BGw3bIyj5o0FPwxyDdYlRtchgCb"/></td><td>忘记密码<img name="image.png" alt="The image shows a webpage with a &#34;Reset Password&#34; title. There is a text input field labeled &#34;Enter new password&#34; and a &#34;Next&#34; button below it. At the bottom of the page, there are sections including &#34;About Us&#34;, &#34;Series Products&#34;, &#34;Service Support&#34;, &#34;Newbie Classroom&#34;, and &#34;Community&#34;, each with corresponding links and icons. The webpage has a blue and white color scheme, and there is a purple button in the top right corner. This image is related to the context of password reset in the login/registration scenario of the Web校验交互优化." mime="image/png" scale="1.000000" src="MUxcbHsc1oYfQdx4dE0lwOrMgIb"/></td><td></td></tr></tbody></table>

  - **其他说明**

    <table><colgroup><col/><col/><col/></colgroup><thead><tr><th>场景</th><th>当前页面</th><th>新流程</th></tr></thead><tbody><tr><td>修改邮箱</td><td><img name="image.png" alt="The image shows the current &#34;Modify Email&#34; page interface. It displays the original email address &#34;sis****e@globaldev.info&#34; and a &#34;Get Verification Code&#34; button next to it. There is a field for entering the new email address and another &#34;Get Verification Code&#34; button below. At the bottom, there is a &#34;Modify&#34; button. The top of the page has a note stating &#34;Modify email for 24 hours after modification is prohibited.&#34; This page is part of the current process for modifying email, which only verifies the new binding target (i.e., whether the current user owns the new email) and uses the four-state verification code interaction (get → send in progress → sent countdown → resend)." mime="image/png" scale="1.000000" src="DKrdbfs0rome7sxML8alAXIqgLf"/></td><td rowspan="4"><ol><li seq="1">新流程看<a href="https://qfglxo2m3dc.sg.larksuite.com/wiki/Up13w4Tv9ijRZrkxagRlG4kygfd#share-B910dYFr0oWAVVxMmo2lF9JCgeP">原型图交互</a></li><li>当前页面（绑定/换绑表单）只负责验证"新绑定目标"本身——即验证当前用户确实拥有这个新邮箱/新手机，所以页面上只保留对应的新邮箱/手机输入框 + 一个验证码字段，走获取验证码的四态交互（获取→发送中→已发送倒计时→重新发送）。<ul><li>账户身份的安全校验（证明操作者是账户所属者）统一放到提交通过后的弹窗里完成，具体校验方式取决于账户当前已绑定了什么：<ul><li>修改邮箱 / 修改手机（已有旧联系方式可用）：弹窗是 GA + 邮箱/手机（如都绑定可切换）</li><li>绑定手机（首次绑定，账户目前只有 邮箱）：弹窗是单一 邮箱 校验（固定，不可切换）</li><li>绑定邮箱（首次绑定，但已有手机+GA可用）：弹窗是 GA + 手机（固定，不可切换）</li><li>以上举例只是其中说明，根据<a href="https://qfglxo2m3dc.sg.larksuite.com/wiki/Up13w4Tv9ijRZrkxagRlG4kygfd#share-J1DQd59h6o9osDxGFU5lVyrpgIc">验证方法优先级</a>判断</li></ul></li></ul></li></ol></td></tr><tr><td>绑定邮箱</td><td><img name="image.png" alt="The image shows the &#34;绑定邮箱&#34; (Bind Email) interface. It has a text input box labeled &#34;请输入邮箱地址&#34; (Enter Email Address). Below, there are two sections: &#34;邮箱验证码&#34; (Email Verification Code) with &#34;获取验证码&#34; (Get Verification Code) on the right, and &#34;手机验证码&#34; (Mobile Verification Code) with &#34;获取验证码&#34; (Get Verification Code) on the right. At the bottom, there is a &#34;绑定&#34; (Bind) button. This interface is related to the Web校验交互优化 context, which mentions binding email as one of the account identity verification methods." mime="image/png" scale="1.000000" src="Pwdlb7yNcoQOVVxBcxIlWulvgsd"/></td></tr><tr><td>修改手机</td><td><img name="image.png" alt="The image shows the &#34;修改手机号&#34; (Modify Phone Number) interface. It displays a phone number &#34;152****9510&#34; and a prompt that modifying the phone number is prohibited for 24 hours. There are two sections: &#34;原手机号验证码&#34; (Original Phone Number Verification Code) with &#34;获取验证码&#34; (Get Verification Code) and &#34;输入新手机号验证码&#34; (Enter New Phone Number Verification Code) with &#34;获取验证码&#34; (Get Verification Code). The country code &#34;+886&#34; is selected for the new phone number input field, and there is a &#34;修改&#34; (Modify) button at the bottom." mime="image/png" scale="1.000000" src="YfCVbjyf2o4X0ex2NZMlc8cYgQd"/></td></tr><tr><td>绑定手机</td><td><img name="image.png" alt="The image shows the interface for binding a new phone number. It has a purple background with the title &#34;绑定手机号&#34; (Bind Phone Number) at the top. There is a dropdown menu set to &#34;+886&#34; for selecting the country code, followed by a field to &#34;请输入新手机号&#34; (Please enter the new phone number). Below that, there is a field to &#34;输入新手机验证码&#34; (Enter new phone verification code) with a &#34;获取验证码&#34; (Get Verification Code) button next to it. Further down, there is a &#34;谷歌验证码&#34; (Google Verification Code) field, and at the bottom, a &#34;绑定&#34; (Bind) button." mime="image/png" scale="1.000000" src="UDjdbiRfOo5alBx8EZzlUj8TgMc"/></td></tr></tbody></table>

## 没有收到验证码引导

<grid>
<column width-ratio="0.523910">
![The image shows a user interface for the "没有收到验证码？" (No Verification Code Received?) prompt. It has a "邮箱" (Email) tab selected, with text stating that the email verification code has been sent to the email address. Below, there are three steps: checking if the email is in the spam folder, ensuring the email address is correct, and noting the email may delay, with a 10-minute wait recommended. At the bottom, there is a purple "已知晓" (Acknowledged) button and a headset icon. This relates to the context about not receiving a verification code and the corresponding guidance.](https://feishu.cn/file/OdvcboGVTobxkMxx5ralDygNgje)
</column>
<column width-ratio="0.476090">
![The image shows a user interface for the "没有收到验证码?" (No Verification Code Received?) prompt. It has a "手机" (Phone) tab selected, with a message stating that a SMS verification code has been sent to the phone and providing steps: check for phone欠费 (bills), confirm the message isn't filtered, verify the phone number, retry in 10 minutes, and try another number. There are a lock icon and a "已知晓" (Acknowledged) button at the bottom. This relates to the context about not receiving a verification code and the fixed display of the prompt below the verification input area.](https://feishu.cn/file/SvVKb96hFokllJxdANalqAMrgac)
</column>
</grid>

### 触发时机与展示位置

- 入口固定展示在验证码输入区域下方
- **一个验证场景只展示一个入口**，不按字段重复出现（例如"邮箱+手机双重校验"场景，两个验证码框都存在，但【没有收到验证码？】只出现一次，不重复放两份）

### 弹窗结构

<table><colgroup><col/><col/></colgroup><thead><tr><th>区域</th><th>内容</th></tr></thead><tbody><tr><td>标题</td><td><ul><li>没有收到验证码？（固定文案，不随场景变化）</li></ul></td></tr><tr><td>Tab</td><td><ul><li>邮箱 / 手机，<b>统一都展示两个 Tab</b>，不因当前场景只涉及单一方式就隐藏另一个（避免前端为"单Tab/双Tab"做两套样式）</li></ul></td></tr><tr><td>默认选中 Tab</td><td><ul><li>根据当前实际请求的验证码类型自动定位：请求的是邮箱验证码，默认高亮"邮箱"Tab；请求的是手机验证码，默认高亮"手机"Tab。用户可手动点击切换查看另一个 Tab 的内容</li><li>邮箱+手机 校验场景下，默认展示邮箱Tab内容</li></ul></td></tr><tr><td>正文说明</td><td><ul><li>按 Tab 区分文案，见下方"<a href="https://qfglxo2m3dc.sg.larksuite.com/wiki/Up13w4Tv9ijRZrkxagRlG4kygfd#share-FqvudNo0WoVhGBxJoJ0lPlLNgqb">文案规则</a>"</li></ul></td></tr><tr><td>底部操作</td><td><ul><li>左：客服 icon；右：已知晓按钮</li></ul></td></tr></tbody></table>

### 文案规则

**邮箱 Tab：**

电子邮件验证码已发送至您的电子邮箱。如多次尝试仍未获取验证码，请采用以下步骤：

- 检查邮件是否位于邮箱垃圾箱中。
- 确保您填写的邮箱地址无误。
- 邮件可能会延迟几分钟，请过10分钟后再试。

**手机 Tab：**

短信验证码已发送至您的手机。如多次尝试仍未获取验证码，请采用以下步骤：

- 检查您的手机是否欠费。
- 请查看消息是否位于过滤信息中。
- 请确认您填写的手机号无误。
- 请在10分钟后重试。
- 请尝试其他手机号。



### 交互说明

- 点击【客服 icon】：打开客服聊天框
- 点击【已知晓】：关闭当前引导弹窗，不产生其他作用
- 点击 Tab：仅切换弹窗内正文内容，不影响背后验证页面/表单状态



### 边界情况

- 若用户仅绑定单一验证方式（如只绑定了邮箱），弹窗依然展示邮箱/手机两个 Tab；点击"手机"Tab 时展示手机对应的排查说明（通用引导内容，不涉及该用户是否绑定手机这一状态判断）。



## 验证码请求倒计时优化

### 交互

- 交互动态参考[原型图](https://qfglxo2m3dc.sg.larksuite.com/wiki/Up13w4Tv9ijRZrkxagRlG4kygfd#share-T1D6dv11GoQicGxPZS4lWIJzgqc)

<table><colgroup><col/><col/><col/><col/></colgroup><thead><tr><th><b>状态</b></th><th><b>按钮文案</b></th><th><b>是否可点击</b></th><th><b>触发 / 退出条件</b></th></tr></thead><tbody><tr><td>初始态</td><td>获取验证码</td><td>可点击</td><td><ul><li>页面/弹窗打开后的默认态；点击后进入加载态</li></ul></td></tr><tr><td>加载态</td><td>三个跳动圆点动画</td><td>不可点击（置灰）</td><td><ul><li>点击「获取验证码」后触发，请求返回成功后进入已发送态；请求失败进入异常态</li></ul></td></tr><tr><td>已发送态</td><td>倒计时提示 + icon图标</td><td>不可点击（置灰）</td><td><ul><li>请求成功后触发，倒计时期间维持；倒计时归零后进入重新发送态 </li></ul></td></tr><tr><td>重新发送态</td><td>重新发送</td><td>可点击</td><td><ul><li>倒计时结束后触发；点击后回到加载态，循环</li></ul></td></tr></tbody></table>

**补充说明：**

- 加载态、已发送态按钮均不可点击，需在代码层面禁用 onclick，避免用户重复触发请求。
- 已发送态的 icon 图标提示文案为：验证码有效期为10分钟

  - 其中 {n} 需每秒动态刷新，不是发送时刻的固定文案。
  - Web 端：鼠标**悬浮** icon 图标显示 tooltip，移出鼠标即隐藏。
  - App 端：**点击 icon 图标显示** tooltip；关闭方式：**再次点击图标** 或 **点击页面其他区域** 关闭，避免遮挡其他操作 。



### APP 端验证码自动填充重复问题修复

- **来源**:需求内审时 Lucky 提出的体验问题。本次需求即围绕验证码交互优化,该问题也发生在验证码相关入口,故一并纳入本次修复,避免遗漏。
- **问题现象**:APP 端用户收到短信验证码后,点击「快捷填充」(一键把收到的验证码填入输入框)时，个别地方验证码被**重复填入两遍**(如实际为 `1234`,填充后变成 `12341234`)。
- **涉及范围**:所有收**短信验证码**的输入入口。研发需排查 APP 端全部短信验证码输入框的自动填充逻辑。
- **修复要求(预期结果)**:

  - 点击快捷填充填充后,输入框内容 = 验证码本身(如 6 位),**只填一次,不重复、不叠加**。
  - 若输入框已有内容,填充应为**替换**而非在原内容后追加。
  - 填充后验证码位数正确,可正常通过校验。



### 状态联动规则

- 邮箱/手机可切换的场景中，切换验证方式后，两个字段的倒计时应各自独立计时、互不影响；切回原方式时应保留其原有倒计时状态，而非重置。
- 页面刷新或用户离开页面重新进入时，倒计时状态由后端返回 冷却截止时间戳 ，前端据此计算剩余秒数并恢复已发送态，避免用户通过刷新页面绕过频率限制。



### 限频类失败

- **定义：**平台因触发频繁/上限策略主动拦截本次验证码请求（区别于[服务异常](https://qfglxo2m3dc.sg.larksuite.com/wiki/Up13w4Tv9ijRZrkxagRlG4kygfd#share-NiindEifVoMr6ExEZEblvlCfgQe)）。对按钮做冷却或禁用处理，避免用户无效重复点击继续触发限频。
- **交互：**命中频繁/上限时先 **Toast 提示原因；禁用期间再次点击不发起后端请求，**由前端拦截并再次 Toast 告知。冷却时长与截止时间以后端返回为准(PR-02235 Toast提示告知用户详细原因以及时间) 。



### 异常场景

- **服务异常类：网络异常或服务端异常**时，按钮应从加载态回退到初始态，并给出【调用异常相关code】提示，而非停留在加载动画。

  - 相关需求prd：<cite doc-id="VEh4dzNDVoAQ2Xx4eMelxtl7g8b" file-type="docx" title="PR-02235 【用户端】 验证码请求频繁/错误提示优化" type="doc"></cite>

| **状态** | **按钮文案** | **是否可点击** | **触发 / 退出条件** |
|-|-|-|-|
| 异常态（服务失败） | 保持原文案（获取验证码/重新发送） | 可点击 | 命中服务异常后回退，可立即重试；不进倒计时 |



# 埋点

<table><colgroup><col/><col/><col/><col/></colgroup><thead><tr><th>事件名</th><th>触发时机</th><th>关键参数</th><th>备注</th></tr></thead><tbody><tr><td>verification_scene_view</td><td>验证场景页面/弹窗曝光</td><td>interaction_type：page / popup<br/>verify_methods：["ga","email","sms"]</td><td><ul><li><code>interaction_type</code>：page 还是 popup？用来区分是全页面验证（登录 / 注册）还是弹窗验证（提币 / 改设置）</li><li><code>verify_methods</code>：页面上展示了哪几种验证方式，比如 ["ga", "email"] 就是 GA + 邮箱</li></ul></td></tr><tr><td>click_get_code</td><td>点击「获取验证码」或「重新发送」</td><td>method：email / sms<br/>button_state：initial / resend<br/>attempt_count：第几次获取</td><td><ul><li><code>method</code>：用户要的是邮箱验证码还是短信验证码</li><li><code>button_state</code>：initial 是第一次点，resend 是倒计时结束了又重新点</li><li><code>attempt_count</code>：这个场景下第几次获取了，1 就是第一次，3 就是点了三次还没拿到</li></ul></td></tr><tr><td>code_send_result</td><td>验证码接口返回</td><td>method：email / sms<br/>result：success / fail<br/>fail_reason：rate_limit / service_error / network_error / timeout / other<br/>fail_code：错误码<br/>duration_ms：请求耗时</td><td><ul><li><code>method</code>：同上</li><li><code>result</code>：success 发出去了，fail 没发出去</li><li><code>fail_reason</code>：失败的具体原因 ——rate_limit（被限频拦了）、service_error（服务端挂了）、network_error（网络不通）、timeout（超时）</li><li><code>fail_code</code>：后端返回的错误码</li><li><code>duration_ms</code>：从点按钮到接口返回花了多少毫秒</li><li><code>attempt_count</code>：第几次请求</li></ul></td></tr><tr><td>hit_rate_limit</td><td>命中限频策略</td><td>method：email / sms<br/>limit_type：触发限频<br/>cooldown_seconds：冷却时长</td><td><ul><li><code>method</code>：哪个方式触发了限频</li><li><code>limit_type</code>：IP/ 国家 / 业务 / UID / 60s冷却</li><li><code>cooldown_seconds</code>：要等多少秒才能再发</li></ul></td></tr><tr><td>switch_channel</td><td>切换验证方式</td><td>from_method：email / sms<br/>to_method：email / sms </td><td><ul><li><code>from_method</code> / <code>to_method</code>：从哪种方式切到哪种方式，比如邮箱 → 手机</li></ul></td></tr><tr><td>view_no_code_guide</td><td>打开「没有收到验证码？」引导弹窗</td><td>current_method：email / sms</td><td><ul><li><code>current_method</code>：用户当前正在等邮箱验证码还是短信验证码</li></ul></td></tr><tr><td>code_verify_submit</td><td>提交验证码校验</td><td>method：email / sms / ga</td><td><ul><li><code>method</code>：校验的是邮箱 / 手机 / GA</li></ul></td></tr><tr><td>code_verify_result</td><td>校验结果返回</td><td>method：email / sms / ga<br/>verify_mode：single / double<br/>result：success / fail<br/>fail_reason：wrong_code / expired / other</td><td><ul><li><code>method</code>：同上</li><li><code>verify_mode</code>：同上</li><li><code>result</code>：success 通过了，fail 没通过</li><li><code>fail_reason</code>：wrong_code 输错了，expired 过期了</li></ul></td></tr></tbody></table>

# 验收标准

| 回归项 | 说明 |
|-|-|
| 登录流程全链路 | 登录 → 验证码校验 → 登录成功/失败，交互改动后链路完整 |
| 注册流程全链路 | 注册 → 验证码校验 → 注册成功/失败，链路完整 |
| 提币流程全链路 | 提币 → 双重校验 → 提币成功/失败，链路完整 |
| 修改安全设置全链路 | 修改邮箱/手机/GA → 校验 → 修改成功/失败，链路完整 |
| GA 校验不受影响 | 本次不涉及 GA 交互改动，GA 校验在登录/提币等场景下正常使用 |
| 后台验证码下发不受影响 | 短信/邮件下发功能正常，不因前端交互改动导致下发中断 |
| **验收项** | **预期结果** |
| Web 端注册页面「切换验证方式」按钮文案 | 替换为「没收到验证码？尝试邮箱注册」 |
| 点击「没收到验证码？尝试邮箱注册」 | 跳转回注册页面（输入注册信息的第一步），不保留当前已填写的验证码 |
| App 端注册页面 | 保持现有「切换注册方式引导」逻辑不变，不受本次改动影响 |
| 多语言覆盖 | 该引导文案需在所有支持语言下正确展示，无 hardcode 中文 |
| Web 端登录页面移除「切换验证方式」入口 | 登录校验区域不再展示「切换验证方式」按钮或文字链 |
| App 端登录页面 | 保持现有登录校验交互不变，不新增也不删除任何入口 |
| 回归：登录流程完整性 | 移除入口后，登录流程（输入验证码 → 校验 → 登录成功/失败）功能正常，不受影响 |
| 注册场景：仅展示注册时选择的单一验证方式 | 只展示邮箱验证码字段，不出现 GA 或手机选项 |
| 登录场景：默认按 GA > 邮箱 > 手机取已绑定的最高优先级 | 默认展示 GA 校验 |
| 登录场景：仅绑定邮箱 + 手机 | 默认展示邮箱校验 |
| 登录场景：仅绑定手机 | 默认展示手机校验 |
| 提币场景：强制双重校验，取已绑定方式中的前两位 | 展示 GA + 邮箱两种校验 |
| 提币场景：仅绑定两种方式 | 展示邮箱 + 手机双重校验 |
| 提币场景：仅绑定一种方式（边界） | 提示用户需绑定至少两种验证方式方可提币（或走现有业务兜底策略） |
| 其他敏感操作：单绑走单一校验 | 展示邮箱单一校验 |
| 其他敏感操作：双绑及以上走双重校验 | 展示 GA + 邮箱双重校验 |
| 切换验证方式：各方式独立倒计时 | 邮箱仍显示剩余约 30s，不被重置 |
| 修改邮箱：表单页仅验证新邮箱 | 表单页只包含「新邮箱地址」输入框 + 「邮箱验证码」字段 + 获取验证码按钮 |
| 修改手机：表单页仅验证新手机 | 表单页只包含「新手机号」输入框 + 「短信验证码」字段 + 获取验证码按钮 |
| 绑定手机（首次，仅有邮箱）：提交后弹窗 | 弹窗展示邮箱单一校验（不可切换） |
| 绑定邮箱（首次，有手机+GA）：提交后弹窗 | 弹窗展示 GA + 手机双重校验（固定，不可切换） |
| 修改邮箱（有旧邮箱可用）：提交后弹窗 | 弹窗展示 GA + 邮箱/手机双重校验（有切换入口） |
| 修改手机（有旧手机可用）：提交后弹窗 | 弹窗展示 GA + 邮箱/手机双重校验（有切换入口） |
| 表单提交 → 弹窗流转 | 表单校验通过 → 关闭表单 → 弹出安全校验弹窗 → 弹窗内校验通过 → 修改/绑定生效 |
| 弹窗内取消或校验失败 | 修改/绑定操作不生效，可重新发起 |
| 入口展示位置 | 固定展示在验证码输入区域下方 |
| 入口在双重校验场景下只出现一次 | 邮箱+手机双验证码框场景，「没有收到验证码？」只展示一个入口 |
| 弹窗标题 | 固定为「没有收到验证码？」 |
| Tab 展示 | 始终展示「邮箱」「手机」两个 Tab，不因当前仅涉及单一方式而隐藏 |
| 默认选中 Tab | 请求邮箱验证码时默认选中「邮箱」Tab；请求手机验证码时默认选中「手机」Tab；邮箱+手机场景默认选中「邮箱」 |
| 点击 Tab 切换 | 仅切换弹窗内正文内容，不改变背后页面/表单的验证方式或状态 |
| 邮箱 Tab 文案 | 展示邮箱排查引导文案（检查垃圾箱、确认地址、延迟等待 10 分钟） |
| 手机 Tab 文案 | 展示手机排查引导文案（欠费检查、过滤信息、确认号码、10 分钟后重试、尝试其他号码） |
| 点击「客服 icon」 | 打开客服聊天入口（H5 内嵌客服 / App 调起客服） |
| 点击「已知晓」 | 关闭引导弹窗，不触发其他操作 |
| 仅绑定单一方式时的边界 | 用户只绑定邮箱，弹窗仍展示「手机」Tab 及通用排查说明，不因无手机绑定而隐藏 |
| 初始态：按钮文案「获取验证码」，可点击 | 页面/弹窗打开后默认状态 |
| 加载态：点击后按钮变为三个跳动圆点动画，置灰不可点击 | 请求发出后立即进入加载态 |
| 加载态按钮禁用验证 | 加载态期间点击按钮不发起新请求（前端 onclick 禁用） |
| 已发送态：请求成功后按钮变为「验证码已发送」+ icon 图标，置灰不可点击 | 倒计时期间维持此状态 |
| icon 图标 Tooltip（Web） | 鼠标悬浮 icon 显示「{n}秒后可重新发送验证码，有效期为10分钟」，{n} 每秒动态刷新；移出鼠标即隐藏 |
| icon 图标 Tooltip（App） | 点击 icon 显示 Tooltip；再次点击 icon 或点击页面其他区域关闭 |
| 重新发送态：倒计时归零后按钮变为「重新发送」，可点击 | 点击后回到加载态，重新走完整四态流程 |
| 页面刷新/离开再返回时倒计时恢复 | 前端根据后端返回的冷却截止时间戳计算剩余秒数，恢复已发送态及正确剩余时间 |
| 切换验证方式后倒计时独立 | 邮箱倒计时 30s → 切到手机获取验证码 → 手机独立 60s 倒计时 → 切回邮箱仍显示剩余 \~30s |
| 限频后按钮置灰并禁用 | 按钮变为不可点击状态，冷却时长以后端返回为准 |
| 禁用期间再次点击 | 前端拦截，不发起请求，再次 Toast 告知原因及剩余时间 |
| 冷却结束后按钮恢复 | 按钮从置灰恢复到可点击态，文案恢复为「重新发送」 |
| 限频类型区分展示 | IP 限频 / UID 限频 / 60 秒限频 有区分性提示，用户和客服能看懂被拦截原因 |
| 网络异常 | 按钮从加载态回退到初始态（或重新发送态），Toast 提示网络异常，恢复可点击 |
| 服务端返回异常 | 按钮从加载态回退，Toast 提示错误信息（含错误码），恢复可点击 |
| 服务异常不进倒计时 | 确认服务失败后不进入 60 秒倒计时，用户可立即重试 |
| 埋点上报 | 均有数据上报 |
