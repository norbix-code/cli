import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {usageError} from '../../lib/cli-error.js'

/** The gateway's rule for an environment name (Env.Create): A–Z, 0–9, space, ≤ 15, not PROD. */
export function checkEnvName(raw: string): string {
  const name = raw.trim().toUpperCase()
  if (name === 'PROD') throw usageError('PROD always exists and cannot be created.', 'Pick another name, e.g. TEST or STAGING.', 'norbix env create --help')
  if (!/^[A-Z0-9 ]{1,15}$/.test(name)) {
    throw usageError(`"${raw}" is not an environment name.`, 'Use A–Z, 0–9 and spaces, at most 15 characters (e.g. TEST, STAGING).', 'norbix env create --help')
  }

  return name
}

export default class EnvCreate extends BaseCommand {
  static description = `Create a project environment (TEST, STAGING, …) together with its database

A new environment starts with exactly one integration: its own database, which
becomes its default. Every other integration (files, email, …) is added inside
the environment afterwards (--env <NAME>). Give the database one of two ways:

  --connection-string-env VAR   your own MongoDB: the NAME of an environment
                                variable that holds the connection string (the
                                string itself never goes on the command line or
                                into a dry-run report); --database-name picks
                                the database on that server
  --managed                     a Norbix-managed database (norbix.ai), in
                                --db-region or the project's region

There is no "same server as PROD, new database" option: the Hub does not hand
out PROD's connection string, so pass it yourself. Creating an environment is
not available during a norbix.ai managed-service trial (each one is an extra
database); a self-hosted licence is not a trial.

Then work in it: \`norbix env use <NAME>\` or --env <NAME> per command.`

  static examples = [
    'NORBIX_TEST_DB="mongodb+srv://…" <%= config.bin %> env create TEST --connection-string-env NORBIX_TEST_DB --database-name happy-tummy-test --dry-run',
    '<%= config.bin %> env create TEST --connection-string-env NORBIX_TEST_DB --database-name happy-tummy-test',
    '<%= config.bin %> env create STAGING --managed --db-region nb-eu-germany',
  ]

  static args = {
    name: Args.string({required: true, description: 'Environment name: A–Z, 0–9, space, up to 15 characters (not PROD)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    'connection-string-env': Flags.string({
      description: 'Name of the environment variable holding the MongoDB connection string of the new database',
      exactlyOne: ['connection-string-env', 'managed'],
    }),
    'database-name': Flags.string({description: 'Database on that server (with --connection-string-env)', dependsOn: ['connection-string-env']}),
    managed: Flags.boolean({description: 'A Norbix-managed database (norbix.ai)', exactlyOne: ['connection-string-env', 'managed']}),
    'db-region': Flags.string({description: 'Region of the managed database (default: --region / the project region)', dependsOn: ['managed']}),
    'integration-name': Flags.string({description: 'Name of the database integration (default "<NAME> database")'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EnvCreate)
    const name = checkEnvName(args.name)
    const integrationName = flags['integration-name'] ?? `${name} database`
    const client = this.client(flags)

    let integration: Record<string, unknown>
    if (flags.managed) {
      const region = flags['db-region'] ?? this.resolveContext(flags).region
      if (!region) throw usageError('--managed needs the region of the database.', 'Pass --db-region <code> (e.g. nb-eu-germany).', 'norbix env create --help')
      integration = {provider: 'CodeMashMongoDbAtlasFlexManaged', integrationName, isEnabled: true, norbixRegionCode: region}
    } else {
      const variable = flags['connection-string-env']!
      const value = process.env[variable]?.trim()
      if (!value && !flags['dry-run']) {
        throw usageError(
          `The environment variable ${variable} is empty or not set.`,
          `Put the new database's connection string there first, e.g. export ${variable}='mongodb+srv://user:pass@cluster/'.`,
          'norbix env create --help',
        )
      }

      integration = {
        provider: 'MongoDbConnectionString',
        integrationName,
        isEnabled: true,
        // A dry run prints the body: it shows the variable, never the secret.
        connectionString: flags['dry-run'] ? `$${variable}` : value,
        ...(flags['database-name'] ? {databaseName: flags['database-name']} : {}),
      }
    }

    // `integration` is the gateway's polymorphic DatabaseIntegrationRequest; its
    // JSON converter picks the subtype from `provider`.
    const res = await client.hub.environments.create({
      environmentName: name,
      integration: integration as never,
    })

    this.print(`Environment ${name} created with its database integration "${integrationName}". Use it with --env ${name} or \`norbix env use ${name}\`.`)
    return res ?? {environment: name}
  }
}
