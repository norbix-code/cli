import type {Hook} from '@oclif/core'

import {EXIT} from '../lib/exit-codes.js'
import {formatErrorText, type ErrorEnvelope} from '../lib/cli-error.js'

/**
 * Unknown command: same envelope as every other error, so `--json` callers
 * never get oclif's own text. Exit 2 (usage).
 */
const hook: Hook<'command_not_found'> = async function (opts) {
  const id = opts.id.replaceAll(':', ' ')
  const envelope: ErrorEnvelope = {
    code: 'UNKNOWN_COMMAND',
    message: `Unknown command "${id}".`,
    exit: EXIT.USAGE,
    hint: 'List commands with `norbix --help` or `norbix schema --json`. Any SDK endpoint is reachable with `norbix hub ...` / `norbix api ...`.',
    docs: 'norbix --help',
  }

  if (opts.argv?.includes('--json')) {
    process.stdout.write(JSON.stringify({error: envelope}, null, 2) + '\n')
  } else {
    process.stderr.write(formatErrorText(envelope) + '\n')
  }

  this.exit(EXIT.USAGE)
}

export default hook
