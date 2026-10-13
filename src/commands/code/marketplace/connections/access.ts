import {Args} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'
import {formatAccessMatrix} from '../../../../lib/marketplace.js'

export default class CodeMarketplaceConnectionsAccess extends BaseCommand {
  static description = `Show who may use a connection: the access matrix

One row per role (account roles and this project's roles): the access package it holds on the connection — Viewer, Functions only, Read-only, Full access, or none — plus Manage, a Custom policy, and "fixed" for Root and Project Admin (always Full access + Manage). A note explains when the safe default (Read-only for Projects Developer) was not applied. Then the packages that exist, the tool and function counts, and the tools that can only be reached through Full access. --json prints the whole matrix: roles, packages, tools, functions. Change a role with \`connections access set\` or \`connections access custom\`.`

  static examples = [
    '<%= config.bin %> code marketplace connections access int_6rBACnEaxQ0x1jTiHtAuWV',
    '<%= config.bin %> code marketplace connections access int_6rBACnEaxQ0x1jTiHtAuWV --json',
  ]

  static args = {
    id: Args.string({required: true, description: 'Connection ID (int_…)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeMarketplaceConnectionsAccess)
    const client = this.client(flags)

    const res = await client.hub.code.getMarketplaceIntegrationAccess({integrationViewId: args.id})

    this.print(formatAccessMatrix(res))
    return res
  }
}
