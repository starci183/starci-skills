// isolated-registry.mjs — the node --test preload that gives one test run its own machine.sqlite and blob store.
//
//   node --import ./tests/setup/isolated-registry.mjs --test tests/*.spec.mjs     (npm test)
//
// scripts/supervisor/land.mjs passes it too. Loaded in the runner before any spec starts, it points
// STARCI_TEST_MACHINE_FILE (engine/machine-db.mjs TEST_REGISTRY_ENV) at a fresh machine.sqlite and STARCI_ARTIFACT_ROOT
// at a fresh blob store, both under the OS temp directory; every spec process, and every api.mjs or kernel a spec spawns
// with the inherited env, writes there instead of the host's live stores, and the runner removes the directory when it
// exits. A value already set (a nested runner, an explicit choice) is kept. A spec run without this preload is still
// kept off the live registry: machineFileFor falls back to a temp registry inside any node --test process tree, and the
// live registry refuses temp-directory ledgers outright.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TEST_REGISTRY_ENV } from '../../engine/machine-db.mjs';
import { ARTIFACT_ROOT_ENV } from '../../scripts/lib/artifact-store.mjs';

if (!process.env[TEST_REGISTRY_ENV] || !process.env[ARTIFACT_ROOT_ENV]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-test-registry-'));
  if (!process.env[TEST_REGISTRY_ENV]) process.env[TEST_REGISTRY_ENV] = path.join(dir, 'machine.sqlite');
  if (!process.env[ARTIFACT_ROOT_ENV]) process.env[ARTIFACT_ROOT_ENV] = path.join(dir, 'artifacts');
  process.on('exit', () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* a detached child may still hold it */ } });
}
