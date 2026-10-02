import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { CATALOG as catalog } from '../../packages/cli/src/catalog.generated.mjs';
import { main as runtimeMain } from '../../scripts/cli/main.mjs';
import { harnessStatus, openHarness, startHarness, stopHarness } from '../../ui/start.mjs';

test('harness catalog resolves all four verbs and validates the tunnel flag', () => {
  const calls = [];
  const runScript = (script, args) => { calls.push({ script, args }); return 0; };
  assert.equal(runtimeMain(['harness', 'start', '--tunnel'], { catalog, runScript }), 0);
  assert.equal(runtimeMain(['harness', 'stop', '--json'], { catalog, runScript }), 0);
  assert.equal(runtimeMain(['harness', 'status'], { catalog, runScript }), 0);
  assert.equal(runtimeMain(['harness', 'open'], { catalog, runScript }), 0);
  assert.deepEqual(calls.map((call) => call.args), [['start', '--tunnel'], ['stop', '--json'], ['status'], ['open']]);
  assert.ok(calls.every((call) => /ui[\\/]start\.mjs$/.test(call.script)));
  assert.equal(runtimeMain(['harness', 'start', '--port', '3100'], { catalog, stderr: () => {}, runScript }), 2);
});

test('harness status reuses an injected health probe and open uses its seam', async () => {
  const seen = [];
  const status = await harnessStatus({ url: 'http://127.0.0.1:4547', probe: async (url) => { seen.push(url); return { ok: true, status: 200 }; } });
  assert.deepEqual(status, { ok: true, running: true, url: 'http://127.0.0.1:4547', status: 200 });
  assert.deepEqual(seen, ['http://127.0.0.1:4547/healthz']);
  assert.doesNotMatch(seen[0], /3100/);
  assert.deepEqual(await openHarness({ url: status.url, open: (url) => ({ ok: true, url }) }), { ok: true, url: status.url });
});

test('harness stop kills only a PID whose command and creation time match its start record', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-harness-cli-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const stateFile = path.join(dir, 'harness.json');
  const lifecycle = new EventEmitter();
  lifecycle.exitCode = 0;
  const children = [501, 502].map((pid) => Object.assign(new EventEmitter(), { pid, killed: false, kill() { this.killed = true; } }));
  let child = 0;
  startHarness({ stateFile, pid: 77, now: 1_000, lifecycle, spawnApp: () => children[child++] });
  const record = JSON.parse(fs.readFileSync(stateFile, 'utf8')).processes.app;
  const killed = [];
  const stopped = stopHarness({ stateFile, processes: () => [{ pid: 77, created: 1_001, cmd: `node "${record.script}" start` }], kill: (pid) => { killed.push(pid); return { ok: true }; } });
  assert.equal(stopped.ok, true);
  assert.deepEqual(killed, [77]);

  startHarness({ stateFile, pid: 88, now: 2_000, lifecycle, spawnApp: () => children[0] });
  const refused = stopHarness({ stateFile, processes: () => [{ pid: 88, created: 2_001, cmd: 'node other-service.mjs' }], kill: (pid) => { killed.push(pid); return { ok: true }; } });
  assert.equal(refused.ok, false);
  assert.deepEqual(killed, [77], 'the mismatched PID was never killed');
  assert.equal(JSON.parse(fs.readFileSync(stateFile, 'utf8')).processes.app.pid, 88, 'the refused record stays visible');
});
