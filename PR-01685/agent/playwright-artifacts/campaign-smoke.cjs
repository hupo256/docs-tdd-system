const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const baseUrl = 'http://localhost:4000/zh-CN/campaign/PR-01685'
const outDir = __dirname
const scenarios = ['active', 'not-started', 'ended', 'unjoined', 'claimable', 'restricted', 'empty-ranking']
const viewports = [
  { name: 'desktop', width: 1440, height: 1200 },
  { name: 'mobile', width: 390, height: 844 },
]
const requiredTexts = ['FameEX 三期交易挑战赛', '活动规则', '合约交易量排行榜']
const results = []

async function runScenarioChecks(browser) {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: viewport.name === 'mobile' ? 2 : 1 })
    const page = await context.newPage()
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) {
        results.push({ type: 'console', viewport: viewport.name, level: message.type(), text: message.text() })
      }
    })
    page.on('pageerror', (error) => {
      results.push({ type: 'pageerror', viewport: viewport.name, text: error.message })
    })

    for (const scenario of scenarios) {
      const startedAt = Date.now()
      await page.goto(`${baseUrl}?scenario=${scenario}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.getByText('FameEX 三期交易挑战赛').first().waitFor({ timeout: 30000 })
      await page.waitForTimeout(800)
      await page.screenshot({ path: path.join(outDir, `${viewport.name}-${scenario}.png`), fullPage: true })

      const bodyText = await page.locator('body').innerText({ timeout: 10000 })
      const widthMetrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
      }))

      results.push({
        type: 'scenario',
        viewport: viewport.name,
        scenario,
        status: 'loaded',
        durationMs: Date.now() - startedAt,
        missingTexts: requiredTexts.filter((text) => !bodyText.includes(text)),
        horizontalOverflow: widthMetrics.scrollWidth > widthMetrics.clientWidth + 2,
        widthMetrics,
      })
    }

    await context.close()
  }
}

async function runInteractionChecks(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const page = await context.newPage()
  await page.goto(`${baseUrl}?scenario=claimable`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.getByText('FameEX 三期交易挑战赛').first().waitFor({ timeout: 30000 })
  await page.waitForTimeout(800)

  const claimButton = page.getByText('待领取').first()
  const hasClaimButton = await claimButton.count().then((count) => count > 0)
  if (hasClaimButton) {
    await claimButton.click()
    await page.waitForTimeout(800)
  }
  const afterClaimText = await page.locator('body').innerText({ timeout: 10000 })

  await page.getByText('分享').first().click()
  await page.waitForTimeout(500)
  const shareText = await page.locator('body').innerText({ timeout: 10000 })
  await page.screenshot({ path: path.join(outDir, 'mobile-share-modal.png'), fullPage: true })

  await page.goto(`${baseUrl}?scenario=restricted`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.getByText('FameEX 三期交易挑战赛').first().waitFor({ timeout: 30000 })
  await page.waitForTimeout(500)
  const restrictedText = await page.locator('body').innerText({ timeout: 10000 })
  await page.screenshot({ path: path.join(outDir, 'mobile-restricted-modal.png'), fullPage: true })

  results.push({
    type: 'interaction',
    hasClaimButton,
    claimChangedToClaimed: afterClaimText.includes('已领取'),
    shareModalVisible: shareText.includes('复制') && shareText.includes('Telegram'),
    restrictedModalVisible: restrictedText.includes('仅限指定用户参与') || restrictedText.includes('我知道了'),
  })

  await context.close()
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  })
  try {
    await runScenarioChecks(browser)
    await runInteractionChecks(browser)
  } finally {
    await browser.close()
  }

  fs.writeFileSync(path.join(outDir, 'campaign-smoke-results.json'), `${JSON.stringify(results, null, 2)}\n`)
  console.log(JSON.stringify(results, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
