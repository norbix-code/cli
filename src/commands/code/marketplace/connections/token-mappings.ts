import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'
import {usageError} from '../../../../lib/cli-error.js'
import {readJsonInput} from '../../../../lib/json.js'

interface TokenMapping {
  key: string
  value: string
  resolver: string
}

/** A JSON array of mappings, or `{"tokenMappings": [...]}` (a `connections get --json` answer works too). */
export function readTokenMappings(text: string): TokenMapping[] {
  const parsed = JSON.parse(text) as unknown
  const holder = parsed as {tokenMappings?: unknown; item?: {tokenMappings?: unknown}}
  const list = Array.isArray(parsed) ? parsed : (holder.tokenMappings ?? holder.item?.tokenMappings)
  if (!Array.isArray(list) || list.some((m) => !m || typeof m !== 'object' || typeof (m as TokenMapping).key !== 'string')) {
    throw usageError(
      '--file must hold a JSON array of token mappings ({"key", "value", "resolver"}), or an object with tokenMappings.',
      'e.g. [{"key": "Channel", "value": "#sales", "resolver": "Custom"}]',
    )
  }

  return list as TokenMapping[]
}

export default class CodeMarketplaceConnectionsTokenMappings extends BaseCommand {
  static description = `Replace the shared token mappings of a connection

The token mappings every function of the connection inherits (a function's own mappings win). The list replaces the whole stored list: send every mapping, an empty array clears them. Each mapping is {"key", "value", "resolver"} — resolver Custom takes the value as it is; Project, Initiator, TargetUser, … read it from that source. --file takes a JSON array, an object with tokenMappings (a \`connections get --json\` answer), @file or - for stdin.`

  static examples = [
    '<%= config.bin %> code marketplace connections token-mappings int_6rBACnEaxQ0x1jTiHtAuWV --file mappings.json --yes',
    '<%= config.bin %> code marketplace connections token-mappings int_6rBACnEaxQ0x1jTiHtAuWV --file \'[{"key":"Channel","value":"#sales","resolver":"Custom"}]\' --dry-run',
    '<%= config.bin %> code marketplace connections token-mappings int_6rBACnEaxQ0x1jTiHtAuWV --file \'[]\' --yes',
  ]

  static args = {
    id: Args.string({required: true, description: 'Connection ID (int_…)'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
    file: Flags.string({required: true, description: 'The mappings: a path, inline JSON, @file or -'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeMarketplaceConnectionsTokenMappings)
    const source = flags.file === '-' || flags.file.startsWith('@') || /^\s*[[{]/.test(flags.file) ? flags.file : `@${flags.file}`
    const tokenMappings = readTokenMappings(await readJsonInput(source, 'file'))
    const client = this.client(flags)
    await this.confirmOrFail(`Replace the token mappings of connection ${args.id} with ${tokenMappings.length}?`, flags)

    const res = await client.hub.code.setMarketplaceIntegrationTokenMappings({
      integrationViewId: args.id,
      tokenMappings,
    } as unknown as Parameters<typeof client.hub.code.setMarketplaceIntegrationTokenMappings>[0])

    this.print(`Token mappings of connection ${args.id} replaced (${tokenMappings.length}).`)
    return res
  }
}
