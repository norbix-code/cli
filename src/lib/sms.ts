import {readFileSync} from 'node:fs'

import {Flags} from '@oclif/core'

import {readJsonInput} from './json.js'

// `readJsonObject` and `parseTokens` are shared with the push commands; they
// live in ./push.ts and are used here unchanged.
export {parseTokens, readJsonObject} from './push.js'

/** Flags shared by `sms template create` and `sms template update`. */
export interface SmsTemplateFlags {
  name: string
  description?: string
  channel: string
  tag?: string[]
  language: string
  subject?: string
  body?: string
  translations?: string
}

/**
 * Build the template body. Either --translations (a JSON array, @file or -)
 * for several languages, or --body (plus an optional --subject) for one.
 *
 * An SMS translation carries `subject` and `body`; the portal sends an empty
 * subject by default (it is the sender id, not a title), so --subject is
 * optional here and defaults to ''.
 */
export async function smsTemplateBody(flags: SmsTemplateFlags): Promise<Record<string, unknown>> {
  let translations: unknown
  if (flags.translations) {
    const raw = flags.translations.startsWith('@') ? readFileSync(flags.translations.slice(1), 'utf8') : flags.translations
    translations = JSON.parse(await readJsonInput(raw, 'translations')) as unknown
    if (!Array.isArray(translations)) throw new Error('--translations must be a JSON array')
  } else {
    if (!flags.body) {
      throw new Error('Pass --body, or --translations for several languages.')
    }

    translations = [{language: flags.language, content: {subject: flags.subject ?? '', body: flags.body}}]
  }

  return {
    templateName: flags.name,
    description: flags.description,
    communicationChannel: flags.channel,
    tags: flags.tag,
    translations,
  }
}

export const smsTemplateFlags = {
  name: Flags.string({required: true, description: 'Template name'}),
  description: Flags.string({description: 'What the template is for'}),
  channel: Flags.string({
    description: 'Communication channel',
    options: ['Transactional', 'Marketing', 'System'],
    default: 'Transactional',
  }),
  tag: Flags.string({description: 'Tag (repeat for several)', multiple: true}),
  language: Flags.string({description: 'Language of --body', default: 'en'}),
  subject: Flags.string({description: 'Sender id / subject line (Razor allowed; empty by default)'}),
  body: Flags.string({description: 'SMS text (Razor allowed)'}),
  translations: Flags.string({
    description: 'All languages as a JSON array of {language, content: {subject, body}} — inline, @file or -',
    exclusive: ['subject', 'body'],
  }),
}

/** --audience value → the `deliveryType` the server picks the settings block by. */
export const SMS_AUDIENCES: Record<string, {deliveryType: string; block: string}> = {
  'all-users': {deliveryType: 'AllUsers', block: 'allUsers'},
  users: {deliveryType: 'SpecifiedUsers', block: 'specifiedUsers'},
  collection: {deliveryType: 'Collection', block: 'collection'},
  'phone-numbers': {deliveryType: 'PhoneNumbers', block: 'phoneNumbers'},
}

/** --respect-time-zone value → the RespectTimeZoneSettings flag the server stores. */
export const TIME_ZONE_RULES: Record<string, number> = {
  'last-login': 1,
  registration: 2,
  'registration-project': 4,
}

export function toUnixSeconds(value: string): number {
  if (/^\d+$/.test(value)) return Number(value)
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) throw new Error(`--at is not a date: "${value}"`)
  return Math.floor(ms / 1000)
}
