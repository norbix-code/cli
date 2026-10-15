import type {Hook} from '@oclif/core'

import {EXIT} from '../lib/exit-codes.js'
import {formatErrorText, type ErrorEnvelope} from '../lib/cli-error.js'

/**
 * Commands that moved, by the words a caller of the old one types: the hint
 * names the new command instead of the generic help text.
 */
const MOVED: Array<[RegExp, string]> = [
  // Up to 1.33 `payments enable|disable <id>` toggled a trigger; now they toggle the module.
  [/^payments (enable|disable) \S/, 'Payment trigger toggles moved: `norbix payments trigger $1 <id>`. `norbix payments $1` (no ID) turns the whole module on or off.'],
]

/**
 * Unknown command: same envelope as every other error, so `--json` callers
 * never get oclif's own text. Exit 2 (usage).
 */
const hook: Hook<'command_not_found'> = async function (opts) {
  const id = opts.id.replaceAll(':', ' ')
  const moved = MOVED.map(([words, hint]) => ({match: words.exec(id), hint})).find(({match}) => match)
  const envelope: ErrorEnvelope = {
    code: 'UNKNOWN_COMMAND',
    message: `Unknown command "${id}".`,
    exit: EXIT.USAGE,
    hint: moved
      ? moved.hint.replaceAll('$1', moved.match![1] ?? '')
      : 'List commands with `norbix --help` or `norbix schema --json`. Any SDK endpoint is reachable with `norbix hub ...` / `norbix api ...`.',
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
