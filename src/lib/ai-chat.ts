import {Flags} from '@oclif/core'
import type {Norbix} from '@norbix.ai/ts'

import {BaseCommand, type GlobalFlags} from '../base.js'

/**
 * The developer AI chat (`norbix ai chat …`): the chat of the Cloud dashboard,
 * on the Hub under `/{version}/account/chat` and `/{version}/account/ai/tools`.
 *
 * The chat belongs to the signed-in account user (or service user), so the
 * session commands need no project. A turn, the availability and the memory
 * are about a project when one is set (`--project`, the profile, the session):
 * they send its id and env in the request, and the env rule applies — the same
 * pair the dashboard sends from the screen the user is on. `--account-level` sends
 * neither, so the chat works at account level.
 *
 * The end-user chat (`/{version}/ai/chat`, a signed-in project user on the
 * API host) has no command: the CLI never signs in as a project's end user.
 */
export abstract class AiChatCommand extends BaseCommand {
  static accountFlag = {
    'account-level': Flags.boolean({
      description: 'Account level: send no project or environment, even when one is set',
      default: false,
    }),
  }

  /** A client for a call that needs no project (sessions, entries, plans, memory notes, tools). */
  protected accountClient(flags: GlobalFlags): Norbix {
    return this.client(flags, {requireProject: false, account: true})
  }

  /**
   * A client and the project scope the dashboard would send: `{projectId, env}`
   * when a project is set and `--account-level` is not given (the env rule applies),
   * else `{}` on an account-level client.
   */
  protected scopedClient(flags: GlobalFlags & {'account-level'?: boolean}): {client: Norbix; scope: {projectId?: string; env?: string}} {
    const ctx = this.resolveContext(flags)
    if (flags['account-level'] || !ctx.projectId) return {client: this.accountClient(flags), scope: {}}
    return {client: this.client(flags), scope: {projectId: ctx.projectId, env: ctx.env ?? 'PROD'}}
  }
}

/** A turn runs the model and its tools before it answers: give it 5 minutes, not the 30 s default. */
export const CHAT_TURN_TIMEOUT_MS = 300_000
