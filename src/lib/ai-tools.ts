import {Flags} from '@oclif/core'
import type {Norbix} from '@norbix.ai/ts'

import {BaseCommand, type GlobalFlags} from '../base.js'

/**
 * The AI tool inventory (`norbix ai tools`, `norbix ai tool call`): the tools an
 * external agent can call, on the Hub under `/{version}/account/ai/tools`.
 *
 * The list needs no project. A tool call is about a project when one is set
 * (`--project`, the profile): it sends its id and env, and the env rule
 * applies. `--account-level` sends neither.
 *
 * There is no developer chat command: the developer chat in Cloud was retired
 * (2026-11-18). Developers connect their own AI tool over MCP. The end-user
 * chat (`/{version}/ai/chat`, a signed-in project user on the API host) has no
 * command either: the CLI never signs in as a project's end user.
 */
export abstract class AiToolsCommand extends BaseCommand {
  static accountFlag = {
    'account-level': Flags.boolean({
      description: 'Account level: send no project or environment, even when one is set',
      default: false,
    }),
  }

  /** A client for a call that needs no project (the tool list). */
  protected accountClient(flags: GlobalFlags): Norbix {
    return this.client(flags, {requireProject: false, account: true})
  }

  /**
   * A client and the project scope: `{projectId, env}` when a project is set
   * and `--account-level` is not given (the env rule applies), else `{}` on an
   * account-level client.
   */
  protected scopedClient(flags: GlobalFlags & {'account-level'?: boolean}): {client: Norbix; scope: {projectId?: string; env?: string}} {
    const ctx = this.resolveContext(flags)
    if (flags['account-level'] || !ctx.projectId) return {client: this.accountClient(flags), scope: {}}
    return {client: this.client(flags), scope: {projectId: ctx.projectId, env: ctx.env ?? 'PROD'}}
  }
}
