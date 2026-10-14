/**
 * The schema design rules a coding agent needs before it writes a Norbix
 * data schema by hand — the short form of the gateway's
 * SCHEMA-DESIGN-RULES.md (§2, §4, §6, §7b, §9) and of the Hub's
 * database-manager rule 6 (the exact field shapes). The Hub serves no
 * endpoint for that file, so the text is bundled here; keep it in step
 * with gateway/src/Isidos.CodeMash.Services.Api/SeedService/Database/SchemaTemplates/SCHEMA-DESIGN-RULES.md.
 *
 * The Hub also checks these rules on save: `db schema create` and
 * `hub database schema save` print its `warnings` (see printSchemaWarnings).
 *
 * No oclif import.
 */

export interface SchemaRule {
  /** What the field holds, in plain words. */
  when: string
  /** The field to use. */
  use: string
  /** The exact dataSchema shape (JSON) of that field. */
  shape: string
}

export const SCHEMA_RULES: SchemaRule[] = [
  {when: 'email address', use: 'string with format email — never bare text', shape: '{"type":"string","format":"email"}'},
  {
    when: 'link, URL, website, homepage, app link, domain',
    use: 'string with format uri — never bare text',
    shape: '{"type":"string","format":"uri"}',
  },
  {when: 'phone number', use: 'string with a pattern', shape: '{"type":"string","pattern":"^\\\\+?[0-9 ()\\\\-]{6,20}$"}'},
  {
    when: 'language / locale, currency code, country, status, stage, category, priority — any list people pick from',
    use: 'taxonomy picker (create the taxonomy and its terms first) — never bare text, never an inline enum',
    shape: '{"source":"taxonomy","taxonomyId":"<taxonomy id>","multiple":false}',
  },
  {
    when: 'a developer-facing flag that app code branches on (never shown as a list in the UI)',
    use: 'inline enum — the only place for it',
    shape: '{"source":"enum","values":["a","b"],"multiple":false}',
  },
  {
    when: 'a person who signs in: assignee, author, reviewer, *_user_id',
    use: 'user reference — never a text id',
    shape: '{"source":"user","displayField":"displayName","multiple":false}',
  },
  {
    when: 'a link to a record of another collection',
    use: 'collection reference',
    shape: '{"source":"collection","collectionId":"<schema id>","displayField":"<field>","multiple":false}',
  },
  {
    when: 'money amount',
    use: 'currency field (amount + currency together) — never a string or a bare number',
    shape: '{"type":"object","properties":{"value":{},"currency":{"enum":["USD","EUR"]}}}',
  },
  {
    when: 'date or time',
    use: 'unix-epoch integer; the minimum marks it as a date — never a string',
    shape: '{"type":"integer","minimum":16777216}',
  },
  {when: 'free labels the user invents', use: 'tags', shape: '{"type":"array","uniqueItems":true,"items":{"type":"string"}}'},
  {when: 'file or image', use: 'file', shape: '{"type":"array","items":{"type":"string","format":"uuid"}}'},
]

export const SCHEMA_NEVER: string[] = [
  'Never add system fields: createdAt / updatedAt, createdBy / updatedBy, owner, isDeleted. The platform keeps them in _meta; turn on settings.hasRecordOwner / settings.softDelete instead. A business link to a person (assignee) is a user reference.',
  'Free text for a language, currency or country only when the value is deliberately not tied to any list (say so in the field description).',
  'No nested objects except currency and geolocation: flatten (address_street, address_city) or reference another collection.',
  'Never set additionalProperties at the root.',
  'Mark user-facing text translatable when the project has more than one language; never codes, emails, URLs, phones or ids.',
]

/** The rules as text, for `norbix db schema rules` and the help pages. */
export function schemaRulesText(): string {
  const width = Math.max(...SCHEMA_RULES.map((r) => r.when.length))
  const rows = SCHEMA_RULES.map((r) => `- ${r.when.padEnd(Math.min(width, 48))}  → ${r.use}\n    ${r.shape}`)
  return [
    'Norbix schema design rules — read before writing a data schema.',
    'A data schema is {"type":"object","properties":{"<field>":<shape>},"required":["<field>"]}.',
    '',
    'Which field for which value:',
    ...rows,
    '',
    'Never:',
    ...SCHEMA_NEVER.map((n) => `- ${n}`),
    '',
    'The Hub checks the email / link / language / currency / country / user-id rules on save and answers',
    'with "warnings" (the save still succeeds): fix each named field and save again.',
    'Full rules: SCHEMA-DESIGN-RULES.md in the Norbix schema catalog.',
  ].join('\n')
}

/** One line for help pages and agent files that points at the rules command. */
export const SCHEMA_RULES_POINTER =
  'Before you write a data schema, run `norbix db schema rules`: emails and links need a format, language / currency / country are taxonomy pickers, user ids are user references.'

/** The `warnings` the Hub sends back with a saved schema, if any. */
export function schemaWarnings(response: unknown): string[] {
  if (response === null || typeof response !== 'object') return []
  const warnings = (response as {warnings?: unknown}).warnings
  if (!Array.isArray(warnings)) return []
  return warnings
    .map((w) => {
      if (typeof w === 'string') return w
      if (!w || typeof w !== 'object' || !('message' in w)) return ''
      const {where, message} = w as {where?: unknown; message: unknown}
      return `${typeof where === 'string' && where ? `${where}: ` : ''}${String(message)}`
    })
    .filter((w) => w.length > 0)
}

/**
 * Print the Hub's schema design warnings on stderr, so with --json stdout
 * stays the one JSON document (which carries `warnings` itself).
 */
export function printSchemaWarnings(response: unknown, write: (text: string) => void = (t) => process.stderr.write(t)): void {
  const warnings = schemaWarnings(response)
  if (warnings.length === 0) return
  const n = `${warnings.length} field${warnings.length === 1 ? '' : 's'} break${warnings.length === 1 ? 's' : ''} a design rule`
  // validate_schema answers with `valid`; a save answers with the schema `id`.
  const checkOnly = response !== null && typeof response === 'object' && 'valid' in response
  write(
    `Warning: ${checkOnly ? 'the schema check says' : 'the schema was saved, but'} ${n}:\n` +
      warnings.map((w) => `  - ${w}`).join('\n') +
      `\nFix ${warnings.length === 1 ? 'it' : 'them'}${checkOnly ? '' : ' and save again'}. Rules: norbix db schema rules\n`,
  )
}
