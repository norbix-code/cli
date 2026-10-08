import {mkdirSync, statSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'

/** Write the default host's discovery answer into `home`'s cache (built-in addresses, fresh). */
export function seedDefaultHost(home: string): void {
  const dir = join(home, '.norbix', 'hosts')
  mkdirSync(dir, {recursive: true})
  const fetchedAt = new Date().toISOString()
  writeFileSync(
    join(dir, 'hub.norbix.ai.json'),
    JSON.stringify({hubUrl: 'https://hub.norbix.ai', apiUrl: 'https://api.norbix.ai', regions: [], fetchedAt, source: 'built-in'}),
  )
  writeFileSync(join(dir, 'aliases.json'), JSON.stringify({'hub.norbix.ai': {hub: 'hub.norbix.ai', fetchedAt}}))
}

/** True when only the owner may read `path` (mode 600). Windows has no such modes: always true there. */
export function ownerOnly(path: string): boolean {
  return process.platform === 'win32' || (statSync(path).mode & 0o777) === 0o600
}
