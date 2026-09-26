import {BaseCommand} from '../../base.js'

export default class PushDisableDependencies extends BaseCommand {
  static description = 'List what still depends on push — check this before `push disable`'

  static examples = ['<%= config.bin %> push disable-dependencies']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(PushDisableDependencies)
    const client = this.client(flags)

    const res = await client.hub.notifications.getPushDisableDependencies({})

    this.print(res)
    return res
  }
}
