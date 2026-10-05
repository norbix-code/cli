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
 *   dist/index.js          method → {target, path, method}  (the transport.send call)
 *                          method → dto                     ("Request DTO: X" in the JSDoc)
 *   dist/types/*.dtos.d.ts dto    → fields                  (class bodies)
 *
 * If any SDK method cannot be read, the script lists each one, writes
 * nothing and exits with code 1. A loud stop costs the person bumping the
 * SDK a minute; a silently missing method breaks `--help` and value typing
 * for that command and nobody notices (that happened with 4.9.1, issue S187).
 */
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs'
import {createRequire} from 'node:module'
import {dirname, join} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'

// ---- 1. module classes → methods -------------------------------------------

/** `var FooModule = class {` … up to the next top-level `var X = class`. */
export function classBlocks(source) {
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

const SIGNATURE_RE = /^[ \t]+(\w+) = \(request = \{\}, options = \{\}\) => \{[ \t]*$/gm
const SEND = 'this.transport.send({'

/** `key: "value"` inside the object passed to `transport.send`. */
function sendField(call, key) {
  const m = call.match(new RegExp(`\\b${key}: "([^"]*)"`))
  return m ? m[1] : undefined
}

/** The `/** … *\/` comment that ends right before `at`, or '' when there is none. */
function docBefore(block, at) {
  const before = block.slice(0, at).trimEnd()
  if (!before.endsWith('*/')) return ''
  const start = before.lastIndexOf('/**')
  return start === -1 ? '' : before.slice(start)
}

/**
 * Every SDK method in one module class block.
 *
 * The HTTP method, path and target come from the `transport.send({...})` call
 * itself — that is what runs, so it is the truth. The request DTO comes from
 * the `Request DTO: X` text anywhere in the doc comment, so extra doc lines
 * (descriptions, "Anonymous — no token needed", blank ` *` lines) before or
 * after the `VERB path` line do not matter.
 *
 * A method that cannot be read is never dropped silently: it goes into
 * `problems`, and the generator stops (see main()).
 */
export function methodsOf(block, label = 'module') {
  const methods = {}
  const problems = []
  let sendsInMethods = 0
  for (const m of block.matchAll(SIGNATURE_RE)) {
    const name = m[1]
    const where = `${label}.${name}`
    const afterSig = block.slice(m.index + m[0].length)
    const body = afterSig.match(/^\s*return this\.transport\.send\(\{([\s\S]*?)\}\);/)
    if (!body) {
      problems.push(`${where}: the method body is not \`return this.transport.send({...})\``)
      continue
    }

    sendsInMethods++
    const call = body[1]
    const target = sendField(call, 'target')
    const path = sendField(call, 'path')
    const http = sendField(call, 'method')
    if (!['api', 'hub'].includes(target) || !path || !/^(GET|POST|PUT|PATCH|DELETE)$/.test(http ?? '')) {
      problems.push(`${where}: cannot read target / path / method from the send call`)
      continue
    }

    const doc = docBefore(block, m.index)
    if (!doc) {
      problems.push(`${where}: no doc comment, so no "Request DTO:" line`)
      continue
    }

    const dtos = [...doc.matchAll(/Request DTO: (\w+)/g)].map((d) => d[1])
    if (dtos.length !== 1) {
      problems.push(`${where}: ${dtos.length === 0 ? 'no' : dtos.length} "Request DTO:" line${dtos.length > 1 ? 's' : ''} in the doc comment`)
      continue
    }

    const verbLine = doc.match(/^\s*\* (GET|POST|PUT|PATCH|DELETE) (\S+)\s*$/m)
    if (verbLine && (verbLine[1] !== http || verbLine[2] !== path)) {
      problems.push(`${where}: doc says "${verbLine[1]} ${verbLine[2]}" but the send call is "${http} ${path}"`)
      continue
    }

    methods[name] = {http, path, dto: dtos[0], target}
  }

  const sends = block.split(SEND).length - 1
  if (sends !== sendsInMethods) {
    problems.push(`${label}: ${sends - sendsInMethods} send call(s) outside a method of the shape \`name = (request = {}, options = {}) => {\``)
  }

  return {methods, problems}
}

/** `this.membership = new MembershipModule(transport)` inside a namespace class. */
export function modulesOf(block) {
  const out = {}
  const re = /this\.(\w+) = new (\w+)\(transport\)/g
  let m
  while ((m = re.exec(block))) out[m[1]] = m[2]
  return out
}

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

// ---- 3. assemble --------------------------------------------------------------

/**
 * Every method of every `api.*` / `hub.*` module in the SDK's dist/index.js,
 * plus the list of methods (or modules) that could not be read.
 */
export function sdkMethods(indexJs) {
  const blocks = classBlocks(indexJs)
  const problems = []
  const result = {api: {}, hub: {}}
  for (const [target, nsClass] of [['api', 'ApiNamespace'], ['hub', 'HubNamespace']]) {
    const ns = blocks.get(nsClass)
    if (!ns) {
      problems.push(`${target}: class ${nsClass} not found in dist/index.js`)
      continue
    }

    for (const [moduleName, className] of Object.entries(modulesOf(ns))) {
      const block = blocks.get(className)
      if (!block) {
        problems.push(`${target}.${moduleName}: class ${className} not found in dist/index.js`)
        continue
      }

      const {methods, problems: p} = methodsOf(block, `${target}.${moduleName}`)
      problems.push(...p)
      for (const [name, info] of Object.entries(methods)) {
        if (info.target !== target) problems.push(`${target}.${moduleName}.${name}: sends to "${info.target}", not "${target}"`)
      }

      result[target][moduleName] = methods
    }
  }

  return {methods: result, problems}
}

function main() {
  const require = createRequire(import.meta.url)
  const root = dirname(dirname(fileURLToPath(import.meta.url)))
  // The package exports map hides package.json; resolve the entry point and walk up.
  const sdkDir = dirname(dirname(require.resolve('@norbix.ai/ts')))
  const sdkVersion = JSON.parse(readFileSync(join(sdkDir, 'package.json'), 'utf8')).version
  const indexJs = readFileSync(join(sdkDir, 'dist/index.js'), 'utf8')

  const {methods: all, problems} = sdkMethods(indexJs)
  if (problems.length > 0) {
    console.error(`gen:fields: ${problems.length} SDK method(s) could not be read from @norbix.ai/ts ${sdkVersion}; nothing written:`)
    for (const p of problems) console.error(`  ${p}`)
    process.exit(1)
  }

  const dts = {
    api: parseDts(join(sdkDir, 'dist/types/api2.dtos.d.ts')),
    hub: parseDts(join(sdkDir, 'dist/types/hub2.dtos.d.ts')),
  }

  const out = {sdk: `@norbix.ai/ts@${sdkVersion}`, api: {}, hub: {}}
  let methodCount = 0
  let missingDto = 0
  for (const target of ['api', 'hub']) {
    for (const [moduleName, methods] of Object.entries(all[target])) {
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

  const file = join(root, 'src/generated/request-fields.json')
  mkdirSync(dirname(file), {recursive: true})
  writeFileSync(file, JSON.stringify(out) + '\n')
  console.log(`wrote ${file}: ${methodCount} methods (${missingDto} without a DTO declaration), sdk ${sdkVersion}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
