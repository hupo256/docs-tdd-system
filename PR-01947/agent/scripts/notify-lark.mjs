#!/usr/bin/env node

import { runNotifyLark } from '../../../common/agent-scripts/notify-lark.mjs'

runNotifyLark({
  defaultConfigPath: 'apps/web/docs_tdd/PR-01947/agent/scripts/lark-bot.local.json',
}).catch((error) => {
  console.error(error.message)
  process.exit(1)
})
