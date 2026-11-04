import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {readJsonInput} from '../../lib/json.js'
import {formatPreExecuteTest, TRIGGER_TYPES} from '../../lib/triggers.js'
import {usageError} from '../../lib/cli-error.js'

const EVENT_KINDS = ['Inserted', 'Updated', 'Deleted', 'Other']

export default class TriggerPreExecuteTest extends BaseCommand {
  static description = `Test a trigger's pre-action code against a sample record

The code is what goes in a trigger's "preExecuteCode": C# statements that end
in \`return true;\` (the trigger runs) or \`return false;\`, reading the record
after the change as New and before it as Old, e.g.
\`return New.status == "published";\`. Nothing is saved and no trigger fires:
the answer says whether the trigger would run and lists the code's problems.

--new and --old are the sample records (JSON, inline, @file or \`-\`); leave
--old out for an insert and --new out for a delete. --event-kind is what the
code sees as Event.Kind (worked out from the records when left out).`

  static examples = [
    '<%= config.bin %> trigger pre-execute-test --type Schema --code \'return New.status == "published";\' --new \'{"status":"published"}\'',
    '<%= config.bin %> trigger pre-execute-test --type Schema --file guard.cs --new @after.json --old @before.json',
    '<%= config.bin %> trigger pre-execute-test --type Membership --code \'return New.email != null;\' --new @user.json --event-name membership.user.registered --json',
  ]

  static flags = {
    type: Flags.string({required: true, options: TRIGGER_TYPES, description: 'Which kind of trigger the code is for'}),
    code: Flags.string({description: 'The code to test (inline)', exclusive: ['file']}),
    file: Flags.string({description: 'Read the code from this file (or `-` for stdin)', exclusive: ['code']}),
    new: Flags.string({description: 'The record AFTER the change, as JSON (inline, @file or `-`); omit for a delete'}),
    old: Flags.string({description: 'The record BEFORE the change, as JSON (inline, @file or `-`); omit for an insert'}),
    'event-kind': Flags.string({options: EVENT_KINDS, description: 'What the code sees as Event.Kind'}),
    'event-name': Flags.string({description: 'What the code sees as Event.Name, e.g. database.record.updated'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(TriggerPreExecuteTest)
    const client = this.client(flags)

    const code = flags.code ?? (flags.file ? await readCode(flags.file) : undefined)
    if (!code) throw usageError('Give the code to test with --code or --file.')

    const res = await client.hub.triggers.testTriggerPreExecuteCode({
      code,
      triggerType: flags.type as never,
      newRecord: flags.new === undefined ? undefined : await readJsonInput(flags.new, 'new'),
      oldRecord: flags.old === undefined ? undefined : await readJsonInput(flags.old, 'old'),
      eventKind: flags['event-kind'],
      eventName: flags['event-name'],
    })

    this.print(formatPreExecuteTest(res))
    return res
  }
}

async function readCode(file: string): Promise<string> {
  if (file === '-') {
    const chunks: Buffer[] = []
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
    return Buffer.concat(chunks).toString('utf8')
  }

  const {readFileSync} = await import('node:fs')
  return readFileSync(file, 'utf8')
}
