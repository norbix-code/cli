import type {Norbix} from '@norbix.ai/ts'

import {CliError, usageError} from './cli-error.js'
import {EXIT} from './exit-codes.js'

/**
 * The gateway addresses a taxonomy two ways (N10 of the Happy Tummy findings):
 *
 *   by id   (`txn_…`) — get one taxonomy, and every single-term route:
 *           create, show, update, delete a term (`/taxonomies/{TaxonomyId}/…`)
 *   by name (the title or its slug) — listing terms, their children and the
 *           trees (`/taxonomies/{TaxonomyName}/…`)
 *
 * The id is the canonical key — it never changes, a title can be renamed. The
 * CLI takes either in every term command and turns it into what the route
 * needs. Which is which is unambiguous: the gateway only accepts an id with
 * the `txn_` prefix (IdUtility.ParseIdToResult), and a name is never an id.
 */

/** True for a taxonomy id (`txn_5BBS25C3IKHRfzVABMjMiM`). */
export function isTaxonomyId(key: string): boolean {
  return /^txn_[A-Za-z0-9]+$/.test(key.trim())
}

type Hub = Pick<Norbix['hub'], 'database'>

interface TaxonomyRow {
  viewId: string
  taxonomyName?: string
  taxonomySlug?: string
}

/** Every taxonomy of the project (env), following the pages. */
async function listTaxonomies(hub: Hub): Promise<TaxonomyRow[]> {
  const rows: TaxonomyRow[] = []
  let after: string | undefined
  for (let page = 0; page < 50; page++) {
    const res = await hub.database.getDatabaseTaxonomies({pageSize: 100, startingAfter: after})
    const items = (res.list?.items ?? []) as TaxonomyRow[]
    rows.push(...items)
    if (!res.list?.hasMore || items.length === 0) break
    after = items.at(-1)?.viewId
  }

  return rows
}

/** The id of a taxonomy given by id or by name (title or slug, any case). */
export async function taxonomyIdOf(hub: Hub, key: string): Promise<string> {
  if (isTaxonomyId(key)) return key.trim()
  const wanted = key.trim().toLowerCase()
  const rows = await listTaxonomies(hub)
  const matches = rows.filter((t) => t.taxonomyName?.toLowerCase() === wanted || t.taxonomySlug?.toLowerCase() === wanted)
  if (matches.length === 1) return matches[0].viewId
  if (matches.length === 0) {
    throw new CliError({
      exit: EXIT.NOT_FOUND,
      code: 'TAXONOMY_NOT_FOUND',
      message: `No taxonomy named "${key}" in this project and environment.`,
      hint: `Pass the taxonomy id (txn_…) or its name; \`norbix db taxonomies\` lists them${rows.length ? `: ${rows.map((t) => t.taxonomySlug ?? t.taxonomyName).join(', ')}` : ' (there are none yet: norbix db taxonomy create <name>)'}.`,
      docs: 'norbix db taxonomies --help',
    })
  }

  throw usageError(
    `${matches.length} taxonomies are named "${key}".`,
    `Pass the id instead: ${matches.map((t) => `${t.viewId} (${t.taxonomyName ?? t.taxonomySlug})`).join(', ')}.`,
    'norbix db taxonomies --help',
  )
}

/** The name the name-keyed routes take, for a taxonomy given by id or by name. */
export async function taxonomyNameOf(hub: Hub, key: string): Promise<string> {
  if (!isTaxonomyId(key)) return key
  const res = await hub.database.getDatabaseTaxonomy({id: key.trim()})
  const name = res.item?.slug || res.item?.name
  if (!name) {
    throw new CliError({
      exit: EXIT.NOT_FOUND,
      code: 'TAXONOMY_NOT_FOUND',
      message: `Taxonomy ${key} was not found.`,
      hint: '`norbix db taxonomies` lists the taxonomies of this project and environment.',
      docs: 'norbix db taxonomies --help',
    })
  }

  return name
}

/** What a dry run shows instead of looking the key up (a dry run sends nothing). */
export function dryRunTaxonomyId(key: string): string {
  return isTaxonomyId(key) ? key.trim() : `<id of taxonomy "${key}">`
}

export function dryRunTaxonomyName(key: string): string {
  return isTaxonomyId(key) ? `<name of taxonomy ${key.trim()}>` : key
}

/** The argument description every term command uses. */
export const TAXONOMY_KEY_DESCRIPTION = 'Taxonomy id (txn_…) or name (title or slug, e.g. allergens)'
