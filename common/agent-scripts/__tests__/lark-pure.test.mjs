#!/usr/bin/env node
/**
 * 纯函数单测（能力2/3 的安全边界）。零外部依赖，`node --test` 直跑。
 * 覆盖 review 后加固的四个判定点：白名单 fail-closed、事件归一化、项目号 path-injection 防护、
 * 文档同步禁写校验。这些是无监督改代码的信任边界，回归必须挡住。
 *
 *   node --test common/agent-scripts/__tests__/lark-pure.test.mjs
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isForBot, isWhitelisted, normalizeMessage } from '../lark-gateway.mjs'
import { resolveWorkContext, safeProject } from '../lark-worker.mjs'
import { validateSource } from '../sync-lark-docs.mjs'

const BOT = 'ou_bot'
const ME = 'ou_me'

// ---------------------------------------------------------------------------
// normalizeMessage：两种信封（lark-cli 拍平 / 官方嵌套）归一
// ---------------------------------------------------------------------------
describe('normalizeMessage', () => {
  it('非对象 / 无 message_id → null', () => {
    assert.equal(normalizeMessage(null), null)
    assert.equal(normalizeMessage('x'), null)
    assert.equal(normalizeMessage({ chat_id: 'oc_1' }), null)
  })

  it('lark-cli 拍平结构：顶层字段 + 字符串 mention.id + 去内联 @名字 + root_id 作 replyTo', () => {
    const msg = normalizeMessage({
      message_id: 'om_1',
      chat_id: 'oc_1',
      chat_type: 'group',
      message_type: 'text',
      sender_id: ME,
      content: '@小助手 修复登录页',
      mentions: [{ id: BOT, key: '@_user_1', name: '小助手' }],
      root_id: 'om_parent',
    })
    assert.equal(msg.messageId, 'om_1')
    assert.equal(msg.chatId, 'oc_1')
    assert.equal(msg.senderOpenId, ME)
    assert.equal(msg.mentions[0].id, BOT) // 字符串形态直接取
    assert.equal(msg.text, '修复登录页') // @小助手 已剥除
    assert.equal(msg.replyTo, 'om_parent')
  })

  it('官方嵌套 webhook：event.message.* + content JSON 串 + mention.id.open_id', () => {
    const msg = normalizeMessage({
      event: {
        message: {
          message_id: 'om_2',
          chat_id: 'oc_2',
          chat_type: 'group',
          message_type: 'text',
          content: JSON.stringify({ text: '看看这个' }),
          mentions: [{ id: { open_id: BOT }, key: '@_user_1', name: 'bot' }],
        },
        sender: { sender_id: { open_id: ME } },
      },
    })
    assert.equal(msg.messageId, 'om_2')
    assert.equal(msg.senderOpenId, ME)
    assert.equal(msg.mentions[0].id, BOT) // { open_id } 形态取 open_id
    assert.equal(msg.text, '看看这个')
  })

  it('post 富文本：抽出文本 + 图片 image_key 进 attachments', () => {
    const post = {
      zh_cn: {
        content: [
          [
            { tag: 'text', text: '背景色不对' },
            { tag: 'img', image_key: 'img_k1', width: 100, height: 200 },
          ],
        ],
      },
    }
    const msg = normalizeMessage({
      message_id: 'om_3',
      chat_id: 'oc_3',
      message_type: 'post',
      content: JSON.stringify(post),
      mentions: [],
    })
    assert.equal(msg.text, '背景色不对')
    assert.equal(msg.attachments.length, 1)
    assert.deepEqual(msg.attachments[0], { type: 'image', imageKey: 'img_k1', width: 100, height: 200 })
  })
})

// ---------------------------------------------------------------------------
// isForBot：p2p 恒真；群里需命中 botOpenId / @所有人
// ---------------------------------------------------------------------------
describe('isForBot', () => {
  const config = { botOpenId: BOT }
  it('p2p 直发始终算给 bot', () => {
    assert.equal(isForBot({ msg: { chatType: 'p2p', mentions: [] }, config }), true)
  })
  it('群里 mention 命中 botOpenId → true', () => {
    assert.equal(isForBot({ msg: { chatType: 'group', mentions: [{ id: BOT }] }, config }), true)
  })
  it('群里 mention 未命中 → false', () => {
    assert.equal(isForBot({ msg: { chatType: 'group', mentions: [{ id: 'ou_other' }] }, config }), false)
  })
  it('群里 @所有人（key=@_all）→ true', () => {
    assert.equal(isForBot({ msg: { chatType: 'group', mentions: [{ key: '@_all' }] }, config }), true)
  })
  it('未配置 botOpenId 时：有任意 mention 即算', () => {
    assert.equal(isForBot({ msg: { chatType: 'group', mentions: [{ id: 'x' }] }, config: {} }), true)
    assert.equal(isForBot({ msg: { chatType: 'group', mentions: [] }, config: {} }), false)
  })
})

// ---------------------------------------------------------------------------
// isWhitelisted：fail-closed + 群级信任边界（review P0-1 核心）
// ---------------------------------------------------------------------------
describe('isWhitelisted (fail-closed, 群级信任)', () => {
  it('完全没配白名单 → 拒绝所有事件（fail-closed，绝不 fail-open）', () => {
    assert.equal(isWhitelisted({ msg: { chatType: 'group', chatId: 'oc_1' }, config: {} }), false)
    assert.equal(isWhitelisted({ msg: { chatType: 'p2p', senderOpenId: ME }, config: {} }), false)
    assert.equal(
      isWhitelisted({ msg: { chatType: 'group', chatId: 'oc_1' }, config: { allowedChatIds: [], allowedOpenIds: [] } }),
      false,
    )
  })

  it('群消息按群放行、不按发送人过滤（群内 QA/PM/后台 @ 都能触发）', () => {
    const config = { allowedChatIds: ['oc_ok'] }
    // 白名单群里任意发送人都放行
    assert.equal(isWhitelisted({ msg: { chatType: 'group', chatId: 'oc_ok', senderOpenId: 'ou_qa' }, config }), true)
    assert.equal(isWhitelisted({ msg: { chatType: 'group', chatId: 'oc_ok', senderOpenId: 'ou_pm' }, config }), true)
    // 非白名单群一律拒绝
    assert.equal(isWhitelisted({ msg: { chatType: 'group', chatId: 'oc_bad', senderOpenId: ME }, config }), false)
  })

  it('p2p 直发无群作锚点：只放行白名单用户', () => {
    const config = { allowedOpenIds: [ME] }
    assert.equal(isWhitelisted({ msg: { chatType: 'p2p', senderOpenId: ME }, config }), true)
    assert.equal(isWhitelisted({ msg: { chatType: 'p2p', senderOpenId: 'ou_stranger' }, config }), false)
  })

  it('只配了群白名单时，p2p 直发被拒（用户名单为空）', () => {
    const config = { allowedChatIds: ['oc_ok'] }
    assert.equal(isWhitelisted({ msg: { chatType: 'p2p', senderOpenId: ME }, config }), false)
  })
})

// ---------------------------------------------------------------------------
// safeProject：项目号归一 + path-injection 防护（review P0-4）
// ---------------------------------------------------------------------------
describe('safeProject', () => {
  it('合法项目号归一为大写', () => {
    assert.equal(safeProject('pr-01947'), 'PR-01947')
    assert.equal(safeProject(' PM-1469 '), 'PM-1469')
  })
  it('非法/危险值一律空串（不作为路径/分支片段）', () => {
    assert.equal(safeProject('../../etc'), '')
    assert.equal(safeProject('PR-1'), '') // 位数不足
    assert.equal(safeProject('DROP TABLE'), '')
    assert.equal(safeProject(''), '')
    assert.equal(safeProject(null), '')
    assert.equal(safeProject(undefined), '')
  })
})

// ---------------------------------------------------------------------------
// resolveWorkContext：路由 + 分支命名（tail-8 防撞车）
// ---------------------------------------------------------------------------
describe('resolveWorkContext', () => {
  const cfg = { projectId: 'PR-01947', projectName: 'x' }

  it('非法项目号 → adhoc 临时 worktree（不越目录）', () => {
    const ctx = resolveWorkContext(cfg, { project: '../../x', id: 'om_abcdefgh12345678' })
    assert.equal(ctx.hotfixBranch, 'hotfix/adhoc-12345678')
    assert.equal(ctx.projectId, '(adhoc)')
    assert.ok(ctx.cwd.includes('.lark-hotfix'))
  })

  it('无项目号 → adhoc 临时 worktree', () => {
    const ctx = resolveWorkContext(cfg, { id: 'om_xxxxxxxx87654321' })
    assert.equal(ctx.hotfixBranch, 'hotfix/adhoc-87654321')
  })

  it('合法但本地无 worktree 的项目 → 临时 hotfix 分支（项目号大写归一）', () => {
    const ctx = resolveWorkContext(cfg, { project: 'pr-99999', id: 'om_zzzzzzzzABCDEFGH' })
    assert.equal(ctx.hotfixBranch, 'hotfix/PR-99999-ABCDEFGH')
    assert.equal(ctx.projectId, 'PR-99999')
  })

  it('分支后缀取 id 尾 8 位（同群 messageId 共享长前缀，取头会撞车）', () => {
    const a = resolveWorkContext(cfg, { project: 'PR-99999', id: 'om_x100b68708_AAAA0001' })
    const b = resolveWorkContext(cfg, { project: 'PR-99999', id: 'om_x100b68708_AAAA0002' })
    assert.notEqual(a.hotfixBranch, b.hotfixBranch) // 尾部不同 → 分支不同
    assert.ok(a.hotfixBranch.endsWith('AAAA0001'))
  })

  it('recordId 优先于 id 作分支后缀', () => {
    const ctx = resolveWorkContext(cfg, { project: 'PR-99999', recordId: 'recABCDEFGH', id: 'om_ignored' })
    assert.ok(ctx.hotfixBranch.endsWith('ecABCDEFGH'.slice(-8)))
  })
})

// ---------------------------------------------------------------------------
// validateSource：文档同步只读，禁写校验扫全命令 token（review P2）
// ---------------------------------------------------------------------------
describe('validateSource (read-only guard)', () => {
  it('不支持的 service type → 抛错', () => {
    assert.throws(() => validateSource({ type: 'sheet', url: 'http://x' }), /unsupported Lark source type/)
  })
  it('不支持的 operation → 抛错', () => {
    assert.throws(() => validateSource({ type: 'doc', url: 'http://x', operation: 'write' }), /unsupported Lark source operation/)
  })
  it('缺 url → 抛错', () => {
    assert.throws(() => validateSource({ type: 'doc' }), /requires url/)
  })
  it('合法 docs +fetch → 返回命令数组', () => {
    const cmd = validateSource({ type: 'doc', url: 'http://x' })
    assert.ok(Array.isArray(cmd))
    assert.ok(cmd.includes('+fetch'))
  })
  it('自定义命令里夹带写类 token（delete）→ 抛错（禁写扫全 token）', () => {
    assert.throws(
      () => validateSource({ type: 'docs', url: 'http://x', command: ['lark-cli', 'docs', '+fetch', '--doc', 'http://x', '--mode', 'delete'] }),
      /forbidden write-like token/,
    )
  })
  it('+fetch 只允许 docs，其它 service 用 +fetch → 抛错', () => {
    assert.throws(
      () => validateSource({ type: 'wiki', url: 'http://x', command: ['lark-cli', 'wiki', '+fetch', '--url', 'http://x'] }),
      /\+fetch is only allowed for docs/,
    )
  })
})
