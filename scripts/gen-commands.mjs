// One-off generator for the repetitive list/get/action commands.
// Run: node scripts/gen-commands.mjs  — writes files under src/commands/.
import {mkdirSync, writeFileSync} from 'node:fs'
import {dirname} from 'node:path'

const list = (cls, desc, method, opts = {}) => `import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class ${cls} extends BaseCommand {
  static description = '${desc}'

  static examples = ['<%= config.bin %> ${opts.example}']

  static flags = {${opts.archivedFlag ? `
    archived: Flags.boolean({description: 'Include archived templates', default: false}),` : ''}${opts.paging ? `
    'page-size': Flags.integer({description: 'Records per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),` : ''}
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(${cls})
    const client = this.client(flags)

    const res = await ${method}({${opts.archivedFlag ? `
      showArchived: flags.archived,` : ''}${opts.paging ? `
      pageSize: flags['page-size'],
      startingAfter: flags.after,` : ''}
    })

    this.print(res)
    return res
  }
}
`

const getById = (cls, desc, method, opts = {}) => `import {Args${opts.statsFlag ? ', Flags' : ''}} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class ${cls} extends BaseCommand {
  static description = '${desc}'

  static examples = ['<%= config.bin %> ${opts.example}']

  static args = {
    id: Args.string({required: true, description: '${opts.argDesc ?? 'ID'}'}),
  }
${opts.statsFlag ? `
  static flags = {
    stats: Flags.boolean({description: 'Show delivery statistics instead of the campaign itself', default: false}),
  }
` : ''}
  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(${cls})
    const client = this.client(flags)
${opts.statsFlag ? `
    const res = flags.stats
      ? await ${opts.statsMethod}({id: args.id})
      : await ${method}({id: args.id})
` : `
    const res = await ${method}({id: args.id})
`}
    this.print(res)
    return res
  }
}
`

const action = (cls, desc, method, doneMsg, opts = {}) => `import {${opts.confirm ? "confirm} from '@inquirer/prompts'\nimport {" : ''}Args${opts.confirm ? ', Flags' : ''}} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class ${cls} extends BaseCommand {
  static description = '${desc}'

  static examples = ['<%= config.bin %> ${opts.example}']

  static args = {
    id: Args.string({required: true, description: '${opts.argDesc ?? 'ID'}'}),
  }
${opts.confirm ? `
  static flags = {
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt', default: false}),
  }
` : ''}
  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(${cls})
    const client = this.client(flags)
${opts.confirm ? `
    if (!flags.yes && process.stdout.isTTY) {
      const ok = await confirm({message: \`${opts.confirmMsg}\`, default: false})
      if (!ok) return this.print('Cancelled.')
    }
` : ''}
    const res = await ${method}({${opts.idField ?? 'id'}: args.id})
    this.print(\`${doneMsg}\`)
    return res
  }
}
`

const N = 'client.hub.notifications'
const files = {
  // ---------- email templates + campaigns ----------
  'src/commands/email/templates.ts': list('EmailTemplates', 'List email templates', `${N}.getEmailTemplates`, {example: 'email templates --archived', archivedFlag: true}),
  'src/commands/email/template.ts': getById('EmailTemplate', 'Show one email template', `${N}.getEmailTemplate`, {example: 'email template 66b2f0a1...', argDesc: 'Template ID'}),
  'src/commands/email/clone.ts': action('EmailClone', 'Clone an email template', `${N}.cloneEmailTemplate`, 'Template \${args.id} cloned.', {example: 'email clone 66b2f0a1...', argDesc: 'Template ID'}),
  'src/commands/email/archive.ts': action('EmailArchive', 'Archive an email template', `${N}.archiveEmailTemplate`, 'Template \${args.id} archived.', {example: 'email archive 66b2f0a1...', argDesc: 'Template ID'}),
  'src/commands/email/unarchive.ts': action('EmailUnarchive', 'Restore an archived email template', `${N}.unArchiveEmailTemplate`, 'Template \${args.id} restored.', {example: 'email unarchive 66b2f0a1...', argDesc: 'Template ID'}),
  'src/commands/email/delete.ts': action('EmailDelete', 'Delete an email template', `${N}.deleteEmailTemplate`, 'Template \${args.id} deleted.', {example: 'email delete 66b2f0a1... --yes', argDesc: 'Template ID', confirm: true, confirmMsg: 'Delete email template \${args.id}?'}),
  'src/commands/email/campaigns.ts': list('EmailCampaigns', 'List email campaigns', `${N}.getEmailCampaigns`, {example: 'email campaigns', paging: true}),
  'src/commands/email/campaign.ts': getById('EmailCampaign', 'Show one email campaign (or its statistics with --stats)', `${N}.getEmailCampaign`, {example: 'email campaign 66b2f0a1... --stats', argDesc: 'Campaign ID', statsFlag: true, statsMethod: `${N}.getEmailCampaignStatistics`}),
  // ---------- push templates + campaigns ----------
  'src/commands/push/templates.ts': list('PushTemplates', 'List push notification templates', `${N}.getPushTemplates`, {example: 'push templates --archived', archivedFlag: true}),
  'src/commands/push/template.ts': getById('PushTemplate', 'Show one push template', `${N}.getPushTemplate`, {example: 'push template 66b2f0a1...', argDesc: 'Template ID'}),
  'src/commands/push/clone.ts': action('PushClone', 'Clone a push template', `${N}.clonePushTemplate`, 'Template \${args.id} cloned.', {example: 'push clone 66b2f0a1...', argDesc: 'Template ID'}),
  'src/commands/push/archive.ts': action('PushArchive', 'Archive a push template', `${N}.archivePushTemplate`, 'Template \${args.id} archived.', {example: 'push archive 66b2f0a1...', argDesc: 'Template ID'}),
  'src/commands/push/unarchive.ts': action('PushUnarchive', 'Restore an archived push template', `${N}.unArchivePushTemplate`, 'Template \${args.id} restored.', {example: 'push unarchive 66b2f0a1...', argDesc: 'Template ID'}),
  'src/commands/push/delete.ts': action('PushDelete', 'Delete a push template', `${N}.deletePushTemplate`, 'Template \${args.id} deleted.', {example: 'push delete 66b2f0a1... --yes', argDesc: 'Template ID', confirm: true, confirmMsg: 'Delete push template \${args.id}?'}),
  'src/commands/push/campaigns.ts': list('PushCampaigns', 'List push campaigns', `${N}.getPushCampaigns`, {example: 'push campaigns', paging: true}),
  'src/commands/push/campaign.ts': getById('PushCampaign', 'Show one push campaign (or its statistics with --stats)', `${N}.getPushCampaign`, {example: 'push campaign 66b2f0a1... --stats', argDesc: 'Campaign ID', statsFlag: true, statsMethod: `${N}.getPushCampaignStatistics`}),
  // stop-campaign commands are hand-written (src/commands/*/stop.ts): the
  // published SDK may not have stop* methods yet, so they guard at runtime.
  // ---------- sms templates + campaigns ----------
  'src/commands/sms/templates.ts': list('SmsTemplates', 'List SMS templates', `${N}.getSmsTemplates`, {example: 'sms templates --archived', archivedFlag: true}),
  'src/commands/sms/template.ts': getById('SmsTemplate', 'Show one SMS template', `${N}.getSmsTemplate`, {example: 'sms template 66b2f0a1...', argDesc: 'Template ID'}),
  'src/commands/sms/clone.ts': action('SmsClone', 'Clone an SMS template', `${N}.cloneSmsTemplate`, 'Template \${args.id} cloned.', {example: 'sms clone 66b2f0a1...', argDesc: 'Template ID'}),
  'src/commands/sms/archive.ts': action('SmsArchive', 'Archive an SMS template', `${N}.archiveSmsTemplate`, 'Template \${args.id} archived.', {example: 'sms archive 66b2f0a1...', argDesc: 'Template ID'}),
  'src/commands/sms/unarchive.ts': action('SmsUnarchive', 'Restore an archived SMS template', `${N}.unArchiveSmsTemplate`, 'Template \${args.id} restored.', {example: 'sms unarchive 66b2f0a1...', argDesc: 'Template ID'}),
  'src/commands/sms/delete.ts': action('SmsDelete', 'Delete an SMS template', `${N}.deleteSmsTemplate`, 'Template \${args.id} deleted.', {example: 'sms delete 66b2f0a1... --yes', argDesc: 'Template ID', confirm: true, confirmMsg: 'Delete SMS template \${args.id}?'}),
  'src/commands/sms/campaigns.ts': list('SmsCampaigns', 'List SMS campaigns', `${N}.getSmsCampaigns`, {example: 'sms campaigns', paging: true}),
  'src/commands/sms/campaign.ts': getById('SmsCampaign', 'Show one SMS campaign (or its statistics with --stats)', `${N}.getSmsCampaign`, {example: 'sms campaign 66b2f0a1... --stats', argDesc: 'Campaign ID', statsFlag: true, statsMethod: `${N}.getSmsCampaignStatistics`}),
  // ---------- db admin: schemas, taxonomies, aggregates ----------
  'src/commands/db/schemas.ts': list('DbSchemas', 'List database schemas (collections definitions)', 'client.hub.database.getDatabaseSchemas', {example: 'db schemas', paging: true}),
  'src/commands/db/schema.ts': getById('DbSchema', 'Show one database schema', 'client.hub.database.getDatabaseSchema', {example: 'db schema 66b2f0a1...', argDesc: 'Schema ID'}),
  'src/commands/db/taxonomies.ts': list('DbTaxonomies', 'List database taxonomies', 'client.hub.database.getDatabaseTaxonomies', {example: 'db taxonomies', paging: true}),
  'src/commands/db/taxonomy.ts': getById('DbTaxonomy', 'Show one database taxonomy', 'client.hub.database.getDatabaseTaxonomy', {example: 'db taxonomy 66b2f0a1...', argDesc: 'Taxonomy ID'}),
  // ---------- logs settings ----------
  'src/commands/logs/settings.ts': list('LogsSettings', 'Show project log settings', 'client.hub.logs.getLogSettings', {example: 'logs settings'}),
  // ---------- membership roles + policies ----------
  'src/commands/users/roles.ts': list('UsersRoles', 'List membership roles', 'client.hub.membership.getRoles', {example: 'users roles'}),
  'src/commands/users/policies.ts': list('UsersPolicies', 'List membership policies', 'client.hub.membership.getPolicies', {example: 'users policies'}),
  // ---------- account ----------
  'src/commands/account/profile.ts': list('AccountProfile', 'Show the account profile', 'client.hub.account.getAccountProfile', {example: 'account profile'}),
  'src/commands/account/status.ts': list('AccountStatus', 'Show the account status (plan, verification, limits)', 'client.hub.account.getAccountStatus', {example: 'account status'}),
  'src/commands/account/usage.ts': list('AccountUsage', 'Show usage-based billing for the account', 'client.hub.account.getAccountUsageBilling', {example: 'account usage'}),
  'src/commands/account/projects.ts': list('AccountProjects', 'List all projects in the account', 'client.hub.account.getProjects', {example: 'account projects'}),
  'src/commands/account/team.ts': list('AccountTeam', 'List account collaborators (team members)', 'client.hub.account.getAccountCollaborators', {example: 'account team'}),
  'src/commands/account/regions.ts': list('AccountRegions', 'List regions available to the account', 'client.hub.account.getAccountRegions', {example: 'account regions'}),
  // ---------- payments ----------
  'src/commands/payments/integrations.ts': list('PaymentsIntegrations', 'List payment integrations', 'client.hub.payments.getPaymentsIntegrations', {example: 'payments integrations'}),
  'src/commands/payments/triggers.ts': list('PaymentsTriggers', 'List payment triggers', 'client.hub.payments.getPaymentsTriggers', {example: 'payments triggers'}),
  'src/commands/payments/trigger.ts': getById('PaymentsTrigger', 'Show one payment trigger', 'client.hub.payments.getPaymentsTrigger', {example: 'payments trigger 66b2f0a1...', argDesc: 'Trigger ID'}),
  'src/commands/payments/enable.ts': action('PaymentsEnable', 'Enable a payment trigger', 'client.hub.payments.enablePaymentsTrigger', 'Trigger \${args.id} enabled.', {example: 'payments enable 66b2f0a1...', argDesc: 'Trigger ID', idField: 'triggerId'}),
  'src/commands/payments/disable.ts': action('PaymentsDisable', 'Disable a payment trigger', 'client.hub.payments.disablePaymentsTrigger', 'Trigger \${args.id} disabled.', {example: 'payments disable 66b2f0a1...', argDesc: 'Trigger ID', idField: 'triggerId'}),
}

for (const [path, content] of Object.entries(files)) {
  mkdirSync(dirname(path), {recursive: true})
  writeFileSync(path, content)
  console.log('wrote', path)
}
