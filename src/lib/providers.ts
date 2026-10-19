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
  return Flags.string({
    required: true,
    description: `${kind} provider`,
    options: [SANDBOX, ...real],
    async parse(input) {
      return input === SANDBOX ? SANDBOX_API_VALUE : input
    },
  })
}
