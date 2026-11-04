import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {readJsonObject} from '../../../lib/payments.js'
import {
  FILES_TRIGGER,
  FILES_TRIGGER_TYPES,
  buildHostTrigger,
  TRIGGER_SAVE_HELP,
  triggerFromFile,
  triggerSaveFlags,
} from '../../../lib/triggers.js'

export default class FilesTriggerSave extends BaseCommand {
  static description = `Create or update a files trigger from a JSON file

"when" says what fires it: OnFileUploaded (a file was stored) or OnFileDeleted
(a file was removed). "folder" narrows it to one folder and its subfolders
(e.g. "invoices" or "invoices/2026"); empty = every file of the project.

${TRIGGER_SAVE_HELP}`

  static examples = [
    '<%= config.bin %> files trigger save --file trigger.json',
    '<%= config.bin %> files trigger save --file trigger.json --when OnFileUploaded --folder invoices',
    '<%= config.bin %> files trigger save --file code-action.json --execution-identity usr_66b2f0a1',
    '<%= config.bin %> files trigger save --file trigger.json --id 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
    'cat trigger.json | <%= config.bin %> files trigger save --file -',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    ...triggerSaveFlags(FILES_TRIGGER_TYPES, 'OnFileUploaded or OnFileDeleted'),
    folder: Flags.string({description: 'Only files in this folder and its subfolders (overrides "folder" in the file); empty = every file'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(FilesTriggerSave)
    const client = this.client(flags)

    const source = flags.file === '-' ? '-' : `@${flags.file}`
    const parsed = await readJsonObject(source, 'file')
    // The bare trigger, the request body, a `trigger <id> --json` answer or a `trigger definition` answer.
    const fromFile = triggerFromFile(parsed)

    const trigger = buildHostTrigger(fromFile, flags, FILES_TRIGGER, FILES_TRIGGER_TYPES)
    if (flags.folder !== undefined) trigger.folder = flags.folder

    // The host-specific fields ("when", …) are not on the generated base type,
    // so the body is cast: the server picks the shape from `type`.
    const res = await client.hub.files.saveFilesTrigger({trigger} as unknown as Parameters<
      typeof client.hub.files.saveFilesTrigger
    >[0])

    this.print(res)
    return res
  }
}
