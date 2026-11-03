import FilesIntegrationsTest from '../integrations/test.js'

/**
 * `norbix files integration test <id>` — the same command as
 * `norbix files integrations test <id>` (shipped first, under the plural
 * topic), so the files module reads like every other one:
 * `<module> integrations` lists, `<module> integration <id|verb>` acts on one.
 */
export default class FilesIntegrationTest extends FilesIntegrationsTest {
  static examples = [
    '<%= config.bin %> files integration test 55555555-5555-5555-5555-555555555555',
    '<%= config.bin %> files integration test 55555555-5555-5555-5555-555555555555 --json',
  ]
}
