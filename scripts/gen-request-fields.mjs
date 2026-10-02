#!/usr/bin/env node
/**
 * Generates src/generated/request-fields.json from the installed
 * `@norbix.ai/ts`: for every SDK method of `api.*` and `hub.*`, the HTTP
 * method, the path, the request DTO and its fields (name, type, required).
 *
 * `norbix hub <module> --help` lists the fields from it, and the plain-word
 * parser uses it to type values (a string field stays "0042", a boolean flag
 * does not swallow the next word). Run `npm run gen:fields` after bumping the
 * SDK and commit the result.
 *
 * Sources (no runtime cost — pure text parsing at build time):
 *   dist/index.js          method → {target, path, method, dto}  (JSDoc + send call)
 *   dist/types/*.dtos.d.ts dto    → fields                       (class bodies)
 */
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs'
import {createRequire} from 'node:module'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const require = createRequire(import.meta.url)
const root = dirname(dirname(fileURLToPath(import.meta.url)))
// The package exports map hides package.json; resolve the entry point and walk up.
const sdkDir = dirname(dirname(require.resolve('@norbix.ai/ts')))
const sdkVersion = JSON.parse(readFileSync(join(sdkDir, 'package.json'), 'utf8')).version
const indexJs = readFileSync(join(sdkDir, 'dist/index.js'), 'utf8')

// ---- 1. module classes → methods -------------------------------------------

/** `var FooModule = class {` … up to the next top-level `var X = class`. */
function classBlocks(source) {
  const blocks = new Map()
  const re = /^var (\w+) = class \{$/gm
  const starts = []
  let m
  while ((m = re.exec(source))) starts.push({name: m[1], at: m.index})
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1].at : source.length
    blocks.set(starts[i].name, source.slice(starts[i].at, end))
  }

  return blocks
}

const METHOD_RE =
  /\/\*\*\s*\n\s*\* (GET|POST|PUT|PATCH|DELETE) (\S+)\s*\n\s*\* Request DTO: (\w+)\s*\n\s*\*\/\s*\n\s*(\w+) = \(request = \{\}, options = \{\}\) => \{\s*\n\s*return this\.transport\.send\(\{\s*\n\s*target: "(api|hub)",/g

function methodsOf(block) {
  const out = {}
  let m
  while ((m = METHOD_RE.exec(block))) {
    const [, http, path, dto, name, target] = m
    out[name] = {http, path, dto, target}
  }

  return out
}

/** `this.membership = new MembershipModule(transport)` inside a namespace class. */
function modulesOf(block) {
  const out = {}
  const re = /this\.(\w+) = new (\w+)\(transport\)/g
  let m
  while ((m = re.exec(block))) out[m[1]] = m[2]
  return out
}

const blocks = classBlocks(indexJs)
const namespaces = {api: modulesOf(blocks.get('ApiNamespace')), hub: modulesOf(blocks.get('HubNamespace'))}

// ---- 2. DTO declarations → fields -------------------------------------------

function parseDts(file) {
  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n')
  const classes = new Map()
  const enums = new Map()
  for (let i = 0; i < lines.length; i++) {
    const cls = lines[i].match(/^\s+class (\w+)(?: extends (\w+))?/)
    if (cls) {
      const fields = []
      for (let j = i + 1; j < lines.length; j++) {
        const line = lines[j]
        if (/^\s+constructor\(|^\s+\}/.test(line)) break
        const f = line.match(/^\s+(\w+)(\?)?: ([^;]+);$/)
        if (f) fields.push({name: f[1], type: f[3].trim(), required: f[2] === undefined})
      }

      classes.set(cls[1], {extends: cls[2], fields})
      continue
    }

    const en = lines[i].match(/^\s+enum (\w+)/)
    if (en) {
      const values = []
      for (let j = i + 1; j < lines.length && !/^\s+\}/.test(lines[j]); j++) {
        const v = lines[j].match(/=\s*"([^"]*)"/)
        if (v) values.push(v[1])
      }

      enums.set(en[1], values)
    }
  }

  return {classes, enums}
}

/** Request base classes carry headers / path tokens the CLI fills itself. */
const HIDDEN_FIELDS = new Set(['cultureCode', 'timeZoneId', 'version', 'correlationId', 'projectId', 'env', 'resolvedEnv'])

function kindOf(type, enums, classes) {
  const array = type.endsWith('[]')
  const base = array ? type.slice(0, -2) : type
  let kind
  let options
  if (base === 'string') kind = 'string'
  else if (base === 'number') kind = 'number'
  else if (base === 'boolean') kind = 'boolean'
  else if (enums.has(base)) {
    kind = 'string'
    options = enums.get(base)
  } else if (/^(string|number|boolean) \| /.test(type)) kind = 'json'
  else if (/Id$/.test(base) && classes.has(base)) kind = 'string'
  else kind = 'json'
  return {kind: array ? `${kind}[]` : kind, options}
}

function fieldsOf(dto, {classes, enums}) {
  const seen = new Map()
  let name = dto
  const chain = []
  while (name && classes.has(name)) {
    chain.unshift(classes.get(name))
    name = classes.get(name).extends
  }

  for (const cls of chain) {
    for (const f of cls.fields) {
      if (HIDDEN_FIELDS.has(f.name)) continue
      const {kind, options} = kindOf(f.type, enums, classes)
      const entry = {name: f.name, type: f.type, kind, required: f.required}
      if (options) entry.options = options
      seen.set(f.name, entry)
    }
  }

  return [...seen.values()]
}

const dts = {
  api: parseDts(join(sdkDir, 'dist/types/api2.dtos.d.ts')),
  hub: parseDts(join(sdkDir, 'dist/types/hub2.dtos.d.ts')),
}

// ---- 3. assemble --------------------------------------------------------------

const out = {sdk: `@norbix.ai/ts@${sdkVersion}`, api: {}, hub: {}}
let methodCount = 0
let missingDto = 0
for (const target of ['api', 'hub']) {
  for (const [moduleName, className] of Object.entries(namespaces[target])) {
    const block = blocks.get(className)
    if (!block) continue
    const methods = methodsOf(block)
    const entry = {}
    for (const [method, info] of Object.entries(methods)) {
      const fields = dts[target].classes.has(info.dto) ? fieldsOf(info.dto, dts[target]) : null
      if (!fields) missingDto++
      entry[method] = {http: info.http, path: info.path, dto: info.dto, fields: fields ?? []}
      methodCount++
    }

    out[target][moduleName] = entry
  }
}

const target = join(root, 'src/generated/request-fields.json')
mkdirSync(dirname(target), {recursive: true})
writeFileSync(target, JSON.stringify(out) + '\n')
console.log(`wrote ${target}: ${methodCount} methods (${missingDto} without a DTO declaration), sdk ${sdkVersion}`)
