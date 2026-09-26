const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { readFileSync } = require('node:fs')
const { createRequire } = require('node:module')
const { join } = require('node:path')

const mode = process.argv[2]
const repoRoot = process.argv[3]
const target = 'apps/web/src/utils/captcha/index.tsx'

if (!repoRoot) throw new Error('repo root is required')

function checkSource() {
  const source = readFileSync(join(repoRoot, target), 'utf8')
  const reset = 'if (hasStartedCaptcha) captchaRef.reset()'
  const verify = 'captchaRef.verify()'
  const markStarted = 'hasStartedCaptcha = true'
  const resetIndex = source.indexOf(reset)
  const verifyIndex = source.indexOf(verify, resetIndex)
  const markStartedIndex = source.indexOf(markStarted, verifyIndex)

  assert.ok(source.includes('let hasStartedCaptcha = false'))
  assert.ok(resetIndex >= 0)
  assert.ok(verifyIndex > resetIndex)
  assert.ok(markStartedIndex > verifyIndex)
}

function checkDiff() {
  const status = execFileSync('git', ['status', '--short', '--untracked-files=no'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  const changed = status.trim()
    ? (execFileSync('git', ['diff', '--check', '--', target], { cwd: repoRoot, stdio: 'inherit' }),
      status
        .trimEnd()
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => line.slice(3)))
    : (execFileSync('git', ['diff', '--check', 'HEAD^', 'HEAD', '--', target], {
      cwd: repoRoot,
      stdio: 'inherit',
    }),
      execFileSync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], {
        cwd: repoRoot,
        encoding: 'utf8',
      })
        .trimEnd()
        .split('\n')
        .filter(Boolean))

  assert.deepEqual(changed, [target])
  checkSource()
}

async function checkBrowser() {
  const requireFromApp = createRequire(join(repoRoot, 'apps/web-next/package.json'))
  const { chromium } = requireFromApp('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const notProofErrors = []

  page.on('console', (message) => {
    if (/not proof/i.test(message.text())) notProofErrors.push(message.text())
  })
  page.on('pageerror', (error) => {
    if (/not proof/i.test(error.message)) notProofErrors.push(error.message)
  })

  await page.route('**/static/js/gt.0.4.9.js', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `window.__captchaCalls=[];window.__captchaCallbacks={};window.initGeetest=function(_config,callback){const captcha={onReady(fn){window.__captchaCallbacks.ready=fn;setTimeout(fn,0);return captcha},onSuccess(fn){window.__captchaCallbacks.success=fn;return captcha},onError(fn){window.__captchaCallbacks.error=fn;return captcha},onClose(fn){window.__captchaCallbacks.close=fn;return captcha},verify(){window.__captchaCalls.push('verify')},reset(){window.__captchaCalls.push('reset')},getValidate(){return null}};callback(captcha)};window.__closeCaptcha=()=>window.__captchaCallbacks.close?.();`,
    }),
  )
  await page.route('**/fe-ex-api/user/getValidateSwitch', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: '0', data: { validateSwitch: 1 }, message: 'success' }),
    }),
  )
  await page.route('**/fe-ex-api/common/tartCaptcha', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: '0',
        data: { captcha: { challenge: 'pilot-challenge-1', gt: 'pilot-gt', success: 1 } },
        message: 'success',
      }),
    }),
  )

  await page.goto('http://localhost:4000/en-US/login', { waitUntil: 'networkidle' })
  const account = page.getByPlaceholder('Email / Mobile Number')
  const password = page.getByPlaceholder('Password')
  const login = page.getByRole('button', { name: 'Log In', exact: true })

  await account.fill('pilot@example.com')
  await password.fill('Pilot123!')
  await page.waitForFunction(() => {
    const inputs = [...document.querySelectorAll('input')]
    const button = [...document.querySelectorAll('button')].find(
      (node) => node.textContent?.trim() === 'Log In',
    )
    return (
      inputs[0]?.value === 'pilot@example.com' &&
      inputs[1]?.value === 'Pilot123!' &&
      button &&
      !button.disabled
    )
  })

  await login.click()
  await page.waitForFunction(
    () => JSON.stringify(window.__captchaCalls) === JSON.stringify(['verify']),
  )
  const firstCalls = await page.evaluate(() => [...window.__captchaCalls])

  await page.evaluate(() => window.__closeCaptcha())
  await page.waitForTimeout(450)
  await login.click()
  await page.waitForFunction(
    () =>
      JSON.stringify(window.__captchaCalls) === JSON.stringify(['verify', 'reset', 'verify']),
  )
  const finalCalls = await page.evaluate(() => [...window.__captchaCalls])

  assert.deepEqual(firstCalls, ['verify'])
  assert.deepEqual(finalCalls, ['verify', 'reset', 'verify'])
  assert.deepEqual(notProofErrors, [])
  await browser.close()
}

if (mode === '--browser') {
  checkBrowser().catch((error) => {
    console.error(error)
    process.exit(1)
  })
} else if (mode === '--source') {
  checkSource()
} else if (mode === '--diff') {
  checkDiff()
} else {
  throw new Error(`unsupported mode: ${mode}`)
}
