import {Flags} from '@oclif/core'

/**
 * Shared bits of the membership commands (`users …`, `users contacts …`,
 * `membership settings …`): list flags, true/false flags and the profile
 * fields a login and a contact share.
 */

/** `--x a --x b,c` → `['a', 'b', 'c']`; no flag → undefined. */
export function listOf(values: string[] | undefined): string[] | undefined {
  const items = (values ?? []).flatMap((v) => v.split(',')).map((r) => r.trim()).filter((r) => r.length > 0)
  return items.length > 0 ? items : undefined
}

/** `'true'` / `'false'` from a `--flag true|false` option; undefined when not given. */
export function boolOf(value: string | undefined): boolean | undefined {
  return value === undefined ? undefined : value === 'true'
}

/** A `--flag true|false` option: unset means "keep what is there". */
export function boolFlag(description: string) {
  return Flags.string({description, options: ['true', 'false']})
}

/** The profile flags a login (`users register`, `users update`) and a contact (`users contacts create/update`) share. */
export const profileFlags = {
  name: Flags.string({description: 'Display name'}),
  'first-name': Flags.string({description: 'First name'}),
  'last-name': Flags.string({description: 'Last name'}),
  language: Flags.string({description: 'Language code, e.g. en or lt'}),
  'time-zone': Flags.string({description: 'Time zone, e.g. Europe/Vilnius'}),
  company: Flags.string({description: 'Company'}),
  country: Flags.string({description: 'Country'}),
  city: Flags.string({description: 'City'}),
  notes: Flags.string({description: 'Notes about the person'}),
}

export type ProfileFlagValues = {
  name?: string
  'first-name'?: string
  'last-name'?: string
  language?: string
  'time-zone'?: string
  company?: string
  country?: string
  city?: string
  notes?: string
}

/** The profile fields that were passed, under the gateway's names; empty object when none. */
export function profileOf(flags: ProfileFlagValues): Record<string, string> {
  const pairs: Array<[string, string | undefined]> = [
    ['displayName', flags.name],
    ['firstName', flags['first-name']],
    ['lastName', flags['last-name']],
    ['language', flags.language],
    ['timeZone', flags['time-zone']],
    ['company', flags.company],
    ['country', flags.country],
    ['city', flags.city],
    ['notes', flags.notes],
  ]
  return Object.fromEntries(pairs.filter((p): p is [string, string] => p[1] !== undefined))
}
