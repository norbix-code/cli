/**
 * The CLI uses no colour library. This check exists so that stays true in
 * the places that could colour (oclif's own help / error theme): no ANSI
 * codes with --json, NO_COLOR, or when stdout is not a terminal.
 */
export function colorEnabled(argv: string[] = process.argv.slice(2)): boolean {
  if (argv.includes('--json')) return false
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '') return false
  if (process.env.FORCE_COLOR === '0') return false
  return Boolean(process.stdout.isTTY)
}

/** Tell oclif (and anything else that honours the convention) to stay plain. */
export function disableColorIfNeeded(argv?: string[]): void {
  if (!colorEnabled(argv)) {
    process.env.FORCE_COLOR = '0'
    process.env.NO_COLOR ??= '1'
  }
}
