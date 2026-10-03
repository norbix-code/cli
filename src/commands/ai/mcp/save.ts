import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {readJsonObject} from '../../../lib/push.js'

/** The provider names the server's MCP integration converter accepts. */
const PROVIDERS = ['GitHub', 'Stripe', 'MongoDb', 'Playwright', 'BraveSearch', 'Obsidian']

export default class AiMcpSave extends BaseCommand {
  static description = `Create or update an MCP server integration

--provider picks the server and how the gateway talks to it. Every MCP
integration carries a short card — --server-name, --category, --description and
--icon are all required. Put the provider-specific fields (serverUrl, a token,
command, …) in --config as a JSON object (inline, @file.json, or - for stdin).
Pass --id to update an existing integration.`

  static examples = [
    '<%= config.bin %> ai mcp save --provider GitHub --name GitHub --server-name GitHub --category Code --description "Issues and pull requests" --icon github --config @github.json',
    '<%= config.bin %> ai mcp save --provider GitHub --name GitHub --server-name GitHub --category Code --description "Issues and pull requests" --icon github --config @github.json --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    provider: Flags.string({required: true, description: 'MCP server provider', options: PROVIDERS}),
    name: Flags.string({required: true, description: 'Integration name'}),
    id: Flags.string({description: 'Integration ID — set it to update instead of create'}),
    'server-name': Flags.string({description: 'Name shown on the tool card'}),
    category: Flags.string({description: 'Category shown on the tool card'}),
    description: Flags.string({description: 'What the server does, shown on the tool card'}),
    icon: Flags.string({description: 'Icon name shown on the tool card'}),
    disabled: Flags.boolean({description: 'Save it turned off', default: false}),
    config: Flags.string({description: 'Provider-specific fields as a JSON object, @file or -'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AiMcpSave)
    const client = this.client(flags)

    const extra = flags.config ? await readJsonObject(flags.config, 'config') : {}
    const integration = {
      ...extra,
      provider: flags.provider,
      integrationId: flags.id,
      integrationName: flags.name,
      name: flags['server-name'] ?? (extra.name as string | undefined),
      category: flags.category ?? (extra.category as string | undefined),
      description: flags.description ?? (extra.description as string | undefined),
      icon: flags.icon ?? (extra.icon as string | undefined),
      isEnabled: !flags.disabled,
    }

    // The provider-specific fields are not on the generated base type, and the
    // transport is fixed by the provider on the server, so the body is cast.
    const res = await client.hub.ai.saveMcpIntegration({integration} as unknown as Parameters<
      typeof client.hub.ai.saveMcpIntegration
    >[0])

    this.print(res)
    return res
  }
}
