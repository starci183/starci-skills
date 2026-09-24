// isolated-registry.mjs — the node --test preload that gives one test run its own machine registry.
//
//   node --import ./tests/setup/isolated-registry.mjs --test tests/*.spec.mjs     (npm test)
//
// scripts/supervisor/land.mjs passes it too. Loaded in the runner before any spec starts, it points
// STARCI_TEST_MACHINE_FILE (engine/ledger-db.mjs TEST_REGISTRY_ENV) at a fresh machine.sqlite under the OS
// temp directory; every spec process, and every api.mjs or kernel a spec spawns with the inherited env,
// registers its ledgers there instead of on the host's live registry, and the runner removes the directory
// when it exits. A value already set (a nested runner, an explicit choice) is kept. A spec run without this
// preload is still kept off the live registry: machineFileFor falls back to a temp registry inside any
// node --test process tree, and the live registry refuses temp-directory ledgers outright.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TEST_REGISTRY_ENV } from '../../engine/ledger-db.mjs';

if (!process.env[TEST_REGISTRY_ENV]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-test-registry-'));
  process.env[TEST_REGISTRY_ENV] = path.join(dir, 'machine.sqlite');
  process.on('exit', () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* a detached child may still hold it */ } });
}
