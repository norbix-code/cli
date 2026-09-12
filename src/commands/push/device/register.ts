import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class PushDeviceRegister extends BaseCommand {
  static description = `Register a device so push campaigns can reach it

A device belongs to a user, so --user is required. --os is the operating
system the token came from; the backend uses it to pick a provider.`

  static examples = [
    '<%= config.bin %> push device register --user usr_123 --token dGVzdA== --os iOS',
  ]

  static flags = {
    user: Flags.string({required: true, description: 'User ID the device belongs to'}),
    token: Flags.string({required: true, description: 'Device token from the platform'}),
    os: Flags.string({required: true, description: 'Operating system, e.g. iOS or Android'}),
    'device-id': Flags.string({description: 'Stable device identifier'}),
    model: Flags.string({description: 'Device model, e.g. iPhone 15'}),
    name: Flags.string({description: "The device's own name"}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(PushDeviceRegister)
    const client = this.client(flags)

    const res = await client.hub.notifications.registerDevice({
      userId: flags.user,
      pushDeviceDto: {
        deviceId: flags['device-id'],
        deviceOs: flags.os,
        token: flags.token,
        modelName: flags.model,
        deviceName: flags.name,
      },
    })

    this.print(res)
    return res
  }
}
