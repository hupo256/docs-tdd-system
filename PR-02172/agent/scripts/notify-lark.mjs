#!/usr/bin/env node

import { runNotifyLark } from '../../../common/engine/agent-scripts/notify-lark.mjs'

runNotifyLark({
  defaultConfigPath: 'apps/web/docs_tdd/PR-02172/agent/scripts/pr-02172.json',
}).catch((error) => {
  console.error(error.message)
  process.exit(1)
})
