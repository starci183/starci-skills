// release-schedule.spec.mjs - the order the L4 rows of a release cut run in (release-l4-schedule.mjs, release-l4-graph.mjs, runL4): parity from the start and beside everything, the root rows
// alone with the machine, the example apps' chains and their Sonar proofs together once the suite has ended, a red row never cancelling another, the host bounding the chains.
// The step runner is injected: each fake step takes a few milliseconds and the events record when it started and ended.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appChainLimit, once, runGraph, scheduleSettings } from '../../scripts/supervisor/release-l4-schedule.mjs';
import { planL4, runL4 } from '../../scripts/supervisor/release-l4.mjs';
import { prepareSelect } from '../../scripts/supervisor/release-l4-offload.mjs';

const NODE_TEST = 'node --import ./tests/setup/low-priority.mjs --test "tests/**/*.spec.mjs"';
const GIB = 1024 ** 3;
const roomy = { logicalThreads: 32, cpuBusy: 0, totalRamBytes: 64 * GIB, freeRamBytes: 60 * GIB };
const pause = (ms = 8) => new Promise((resolve) => { setTimeout(resolve, ms); });
const tmp = (t) => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-l4-schedule-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  return dir;
};

test('runGraph: a row waits for the rows it follows, a pool never holds more rows than its size, and every result is returned by id', async () => {
  const events = [];
  let live = 0, peak = 0;
  const row = (id, pool, after = []) => ({ id, pool, after, run: async () => { live += 1; peak = Math.max(peak, live); events.push(`start ${id}`); await pause(); events.push(`end ${id}`); live -= 1; return id.toUpperCase(); } });
  const results = await runGraph([row('a', 'p'), row('b', 'p'), row('c', 'p'), row('d', 'q', ['a', 'b', 'c'])], { p: 2, q: 1 });
  assert.equal(peak, 2, 'pool p runs two rows together, never three');
  assert.deepEqual([...results.entries()].sort(), [['a', 'A'], ['b', 'B'], ['c', 'C'], ['d', 'D']]);
  assert.ok(events.indexOf('start d') > Math.max(events.indexOf('end a'), events.indexOf('end b'), events.indexOf('end c')), 'd starts after all three ended');
});

test('runGraph: a red result is a result and cancels nothing; a row that throws starts nothing new, lets the running rows finish and raises the first error', async () => {
  const ran = [];
  const make = (id, after, work) => ({ id, pool: 'p', after, run: async () => { ran.push(id); await pause(); return work(); } });
  const red = await runGraph([make('a', [], () => ({ ok: false })), make('b', ['a'], () => ({ ok: true })), make('c', [], () => ({ ok: true }))], { p: 4 });
  assert.deepEqual(ran.sort(), ['a', 'b', 'c'], 'the rows after a red row still ran');
  assert.deepEqual(red.get('a'), { ok: false });
  ran.length = 0;
  let finished = false;
  const rows = [
    make('boom', [], () => { throw new Error('step blew up'); }),
    { id: 'slow', pool: 'p', after: [], run: async () => { ran.push('slow'); await pause(40); finished = true; } },
    make('later', ['boom'], () => 1),
  ];
  await assert.rejects(() => runGraph(rows, { p: 4 }), /step blew up/);
  assert.equal(finished, true, 'the running row settled before the error was raised');
  assert.ok(!ran.includes('later'), 'nothing new started after the throw');
});

test('runGraph refuses a graph that could never finish: an unknown row to wait for, a pool without a size, a row listed twice', () => {
  assert.throws(() => runGraph([{ id: 'a', pool: 'p', after: ['ghost'], run: () => 1 }], { p: 1 }), /ghost/);
  assert.throws(() => runGraph([{ id: 'a', pool: 'nope', after: [], run: () => 1 }], { p: 1 }), /no size/);
  assert.throws(() => runGraph([{ id: 'a', pool: 'p', after: [], run: () => 1 }, { id: 'a', pool: 'p', after: [], run: () => 1 }], { p: 1 }), /twice/);
});

test('once decides on its first call; appChainLimit is the declared pool lowered to the free threads and RAM and never below one', () => {
  let calls = 0;
  const first = once(() => { calls += 1; return calls; });
  assert.deepEqual([first(), first()], [1, 1]);
  const settings = scheduleSettings();
  assert.equal(settings.pools.apps, 3);
  assert.equal(appChainLimit({ settings, deps: { hostSample: () => roomy } }), 3, 'a roomy host runs the declared three');
  assert.equal(appChainLimit({ settings, deps: { hostSample: () => ({ ...roomy, logicalThreads: 8 }) } }), 2, 'eight threads at three per chain give two');
  assert.equal(appChainLimit({ settings, deps: { hostSample: () => ({ ...roomy, freeRamBytes: 10 * GIB }) } }), 1, 'RAM above the reserve gives one');
  assert.equal(appChainLimit({ settings, deps: { hostSample: () => ({ ...roomy, cpuBusy: 1 }) } }), 1, 'a busy host still runs one');
  assert.equal(appChainLimit({ settings, deps: { hostSample: () => { throw new Error('no probe'); } } }), 1, 'no probe, one');
  assert.equal(appChainLimit({ settings, deps: { hostSample: () => ({}) } }), 1);
});

test('the parity spec leg prepares with the workflow steps before the first one that runs the declared marker', () => {
  const steps = [{ run: 'npm ci' }, { run: 'npm run build' }, { run: 'npm run check' }, { run: 'npm run other' }];
  const select = prepareSelect('npm run check');
  assert.deepEqual(steps.filter((s, i, all) => select(s, i, all)).map((s) => s.run), ['npm ci', 'npm run build']);
  const none = prepareSelect('absent marker');
  assert.equal(steps.filter((s, i, all) => none(s, i, all)).length, 4, 'with no marker every step prepares');
});

/** A checkout with the runtime scripts and three example apps; `plan` is its L4 plan. */
function checkout(t) {
  const base = tmp(t);
  fs.writeFileSync(path.join(base, 'package.json'), JSON.stringify({ name: 'rt', scripts: { test: NODE_TEST, check: 'x' } }));
  for (const name of ['aa', 'bb', 'cc']) {
    const dir = path.join(base, 'examples', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'hfs.json'), JSON.stringify({ kind: 'app', edition: 'lite' }));
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name, scripts: Object.fromEntries(['codegen', 'typecheck', 'lint', 'format:check', 'build:be', 'build:fe', 'docker:build'].map((s) => [s, 'x'])) }));
    fs.writeFileSync(path.join(dir, 'package-lock.json'), '{}');
  }
  return { base, plan: planL4(base, { runtimeRoot: base }) };
}

/** Run the plan with timed fake steps; returns {events, out}. `fail` names the rows that come back red; `proofs` start/end are recorded the same way. */
async function timeline(t, { fail = [], extra = {} } = {}) {
  const { base, plan } = checkout(t);
  const events = [];
  const timed = (name, ok = true) => async () => { events.push(`start ${name}`); await pause(); events.push(`end ${name}`); return { ok, log: `${name}.log`, ms: 1, text: '' }; };
  const out = await runL4(base, {
    plan, unlink: () => true,
    concurrencyDeps: { hostSample: () => roomy },
    step: (s) => timed(s.cmd === 'node' ? 'npm test' : s.name, !fail.includes(s.cmd === 'node' ? 'npm test' : s.name))(),
    proofs: Object.fromEntries(['aa', 'bb', 'cc'].map((app) => [`${app}: sonar`, async () => { const r = await timed(`${app}: sonar`, !fail.includes(`${app}: sonar`))(); return { ok: r.ok, log: r.log, ms: 1 }; }])),
    parity: async (repo, deps) => { const name = deps.prepareOnly ? 'linux-specs' : 'linux-parity'; await timed(name)(); return { name: 'linux-parity', ok: true, log: null, ms: 1, skips: [] }; },
    ...extra,
  });
  return { events, out };
}
const at = (events, event) => events.indexOf(event);

test('L4 order: parity starts with the installs and runs beside the suite; the example apps wait for the suite and then run together, each app in order; the proofs run together after their app', async (t) => {
  const { events, out } = await timeline(t);
  assert.ok(at(events, 'start linux-parity') >= 0 && at(events, 'start linux-parity') < at(events, 'end npm test'), 'parity runs beside the suite');
  assert.ok(at(events, 'start linux-parity') < at(events, 'end aa: npm ci'), 'and it starts with the installs, not after them');
  for (const app of ['aa', 'bb', 'cc']) {
    assert.ok(at(events, `start ${app}: npm run codegen`) > at(events, 'end npm test'), `${app} waits for the suite`);
    assert.ok(at(events, `start ${app}: npm run codegen`) > at(events, 'end aa: npm ci'), 'and for the installs');
    const chain = ['codegen', 'typecheck', 'lint', 'format:check', 'build:be', 'build:fe', 'docker:build'].map((s) => at(events, `end ${app}: npm run ${s}`));
    assert.deepEqual([...chain].sort((a, b) => a - b), chain, `${app}'s own rows stay in order`);
    assert.ok(at(events, `start ${app}: sonar`) > chain.at(-1), `${app}'s proof follows its rows`);
  }
  const firstEnds = Math.min(...['aa', 'bb', 'cc'].map((app) => at(events, `end ${app}: npm run codegen`)));
  assert.ok(['aa', 'bb', 'cc'].every((app) => at(events, `start ${app}: npm run codegen`) < firstEnds), 'the three chains start together');
  const firstSonarEnd = Math.min(...['aa', 'bb', 'cc'].map((app) => at(events, `end ${app}: sonar`)));
  assert.ok(['aa', 'bb', 'cc'].every((app) => at(events, `start ${app}: sonar`) < firstSonarEnd), 'the three proofs run together');
  assert.ok(at(events, 'start npm run test:packages') > at(events, 'end npm test'), 'the root rows stay one after another');
  assert.ok(at(events, 'start npm run check') > at(events, 'end npm run test:packages'));
  assert.deepEqual(out.map((row) => row.name).slice(0, 4), ['aa: npm ci', 'bb: npm ci', 'cc: npm ci', 'npm test'], 'the result is in plan order, not finish order');
  assert.equal(out.at(-1).name, 'linux-parity');
  assert.ok(out.every((row) => row.ok));
});

test('L4 order: a red row cancels nothing - every other row of the run still runs and the result lists each red row', async (t) => {
  const { events, out } = await timeline(t, { fail: ['npm test', 'bb: npm run lint', 'cc: sonar'] });
  assert.deepEqual(out.filter((row) => !row.ok).map((row) => row.name), ['npm test', 'bb: npm run lint', 'cc: sonar']);
  assert.ok(at(events, 'end bb: npm run docker:build') > at(events, 'end bb: npm run lint'), 'bb went on after its red lint');
  assert.ok(at(events, 'end npm run check') > 0 && at(events, 'end aa: sonar') > 0 && at(events, 'end linux-parity') > 0, 'the checks, a proof and parity ran after the red suite');
  assert.equal(out.length, 3 + 21 + 3 + 3 + 1, 'every row of the plan has its result');
});

test('L4 order: the host bounds the app chains - one at a time on a starved host, each chain still in order', async (t) => {
  const { events, out } = await timeline(t, { extra: { concurrencyDeps: { hostSample: () => ({ ...roomy, freeRamBytes: 8 * GIB }) } } });
  const startOf = (app) => at(events, `start ${app}: npm run codegen`);
  const endOf = (app) => at(events, `end ${app}: npm run docker:build`);
  const [first, second] = ['aa', 'bb', 'cc'].sort((a, b) => startOf(a) - startOf(b));
  assert.ok(endOf(first) < startOf(second), 'with one place the next chain starts only when the running one ended');
  assert.ok(out.every((row) => row.ok));
});

test('L4 order: a row that throws raises its error after the running rows settled, the supplier is put back, and a carried row stands in without running', async (t) => {
  const { base, plan } = checkout(t);
  let closed = 0;
  const supplier = { proofs: {}, close: () => { closed += 1; } };
  await assert.rejects(() => runL4(base, { plan, supplier, unlink: () => true, parity: null, concurrencyDeps: { hostSample: () => roomy }, step: async (s) => { if (s.name === 'aa: npm ci') throw new Error('install blew up'); await pause(); return { ok: true, log: 'x', ms: 1, text: '' }; } }), /install blew up/);
  assert.equal(closed, 1);
  const ran = [];
  const carried = { name: 'aa: npm run lint', ok: true, log: 'old.log', ms: 9, skips: [], reusedFrom: 'b'.repeat(40) };
  const out = await runL4(base, { plan, supplier, unlink: () => true, parity: null, carry: { 'aa: npm run lint': carried }, concurrencyDeps: { hostSample: () => roomy }, step: async (s) => { ran.push(s.name); return { ok: true, log: 'x', ms: 1, text: '' }; } });
  assert.ok(!ran.includes('aa: npm run lint'), 'the carried row did not run');
  assert.deepEqual(out.find((row) => row.name === 'aa: npm run lint'), carried, 'its recorded result stands in, with the commit that proved it');
  assert.ok(ran.includes('bb: npm run lint'));
});
