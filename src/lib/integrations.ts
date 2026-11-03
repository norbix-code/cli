/**
 * Shared bits of the `<module> integration save` commands of the modules that
 * have no provider-specific flags (files, code, logs, membership): the body
 * built from --provider / --name / --id / --disabled and the --config JSON.
 */
import {readJsonObject} from './push.js'

export {readJsonObject}

/**
 * What every keyless-capable save needs to know (gateway keyless-cloud, 2.5):
 * put in the help text of a save command whose providers include AWS, Azure or
 * Google.
 */
export const KEYLESS_HELP = `Keyless cloud providers (AWS, Azure, Google): leave authMode out of --config, or
set it to Keyless — no secret is stored. Run \`norbix integrations keyless-setup
<module> <cloud>\` first, set up the trust it prints in the cloud account, and
save with the integration id it printed (--id). A key mode (authMode AccessKey)
is refused unless --config also carries "acceptKeyRisk": true
(CM-ERRORS-INTEGRATIONS-034).`

/** Fields `<module> integration <id>` returns that the server sets itself; never sent back. */
const READ_ONLY = [
  'viewId',
  'id',
  'env',
  'lastIntegrationTestAtUtc',
  'lastIntegrationTestSucceeded',
  'lastIntegrationTestErrors',
  'humanDeliveryConfirmedAtUtc',
  'requiresHumanDeliveryConfirmation',
]

/**
 * --config may be a bare integration or `{"integration": {...}}`, and may come
 * straight from `<module> integration <id>`. The server reads only
 * `integrationId`: a `viewId` (or `id`) would be dropped and a second
 * integration created, so it becomes the integrationId here.
 */
export function splitConfig(config: Record<string, unknown>): {id?: string; extra: Record<string, unknown>} {
  const inner =
    typeof config.integration === 'object' && config.integration !== null && !Array.isArray(config.integration)
      ? (config.integration as Record<string, unknown>)
      : config
  const id = [inner.integrationId, inner.viewId, inner.id].find((v): v is string => typeof v === 'string' && v !== '')
  const extra = Object.fromEntries(Object.entries(inner).filter(([k]) => !READ_ONLY.includes(k) && k !== 'integrationId'))
  return {id, extra}
}

export interface IntegrationSaveFlags {
  provider: string
  name?: string
  id?: string
  disabled: boolean
  config?: string
}

/**
 * The `integration` object of a save request: the --config fields first, the
 * flags on top. `provider` is the discriminator the server picks the body
 * shape by; the provider-specific fields come from --config.
 */
export async function integrationBody(flags: IntegrationSaveFlags): Promise<Record<string, unknown>> {
  const config = flags.config ? await readJsonObject(flags.config, 'config') : {}
  const {id, extra} = splitConfig(config)
  return {
    ...extra,
    provider: flags.provider,
    integrationId: flags.id ?? id,
    integrationName: flags.name ?? (extra.integrationName as string | undefined) ?? '',
    isEnabled: flags.disabled ? false : ((extra.isEnabled as boolean | undefined) ?? true),
  }
}

/** `--input key=value` (repeatable) → the string map a quick connect start takes. */
export function parseInputs(pairs: string[] | undefined): Record<string, string> | undefined {
  if (!pairs || pairs.length === 0) return undefined
  const out: Record<string, string> = {}
  for (const pair of pairs) {
    const at = pair.indexOf('=')
    if (at < 1) throw new Error(`--input "${pair}" must be key=value, e.g. storeUrl=https://shop.example.com`)
    out[pair.slice(0, at)] = pair.slice(at + 1)
  }
  return out
}
