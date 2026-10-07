import {BaseCommand} from '../../base.js'

const TOPIC = `Service-user API keys are what scripts, CI, SDKs and coding agents sign in
with (\`norbix login --api-key\`, NORBIX_API_KEY). Each key belongs to a service
user of the account and carries that user's rights; a key is shown once, when
it is created, and later only as an id and a short hint.`

export default class ApikeysList extends BaseCommand {
  static description = `List the account's service-user API keys

${TOPIC}

One row per key: the service user (id and name), the key id and its hint.`

  static examples = ['<%= config.bin %> apikeys list', '<%= config.bin %> apikeys list --json']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ApikeysList)
    const client = this.client(flags, {requireProject: false})

    const res = await client.hub.account.listAiServiceUsers({})
    const keys = (res.items ?? []).flatMap((user) =>
      (user.keys ?? []).map((key) => ({
        serviceUserId: user.id,
        serviceUser: user.name,
        keyId: key.id,
        hint: key.hint,
        issuedAt: key.issuedAt,
      })),
    )

    this.print(keys.length > 0 ? keys : 'No service-user API keys yet. Create one: norbix apikeys create <serviceUserId>')
    return {keys}
  }
}
