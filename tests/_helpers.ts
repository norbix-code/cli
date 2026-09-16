import {fileURLToPath} from 'node:url'

import {Config} from '@oclif/core'
import {vi} from 'vitest'

import {BaseCommand} from '../src/base.js'

/**
 * Test seam for the CLI commands.
 *
 * A command's job is to turn argv into one SDK call: pick the method, fill its
 * fields from args and flags. That is what these helpers check. The SDK itself
 * is replaced by a recorder, so no command in the test suite opens a socket and
 * no push provider is ever contacted.
 */

export interface RecordedCall {
  method: string
  request: Record<string, unknown>
}

/** A stand-in for `client.hub.notifications` that records every call. */
export function recordingNotifications(calls: RecordedCall[], result: unknown = {ok: true}) {
  return new Proxy(
    {},
    {
      get:
        (_target, method: string) =>
        (request: Record<string, unknown> = {}) => {
          calls.push({method, request})
          return Promise.resolve(result)
        },
    },
  )
}

/**
 * Run a command with the SDK client stubbed out. Returns every SDK call the
 * command made, plus whatever it printed.
 */
export async function runCommand(
  command: {run: (argv: string[], config: Config) => Promise<unknown>},
  argv: string[] = [],
  /**
   * Replace the stubbed `client.hub` — pass `{notifications: {}}` to test what a
   * command does when the installed SDK is missing the method it wants.
   */
  hub?: Record<string, unknown>,
): Promise<{calls: RecordedCall[]; output: string[]; result: unknown}> {
  const calls: RecordedCall[] = []
  const output: string[] = []

  const config = await loadConfig()

  const clientSpy = vi
    .spyOn(BaseCommand.prototype as unknown as {client: () => unknown}, 'client')
    .mockReturnValue({hub: hub ?? {notifications: recordingNotifications(calls)}})
  const logSpy = vi
    .spyOn(BaseCommand.prototype as unknown as {log: (m?: string) => void}, 'log')
    .mockImplementation((message?: string) => {
      output.push(message ?? '')
    })

  try {
    const result = await command.run(argv, config)
    return {calls, output, result}
  } finally {
    clientSpy.mockRestore()
    logSpy.mockRestore()
  }
}

let cached: Config | undefined

async function loadConfig(): Promise<Config> {
  cached ??= await Config.load(fileURLToPath(new URL('..', import.meta.url)))
  return cached
}
