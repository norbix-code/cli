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

/** The only tier a cluster can be moved to. */
export const UPGRADE_TIER = 'M10'

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
          ['ID', 'NAME', 'REGION', 'TIER', 'STATUS', 'DATABASES', 'NEAR LIMIT'],
          clusters.map((c) => [
            c.id ?? '-',
            c.displayName ?? '-',
            c.norbixRegionCode ?? '-',
            c.tierCode ?? '-',
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
