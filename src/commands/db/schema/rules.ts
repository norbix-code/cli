import {BaseCommand} from '../../../base.js'
import {SCHEMA_NEVER, SCHEMA_RULES, schemaRulesText} from '../../../lib/schema-rules.js'

export default class DbSchemaRules extends BaseCommand {
  static description = `Print the schema design rules — read them before writing a data schema

Which field for which value: emails and links need a format, language /
currency / country and every list people pick from are taxonomy pickers,
user ids are user references, money is a currency field, dates are epoch
integers. Each rule comes with the exact dataSchema JSON shape. Works
offline: nothing is sent to the Hub. \`db schema create\` prints the Hub's
warnings when a saved schema breaks one of these rules.`

  static examples = ['<%= config.bin %> db schema rules', '<%= config.bin %> db schema rules --json']

  async run(): Promise<unknown> {
    await this.parse(DbSchemaRules)
    this.print(schemaRulesText())
    return {rules: SCHEMA_RULES, never: SCHEMA_NEVER}
  }
}
