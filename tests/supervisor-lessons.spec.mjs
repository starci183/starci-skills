// The Supervisor's self-learning loop (modules/supervisor/supervise.yaml selfLearning, scripts/supervisor/lessons.mjs):
// a repeated failure signature opens one hypothesis, an experiment lands only through the guardrails (tier, a checker
// change without a wrongly-blocked example, the daily cap), a measured regression makes the revert due and the revert
// lane lands it, owner feedback outweighs self-derived lessons, and every step is a typed row of the machine log.
// A temp machine.sqlite and temp git repos only; the land gate is a stub.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  newHypotheses, learnTick, readLearning, tierOf, guardLand, landExperiment, measureExperiments, revertExperiment, recordFeedback, matchLessons,
  lessonsYaml, learningDigest, propose, signatureOf,
} from '../scripts/supervisor/lessons.mjs';
import { parseLessonsFile, withLessons } from '../scripts/supervisor/lessons-file.mjs';
import { readSupervisor, supervisorEvent, withSupervisor, writeSeat } from '../scripts/supervisor/home.mjs';
import { readSupervisorState } from '../scripts/supervisor/state.mjs';

const NOW = Date.parse('2026-09-28T12:00:00Z');
const SETTINGS = { minRepeats: 2, measureMs: 6 * 3_600_000, dailyAutoLandCap: 2, ownerWeight: 3, successDrop: 0.1 };
const tmp = (t, prefix) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); t.after(() => fs.rmSync(d, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 })); return d; };
const envOf = (t) => { const root = tmp(t, 'starci-sup-learn-'); return { ...process.env, LOCALAPPDATA: path.join(root, 'la'), STARCI_TEST_MACHINE_FILE: path.join(root, 'machine.sqlite'), STARCI_CONNECTORS_OFF: '1' }; };
const cluster = (id, size, extra = {}) => ({ key: `owed|${id}`, class: 'runtime-defect', subject: id, size, workflowId: 'wf-a', evidence: `${size} item(s): check draw-acceptance failed`, incidents: ['inc-aaaaaaaaaaaa'], ...extra });
const logRows = (env) => readSupervisor((m) => m.logs({ actor: 'supervisor', limit: 1000 }), [], { env });

test('a signature repeated minRepeats times opens ONE hypothesis with a cause class; a single sighting does not', (t) => {
  const env = envOf(t);
  const items = [cluster('checker-draw-acceptance', 2), cluster('runtime-once', 1), { key: 'owed|runtime-pattern-retry-loop-x', class: 'retry-cap', subject: 'runtime-pattern-retry-loop-x', size: 1, evidence: 'x: 4 failed' }];
  const h = newHypotheses(items, { signatures: {} }, SETTINGS);
  assert.deepEqual(h.map((x) => [x.signature, x.causeClass]), [['checker-draw-acceptance', 'gate-defect'], ['runtime-pattern-retry-loop-x', 'runtime-flow']]);
  learnTick({ items, env, now: NOW, settings: SETTINGS });
  const again = learnTick({ items, env, now: NOW + 60_000, settings: SETTINGS });
  assert.equal(again.hypotheses.length, 0, 'an open hypothesis is never opened twice');
  assert.deepEqual(again.openHypotheses.sort(), ['checker-draw-acceptance', 'runtime-pattern-retry-loop-x']);
  assert.ok(logRows(env).some((r) => r.kind === 'decision' && /hypothesis checker-draw-acceptance/.test(r.msg)), 'the hypothesis is a machine-log row');
  assert.equal(signatureOf({ key: 'dispatch|wf-x', class: 'undispatched', subject: 'wf-x' }), 'undispatched:workflow');
});

test('guardrails: the propose tier, a checker change without a wrongly-blocked example, and the daily cap refuse the land', () => {
  assert.equal(tierOf([{ path: 'scripts/checks/draw-acceptance.mjs', status: 'M' }, { path: 'packages/grammar/src/Card.tsx', status: 'M' }]).tier, 'auto', 'checker fixes and grammar are routine');
  for (const p of ['modules/kernel/owner-rulings.yaml', 'knowledge/ui/examples/brand-direction.nivo.yaml', 'knowledge/ui/presentation/padding.yaml', 'modules/ops/registry.yaml', 'config.yaml', 'modules/kernel/driver-loop.yaml'])
    assert.equal(tierOf([{ path: p, status: 'M' }]).tier, 'propose', p);
  assert.equal(tierOf([{ path: 'scripts/checks/old-gate.mjs', status: 'D' }]).tier, 'propose', 'removing a gate');
  assert.equal(tierOf([{ path: 'knowledge/grammars/starci/DNA.yaml', status: 'M' }]).tier, 'auto', 'grammar snapshots follow grammar');

  const checker = [{ path: 'scripts/checks/draw-acceptance.mjs', status: 'M' }, { path: 'tests/draw-acceptance.spec.mjs', status: 'M' }];
  const relax = guardLand({ files: checker, landedToday: 0, cap: 2 });
  assert.deepEqual(relax.refusals.map((r) => r.code), ['check-relax-unproven'], 'never relax a check to green');
  const noExample = guardLand({ files: checker, wronglyBlocked: 'tests/draw-acceptance.spec.mjs', specText: () => 'test("passes")', landedToday: 0, cap: 2 });
  assert.deepEqual(noExample.refusals.map((r) => r.code), ['check-relax-unproven'], 'the spec must hold the wrongly blocked example');
  const proven = guardLand({ files: checker, wronglyBlocked: 'tests/draw-acceptance.spec.mjs', specText: () => "test('a correct owned-shell record was wrongly blocked', ...)", landedToday: 0, cap: 2 });
  assert.equal(proven.ok, true);
  assert.deepEqual(guardLand({ files: [{ path: 'scripts/work/x.mjs', status: 'M' }], landedToday: 2, cap: 2 }).refusals.map((r) => r.code), ['daily-cap']);
  assert.deepEqual(guardLand({ files: [{ path: 'modules/kernel/owner-rulings.yaml', status: 'M' }], landedToday: 0, cap: 2 }).refusals.map((r) => r.code), ['propose-tier']);
});

test('land: a refused change never reaches the gate; a landed one is an experiment; a recurrence makes the revert due, quiet time keeps it', async (t) => {
  const env = envOf(t);
  const calls = [];
  const landFn = async (a) => { calls.push(a); return { ok: true, head: 'f'.repeat(40) }; };
  const refused = await landExperiment({ signature: 'checker-draw-acceptance', commits: ['a1'], lane: 'fix-da', env, now: () => NOW, landFn, settings: SETTINGS,
    filesOf: () => [{ path: 'scripts/checks/draw-acceptance.mjs', status: 'M' }] });
  assert.equal(refused.ok, false);
  assert.equal(calls.length, 0, 'the gate is never called for a refused change');
  const ok = await landExperiment({ signature: 'checker-draw-acceptance', commits: ['b2'], lane: 'fix-da', env, now: () => NOW, landFn, settings: SETTINGS, reason: 'owned-shell record ownership',
    filesOf: () => [{ path: 'scripts/checks/draw-acceptance.mjs', status: 'M' }, { path: 'tests/draw-acceptance.spec.mjs', status: 'M' }], wronglyBlocked: 'tests/draw-acceptance.spec.mjs',
    readSpec: () => 'the owned-shell record was wrongly blocked' });
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.equal(calls.length, 1);
  const id = ok.experiment.id;
  let state = readLearning({ env });
  assert.equal(state.experiments[id].status, 'measuring');

  // Quiet for less than measureMs: nothing yet. A regression naming a changed file: revert due.
  assert.deepEqual(measureExperiments(state, { items: [], now: NOW + 3_600_000, measureMs: SETTINGS.measureMs }), []);
  const regression = [{ key: 'owed|runtime-other', class: 'runtime-defect', subject: 'runtime-other', firstSeenAt: NOW + 60_000, evidence: 'draw-acceptance.mjs now throws on a null record' }];
  const due = learnTick({ items: regression, env, now: NOW + 2 * 3_600_000, settings: SETTINGS });
  assert.deepEqual(due.revertDue.map((e) => e.id), [id]);
  assert.match(readLearning({ env }).experiments[id].result.reason, /new signature\(s\) naming a changed file/);

  // A second experiment with no recurrence for measureMs is kept and becomes a lesson.
  const ok2 = await landExperiment({ signature: 'runtime-api-mjs', commits: ['c3'], lane: 'fix-api', env, now: () => NOW, landFn, settings: SETTINGS, filesOf: () => [{ path: 'scripts/kernel/route-plan.mjs', status: 'M' }] });
  const kept = learnTick({ items: [], env, now: NOW + SETTINGS.measureMs + 1, settings: SETTINGS });
  assert.ok(kept.verdicts.some((v) => v.id === ok2.experiment.id && v.outcome === 'kept'));
  state = readLearning({ env });
  assert.ok(state.lessons.some((l) => l.status === 'kept' && l.signature === 'runtime-api-mjs'));
  assert.equal((await landExperiment({ signature: 's', commits: ['d4'], lane: 'x', env, now: () => NOW + 1000, landFn, settings: SETTINGS, filesOf: () => [{ path: 'scripts/work/y.mjs', status: 'M' }] })).refused?.[0]?.code, 'daily-cap');
  assert.match(learningDigest(state).join('\n'), /1 kept/);
  const kinds = logRows(env).map((r) => r.kind);
  for (const k of ['supervisor.action', 'decision', 'warning', 'narration']) assert.ok(kinds.includes(k), `machine log has ${k}`);
});

test('revert --apply: a revert lane off main with a contract-changes entry for reverted contract files, landed through the gate', async (t) => {
  const env = envOf(t);
  const root = tmp(t, 'starci-sup-revert-');
  const lanes = path.join(root, '..', `${path.basename(root)}-lanes`);
  t.after(() => fs.rmSync(lanes, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }));
  const git = (...a) => { const r = spawnSync('git', ['-C', root, ...a], { encoding: 'utf8', windowsHide: true }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
  git('init', '-q', '-b', 'main'); git('config', 'user.email', 'l@t'); git('config', 'user.name', 'l'); git('config', 'core.autocrlf', 'false');
  fs.mkdirSync(path.join(root, 'modules/kernel'), { recursive: true }); fs.mkdirSync(path.join(root, 'modules/supervisor'), { recursive: true });
  fs.writeFileSync(path.join(root, 'modules/kernel/contract-changes.yaml'), 'schema: x\nchanges:\n');
  fs.writeFileSync(path.join(root, 'modules/supervisor/supervise.yaml'), 'a: 1\n');
  git('add', '-A'); git('commit', '-qm', 'init');
  fs.writeFileSync(path.join(root, 'modules/supervisor/supervise.yaml'), 'a: 2\n');
  git('commit', '-qam', 'the experiment');
  const sha = git('rev-parse', 'HEAD');
  const landed = [];
  const landFn = async (a) => { landed.push(a); return { ok: true }; };
  const exp = await landExperiment({ signature: 'sig-x', commits: [sha], lane: 'exp', env, now: () => NOW, landFn, settings: SETTINGS, filesOf: () => [{ path: 'scripts/work/z.mjs', status: 'M' }] });
  const plan = await revertExperiment({ id: exp.experiment.id, env, root, lanes });
  assert.equal(plan.planned, true);
  const r = await revertExperiment({ id: exp.experiment.id, apply: true, env, now: () => NOW, root, landFn, lanes });
  assert.equal(r.ok, true, JSON.stringify(r));
  const show = git('show', '--stat', '--format=%B', r.revertCommit);
  assert.match(show, /revert\(self-learning\): sig-x/);
  assert.match(show, /Co-Authored-By: Claude Opus 5\.5/);
  const entryFile = git('show', '--name-only', '--format=', r.revertCommit).split(/\r?\n/).find((f) => f.startsWith('modules/kernel/contract-changes/'));
  assert.match(entryFile, /^modules\/kernel\/contract-changes\/revert-exp-[0-9a-f]+\.yaml$/, 'one entry file per change');
  assert.match(git('show', `${r.revertCommit}:${entryFile}`), /^id: revert-exp-[0-9a-f]+[\s\S]*- modules\/supervisor\/supervise\.yaml/);
  assert.equal(git('show', `${r.revertCommit}:modules/supervisor/supervise.yaml`), 'a: 1');
  assert.deepEqual(landed.at(-1).commits, [r.revertCommit]);
  assert.equal(readLearning({ env }).experiments[exp.experiment.id].status, 'reverted');
  assert.ok(readLearning({ env }).lessons.some((l) => l.status === 'reverted' && /did not work/.test(l.text)));
  assert.equal(git('branch', '--list', 'lane/revert-*'), '', 'the revert lane is removed');
});

test('owner feedback is a lesson that outweighs a self-derived one; the lessons file round-trips and rides beside prior failures', (t) => {
  const env = envOf(t);
  recordFeedback({ text: 'check draw-acceptance: the owned shell record belongs to its own shape', signature: 'checker-draw-acceptance', via: 'telegram', env, now: NOW, settings: SETTINGS });
  const s0 = readLearning({ env });
  const lessons = [...s0.lessons, { signature: 'checker-draw-acceptance', source: 'self', weight: 1, status: 'kept', text: 'self lesson draw-acceptance', at: NOW + 1 }];
  const m = matchLessons(lessons, { text: 'draw-acceptance failed again' });
  assert.equal(m[0].source, 'owner', 'owner feedback first');
  const text = lessonsYaml({ lessons });
  const parsed = parseLessonsFile(text);
  assert.deepEqual(parsed.map((l) => [l.source, l.weight]), [['owner', 3], ['self', 1]]);
  const withL = withLessons([{ name: 'draw-acceptance', evidence: 'red' }], { root: '/x', read: () => text });
  assert.deepEqual(withL.map((f) => f.name), ['draw-acceptance', 'lesson owner', 'lesson self']);
  assert.deepEqual(withLessons([], { root: '/x', read: () => text }), [], 'no red check, no lesson');
});

test('land --wait-ms reaches the gate: the Supervisor queues as long as a lane does instead of giving up gate-busy', async (t) => {
  const env = envOf(t);
  const calls = [];
  const landFn = async (a) => { calls.push(a); return { ok: true, head: 'f'.repeat(40) }; };
  const filesOf = () => [{ path: 'scripts/work/z.mjs', status: 'M' }];
  await landExperiment({ signature: 'wait-a', commits: ['e5'], lane: 'x', env, now: () => NOW, landFn, settings: SETTINGS, filesOf, waitMs: 7_200_000 });
  await landExperiment({ signature: 'wait-b', commits: ['e6'], lane: 'x', env, now: () => NOW, landFn, settings: SETTINGS, filesOf });
  assert.equal(calls[0].waitMs, 7_200_000);
  assert.equal('waitMs' in calls[1], false, 'no --wait-ms keeps the gate default');
});

test('propose with no clock passed (the CLI path) reads the real clock instead of throwing', async (t) => {
  // lessons.mjs propose --send failed "now is not a function" on 2026-09-28: the default was Date.now(), a number.
  const env = envOf(t);
  const p = await propose({ title: 'CLI path', evidence: 'e', options: 'o', recommendation: 'r', send: true, env, push: async () => ({ ok: true }) });
  assert.equal(p.ok, true);
  assert.match(p.id, /^prop-[0-9a-f]{8}$/);
});

test('a proposal is recorded (and pushed only with send); the state reader carries learning, owed items and messages', async (t) => {
  const env = envOf(t);
  const pushed = [];
  const p = await propose({ title: 'Weaken gate draw-dna for icons', evidence: '12 wrongly blocked icons', options: 'A keep; B exempt icons', recommendation: 'B', send: true, env, now: () => NOW, push: async (x) => { pushed.push(x); return { ok: true }; } });
  assert.match(pushed[0], /Recommendation: B/);
  withSupervisor((m) => writeSeat(m, { token: 'test-seat', value: { terminal: 'term-test', agent: 'claude', model: 'opus-test', state: 'live' }, expiresAt: NOW + 60_000, now: NOW - 60_000 }), { env });
  withSupervisor((m) => supervisorEvent(m, { entityType: 'tick', kind: 'supervisor-tick-duties',
    payload: { ramThrottle: { effectiveCap: 7, maxParallelOps: 20, running: 3, queued: 2, mode: 'heavy-paused', why: 'low free RAM', capWhy: 'reserve RAM', freeRamPct: 12, cpuBusy: 0.55 } }, now: NOW }), { env });
  const s = readSupervisorState({ env, now: NOW, settings: { mode: 'kernel' } });
  assert.equal(s.schema, 'starci/supervisor-state@1');
  assert.equal(s.seat.mode, 'kernel');
  assert.deepEqual([s.seat.agent, s.seat.model], ['claude', 'opus-test']);
  assert.deepEqual([s.tick.ramThrottle.effectiveCap, s.tick.ramThrottle.maxParallelOps, s.tick.ramThrottle.mode], [7, 20, 'heavy-paused']);
  assert.deepEqual(s.learning.proposals.map((x) => [x.id, x.status]), [[p.id, 'open']]);
  assert.deepEqual(s.learning.proposals.map((x) => [x.evidence, x.options]), [['12 wrongly blocked icons', 'A keep; B exempt icons']]);
  assert.deepEqual(s.messages, { inbox: [], outbox: [] });
  assert.deepEqual(s.owed, { at: null, items: [] });
});
