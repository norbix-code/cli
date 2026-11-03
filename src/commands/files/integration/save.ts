import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {integrationBody, KEYLESS_HELP} from '../../../lib/integrations.js'

/** The provider names the server's integration converter accepts. */
const PROVIDERS = ['Local', 'AwsS3', 'AzureBlobStorage', 'GoogleCloudStorage', 'Ftp', 'AppleICloud', 'DropBox', 'GoogleDrive']

export default class FilesIntegrationSave extends BaseCommand {
  static description = `Create or update a files integration

--provider picks the body shape. Put the provider-specific fields in --config (inline JSON,
@file.json, or - for stdin): the bucket / container, the region and — keyless — the role ARN (AWS) or the tenant and client id (Azure); see \`norbix integrations keyless-setup files <cloud>\`.
Pass --id to update an existing integration. The output of \`files integration
<id>\` can be fed back as --config (bare or wrapped in {"integration": …}): its
viewId picks the integration to update, so no second one is created.

${KEYLESS_HELP}`

  static examples = [
    '<%= config.bin %> files integration save --provider AwsS3 --name Invoices --config @s3.json',
    '<%= config.bin %> files integration save --provider AzureBlobStorage --name Invoices --id 55555555-5555-5555-5555-555555555555 --config @blob.json',
    '<%= config.bin %> files integration save --provider GoogleCloudStorage --name Invoices --config @gcs.json --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    provider: Flags.string({required: true, description: 'Files provider', options: PROVIDERS}),
    name: Flags.string({description: 'Integration name'}),
    id: Flags.string({description: 'Integration ID — set it to update instead of create'}),
    disabled: Flags.boolean({description: 'Save it turned off', default: false}),
    config: Flags.string({description: 'Provider-specific fields as a JSON object, @file or -'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(FilesIntegrationSave)
    const client = this.client(flags)

    const integration = await integrationBody(flags)

    // The provider-specific fields are not on the generated base type, so the
    // body is cast: the server picks the shape from `provider`.
    const res = await client.hub.files.saveFilesIntegration({integration} as unknown as Parameters<
      typeof client.hub.files.saveFilesIntegration
    >[0])

    this.print(res)
    return res
  }
}
