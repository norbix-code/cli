import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class UsersContactsConsent extends BaseCommand {
  static description = `Record a contact's consent to marketing messages on one channel

Sent to the Api host (the developer path). Keep proof of the consent and pass its reference in --evidence.`

  static examples = [
    '<%= config.bin %> users contacts consent ct_66b2f0a1c3d4 Email',
    '<%= config.bin %> users contacts consent ct_66b2f0a1c3d4 Sms --source SignupForm --evidence form_123 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Contact ID (ct_…)'}),
    channel: Args.string({required: true, description: 'Delivery channel', options: ['Email', 'Sms', 'Push']}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    'lawful-basis': Flags.string({description: 'Lawful basis of the consent', default: 'Consent'}),
    source: Flags.string({description: 'Where the consent came from', default: 'UserOptIn'}),
    evidence: Flags.string({description: 'Reference to the proof, e.g. a form submission ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersContactsConsent)
    const client = this.client(flags)

    const res = await client.api.membership.grantContactConsent({
      contactId: args.id,
      channel: args.channel,
      lawfulBasis: flags['lawful-basis'],
      source: flags.source,
      ...(flags.evidence ? {evidenceRef: flags.evidence} : {}),
    })
    this.print(`Consent for ${args.channel} recorded for contact ${args.id}.`)
    return res
  }
}
