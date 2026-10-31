/** What a campaign's rows add up to (`CampaignStatsDto`). */
interface CampaignStats {
  batches?: number
  sent?: number
  failed?: number
  failedRetryable?: number
  cancelled?: number
  blocked?: number
  inProgress?: number
  removedRecipients?: number
  successRate?: number
}

/**
 * `<channel> campaign <id> --stats` for the terminal. Blocked rows were not sent
 * on purpose (a preference, a compliance rule); removed recipients are addresses
 * the send gate took off a shared email, whose row still went to the others.
 */
export function formatCampaignStats(res: unknown): string {
  const stats = ((res ?? {}) as {stats?: CampaignStats}).stats
  if (!stats) return 'No statistics yet.'
  const lines: Array<[string, number | undefined]> = [
    ['Sent', stats.sent],
    ['Failed', stats.failed],
    ['Blocked', stats.blocked],
    ['Removed', stats.removedRecipients],
    ['Cancelled', stats.cancelled],
    ['In progress', stats.inProgress],
    ['Batches', stats.batches],
  ]
  const shown = lines.map(([label, value]) => `${`${label}:`.padEnd(14)}${value ?? 0}`)
  if (stats.successRate !== undefined) shown.push(`${'Success rate:'.padEnd(14)}${stats.successRate}%`)
  return shown.join('\n')
}

/** The `warnings` a template create or update answers with, as printable lines. */
export function templateWarnings(response: unknown): string[] {
  const warnings = (response as {warnings?: unknown} | null | undefined)?.warnings
  return Array.isArray(warnings) ? warnings.filter((w): w is string => typeof w === 'string' && w.length > 0) : []
}

/**
 * Print the save's warnings on stderr, so with --json stdout stays the one JSON
 * document (which carries `warnings` itself). A warning never stops the save.
 */
export function printTemplateWarnings(response: unknown, write: (text: string) => void = (t) => process.stderr.write(t)): void {
  const warnings = templateWarnings(response)
  if (warnings.length === 0) return
  write(`Warning: the template was saved, but:\n${warnings.map((w) => `  - ${w}`).join('\n')}\n`)
}
