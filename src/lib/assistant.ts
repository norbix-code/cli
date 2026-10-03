import {Flags} from '@oclif/core'

import {textOrFile} from './email.js'

/** Flags shared by `project ai assistant create` and `… update`. */
export const assistantFlags = {
  name: Flags.string({description: 'Assistant name'}),
  welcome: Flags.string({description: 'First message the assistant shows'}),
  'system-prompt': Flags.string({description: 'Instructions the assistant follows', exclusive: ['system-prompt-file']}),
  'system-prompt-file': Flags.string({description: 'Read the instructions from a file'}),
  toolset: Flags.string({description: 'Tool set the assistant may use (repeat for several)', multiple: true}),
  llm: Flags.string({description: 'LLM integration ID (default: the project default)'}),
  model: Flags.string({description: 'Model of that integration'}),
  memory: Flags.boolean({description: 'Remember earlier chats with the same user', allowNo: true}),
  'rag-source': Flags.string({description: 'Knowledge source ID to answer from (repeat for several)', multiple: true}),
  default: Flags.boolean({description: 'Make it the project default assistant', allowNo: true}),
}

export interface AssistantFlags {
  name?: string
  welcome?: string
  'system-prompt'?: string
  'system-prompt-file'?: string
  toolset?: string[]
  llm?: string
  model?: string
  memory?: boolean
  'rag-source'?: string[]
  default?: boolean
}

/** One assistant as the server stores it (`AiAssistantDto`). */
export interface Assistant {
  id?: string
  name?: string
  welcomeMessage?: string
  systemPrompt?: string
  toolsets?: string[]
  llmIntegrationId?: string
  model?: string
  memoryEnabled?: boolean
  ragSourceIds?: string[]
  planId?: string
  isDefault?: boolean
}

/**
 * The assistant body: the flags on top of `base` (the stored assistant for an
 * update, nothing for a create). The server replaces the whole assistant, so a
 * field not passed keeps its stored value.
 */
export function assistantBody(flags: AssistantFlags, base: Assistant = {}): Omit<Assistant, 'id'> {
  return {
    name: flags.name ?? base.name,
    welcomeMessage: flags.welcome ?? base.welcomeMessage,
    systemPrompt: textOrFile(flags['system-prompt'], flags['system-prompt-file']) ?? base.systemPrompt,
    toolsets: flags.toolset ?? base.toolsets,
    llmIntegrationId: flags.llm ?? base.llmIntegrationId,
    model: flags.model ?? base.model,
    memoryEnabled: flags.memory ?? base.memoryEnabled ?? false,
    ragSourceIds: flags['rag-source'] ?? base.ragSourceIds,
    planId: base.planId,
    isDefault: flags.default ?? base.isDefault ?? false,
  }
}
