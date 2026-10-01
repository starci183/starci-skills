// isolated-registry.mjs — the node --test preload that gives one test run its own machine.sqlite and blob store.
//
//   node --import ./tests/setup/isolated-registry.mjs --test tests/*.spec.mjs     (npm test)
//
// scripts/supervisor/land.mjs passes it too. Loaded in the runner before any spec starts, it points
// STARCI_TEST_MACHINE_FILE (engine/db/machine.mjs TEST_REGISTRY_ENV) at a fresh machine.sqlite and STARCI_ARTIFACT_ROOT
// at a fresh blob store, both under the OS temp directory; every spec process, and every cli.mjs or kernel a spec spawns
// with the inherited env, writes there instead of the host's live stores, and the runner removes the directory when it
// exits. A value already set (a nested runner, an explicit choice) is kept. A spec run without this preload is still
// kept off the live registry: machineFileFor falls back to a temp registry inside any node --test process tree, and the
// live registry refuses temp-directory ledgers outright.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TEST_REGISTRY_ENV } from '../../engine/db/machine.mjs';
import { ARTIFACT_ROOT_ENV } from '../../engine/db/blob.mjs';

// git's repository-local variables (git rev-parse --local-env-vars) never reach a spec: a hook or alias run in a linked
// worktree exports GIT_DIR, and every fixture git then writes THAT repository whatever cwd or -C it names - a temp dir's
// `git init` re-inited the live .claude repo core.bare=true (2026-09-29). Same list as land.mjs GIT_LOCAL_ENV_VARS.
for (const key of Object.keys(process.env)) {
  if (['GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_IMPLICIT_WORK_TREE', 'GIT_PREFIX', 'GIT_CONFIG', 'GIT_CONFIG_PARAMETERS', 'GIT_CONFIG_COUNT', 'GIT_GRAFT_FILE', 'GIT_NO_REPLACE_OBJECTS', 'GIT_REPLACE_REF_BASE', 'GIT_SHALLOW_FILE'].includes(key)
    || /^GIT_CONFIG_(KEY|VALUE)_\d+$/.test(key)) delete process.env[key];
}

if (!process.env[TEST_REGISTRY_ENV] || !process.env[ARTIFACT_ROOT_ENV]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-test-registry-'));
  if (!process.env[TEST_REGISTRY_ENV]) process.env[TEST_REGISTRY_ENV] = path.join(dir, 'machine.sqlite');
  if (!process.env[ARTIFACT_ROOT_ENV]) process.env[ARTIFACT_ROOT_ENV] = path.join(dir, 'artifacts');
  if (!process.env.STARCI_PROJECTS_ROOT) process.env.STARCI_PROJECTS_ROOT = path.join(dir, 'projects');
  process.on('exit', () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* a detached child may still hold it */ } });
}
