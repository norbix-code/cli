import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'
import {usageError} from '../../../../lib/cli-error.js'

/** The single-setting saves this command sends, in order. */
export function verificationSaves(flags: {
  on?: boolean
  off?: boolean
  template?: string
  expiration?: number
  callback?: string
  require?: boolean
}): Array<Record<string, unknown>> {
  if (flags.off) return [{setting: 'AllowUserVerification', needVerification: false}]
  const saves: Array<Record<string, unknown>> = []
  if (flags.on || flags.template !== undefined || flags.expiration !== undefined)
    saves.push({
      setting: 'AllowUserVerification',
      needVerification: true,
      ...(flags.template !== undefined ? {verificationEmailTemplate: flags.template} : {}),
      ...(flags.expiration !== undefined ? {emailVerificationExpiration: flags.expiration} : {}),
    })
  // The callback goes before the block switch: the gateway turns the switch on only with a callback.
  if (flags.callback !== undefined) saves.push({setting: 'UserVerificationCallback', verificationCallback: flags.callback})
  if (flags.require !== undefined) saves.push({setting: 'RequireEmailVerification', requireEmailVerification: flags.require})
  return saves
}

export default class MembershipSettingsEmailVerificationSet extends BaseCommand {
  static description = `Turn e-mail verification of e-mail + password sign-ups on or off

--on sends a one-time link at every e-mail sign-up (template "New user
verification" unless --template, link valid --expiration minutes, default 15).
--callback is your app's "confirm your e-mail" page (https://…); the link is
it + #token=…, and the page calls the confirm route with the token.
--require blocks password sign-in until the address is verified (needs
--callback); --no-require lets unverified users sign in again. --off stops the
e-mails and the block. \`norbix membership settings authorization\` shows the
result (requireEmailVerification, emailPreferences.verificationViaEmail).`

  static examples = [
    '<%= config.bin %> membership settings email-verification set --on --callback https://app.example.com/verify-email --require',
    '<%= config.bin %> membership settings email-verification set --expiration 60',
    '<%= config.bin %> membership settings email-verification set --no-require',
    '<%= config.bin %> membership settings email-verification set --off --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    on: Flags.boolean({description: 'Send a verification link at every e-mail sign-up', exclusive: ['off']}),
    off: Flags.boolean({description: 'Stop the verification e-mails (and the sign-in block)', exclusive: ['on', 'template', 'expiration', 'callback', 'require']}),
    template: Flags.string({description: 'The verification e-mail template (tmpl_…); it must use @Model.EmailVerificationLink'}),
    expiration: Flags.integer({description: 'Minutes the link works', min: 1}),
    callback: Flags.string({description: 'Your app\'s "confirm your e-mail" page (https://…); empty = none'}),
    require: Flags.boolean({description: 'Block password sign-in until the e-mail is verified', allowNo: true}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(MembershipSettingsEmailVerificationSet)
    const saves = verificationSaves(flags)
    if (saves.length === 0) throw usageError('Pass --on, --off, --template, --expiration, --callback or --require / --no-require.')

    if (flags['dry-run']) return this.dryRun({method: 'membership settings email-verification set', request: saves})

    const client = this.client(flags)
    const answers: unknown[] = []
    for (const save of saves) answers.push(await client.hub.membership.updateAuthorizationSettings(save as never))

    const done: string[] = []
    if (flags.off) done.push('verification e-mails off')
    else {
      if (saves.some((s) => s.setting === 'AllowUserVerification')) done.push('verification e-mails on')
      if (flags.callback !== undefined) done.push(flags.callback ? `callback ${flags.callback}` : 'callback removed')
      if (flags.require !== undefined) done.push(flags.require ? 'password sign-in waits for a verified e-mail' : 'unverified users may sign in')
    }
    this.print(`Saved: ${done.join('; ')}.`)
    return answers
  }
}
