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
