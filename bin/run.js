#!/usr/bin/env node

// Fast path: `norbix --version` answers from package.json without loading
// oclif (the agent contract asks for < 200 ms; oclif alone costs more on a
// slow machine). Same string oclif prints: name/version platform-arch node-v.
if (process.argv.length === 3 && process.argv[2] === '--version') {
  const {readFileSync} = await import('node:fs')
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  process.stdout.write(`${pkg.name}/${pkg.version} ${process.platform}-${process.arch} node-${process.version}\n`)
} else {
  const {execute} = await import('@oclif/core')
  await execute({dir: import.meta.url})
}
