#!/usr/bin/env node

import { runNotifyLark } from '../../../common/agent-scripts/notify-lark.mjs'

runNotifyLark({
  defaultConfigPath: 'apps/web/docs_tdd/PR-02074/agent/scripts/pr-02074.json',
}).catch((error) => {
  console.error(error.message)
  process.exit(1)
})
