import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {usageError} from '../../../lib/cli-error.js'
import {integrationBody} from '../../../lib/integrations.js'

export default class DbIntegrationSave extends BaseCommand {
  static description = `Connect your own MongoDB database

Creates a database integration from a connection string, in the request
environment (--env). --connection-string carries the user and password; with
--keyless it has no user (mongodb+srv://cluster.example.mongodb.net) and
Norbix signs in with its own token (Atlas M10+, the cluster must trust the
Norbix issuer; --audience defaults to norbix-atlas). A dry run prints the
connection string as ***.

Other provider fields can come from --config (inline JSON, @file or -), e.g.
the output of \`db integration <id> --json\`. Test the connection with
\`db integration test <id>\`, make it the default with
\`db integration default <id>\`.

A Norbix-managed database is created in the dashboard: it is placed on a
cluster of the account (\`account clusters\` lists them, \`db integrations
flex-tiers\` the tiers you may use).`

  static examples = [
    '<%= config.bin %> db integration save --name Main --connection-string mongodb+srv://app:secret@cluster0.example.mongodb.net --database shop',
    '<%= config.bin %> db integration save --name Main --connection-string mongodb+srv://cluster0.example.mongodb.net --keyless',
    '<%= config.bin %> db integration save --name Main --config @mongo.json --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    name: Flags.string({description: 'Integration name'}),
    'connection-string': Flags.string({description: 'MongoDB connection string (mongodb:// or mongodb+srv://)'}),
    database: Flags.string({description: 'Database name'}),
    keyless: Flags.boolean({description: 'Sign in with the Norbix token instead of a password (Atlas M10+)', default: false}),
    audience: Flags.string({description: 'Keyless: audience of the Atlas workload identity provider', dependsOn: ['keyless']}),
    id: Flags.string({description: 'Integration ID to save under (default: a new one)'}),
    disabled: Flags.boolean({description: 'Save it turned off', default: false}),
    config: Flags.string({description: 'Provider fields as a JSON object, @file or -'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(DbIntegrationSave)
    const integration = await integrationBody({...flags, provider: 'MongoDbConnectionString'})
    if (flags['connection-string'] !== undefined) integration.connectionString = flags['connection-string']
    if (flags.database !== undefined) integration.databaseName = flags.database
    if (flags.keyless) integration.authMode = 'Keyless'
    if (flags.audience !== undefined) integration.audience = flags.audience
    if (!integration.integrationName) throw usageError('Pass --name (or integrationName in --config).')
    if (typeof integration.connectionString !== 'string' || integration.connectionString === '') {
      throw usageError('Pass --connection-string (or connectionString in --config).')
    }

    const client = this.client(flags)
    // The provider-specific fields are not on the generated base type, so the
    // body is cast: the server picks the shape from `provider`.
    const res = await client.hub.database.saveDatabaseIntegration({integration} as never)

    this.print(res)
    return res
  }
}
