import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class PushDevices extends BaseCommand {
  static description = `List the devices registered for push

Narrow the list with --user, --token or --platform. Devices are stored
inside their user, so a page is a page of users carrying every matching
device they hold — follow hasMore rather than stopping at a short page.`

  static examples = [
    '<%= config.bin %> push devices',
    '<%= config.bin %> push devices --platform ios',
    '<%= config.bin %> push devices --user usr_123',
  ]

  static flags = {
    user: Flags.string({description: 'Only the devices of this user'}),
    token: Flags.string({description: 'Only the device registered with this provider token'}),
    platform: Flags.string({
      description: 'Only devices of this platform',
      options: ['ios', 'android', 'chrome', 'safari', 'expo'],
    }),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(PushDevices)
    const client = this.client(flags)

    const res = await client.hub.notifications.getPushDevices({
      userId: flags.user,
      deviceKey: flags.token,
      platform: flags.platform,
    })

    this.print(res)
    return res
  }
}
