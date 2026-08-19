---
sourceName: "需求 PRD (extracted, localized assets)"
sourceType: "wiki"
sourceUrl: "https://qfglxo2m3dc.sg.larksuite.com/wiki/KCyhwSvN7idfRCkTbI9lhZUNgbd"
derivedFrom: "prd-latest.md"
syncedAt: "2026-08-19T00:32:31.561Z"
readOnly: true
---

<title>【PR-02306】【优化】注册登录等流程密码规则修改</title>

# 背景

1. 当前注册登录密码特殊字符规则，各端（web、app、后端）不统一。
2. 有用户反馈，在其他平台设置密码时有用下划线当特殊字符，而我们不支持，用户也不想修改。
3. 因此需要增加特殊字符的范围。

# 竞品调研

![The image is a table titled "平台规则对比" (Platform Rules Comparison) showing password rules of different exchanges. It includes columns:交易所 (Exchange), 密码长度 (Password Length), 必须包含 (Must Contain), 特殊字符 (Special Characters), and 官网核验结论 (Official Website Verification Conclusion). The exchanges listed are Binance, OKX, Bybit, Bitget, Coinbase, and KuCoin. Each row details their password length requirements, must contain elements, special character rules, and the official website's verification conclusion.](assets/img-001.png)

1. 各交易所出于安全考虑基本都是强制特殊字符或强制大写字母2选1。
2. 而我们原密码规则，不强制要求用户使用大写字母，因此为了不改变原来用户的使用习惯，以及安全考虑，我们的密码还是设置为：数字+英文+特殊字符

# 产品方案

1. FameEX当前密码规则：

   - 要求密码长度 8\~20 位，并且必须包含：
   - 至少一个字母
   - 至少一个数字
   - 至少一个指定特殊字符
2. 原特殊符号范围：@ \$ ! % \* # ? & - . = ( ) , /

**特殊符号更新后范围：@ \$ ! % \* # ? & - . = ( ) , / ^\_ + [ ] { }**

1. 文案调整为：

   - 密码包含8-20个字符
   - 至少1个英文字母
   - 至少1个数字
   - 至少1个特殊符号（@\$!%\*#?&-.=(),/^\_+[]{}）

![The image shows a password setting interface. At the top, there is a prompt "设置您的密码" (Set Your Password). Below, a password input box contains "asd_12345678". Under the input box, there are three green checkmarks indicating the password meets the rules: "密码包含8-20个字符" (Password contains 8-20 characters), "至少1个英文字母" (At least 1 English letter), and "至少1个特殊符号" (At least 1 special symbol). At the bottom, there is a purple "完成注册" (Complete Registration) button.](assets/img-002.png)

1. 以下两个场景都需要增加密码规则文案：

- 重置密码

![The image shows the "Reset Password" interface with a dark background. There is a warning at the top stating "After resetting the login password, the account is prohibited from withdrawing for 24 hours, please operate carefully." Below, there is a "Set New Password" input field, and the password rule "8 - 20位数字和字符+字母组合" (8 - 20 digits, characters, and letters) is highlighted in red. There is also a "Confirm New Password" input field and a "Reset Password" button at the bottom. This image is related to the context of modifying password rules in the registration/login flow.](assets/img-003.png)

- 修改登录密码

![The image shows a "修改登录密码" (Modify Login Password) interface with a dark background. There are three input fields, and a red arrow points to the second input field. Below the input fields, there are two buttons labeled "获取验证码" (Get Verification Code) on both sides. At the bottom, there is a purple "提交" (Submit) button. This image is related to the context about modifying login passwords, which is one of the current password-related scenarios that need to have password rule text added below the "设置新密码" (Set New Password) section.](assets/img-004.png)

加在设置新密码下面

1. 当前用到密码的场景都需要排查到，各端（web、app、后端）规则是否一致。若不一致需要修改一致。

- 当前涉及到密码的场景：登录、注册、找回密码、初始化的随机密码。
- 其他场景是否有遗漏需要开发测试补充。

# 测试需要注意

1. 所有特殊符号都要试一遍，看看是否有前后端不一致的问题。
2. 是否所有涉及到密码的场景都更改为一致。
