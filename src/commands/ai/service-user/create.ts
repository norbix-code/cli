import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class AiServiceUserCreate extends BaseCommand {
  static description = `Create an AI service user and print its first API key

The key is shown once — store it now. --reach project limits the user to one
project (the configured one, or --project). --rights read can only read;
admin can change things. --env picks the environments (repeat the flag).`

  static examples = [
    '<%= config.bin %> ai service-user create --name "Claude Code on my laptop" --reach project --rights read --env TEST',
    '<%= config.bin %> ai service-user create --name ci-bot --reach account --rights admin --env TEST --env PROD',
  ]

  static flags = {
    name: Flags.string({required: true, description: 'A name people recognise'}),
    reach: Flags.string({description: 'Whole account, or one project', options: ['account', 'project'], default: 'project'}),
    rights: Flags.string({description: 'What it may do', options: ['read', 'admin'], default: 'read'}),
    env: Flags.string({description: 'Environment it may use (repeat for several; default TEST)', multiple: true}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AiServiceUserCreate)
    const projectId = flags.reach === 'project' ? this.resolveContext(flags).projectId : undefined
    if (flags.reach === 'project' && !projectId) {
      this.error('--reach project needs a project. Pass --project, or run `norbix configure`.')
    }

    const client = this.client(flags, {requireProject: false})

    const res = await client.hub.account.createAiServiceUser({
      name: flags.name,
      scope: {reach: flags.reach, projectId, rights: flags.rights, envs: flags.env ?? ['TEST']},
    })

    this.print(res)
    return res
  }
}
