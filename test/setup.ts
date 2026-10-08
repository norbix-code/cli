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

// Nothing should reach the network. Any test that needs a response installs its
// own fake fetch; anything else fails loudly instead of calling out.
for (const name of ['NORBIX_PROJECT_ID', 'NORBIX_API_KEY', 'NORBIX_REGION', 'NORBIX_ENV', 'NORBIX_PROFILE', 'NORBIX_FILES_INTEGRATION_ID']) {
  delete process.env[name]
}

// hub.norbix.ai is "already discovered": the default host's built-in
// addresses are in the host cache, so no test asks the real Hub. A test of
// discovery itself uses its own host and its own fake fetch.
seedDefaultHost(sandboxHome)
