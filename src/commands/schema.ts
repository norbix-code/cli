import {Args} from '@oclif/core'

import {BaseCommand} from '../base.js'
import {usageError} from '../lib/cli-error.js'
import {VALUE_RULES} from '../lib/namespace-command.js'
import {buildSchema, formatSchemaTable, type CommandDescriptor} from '../lib/schema.js'

export default class Schema extends BaseCommand {
  static description = `Describe the CLI as data: every command with its args, flags, examples, whether it is destructive and whether it supports --dry-run.

Made for coding agents and scripts: run it once with --json, then
\`norbix <command> --help\` for details. The plain-word \`hub\` / \`api\`
commands are dynamic — their methods and request fields come from
\`norbix hub <module> --json\`.`

  static examples = [
    '<%= config.bin %> schema',
    '<%= config.bin %> schema --json',
    '<%= config.bin %> schema users delete --json',
    '<%= config.bin %> schema db --json',
  ]

  static strict = false

  static args = {
    command: Args.string({required: false, description: 'A command ("users delete") or topic ("db") to describe; omit for everything'}),
  }

  async run(): Promise<unknown> {
    const {argv, flags} = await this.parse(Schema)
    void flags
    const wanted = (argv as string[]).join(' ').trim()

    const own = this.config.commands.filter((c) => c.pluginName === this.config.pjson.name)
    const descriptors: CommandDescriptor[] = own.map((c) => ({
      id: c.id,
      description: c.description,
      hidden: c.hidden,
      args: c.args as CommandDescriptor['args'],
      flags: c.flags as CommandDescriptor['flags'],
      examples: c.examples as CommandDescriptor['examples'],
    }))

    const schema = buildSchema({version: this.config.version, bin: this.config.bin, commands: descriptors, valueRules: VALUE_RULES})

    if (wanted) {
      const id = wanted.replaceAll(':', ' ')
      const matched = schema.commands.filter((c) => c.id === id || c.id.startsWith(`${id} `))
      if (matched.length === 0) {
        throw usageError(`No command or topic "${wanted}".`, 'Run `norbix schema` for the list.', 'norbix schema --help')
      }

      schema.commands = matched
    }

    this.print(formatSchemaTable(schema))
    return schema
  }
}
