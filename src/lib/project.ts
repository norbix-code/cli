import {readFileSync} from 'node:fs'

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
  /**
   * `reader` is for the read that comes before a write (current origins,
   * current settings). A dry run stops every request, so the read goes out
   * live — it changes nothing — and only the write is stopped and printed.
   */
  protected projectClient(
    flags: GlobalFlags,
    projectId?: string,
  ): {client: Norbix; reader: Norbix; projectId: string} {
    const client = this.client(flags)
    const reader = flags['dry-run'] ? this.client({...flags, 'dry-run': false}) : client
    const id = projectId ?? this.resolveContext(flags).projectId
    if (!id) this.error('No project ID configured.\nRun `norbix configure` (or `norbix login`), or pass --project.')
    return {client, reader, projectId: id}
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
