// `starci runtime deploy`: every refusal, the happy path of a multi-commit tip against a real temporary host repository with a fake engine seam, the failures after
// the fast-forward (named state, non-destructive way back), and the in-flight invariant over the real marks of the engine and the settler.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runtimeDeploy } from '../../scripts/reconciler/runtime-deploy.mjs';
import { inFlightSteps } from '../../scripts/reconciler/runtime-deploy-inflight.mjs';
import { writeReceipt, receiptFile } from '../../scripts/reconciler/runtime-deploy-receipt.mjs';
import { areaOf, areasOf } from '../../scripts/reconciler/runtime-deploy-source.mjs';
import { acquireHostLock, releaseHostLock } from '../../scripts/machine/host-lock.mjs';
import { openPreparedOf } from '../../scripts/kernel/settle/prepared-recovery.mjs';
import { readMachine } from '../../engine/db/machine.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { makeTempDir } from '../../scripts/api/fs/make-temp-dir.mjs';
import { tempState } from '../../scripts/reconciler/testing.mjs';
import { withLedger } from '../helpers/ledger-fixture.mjs';

const git = (cwd, ...args) => {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
const commit = (dir, rel, text, message) => { write(dir, rel, text); git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', message); return git(dir, 'rev-parse', 'HEAD'); };
const catalog = parseYaml(fs.readFileSync(path.join(skillRoot, 'modules', 'kernel', 'failure-codes.yaml'), 'utf8'));
const NUMBERS = { waitMs: 400, pollMs: 5, verifyMs: 100 };

/** A host repository on main and a clone of it three commits ahead; a state directory (receipts, host lock, machine store) of its own. */
function world(t) {
  const state = tempState('starci-deploy-');
  const root = makeTempDir('starci-deploy-world-');
  t.after(() => { state.close(); fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 }); });
  const host = path.join(root, 'host'), clone = path.join(root, 'clone');
  fs.mkdirSync(host);
  git(host, 'init', '-q', '-b', 'main');
  commit(host, 'scripts/kernel/a.mjs', 'export const a = 1;\n', 'base');
  git(root, 'clone', '-q', host, clone);
  const tip = ['scripts/kernel/a.mjs', 'modules/kernel/b.yaml', 'docs/c.md'].map((rel, i) => commit(clone, rel, `v${i + 2}\n`, `change ${i}`)).at(-1);
  const engine = fakeEngine(host);
  return { state, root, host, clone, tip, base: git(host, 'rev-parse', 'HEAD'), engine, env: state.env };
}

/** The engine as the verb sees it through its seams: a leader row that a restart replaces, controllers with modes, seats. */
function fakeEngine(host) {
  const e = { pid: 100, epoch: 1, rev: 'old', heartbeatAt: 0, restarts: 0, order: [], modes: { job: 'active', workflow: 'active' }, seats: { 'kernel:a': 'live', supervisor: 'live' },
    restartResult: { status: 0, data: { ok: true } }, migrateResult: { status: 0, data: { ok: true, counts: { migrated: 2, current: 5 } } }, afterRestart: () => {} };
  e.leader = () => ({ fresh: true, pid: e.pid, epoch: e.epoch, rev: e.rev, heartbeatAt: e.heartbeatAt, runId: null });
  e.snapshot = () => ({ leader: e.leader(), after: { pid: e.pid, epoch: e.epoch, rev: e.rev, modes: { ...e.modes }, seats: { ...e.seats } } });
  e.restart = () => {
    e.order.push('restart');
    if (e.restartResult.status !== 0) return e.restartResult;
    e.restarts += 1; e.pid += 1; e.epoch += 1; e.rev = git(host, 'rev-parse', 'HEAD'); e.heartbeatAt = Date.now() + 1;
    e.afterRestart(e);
    return e.restartResult;
  };
  e.migrate = () => { e.order.push(`migrate@${git(host, 'rev-parse', 'HEAD').slice(0, 7)}`); return e.migrateResult; };
  return e;
}

const seamsOf = (w, extra = {}) => ({ lockOwner: () => null, leader: w.engine.leader, inFlight: () => [], snapshot: w.engine.snapshot, runCheck: () => ({ ok: true, pass: 3, total: 3 }),
  migrate: w.engine.migrate, restart: w.engine.restart, roleActions: () => null, runAffected: affectedGreen, provenAffected: () => null, planAffected: () => ({ status: 0, data: { scope: ['tests/a.spec.mjs', 'tests/b.spec.mjs', 'tests/c.spec.mjs'] } }),
  affectedBudgetMs: () => 2_400_000, ...extra });

/** The answer of `starci test affected --run --json` in the source clone: a receipt on its tip, every file passed. */
const affectedReceipt = (dir, base, over = {}) => ({ schema: 'starci/affected-receipt@1', base, tip: git(dir, 'rev-parse', 'HEAD'), clean: true, files: 3, passed: 3, total: 3, ok: true, ms: 10, budgetMs: 2_400_000, concurrency: 2, ...over });
const affectedRun = (receipt, over = {}) => ({ exit: { exited: true, code: 0, signal: null, timedOut: false }, receipt, answer: {}, tail: [], red: [], unfinished: [], ...over });
const affectedGreen = (dir, base) => affectedRun(affectedReceipt(dir, base));
const run = (w, args, { seams = {}, ...deps } = {}) => runtimeDeploy({ args, positionals: [], env: w.env, role: 'owner' }, { root: w.host, numbers: NUMBERS, seams: seamsOf(w, seams), sleep: async () => {}, ...deps });
const events = (w, kind) => readMachine((m) => m.supEvents({ kind, entityType: 'runtime' }), [], { env: w.env });
const headOf = (dir) => git(dir, 'rev-parse', 'HEAD');

test('--plan prints every step and changes nothing: no fast-forward, no check, no restart, no receipt, no event', async (t) => {
  const w = world(t);
  let checked = 0;
  const out = await run(w, { from: w.clone, plan: true }, { seams: { runCheck: () => { checked += 1; return { ok: true }; } } });
  assert.equal(out.code, 0, out.text);
  assert.equal(out.data.mode, 'plan');
  assert.equal(out.data.steps.length, 8);
  assert.match(out.text, /ONE revision change/);
  assert.equal(out.data.commits, 3);
  assert.deepEqual(out.data.areas, { docs: 1, 'modules/kernel': 1, 'scripts/kernel': 1 });
  assert.equal(headOf(w.host), w.base);
  assert.equal(checked + w.engine.restarts, 0);
  assert.equal(fs.existsSync(receiptFile(w.tip, w.env)), false);
  assert.equal(events(w, 'runtime-deployed').length, 0);
});

const REFUSALS = [
  ['deploy-source-unresolved', (w) => ({ from: path.join(w.root, 'nowhere') })],
  ['deploy-source-dirty', (w) => { write(w.clone, 'loose.txt', 'x'); return { from: w.clone }; }],
  ['deploy-host-dirty', (w) => { write(w.host, 'scripts/kernel/a.mjs', 'hand edit\n'); return { from: w.clone }; }],
  ['deploy-host-not-main', (w) => { git(w.host, 'checkout', '-q', '-b', 'other'); return { from: w.clone }; }],
  ['deploy-not-fast-forward', (w) => { commit(w.host, 'docs/host-only.md', 'h\n', 'host moves'); return { from: w.clone }; }],
  ['deploy-check-red', (w) => ({ from: w.clone, seams: { runCheck: () => ({ ok: false, output: 'RT_TIER_DIRECTION scripts/x.mjs' }) } })],
  ['deploy-check-unproven', (w) => { git(w.host, 'fetch', '-q', w.clone, 'HEAD:refs/heads/cand'); return { from: 'cand' }; }],
  ['deploy-affected-red', (w) => ({ from: w.clone, seams: { runAffected: (dir, base) => affectedRun(affectedReceipt(dir, base, { ok: false, passed: 2 }), { exit: { exited: true, code: 1, signal: null, timedOut: false }, red: ['tests/b.spec.mjs'] }) } })],
  ['deploy-release-cut-running', (w) => ({ from: w.clone, seams: { lockOwner: () => ({ purpose: 'release-cut', pid: 4, since: 'now', stale: false }) } })],
  ['deploy-host-lock-held', (w) => ({ from: w.clone, seams: { lockOwner: () => ({ purpose: 'land', pid: 4, since: 'now', stale: false }) } })],
];
for (const [code, arrange] of REFUSALS) {
  test(`refuses ${code}: nothing changes, the code is catalogued, --plan names the same refusal (the red check and the red specs are found only by running them)`, async (t) => {
    const w = world(t);
    const { from, seams } = arrange(w);
    const before = headOf(w.host);
    const out = await run(w, { from }, { seams });
    assert.equal(out.code, 1, out.text);
    assert.equal(out.data.refusals[0].code, code);
    assert.ok(catalog[code], `${code} is in modules/kernel/failure-codes.yaml`);
    assert.equal(headOf(w.host), before, 'the host tree did not move');
    assert.equal(w.engine.restarts, 0);
    assert.equal(events(w, 'runtime-deployed').length, 0);
    if (code === 'deploy-check-red' || code === 'deploy-affected-red') return;
    const plan = await run(w, { from, plan: true }, { seams });
    assert.equal(plan.data.refusals[0].code, code, 'the plan lists the same refusal');
  });
}

test('a release cut that really holds the host lock refuses the deploy by name, read from the lock owner file', async (t) => {
  const w = world(t);
  const lock = acquireHostLock({ role: 'release', purpose: 'release-cut', env: w.env });
  t.after(() => releaseHostLock({ token: lock.token ?? lock.owner?.token, env: w.env }));
  const seams = seamsOf(w);
  delete seams.lockOwner;
  const out = await runtimeDeploy({ args: { from: w.clone }, positionals: [], env: w.env, role: 'owner' }, { root: w.host, numbers: NUMBERS, seams, sleep: async () => {} });
  assert.equal(out.data.refusals[0].code, 'deploy-release-cut-running');
  assert.equal(headOf(w.host), w.base);
});

test('steps in flight that do not finish refuse the deploy and stop none of them', async (t) => {
  const w = world(t);
  const step = { kind: 'engine-action', controller: 'job', key: 'job:settle:j1', verb: 'settle' };
  const out = await run(w, { from: w.clone }, { seams: { inFlight: () => [step] } });
  assert.equal(out.data.refusals[0].code, 'deploy-in-flight');
  assert.match(out.text, /none was stopped/);
  assert.equal(headOf(w.host), w.base);
  assert.equal(w.engine.restarts, 0);
});

test('the happy path: a tip three commits ahead is ONE revision change, checked, fast-forwarded, migrated from the new tree, restarted once, verified, journalled once', async (t) => {
  const w = world(t);
  const out = await run(w, { from: w.clone }, { roleActions: ({ files }) => ({ engine: files.length ? 'restart' : 'none' }) });
  assert.equal(out.code, 0, out.text);
  assert.equal(headOf(w.host), w.tip, 'the host tree is the source tip');
  assert.deepEqual(w.engine.order, [`migrate@${w.tip.slice(0, 7)}`, 'restart'], 'the migration ran from the new tree, before the one restart');
  assert.equal(w.engine.restarts, 1, 'three commits are one restart');
  const [event] = events(w, 'runtime-deployed');
  assert.equal(events(w, 'runtime-deployed').length, 1, 'one event for the deploy, not one per commit');
  const p = event.payload;
  assert.deepEqual([p.from, p.to, p.commits, p.fileCount, p.receipt], [w.base, w.tip, 3, 3, 'check-run']);
  assert.deepEqual(p.areas, { docs: 1, 'modules/kernel': 1, 'scripts/kernel': 1 });
  assert.equal(p.engine.rev, w.tip);
  assert.ok(p.who.user, 'who is recorded');
  assert.deepEqual(p.roleActions, { engine: 'restart' }, 'the field the role notification reads');
  const bare = world(t);
  assert.equal((await run(bare, { from: bare.clone })).code, 0);
  assert.equal(events(bare, 'runtime-deployed')[0].payload.roleActions, null, 'a new tree without the verb leaves the field null');
  assert.ok(Buffer.byteLength(JSON.stringify(p)) < 4096, 'the payload is small');
  assert.deepEqual([...p.files].sort(), ['docs/c.md', 'modules/kernel/b.yaml', 'scripts/kernel/a.mjs']);
  assert.equal(fs.existsSync(receiptFile(w.tip, w.env)), true, 'the verb wrote the receipt after running the check itself');
});

test('the check receipt binds the exact commit and tree: the verb reuses its own receipt and ignores a forged one', async (t) => {
  const w = world(t);
  let checks = 0;
  const seams = { runCheck: () => { checks += 1; return { ok: true, pass: 1, total: 1 }; } };
  writeReceipt({ sha: w.tip, tree: 'f'.repeat(40), exit: 0 }, w.env);
  assert.equal((await run(w, { from: w.clone, plan: true }, { seams })).data.steps[0].startsWith('run starci runtime check'), true, 'a receipt for another tree proves nothing');
  const file = receiptFile(w.tip, w.env);
  const forged = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(file, JSON.stringify({ ...forged, tree: git(w.clone, 'rev-parse', `${w.tip}^{tree}`) }));
  assert.equal((await run(w, { from: w.clone, plan: true }, { seams })).data.steps[0].startsWith('run starci runtime check'), true, 'a receipt edited by hand fails its digest');
  const tree = git(w.clone, 'rev-parse', `${w.tip}^{tree}`);
  writeReceipt({ sha: w.tip, tree, exit: 0, affected: { base: 'f'.repeat(40), tip: w.tip, passed: 1, total: 1 } }, w.env);
  assert.equal((await run(w, { from: w.clone, plan: true }, { seams })).data.steps[0].startsWith('run starci runtime check'), true, 'a receipt proven against another host head proves nothing for this one');
  writeReceipt({ sha: w.tip, tree, exit: 0, affected: { base: w.base, tip: w.tip, passed: 1, total: 1 } }, w.env);
  const out = await run(w, { from: w.clone }, { seams });
  assert.equal(out.code, 0, out.text);
  assert.equal(checks, 0, 'a valid receipt is not run again');
});

test('a check that leaves the source tree changed does not produce a receipt', async (t) => {
  const w = world(t);
  const out = await run(w, { from: w.clone }, { seams: { runCheck: () => { write(w.clone, 'generated.txt', 'x'); return { ok: true }; } } });
  assert.equal(out.data.refusals[0].code, 'deploy-source-dirty');
  assert.equal(fs.existsSync(receiptFile(w.tip, w.env)), false);
});

test('failures after the fast-forward name the host state and the non-destructive way back, and never reset anything', async (t) => {
  const w = world(t);
  w.engine.migrateResult = { status: 1, data: { ok: false, counts: { refused: 1 } } };
  const migration = await run(w, { from: w.clone });
  assert.equal(migration.data.refusals[0].code, 'deploy-artefact-migration-failed');
  assert.deepEqual(migration.data.state, { treeAt: w.tip, moved: true, migrated: false, restarted: false });
  assert.equal(w.engine.restarts, 0, 'the engine is not restarted over a stale artefact');
  assert.match(migration.text, new RegExp(`git -C .* revert --no-edit ${w.base}\\.\\.${w.tip}`));
  assert.match(migration.text, new RegExp(`previous revision is ${w.base}`));
  assert.equal(headOf(w.host), w.tip, 'the host is where the text says; history is intact');
  assert.equal(events(w, 'runtime-deploy-failed').length, 1);
});

test('a restart that fails, and a host that does not verify (a seat died, a controller changed mode, no fresh heartbeat), are failures with the state named', async (t) => {
  const restart = world(t);
  restart.engine.restartResult = { status: 1, data: null, stderr: 'engine did not start' };
  const failed = await run(restart, { from: restart.clone });
  assert.equal(failed.data.refusals[0].code, 'deploy-restart-failed');
  assert.deepEqual(failed.data.state, { treeAt: restart.tip, moved: true, migrated: true, restarted: false });

  const verify = world(t);
  verify.engine.afterRestart = (e) => { e.seats['kernel:a'] = 'dead'; e.modes.job = 'shadow'; };
  const bad = await run(verify, { from: verify.clone });
  assert.equal(bad.data.refusals[0].code, 'deploy-verify-failed');
  assert.match(bad.data.refusals[0].detail, /seat kernel:a is dead, it was live/);
  assert.match(bad.data.refusals[0].detail, /controller job is shadow, it was active/);
  assert.equal(events(verify, 'runtime-deployed').length, 0, 'a deploy that did not verify journals no success');

  const stale = world(t);
  stale.engine.afterRestart = (e) => { e.heartbeatAt = 1; };
  assert.match((await run(stale, { from: stale.clone })).data.refusals[0].detail, /no fresh heartbeat/);
  const wrongRev = world(t);
  wrongRev.engine.afterRestart = (e) => { e.rev = 'deadbeef'; };
  assert.match((await run(wrongRev, { from: wrongRev.clone })).data.refusals[0].detail, /reports revision deadbeef/);
});

test('area names group scripts, modules and knowledge by their subfolder', () => {
  assert.equal(areaOf('scripts/kernel/a.mjs'), 'scripts/kernel');
  assert.equal(areaOf('package.json'), 'package.json');
  assert.deepEqual(areasOf(['docs/a.md', 'docs/b.md', 'engine/x.mjs']), { docs: 2, engine: 1 });
});

/** The marks of a running engine, written through the stores themselves: a leader epoch with its process run, an action, a settle tail, a prepared receipt. */
function marks(t, fn) {
  return withLedger(t, ({ machine, ledger }) => {
    const runId = machine.startProcessRun({ role: 'engine', epoch: 7, startReason: 'manual' });
    const startedAt = Number(machine.db.prepare('SELECT started_at FROM process_runs WHERE run_id=?').get(runId).started_at);
    const leader = { fresh: true, epoch: 7, runId };
    const db = ledger.db;
    db.exec('PRAGMA foreign_keys=OFF');
    db.prepare("INSERT INTO workflows(workflow_id,trace_id,phase,created_at,updated_at) VALUES('wf-1',?, 'running',1,1)").run('a'.repeat(32));
    const prepare = (jobId, createdAt) => ledger.appendEvent({ workflowId: 'wf-1', entityType: 'job', entityId: jobId, attemptId: null, kind: 'workflow-op-preserved-prepared', createdAt, payload: { resetTo: 'x' } });
    return fn({ machine, ledger, leader, runId, startedAt, prepare, scan: () => inFlightSteps({ machine, leader }) });
  });
}

test('the marks of a step in flight: an action of this epoch, a running settle tail, a prepared decision under apply; the marks of a dead engine are not', (t) => {
  marks(t, ({ machine, ledger, startedAt, prepare, scan }) => {
    assert.deepEqual(scan(), [], 'a quiet engine has no step in flight');
    const old = machine.actionIntent({ controller: 'job', key: 'job:settle:old', verb: 'settle', epoch: 6 });
    machine.actionRunning(old);
    assert.deepEqual(scan(), [], 'a running action of an earlier epoch belongs to a dead engine');
    const live = machine.actionIntent({ controller: 'job', key: 'job:settle:j1', verb: 'settle', epoch: 7 });
    machine.actionRunning(live);
    assert.deepEqual(scan().map((s) => s.kind), ['engine-action']);

    ledger.db.prepare("INSERT INTO settle_tails(attempt_id,workflow_id,state,queued_at,started_at) VALUES(1,'wf-1','running',?,?)").run(startedAt, startedAt + 1);
    ledger.db.prepare("INSERT INTO settle_tails(attempt_id,workflow_id,state,queued_at,started_at) VALUES(2,'wf-1','running',1,2)").run();
    prepare('job-dead', startedAt - 1000);
    prepare('job-live', startedAt + 5);
    const kinds = scan().map((s) => `${s.kind}${s.job ? `:${s.job}` : ''}`).sort();
    assert.deepEqual(kinds, ['engine-action', 'prepared-decision:job-live', 'settle-tail']);

    ledger.appendEvent({ workflowId: 'wf-1', entityType: 'job', entityId: 'job-live', attemptId: null, kind: 'workflow-op-preserved-applied', createdAt: startedAt + 9, payload: {} });
    assert.equal(scan().some((s) => s.job === 'job-live'), false, 'an applied receipt is finished work');
  });
});

test('a deploy during a settle waits for it, restarts only after it ended, and neither loses nor repeats the step', async (t) => {
  await marks(t, async ({ machine, ledger, startedAt, prepare, scan }) => {
    const w = world(t);
    const action = machine.actionIntent({ controller: 'job', key: 'job:settle:j1', verb: 'settle', epoch: 7 });
    machine.actionRunning(action);
    ledger.db.prepare("INSERT INTO settle_tails(attempt_id,workflow_id,state,queued_at,started_at) VALUES(1,'wf-1','running',?,?)").run(startedAt, startedAt + 1);
    prepare('job-dead-apply', startedAt - 500);
    const rowsBefore = () => ({ actions: machine.db.prepare('SELECT count(*) n FROM engine_actions').get().n, tails: ledger.db.prepare('SELECT count(*) n FROM settle_tails').get().n,
      events: ledger.db.prepare("SELECT count(*) n FROM events WHERE kind='workflow-op-preserved-prepared'").get().n });
    const counts = rowsBefore();
    let polls = 0;
    const sleep = async () => {
      polls += 1;
      assert.equal(w.engine.restarts, 0, 'no restart while the settle is in flight');
      if (polls === 3) {
        machine.db.prepare("UPDATE engine_actions SET state='done', finished_at=? WHERE id=?").run(Date.now(), action);
        ledger.db.prepare("UPDATE settle_tails SET state='done', done_at=? WHERE attempt_id=1").run(Date.now());
      }
    };
    const out = await run(w, { from: w.clone }, { seams: { inFlight: scan }, sleep, numbers: { waitMs: 5000, pollMs: 1, verifyMs: 100 } });
    assert.equal(out.code, 0, out.text);
    assert.equal(polls, 3, 'the deploy waited exactly until the step finished');
    assert.equal(w.engine.restarts, 1);
    assert.deepEqual(rowsBefore(), counts, 'the step is not lost (its rows stand) and not repeated (no new row)');
    assert.equal(machine.db.prepare('SELECT state FROM engine_actions WHERE id=?').get(action).state, 'done');
    assert.equal(openPreparedOf(ledger.db, 'job-dead-apply', { read: false }) !== null, true, 'a dead apply stays for the settler to recover; the deploy never withdraws it');
  });
});

test('the affected specs: green carries {base, tip, passed, total} in the receipt and the event; the plan states the set size and budget and runs nothing', async (t) => {
  const w = world(t);
  let ran = 0;
  const seams = { runAffected: (dir, base) => { ran += 1; return affectedGreen(dir, base); } };
  const plan = await run(w, { from: w.clone, plan: true }, { seams });
  assert.equal(ran, 0, 'the plan does not run the specs');
  assert.ok(plan.data.steps[0].includes("3 spec file(s), budget 40 min"), plan.data.steps[0]);
  const out = await run(w, { from: w.clone }, { seams });
  assert.equal(out.code, 0, out.text);
  assert.equal(ran, 1);
  const affected = { base: w.base, tip: w.tip, passed: 3, total: 3 };
  assert.deepEqual(events(w, 'runtime-deployed')[0].payload.affected, affected);
  assert.deepEqual(JSON.parse(fs.readFileSync(receiptFile(w.tip, w.env), 'utf8')).affected, affected);
});

test('the affected specs refuse a budget that ended (exit 2), a receipt on another tip, an unclean tree and a run with no receipt; the check ran first and nothing moved', async (t) => {
  const exit = (code) => ({ exited: true, code, signal: null, timedOut: false });
  const cases = [
    ['budget exceeded', (dir, base) => affectedRun(affectedReceipt(dir, base, { ok: false, passed: 2 }), { exit: exit(2), unfinished: ['tests/late.spec.mjs'] }), /time budget ended with 1 spec file\(s\) not started: tests\/late\.spec\.mjs/],
    ['stale tip', (dir, base) => affectedRun(affectedReceipt(dir, base, { tip: 'e'.repeat(40) })), /receipt is for tip eeeeeeeeeeee/],
    ['unclean', (dir, base) => affectedRun(affectedReceipt(dir, base, { clean: false })), /not clean/],
    ['child died', () => affectedRun(null, { exit: exit(7), tail: ['PASS tests/a.spec.mjs (0.1s)'] }), /wrote no receipt: the child exited 7.*Last lines: PASS tests\/a/],
  ];
  for (const [name, runAffected, detail] of cases) {
    const w = world(t);
    const out = await run(w, { from: w.clone }, { seams: { runAffected } });
    assert.equal(out.data.refusals[0].code, 'deploy-affected-red', name);
    assert.match(out.data.refusals[0].detail, detail, name);
    assert.match(out.data.refusals[0].detail, /starci test affected --run --base [0-9a-f]{12} in /, 'the refusal names the command and the clone');
    assert.equal(headOf(w.host), w.base, name);
    assert.equal(fs.existsSync(receiptFile(w.tip, w.env)), false, `${name}: no receipt is written`);
  }
});

test('a deploy that changes ui/package.json installs and builds the harness UI before the engine restarts; a host that cannot is a named failure and the engine is not restarted', async (t) => {
  const ok = world(t);
  commit(ok.clone, 'ui/package.json', '{"dependencies":{"@heroui/react":"3.0.0"}}\n', 'a ui dependency');
  const built = await run(ok, { from: ok.clone }, { seams: { uiBuild: () => { ok.engine.order.push('ui'); return { status: 0, data: { items: [] }, stderr: '' }; } } });
  assert.equal(built.code, 0, built.text);
  assert.deepEqual(ok.engine.order.filter((step) => step === 'ui' || step === 'restart'), ['ui', 'restart'], 'the UI is installed and built first');

  const red = world(t);
  commit(red.clone, 'ui/package-lock.json', '{}\n', 'a ui lockfile');
  const failed = await run(red, { from: red.clone }, { seams: { uiBuild: () => ({ status: 1, data: { items: [{ id: 'ui-build', status: 'red', required: true, detail: 'ui build FAILED: Cannot find module @heroui/react' }] }, stderr: '' }) } });
  assert.equal(failed.code, 1, failed.text);
  assert.equal(failed.data.refusals[0].code, 'deploy-ui-install-failed');
  assert.match(failed.data.refusals[0].detail, /Cannot find module @heroui\/react/);
  assert.equal(red.engine.restarts, 0, 'the engine was not restarted');
  assert.ok(catalog['deploy-ui-install-failed']);

  const none = world(t);
  const untouched = await run(none, { from: none.clone }, { seams: { uiBuild: () => { throw new Error('no ui change, no ui build'); } } });
  assert.equal(untouched.code, 0, untouched.text);
});

test('a long affected run is announced before it starts, a receipt already proven for the base..tip pair is accepted instead of a second run', async (t) => {
  const w = world(t);
  const said = [];
  let ran = 0;
  const first = await run(w, { from: w.clone }, { progress: (line) => said.push(line), seams: { runAffected: (dir, base) => { ran += 1; return affectedGreen(dir, base); } } });
  assert.equal(first.code, 0, first.text);
  assert.equal(ran, 1);
  const announced = said.findIndex((line) => /^affected: running 3 spec file\(s\) in .* budget 40 min; progress follows$/.test(line));
  assert.ok(announced >= 0, `announced before it runs: ${JSON.stringify(said)}`);
  assert.ok(said.findIndex((line) => line.startsWith('check: running starci runtime check')) < announced, 'the check is announced first');

  const second = world(t);
  const proven = [];
  const out = await run(second, { from: second.clone }, { progress: (line) => proven.push(line), seams: {
    runAffected: () => { throw new Error('the pair is proven: no second run'); },
    provenAffected: (dir, base, tip) => ({ base, tip, passed: 9, total: 9, ok: true, clean: true }) } });
  assert.equal(out.code, 0, out.text);
  assert.ok(proven.some((line) => /accepting the receipt already proven .* \(9 of 9 files passed\); not run again/.test(line)));
  assert.deepEqual(events(second, 'runtime-deployed')[0].payload.affected, { base: second.base, tip: second.tip, passed: 9, total: 9 });
});
