/**
 * Saved secrets of an integration (gateway docs/tasks/secret-fields.md): which
 * secrets are saved and which may be removed. The gateway never sends a value.
 */

/** One row of GET /integrations/{id}/secrets, as the CLI reads it. */
export interface IntegrationSecretRow {
  key?: string
  field?: string
  isSet?: boolean
  isOptional?: boolean
}

const yesNo = (v: boolean | undefined) => (v ? 'yes' : 'no')

/** The rows for the terminal: KEY, SET, OPTIONAL — or one plain sentence when there are none. */
export function formatIntegrationSecrets(res: unknown): string {
  const rows = ((res ?? {}) as {result?: IntegrationSecretRow[]}).result ?? []
  if (rows.length === 0) {
    return 'This integration has no saved secrets to show (keyless, Norbix-owned, MCP, Marketplace and Webhook integrations have none here).'
  }

  const header = ['KEY', 'SET', 'OPTIONAL']
  const cells = rows.map((r) => [r.key ?? '-', yesNo(r.isSet), yesNo(r.isOptional)])
  const widths = header.map((h, i) => Math.max(h.length, ...cells.map((c) => c[i].length)))
  const line = (c: string[]) => c.map((v, i) => v.padEnd(widths[i])).join('  ').trimEnd()
  return [line(header), ...cells.map(line)].join('\n')
}
