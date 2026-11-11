import {Flags} from '@oclif/core'

import {CLICK_TRACKING_WARNING} from '../../lib/email-clicks.js'
import {ProjectCommand, projectOf} from '../../lib/project.js'

export default class EmailClickTracking extends ProjectCommand {
  static description = `Show or switch email click ids (nblid) for the project

With no flag it shows the current value (the project's emailClickTracking; off
by default). --on makes every web link of the project's MARKETING emails carry
?nblid=<click id>; transactional and system mail, unsubscribe / preference links
and links marked data-nblid="off" are never changed. --off sends links as
written. Only emails sent while it is on carry click ids.

Norbix does not see the click itself: clicks come back only from sites you own.
Your pages, server logs or analytics read the nblid from the opened link and
send it back with \`norbix email clicks import <file>\`.`

  static examples = [
    '<%= config.bin %> email click-tracking',
    '<%= config.bin %> email click-tracking --on',
    '<%= config.bin %> email click-tracking --off',
    '<%= config.bin %> email click-tracking --on --dry-run',
  ]

  static flags = {
    on: Flags.boolean({description: 'Switch email click ids on', exclusive: ['off']}),
    off: Flags.boolean({description: 'Switch email click ids off', exclusive: ['on']}),
    ...ProjectCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(EmailClickTracking)

    if (!flags.on && !flags.off) {
      const {client, projectId} = this.projectClient(flags)
      const project = projectOf(await client.hub.account.getProject({projectId}))
      const enabled = project.emailClickTracking === true
      this.report(enabled, 'Email click ids')
      return {projectId, emailClickTracking: enabled, warning: CLICK_TRACKING_WARNING}
    }

    const client = this.client(flags)
    const enabled = Boolean(flags.on)
    await client.hub.notifications.updateEmailClickTracking({enabled})

    this.report(enabled, 'Email click ids switched')
    return {emailClickTracking: enabled, warning: CLICK_TRACKING_WARNING}
  }

  /** The value on stdout, the warning on stderr (with --json both are in the one document). */
  private report(enabled: boolean, label: string): void {
    if (this.jsonEnabled()) return
    this.log(`${label}: ${enabled ? 'on' : 'off'}.`)
    process.stderr.write(`Warning: ${CLICK_TRACKING_WARNING}\n`)
  }
}
