import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {seedDefaultHost} from './seed.js'

// The CLI reads ~/.norbix/config and ~/.norbix/session.json. Point HOME at an
// empty temporary folder so the tests never see the developer's real settings
// and never pick up a live session token.
const sandboxHome = mkdtempSync(join(tmpdir(), 'norbix-cli-test-'))
process.env.HOME = sandboxHome
process.env.USERPROFILE = sandboxHome
// oclif's per-OS config folder (the old config.json) follows these on Linux
// and Windows; without them parallel workers on Windows share the runner's
// real %LOCALAPPDATA% and see each other's files.
process.env.XDG_CONFIG_HOME = join(sandboxHome, '.config')
process.env.LOCALAPPDATA = join(sandboxHome, 'AppData', 'Local')

// Nothing should reach the network. Any test that needs a response installs its
// own fake fetch; anything else fails loudly instead of calling out.
for (const name of ['NORBIX_PROJECT_ID', 'NORBIX_API_KEY', 'NORBIX_REGION', 'NORBIX_ENV', 'NORBIX_PROFILE', 'NORBIX_FILES_INTEGRATION_ID']) {
  delete process.env[name]
}

// No "newer CLI" check from the tests (it would ask the npm registry in a
// child process); tests/update-check.test.ts turns it on where it is tested.
process.env.NORBIX_NO_UPDATE_CHECK = '1'

// No repo `.norbix/project.json` from the folder the tests run in; the
// tests of that file turn the lookup on with their own folder.
process.env.NORBIX_PROJECT_CONFIG = '0'

// A change needs a named environment (BaseCommand.assertWriteEnv, Pickio
// N-21). The suite names PROD the way a script does — NORBIX_ENV — so every
// test still checks its command against the default environment;
// tests/env-policy.test.ts removes it to test the rule itself.
process.env.NORBIX_ENV = 'PROD'

// hub.norbix.ai is "already discovered": the default host's built-in
// addresses are in the host cache, so no test asks the real Hub. A test of
// discovery itself uses its own host and its own fake fetch.
seedDefaultHost(sandboxHome)
