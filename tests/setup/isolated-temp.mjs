// isolated-temp.mjs — the node --test preload that gives every spec process its own temp root and fails it on leaks.
//
//   node --import ./tests/setup/isolated-temp.mjs --import ./tests/setup/isolated-registry.mjs --test tests/*.spec.mjs     (npm test)
//
// node --test runs each spec file in a child process with this import applied, and the child is where the fixtures
// live. Loaded first — before isolated-registry, so the per-run machine registry lands inside the root too — it
// points TEMP/TMP/TMPDIR and STARCI_TEMP_ROOT (the runtime's temp root, engine/temp-root.mjs) at a fresh directory and marks it with STARCI_TEST_TEMP_DIR; the spec, and every cli.mjs
// or kernel the spec spawns with the inherited env, then mkdtemps inside that directory. Because the root is
// dedicated, anything still in it when the spec's process exits is a fixture nobody removed (test temp hygiene:
// the suite must leave no new starci* dirs in the temp root). The process lists its leftovers as a diagnostic,
// removes the root, and exits nonzero, which fails that spec file and the run. A value already set — a nested
// runner, an explicit choice — is kept.
//
// The root is created inside the base directory the runner names with STARCI_TEMP_ROOT, else the OS temp directory. The
// environment variable is the suite's only input: it never reads config.yaml, so a spec run does not depend on the owner's
// live settings (CONTRIBUTING.md, "Temp files": STARCI_TEMP_ROOT=<dir> runs the whole suite on another drive).
//
// Two names are not leaks: node-compile-cache is the test runner's own module cache under os.tmpdir(), and
// starci-test-registry-* is the per-run machine registry isolated-registry removes on exit — its 'exit' listener
// was registered after this one, so it still holds the dir when this check runs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GUARDS_ROOT_ENV } from '../../scripts/guards/guards-root.mjs';

export const TEST_TEMP_ENV = 'STARCI_TEST_TEMP_DIR';
const INFRA = name => name === 'node-compile-cache' || name.startsWith('starci-test-registry-') || name.startsWith('starci-test-guards-');

const baseDir = () => {
  const base = process.env.STARCI_TEMP_ROOT || os.tmpdir();
  fs.mkdirSync(base, { recursive: true });
  return base;
};

if (!process.env[TEST_TEMP_ENV]) {
  const dir = fs.realpathSync.native(fs.mkdtempSync(path.join(baseDir(), 'starci-test-tmp-')));
  process.env[TEST_TEMP_ENV] = dir;
  process.env.STARCI_TEMP_ROOT = dir;
  process.env.TEMP = dir;
  process.env.TMP = dir;
  process.env.TMPDIR = dir;
  process.on('exit', code => {
    let left = [];
    try { left = fs.readdirSync(dir).filter(name => !INFRA(name)).sort(); } catch { /* the root is already gone */ }
    if (left.length) {
      try {
        process.stderr.write(`\nSTARCI TEST TEMP LEAK: ${left.length} entr${left.length === 1 ? 'y' : 'ies'} left under this spec's temp root ${dir} - every fixture must remove its temp dir in t.after:\n  ${left.join('\n  ')}\n`);
      } catch { /* stderr already closed */ }
    }
    try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); } catch { /* a detached child may still hold it */ }
    if (left.length) process.exitCode = code || 1;
  });
}

// The op guard directory (scripts/guards/guards-root.mjs) is per PROCESS, never inherited from the runner: every spec
// file gets its own, so two files that bind the same fake Orca handle (fake-terminal-1) never read each other's guard
// binding, and no spec writes the live guards root. A process this preload did not load (an cli.mjs a spec spawns)
// inherits its spec's directory.
{
  const guards = fs.mkdtempSync(path.join(baseDir(), 'starci-test-guards-'));
  process.env[GUARDS_ROOT_ENV] = guards;
  process.on('exit', () => { try { fs.rmSync(guards, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); } catch { /* a detached child may still hold it */ } });
}

// Node 22 prints the node:sqlite ExperimentalWarning on the stderr of every runtime process (Node 24 does not); a spec that reads the
// last line of a child's stderr, or all of it as JSON, must see the child's own words only. Children inherit this, as they inherit the temp root.
process.env.NODE_NO_WARNINGS ??= '1';
