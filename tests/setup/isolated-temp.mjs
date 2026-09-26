// isolated-temp.mjs — the node --test preload that gives every spec process its own temp root and fails it on leaks.
//
//   node --import ./tests/setup/isolated-temp.mjs --import ./tests/setup/isolated-registry.mjs --test tests/*.spec.mjs     (npm test)
//
// node --test runs each spec file in a child process with this import applied, and the child is where the fixtures
// live. Loaded first — before isolated-registry, so the per-run machine registry lands inside the root too — it
// points TEMP/TMP/TMPDIR at a fresh directory and marks it with STARCI_TEST_TEMP_DIR; the spec, and every api.mjs
// or kernel the spec spawns with the inherited env, then mkdtemps inside that directory. Because the root is
// dedicated, anything still in it when the spec's process exits is a fixture nobody removed (test temp hygiene:
// the suite must leave no new starci* dirs in the temp root). The process lists its leftovers as a diagnostic,
// removes the root, and exits nonzero, which fails that spec file and the run. A value already set — a nested
// runner, an explicit choice — is kept.
//
// Two names are not leaks: node-compile-cache is the test runner's own module cache under os.tmpdir(), and
// starci-test-registry-* is the per-run machine registry isolated-registry removes on exit — its 'exit' listener
// was registered after this one, so it still holds the dir when this check runs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const TEST_TEMP_ENV = 'STARCI_TEST_TEMP_DIR';
const INFRA = name => name === 'node-compile-cache' || name.startsWith('starci-test-registry-');

if (!process.env[TEST_TEMP_ENV]) {
  const dir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-test-tmp-')));
  process.env[TEST_TEMP_ENV] = dir;
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
