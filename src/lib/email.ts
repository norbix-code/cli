import {readFileSync} from 'node:fs'

import {Flags} from '@oclif/core'

import {readJsonInput} from './json.js'

// Shared with the push and SMS commands, used here unchanged.
export {parseTokens, readJsonObject} from './push.js'
export {toUnixSeconds} from './sms.js'

/** Read a JSON array from a flag: inline JSON, `-` for stdin, or `@path` for a file. */
export async function readJsonArray(value: string, flagName: string): Promise<unknown[]> {
  const raw = value.startsWith('@') ? readFileSync(value.slice(1), 'utf8') : value
  const parsed = JSON.parse(await readJsonInput(raw, flagName)) as unknown
  if (!Array.isArray(parsed)) throw new Error(`--${flagName} must be a JSON array`)
  return parsed
}

/**
 * Take a text from `--<name>` or `--<name>-file`. Razor code starts with `@`
 * (`@Model.Name`), so a body can not use the `@file` shorthand — the file has
 * its own flag.
 */
export function textOrFile(text: string | undefined, file: string | undefined): string | undefined {
  if (file) return readFileSync(file, 'utf8')
  return text
}

/** The template engines the gateway stores on an email body. */
export const EMAIL_ENGINES = ['Mjml', 'Razor', 'Handlebars', 'Liquid', 'Mustache']

/** Flags shared by `email template create` and `email template update`. */
export interface EmailTemplateFlags {
  name: string
  description?: string
  channel: string
  tag?: string[]
  language: string
  subject?: string
  body?: string
  'body-file'?: string
  engine: string
  translations?: string
}

/**
 * Build the template body. Either --translations (a JSON array, @file or -)
 * for several languages, or --subject + --body / --body-file for one.
 *
 * An email translation is `{language, content: {subject, body: {code,
 * templateEngine}}}` — the body is MJML (with Razor tokens) by default, the
 * same as the portal's code editor.
 */
export async function emailTemplateBody(flags: EmailTemplateFlags): Promise<Record<string, unknown>> {
  let translations: unknown
  if (flags.translations) {
    translations = await readJsonArray(flags.translations, 'translations')
  } else {
    const code = textOrFile(flags.body, flags['body-file'])
    if (!flags.subject || !code) {
      throw new Error('Pass --subject and --body (or --body-file), or --translations for several languages.')
    }

    translations = [
      {language: flags.language, content: {subject: flags.subject, body: {code, templateEngine: flags.engine}}},
    ]
  }

  return {
    templateName: flags.name,
    description: flags.description,
    communicationChannel: flags.channel,
    tags: flags.tag,
    translations,
  }
}

export const emailTemplateFlags = {
  name: Flags.string({required: true, description: 'Template name'}),
  description: Flags.string({description: 'What the template is for'}),
  channel: Flags.string({
    description: 'Communication channel',
    options: ['Transactional', 'Marketing', 'System'],
    default: 'Transactional',
  }),
  tag: Flags.string({description: 'Tag (repeat for several)', multiple: true}),
  language: Flags.string({description: 'Language of --subject / --body', default: 'en'}),
  subject: Flags.string({description: 'Subject line (Razor allowed)'}),
  body: Flags.string({description: 'Body code — MJML with Razor tokens by default', exclusive: ['body-file']}),
  'body-file': Flags.string({description: 'Read the body code from this file (e.g. welcome.mjml)'}),
  engine: Flags.string({description: 'Template engine of the body', options: EMAIL_ENGINES, default: 'Mjml'}),
  translations: Flags.string({
    description:
      'All languages as a JSON array of {language, content: {subject, body: {code, templateEngine}}} — inline, @file or -',
    exclusive: ['subject', 'body', 'body-file'],
  }),
}

/** Flags shared by `email footer save` and `email signature save`. */
export interface SnippetFlags {
  name: string
  id?: string
  language: string
  content?: string
  'content-file'?: string
  translations?: string
}

/**
 * Build a footer / signature body: `{viewId?, displayName, translations:
 * [{language, content}]}` — the content is the HTML (Razor allowed) for one
 * language.
 */
export async function snippetBody(flags: SnippetFlags): Promise<Record<string, unknown>> {
  let translations: unknown
  if (flags.translations) {
    translations = await readJsonArray(flags.translations, 'translations')
  } else {
    const content = textOrFile(flags.content, flags['content-file'])
    if (!content) throw new Error('Pass --content (or --content-file), or --translations for several languages.')
    translations = [{language: flags.language, content}]
  }

  return {viewId: flags.id, displayName: flags.name, translations}
}

export function snippetFlags(what: string) {
  return {
    name: Flags.string({required: true, description: `${what} name`}),
    id: Flags.string({description: `${what} ID — set it to update instead of create`}),
    language: Flags.string({description: 'Language of --content', default: 'en'}),
    content: Flags.string({description: 'HTML content (Razor allowed)', exclusive: ['content-file']}),
    'content-file': Flags.string({description: 'Read the HTML content from this file'}),
    translations: Flags.string({
      description: 'All languages as a JSON array of {language, content} — inline, @file or -',
      exclusive: ['content', 'content-file'],
    }),
  }
}

/** --audience value → the `source` discriminator the server routes the campaign by. */
export const EMAIL_AUDIENCES: Record<string, string> = {
  'all-users': 'AllUsers',
  users: 'SpecifiedUsers',
  'account-users': 'AccountUsers',
  emails: 'Email',
  collection: 'Collection',
}

/** What `--audience` means — shared by `email campaign create` and `scheduler save`. */
export const EMAIL_AUDIENCE_HELP = `--audience picks who receives it:
  all-users      every user with an e-mail; narrow with --role / --tag
  users          the users named with --user (copies with --cc / --bcc user IDs)
  account-users  the account users named with --user
  emails         raw addresses, --email (copies with --cc / --bcc addresses)
  collection     the recipients in --field of the --schema collection`

/** The audience flags of an email campaign, in the order `email campaign create` shows them. */
export const emailAudienceFlags = {
  audience: Flags.string({required: true, description: 'Who receives it', options: Object.keys(EMAIL_AUDIENCES)}),
  user: Flags.string({description: 'User ID (users / account-users; repeat for several)', multiple: true}),
  email: Flags.string({description: 'E-mail address (emails; repeat for several)', multiple: true}),
  cc: Flags.string({description: 'Copy to — a user ID (users / account-users) or address (emails); repeat', multiple: true}),
  bcc: Flags.string({description: 'Blind copy — a user ID or address, like --cc; repeat', multiple: true}),
  'one-each': Flags.boolean({
    description: 'Send every recipient a separate e-mail instead of one e-mail to all (users / account-users / emails)',
    default: false,
  }),
  role: Flags.string({description: 'Role name (all-users / collection; repeat for several)', multiple: true}),
  tag: Flags.string({description: 'User tag (all-users; repeat for several)', multiple: true}),
  schema: Flags.string({description: 'Collection name (collection)'}),
  field: Flags.string({description: 'Field that holds the recipient (collection; repeat for several)', multiple: true}),
  'field-type': Flags.string({description: 'What --field holds (collection)', options: ['User', 'Email'], default: 'User'}),
}

export interface EmailAudienceFlags {
  audience: string
  user?: string[]
  email?: string[]
  cc?: string[]
  bcc?: string[]
  'one-each': boolean
  role?: string[]
  tag?: string[]
  schema?: string
  field?: string[]
  'field-type': string
}

/**
 * The audience part of an email campaign request: `source` (the discriminator
 * the server picks the campaign subclass by) and the fields of that subclass.
 * `fail` reports a missing flag (the command's `this.error`).
 */
export function emailAudienceFields(flags: EmailAudienceFlags, fail: (message: string) => never): Record<string, unknown> {
  const source = {source: EMAIL_AUDIENCES[flags.audience]}
  switch (flags.audience) {
    case 'all-users': {
      return {...source, rolesNames: flags.role, userTags: flags.tag}
    }

    case 'users':
    case 'account-users': {
      if (!flags.user?.length) fail(`--audience ${flags.audience} needs at least one --user`)
      return {
        ...source,
        userRecipients: flags.user,
        userCc: flags.cc,
        userBcc: flags.bcc,
        singleEmailStrategy: flags['one-each'],
      }
    }

    case 'emails': {
      if (!flags.email?.length) fail('--audience emails needs at least one --email')
      return {
        ...source,
        recipients: flags.email,
        recipientsCc: flags.cc,
        recipientsBcc: flags.bcc,
        singleEmailStrategy: flags['one-each'],
      }
    }

    default: {
      if (!flags.schema || !flags.field?.length) fail('--audience collection needs --schema and --field')
      return {
        ...source,
        schemaName: flags.schema,
        fields: flags.field,
        fieldType: flags['field-type'],
        roleNames: flags.role,
      }
    }
  }
}
