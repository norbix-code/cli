import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {templateBody, templateFlags} from '../../../lib/push.js'

export default class PushTemplateUpdate extends BaseCommand {
  static description = `Replace a push template's name, channel, tags and content

The whole template is sent, so pass every language you want to keep.`

  static examples = [
    '<%= config.bin %> push template update 66b2f0a1... --name Welcome --title "Hi" --body "Thanks for joining"',
  ]

  static args = {
    id: Args.string({required: true, description: 'Template ID'}),
  }

  static flags = templateFlags

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PushTemplateUpdate)
    const client = this.client(flags)

    const res = await client.hub.notifications.updatePushTemplate({
      ...(await templateBody(flags)),
      viewId: args.id,
    } as unknown as Parameters<typeof client.hub.notifications.updatePushTemplate>[0])

    this.print(`Template ${args.id} updated.`)
    return res
  }
}
