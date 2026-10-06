import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { HOST_BOOTSTRAP_FILES } from '../../scripts/install/bootstrap-hosts.mjs';

const script = fileURLToPath(new URL('../../scripts/checks/check-entry.mjs', import.meta.url));
const CURRENT = '# bootstrap\nRead .claude/CONTEXT.md first.\n';

function host(t, files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-entry-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, '.claude'));
  fs.writeFileSync(path.join(dir, '.claude', 'CONTEXT.md'), 'context\n');
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
  return dir;
}
const run = (...args) => { const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' }); return { ...r, json: r.stdout ? JSON.parse(r.stdout) : null }; };

test('a default install (AGENTS.md only) is ready: no host copy is demanded', (t) => {
  const r = run(host(t, { 'AGENTS.md': CURRENT }));
  assert.equal(r.status, 0); assert.equal(r.json.status, 'ready');
  assert.deepEqual(r.json.bootstraps.map((b) => path.basename(b.file)), ['AGENTS.md']);
});

test('a host copy that exists is judged, and a named host whose copy is missing fails closed', (t) => {
  const stale = run(host(t, { 'AGENTS.md': CURRENT, 'CLAUDE.md': 'see .claude/INDEX.md\n' }));
  assert.equal(stale.status, 1); assert.equal(stale.json.status, 'bootstrap-review-required');
  const missing = run(host(t, { 'AGENTS.md': CURRENT }), '--hosts', 'claude,devin');
  assert.equal(missing.status, 1); assert.equal(missing.json.status, 'bootstrap-review-required');
  assert.deepEqual(missing.json.bootstraps.map((b) => path.basename(b.file)), Object.values(HOST_BOOTSTRAP_FILES));
  const all = run(host(t, { 'AGENTS.md': CURRENT, 'CLAUDE.md': CURRENT, 'DEVIN.md': CURRENT }), '--hosts=all');
  assert.equal(all.status, 0);
});

test('AGENTS.md missing is never ready, and the usage names the explicit host and --hosts', (t) => {
  const r = run(host(t, {}));
  assert.equal(r.status, 1); assert.equal(r.json.status, 'bootstrap-review-required');
  const usage = run();
  assert.equal(usage.status, 1); assert.match(usage.stderr, /runtime check --only entry -- <explicit-host> \[claimed-entry\] \[--hosts/);
  const bad = run('x', '--hosts', 'cursor');
  assert.equal(bad.status, 1); assert.match(bad.stderr, /unknown --hosts value cursor/);
});
