/**
 * Environment promotion (gateway contract: gateway/docs/tasks/promotion-v2.md,
 * "Preview / result contract"): the request bodies, the human preview, and the
 * promotion hint for content written straight into a higher environment.
 *
 * The SDK (@norbix.ai/ts 4.29.0) does not type the v2 fields yet, so they are
 * typed here; the SDK transport sends the whole body as it is.
 *
 * No oclif import.
 */

import {usageError} from './cli-error.js'

// ---------- the answer ----------

export interface PromotionSummary {
  added?: number
  changed?: number
  unchanged?: number
  deleted?: number
  kept?: number
  skipped?: number
  recordsAtRisk?: number
  integrationsSeeded?: number
  integrationsSkipped?: number
  integrationsMapped?: number
  integrationsRemoved?: number
  isNoOp?: boolean
}

export interface PromotionItem {
  type: string
  id?: string
  name?: string
  status: string
  matchedBy?: string
  previousTargetId?: string
  builtIn?: boolean
  recordCount?: number
  note?: string
}

export interface PromotionIntegrationTarget {
  id: string
  name?: string
  provider?: string
  isDefault?: boolean
}

export interface PromotionIntegration {
  module: string
  id: string
  /**
   * The id the integration has (or will have) in the target env. Equals `id` except a seeded
   * Files integration (its own new id per target env) and a `map` (the mapped target integration).
   */
  targetId?: string
  name?: string
  provider?: string
  status?: string
  defaultAction?: string
  action?: string
  mapToId?: string
  holdsSecret?: boolean
  isFake?: boolean
  realSender?: boolean
  targets?: PromotionIntegrationTarget[]
  warning?: string
  /** Why the default is what it is, e.g. "PROD already has its own Fake Email integration" (gateway 2026-10-21; not a warning). */
  note?: string
}

export interface PromotionNotPromoted {
  area: string
  scope?: string
  reason?: string
  count?: number
}

export interface PromotionRef {
  contentType?: string
  contentId?: string
  refKind?: string
  unresolvedRef?: string
}

export interface PromotionResult {
  summary?: PromotionSummary
  items?: PromotionItem[]
  integrations?: PromotionIntegration[]
  notPromoted?: PromotionNotPromoted[]
  requiresConfirmation?: boolean
  blockers?: PromotionRef[]
  warnings?: PromotionRef[]
  termChanges?: Array<{taxonomyId?: string; termId?: string; slug?: string; change?: string}>
  fromVersion?: number | null
  wasDryRun?: boolean
  /**
   * Promote answers (gateway 2026-10-21): true when the real run changed the target and wrote the
   * rollback anchor; false on a preview and on a real run with nothing to change (no events, no
   * fromVersion). Absent from older gateways and from rollback answers.
   */
  promoted?: boolean
  /** One sentence for people, e.g. "Nothing to promote — PROD already matches TEST." */
  message?: string
}

export interface BuiltInRepairEnv {
  env: string
  isNoOp?: boolean
  items?: PromotionItem[]
}

// ---------- the requests ----------

export type IntegrationAction = 'seed' | 'skip' | 'map'

export interface IntegrationChoice {
  id: string
  action: IntegrationAction
  mapToId?: string
}

export interface PromoteBody {
  sourceEnv: string
  targetEnv: string
  dryRun: boolean
  confirmRecordLoss?: boolean
  integrationChoices?: IntegrationChoice[]
}

export interface RollbackBody {
  targetEnv: string
  fromVersion: number
  dryRun: boolean
  confirmRecordLoss?: boolean
}

export interface RepairBody {
  environmentName?: string
  dryRun: boolean
}

/** The built-in repair route (not in the SDK yet). */
export const REPAIR_PATH = '/{version}/account/projects/environments/built-ins/repair'

/** The gateway's "a real run would hide records" refusal. */
export const RECORD_LOSS_CODE = 'CM-ERRORS-ENVIRONMENTS-013'

/**
 * `--seed a --skip b --map c=d` → the choices list. One id may appear once;
 * a map needs `<source id>=<target id>`.
 */
export function parseChoices(flags: {seed?: string[]; skip?: string[]; map?: string[]}): IntegrationChoice[] {
  const choices: IntegrationChoice[] = []
  const seen = new Set<string>()
  const add = (choice: IntegrationChoice) => {
    if (seen.has(choice.id)) {
      throw usageError(
        `Integration ${choice.id} has more than one choice.`,
        'Give each source integration one of --seed, --skip or --map.',
        'norbix env promote --help',
      )
    }

    seen.add(choice.id)
    choices.push(choice)
  }

  for (const id of flags.seed ?? []) add({id: id.trim(), action: 'seed'})
  for (const id of flags.skip ?? []) add({id: id.trim(), action: 'skip'})
  for (const pair of flags.map ?? []) {
    const eq = pair.indexOf('=')
    const id = eq > 0 ? pair.slice(0, eq).trim() : ''
    const mapToId = eq > 0 ? pair.slice(eq + 1).trim() : ''
    if (!id || !mapToId) {
      throw usageError(
        `--map needs <source integration id>=<target integration id>, got "${pair}".`,
        'Take both ids from the preview: the integration line (source) and its "targets" (target, same module).',
        'norbix env promote --help',
      )
    }

    add({id, action: 'map', mapToId})
  }

  return choices
}

/** The plan inside a gateway error body (`item`), when the refusal carries one. */
export function planOfError(raw: unknown): PromotionResult | undefined {
  const item = (raw as {item?: unknown} | undefined)?.item
  return item && typeof item === 'object' ? (item as PromotionResult) : undefined
}

// ---------- the human preview ----------

const STATUS_ORDER = ['added', 'changed', 'deleted', 'kept', 'skipped', 'unchanged', 'removed', 'present', 'created', 'realigned']

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length)
}

/** One line per item: type, name, id, and what is special about it. */
function itemLine(item: PromotionItem): string {
  const extra: string[] = []
  if (item.recordCount !== undefined && item.recordCount !== null) extra.push(plural(item.recordCount, 'record'))
  if (item.matchedBy === 'name') extra.push(`matched by name${item.previousTargetId ? ` (was ${item.previousTargetId})` : ''}`)
  if (item.builtIn) extra.push('built-in')
  const tail = extra.length > 0 ? `  [${extra.join(', ')}]` : ''
  const note = item.note ? `\n        ${item.note}` : ''
  return `    ${pad(item.type, 16)} ${pad(item.name ?? '', 32)} ${item.id ?? ''}${tail}${note}`
}

/** The items grouped by status, in a fixed order; unchanged items collapse to one line of names. */
export function renderItems(items: PromotionItem[] = []): string[] {
  if (items.length === 0) return ['  (no content items)']
  const groups = new Map<string, PromotionItem[]>()
  for (const item of items) {
    const key = (item.status ?? 'other').toLowerCase()
    groups.set(key, [...(groups.get(key) ?? []), item])
  }

  const keys = [...groups.keys()].sort((a, b) => {
    const ia = STATUS_ORDER.indexOf(a)
    const ib = STATUS_ORDER.indexOf(b)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
  const lines: string[] = []
  for (const key of keys) {
    const group = groups.get(key)!
    lines.push(`  ${key.toUpperCase()} (${group.length})`)
    if (key === 'unchanged') {
      lines.push(`    ${group.map((i) => `${i.type} ${i.name ?? i.id ?? ''}`.trim()).join(', ')}`)
      continue
    }

    for (const item of group) lines.push(itemLine(item))
  }

  return lines
}

/** One line per source integration with the choice that applies, real senders marked loudly. */
export function renderIntegrations(integrations: PromotionIntegration[] = [], rollback = false): string[] {
  if (integrations.length === 0) return ['  (no integrations)']
  const lines: string[] = []
  for (const i of integrations) {
    const flags = [
      i.realSender ? 'REAL SENDER' : '',
      i.holdsSecret ? 'holds a secret' : '',
      i.isFake ? 'fake' : '',
    ].filter(Boolean)
    const choice = rollback
      ? (i.status ?? '')
      : `${i.action ?? i.defaultAction ?? ''}${i.action && i.defaultAction && i.action !== i.defaultAction ? ` (default ${i.defaultAction})` : ''}` +
        (i.mapToId ? ` → ${i.mapToId}` : '')
    lines.push(
      `  ${i.realSender ? '!' : ' '} ${pad(i.module, 10)} ${pad(i.name ?? '', 30)} ${pad(i.provider ?? '', 24)} ${pad(choice, 20)} ${i.id}` +
        (flags.length > 0 ? `  [${flags.join(', ')}]` : ''),
    )
    if (i.targetId && i.targetId !== i.id) {
      const how = i.action === 'map' || i.status === 'mapped' ? 'the mapped target integration' : 'its own new id — apps use this id there'
      lines.push(`      id in the target: ${i.targetId} (${how})`)
    }
    if (i.warning) lines.push(`      warning: ${i.warning}`)
    if (i.note) lines.push(`      note: ${i.note}`)
    if (!rollback && (i.targets?.length ?? 0) > 0) {
      lines.push(`      in target: ${i.targets!.map((t) => `${t.name ?? t.id} (${t.provider ?? '?'}${t.isDefault ? ', default' : ''}) ${t.id}`).join('; ')}`)
    }
  }

  return lines
}

/** `--seed / --skip / --map` flags that repeat the choices the user gave (for the "run it" line). */
export function choiceFlags(choices: IntegrationChoice[]): string {
  return choices
    .map((c) => (c.action === 'map' ? `--map ${c.id}=${c.mapToId}` : `--${c.action} ${c.id}`))
    .join(' ')
}

export interface RenderContext {
  kind: 'promote' | 'rollback'
  source?: string
  target: string
  dryRun: boolean
  /** The flags to repeat in the "run it for real" line. */
  rerun: string
}

/**
 * A real promote that changed nothing: the gateway says `promoted: false` (2026-10-21). An older
 * gateway has no `promoted` field; then a no-op summary without a rollback anchor means the same.
 */
export function nothingPromoted(result: PromotionResult, ctx: Pick<RenderContext, 'kind' | 'dryRun'>): boolean {
  if (ctx.kind !== 'promote' || ctx.dryRun || (result.blockers?.length ?? 0) > 0) return false
  if (result.promoted !== undefined) return result.promoted === false
  return result.summary?.isNoOp === true && (result.fromVersion === undefined || result.fromVersion === null)
}

/** The whole preview / result as text, the way a person reads it. */
export function renderPromotion(result: PromotionResult, ctx: RenderContext): string {
  const s = result.summary ?? {}
  const what = ctx.kind === 'promote' ? `${ctx.source} → ${ctx.target}` : `rollback of ${ctx.target}`
  const lines: string[] = []
  const nothing = nothingPromoted(result, ctx)
  if (nothing) {
    // Nothing was written: no new version, no rollback anchor.
    lines.push(`Nothing to promote — ${ctx.target} already matches ${ctx.source}.`)
  } else {
    lines.push(ctx.dryRun ? `Preview: ${what} — nothing was changed.` : ctx.kind === 'promote' ? `Promoted ${what}.` : `Rolled back ${ctx.target}.`)
    if (s.isNoOp) lines.push(`Nothing to change — ${ctx.target} already matches.`)
  }

  const at = s.recordsAtRisk ? ` (${plural(s.recordsAtRisk, 'record')} at risk)` : ''
  lines.push(
    `Summary: ${s.added ?? 0} added · ${s.changed ?? 0} changed · ${s.unchanged ?? 0} unchanged · ${s.deleted ?? 0} deleted${at} · ` +
      `${s.kept ?? 0} kept · ${s.skipped ?? 0} skipped`,
  )
  lines.push(
    `Integrations: ${s.integrationsSeeded ?? 0} seeded · ${s.integrationsSkipped ?? 0} skipped · ${s.integrationsMapped ?? 0} mapped` +
      (ctx.kind === 'rollback' || s.integrationsRemoved ? ` · ${s.integrationsRemoved ?? 0} removed` : ''),
  )

  lines.push('', 'Content', ...renderItems(result.items))
  lines.push('', ctx.kind === 'promote' ? 'Integrations (choice per source integration; ! = sends real e-mail / SMS / push)' : 'Integrations', ...renderIntegrations(result.integrations, ctx.kind === 'rollback'))

  if ((result.termChanges?.length ?? 0) > 0) {
    const counts = new Map<string, number>()
    for (const t of result.termChanges!) counts.set(t.change ?? 'changed', (counts.get(t.change ?? 'changed') ?? 0) + 1)
    lines.push('', `Taxonomy terms: ${[...counts].map(([k, n]) => `${n} ${k}`).join(' · ')}`)
  }

  if ((result.notPromoted?.length ?? 0) > 0) {
    lines.push('', 'Not promoted')
    for (const n of result.notPromoted!) {
      lines.push(`  - ${n.area}${n.scope ? ` (${n.scope})` : ''}${n.count !== undefined && n.count !== null ? ` [${n.count}]` : ''}: ${n.reason ?? ''}`)
    }
  }

  if ((result.warnings?.length ?? 0) > 0) {
    lines.push('', 'Warnings')
    for (const w of result.warnings!) lines.push(`  - ${w.refKind ?? ''}: ${[w.contentType, w.contentId].filter(Boolean).join(' ')} ${w.unresolvedRef ?? ''}`.trimEnd())
  }

  if ((result.blockers?.length ?? 0) > 0) {
    lines.push('', 'Blockers (fix these first — nothing can be promoted while they exist)')
    for (const b of result.blockers!) lines.push(`  - ${b.refKind ?? ''}: ${[b.contentType, b.contentId].filter(Boolean).join(' ')} → ${b.unresolvedRef ?? ''}`)
  }

  lines.push('')
  if (ctx.dryRun) {
    if ((result.blockers?.length ?? 0) > 0) {
      lines.push('Fix the blockers, then preview again.')
    } else {
      if (result.requiresConfirmation) {
        lines.push(`A real run hides the records listed under DELETED (they come back on rollback). Add --confirm-record-loss only if that is intended.`)
      }

      lines.push(`To apply it: ${ctx.rerun} --yes${result.requiresConfirmation ? ' --confirm-record-loss' : ''}`)
      if (ctx.kind === 'promote') lines.push('Change an integration choice with --seed <id>, --skip <id> or --map <id>=<target id>.')
    }
  } else if (ctx.kind === 'promote' && result.fromVersion !== undefined && result.fromVersion !== null) {
    lines.push(`Rollback anchor: fromVersion ${result.fromVersion}. To undo: norbix env rollback --to ${ctx.target} --version ${result.fromVersion}`)
  }

  return lines.join('\n')
}

/** The built-in repair answer as text. */
export function renderRepair(envs: BuiltInRepairEnv[], dryRun: boolean): string {
  const lines: string[] = [dryRun ? 'Preview: built-in templates, footer and signature — nothing was changed.' : 'Built-ins repaired.']
  if (envs.length === 0) lines.push('No environment to repair (the project has only PROD).')
  for (const env of envs) {
    lines.push('', `${env.env}${env.isNoOp ? ' — nothing to do' : ''}`, ...renderItems(env.items))
  }

  if (dryRun && envs.some((e) => !e.isNoOp)) lines.push('', 'To apply it: add --yes')
  return lines.join('\n')
}

// ---------- the promotion hint ----------

/**
 * Commands that create or change content a promotion carries up: schemas,
 * taxonomies and terms, templates, footers, signatures, triggers. Records,
 * users and files are never promoted, so their commands never hint. The
 * gateway's MCP surface has the same list by tool name
 * (gateway AiToolPromotionHint.PromotedContentTools).
 */
export const PROMOTED_CONTENT_COMMANDS: ReadonlySet<string> = new Set([
  'db:schema:create',
  'db:schema:update',
  'db:schema:publish',
  'db:term:create',
  'db:term:update',
  'db:trigger:create',
  'email:template:create',
  'email:template:update',
  'email:clone',
  'email:footer:save',
  'email:signature:save',
  'push:template:create',
  'push:template:update',
  'push:clone',
  'sms:template:create',
  'sms:template:update',
  'sms:clone',
  'payments:trigger:save',
])

/**
 * The environment right below `env` on the ladder, or undefined. `order` is
 * lowest → PROD (`promotionOrder` of the env list). Without it, PROD's lower
 * env is TEST if the project has one, else the first other env.
 */
export function lowerEnvOf(env: string | undefined, order: string[] | undefined, envs: string[] | undefined): string | undefined {
  const target = (env ?? 'PROD').trim().toUpperCase()
  if (order && order.length > 0) {
    const upper = order.map((e) => e.trim().toUpperCase())
    const index = upper.indexOf(target)
    return index > 0 ? upper[index - 1] : undefined
  }

  if (target !== 'PROD' || !envs) return undefined
  const others = envs.map((e) => e.trim().toUpperCase()).filter((e) => e !== 'PROD').sort()
  if (others.length === 0) return undefined
  return others.includes('TEST') ? 'TEST' : others[0]
}

/** The hint sentence — the same words the gateway's MCP answers carry. */
export function promotionHint(env: string, lower: string): string {
  return `${env} is promoted from ${lower} — make the change in ${lower} and run \`norbix env promote --from ${lower} --to ${env}\``
}
