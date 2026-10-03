import type {Hook} from '@oclif/core'

import {disableColorIfNeeded} from '../lib/color.js'

/** Runs before every command: no ANSI codes with --json, NO_COLOR or a pipe. */
const hook: Hook<'init'> = async function (opts) {
  disableColorIfNeeded(opts.argv)
}

export default hook
