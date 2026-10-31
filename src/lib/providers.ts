import {Flags} from '@oclif/core'

/**
 * The built-in provider that accepts every send and contacts no real
 * service. Users see "Sandbox"; the API value stays "Fake".
 */
export const SANDBOX = 'Sandbox'
const SANDBOX_API_VALUE = 'Fake'

/**
 * `--provider` for email / SMS / push integrations: offers `Sandbox` next to
 * the real providers and gives the API value, so the request carries
 * `provider: "Fake"`. Real provider names pass as they are.
 */
export function providerFlag(kind: string, real: string[]) {
  const allowed = [SANDBOX, ...real]
  return Flags.string({
    required: true,
    description: `${kind} provider (${allowed.join(', ')}; case does not matter)`,
    async parse(input) {
      // The server parses the provider name case-insensitively; so does the flag
      // (`azureCommunication` and `AzureCommunication` are the same provider).
      const match = allowed.find((p) => p.toLowerCase() === input.toLowerCase())
      if (!match) throw new Error(`Expected --provider=${input} to be one of: ${allowed.join(', ')}`)
      return match === SANDBOX ? SANDBOX_API_VALUE : match
    },
  })
}
