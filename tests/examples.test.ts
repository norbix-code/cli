import {Config} from '@oclif/core'
import {fileURLToPath} from 'node:url'
import {expect, it} from 'vitest'

/**
 * Every help example must start with the command it belongs to. `norbix raw`
 * once showed `norbix api /v2/logs/settings --hub` — `api` takes plain words,
 * not a path, so the example failed for anyone who copied it.
 */
it('every command example starts with its own command', async () => {
  const config = await Config.load(fileURLToPath(new URL('..', import.meta.url)))
  const wrong: string[] = []
  // Our own commands only — plugin commands (autocomplete) write theirs differently.
  for (const command of config.commands.filter((c) => c.pluginName === config.name)) {
    const prefix = `<%= config.bin %> ${command.id.replaceAll(':', ' ')}`
    for (const example of command.examples ?? []) {
      // An example may start with a pipe (`cat order.json | norbix db insert …`).
      const full = typeof example === 'string' ? example : example.command
      const text = full.slice(Math.max(0, full.indexOf('<%= config.bin %>')))
      if (text !== prefix && !text.startsWith(`${prefix} `)) wrong.push(`${command.id}: ${full}`)
    }
  }

  expect(config.commands.length).toBeGreaterThan(100)
  expect(wrong).toEqual([])
})
