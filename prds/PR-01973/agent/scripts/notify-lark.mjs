#!/usr/bin/env node

import { runNotifyLark } from '../../../../common/engine/agent-scripts/notify-lark.mjs'

runNotifyLark({
  defaultConfigPath: 'apps/web/docs_tdd/prds/PR-01973/agent/scripts/pr-01973.json',
}).catch((error) => {
  console.error(error.message)
  process.exit(1)
})

