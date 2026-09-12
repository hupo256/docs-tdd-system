#!/usr/bin/env node
// Lark PRD 远端漂移检测的纯函数层：解析 docs +fetch 信封，并对正文做稳定规范化后计算 hash。
// 临时媒体下载 URL 每次 fetch 都可能变化，必须剔除；正文、结构、稳定 token 和文案仍参与指纹。

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

const TEMPORARY_MEDIA_URL_RE = /https?:\/\/[^\s"')>]+\/space\/api\/box\/stream\/download\/authcode\/\?code=[^\s"')>]+/gi

// 剥离「同一 PRD 内容、不同 fetch」之间必然波动的媒体元数据：临时下载令牌（每次 fetch 轮换）、
// markdown 图片描述与 HTML alt 文案（AI/OCR 生成，同图每次措辞不同、非确定性）。
// 真实文字/结构/表格/资产字节不受影响，指纹仍能检出真变更。
export function stripVolatileMediaMetadata(content) {
  return String(content || '')
    .replace(TEMPORARY_MEDIA_URL_RE, '<lark-temporary-media-url>')
    .replace(/!\[(?:\\.|[^\]])*\]/g, '![]')
    .replace(/(<img\b[^>]*?)\s+alt\s*=\s*("[^"]*"|'[^']*')([^>]*>)/gi, '$1$3')
}

export function canonicalizeLarkDocumentContent(content) {
  return stripVolatileMediaMetadata(String(content || '').replace(/\r\n?/g, '\n'))
    // sync-lark-docs 落盘时用同一 regex 剔除行尾空白（见 sync-lark-docs.mjs cleanMarkdown）；
    // 就地重算 remoteSources 指纹要读本地已落盘副本而不重新 fetch，必须同口径剔除，
    // 否则本地副本与直连 fetch 的原始 document.content 因行尾空白就必然不等。
    .replace(/[ \t]+$/gm, '')
    .trim()
}

export function hashCanonicalLarkContent(content) {
  return createHash('sha256').update(canonicalizeLarkDocumentContent(content)).digest('hex')
}

// feishu.cn/file/<token> 预览链与 larksuite 同构链：提取可鉴权下载的 file token。
// 这类 URL 未鉴权 fetch 只会拿到登录页 HTML，必须走 lark-cli media-download。
const LARK_FILE_URL_RE = /https?:\/\/[^\s"')]*\/file\/([A-Za-z0-9_-]+)/i

// 将一个媒体 URL 归类为鉴权 lark-media（file token）或普通 http 外链。
export function classifyMediaUrl(url) {
  const fileToken = LARK_FILE_URL_RE.exec(String(url || ''))?.[1]
  if (fileToken) return { kind: 'lark-media', token: fileToken, url: String(url) }
  return { kind: 'http', url: String(url) }
}

// 图片 magic bytes 嗅探：防止把登录页/错误 HTML 当图片落盘。返回图片类型或 null。
export function sniffImageType(buffer) {
  const b = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || [])
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png'
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg'
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'gif'
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  if (b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d) return 'bmp'
  return null
}

export function localizeLarkMediaReferences(content, assetDir = 'assets') {
  const media = []
  const allocate = (descriptor) => {
    const fileName = `img-${String(media.length + 1).padStart(3, '0')}.png`
    media.push({ fileName, ...descriptor })
    return `${assetDir}/${fileName}`
  }

  const localized = String(content || '').replace(/!\[(?:\\.|[^\]])*\]\(https?:\/\/[^\s)]+\)|<img\b[^>]*>/gi, (raw) => {
    const markdown = /^!\[((?:\\.|[^\]])*)\]\((https?:\/\/[^\s)]+)\)$/i.exec(raw)
    if (markdown) return `![${markdown[1]}](${allocate(classifyMediaUrl(markdown[2]))})`

    // <img> 标签：优先用稳定的内嵌 src=TOKEN（docx 媒体，走鉴权下载），
    // 其次才用 href http（可能是易变的 authcode 临时链）。
    const srcAttr = /\bsrc\s*=\s*["']([^"']*)["']/i.exec(raw)?.[1]
    const href = /\bhref\s*=\s*["'](https?:\/\/[^"']+)["']/i.exec(raw)?.[1]
    let descriptor = null
    if (srcAttr && !/^https?:\/\//i.test(srcAttr) && !srcAttr.startsWith(`${assetDir}/`)) {
      descriptor = { kind: 'lark-media', token: srcAttr }
    } else if (href) {
      descriptor = classifyMediaUrl(href)
    }
    if (!descriptor) return raw
    const localPath = allocate(descriptor)
    const withoutHref = raw.replace(/\s+href\s*=\s*["'][^"']+["']/i, '')
    if (/\bsrc\s*=\s*["'][^"']*["']/i.test(withoutHref)) {
      return withoutHref.replace(/\bsrc\s*=\s*["'][^"']*["']/i, `src="${localPath}"`)
    }
    return withoutHref.replace(/\/>$/, ` src="${localPath}"/>`).replace(/>$/, ` src="${localPath}">`)
  })

  return { content: localized, media }
}

export function parseLarkDocumentPayload(stdout) {
  let payload
  try {
    payload = JSON.parse(stdout)
  } catch (error) {
    throw new Error(`Lark docs +fetch returned invalid JSON: ${error.message}`)
  }

  const document = payload?.data?.document
  if (payload?.ok !== true || typeof document?.content !== 'string') {
    throw new Error('Lark docs +fetch response is missing data.document.content')
  }

  return {
    content: document.content,
    contentHash: hashCanonicalLarkContent(document.content),
    documentId: String(document.document_id || ''),
    revisionId: document.revision_id === undefined || document.revision_id === null
      ? ''
      : String(document.revision_id),
    identity: String(payload.identity || ''),
  }
}

export function remoteSnapshotFromMetadata({ source, metadata }) {
  if (!metadata?.remoteContentHash) return null
  return {
    name: source.name || source.target,
    url: source.url,
    target: source.target,
    contentHash: metadata.remoteContentHash,
    revisionId: String(metadata.remoteRevisionId || ''),
    syncedAt: metadata.syncedAt || '',
  }
}

export function compareRemoteSnapshot(expected, actual) {
  const ok = Boolean(expected?.contentHash) && expected.contentHash === actual?.contentHash
  return {
    ok,
    expectedHash: expected?.contentHash || '',
    actualHash: actual?.contentHash || '',
    expectedRevisionId: String(expected?.revisionId || ''),
    actualRevisionId: String(actual?.revisionId || ''),
  }
}

// 「拉不到远端 → 无法核对漂移」不等于「确有漂移」。真漂移（内容 hash 不一致）永远 error 阻断门禁；
// 但拉取失败（离线/超时/权限）时，基线还新鲜就只该告警、不该卡住整个 PRD intake。升级为阻断的两种情形：
//   · 基线已超过 maxStaleDays 天没同步（久到不能再盲信「大概没变」）；
//   · 已到高阶门禁（G5+，临近推版，必须确认远端与基线一致）。
// syncedAt 缺失/不可解析视作无穷旧 → 升级阻断（没有基线年龄就不能盲信）。
export function classifyDriftUnverified({ syncedAt, stage, now = Date.now(), maxStaleDays = 7 } = {}) {
  const stageNum = Number(String(stage || '').replace(/[^0-9]/g, '')) || 0
  const syncedMs = syncedAt ? Date.parse(syncedAt) : Number.NaN
  const ageDays = Number.isNaN(syncedMs) ? Number.POSITIVE_INFINITY : (now - syncedMs) / 86400000
  const escalate = ageDays > maxStaleDays || stageNum >= 5
  return { ok: !escalate, severity: escalate ? 'error' : 'warning', ageDays, stageNum, escalate }
}

export function selfTest() {
  const first = '<p>新增规则</p><img src="stable-token" href="https://x.larksuite.com/space/api/box/stream/download/authcode/?code=first" />'
  const second = '<p>新增规则</p><img src="stable-token" href="https://x.larksuite.com/space/api/box/stream/download/authcode/?code=second" />'
  assert.equal(hashCanonicalLarkContent(first), hashCanonicalLarkContent(second))
  assert.notEqual(hashCanonicalLarkContent(first), hashCanonicalLarkContent(first.replace('新增规则', '更新规则')))

  // 易变媒体元数据（markdown 图片描述 / HTML alt 文案）每次 fetch 措辞不同但非确定性 → 不应参与指纹。
  const mdAltA = '<p>正文</p>\n![截图：登录页错误提示 A](assets/img-001.png)'
  const mdAltB = '<p>正文</p>\n![截图：登录页错误提示 B，措辞不同](assets/img-001.png)'
  assert.equal(hashCanonicalLarkContent(mdAltA), hashCanonicalLarkContent(mdAltB))

  const htmlAltA = '<p>正文</p><img src="assets/img-001.png" alt="AI 生成描述 A">'
  const htmlAltB = '<p>正文</p><img src="assets/img-001.png" alt="AI 生成描述 B，措辞不同">'
  assert.equal(hashCanonicalLarkContent(htmlAltA), hashCanonicalLarkContent(htmlAltB))

  // 真实文字改动（非 alt/描述）仍必须检出。
  assert.notEqual(hashCanonicalLarkContent(mdAltA), hashCanonicalLarkContent(mdAltA.replace('正文', '更新后的正文')))

  // 行尾空白（sync-lark-docs 落盘时会剔除，直连 fetch 的原始内容不会）不应参与指纹，
  // 否则「读本地已落盘副本重算」与「直连 fetch」永远不等。
  assert.equal(hashCanonicalLarkContent('第一行  \n第二行'), hashCanonicalLarkContent('第一行\n第二行'))

  const localized = localizeLarkMediaReferences(`![a](https://example.com/one.png)\n![b](https://feishu.cn/file/FILETOKEN123)\n<img src="EMBEDTOKEN456" mime="image/png"/>\n<img href="https://example.com/four.png"/>`)
  assert.deepEqual(localized.media.map((item) => item.fileName), ['img-001.png', 'img-002.png', 'img-003.png', 'img-004.png'])
  // 外链 markdown 图 → http 直下；feishu.cn/file/<token> → 鉴权 lark-media；
  // 内嵌 <img src=TOKEN>（无 http）→ 鉴权 lark-media；<img href=http> → http。
  assert.deepEqual(localized.media[0], { fileName: 'img-001.png', kind: 'http', url: 'https://example.com/one.png' })
  assert.deepEqual(localized.media[1], { fileName: 'img-002.png', kind: 'lark-media', token: 'FILETOKEN123', url: 'https://feishu.cn/file/FILETOKEN123' })
  assert.deepEqual(localized.media[2], { fileName: 'img-003.png', kind: 'lark-media', token: 'EMBEDTOKEN456' })
  assert.deepEqual(localized.media[3], { fileName: 'img-004.png', kind: 'http', url: 'https://example.com/four.png' })
  assert.match(localized.content, /!\[a\]\(assets\/img-001\.png\)/)
  assert.match(localized.content, /src="assets\/img-003\.png"/)
  assert.doesNotMatch(localized.content, /href=/)

  // sniffImageType：只有真实图片 magic bytes 才过；HTML 登录页必须返回 null（不得冒充图片）。
  assert.equal(sniffImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'png')
  assert.equal(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'jpeg')
  assert.equal(sniffImageType(Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])), 'gif')
  assert.equal(sniffImageType(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')])), 'webp')
  assert.equal(sniffImageType(Buffer.from('<!doctype html><html><head>login</head></html>', 'utf8')), null)
  assert.equal(sniffImageType(Buffer.alloc(0)), null)

  const parsed = parseLarkDocumentPayload(JSON.stringify({
    ok: true,
    identity: 'user',
    data: { document: { content: first, document_id: 'doc1', revision_id: 12 } },
  }))
  assert.equal(parsed.documentId, 'doc1')
  assert.equal(parsed.revisionId, '12')
  assert.equal(parsed.contentHash, hashCanonicalLarkContent(first))
  assert.throws(() => parseLarkDocumentPayload('{}'), /missing data\.document\.content/)

  const expected = { contentHash: parsed.contentHash, revisionId: '11' }
  assert.equal(compareRemoteSnapshot(expected, parsed).ok, true)
  assert.equal(compareRemoteSnapshot(expected, { ...parsed, contentHash: 'changed' }).ok, false)

  // classifyDriftUnverified：新鲜基线 + 低阶门禁 → 只告警不阻断；基线过旧或 G5+ → 升级 error 阻断。
  const now = Date.parse('2026-08-11T00:00:00Z')
  const fresh = { syncedAt: '2026-08-09T00:00:00Z' } // 2 天前
  assert.deepEqual(
    { ok: classifyDriftUnverified({ ...fresh, stage: 'G2', now }).ok, severity: classifyDriftUnverified({ ...fresh, stage: 'G2', now }).severity },
    { ok: true, severity: 'warning' },
  )
  assert.equal(classifyDriftUnverified({ ...fresh, stage: 'G5', now }).ok, false) // 高阶门禁升级
  assert.equal(classifyDriftUnverified({ syncedAt: '2026-07-01T00:00:00Z', stage: 'G2', now }).ok, false) // 基线过旧升级
  assert.equal(classifyDriftUnverified({ syncedAt: '', stage: 'G0', now }).escalate, true) // 无基线年龄 → 升级
  console.log('lark-prd-drift self-test passed (stable media URL normalization, payload parsing, and drift comparison).')
}

if (process.argv[1]?.endsWith('lark-prd-drift.mjs') && process.argv.includes('--self-test')) {
  selfTest()
}
