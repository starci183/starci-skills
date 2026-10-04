// scripts/reconciler/boot.mjs (crash-loop guard: only abnormal starts count) and start.mjs (operational profile,
// ui build staleness, preflight rows). Every host effect is a seam; nothing here starts or stops a process.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { crashLoopPlan, crashLoopRecord, ensure, isPlannedStart, SPAWNED_KIND } from '../../scripts/reconciler/boot.mjs';
import { PROFILES, REQUIRED_ACTIVE, configuredMode, reconcilerConfig } from '../../scripts/reconciler/state.mjs';
import { applyHost, buildUi, ensureHostRuntime, applyProfileText, cmpVersion, engineItems, isTempLedger, ledgerFindings, ledgerIntegrity, pinProblems, profileItems, sqliteItem, summarize, uiBuildState } from '../../scripts/reconciler/start.mjs';
import { tempState } from '../../scripts/reconciler/testing.mjs';

const NOW = 10_000_000;
const NUMBERS = { pollMs: 2000, leaseMs: 30000, renewMs: 10000, heartbeatStaleMs: 60000, statusCacheMs: 20000, backoff: { minMs: 1000, maxMs: 300000 }, crashLoop: { max: 3, windowMs: 1800000 } };
const stale = { fresh: false, holder: null, pid: null, epoch: null, ageMs: null, draining: false, pushRunning: false };

function spawnRow(m, at, startReason) {
  m.log({ actor: 'reconciler', kind: SPAWNED_KIND, msg: `boot ensure started the engine pid 1 (${startReason})`, data: { pid: 1, safe: false, startReason }, at });
}

test('planned starts (owner restart, reload handover, restart after a clean exit) never count toward the crash loop', (t) => {
  const st = tempState();
  t.after(() => st.close());
  for (const [i, r] of ['owner-restart', 'start', 'self-reload', 'planned-restart', 'boot'].entries()) spawnRow(st.m, NOW - 60_000 + i, r);
  const record = crashLoopRecord({ env: st.env, now: NOW });
  assert.equal(record.starts.length, 1, 'only the abnormal `boot` start counts');
  assert.equal(crashLoopPlan(record, { now: NOW, max: 3 }).looping, false);
  assert.ok(['owner-restart', 'start', 'self-reload', 'reload', 'handover', 'planned-restart'].every(isPlannedStart) && !isPlannedStart('ensure-stale-heartbeat'));
});

test('a real crash loop is still detected and starts --safe; lands and owner restarts around it do not hide or cause it', async (t) => {
  const st = tempState();
  t.after(() => st.close());
  for (let i = 0; i < 3; i += 1) spawnRow(st.m, NOW - 100_000 + i, 'ensure-stale-heartbeat');
  for (let i = 0; i < 5; i += 1) spawnRow(st.m, NOW - 50_000 + i, 'self-reload');
  const spawned = [];
  const r = await ensure({ env: st.env, now: NOW, numbers: NUMBERS, leader: () => stale, spawnOne: (o) => { spawned.push(o); return 4242; }, push: async () => ({ ok: true }),
    lock: () => null, starting: () => null, record: () => null });
  assert.equal(r.safe, true);
  assert.equal(spawned[0].safe, true);
  assert.equal(spawned[0].startReason, 'crash-restart');
});

test('three lands in 30 minutes (self-reload restarts) do not start safe mode; an owner restart names its reason', async (t) => {
  const st = tempState();
  t.after(() => st.close());
  for (let i = 0; i < 4; i += 1) spawnRow(st.m, NOW - 100_000 + i, 'self-reload');
  const spawned = [];
  const run = (extra) => ensure({ env: st.env, now: NOW, numbers: NUMBERS, leader: () => ({ ...stale, ...(extra.leader ?? {}) }), spawnOne: (o) => { spawned.push(o); return 1; }, push: async () => ({ ok: true }),
    lock: () => null, starting: () => null, record: () => null, ...(extra.reason ? { reason: extra.reason } : {}) });
  assert.equal((await run({})).safe, false);
  assert.equal((await run({ reason: 'owner-restart' })).startReason, 'owner-restart');
  assert.equal((await run({ leader: { exitReason: 'reload-handover' } })).startReason, 'planned-restart');
  assert.equal((await run({ leader: { holder: 'h', pid: null } })).startReason, 'ensure-stale-heartbeat');
});

test('the operational profile makes job/host/workflow/resource active, an explicit mode overrides it, no profile leaves the explicit set', () => {
  const op = reconcilerConfig({ config: { reconciler: { enabled: true, profile: 'operational', controllers: { gc: { mode: 'active' }, job: { mode: 'shadow' } } } } });
  assert.deepEqual(['host', 'workflow', 'resource', 'gc', 'job', 'workers'].map((n) => configuredMode(n, op)), ['active', 'active', 'active', 'active', 'shadow', 'shadow']);
  assert.equal(profileItems(op, {})[0].status, 'red', 'an explicit shadow of a needed controller is red');
  const plain = reconcilerConfig({ config: { reconciler: { enabled: true, controllers: { job: { mode: 'shadow' } } } } });
  assert.equal(configuredMode('host', plain), 'off');
  const shadow = profileItems(plain, {})[0];
  assert.equal(shadow.status, 'red');
  assert.match(shadow.fix, /starci reconciler up --set-profile operational/);
  assert.equal(profileItems(reconcilerConfig({ config: { reconciler: { enabled: true, profile: 'operational' } } }), {})[0].status, 'green');
  assert.deepEqual(REQUIRED_ACTIVE, ['job', 'host', 'workflow', 'resource']);
  assert.equal(PROFILES.observe.job, 'shadow');
});

test('applyProfileText rewrites the reconciler block, keeps explicit gc/workers/learning entries and is idempotent', () => {
  const text = 'model: x\r\nreconciler:\r\n  enabled: true\r\n  controllers: {job: {mode: shadow}, host: {mode: shadow}, gc: {mode: active}}\r\n# specs\r\nspecs: {unit: true}\r\n';
  const out = applyProfileText(text);
  assert.equal(out.changed, true);
  assert.match(out.text, /reconciler:\r\n {2}enabled: true\r\n {2}profile: operational\r\n {2}controllers: \{gc: \{mode: active\}\}\r\n# specs\r\nspecs:/);
  assert.equal(applyProfileText(out.text).changed, false);
  assert.match(applyProfileText('model: x\n').text, /profile: operational/);
  const observe = applyProfileText(text, 'observe');
  assert.match(observe.text, /profile: observe\r\n {2}controllers: \{\}\r\n# specs/);
  assert.throws(() => applyProfileText(text, 'bogus'), /unknown reconciler profile/);
});

test('ui/dist is stale when a ui source is newer than the newest built file, or missing', () => {
  const tree = (files, { entryAsset = true } = {}) => {
    if (entryAsset && Object.hasOwn(files, '/x/ui/dist/index.html')) files = { ...files, '/x/ui/dist/assets/main.js': files['/x/ui/dist/index.html'] };
    const canonical = (file) => path.resolve(file).replace(/\\/g, '/');
    files = Object.fromEntries(Object.entries(files).map(([file, at]) => [canonical(file), at]));
    const fsImpl = {
      readdirSync: (dir) => Object.keys(files).filter((f) => canonical(path.dirname(f)) === canonical(dir)).map((f) => ({ name: path.basename(f), isDirectory: () => false }))
        .concat([...new Set(Object.keys(files).map((f) => canonical(path.dirname(f))).filter((d) => canonical(path.dirname(d)) === canonical(dir)))].map((d) => ({ name: path.basename(d), isDirectory: () => true }))),
      statSync: (f) => { const k = canonical(f); if (!(k in files)) throw Error('ENOENT'); return { mtimeMs: files[k], isFile: () => true }; },
      readFileSync: () => '<script type="module" src="/assets/main.js"></script>',
    };
    return fsImpl;
  };
  const ui = '/x/ui';
  assert.equal(uiBuildState({ uiDir: ui, fsImpl: tree({ '/x/ui/src/a.tsx': 100, '/x/ui/dist/index.html': 200, '/x/ui/package.json': 50 }) }).stale, false);
  assert.equal(uiBuildState({ uiDir: ui, fsImpl: tree({ '/x/ui/src/a.tsx': 300, '/x/ui/dist/index.html': 200 }) }).stale, true);
  assert.equal(uiBuildState({ uiDir: ui, fsImpl: tree({ '/x/ui/package.json': 300, '/x/ui/dist/index.html': 200 }) }).stale, true);
  assert.equal(uiBuildState({ uiDir: ui, fsImpl: tree({ '/x/ui/src/a.tsx': 1 }) }).stale, true);
  assert.equal(uiBuildState({ uiDir: path.resolve(ui), fsImpl: tree({ '/x/ui/src/a.tsx': 100, '/x/ui/dist/index.html': 200 }, { entryAsset: false }) }).stale, true,
    'a newer index without its served module entry remains unavailable');
});

function uiFixture(t) {
  const prefix = path.join(os.tmpdir(), 'starci-ui-bootstrap-');
  const root = fs.mkdtempSync(prefix), ui = path.join(root, 'ui');
  fs.mkdirSync(ui);
  fs.writeFileSync(path.join(ui, 'package.json'), '{"private":true}\n');
  fs.writeFileSync(path.join(ui, 'package-lock.json'), '{"lockfileVersion":3}\n');
  t.after(() => {
    assert.ok(path.resolve(root).startsWith(path.resolve(prefix)));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const tools = () => {
    for (const entry of ['vite/bin/vite.js', 'typescript/bin/tsc', 'eslint/bin/eslint.js']) {
      const file = path.join(ui, 'node_modules', entry);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, '// local build tool\n');
    }
  };
  return { root, ui, tools };
}

test('a cold non-Git UI installs through the native npm API with its private env before building under one lock', async (t) => {
  const fixture = uiFixture(t), calls = [], env = { ...process.env, STARCI_UI_BOOTSTRAP_PROBE: 'private-fixture' };
  assert.equal(fs.existsSync(path.join(fixture.root, '.git')), false);
  const manifests = ['package.json', 'package-lock.json'].map((name) => fs.readFileSync(path.join(fixture.ui, name)));
  t.mock.method(childProcess, 'spawnSync', (binary, args, options) => {
    calls.push('ci');
    assert.ok(args.includes('ci'), 'the actual ci call file reaches the npm runner');
    assert.ok(args.includes('--prefer-offline') && args.includes('--no-audit') && args.includes('--no-fund'));
    assert.equal(options.cwd, fixture.ui);
    assert.equal(options.env, env, 'the owning API forwards the host private environment to npmSpawn');
    fixture.tools();
    return { status: 0, stdout: '', stderr: '' };
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  const result = await buildUi({ uiDir: fixture.ui, env }, {
    underHostLock: async (options, run) => {
      assert.deepEqual(options, { role: 'coordinator', purpose: 'harness-ui-build', env });
      calls.push('lock');
      const value = await run();
      calls.push('unlock');
      return { ok: true, value };
    },
    npm: (args, options) => {
      calls.push('build');
      assert.deepEqual(args, ['run', 'build']);
      assert.equal(options.cwd, fixture.ui);
      assert.equal(options.env, env);
      return { status: 0, stdout: 'built', stderr: '' };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.install.ok, true);
  assert.deepEqual(calls, ['lock', 'ci', 'build', 'unlock']);
  for (const [index, name] of ['package.json', 'package-lock.json'].entries())
    assert.deepEqual(fs.readFileSync(path.join(fixture.ui, name)), manifests[index]);
});

test('a warm real local UI toolchain skips installation, while an incomplete node_modules requires it', async (t) => {
  for (const warm of [true, false]) {
    const fixture = uiFixture(t), calls = [];
    if (warm) fixture.tools();
    else fs.mkdirSync(path.join(fixture.ui, 'node_modules'));
    const result = await buildUi({ uiDir: fixture.ui }, {
      underHostLock: async (options, run) => ({ ok: true, value: await run() }),
      ci: async () => { calls.push('ci'); fixture.tools(); return { ok: true, status: 0 }; },
      npm: () => { calls.push('build'); return { status: 0 }; },
    });
    assert.equal(result.ok, true);
    assert.deepEqual(calls, warm ? ['build'] : ['ci', 'build']);
  }
});

test('failed, unknown or incomplete UI installation cannot reach build or report ready', async (t) => {
  for (const outcome of [{ ok: false, status: 1, stderr: 'fixture install refusal' }, undefined, { ok: true, status: 0 }, new Error('fixture install failed')]) {
    const fixture = uiFixture(t);
    let builds = 0;
    const result = await buildUi({ uiDir: fixture.ui }, {
      underHostLock: async (options, run) => ({ ok: true, value: await run() }),
      ci: async () => { if (outcome instanceof Error) throw outcome; return outcome; },
      npm: () => { builds++; return { status: 0 }; },
    });
    assert.equal(result.ok, false);
    assert.equal(builds, 0);
    assert.ok(fs.existsSync(path.join(fixture.ui, 'package-lock.json')), 'a refused runtime bootstrap retains its package tree');
  }
});

test('UI installation that changes a manifest is red even with a zero npm receipt', async (t) => {
  const fixture = uiFixture(t);
  let builds = 0;
  const result = await buildUi({ uiDir: fixture.ui }, {
    underHostLock: async (options, run) => ({ ok: true, value: await run() }),
    ci: async () => { fixture.tools(); fs.appendFileSync(path.join(fixture.ui, 'package-lock.json'), 'changed'); return { ok: true, status: 0 }; },
    npm: () => { builds++; return { status: 0 }; },
  });
  assert.equal(result.ok, false);
  assert.match(result.output, /changed a manifest or lockfile/);
  assert.equal(builds, 0);
});

test('linked UI ancestors, node_modules and tool directories cannot borrow a toolchain or trigger install/build', async (t) => {
  for (const kind of ['ancestor', 'node_modules', 'tool']) {
    const fixture = uiFixture(t), borrowed = path.join(fixture.root, 'borrowed');
    fs.mkdirSync(borrowed);
    let uiDir = fixture.ui;
    if (kind === 'ancestor') {
      const alias = path.join(fixture.root, 'alias');
      fs.symlinkSync(fixture.root, alias, process.platform === 'win32' ? 'junction' : 'dir');
      uiDir = path.join(alias, 'ui');
    } else if (kind === 'node_modules') {
      fs.symlinkSync(borrowed, path.join(fixture.ui, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    } else {
      fs.mkdirSync(path.join(fixture.ui, 'node_modules'));
      fs.symlinkSync(borrowed, path.join(fixture.ui, 'node_modules', 'vite'), process.platform === 'win32' ? 'junction' : 'dir');
    }
    const calls = [];
    const result = await buildUi({ uiDir }, {
      underHostLock: async (options, run) => ({ ok: true, value: await run() }),
      ci: () => { calls.push('ci'); return { ok: true, status: 0 }; },
      npm: () => { calls.push('build'); return { status: 0 }; },
    });
    assert.equal(result.ok, false);
    assert.deepEqual(calls, [], 'no install may traverse an existing linked tool directory');
  }
});

test('a held host lock refuses UI work and a failed awaited build blocks subsequent host activation', async () => {
  const calls = [], env = { STARCI_UI_BOOTSTRAP_PROBE: 'private-fixture' };
  const held = await buildUi({ env }, {
    underHostLock: async () => ({ ok: false, reason: 'held' }),
    ci: () => { calls.push('ci'); }, npm: () => { calls.push('build'); },
  });
  assert.equal(held.ok, false);
  assert.match(held.output, /host lock refused.*held/);
  const applied = await applyHost({ env, waitMs: 0, workflowSeats: false }, {
    uiBuildState: () => ({ stale: true, reason: 'cold fixture' }),
    buildUi: async (options) => { assert.equal(options.env, env); await Promise.resolve(); calls.push('build-failed'); return { ok: false, output: 'fixture ci red' }; },
    leaderState: () => { calls.push('engine'); }, probeServices: () => { calls.push('services'); },
    probeOrcaAsync: () => { calls.push('seats'); },
  });
  assert.deepEqual(calls, ['build-failed']);
  assert.deepEqual(applied, ['ui build FAILED: fixture ci red']);
});

test('host apply keeps Supervisor but excludes Kernel watchdogs during workflow ingress', async () => {
  const calls = [];
  const deps = { leaderState: () => ({ fresh: true }), reconcilerNumbers: () => NUMBERS, crashLoopRecord: () => ({ starts: [] }),
    status: () => ({ modes: {} }), probeServices: async () => [], probeOrcaAsync: async () => ({ ok: true }),
    loadConfig: () => ({}), supervisorMode: () => 'kernel', json: async () => { calls.push('supervisor'); return { ok: true, action: 'already-live' }; },
    kernelSeatItems: async () => { calls.push('kernel'); return []; } };
  await applyHost({ noBuild: true, waitMs: 0, workflowSeats: false }, deps);
  assert.deepEqual(calls, ['supervisor']);
  calls.length = 0;
  await applyHost({ noBuild: true, waitMs: 0, workflowSeats: true }, deps);
  assert.deepEqual(calls, ['supervisor', 'kernel']);
});

test('host readiness blocks preflight before effects and applies a down host without Kernel recursion', async () => {
  let effects = 0;
  const red = { group: 'preflight', id: 'machine-db', required: true, status: 'red' };
  const failed = await ensureHostRuntime({ waitMs: 0 }, { gather: async () => [red], applyHost: async () => { effects++; } });
  assert.equal(failed.ok, false);
  assert.equal(effects, 0);
  const seen = [];
  let applied = false;
  const result = await ensureHostRuntime({ waitMs: 0 }, { gather: async (options) => { seen.push(options); return [{ group: 'engine', required: true, status: applied ? 'green' : 'red' }]; },
    applyHost: async (options) => { assert.equal(options.workflowSeats, false); effects++; applied = true; return ['engine started']; } });
  assert.equal(result.ok, true);
  assert.equal(effects, 1);
  assert.ok(seen.every((options) => options.workflowSeats === false && options.coreDebug === false));
});

test('explicit profile repair and stale-ledger retirement retain their effects on an otherwise healthy host', async () => {
  for (const option of [{ setProfile: 'operational' }, { retire: true }]) {
    let effects = 0;
    const result = await ensureHostRuntime({ waitMs: 0, ...option }, { gather: async () => [],
      applyHost: async (input) => { assert.equal(input.setProfile ?? input.retire, option.setProfile ?? option.retire); effects++; return ['explicit update']; } });
    assert.equal(result.ok, true);
    assert.equal(effects, 1);
  }
  let effects = 0;
  const profile = { group: 'config', id: 'profile', required: true, status: 'red' };
  const deps = { gather: async () => effects ? [] : [profile], applyHost: async () => { effects++; return ['profile repaired']; } };
  assert.equal((await ensureHostRuntime({ waitMs: 0, setProfile: 'operational' }, deps)).ok, true);
  assert.equal(effects, 1);
  effects = 0;
  deps.gather = async () => [profile, { group: 'preflight', id: 'machine-db', required: true, status: 'red' }];
  assert.equal((await ensureHostRuntime({ waitMs: 0, setProfile: 'operational' }, deps)).ok, false);
  assert.equal(effects, 0, 'explicit profile repair cannot bypass another prerequisite');
});

test('preflight: SQLite version, temp and missing ledgers, a model pin the launch cannot honour', () => {
  assert.ok(cmpVersion('3.51.3', '3.51.3') === 0 && cmpVersion('3.50.9', '3.51.3') < 0 && cmpVersion('3.53.4', '3.51.3') > 0);
  assert.equal(sqliteItem('3.51.2').status, 'red');
  assert.equal(sqliteItem('3.53.4').status, 'green');
  const tmp = path.join(os.tmpdir(), 'starci-boot-spec'), home = path.join(path.resolve(import.meta.dirname, '..', '..'), 'no-such-ledger-dir');
  const ledgerAt = (dir, name) => path.join(dir, name);
  const gone = ledgerAt(home, 'gone.sqlite'), ok = ledgerAt(home, 'ok.sqlite'), gone2 = ledgerAt(home, 'gone2.sqlite'), inTemp = path.join(tmp, 'prereq-dbg', 'runtime.sqlite');
  assert.equal(isTempLedger(inTemp, { tmp }), true);
  const found = ledgerFindings([
    { ledgerId: 'a', name: 'a', file: inTemp },
    { ledgerId: 'b', name: 'b', file: gone }, { ledgerId: 'c', name: 'c', file: ok }, { ledgerId: 'd', name: 'd', file: gone2, state: 'retired' },
  ], { exists: (f) => f === ok, tmp });
  assert.deepEqual(found.map((f) => `${f.ledgerId}:${f.problem}`), ['a:temp', 'b:missing-file']);
  const repos = ledgerFindings([{ ledgerId: 'e', name: 'e', file: ok, repoRoot: path.join(home, 'gone-repo') }, { ledgerId: 'f', name: 'f', file: ok, repoRoot: ok }], { exists: (f) => f === ok, tmp });
  assert.deepEqual(repos.map((f) => `${f.ledgerId}:${f.problem}`), ['e:missing-repo']);
  const integrity = ledgerIntegrity([{ name: 'c', file: ok }, { name: 'x', file: gone }, { name: 'r', file: ok, state: 'retired' }, { name: 'bad', file: 'bad.sqlite' }],
    { exists: (f) => f !== gone, check: (f) => (f === 'bad.sqlite' ? { ok: false, result: ['page 3 corrupt'] } : { ok: true, result: ['ok'] }) });
  assert.deepEqual(integrity, { bad: [{ name: 'bad', result: 'page 3 corrupt' }], checked: 2 });
  // A pinned model is launched with worker-start --model and attested from worker-show: only an agent that takes no
  // --model (devin: start.modelArgument false) or has no card cannot honour a pin.
  const card = (agent) => ({ claude: { start: { api: 'orchestration.worker-start' } }, devin: { start: { api: 'orchestration.worker-start', modelArgument: false } } }[agent] ?? null);
  const bad = pinProblems([{ where: 'kernel', agent: 'devin', model: 'swe-2-max' }, { where: 'k2', agent: 'claude', model: 'claude-opus-5-5' },
    { where: 'k3', agent: 'devin', model: null }, { where: 'k4', agent: 'no-card-agent', model: 'q' }], { card });
  assert.deepEqual(bad.map((b) => b.where), ['kernel', 'k4']);
});

test('the checklist is red when a needed controller is shadow or the engine is safe, and exits green only when every required row is', () => {
  const status = (modes, extra = {}) => ({ leader: { fresh: true, holder: 'h', pid: 1, epoch: 1, ageMs: 1000, safe: false, draining: false, ...extra }, modes, violations: { open: 0, clocks: 0 } });
  const all = (mode) => Object.fromEntries(['job', 'host', 'gc', 'resource', 'workflow', 'workers', 'learning'].map((n) => [n, { configured: mode, effective: mode }]));
  assert.equal(summarize(engineItems(status(all('shadow')))).ok, false);
  assert.equal(summarize(engineItems(status({ ...all('active'), gc: { configured: 'shadow', effective: 'shadow' }, workers: { configured: 'shadow', effective: 'shadow' }, learning: { configured: 'shadow', effective: 'shadow' } }))).ok, true);
  assert.equal(summarize(engineItems(status(all('active'), { safe: true }))).ok, false);
});
