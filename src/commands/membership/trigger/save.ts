import {BaseCommand} from '../../../base.js'
import {readJsonObject} from '../../../lib/payments.js'
import {
  MEMBERSHIP_TRIGGER,
  MEMBERSHIP_TRIGGER_TYPES,
  buildHostTrigger,
  TRIGGER_SAVE_HELP,
  triggerFromFile,
  triggerSaveFlags,
} from '../../../lib/triggers.js'

export default class MembershipTriggerSave extends BaseCommand {
  static description = `Create or update a membership trigger from a JSON file

"when" says what fires it: OnRegistered (a login was created), OnInvited,
OnVerified, OnUpdated, OnDeleted, OnBlocked, OnReactivated, or OnUserCreated (a
person was created — the user, not the credential). A membership trigger may
send to the person it is about: deliverySettings.recipientsSourceType
"TriggerSubject" on an Email, Sms or Push action.

${TRIGGER_SAVE_HELP}`

  static examples = [
    '<%= config.bin %> membership trigger save --file welcome.json',
    '<%= config.bin %> membership trigger save --file welcome.json --when OnRegistered',
    '<%= config.bin %> membership trigger save --file workflow-action.json --execution-identity usr_66b2f0a1',
    '<%= config.bin %> membership trigger save --file welcome.json --id 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
    'cat trigger.json | <%= config.bin %> membership trigger save --file -',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    ...triggerSaveFlags(MEMBERSHIP_TRIGGER_TYPES, 'OnRegistered, OnInvited, OnVerified, OnUpdated, OnDeleted, OnBlocked, OnReactivated or OnUserCreated'),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(MembershipTriggerSave)
    const client = this.client(flags)

    const source = flags.file === '-' ? '-' : `@${flags.file}`
    const parsed = await readJsonObject(source, 'file')
    // The bare trigger, the request body, a `trigger <id> --json` answer or a `trigger definition` answer.
    const fromFile = triggerFromFile(parsed)

    const trigger = buildHostTrigger(fromFile, flags, MEMBERSHIP_TRIGGER, MEMBERSHIP_TRIGGER_TYPES)

    // The host-specific fields ("when", …) are not on the generated base type,
    // so the body is cast: the server picks the shape from `type`.
    const res = await client.hub.membership.saveMembershipTrigger({trigger} as unknown as Parameters<
      typeof client.hub.membership.saveMembershipTrigger
    >[0])

    this.print(res)
    return res
  }
}
