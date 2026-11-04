import {BaseCommand} from '../../../base.js'
import {readJsonObject} from '../../../lib/payments.js'
import {
  AI_TRIGGER,
  AI_TRIGGER_TYPES,
  buildHostTrigger,
  TRIGGER_SAVE_HELP,
  triggerFromFile,
  triggerSaveFlags,
} from '../../../lib/triggers.js'

export default class AiTriggerSave extends BaseCommand {
  static description = `Create or update a AI trigger from a JSON file

"when" says what fires it: OnCreditsWarning or OnCreditsExhausted (the
project's AI credits), OnQuotaWarning or OnQuotaExhausted (a user's AI plan
quota). AI triggers have no portal screen: the CLI and the SDKs are the way
to set them up.

${TRIGGER_SAVE_HELP}`

  static examples = [
    '<%= config.bin %> ai trigger save --file credits.json',
    '<%= config.bin %> ai trigger save --file credits.json --when OnCreditsExhausted',
    '<%= config.bin %> ai trigger save --file code-action.json --execution-identity usr_66b2f0a1',
    '<%= config.bin %> ai trigger save --file credits.json --id 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
    'cat trigger.json | <%= config.bin %> ai trigger save --file -',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    ...triggerSaveFlags(AI_TRIGGER_TYPES, 'OnCreditsWarning, OnCreditsExhausted, OnQuotaWarning or OnQuotaExhausted'),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AiTriggerSave)
    const client = this.client(flags)

    const source = flags.file === '-' ? '-' : `@${flags.file}`
    const parsed = await readJsonObject(source, 'file')
    // The bare trigger, the request body, a `trigger <id> --json` answer or a `trigger definition` answer.
    const fromFile = triggerFromFile(parsed)

    const trigger = buildHostTrigger(fromFile, flags, AI_TRIGGER, AI_TRIGGER_TYPES)

    // The host-specific fields ("when", …) are not on the generated base type,
    // so the body is cast: the server picks the shape from `type`.
    const res = await client.hub.ai.saveAiProjectTrigger({trigger} as unknown as Parameters<
      typeof client.hub.ai.saveAiProjectTrigger
    >[0])

    this.print(res)
    return res
  }
}
