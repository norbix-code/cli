import {Flags} from '@oclif/core'

import {usageError} from './cli-error.js'
import {readJsonArray} from './email.js'

/**
 * The membership e-mails whose template tokens can be bound
 * (`GET membership/settings/email-bindings?setting=…`, `bindingsEvent` on the save).
 */
export const MEMBERSHIP_EMAILS = ['Welcome', 'Verification', 'PasswordReset', 'Invitation', 'Deactivation', 'LoginAlert'] as const

const BINDINGS_HELP =
  'Token values as a JSON array: [{"token":"Order.Number","kind":"Fixed|Field|Empty","value":"…","translations":[{"language":"lt","value":"…"}]}] — inline, @file.json or - for stdin'

/** `--bindings` — the values of the tokens Norbix does not fill. */
export const bindingsFlag = Flags.string({description: BINDINGS_HELP})

/** `--bindings`, required. */
export const requiredBindingsFlag = Flags.string({description: BINDINGS_HELP, required: true})

/** Read and check `--bindings`: an array of objects, each with a token and a kind the gateway knows. */
export async function bindingsOf(value: string): Promise<Array<Record<string, unknown>>> {
  const items = await readJsonArray(value, 'bindings')
  for (const [i, item] of items.entries()) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw usageError(`--bindings: item ${i + 1} is not an object.`, 'Each binding is {"token": "…", "kind": "Fixed", "value": "…"}.')
    }

    const {token, kind} = item as Record<string, unknown>
    if (typeof token !== 'string' || token.trim() === '') {
      throw usageError(`--bindings: item ${i + 1} has no "token".`, 'List the tokens with `norbix membership settings email-bindings <setting>`.')
    }

    if (kind !== undefined && kind !== 'Fixed' && kind !== 'Field' && kind !== 'Empty') {
      throw usageError(`--bindings: item ${i + 1} has kind "${String(kind)}".`, 'kind is Fixed (a text), Field (a field of the event) or Empty.')
    }
  }

  return items as Array<Record<string, unknown>>
}
