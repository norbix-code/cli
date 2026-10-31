import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs'
import {basename, extname, join, relative, sep} from 'node:path'

/**
 * What `norbix ai check` looks for: things an app adds beside Norbix. No oclif
 * import. A finding is a question, not a verdict: an allowed one stays in the
 * report with its reason (`norbix.boundaries.json`).
 */

export const ALLOW_FILE = 'norbix.boundaries.json'

export interface Finding {
  /** What it stands in for: `scheduler`, `files`, ... Also the key in the allow file. */
  rule: string
  file: string
  line?: number
  match: string
  use: string
}

interface Rule {
  id: string
  use: string
  packages: string[]
  code?: RegExp[]
  infra?: RegExp[]
}

const RULES: Rule[] = [
  {id: 'membership', use: 'Norbix Membership', packages: ['passport', 'next-auth', '@auth/core', 'jsonwebtoken', 'bcrypt', 'bcryptjs']},
  {id: 'database', use: 'Norbix Database', packages: ['pg', 'mysql2', 'mongoose', 'mongodb', 'prisma', '@prisma/client', 'drizzle-orm']},
  {id: 'files', use: 'Norbix Files', packages: ['@aws-sdk/client-s3', '@google-cloud/storage', '@azure/storage-blob']},
  {id: 'messaging', use: 'Norbix email, SMS and push templates', packages: ['nodemailer', '@sendgrid/mail', '@aws-sdk/client-ses', '@aws-sdk/client-sesv2', 'postmark', 'resend', 'twilio']},
  {
    id: 'scheduler',
    use: 'Norbix Scheduler',
    packages: ['node-cron', 'cron', 'node-schedule', 'agenda', 'bullmq'],
    infra: [/AWS::Events::Rule/, /AWS::Scheduler::Schedule/, /aws_cloudwatch_event_rule/, /google_cloud_scheduler_job/],
  },
  {id: 'payments', use: 'Norbix Payments', packages: ['stripe']},
  {id: 'runtime-cli', use: 'an official Norbix SDK; the CLI is for setup', packages: [], code: [/\b(?:spawn|exec|execFile|execSync)\(\s*['"`]norbix\b/]},
  {id: 'raw-http', use: 'an official Norbix SDK', packages: [], code: [/\bfetch\(\s*['"`][^'"`]*\/v3\/(?:auth|membership|database|files|notifications)\b/]},
]

const SKIP = new Set(['node_modules', 'dist', 'build', 'out', 'coverage', 'vendor', '.git', '.next', '.expo', '.claude', '.cursor', '.norbix-ai'])
const CODE = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx'])
const INFRA = new Set(['.yaml', '.yml', '.tf', '.json'])
/** Bigger files are generated; a line-by-line look at them finds nothing useful. */
const MAX_BYTES = 1_000_000

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name)) yield* walk(join(dir, entry.name))
    } else if (entry.isFile()) {
      yield join(dir, entry.name)
    }
  }
}

function packageFindings(path: string, file: string): Finding[] {
  let deps: Record<string, unknown> = {}
  try {
    // Runtime dependencies only: a dev tool is not part of what the app runs on.
    deps = (JSON.parse(readFileSync(path, 'utf8')) as {dependencies?: Record<string, unknown>}).dependencies ?? {}
  } catch {
    return []
  }

  return RULES.flatMap((rule) => rule.packages.filter((name) => name in deps).map((name) => ({rule: rule.id, file, match: name, use: rule.use})))
}

function lineFindings(path: string, file: string, pick: (rule: Rule) => RegExp[] | undefined): Finding[] {
  const lines = readFileSync(path, 'utf8').split('\n')
  return RULES.flatMap((rule) =>
    (pick(rule) ?? []).flatMap((pattern) =>
      lines.flatMap((text, index) => {
        const found = pattern.exec(text)
        return found ? [{rule: rule.id, file, line: index + 1, match: found[0], use: rule.use}] : []
      }),
    ),
  )
}

export function scan(root: string): Finding[] {
  const findings: Finding[] = []
  for (const path of walk(root)) {
    if (statSync(path).size > MAX_BYTES) continue
    const file = relative(root, path).split(sep).join('/')
    const ext = extname(path)
    if (basename(path) === 'package.json') findings.push(...packageFindings(path, file))
    else if (CODE.has(ext)) findings.push(...lineFindings(path, file, (rule) => rule.code))
    else if (INFRA.has(ext)) findings.push(...lineFindings(path, file, (rule) => rule.infra))
  }

  return findings
}

/** `{"allow": {"<rule>": "<why Norbix does not cover it>"}}`. A rule with no reason is not allowed. */
export function readAllow(root: string): Record<string, string> {
  const path = join(root, ALLOW_FILE)
  if (!existsSync(path)) return {}
  const allow = (JSON.parse(readFileSync(path, 'utf8')) as {allow?: Record<string, unknown>}).allow ?? {}
  return Object.fromEntries(Object.entries(allow).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim() !== ''))
}
