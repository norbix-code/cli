import {Help} from '@oclif/core'

/**
 * Custom help router. oclif intercepts --help before a command runs, which
 * would hide the scoped help of the dynamic namespaces. For
 * `norbix hub <words...> --help` (and `api`), delegate back to the command
 * with an internal marker so it can print help for exactly that scope.
 */
export default class NorbixHelp extends Help {
  async showHelp(argv: string[]): Promise<void> {
    const words = argv.filter((a) => a !== '--help' && a !== '-h')
    const [first, ...rest] = words

    if ((first === 'hub' || first === 'api') && rest.length > 0) {
      await this.config.runCommand(first, [...rest, '--scope-help'])
      return
    }

    return super.showHelp(argv)
  }
}
