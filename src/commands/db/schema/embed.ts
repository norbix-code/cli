import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class DbSchemaEmbed extends BaseCommand {
  static description = `Show the AI embed setting of a database schema

Which records go into the project's AI knowledge: enabled, fields (the
top-level fields whose values form the text), embeddingIntegrationId (empty =
the project's default embedding integration) and perUser (each record's
knowledge belongs to its owner only). Empty = never set = off. Change it with
\`db schema embed set\`.`

  static examples = ['<%= config.bin %> db schema embed sch_7lPCzWonEvTQsheGDCaKq']

  static args = {
    id: Args.string({required: true, description: 'Schema ID (sch_…)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbSchemaEmbed)
    const client = this.client(flags)

    const res = await client.hub.database.getDatabaseSchema({id: args.id})
    const embed = res?.item?.embed ?? {enabled: false, fields: []}

    this.print(embed)
    return embed
  }
}
