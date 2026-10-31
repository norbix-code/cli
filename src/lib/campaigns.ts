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
