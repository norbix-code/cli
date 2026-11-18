import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {usageError} from '../../lib/cli-error.js'
import {integrationBody} from '../../lib/integrations.js'

export default class EnvCreate extends BaseCommand {
  static description = `Add an environment (TEST, STAGING, …) to the project

The new environment starts with one integration: the MongoDB database of
--connection-string (other fields can come from --config: inline JSON, @file
or -). Every other integration is added inside the environment afterwards
(--env <name>). Names: A-Z, 0-9 and spaces, up to 15 characters, not PROD.
A dry run prints the connection string as ***.

A Norbix-managed database for the environment is created in the dashboard:
it is placed on a cluster of the account.`

  static examples = [
    '<%= config.bin %> env create TEST --connection-string mongodb+srv://app:secret@cluster0.example.mongodb.net --database shop_test',
    '<%= config.bin %> env create STAGING --config @staging-db.json --dry-run',
  ]

  static args = {
    name: Args.string({required: true, description: 'Environment name, e.g. TEST'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    'connection-string': Flags.string({description: 'MongoDB connection string (mongodb:// or mongodb+srv://)'}),
    database: Flags.string({description: 'Database name'}),
    'integration-name': Flags.string({description: 'Name of the database integration (default: "<NAME> database")'}),
    config: Flags.string({description: 'Database integration fields as a JSON object, @file or -'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EnvCreate)
    const name = args.name.trim().toUpperCase()
    if (name === 'PROD') throw usageError('PROD exists in every project; name another environment.')

    const integration = await integrationBody({
      provider: 'MongoDbConnectionString',
      config: flags.config,
      name: flags['integration-name'],
      disabled: false,
    })
    if (!integration.integrationName) integration.integrationName = `${name} database`
    if (flags['connection-string'] !== undefined) integration.connectionString = flags['connection-string']
    if (flags.database !== undefined) integration.databaseName = flags.database
    if (typeof integration.connectionString !== 'string' || integration.connectionString === '') {
      throw usageError('Pass --connection-string (or connectionString in --config).')
    }

    const client = this.client(flags)
    // The provider fields are not on the generated base type: the server
    // picks the shape from `provider`.
    const res = await client.hub.environments.create({environmentName: name, integration} as never)
    // The project has one environment more: read the list again next time.
    if (!flags['dry-run']) this.forgetEnvs(this.resolveContext(flags))
    this.print(`Environment ${name} created.`)
    return res
  }
}
