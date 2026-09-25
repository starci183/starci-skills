// Recovery, liveness and guard windows are data in modules/models/runtimes.yaml `allocation`, read through
// engine/config.mjs allocationMs(); no source file carries a second literal (redundancy audit LC-9, G27, L-2).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseYaml, stringifyYaml } from '../engine/yaml.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const RUNTIMES = 'modules/models/runtimes.yaml';

// module -> [exported constant, allocation key]
const WINDOWS = {
  'scripts/kernel/host-outage.mjs': [['HOST_WAIT_MS', 'hostOutage.waitMs'], ['DEATH_SETTLE_MS', 'hostOutage.deathSettleMs']],
  'scripts/kernel/resume-all.mjs': [['DEFAULT_WAIT_ORCA_MS', 'resume.orcaWaitMs']],
  'scripts/kernel/restart-all.mjs': [['DEFAULT_WAIT_MS', 'restart.waitMs'], ['POLL_MS', 'restart.pollMs']],
  'scripts/kernel/reap-agent-process.mjs': [['REAP_WINDOW_MS', 'reap.windowMs']],
  'scripts/lib/self-reload.mjs': [['RELOAD_MIN_INTERVAL_MS', 'selfReload.minIntervalMs'], ['HANDOVER_WAIT_MS', 'selfReload.handoverMs']],
  'scripts/guards/footprint-scan.mjs': [['FOOTPRINT_EVERY_MS', 'footprint.everyMs'], ['FOOTPRINT_LOCK_STALE_MS', 'footprint.lockStaleMs']],
  'scripts/guards/install.mjs': [['JOB_GUARD_TTL_MS', 'jobGuard.ttlMs']],
};
const DEPS_LOCK = { waitMs: 'depsLock.waitMs', staleMs: 'depsLock.staleMs', pollMs: 'depsLock.pollMs' };

const at = (doc, dotted) => dotted.split('.').reduce((node, key) => node?.[key], doc.allocation);
const put = (doc, dotted, value) => {
  const keys = dotted.split('.');
  const parent = keys.slice(0, -1).reduce((node, key) => node[key], doc.allocation);
  if (value === undefined) delete parent[keys.at(-1)]; else parent[keys.at(-1)] = value;
};

// A copy of the runtime whose runtimes.yaml the caller rewrites; the copied modules read the copy.
const fixture = (t, edit) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-recovery-timings-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  for (const dir of ['engine', 'scripts', 'modules', 'packages/grammar/scripts']) fs.cpSync(path.join(ROOT, dir), path.join(root, dir), { recursive: true });
  for (const file of ['package.json', 'config.example.yaml']) fs.copyFileSync(path.join(ROOT, file), path.join(root, file));
  const doc = parseYaml(read(RUNTIMES));
  edit(doc);
  fs.writeFileSync(path.join(root, RUNTIMES), stringifyYaml(doc));
  return root;
};
const probe = (root, body) => {
  const env = { ...process.env };
  delete env.STARCI_HOST_WAIT_MS; delete env.STARCI_KERNEL_DEATH_SETTLE_MS;
  return spawnSync(process.execPath, ['--input-type=module', '-e', body], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 60000, env });
};
const importOf = (root, rel) => JSON.stringify(new URL(`file:///${path.join(root, rel).replaceAll('\\', '/')}`).href);

test('every recovery window is read from runtimes.yaml: a fixture value changes the computed window', (t) => {
  const live = parseYaml(read(RUNTIMES));
  const keys = [...Object.values(WINDOWS).flat().map(([, key]) => key), ...Object.values(DEPS_LOCK), 'resume.everyMs'];
  // Every fixture value differs from the live one; resume.everyMs stays whole minutes (schtasks /MO).
  const fixtureValue = (key) => (key === 'resume.everyMs' ? at(live, key) + 60_000 : at(live, key) + 7);
  const root = fixture(t, (doc) => { for (const key of keys) put(doc, key, fixtureValue(key)); });
  const modules = Object.keys(WINDOWS);
  const r = probe(root, `
    const out = {};
    ${modules.map((rel, i) => `const m${i} = await import(${importOf(root, rel)}); for (const [name] of ${JSON.stringify(WINDOWS[rel])}) out[name] = m${i}[name];`).join('\n')}
    const deps = await import(${importOf(root, 'scripts/guards/deps-guard.mjs')});
    out.depsLock = await deps.depsLockWindows();
    const resume = await import(${importOf(root, 'scripts/kernel/resume-all.mjs')});
    const every = resume.startupTasks().find((task) => task.argv.includes('MINUTE')).argv;
    out.mo = every[every.indexOf('/MO') + 1];
    console.log(JSON.stringify(out));
    process.exit(0);`);
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout.trim().split('\n').at(-1));
  for (const [name, key] of Object.values(WINDOWS).flat()) {
    assert.notEqual(fixtureValue(key), at(live, key));
    assert.equal(out[name], fixtureValue(key), `${name} reads allocation.${key}`);
  }
  for (const [field, key] of Object.entries(DEPS_LOCK)) assert.equal(out.depsLock[field], fixtureValue(key), `depsLock.${field} reads allocation.${key}`);
  assert.equal(out.mo, String(fixtureValue('resume.everyMs') / 60_000), 'the scheduled resume task runs every allocation.resume.everyMs');
});

test('a missing recovery key fails loudly at load, never a silent default', (t) => {
  const root = fixture(t, (doc) => { put(doc, 'hostOutage.waitMs', undefined); put(doc, 'liveness.quietMs', undefined); });
  const outage = probe(root, `await import(${importOf(root, 'scripts/kernel/host-outage.mjs')});`);
  assert.notEqual(outage.status, 0);
  assert.match(outage.stderr, /allocation\.hostOutage\.waitMs must declare a positive number/);
  const api = spawnSync(process.execPath, [path.join(root, 'scripts', 'kernel', 'api.mjs'), 'status', '--json'], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 60000 });
  assert.notEqual(api.status, 0);
  assert.match(api.stderr, /allocation\.liveness\.quietMs must declare a positive number/, 'api.mjs no longer falls back to a literal quiet window');
  const deps = probe(root, `const d = await import(${importOf(root, 'scripts/guards/deps-guard.mjs')}); d.acquireDepsLock({ lockFile: 'x', holder: {} });`);
  assert.notEqual(deps.status, 0);
  assert.match(deps.stderr, /waitMs must be a number of milliseconds/, 'the deps lock carries no literal default window');
});

test('no source file keeps a second literal of a moved window', () => {
  const live = parseYaml(read(RUNTIMES));
  for (const [rel, pairs] of Object.entries(WINDOWS)) {
    const source = read(rel);
    for (const [name, key] of pairs) {
      const definition = source.match(new RegExp(`^export const ${name} = (.+);$`, 'm'));
      assert.ok(definition, `${rel} defines ${name}`);
      assert.match(definition[1], new RegExp(`\\(\\s*'${key.replace('.', '\\.')}'\\s*\\)|'STARCI_[A-Z_]+', '${key.replace('.', '\\.')}'`), `${rel} ${name} reads allocation.${key}`);
      assert.doesNotMatch(definition[1], /\d/, `${rel} ${name} carries no number`);
    }
    assert.ok(at(live, pairs[0][1]) > 0);
  }
  // The literals the audit found, in the spellings they had.
  const gone = {
    'scripts/kernel/host-outage.mjs': [/90_000/, /10_000\)/],
    'scripts/kernel/resume-all.mjs': [/600_000/, /'\/MO', '\d+'/],
    'scripts/kernel/restart-all.mjs': [/8 \* 60_000/, /POLL_MS = 20_000/],
    'scripts/kernel/reap-agent-process.mjs': [/90_000/],
    'scripts/lib/self-reload.mjs': [/5 \* 60_000/, /30_000/],
    'scripts/guards/footprint-scan.mjs': [/10 \* 60_000/, /> 60_000/],
    'scripts/guards/deps-guard.mjs': [/20 \* 60_000/, /3600_000/, /pollMs = \d/],
    'scripts/guards/install.mjs': [/7 \* 24/],
  };
  for (const [rel, patterns] of Object.entries(gone)) for (const pattern of patterns) assert.doesNotMatch(read(rel), pattern, `${rel} still carries ${pattern}`);
  const api = read('scripts/kernel/api.mjs');
  assert.match(api, /^const QUIET_MS = allocationMs\('liveness\.quietMs'\);$/m);
  assert.match(api, /^const LAUNCH_GRACE_MS = allocationMs\('liveness\.launchGraceMs'\);$/m);
  assert.doesNotMatch(api, /1_200_000|return 90_000|5 \* 60 \* 1000/, 'api.mjs keeps no literal copy of a liveness or cooldown window');
});
