/**
 * The trigger of a `--file` for `db trigger create` / `payments trigger save`.
 *
 * Accepts the bare trigger, the whole save request (`{"trigger": {...}}`) or
 * the read answer of `… trigger <id> --json` (`{"item": {...}}`). A read
 * answer names the action `thenAction`; the save request names it `action`,
 * so a file saved from a read is renamed here — without it the round trip
 * saved a trigger with no action.
 */
export function triggerFromFile(parsed: Record<string, unknown>): Record<string, unknown> {
  const inner = [parsed.trigger, parsed.item].find((v) => v && typeof v === 'object' && !Array.isArray(v))
  const trigger = {...((inner ?? parsed) as Record<string, unknown>)}

  if (trigger.action === undefined && trigger.thenAction !== undefined) {
    trigger.action = trigger.thenAction
  }

  delete trigger.thenAction
  return trigger
}
