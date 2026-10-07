// Codex launch trust asks `codex app-server` for the hash it trusts the guard hook by (scripts/agent/trust.mjs
// codexAppServer). Live defect 2026-10-07: every codex-agent launch was refused at launch-trust with "codex
// app-server answered nothing (exit 0)", and routing kept picking codex-agent (provider-health codex open:false).
// Root cause in the runtime client: when `codex app-server` exits before it answers (codex missing from the
// launching process's PATH, a crash, a refused CODEX_HOME), the node client's event loop simply drains and it
// exits 0 with nothing printed, its stderr discarded. The error named no cause, and nothing classified it, so no
// strike reached the codex circuit.
// Contract: an app-server that ends without answering is an error naming its exit, its stderr tail and the codex
// version; that runtime-owned failure is a worker-start strike of the codex circuit (allocation.providerStrikes:
// one failure never opens it, the second does); a working app-server is unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { codexAppServer } from '../../scripts/agent/trust.mjs';
import { outageInText } from '../../scripts/agent/provider-outage.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const runtimes = parseYaml(fs.readFileSync(path.join(ROOT, 'modules', 'models', 'runtimes.yaml'), 'utf8'));

// A fake `codex` first on PATH: `--version` prints a version; `app-server` behaves per FAKE_CODEX_MODE.
const FAKE = String.raw`
const mode = process.env.FAKE_CODEX_MODE;
if (process.argv[2] === '--version') { console.log('codex-cli 9.9.9-fake'); process.exit(0); }
if (mode === 'silent') { process.stderr.write('Error: app-server could not open the state db\n'); process.exit(0); }
if (mode === 'crash') { process.stderr.write('thread main panicked at codex-rs/app-server\n'); process.exit(101); }
let buf = '';
process.stdin.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
  if (m.id === undefined) continue;
  const result = m.method === 'initialize' ? { codexHome: process.env.CODEX_HOME } : { method: m.method, home: process.env.CODEX_HOME };
  process.stdout.write(JSON.stringify({ method: 'account/updated', params: {} }) + '\n' + JSON.stringify({ id: m.id, result }) + '\n'); } });
`;
const fakeCodex = (t, mode) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-fake-codex-'));
  fs.writeFileSync(path.join(dir, 'fake-codex.cjs'), FAKE);
  fs.writeFileSync(path.join(dir, 'codex.cmd'), `@"${process.execPath}" "%~dp0fake-codex.cjs" %*\r\n`);
  fs.writeFileSync(path.join(dir, 'codex'), `#!/bin/sh\nexec "${process.execPath}" "$(dirname "$0")/fake-codex.cjs" "$@"\n`, { mode: 0o755 });
  const saved = { PATH: process.env.PATH, FAKE_CODEX_MODE: process.env.FAKE_CODEX_MODE };
  process.env.PATH = `${dir}${path.delimiter}${saved.PATH}`;
  process.env.FAKE_CODEX_MODE = mode;
  t.after(() => {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  });
  return path.join(dir, 'home');
};
const failureOf = (fn) => { try { fn(); } catch (e) { return String(e.message); } return null; };

test('an app-server that exits 0 without answering is an error naming its exit, stderr tail and the codex version', (t) => {
  const home = fakeCodex(t, 'silent');
  const error = failureOf(() => codexAppServer({ home, requests: [{ method: 'hooks/list', params: { cwds: [ROOT] } }], timeoutMs: 30000 }));
  assert.ok(error, 'no answer is never a result');
  assert.match(error, /^codex app-server answered nothing/);
  assert.match(error, /exited 0 before answering initialize/);
  assert.match(error, /stderr: Error: app-server could not open the state db/);
  assert.match(error, /codex-cli 9\.9\.9-fake/);
  assert.match(error, new RegExp(`CODEX_HOME ${home.replace(/[\\.]/g, '\\$&')}`));
});

test('an app-server that crashes names its exit code and stderr', (t) => {
  const home = fakeCodex(t, 'crash');
  const error = failureOf(() => codexAppServer({ home, requests: [{ method: 'hooks/list', params: {} }], timeoutMs: 30000 }));
  assert.match(error ?? '', /exited 101 before answering initialize/);
  assert.match(error ?? '', /panicked at codex-rs\/app-server/);
});

test('a working app-server is unchanged: results in request order, notifications skipped, CODEX_HOME passed', (t) => {
  const home = fakeCodex(t, 'working');
  const results = codexAppServer({ home, requests: [{ method: 'hooks/list', params: {} }, { method: 'config/batchWrite', params: {} }], timeoutMs: 30000 });
  assert.deepEqual(results, [{ method: 'hooks/list', home }, { method: 'config/batchWrite', home }]);
});

test('the app-server failure is a codex worker-start strike: one never opens the circuit, the second does', (t) => {
  const home = fakeCodex(t, 'silent');
  const error = failureOf(() => codexAppServer({ home, requests: [{ method: 'hooks/list', params: {} }], timeoutMs: 30000 }));
  // rejectDispatch (scripts/kernel/cli.mjs) and the Supervisor's spawn pass read the launch-trust refusal here.
  const strike = outageInText('codex', [null, error]);
  assert.deepEqual([strike?.provider, strike?.failureKind, strike?.source], ['codex', 'worker-start', 'text']);
  assert.equal(outageInText('codex-agent', [error])?.failureKind, 'worker-start', 'the pool name is the same provider');
  // The old bare text (a runtime before this fix, or a timeout) strikes too.
  assert.equal(outageInText('codex', ['codex app-server answered nothing (exit null: spawnSync node ETIMEDOUT)'])?.failureKind, 'worker-start');
  assert.equal(runtimes.allocation.providerStrikes['worker-start'], 2, 'a single failure strikes; the second opens the circuit');
  // Launch-trust refusals that are not codex's own failure strike nothing.
  for (const text of ['owner declined automatic launch trust', 'current owner launchTrust profile is not adopted', 'EPERM: operation not permitted, open config.toml'])
    assert.equal(outageInText('codex', [text]), null, text);
  assert.equal(outageInText('claude', [error]), null, 'a codex failure never strikes another provider');
});
