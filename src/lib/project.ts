import {readFileSync} from 'node:fs'

import {confirm} from '@inquirer/prompts'
import type {Norbix} from '@norbix.ai/ts'

import {BaseCommand, type GlobalFlags} from '../base.js'

/**
 * Base for the `project` commands.
 *
 * Every project route carries `{projectId}` in its path, and the SDK does not
 * fill it from the client config — the request must carry it. So each command
 * asks for the client and the project id together, from the same resolved
 * context (`--project`, NORBIX_PROJECT_ID, profile or login session).
 */
export abstract class ProjectCommand extends BaseCommand {
  protected projectClient(flags: GlobalFlags, projectId?: string): {client: Norbix; projectId: string} {
    const client = this.client(flags)
    const id = projectId ?? this.resolveContext(flags).projectId
    if (!id) this.error('No project ID configured.\nRun `norbix configure` (or `norbix login`), or pass --project.')
    return {client, projectId: id}
  }

  /**
   * Ask before a change that is hard to undo. `--yes` skips the question. With
   * no terminal to ask in (a script, a pipe) the command refuses instead of
   * going ahead — a script must say `--yes` on purpose.
   */
  protected async confirmOrStop(yes: boolean, message: string): Promise<boolean> {
    if (yes) return true
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      this.error(`${message}\nNo terminal to confirm in — pass --yes to go ahead.`)
    }

    const ok = await confirm({message, default: false})
    if (!ok) this.print('Cancelled.')
    return ok
  }
}

/** Read a text file flag (Markdown, a prompt). */
export function readTextFile(path: string): string {
  return readFileSync(path, 'utf8')
}

/** The origins currently allowed on a project, from a `getProject` answer. */
export function originsOf(res: unknown): string[] {
  const item = (res as {item?: {allowedOrigins?: string[]}} | undefined)?.item
  return item?.allowedOrigins ?? []
}

/** The project from a `getProject` answer (empty when the answer has none). */
export function projectOf(res: unknown): Record<string, unknown> {
  return ((res as {item?: Record<string, unknown>} | undefined)?.item ?? {}) as Record<string, unknown>
}

/**
 * Compare origins the way the gateway stores them: an origin with no scheme
 * means https, and a trailing slash does not count.
 */
export function sameOrigin(a: string, b: string): boolean {
  const norm = (o: string) => (/^[a-z]+:\/\//i.test(o) ? o : `https://${o}`).replace(/\/+$/, '').toLowerCase()
  return norm(a) === norm(b)
}
