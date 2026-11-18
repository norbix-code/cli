import {CliError, toEnvelope} from './cli-error.js'

/**
 * Tables and wording of the account billing commands: the Managed Service
 * bundles and the Norbix-managed Atlas clusters. `--json` never passes here;
 * it prints the server answer as it is.
 */

interface BundlePrice {
  amount?: number
  currency?: string
}

interface Bundle {
  bundle?: string
  projectCap?: number
  monthly?: BundlePrice
  annual?: BundlePrice
}

interface Cluster {
  id?: string
  displayName?: string
  norbixRegionCode?: string
  tierCode?: string
  /** The next step on the ladder FLEX → M10 → M20 → M30 → M40 within the plan; empty at the top. */
  nextTierCode?: string
  /** The highest tier the account's plan allows. */
  topTierCode?: string
  status?: string
  databases?: unknown[]
  usage?: {databaseCount?: number}
  nearLimits?: string[]
}

/** The gateway refuses a bundle that allows fewer enabled projects than the account has (HTTP 400). */
export const BUNDLE_TOO_SMALL_CODE = 'CM-ERRORS-ACCOUNT-023'

/** Flag value → the gateway's `ManagedServiceBundle`. */
export const BUNDLES = {starter: 'Starter', growth: 'Growth', scale: 'Scale'} as const

/** Flag value → the gateway's `SubscriptionBillingPeriod`. */
export const BILLING_PERIODS = {monthly: 'Monthly', annual: 'Annual'} as const

/** Flag value → the word in a sentence: "billed monthly", "billed annually". */
export const BILLED = {monthly: 'monthly', annual: 'annually'} as const

function table(header: string[], rows: string[][]): string {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i].length)))
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd()
  return [line(header), ...rows.map(line)].join('\n')
}

/** A price in minor units as money: `{amount: 5900, currency: 'usd'}` → `59.00 USD`. */
export function formatPrice(price: BundlePrice | undefined): string {
  if (typeof price?.amount !== 'number') return '-'
  return `${(price.amount / 100).toFixed(2)} ${(price.currency ?? '').toUpperCase()}`.trimEnd()
}

/** The bundles for the terminal: name, project limit, monthly and annual price. */
export function formatBundles(res: unknown): string {
  const bundles = ((res ?? {}) as {bundles?: Bundle[]}).bundles ?? []
  if (bundles.length === 0) return 'No bundles.'
  return table(
    ['BUNDLE', 'PROJECTS', 'MONTHLY', 'ANNUAL'],
    bundles.map((b) => [b.bundle ?? '-', String(b.projectCap ?? '-'), formatPrice(b.monthly), formatPrice(b.annual)]),
  )
}

const CANNOT_CREATE: Record<string, string> = {
  TrialOneCluster: 'A new cluster cannot be created: a trial account has one cluster.',
  ClusterLimitReached: 'A new cluster cannot be created: the account has reached its cluster limit.',
}

/**
 * The account's Norbix-managed Atlas clusters for the terminal, then one line
 * when a new cluster cannot be created. NEAR LIMIT names the limits a cluster
 * is close to; `-` means none.
 */
export function formatClusters(res: unknown): string {
  const answer = (res ?? {}) as {clusters?: Cluster[]; canCreateNew?: boolean; cannotCreateReason?: string}
  const clusters = answer.clusters ?? []
  const lines = [
    clusters.length === 0
      ? 'No Norbix-managed clusters.'
      : table(
          ['ID', 'NAME', 'REGION', 'TIER', 'NEXT', 'STATUS', 'DATABASES', 'NEAR LIMIT'],
          clusters.map((c) => [
            c.id ?? '-',
            c.displayName ?? '-',
            c.norbixRegionCode ?? '-',
            c.tierCode ?? '-',
            c.nextTierCode || '-',
            c.status ?? '-',
            String(c.usage?.databaseCount ?? c.databases?.length ?? 0),
            c.nearLimits?.length ? c.nearLimits.join(', ') : '-',
          ]),
        ),
  ]
  if (answer.canCreateNew === false) {
    const reason = answer.cannotCreateReason
    lines.push('', (reason && CANNOT_CREATE[reason]) ?? `A new cluster cannot be created${reason ? `: ${reason}` : ''}.`)
  }

  return lines.join('\n')
}

/**
 * The gateway's refusal of a bundle that is too small, as a CLI error: the
 * same envelope (its message says how many projects to disable; the numbers
 * are in the context) with a hint that names what to run next. Any other
 * error comes back unchanged.
 */
export function explainBundleRefusal(error: unknown, command: string): unknown {
  const envelope = toEnvelope(error, {command})
  if (envelope.code !== BUNDLE_TOO_SMALL_CODE) return error
  return new CliError({
    ...envelope,
    hint: 'Turn projects off with `norbix project disable --project <id> --yes` (list them: `norbix account projects`), then run the command again.',
  })
}

/** The gateway refuses a discount code with this code; `reason` in the context says why. */
export const DISCOUNT_REFUSED_CODE = 'CM-ERRORS-ACCOUNT-027'

/** Each `reason` of a refused discount code, as a sentence with what to do next. */
const DISCOUNT_REASONS: Record<string, string> = {
  not_found: 'No discount code with this name exists. Check the spelling.',
  not_started: 'This code cannot be used yet: its start date has not come.',
  expired: 'This code has expired.',
  not_for_bundle: 'This code is not for this bundle. Check it with another `--bundle`.',
  monthly_only: 'This code is for monthly billing only. Check it with `--period monthly`.',
  wrong_billing_period: 'This code is for the other billing period. Check it with the other `--period`.',
  already_has_discount: 'The account already has a discount; only one at a time. `norbix account status` shows it.',
  already_used: 'This code was already used by this account owner.',
}

export interface BundleDiscount {
  code?: string
  percentOff?: number
  amountOff?: number
  currency?: string
  months?: number
  endsAt?: string
}

/** What a discount gives, in one line: `LAUNCH30: 30% off for 3 months`, `WELCOME: 10.00 USD off each invoice, forever`. */
export function formatDiscount(discount: BundleDiscount | undefined): string {
  if (!discount) return 'No discount.'
  const off =
    typeof discount.percentOff === 'number'
      ? `${discount.percentOff}% off`
      : typeof discount.amountOff === 'number'
        ? `${formatPrice({amount: discount.amountOff, currency: discount.currency})} off each invoice`
        : 'a discount'
  const term =
    typeof discount.months === 'number' ? `for ${discount.months} month${discount.months === 1 ? '' : 's'}` : 'forever'
  const ends = discount.endsAt ? `, until ${discount.endsAt.slice(0, 10)}` : ''
  return `${discount.code ?? 'Discount'}: ${off} ${term}${ends}`
}

/**
 * A refused discount code as a CLI error: the gateway's envelope (the reason
 * stays in the context) with a hint that says what the reason means. Any
 * other error comes back unchanged.
 */
export function explainDiscountRefusal(error: unknown, command: string): unknown {
  const envelope = toEnvelope(error, {command})
  if (envelope.code !== DISCOUNT_REFUSED_CODE) return error
  const reason = envelope.context?.reason
  const hint = typeof reason === 'string' ? DISCOUNT_REASONS[reason] : undefined
  return new CliError({...envelope, ...(hint ? {hint} : {})})
}

/** The waiting list is switched off on this installation. */
export const TRIAL_WAITLIST_CLOSED_CODE = 'CM-ERRORS-ACCOUNT-044'

/** A region code the installation does not know. */
export const TRIAL_REGION_UNKNOWN_CODE = 'CM-ERRORS-ACCOUNT-043'

/** The answer of `GET /account/trial-availability`. */
export interface TrialAvailability {
  limitsOn?: boolean
  region?: string
  trialsOpen?: boolean
  waitlistOpen?: boolean
  onWaitlist?: boolean
  refusal?: string
}

/** Each `refusal` of a trial after checkout, in plain words. */
const TRIAL_REFUSALS: Record<string, string> = {
  CardAlreadyHadTrial: 'The trial was refused after checkout: this card already had a free trial on another account.',
}

/** Whether a free trial can start now, in a few plain lines. */
export function formatTrialAvailability(res: unknown): string {
  const a = (res ?? {}) as TrialAvailability
  const where = a.region ? ` in ${a.region}` : ''
  const lines: string[] = []
  if (a.limitsOn === false) {
    lines.push(`No trial limits on this installation: a free trial can start${where}.`)
  } else if (a.trialsOpen) {
    lines.push(`A free trial can start${where} now.`)
  } else {
    lines.push(`No free trial slot${where} now: the region is full. Buy a bundle without a trial${a.waitlistOpen ? ', or join the waiting list (`norbix account trial waitlist join --consent`)' : ''}.`)
  }

  if (a.onWaitlist) lines.push("The account owner's email is already on the waiting list.")
  if (a.refusal) lines.push(TRIAL_REFUSALS[a.refusal] ?? `The trial was refused after checkout: ${a.refusal}.`)
  return lines.join('\n')
}

/** The answer of `POST /account/trial-waitlist`, in one line. The server's message wins when it sends one. */
export function formatTrialWaitlist(res: unknown): string {
  const answer = (res ?? {}) as {status?: string; message?: string}
  if (answer.message) return answer.message
  switch (answer.status) {
    case 'added':
      return "The account owner's email is on the waiting list. Norbix emails an invitation link, valid a few days, when a trial slot frees."
    case 'alreadyListed':
      return "The account owner's email is already on the waiting list."
    case 'alreadyCustomer':
      return 'This email already had a Norbix trial or subscription; it was not added to the waiting list.'
    default:
      return `Waiting list: ${answer.status ?? 'no status'}.`
  }
}

/**
 * The trial-limit refusals as CLI errors, with a hint: the waiting list is
 * switched off (-044), or the region is not known (-043). Any other error
 * comes back unchanged.
 */
export function explainTrialRefusal(error: unknown, command: string): unknown {
  const envelope = toEnvelope(error, {command})
  if (envelope.code === TRIAL_WAITLIST_CLOSED_CODE) {
    return new CliError({...envelope, hint: 'The trial waiting list is switched off on this installation. Buy a bundle without a trial instead.'})
  }

  if (envelope.code === TRIAL_REGION_UNKNOWN_CODE) {
    return new CliError({...envelope, hint: 'Unknown region code. List the regions with `norbix account regions`.'})
  }

  return error
}
