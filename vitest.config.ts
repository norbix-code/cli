import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
    // The commands are loaded through the built oclif manifest, so the tests
    // run against the same code that ships.
    testTimeout: 20_000,
  },
})
