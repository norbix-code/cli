import {readFileSync} from 'node:fs'

import {Flags} from '@oclif/core'

import {readJsonInput} from './json.js'

/**
 * Read a JSON object from a flag: inline JSON, `-` for stdin, or `@path` for a
 * file. Used by the push commands whose body is too rich for flags alone
 * (template translations, provider credentials, campaign audiences).
 */
export async function readJsonObject(value: string, flagName: string): Promise<Record<string, unknown>> {
  const raw = value.startsWith('@') ? readFileSync(value.slice(1), 'utf8') : value
  const parsed = JSON.parse(await readJsonInput(raw, flagName)) as unknown
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`--${flagName} must be a JSON object`)
  }

  return parsed as Record<string, unknown>
}

export interface TokenMapping {
  key: string
  value: string
  resolver: string
}

/** Turn repeated `--token key=value` flags into token mappings with the Custom resolver. */
export function parseTokens(values: string[] | undefined): TokenMapping[] | undefined {
  if (!values?.length) return undefined
  return values.map((pair) => {
    const at = pair.indexOf('=')
    if (at < 1) throw new Error(`--token must look like key=value, got "${pair}"`)
    return {key: pair.slice(0, at), value: pair.slice(at + 1), resolver: 'Custom'}
  })
}

/** Flags shared by `push template create` and `push template update`. */
export interface TemplateFlags {
  name: string
  description?: string
  channel: string
  tag?: string[]
  language: string
  title?: string
  body?: string
  translations?: string
}

/**
 * Build the template body. Either --translations (a JSON array, @file or -)
 * for several languages, or --title + --body for one language.
 */
export async function templateBody(flags: TemplateFlags): Promise<Record<string, unknown>> {
  let translations: unknown
  if (flags.translations) {
    const raw = flags.translations.startsWith('@') ? readFileSync(flags.translations.slice(1), 'utf8') : flags.translations
    translations = JSON.parse(await readJsonInput(raw, 'translations')) as unknown
    if (!Array.isArray(translations)) throw new Error('--translations must be a JSON array')
  } else {
    if (!flags.title || !flags.body) {
      throw new Error('Pass --title and --body, or --translations for several languages.')
    }

    translations = [{language: flags.language, content: {title: flags.title, body: flags.body}}]
  }

  return {
    templateName: flags.name,
    description: flags.description,
    communicationChannel: flags.channel,
    tags: flags.tag,
    translations,
  }
}

export const templateFlags = {
  name: Flags.string({required: true, description: 'Template name'}),
  description: Flags.string({description: 'What the template is for'}),
  channel: Flags.string({
    description: 'Communication channel',
    options: ['Transactional', 'Marketing', 'System'],
    default: 'Transactional',
  }),
  tag: Flags.string({description: 'Tag (repeat for several)', multiple: true}),
  language: Flags.string({description: 'Language of --title / --body', default: 'en'}),
  title: Flags.string({description: 'Push title (Razor allowed)'}),
  body: Flags.string({description: 'Push body (Razor allowed)'}),
  translations: Flags.string({
    description: 'All languages as a JSON array of {language, content: {title, body}} — inline, @file or -',
    exclusive: ['title', 'body'],
  }),
}

/** `--audience` value → the `source` discriminator the server routes the campaign body by. */
export const AUDIENCES: Record<string, string> = {
  'all-users': 'allUsers',
  users: 'specifiedUsers',
  'account-users': 'accountUsers',
  collection: 'collection',
  devices: 'devices',
}

/** Flags that describe who a push campaign goes to; shared by `campaign create` and `campaign audience-count`. */
export const audienceFlags = {
  audience: Flags.string({required: true, description: 'Who receives it', options: Object.keys(AUDIENCES)}),
  user: Flags.string({description: 'User ID (users / account-users; repeat for several)', multiple: true}),
  role: Flags.string({description: 'Role name (all-users / collection; repeat for several)', multiple: true}),
  tag: Flags.string({description: 'User tag (all-users; repeat for several)', multiple: true}),
  schema: Flags.string({description: 'Collection name (collection)'}),
  field: Flags.string({description: 'Field that holds the recipient (collection; repeat for several)', multiple: true}),
  'field-type': Flags.string({description: 'What --field holds (collection)', options: ['User', 'Email']}),
  device: Flags.string({description: 'Device as <token>:<family> (devices; repeat for several)', multiple: true}),
}

export interface AudienceFlags {
  audience: string
  user?: string[]
  role?: string[]
  tag?: string[]
  schema?: string
  field?: string[]
  'field-type'?: string
  device?: string[]
}

/**
 * The audience part of a campaign body: `source` plus that audience's own
 * fields, as the server reads them (note `rolesNames` on allUsers but
 * `roleNames` on collection). Throws when a required flag is missing, so
 * nothing is sent.
 */
export function audienceFields(flags: AudienceFlags): Record<string, unknown> {
  const source = AUDIENCES[flags.audience]
  switch (flags.audience) {
    case 'all-users':
      return {source, rolesNames: flags.role, userTags: flags.tag}
    case 'users':
    case 'account-users':
      if (!flags.user?.length) throw new Error(`--audience ${flags.audience} needs at least one --user`)
      return {source, userRecipients: flags.user}
    case 'collection':
      if (!flags.schema || !flags.field?.length) throw new Error('--audience collection needs --schema and --field')
      return {source, schemaName: flags.schema, fields: flags.field, fieldType: flags['field-type'], roleNames: flags.role}
    default:
      if (!flags.device?.length) throw new Error('--audience devices needs at least one --device <token>:<family>')
      return {source, devices: flags.device.map(parseDevice)}
  }
}

/** `<token>:<family>` → the device object a `devices` audience lists. */
export function parseDevice(value: string): {token: string; deliveryFamily: string} {
  const at = value.lastIndexOf(':')
  if (at < 1) throw new Error(`--device must look like <token>:<family>, got "${value}"`)
  return {token: value.slice(0, at), deliveryFamily: value.slice(at + 1)}
}
