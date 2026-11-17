// `npm audit --omit=dev --audit-level=high`, with the dated owner exceptions of
// audit-exceptions.json. Fails on any high or critical advisory that is not
// excepted, and on an exception that has expired.
import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'

const LEVELS = new Set(['high', 'critical'])
const {exceptions} = JSON.parse(readFileSync(new URL('../audit-exceptions.json', import.meta.url), 'utf8'))
const today = new Date().toISOString().slice(0, 10)
const active = new Map(exceptions.filter((e) => e.until >= today).map((e) => [e.id, e]))

let raw
try {
  raw = execFileSync('npm', ['audit', '--omit=dev', '--json'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit']})
} catch (error) {
  raw = error.stdout // npm audit exits 1 when it finds anything
}
let report
try {
  report = JSON.parse(raw)
} catch {
  console.error('::error::npm audit gave no JSON report')
  process.exit(1)
}
if (report.error || !report.vulnerabilities) {
  console.error(`::error::npm audit failed: ${report.error?.summary ?? 'no vulnerabilities section'}`)
  process.exit(1)
}

const advisories = new Map()
for (const vuln of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vuln.via) {
    if (typeof via !== 'object' || !LEVELS.has(via.severity)) continue
    const id = String(via.url ?? '').split('/').pop()
    advisories.set(id, `${id} ${via.severity} ${via.name}: ${via.title}`)
  }
}

const failing = [...advisories].filter(([id]) => !active.has(id))
for (const [id, line] of advisories) console.log(`${active.has(id) ? 'excepted until ' + active.get(id).until : 'FAIL'}  ${line}`)
for (const e of exceptions.filter((x) => x.until < today)) console.log(`expired exception ${e.id} (${e.until}) — remove it from audit-exceptions.json`)
if (failing.length) {
  console.error(`::error::${failing.length} high or critical advisory(ies) in production dependencies`)
  process.exit(1)
}
console.log(`npm audit (production): ${advisories.size} high/critical, all excepted`)
