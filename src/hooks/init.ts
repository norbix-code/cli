import type {Hook} from '@oclif/core'

import {disableColorIfNeeded} from '../lib/color.js'
import {cachePath, planUpdateCheck, readCache, spawnRefresh, writeCache} from '../lib/update-check.js'

/**
 * Runs before every command: no ANSI codes with --json, NO_COLOR or a pipe;
 * and the "a newer CLI exists" notice (lib/update-check.ts) — one stderr
 * line from a cache, never a network wait.
 */
const hook: Hook<'init'> = async function (opts) {
  disableColorIfNeeded(opts.argv)
  try {
    const path = cachePath()
    const now = Date.now()
    const plan = planUpdateCheck({version: opts.config.version, commandId: opts.id, cache: readCache(path), now})
    if (plan.notice) process.stderr.write(plan.notice + '\n')
    if (plan.refresh) {
      // Claim the check first, so parallel commands start one child, not many.
      writeCache({...plan.cache, checkedAt: new Date(now).toISOString()}, path)
      spawnRefresh()
    } else if (plan.notice) {
      writeCache(plan.cache, path)
    }
  } catch {
    /* the notice is never worth a failed command */
  }
}

export default hook
