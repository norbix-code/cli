import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {readJsonObject} from '../../../lib/push.js'

/** The provider names the server's LLM integration converter accepts. */
const PROVIDERS = ['OpenAI', 'Anthropic', 'Ollama', 'Groq', 'Google', 'Mistral', 'OpenRouter', 'Grok', 'NorbixHosted']

export default class AiLlmSave extends BaseCommand {
  static description = `Create or update an LLM integration

--provider picks the body shape. The hosted providers need their API key: put
the provider-specific fields (apiKey, models, …) in --config as a JSON object
(inline, @file.json, or - for stdin). Ollama needs --endpoint. Pass --id to
update an existing integration.`

  static examples = [
    '<%= config.bin %> ai llm save --provider OpenAI --name OpenAI --model gpt-4o-mini --config @openai.json',
    '<%= config.bin %> ai llm save --provider Ollama --name Local --endpoint http://localhost:11434 --model llama3',
    '<%= config.bin %> ai llm save --provider OpenAI --name OpenAI --model gpt-4o-mini --config @openai.json --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    provider: Flags.string({required: true, description: 'LLM provider', options: PROVIDERS}),
    name: Flags.string({required: true, description: 'Integration name'}),
    id: Flags.string({description: 'Integration ID — set it to update instead of create'}),
    endpoint: Flags.string({description: 'Provider address (self-hosted providers such as Ollama)'}),
    model: Flags.string({description: 'Default model'}),
    default: Flags.boolean({description: 'Make it the project default LLM', default: false}),
    disabled: Flags.boolean({description: 'Save it turned off', default: false}),
    config: Flags.string({description: 'Provider-specific fields as a JSON object, @file or -'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AiLlmSave)
    const client = this.client(flags)

    const extra = flags.config ? await readJsonObject(flags.config, 'config') : {}
    const integration = {
      ...extra,
      provider: flags.provider,
      integrationId: flags.id,
      integrationName: flags.name,
      endpoint: flags.endpoint ?? (extra.endpoint as string | undefined),
      defaultModel: flags.model ?? (extra.defaultModel as string | undefined),
      isDefault: flags.default,
      isEnabled: !flags.disabled,
    }

    // The provider-specific fields (apiKey, …) are not on the generated base
    // type, so the body is cast: the server picks the shape from `provider`.
    const res = await client.hub.ai.saveLlmIntegration({integration} as unknown as Parameters<
      typeof client.hub.ai.saveLlmIntegration
    >[0])

    this.print(res)
    return res
  }
}
