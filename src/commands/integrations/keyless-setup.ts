import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

const MODULES = ['code', 'email', 'files']
const CLOUDS = ['aws', 'azure', 'google']
const TEMPLATE_KINDS = ['bicep', 'cloudformation', 'terraform']

/** One ready infrastructure file for the integration (gateway feat/keyless-templates). */
export interface KeylessSetupTemplate {
  kind?: string
  fileName?: string
  content?: string
}

/** The gateway's answer, as the CLI reads it (every field may be missing). */
export interface KeylessSetup {
  integrationId?: string
  env?: string
  module?: string
  cloud?: string
  issuer?: string
  available?: boolean
  unavailableReason?: string
  subject?: string
  audience?: string
  script?: string
  templates?: KeylessSetupTemplate[]
}

export default class IntegrationsKeylessSetup extends BaseCommand {
  static description = `Show how to connect a cloud account without a stored key

Keyless cloud connections store no secret: Norbix signs a short token and the
cloud trusts it. This prints what the cloud account must trust — the issuer,
the subject and the audience — whether keyless works on this gateway, and the
setup script to run in the cloud account. Save the integration afterwards with
the printed integration id.

The answer also lists ready infrastructure files for the integration —
CloudFormation (AWS), Bicep (Azure) and Terraform (every cloud). --template
<kind> prints only that file's content, for piping into a file.

Without --integration-id the gateway makes a new id for the integration you
are about to save.`

  static examples = [
    '<%= config.bin %> integrations keyless-setup files aws',
    '<%= config.bin %> integrations keyless-setup email azure --integration-id 55555555-5555-5555-5555-555555555555',
    '<%= config.bin %> integrations keyless-setup code aws --json',
    '<%= config.bin %> integrations keyless-setup files aws --template terraform > norbix-files.tf',
  ]

  static args = {
    module: Args.string({required: true, description: `One of: ${MODULES.join(', ')}`, options: MODULES}),
    cloud: Args.string({required: true, description: `One of: ${CLOUDS.join(', ')}`, options: CLOUDS}),
  }

  static flags = {
    'integration-id': Flags.string({description: 'An existing integration (default: a new id for the next save)'}),
    template: Flags.string({
      description: `Print only the content of this template file (one of: ${TEMPLATE_KINDS.join(', ')})`,
      options: TEMPLATE_KINDS,
    }),
  }

  async run(): Promise<KeylessSetup | KeylessSetupTemplate> {
    const {args, flags} = await this.parse(IntegrationsKeylessSetup)
    const client = this.client(flags)

    const request: {module: string; cloud: string; integrationId?: string} = {module: args.module, cloud: args.cloud}
    if (flags['integration-id']) request.integrationId = flags['integration-id']

    const res = (await client.hub.integrations.getKeylessIntegrationSetup(request)) as KeylessSetup

    if (flags.template) {
      const template = pickTemplate(res, flags.template)
      if (!template) {
        const has = (res.templates ?? []).map((t) => t.kind).filter(Boolean)
        this.error(
          `No ${flags.template} template in the answer for ${args.module} on ${args.cloud} (has: ${has.length > 0 ? has.join(', ') : 'none'}).`,
        )
      }

      if (!this.jsonEnabled()) {
        const content = template.content ?? ''
        process.stdout.write(content.endsWith('\n') ? content : `${content}\n`)
      }

      return template
    }

    if (!this.jsonEnabled()) {
      for (const line of render(res)) this.log(line)
    }

    return res
  }
}

/** The human view: one value per line, the script last and as is. */
export function render(res: KeylessSetup): string[] {
  const lines = [
    `Integration id: ${res.integrationId ?? ''}`,
    `Environment:    ${res.env ?? ''}`,
    `Module:         ${res.module ?? ''}`,
    `Cloud:          ${res.cloud ?? ''}`,
    `Issuer:         ${res.issuer ?? ''}`,
    `Subject:        ${res.subject ?? ''}`,
    `Audience:       ${res.audience ?? ''}`,
    `Available:      ${res.available ? 'yes' : `no${res.unavailableReason ? ` — ${res.unavailableReason}` : ''}`}`,
  ]
  if (res.templates && res.templates.length > 0) {
    lines.push('', 'Templates (print one with --template <kind>):')
    for (const t of res.templates) lines.push(`  ${t.fileName ?? ''} (${t.kind ?? ''})`)
  }

  if (res.script) lines.push('', 'Script:', res.script)
  return lines
}

/** The template of one kind (cloudformation, bicep, terraform), if the answer has it. */
export function pickTemplate(res: KeylessSetup, kind: string): KeylessSetupTemplate | undefined {
  return (res.templates ?? []).find((t) => t.kind?.toLowerCase() === kind.toLowerCase())
}
