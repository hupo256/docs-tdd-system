#!/usr/bin/env node

import { runNotifyLark } from '../../../common/engine/agent-scripts/notify-lark.mjs'

runNotifyLark({
  defaultConfigPath: '.lark-fe-task/PR-01988.json',
}).catch((error) => {
  console.error(error.message)
  process.exit(1)
})
