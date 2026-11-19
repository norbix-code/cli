import type {GlobalFlags} from '../base.js'
import {AiToolsCommand} from './ai-tools.js'
import {CliError} from './cli-error.js'
import {EXIT, type ExitCode} from './exit-codes.js'

/**
 * The template read doors: what Norbix already has for an agent to read before
 * it designs — the app templates (blog, CRM, HR …) and the schema registry.
 *
 * Four read-only AI tools on the Hub (`get_app_templates`, `get_app_template`,
 * `search_schema_templates`, `get_entity_graph`), called through the tool
 * bridge `POST /{version}/account/ai/tools/{name}` like `norbix ai tool call`.
 * They read files that ship with the gateway and are the same for every
 * account, so they go out on the account-level client (no env rule) and
 * nothing asks for confirmation.
 */

export interface AppTemplateCard {
  id: string
  name: string
  version: number
  tags: string[]
  summary: string
  collections: Array<{entity: string; tier: string}>
  matchedTags: string[]
}

export interface AppTemplate {
  template: AppTemplateCard
  guide: string
  collectionSpecs: Array<{fileName: string; json: string}>
}

export interface SchemaTemplateCard {
  id: string
  title: string
  summary: string
  aliases: string[]
  tags: string[]
  usesBlocks: string[]
  usesTaxonomies: string[]
  related: string[]
  matchedOn: string[]
}

export interface SchemaTemplateSearch {
  total: number
  templates: SchemaTemplateCard[]
}

export interface EntityGraph {
  capped: boolean
  unknown: string[]
  entities: Array<{id: string; related: string[]; ifDocument: string}>
}

interface ToolEnvelope {
  ok?: boolean
  data?: unknown
  errors?: Array<{code?: string; message?: string}>
}

/** Gateway error codes of the doors (`CM-ERRORS-AI-TEMPLATES-00x`) → CLI exit codes. */
const EXIT_BY_CODE: Record<string, ExitCode> = {
  'CM-ERRORS-AI-TEMPLATES-001': EXIT.NOT_FOUND,
  'CM-ERRORS-AI-TEMPLATES-002': EXIT.NOT_FOUND,
  'CM-ERRORS-AI-TEMPLATES-003': EXIT.SERVER,
  'CM-ERRORS-AI-TEMPLATES-004': EXIT.USAGE,
}

/** A JSON document the gateway sends as text; left as text when it does not parse. */
export function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export abstract class TemplateDoorCommand extends AiToolsCommand {
  /**
   * Calls one door and returns its `data`. A failed envelope becomes the CLI's
   * error with the gateway's own code. An installation whose gateway is older
   * than the doors answers "unknown tool": that is said plainly.
   */
  protected async door<T>(flags: GlobalFlags, tool: string, args: Record<string, unknown>, docs: string): Promise<T> {
    const sent = Object.fromEntries(Object.entries(args).filter(([, value]) => value !== undefined && value !== ''))
    const res = await this.accountClient(flags).hub.account.invokeAiTool({toolName: tool, argumentsJson: JSON.stringify(sent)})

    const envelope = (typeof res.result === 'string' ? parseJsonText(res.result) : res.result) as ToolEnvelope | undefined
    if (envelope && typeof envelope === 'object' && envelope.ok === true) return (envelope.data ?? {}) as T

    const first = envelope?.errors?.[0]
    const unknownTool = !first?.code?.startsWith('CM-ERRORS-AI-TEMPLATES-')
    throw new CliError({
      exit: (first?.code && EXIT_BY_CODE[first.code]) || EXIT.VALIDATION,
      code: first?.code ?? 'TEMPLATE_DOOR_FAILED',
      message: first?.message ?? `The AI tool ${tool} did not answer.`,
      errors: envelope?.errors,
      hint: unknownTool
        ? `This installation may not have the template read doors yet (the AI tool ${tool}). Check with \`norbix ai tools --json\`.`
        : undefined,
      docs,
    })
  }
}
