import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {integrationBody, KEYLESS_HELP} from '../../../lib/integrations.js'

/** The provider names the server's integration converter accepts. */
const PROVIDERS = ['Console', 'NorbixLogging', 'DataDog', 'NewRelic', 'Sentry', 'GrafanaLoki', 'Axiom', 'ElasticCloud', 'AWSCloudWatch', 'GCPCloudLogging', 'AzureMonitorLogs', 'GenericHttp', 'Kafka', 'AMQP', 'Prometheus', 'AzureOTel', 'Splunk', 'ElasticSearch', 'Kibana', 'LocalFile', 'AWSS3', 'AWSKinesis', 'MongoDB', 'InternalKafka']

export default class LogsIntegrationSave extends BaseCommand {
  static description = `Create or update a logs integration

--provider picks the body shape. Put the provider-specific fields in --config (inline JSON,
@file.json, or - for stdin): the API key, the log group, the connection string, … of the provider; keyless CloudWatch / Azure Monitor take the role ARN or the tenant and client id instead; see \`norbix integrations keyless-setup logs <cloud>\`.
Pass --id to update an existing integration. The output of \`logs integration
<id>\` can be fed back as --config (bare or wrapped in {"integration": …}): its
viewId picks the integration to update, so no second one is created.

${KEYLESS_HELP}`

  static examples = [
    '<%= config.bin %> logs integration save --provider DataDog --name Datadog --config @datadog.json',
    '<%= config.bin %> logs integration save --provider AWSCloudWatch --name CloudWatch --config @cloudwatch.json',
    '<%= config.bin %> logs integration save --provider MongoDB --name Mongo --id int_1 --config @mongo.json --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    provider: Flags.string({required: true, description: 'Logs provider', options: PROVIDERS}),
    name: Flags.string({description: 'Integration name'}),
    id: Flags.string({description: 'Integration ID — set it to update instead of create'}),
    disabled: Flags.boolean({description: 'Save it turned off', default: false}),
    config: Flags.string({description: 'Provider-specific fields as a JSON object, @file or -'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(LogsIntegrationSave)
    const client = this.client(flags)

    const integration = await integrationBody(flags)

    // The provider-specific fields are not on the generated base type, so the
    // body is cast: the server picks the shape from `provider`.
    const res = await client.hub.logs.saveLoggingIntegration({integration} as unknown as Parameters<
      typeof client.hub.logs.saveLoggingIntegration
    >[0])

    this.print(res)
    return res
  }
}
