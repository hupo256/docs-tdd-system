---
source: https://qfglxo2m3dc.sg.larksuite.com/docx/Zj7Dd8cdIorON3xmYSdlI94qg1c
documentId: Zj7Dd8cdIorON3xmYSdlI94qg1c
revisionId: 1341
syncedAt: 2026-08-03T06:40:04.406Z
readOnly: true
---

<title>PR-02172 【登录注册】增加第三方（tg、facebook）</title>

# 一、 版本信息

<grid>
<column width-ratio="0.333333">
<callout emoji="⏰">
版本号：V_1.0.0
</callout>
</column>
<column width-ratio="0.333333">
<callout emoji="📆">
创建日期：2026-7-23
</callout>
</column>
<column width-ratio="0.333333">
<callout emoji="👮">
审核人
</callout>
</column>
</grid>

# 二、 变更日志（必须填）

<table><colgroup><col/><col/><col/><col/></colgroup><tbody><tr><td><b>时间</b></td><td><b>版本号</b></td><td><b>变更人</b></td><td><b>主要变更内容</b></td></tr><tr><td>2026-7-23</td><td>V_1.0.0</td><td>
<cite type="user" user-id="ou_f7ba9a4140c817669b9c90a22d7f757b" user-name="Sissie"></cite>
</td><td>新增</td></tr><tr><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td></tr></tbody></table>

# 三、 评审记录（必填项）

<table><colgroup><col/><col/><col/></colgroup><tbody><tr><td>评审<b>时间</b></td><td>参与人员</td><td><b>结论</b></td></tr><tr><td>2026-07-30</td><td>
<cite type="user" user-id="ou_9673ca5947df46dca27550d9f88012c6" user-name="George"></cite>

<cite type="user" user-id="ou_f7ba9a4140c817669b9c90a22d7f757b" user-name="Sissie"></cite>

<cite type="user" user-id="ou_6e76055c146cbd51e1c0ef8793caef2b" user-name="Lucky"></cite>
</td><td>会议：<br/>https://qfglxo2m3dc.sg.larksuite.com/minutes/obsg49876j8d68e254ms5fh8?from_source=finish_recording<br/>结论：✔</td></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr></tbody></table>

# 四、 需求背景

当前平台已支持 Google、Apple、HiChat 三种第三方登录方式。为进一步提升用户注册与登录的便捷性，覆盖更广泛的用户群体，本期新增 Telegram 和 Facebook 第三方登录。

# 五、 需求范围与边界

## 5.1 本期范围

- 登录页/注册页新增 Telegram、Facebook 入口
- 三方授权、注册新账户、关联已有账户全流程
- 个人中心第三方账号管理（关联/解除关联/绑定状态展示）
- 后台展示：筛选、导出第三方绑定状态和关联历史。

# 六、竞品分析

<table><colgroup><col/><col/><col/></colgroup><thead><tr><th>竞品</th><th>截图</th><th>说明</th></tr></thead><tbody><tr><td>币安</td><td><grid><column width-ratio="0.200000">
<img name="image.png" alt="The image shows the login interface of Binance. At the top, there is the Binance logo and the word &#34;登录&#34; (Login). Below, there is a text input box labeled &#34;电子邮件/电话号码 (不含国家代码)&#34; (Email/Phone Number without country code). A yellow &#34;登录&#34; (Login) button is placed below the input box. Underneath, there are options to &#34;继续使用密码&#34; (Continue using Password), &#34;继续使用 Google&#34; (Continue using Google), &#34;继续使用 Apple&#34; (Continue using Apple), and &#34;继续使用 Telegram&#34; (Continue using Telegram). This interface is related to the context of the login and registration project, which mentions adding third-party login methods like Telegram and Facebook." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=ZGRkN2I4Mzg1ZDdkYzI4YTZlYTU0ZmI4OWFhOTdmYTRfNzQ2NjMwOTkxOTdjZTBlNDc1MTZkYzAwN2U1NWE5OTFfSUQ6NzY2NTE4NjIzODE3Mjg0Mzc0MV8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.681606" src="prd-assets/PRD-IMG-001.png"/>
</column><column width-ratio="0.200000">
<img name="image.png" alt="The image shows a login interface for Telegram. At the top, there is a blue icon with a white &#34;T&#34; and the text &#34;连接 Telegram&#34;. Below, it states &#34;点击下方“继续”按钮后，您将被重定向到 Telegram 页面以完成授权&#34; (Click the &#34;Continue&#34; button below to be redirected to the Telegram page to complete the authorization). There is a yellow &#34;继续&#34; button. At the bottom, there are options to continue using Google, Apple, or Telegram, with &#34;创建新账户&#34; (Create New Account) and &#34;无法登录?&#34; (Can&#39;t Login?) links." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=NWRhNjBjODI1M2I5YTJjN2FjMDE1YjlhOTBmMzkzNDVfOWVlYzE4YzYzNzYyYTA1NDQyYjExMmVlNTE3ZDk2MWFfSUQ6NzY2NTE4NjI5Njk3Mjk4ODEyN18xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.246788" src="prd-assets/PRD-IMG-002.png"/>
</column><column width-ratio="0.200000">
<img name="image.png" alt="The image shows a login interface related to Telegram and Binance. It displays a webpage with a login prompt asking to use the Telegram account to bind with the Binance account, and a phone number input field set to +852. There is a red circle highlighting a &#34;B&#34; icon, and a yellow button labeled &#34;登录&#34; (Login). This interface is part of the竞品分析 (Competitor Analysis) section in the document, which compares different platforms&#39; login and account binding processes." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=ZDYxM2ExYjQ3YzkwYzQ3MjQ4YjQxMDQ0OGQ2NjUyMTVfMmMxZjFmOThhN2MwZGIzMGExZGE2MDQyZDE5ZjhmYTBfSUQ6NzY2NTE4NjQyMjM3MDU4NjM0MV8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.246788" src="prd-assets/PRD-IMG-003.png"/>
</column><column width-ratio="0.200000">
<img name="image.png" alt="The image shows a login interface related to Telegram and Binance. It displays a pop-up window with a blue and red icon, and text indicating &#34;登录使用您的Telegram账号与accounts.binance.com关联&#34; (Login using your Telegram account to associate with accounts.binance.com). There is a yellow &#34;登录&#34; (Login) button, and a message below stating &#34;请以国际格式输入您的手机号码，我们将通过Telegram向您的手机发送确认信息&#34; (Please input your phone number in international format, we will send a confirmation message via Telegram). The background shows a Telegram app interface with a blue icon." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=YzA2MGM3NDM5YWI0NDViMjk3NTY0ODhhMGQzNzQwNDFfZTE0ODJlMjEwMzIwZDNmZTQ4NDU1ZDA5MDdiMWU0Y2VfSUQ6NzY2NTE4NjYzNjEyNjAzMTU4MF8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.246788" src="prd-assets/PRD-IMG-004.png"/>
</column><column width-ratio="0.200000">
<img name="image.png" alt="The image shows a login interface related to Telegram and Binance. It displays a webpage with a URL starting with &#34;accounts.binance.com&#34; and a red &#34;B&#34; icon, indicating a connection to Binance. There is a yellow &#34;授权&#34; (authorize) button, and a checkbox for &#34;允许所有通过Telegram向您发送消息&#34; (Allow all messages from Telegram). Below, there are &#34;登录&#34; (login) and &#34;取消&#34; (cancel) buttons. This interface is part of the竞品分析 (competitor analysis) section, which compares different platforms&#39; login and account binding processes." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=MTA2YzFkNzQwMDI0MjdmOTlmYzE0YTM2MzY2MzRhN2RfOGMyN2RjMDZkNDIzZDcyMDhhODNmNmMwNjgxY2I3NjJfSUQ6NzY2NTE4Njg1MTE1MTIwNDA3M18xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.246788" src="prd-assets/PRD-IMG-005.png"/>
</column></grid><grid><column width-ratio="0.333333">
<img name="image.png" alt="The image shows a Binance login page. At the top, there&#39;s a question: &#34;你已经拥有币安账户了吗?&#34; (Do you already have a Binance account?). Below, there are two options: &#34;创建一个新的币安账户&#34; (Create a new Binance account) and &#34;关联现有币安账户&#34; (Link existing Binance account). On the right side, there are &#34;接受 Cookie 并继续&#34; (Accept Cookies and Continue) and &#34;拒绝其他 Cookie&#34; (Reject Other Cookies) buttons. This page is related to the竞品分析 (Competitor Analysis) section, which compares Binance&#39;s login process with others." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=ZTQyM2RhOGI2ZWQwY2NiZTVjMGMwNWQ0ZTVmNjdjMTVfOTNmNGIzMGRlY2NmZWIxODg3OTBkMTMyZmVmZjMxNmJfSUQ6NzY2NTE4NjkxMDI3NzE3NzA1NF8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.246788" src="prd-assets/PRD-IMG-006.png"/>
</column><column width-ratio="0.333333">
<img name="image.png" alt="The image shows the &#34;Create Binance Account&#34; page of the Binance platform. The page has a dark background with a yellow &#34;Register&#34; button. There is a checkbox labeled &#34;I agree to the terms and conditions&#34; below the input field for &#34;Email/Phone Number (without country code)&#34;. On the right side, there is a &#34;Accept Cookies&#34; button and a &#34;Do not accept Cookies&#34; option. This image is related to the竞品分析 (Competitor Analysis) section of the document, which compares Binance&#39;s account creation process with other platforms." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=YTg4OTUzZDI2NDg2MzdmMDBmZDRlY2YzN2QxYzQ1NTJfMjc4ZjIzYmE2NGI3YjNiMjZkYmQwMzQyM2UyN2Q3NGJfSUQ6NzY2NTE4NjkzOTAzNzE1OTE0Ml8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.246788" src="prd-assets/PRD-IMG-007.png"/>
</column><column width-ratio="0.333333">
<img name="image.png" alt="The image shows the &#34;Associate Existing Account&#34; page of Binance. It has a dark background with a yellow header and a yellow &#34;Confirm&#34; button. There is a text input box labeled &#34;Enter phone number (without international dialing code)&#34;. The page is used for users to associate their existing accounts with third-party accounts, and the context mentions that Binance&#39;s login registration scheme is similar to the current plan." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=OGE1YjI4YjI3NjY2OWFmYWQyOTg0YWExNzUzOGIwNjhfZWUwOTQ2ZDdkMzBmNTBhOTVhZTk1ZjRkMjMzZDg5MGRfSUQ6NzY2NTE4Njk5NDU4NjIxMDAxMV8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.246788" src="prd-assets/PRD-IMG-008.png"/>
</column></grid></td><td>多渠道并列展示，未绑定时统一跳转“绑定/创建账户”选择页，逻辑与本次方案一致</td></tr><tr><td>bitget</td><td><grid><column width-ratio="0.250000">
<img name="image.png" alt="The image shows the login interface of a platform. At the top, there is a &#34;登入&#34; (Login) title, with &#34;註冊&#34; (Register) in blue next to it. Below, there are two login options: &#34;電子郵件/手機號碼&#34; (Email/Phone Number) and &#34;子帳戶&#34; (Sub-Account). The main input field is labeled &#34;電子郵件/手機號碼 (不含國家代碼)&#34; (Email/Phone Number, without country code). There is a &#34;下一步&#34; (Next) button below the input field. At the bottom, there are four icons: Google, Apple, Telegram, and a &#34;連接錢包&#34; (Connect Wallet) icon with a white background and blue elements." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=YTA4OWEyYjkyNTRkMmJiOGRlOTkyZGI3YzVjMzczZDRfOTNkNjkwNjVkZTlhMDdiOGU1NmIxYTA0Y2NhZDgyZjlfSUQ6NzY2NTE4NzY1NDIwMzcyMzQ4OF8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.914787" src="prd-assets/PRD-IMG-009.png"/>
</column><column width-ratio="0.250000">
<img name="image.png" alt="The image shows the login interface of Bitget, a竞品 (competitor) mentioned in the document. It displays a login window with a dark background, where a pop-up window is open, showing a URL starting with &#34;https://oauth.telegram.org&#34; and a Telegram logo. There are two red circles with numbers, possibly indicating key elements or steps. The interface includes text in Chinese, such as &#34;登录&#34; (Login) and &#34;下一步&#34; (Next Step), and there are buttons like &#34;登录&#34; (Login) and &#34;取消&#34; (Cancel). This screenshot is related to the竞品 analysis section, which compares Bitget&#39;s login process with other platforms like Binance and ins." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=ZWQxOGZlYmE4MGVlNzE2MTU4NmQ5NzhkZjk3ZDNhMzZfNjRmNjUxNDk5NzljNWM2ODEwMTE0ZmViMmJhNjY3ZjlfSUQ6NzY2NTI0OTIwMzkyODU2NzUxNl8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.300783" src="prd-assets/PRD-IMG-010.png"/>
</column><column width-ratio="0.250000">
<img name="image.png" alt="The image shows the login interface of Bitget. At the top, there is a &#34;登录&#34; (Login) title. Below it, there are input fields for username and password, with a &#34;下一步&#34; (Next) button. In the center, there is a grid of four icons, and a prompt &#34;请先输入右侧验证码&#34; (Please input the right captcha first) is displayed. On the right side, there are options to save cookies and a Telegram icon. This interface is related to the竞品分析 (Competitor Analysis) section in the document, which compares Bitget&#39;s login process with other platforms." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=Nzc0MWVmY2Y3NTBiYzkyODc2ZDcxOTBiYmNmYjUyNWNfNjgxNjhjMGQ2NDAzODQ0MTYwMTk5NDE2OGIwODU2MjhfSUQ6NzY2NTI0OTMzMTQ0MzY2NjY1Nl8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.300783" src="prd-assets/PRD-IMG-011.png"/>
</column><column width-ratio="0.250000">
<img name="image.png" alt="The image shows the Bitget login interface. At the top, there is a title &#34;連結您的 Bitget 帳戶&#34; (Connect Your Bitget Account). Below it, there are two buttons: &#34;登錄您的 Bitget 帳戶&#34; (Log in to Your Bitget Account) and &#34;註冊一個新的 Bitget 帳戶&#34; (Register a New Bitget Account). At the bottom right, there is a &#34;Link&#34; button with a blue icon. This interface is related to the竞品分析 (Competitor Analysis) section in the document, which compares Bitget&#39;s login process with other platforms like Binance, Bitget, and others." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=YjBkNjMwZmUyYjVjNzA1ZDk5OWVkMzQyYTNhMTM5ZWJfMzhiZDBlNTlhNGY3NmExMmFiMTIzY2ZmYmRiZWM0ZjBfSUQ6NzY2NTI0OTQ2NTkyMTYwNTM0NF8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.300783" src="prd-assets/PRD-IMG-012.png"/>
</column></grid><grid><column width-ratio="0.200000">
<img name="image.png" alt="The image shows the account creation page of Bitget. The background is black, and the text is white. At the top, there is a &#34;创建您的帳戶&#34; (Create Your Account) title. Below it, there are input fields for username, password, and captcha, with a &#34;下一步&#34; (Next) button at the bottom. This screenshot is related to the竞品分析 (Competitor Analysis) section in the document, which compares Bitget&#39;s account creation process with other platforms." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=Y2JiMDY0ZjI1NTcwYWE0OGViODEzZWEyMDJiNjNjNjlfNWVhMjk1MDQ5YTFkMDk0MTQ4NDUxZGZhMWJiZDViOTlfSUQ6NzY2NTI0OTU1OTc4NTg4NTQxNl8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.300783" src="prd-assets/PRD-IMG-013.png"/>
</column><column width-ratio="0.200000">
<img name="image.png" alt="The image shows the Bitget login page with a black background. At the top, there is a title &#34;連結您的 Bitget 帳戶&#34; (Connect Your Bitget Account). Below, there is a text input box labeled &#34;請輸入帳號或密碼&#34; (Please enter username or password) and a &#34;下一步&#34; (Next) button. At the bottom right, there are &#34;接受 Cookie&#34; (Accept Cookies) and &#34;取消接受&#34; (Reject Cookies) buttons, along with a &#34;Cookie 設定&#34; (Cookie Settings) link. This page is related to the竞品分析 (Competitor Analysis) section, which compares Bitget&#39;s login process with other platforms." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=MzQ2ZmMwNDNkZDA4OTkxMGI2OGU0M2E3YTFkNTg5NjlfYTQ3ZDczNTU2YmM4YzJkZDZjYzQwNGQ3NmViZjRlYTJfSUQ6NzY2NTI0OTUyNzQ4MjAxMTM1N18xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.300783" src="prd-assets/PRD-IMG-014.png"/>
</column><column width-ratio="0.200000">
<img name="image.png" alt="The image shows the password verification page of Bitget. The background is dark, and the text is in white. It displays the email &#34;jane@126.com&#34; and the password field. There is a &#34;下一步&#34; (Next) button below the password field. In the bottom right corner, there is a chat icon with the text &#34;Lark&#34; and &#34;小红书的一条消息&#34;. This image is related to the竞品分析 (Competitor Analysis) section of the document, which compares Bitget with other platforms like Binance, Bitget, and Ins." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=Mjg1YWQyYzM0MDhjN2VjZWI2YTM1MmFkNTYzNDBkMjRfZjliOTg0Mjc4YzZiMzRlMjk2ZTNjOTkwMmYyMWUwYTlfSUQ6NzY2NTI0OTgwNzQ5MzIyMjExOF8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.300783" src="prd-assets/PRD-IMG-015.png"/>
</column><column width-ratio="0.200000">
<img name="image.png" alt="The image shows the login interface of Bitget. The background is dark, and there is a &#34;验证密码&#34; (Verify Password) section with input fields for username and password. Below it, there is a &#34;安全提醒&#34; (Security Reminder) pop-up window with some text and two buttons: &#34;取消登录&#34; (Cancel Login) and &#34;登录&#34; (Login). This screenshot is part of the竞品分析 (Competitor Analysis) section, which compares Bitget&#39;s login process with other platforms like Binance, Bitget, and Ins, and mentions that Bitget&#39;s login process is consistent with Binance&#39;s." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=OGZhOWU5YjA0ZGE3N2I3NzVmYTBlYjRiYmEzMjdjZWVfMzU5ZTJjNGFlODBiZTNjYWUxNDhhNzZlNzhhYzhiNDFfSUQ6NzY2NTI1MDA5NzA4OTE3MTE3MF8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.300783" src="prd-assets/PRD-IMG-016.png"/>
</column><column width-ratio="0.200000">
<img name="image.png" alt="The image shows a screenshot of the Bitget login interface. A pop-up window titled &#34;安全验证&#34; (Security Verification) is displayed, containing fields for entering verification codes, with a &#34;确认&#34; (Confirm) button at the bottom. The background is dark, and there are some blurred elements like &#34;登录密码&#34; (Login Password) and &#34;登录&#34; (Login) visible. This screenshot is part of the竞品分析 (Competitor Analysis) section, comparing Bitget&#39;s login process with other platforms like Binance, Bitget, and Ins, where Bitget&#39;s security verification interface is presented as a key point." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=YTdlNDgwMzBmNmYxMDg3Y2NjNTk5NTMyYTRiYTRmYmFfZTkxOTI4Yjg0MDMwNGNkMzk0MDc1Y2I4NTFhYmZiNmZfSUQ6NzY2NTI1MDEzNDMyMTY0NzMzNl8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.300783" src="prd-assets/PRD-IMG-017.png"/>
</column></grid><grid><column width-ratio="0.250000">
<img name="image.png" alt="The image shows a login interface of Bitget. It has a dark background with a login password input section at the top. In the center, there is a pop-up window with a green checkmark and the text &#34;连接账号&#34; (Connect Account), indicating that the user can use Facebook to log in. Below the text, there is a &#34;OK&#34; button. This interface is related to the竞品分析 (Competitor Analysis) section in the document, which compares Bitget&#39;s login process with other platforms like Binance, Bitget, and others, mentioning that Bitget&#39;s login process is consistent with Binance&#39;s." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=MDk4MWMzNDhmYjc0ZjZkNjQzZWI5YmU1ZDE4OTkxZmZfYTEyYjgwOGU3ZmM3MjkyNzNmODQ0MGM5NTNhOTM3ODVfSUQ6NzY2NTI1MDM2NzExMTUxNTg3NF8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.300783" src="prd-assets/PRD-IMG-018.png"/>
</column><column width-ratio="0.250000">
<img name="image.png" alt="The image shows the Bitget platform interface with a dark background. A pop-up window titled &#34;账户绑定&#34; (Account Binding) is displayed, listing multiple third-party login options including Google、Apple ID、Telegram、MetaMask、Bitget Wallet, each with a &#34;绑定&#34; (Bind) button. This corresponds to the竞品分析 (Competitor Analysis) section in the document, which mentions Bitget as a competitor with a multi-channel login interface, where users can choose to bind/create an account when not logged in, similar to the current scheme." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=ZWRjODI0YjgxNDkzMDMzNTA3N2ZkMjA5YTY1MTVhNTRfZTk1NmRmM2JkYmU4ZmZkYWIwYzEzNTlmYzczMGVhYTFfSUQ6NzY2NTI1MDU0OTgwOTU4MTgwMF8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.300783" src="prd-assets/PRD-IMG-019.png"/>
</column><column width-ratio="0.250000">
<img name="image.png" alt="The image shows the Bitget platform interface with a dark background. A pop-up window titled &#34;更新telegram账户&#34; (Update Telegram Account) is displayed, containing fields for inputting information and a &#34;更新&#34; (Update) button. There are also other interface elements like &#34;PIN设置&#34; (PIN Settings), &#34;账户管理&#34; (Account Management), and &#34;第三方账号管理&#34; (Third-Party Account Management) sections. This screenshot is related to the竞品分析 (Competitor Analysis) section of the document, which compares Bitget&#39;s login and registration process with other platforms." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=ZWMyOTdlZDIyMjQwZDBmYWVhNDlhYjFhNzA5OWUyNWJfODE3MzU0MDA0YWQ5OWJkM2I0YjA5ZmU5ODljZGZkYTlfSUQ6NzY2NTI1MDYwNTM2MzAyMzU4MF8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.300783" src="prd-assets/PRD-IMG-020.png"/>
</column><column width-ratio="0.250000">
<img name="image.png" alt="The image shows the Bitget interface with a dark background. A pop-up window titled &#34;安全验证&#34; (Security Verification) is displayed, containing a message about Google verification and a &#34;确定&#34; (Confirm) button. The Bitget logo is visible in the top left corner, and there are various menu options and settings sections around the pop-up. This screenshot is related to the竞品分析 (Competitor Analysis) section of the document, which compares Bitget&#39;s login and registration process with other platforms." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=MzQ1MWRlM2ZkMmQzN2Y4NDE2YjM3OTNmYjcyNWU5ZmJfMTY1OGQ5YjUyY2FlMGYzMTJhMDMxNDU1OGM3NDMwNmRfSUQ6NzY2NTI1MDY2NDIxMzU2NTE2MV8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.300783" src="prd-assets/PRD-IMG-021.png"/>
</column></grid></td><td>与币安流程逻辑一致</td></tr><tr><td>ins</td><td><grid><column width-ratio="0.166667">
<img name="image.png" alt="The image shows the login interface of Instagram. It has a dark background with input fields for &#34;手机号、账号或邮箱&#34; (phone number, account, or email) and &#34;密码&#34; (password). There is a blue &#34;登录&#34; (login) button in the center. Below it, there are options: &#34;忘记密码了？&#34; (Forgot password?), &#34;用Facebook登录&#34; (Log in with Facebook), and &#34;创建新账户&#34; (Create new account). At the bottom, there is the &#34;Meta&#34; logo. This interface is related to the竞品分析 (Competitor Analysis) section in the document, which mentions Instagram as a competitor with similar login methods." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=ODM4MDhhM2FlMDM4ZTdjYzViZjQ1ZjUxZGY1MzU2OGNfNGUyNGE2Y2Y2YjMyNzUzMGFhNGU5ZWI0ZDZjYmZhNjVfSUQ6NzY2NTIzOTc5NDIwOTM2MTYzMl8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.713587" src="prd-assets/PRD-IMG-022.png"/>
</column><column width-ratio="0.166667">
<img name="image.png" alt="The image shows the Facebook login page. On the left side, there is a blue Facebook logo, a &#34;探索你喜欢的事物&#34; (Explore what you like) text, and a photo of two people. On the right, there are fields for entering a phone number or email, a &#34;登录&#34; (Log in) button, a &#34;忘记密码了吗?&#34; (Forgot password?) link, and a &#34;创建新账户&#34; (Create new account) button. At the bottom, there are language options including Chinese (Simplified), English (UK), Bahasa Indonesia, etc., and links like &#34;注册 Messenger&#34; (Register Messenger), &#34;隐私政策&#34; (Privacy Policy), and &#34;关于&#34; (About)." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=NjE2MTk0NDNhM2M5YWZkOWZkZGI0OWI1MWM1NzI2NzdfNTgxMGIzOWFlNjhjMWIyZDcwOWU4MDMxNmMzN2U0NzdfSUQ6NzY2NTIzOTg0Mzk2NTkxNDg1NF8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.311168" src="prd-assets/PRD-IMG-023.png"/>
</column><column width-ratio="0.166667">
<img name="image.png" alt="The image shows an Instagram login interface with the Facebook logo. It prompts &#34;Instagram 想访问你的 Facebook 账户&#34; (Instagram wants to access your Facebook account) and has a blue &#34;允许 获得授权&#34; (Allow Get Authorization) button, a &#34;取消&#34; (Cancel) button, and the &#34;FACEBOOK&#34; logo below. This relates to the竞品分析 section mentioning ins (Instagram) and its account互通 experience with Facebook, where users can log in with the same Facebook account after unbinding." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=YjY2OWQ3MGRkNzM5M2Y2ZTgxOWNmMDRjMzBiNWNmZjRfYjRjMzdhOTI1NDRhY2VhOTRkNTRmZGU5N2NmMGJkYTFfSUQ6NzY2NTI0MDk5MDQxNjA0Nzg0Ml8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.311168" src="prd-assets/PRD-IMG-024.png"/>
</column><column width-ratio="0.166667">
<img name="image.png" alt="The image shows an account recovery interface with a dark background. At the top, there is a prompt &#34;找回你的账户&#34; (Find your account) and a blue &#34;继续&#34; (Continue) button. Below, a pop-up window displays &#34;找不到 Instagram 账户&#34; (Can&#39;t find Instagram account) and instructs to input Instagram login information or use the recovery code. This relates to the竞品分析 (Competitor Analysis) section, which mentions Instagram as a competitor and discusses account recovery processes." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=YjliMGRlMzM1OTZhMDYyZjJjM2I5ZDU5ZjVhMzc3NDVfNjk3MTU5MzQzYTI1MGY0MDg0ZmYzMjIyYTRlNWQyYjhfSUQ6NzY2NTI0MTA1ODA0NTI1MTI5NF8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.311168" src="prd-assets/PRD-IMG-025.png"/>
</column><column width-ratio="0.166667">
<img name="image.png" alt="The image shows a login interface with a dark background. At the top, there is a &#34;找回你的账户&#34; (Find Your Account) prompt, and a text input box for email or phone number, with an example email &#34;pipi666@gmail.com&#34; displayed. Below, a pop-up window titled &#34;请帮助我们验证你的身份&#34; (Please help us verify your identity) contains a text area with some content and a blue &#34;继续&#34; (Continue) button at the bottom. This interface is related to the login process described in the context, likely part of the authentication steps for accessing an account." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=Y2NkYzIyZjZkNjk2MjY1NjgxOTdmMWNmOTcyNTY1Y2JfMDllMmNlOTczNzE5YzExMGZjNWZhODA5ZTJkZDRhZTFfSUQ6NzY2NTI0MTIzOTUyNTE1MDQ0MV8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.311168" src="prd-assets/PRD-IMG-026.png"/>
</column><column width-ratio="0.166667">
<img name="image.png" alt="The image shows a login interface with a dark background. At the top, there is a prompt &#34;找回你的账户&#34; (Find Your Account) and a text input box for email or phone number, with &#34;pipi0514@gmail.com&#34; entered. Below is a blue &#34;继续&#34; (Continue) button. In the center, a pop-up box displays &#34;已发送！&#34; (Sent!) and a message stating the password reset email has been sent to &#34;pipi0514@gmail.com&#34;, with a blue &#34;确定&#34; (Confirm) button." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=NzZjZjRiMjgwZDIyYzA5YzlmODExYmRiMzVhODY4NDZfZjFhMTE4ZGMwNDNmMGIxYWY2Y2E0OWQ3MTY2YTI3YzJfSUQ6NzY2NTI0MTI3NjY5ODMxNjUyMV8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.311168" src="prd-assets/PRD-IMG-027.png"/>
</column></grid></td><td>与Facebook同属Meta生态，账号互通体验较好，但不涉及资金场景，安全等级要求与交易所不可直接对标</td></tr><tr><td><u>山富旅游   </u><u>https://www.travel4u.com.tw/#_=_</u></td><td><grid><column width-ratio="0.166667">
<img name="image.png" alt="The image shows a login interface with a &#34;會員登入&#34; (Member Login) title. There are three social media login buttons: Facebook (blue), Google+ (red), and another (green). Below the buttons, there are input fields for &#34;E-mail&#34; and &#34;密碼&#34; (Password), a &#34;記住我&#34; (Remember Me) checkbox, and a red &#34;登入&#34; (Login) button. At the bottom, there are links for &#34;不是會員？立即註冊！&#34; (Not a member? Register now!) and &#34;忘記密碼？&#34; (Forgot password?). This interface is related to the context discussing login and registration, including third-party login methods." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=YWMwM2EwNGIwNTJlNzk0MWQ0ODc5OGU5Y2UwYmU5ZjdfNzYxN2Y1NDQ1NjM2YWYyNjc0NTc5YzJkYjFhYTExYWFfSUQ6NzY2NTI0MzIyMjQ5MDMyMDYxMF8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.694577" src="prd-assets/PRD-IMG-028.png"/>
</column><column width-ratio="0.166667">
<img name="image.png" alt="The image shows a Facebook login page. At the top, there is a prompt &#34;请输入密码并继续&#34; (Please enter your password and continue). Below, there is a password input field with the placeholder &#34;密码&#34; (Password) and a &#34;登录&#34; (Log in) button. The page also includes a profile picture placeholder and some text in Chinese, such as &#34;你还没有登录试试吗？&#34; (Have you logged in yet?). At the bottom, there are language options including &#34;English (US)&#34;, &#34;Bahasa Indonesia&#34;, &#34;日本語&#34;, etc." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=MmY0ZDM2YmUyMTMyMzdhMThiMzU0OTQxY2M1ZTE5N2JfZGQwNGQxYTM0YWMzOWQ4ZGEwMjE0NGU5YWYyOTUyZWFfSUQ6NzY2NTI0MzUwMjk3MTgxNzY5Ml8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.311168" src="prd-assets/PRD-IMG-029.png"/>
</column><column width-ratio="0.166667">
<img name="image.png" alt="The image shows a Facebook login interface for the 山富旅游 website. It prompts the user to grant permissions for 山富旅游 to access their name, profile picture, and email. There is a blue &#34;允许身份验证&#34; (Allow Authentication) button at the bottom, with a &#34;取消&#34; (Cancel) button above it. This interface is related to the context discussing the login and account binding process between Facebook and 山富旅游, highlighting the permission granting step in the login flow." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=MmY1YTMzZjE2MTNlNzg4NmEyYmRhZTMwYTcyMzBlZThfYTljNmQ0YjZkYjU4YzYxNTQ5MzUyOTI3OTBlMTY3OWFfSUQ6NzY2NTI0MzUzNjIyNDcwMjE3Ml8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.311168" src="prd-assets/PRD-IMG-030.png"/>
</column><column width-ratio="0.166667">
<img name="image.png" alt="The image shows the homepage of the &#34;山富旅游&#34; website. At the top, there is a navigation bar with options like &#34;首页&#34; (Home), &#34;关于我们&#34; (About Us), &#34;机票&#34; (Flights), etc. A white pop-up box in the center contains text in Chinese. Below, there are sections for &#34;關於山富&#34; (About Richmond Tours), &#34;訂房服務&#34; (Accommodation Services), &#34;訂房條款&#34; (Booking Terms), and &#34;商業合作&#34; (Business Cooperation). Contact information, including a phone number &#34;4493535&#34; and an email &#34;richmond@travel4u.com.tw&#34;, is displayed. At the bottom, there are social media icons and a green &#34;加入我們&#34; (Join Us) button." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=ZTk2OTY0MGI2NGFhNWZjNDVmYTA3MjFhMGYyYzI1NGJfMzE3NjdjM2VjNGMyNGQzZDJkZTZkYWQ0ZWJiOWI5YjhfSUQ6NzY2NTI0MzYxNTU0NzQ0NDk1Nl8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.311168" src="prd-assets/PRD-IMG-031.png"/>
</column><column width-ratio="0.166667">
<img name="image.png" alt="The image shows a membership account email verification page from Richmond Tours. The page has a red &#34;點擊確認&#34; (click to confirm) button in the center. At the bottom, there is a red warning section titled &#34;重要防詐騙提醒&#34; (Important Anti-Scam Reminder), which states that the company is not responsible for any losses caused by unauthorized calls, messages, or emails, and users should contact the official customer service hotline 02-2490-3555 if they encounter any issues." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=N2QyMzcwZGYwM2FjOWUzZTFkMjk1YjQ0NDRlYzAxY2ZfMTkyMzAwNjU4NmVjNGNhMzFjYmE1NTg5MWFiMzU1MzNfSUQ6NzY2NTI0NDI0NjMwMzI0ODEwMV8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.385835" src="prd-assets/PRD-IMG-032.png"/>
</column><column width-ratio="0.166667">
<img name="image.png" alt="The image shows the homepage of the &#34;山富旅游&#34; website. At the top, there is a navigation bar with options like &#34;首页&#34; (Home), &#34;行程&#34; (Tour), &#34;机票&#34; (Air Ticket), etc. A prominent red button labeled &#34;登录&#34; (Login) is visible. In the center, there is a red rectangular section with the text &#34;确认电子邮件&#34; (Confirm Email) and a red button below it. The bottom of the page has a red footer containing contact information, including a phone number &#34;44995535&#34; and social media icons for Facebook, Twitter, and Instagram." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=MGYxZjM1Mzk4MDFlNTllZmU1YmJjMzFjNjc0ZGVkZThfOTU1YmFiNmEyZGM1YmFjY2Y0Nzk1ZmI3ZmNkZWZjYzBfSUQ6NzY2NTI0NDI5MzU1MzY3MTkwM18xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.311168" src="prd-assets/PRD-IMG-033.png"/>
</column></grid><br/>从facebook解绑后 ，再次回<u>山富旅游</u>使用F登录 ，可以直接登录那个号<grid><column width-ratio="0.500000">
<img name="image.png" alt="The image shows a Facebook login notification for Travel4u. It states &#34;你通过Facebook登录了山富旅遊&#34; (You logged into Travel4u via Facebook) and mentions sharing Facebook information, including name and email. There is a &#34;编辑设置&#34; (Edit Settings) button and a link to &#34;前往帮助中心了解如何保持账户安全&#34; (Visit the help center to learn how to keep your account secure). This relates to the context discussing the Facebook login process and security concerns in the competition analysis section." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=MDI4Njc2NzY4ZDRmZjk0YzRkNTBlZTgyYWM2MTFlMmFfMzA3NjJiNDY5MmRkMzk0OTc3NTBlOGM4ZDY0YzI1OWFfSUQ6NzY2NTI0Mzk2Mzg3NTgwNjkzOV8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.369433" src="prd-assets/PRD-IMG-034.png"/>
</column><column width-ratio="0.500000">
<img name="image.png" alt="The image shows the Facebook settings interface. On the left, there are sections like &#34;设置与隐私&#34; (Settings &amp; Privacy), &#34;应用和网站&#34; (Apps &amp; Websites), and &#34;偏好设置&#34; (Preferences). The right side displays the &#34;应用和网站&#34; (Apps &amp; Websites) settings, with a red highlighted &#34;查看已连接的应用和网站&#34; (View Connected Apps and Websites) button. This relates to the context discussing Facebook&#39;s settings and the issue of account binding and unbinding, as mentioned in the竞品分析 (Competitor Analysis) section about Facebook&#39;s account management features." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=MmMzOWVjOWM1YjUxM2MxZWMzMWJiZDlkMDlmYTk3MjBfNTBlYzYxYzU3YTQxZDI5YWQxYjNjMGNiNTA3YTRhNWJfSUQ6NzY2NTI0NDEzNDgzMTUwOTIyNF8xNzg1NzM5MTQ3OjE3ODU3NDI3NDdfVjM" mime="image/png" scale="0.311168" src="prd-assets/PRD-IMG-035.png"/>
</column></grid></td><td>存在“解绑后重新用同一Facebook账号登录会自动直登原账号”的现象，三方ID与平台账号的解绑并不彻底</td></tr></tbody></table>

**竞品结论**

- 主流交易所（币安、Bitget）均采用“已绑定直登、未绑定二选一（注册/关联）”的标准范式，本方案沿用该范式，符合行业习惯，用户学习成本低。
- 山富旅游案例提示一个关键风险点：解绑操作必须彻底清除三方ID与平台账户的绑定关系（含服务端缓存/token），否则会出现“伪解绑”导致的账户安全问题。
- 非金融类App（INS、山富旅游）对第三方登录的安全等级要求明显低于交易所类产品，竞品方案可以参考交互范式，但安全需要按交易所标准单独设计，不照搬。

# 七、 产品方案

## 5.1 相关链接

- Figma 原型：https://www.figma.com/design/1ro2OBI8I1omI9bTJSMJPG/Sissie%E5%8E%9F%E5%9E%8B?node-id=9137-2&p=f&t=50slNSTdp2KOIwox-0
- UI 设计稿-web：
- UI 设计稿-app：

## 5.2 登录/注册整体流程

在 **登录/注册/首页** 新增 【 **Telegram  / Facebook   】** 按钮。

用户点击后，通过 OAuth 授权登录（Web 端打开 窗口，App 端打开浏览器页面完成授权）
<whiteboard token="UN6JwFer5hTGwpb8IP5lNG4og8d"></whiteboard>
### 5.2.3 Telegram / Facebook 渠道数据字段差异说明

| **渠道** | **可获取字段** | **邮箱是否必给** | **说明** |
|-|-|-|-|
| Telegram | id、first_name、last_name、username、photo_url、auth_date、hash | 不提供 | Telegram Login Widget协议本身不返回邮箱/手机号，**注册需要用户输入就邮箱/手机补填页面对TG渠道为强制流程，无例外分支** |
| Facebook | id、name、email（需邮箱权限）、picture | 用户可拒绝授权 | 需App Review通过后才能申请email权限；若用户拒绝授权email，**按“无邮箱”场景走补填流程；若已授权email，直接使用该邮箱** |

### 5.2.4 授权结果判断

- **已绑定**

  - 已绑定（telegram_id / facebook_id 已关联平台账户）→ 校验账户状态 → 正常账户直接登录成功；冻结账户返回冻结提示，不允许登录；已注销账户提示“账户已注销”，不允许登录
- **未绑定** 

  - 弹出选择页：【注册新账户】或【关联已有账户】
- **识别有相同邮箱 （Facebook ）**

  - 弹出强制关联弹窗

### 5.2.5  注册新账户

Telegram / Facebook 授权完成后，缺少邮箱或手机号（Facebook已授权邮箱权限的情况除外），用户需补填账户信息：

- 若Facebook已获取有效邮箱：判断该邮箱是否在平台完成注册，如完成走强制关联流程  （现有逻辑）
- 其余情况：用户需填写邮箱或手机号，勾选【同意平台服务条款】，进行邮箱/手机验证码校验，验证完后进行平台，通过个人中心设置密码 （现有逻辑）
- 校验前需查重：若邮箱/手机号已注册平台账户，禁止创建新账户 
- 校验通过后，平台创建交易所账户，建立绑定关系：Fameex账户 ↔ telegram_id / facebook_id

### 5.2.6  关联已有账户

- 用户输入已有账户的邮箱/手机号 + 密码（如密码忘记，则走忘记密码流程，流程结束后回到本绑定页面），密码错误次数限制复用现有账户安全规则

1. 验证通过后，将 `telegram_id` `facebook_id`绑定到该已有Fameex账户
2. 关联账户已绑定该第三方账户 ， 提示：该账户已关联 Telegram / Facebook   ，请先解除关联
3. 关联账户已注销 ， 提示：该账户已注销，无法关联 Telegram / Facebook  
4. 关联账户不存在， 提示：用户不存在 

### 5.2.7 其他事项

#### **Telegram** 

- **第三方文档**：[core.telegram.org/widgets/login](https://core.telegram.org/widgets/login)
- Telegram Login Widget，基于 Bot 的 OAuth 式授权。需要先在 [@BotFather](https://t.me/BotFather) 创建 Bot 并配置域名，**需要提前申请准备好对应环境内容账号**

#### **Facebook**  

-  **第三方文档：**https://developers.facebook.com/documentation/facebook-login
- 标准 OAuth 2.0 授权流程，支持 iOS / Android / Web SDK。需要先在 [Meta for Developers](https://developers.facebook.com/) 创建应用，通过应用审核后才能获取用户邮箱等敏感权限，iOS SDK、Android SDK 各自有独立的集成指南，**需要提前申请准备好对应环境内容账号**

### 5.2.8 扩展：TG 登录用户订阅 Bot ( 暂时不做）

授权后平台 Bot 获得向用户发送消息的权限。后续可用于推送：交易提醒、登录通知、资产异动、活动通知等。用户无需手动 start Bot，授权即完成订阅

补充说明：用户解除Telegram关联时，必须同步取消Bot订阅、停止推送，避免解绑后仍收到消息

## 5.3 平台展示规则

| 平台 | 是否展示 TG 登录入口 | 是否展示 Facebook登录入口 |
|-|-|-|
| Web端 | ✔ | ✔ |
| iOS（App Store 包） | ✔ | ✔ |
| iOS（官网包） | ✔ | ✔ |
| Android（谷歌应用商店） | ✔ | ✔ |
| Android（官网包） | ✔ | ✔ |

## 5.4 第三方账户管理（个人中心）

在现有【账户绑定】弹窗下方新增 Telegram 和 Facebook 

<grid>
<column width-ratio="0.795295">
![The image shows the interface of the platform's account management section. In the center, there is a pop-up window with the title "账户绑定" (Account Binding) and a list of accounts including "Telegram" and "Facebook". Below the list, there are two blue buttons: "绑定Telegram登录" (Bind Telegram Login) and "绑定Facebook登录" (Bind Facebook Login). This corresponds to the context which mentions adding Telegram and Facebook login options in the account binding pop-up window, and the operation of clicking to open the authorization page, which needs to pass security verification to bind successfully.](prd-assets/PRD-IMG-036.png)
</column>
<column width-ratio="0.204705">
![The image shows the "Account Binding" section in the personal center, which is related to the "5.4 Third-party Account Management (Personal Center)" in the product scheme. It displays three login methods: Google login, HiChat login, and Apple login, all marked as "Not bound" and each with a "Bind" button. Above the pop-up window, there are other account-related options like phone number, email, Google verification, login password, account binding, payment method, and a toggle switch for the whitelist.](prd-assets/PRD-IMG-037.png)
</column>
</grid>

#### 操作

- **关联**：点击后打开对应授权页面，授权成功后需安全验证，验证通过即绑定成功。
- **关联判断**：与已有规则一致，已被其他账户绑定的三方账号提示：该账户已关联，请先解除关联
- **解除关联**：安全验证成功后即解绑。

## 5.5 管理后台

![The image shows the user management interface of the management backend, which is related to the product scheme of adding third-party (tg, Facebook) fields for display, filtering conditions, and export content. There are two yellow-highlighted areas: one is the "Third Party" field in the user management interface, and the other is the "Third Party" button in the user management interface.](prd-assets/PRD-IMG-038.png)

![The image shows a user management interface in the management backend. It displays basic information of a user, including UID, user status, registered site, etc. The "第三方登录" (Third-party Login) field is highlighted with a yellow box, indicating it is a new field added for Telegram and Facebook login. Below the basic information, there are multiple operation buttons and sections like user status, asset management, etc.](prd-assets/PRD-IMG-039.png)

用户管理新增 Telegram 和 Facebook 字段展示及筛选条件，以及导出内容 。

## 5.5通用规则（沿用已有第三方登录规则）

相关联参考文档：【PM-1227/M-0370】[新增第三方登录及嗨聊邀请关系](https://qfglxo2m3dc.sg.larksuite.com/docx/JeYMd4RluoneVcxnMRWlJ7rQgkf)

- 关联已有账户的完整流程（邮箱/手机+密码 → 验证码+谷歌验证 → 绑定）
- 第三方账户管理弹窗的整体框架
- 管理后台的三方绑定字段展示、筛选、导出
- 注销解绑、验证码优先级规则

# 八、异常场景与边界

| **场景** | **处理方案** |
|-|-|
| 同一telegram_id/facebook_id并发发起两次绑定请求（多设备同时操作） | 绑定操作需加分布式锁/唯一索引兜底，后到达的请求返回“已绑定”错误，不允许覆盖 |
| 注册新账户时填写的邮箱/手机号与平台已有账户重复 | 提示“该邮箱/手机号已注册，请使用关联已有账户” |
| Facebook/Telegram服务端接口超时或异常 | 前端展示统一失败态“第三方服务暂时不可用，请稍后重试”，记录失败日志 |
| 验证码多次输入错误或过期 | 复用现有验证码规则：错误超过阈值锁定校验入口，过期需重新发送 |
| 用户在Telegram/Facebook侧主动撤销对平台的授权 | 平台侧token下次调用时校验失败，标记绑定状态为“已解绑” |
| 账户已注销 | 沿用现有账户注销解绑规则，保证一致 |

# 九、日志&埋点

## 7.1 日志新增

**现货管理后台新增第三方绑定关联历史记录**

![The image shows a screenshot of the platform interface related to the "Third Party Account Binding Association History" as mentioned in the context. It displays a table with columns including Time, Operation, Platform, and Account, listing records such as "2026-07-10 09:38:47" with operations like "关联" (Bind) and "解绑" (Unbind) for platforms like Hichat, Google, Apple, Telegram, and Facebook, along with corresponding accounts. The table is part of the "7.1日志新增" (7.1 Log Addition) section, which details the new log entries for the third-party binding association history in the现货管理后台 (Spot Management Backend).](prd-assets/PRD-IMG-040.png)

| 时间 | 操作 | 平台 | 账号 |
|-|-|-|-|
| 2026-07-10 09:38:47 | 关联 | Hichat | +86 137\*\*\*\*9621 |
| 2026-07-10 09:38:47 | 解绑 | Google | a\*\*\*\*@[163.com](https://163.com/) |
| 2026-07-10 09:38:47 | 解绑 | Apple | -- |
| 2026-07-10 09:38:47 | 解绑 | Telegram | +86 137\*\*\*\*9621 |
| 2026-07-10 09:38:47 | 解绑 | Facebook | -- |

- 脱敏格式相关文档：
<cite doc-id="RpDxdh53HoacPrxjj9wlXa2ag5f" file-type="docx" title="PR-01268 【审计】手机/邮箱脱敏展示/加密传输" type="doc"></cite>
- 其他说明：如Apple或Facebook未返回关联账号邮箱/手机，则展示 --

## 7.2 埋点

| 事件名 | 触发时机 | 上传参数 | 说明 |
|-|-|-|-|
| click_tg_login | 用户点击Telegram登录按钮 | platform（web/ios/android）、page_from（login/register）、user_status（new/existing） | 统计各端入口点击量 |
| click_fb_login | 用户点击Facebook登录按钮 | platform、page_from、user_status | 同上 |

# 十、版本兼容性

- 本需求功能点主要集中于登录/注册页与个人中心，不强制要求老版本App升级；老版本App不展示新入口，不受影响。

#  九、验收标准

| **验收项** | **通过标准** |
|-|-|
| 入口展示 | 所有端入口正常展示 |
| 已绑定直登 | 正常账户成功；冻结、注销、受限账户均被拦截。 |
| 快捷注册 | 补填并验证邮箱/手机后创建账户 |
| 密码状态 | 未设置密码账户进入个人中心告知设置密码 |
| 重复账号 | 已注册邮箱/手机号不能创建新账户，只能进入关联流程。 |
| 安全关联 | 必须通过目标账户身份与二次验证；不能仅凭同邮箱关联。 |
| 并发绑定 | 同一三方ID并发绑定只允许一笔成功，不能覆盖。 |
| 彻底解绑 | 绑定、缓存、Token引用清除；再次三方登录进入未绑定分流。 |
| 后台能力 | 展示、筛选、导出、权限与脱敏符合定义，操作有审计。 |
| 日志 | 日志展示解绑关联过往历史信息 |
| 埋点 | 埋点是否都有正常埋 ，数据是否有上传到posthog上。posthog上能否做ab实验、检表。 |
| 老版本兼容 | 老客户端原登录、注册流程无新增报错。 |
