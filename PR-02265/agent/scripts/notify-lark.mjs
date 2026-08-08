#!/usr/bin/env node

import { runNotifyLark } from '../../../common/engine/agent-scripts/notify-lark.mjs'

runNotifyLark({
  defaultConfigPath: 'apps/web/docs_tdd/PR-02265/agent/scripts/pr-02265.json',
}).catch((error) => {
  console.error(error.message)
  process.exit(1)
})
