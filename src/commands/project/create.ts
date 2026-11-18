import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {usageError} from '../../lib/cli-error.js'
import {integrationBody} from '../../lib/integrations.js'

export default class ProjectCreate extends BaseCommand {
  static description = `Create a project on your own MongoDB database

The project keeps its data in the database of --connection-string (other
fields of the database integration can come from --config: inline JSON,
@file or -). --primary is the primary region (\`account regions\` lists
them; the default is the region of the command, --region). A dry run prints
the connection string as ***.

The project prepares itself in the background: run \`project wait-active
--project <id>\` once before you build inside it. A project on a
Norbix-managed database is created in the dashboard: it is placed on a
cluster of the account and counts against the plan.`

  static examples = [
    '<%= config.bin %> project create --name Shop --primary nb-eu-germany --connection-string mongodb+srv://app:secret@cluster0.example.mongodb.net --database shop',
    '<%= config.bin %> project create --name Shop --primary nb-eu-germany --config @mongo.json --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    name: Flags.string({description: 'Project name (unique in the account)', required: true}),
    primary: Flags.string({description: 'Primary region code, e.g. nb-eu-germany (default: --region)'}),
    additional: Flags.string({description: 'Another region for app data (repeatable)', multiple: true}),
    description: Flags.string({description: 'Short description'}),
    'connection-string': Flags.string({description: 'MongoDB connection string (mongodb:// or mongodb+srv://)'}),
    database: Flags.string({description: 'Database name'}),
    'integration-name': Flags.string({description: 'Name of the database integration (default: "<name> database")'}),
    config: Flags.string({description: 'Database integration fields as a JSON object, @file or -'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectCreate)
    const integration = await integrationBody({
      provider: 'MongoDbConnectionString',
      config: flags.config,
      name: flags['integration-name'],
      disabled: false,
    })
    if (!integration.integrationName) integration.integrationName = `${flags.name} database`
    if (flags['connection-string'] !== undefined) integration.connectionString = flags['connection-string']
    if (flags.database !== undefined) integration.databaseName = flags.database
    if (typeof integration.connectionString !== 'string' || integration.connectionString === '') {
      throw usageError('Pass --connection-string (or connectionString in --config).')
    }

    // An account-level call: no project yet, so no project header and no env rule.
    const client = this.client(flags, {requireProject: false, account: true})
    const primaryRegion = flags.primary ?? this.resolveContext(flags).region
    const res = await client.hub.account.createProject({
      projectName: flags.name,
      ...(primaryRegion ? {primaryRegion} : {}),
      ...(flags.additional ? {additionalRegions: flags.additional} : {}),
      ...(flags.description ? {description: flags.description} : {}),
      // The provider fields are not on the generated base type: the server
      // picks the shape from `provider`.
      integration,
    } as never)

    this.print(res)
    return res
  }
}
