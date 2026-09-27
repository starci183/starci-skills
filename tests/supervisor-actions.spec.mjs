// The Supervisor's owed actions (modules/supervisor/supervise.yaml mission, scripts/supervisor/actions.mjs): every
// stuck item classified with its action, the SLA clock an action stops, the audit trail, the owner digest, and the
// tick that files SLA breaches into the Supervisor's inbox (never Telegram). No Orca, no Telegram, no live ledger.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { owedActions, withSla, actedOf, recordAction, latestOwedActions, digestText, ownerDigest, pushClass, CLASSES } from '../scripts/supervisor/actions.mjs';
import { runSupervisorTick } from '../scripts/supervisor/tick.mjs';
import { tickSettings } from '../scripts/supervisor/tick-duties.mjs';
import { withSupervisorRead } from '../scripts/supervisor/home.mjs';
import { readInbox } from '../scripts/connectors/telegram-bridge.mjs';
import { parseYaml } from '../engine/yaml.mjs';

const NOW = Date.parse('2026-09-28T12:00:00Z');
const envOf = (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-sup-actions-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }));
  return { ...process.env, LOCALAPPDATA: path.join(root, 'la'), STARCI_SUPERVISOR_HOME: path.join(root, 'home'), STARCI_CONNECTORS_OFF: '1' };
};

test('owed actions: each stuck item gets one class and one action; an incident a cluster carries is not listed twice', () => {
  const clusters = [
    { id: 'runtime-api-mjs', size: 1, oldestMin: 90, summary: 'api.mjs dead-end', incidents: ['inc-aaaaaaaaaaaa'], workflows: ['wf-a'], items: [{ repo: 'D:/r', kind: 'source-runtime-defect' }] },
    { id: 'runtime-pattern-retry-loop-op-x', size: 1, oldestMin: 300, summary: 'x: 4 failed', incidents: [], workflows: ['wf-a'], items: [{ repo: 'D:/r', pattern: 'retry-loop' }] },
    { id: 'decision-failed-retries-the-same-op', size: 1, oldestMin: 60, summary: 'route failed-retries-the-same-op already fired 3 of 3 times', incidents: ['inc-bbbbbbbbbbbb'], workflows: ['wf-b'], items: [{ repo: 'D:/r', kind: 'decision' }] },
    { id: 'checker-fixed', size: 1, oldestMin: 30, summary: 'fixed', fixedBy: 'abcdef1234567', incidents: ['inc-cccccccccccc'], workflows: ['wf-b'], items: [{ repo: 'D:/r' }] },
  ];
  const stalls = [
    { type: 'STALE-GATE', workflowId: 'wf-a', repo: 'D:/r', incidentId: 'inc-aaaaaaaaaaaa', line: 'STALE-GATE dup' },
    { type: 'STALE-GATE', workflowId: 'wf-c', repo: 'D:/r', incidentId: 'inc-dddddddddddd', line: 'STALE-GATE wf-c record landed' },
    { type: 'STALE-PEER-WAIT', workflowId: 'wf-c', repo: 'D:/r', incidentId: 'inc-eeeeeeeeeeee', peer: 'wf-a', line: 'STALE-PEER-WAIT wf-c on wf-a' },
    { type: 'GATE', workflowId: 'wf-c', repo: 'D:/r', incidentId: 'inc-ffffffffffff', young: false, asks: [], waits: [], text: 'waits on the supervisor ruling', line: 'GATE wf-c no condition' },
    { type: 'GATE', workflowId: 'wf-c', repo: 'D:/r', incidentId: 'inc-111111111111', young: false, asks: [], waits: [], text: 'needs the production credentials', line: 'GATE wf-c creds' },
    { type: 'STALLED', workflowId: 'wf-d', repo: 'D:/r', actionable: true, alert: true, line: 'STALLED wf-d idle 50m' },
    { type: 'PEER-WAIT', workflowId: 'wf-c', repo: 'D:/r', incidentId: 'inc-222222222222', alert: false, line: 'justified' },
  ];
  const flows = {
    workflows: [
      { workflowId: 'wf-d', repo: 'D:/r', ready: 2, deadWorkerJobs: ['op-x-1'], wedgedJobs: [], kernelRevStale: { current: 'b'.repeat(40), acked: 'a'.repeat(40), fileCount: 3 }, ownerAsks: ['ctx_1'] },
      { workflowId: 'wf-e', repo: 'D:/r', error: 'status unreadable' },
    ],
    deadKernels: [{ workflowId: 'wf-e', repo: 'D:/r', action: 'restart-failed', count: 3 }],
    orphaned: [{ workflowId: 'wf-f', repo: 'D:/r', reason: 'nothing open' }],
  };
  const pushes = [{ repo: 'D:/x/.claude', refused: 'secret scan', scan: { findings: [{ file: 'a.env', line: 1, pattern: 'token' }] } }, { repo: 'D:/y', pushed: true }];
  const items = owedActions({ clusters, stalls, flows, pushes });
  const byKey = Object.fromEntries(items.map((i) => [i.key, i.class]));
  assert.deepEqual(byKey, {
    'owed|runtime-api-mjs': 'runtime-defect',
    'owed|runtime-pattern-retry-loop-op-x': 'retry-cap',
    'owed|decision-failed-retries-the-same-op': 'retry-cap',
    'owed|checker-fixed': 'fixed-defect',
    'gate|wf-c|inc-dddddddddddd': 'stale-gate',
    'peer|wf-c|inc-eeeeeeeeeeee': 'peer-wait',
    'gate|wf-c|inc-ffffffffffff': 'owner-gate-no-ask',
    'dispatch|wf-d': 'undispatched',
    'worker|wf-d|op-x-1': 'dead-worker',
    'ask|wf-d': 'owner-ask',
    'rev|wf-d': 'contract-stale',
    'kernel|wf-e': 'dead-kernel',
    'orphaned|wf-f': 'orphaned',
    'push|.claude|secret': 'push-refused',
  });
  assert.ok(!items.some((i) => i.subject === 'inc-111111111111'), 'a credentials gate stays the owner\'s: never an action');
  assert.ok(items.every((i) => i.do === CLASSES[i.class]), 'every item carries its class action');
  assert.equal(pushClass({ refused: 'pre-push hook: eslint --max-warnings=0 failed' }), 'lint');
  assert.equal(pushClass({ error: 'node --test: 2 failing' }), 'test');
});

test('SLA: a stuck item breaches only when no action touched it for actionSlaMs; an action or a delivered notice stops the clock', (t) => {
  const env = envOf(t);
  const slaMs = 30 * 60_000;
  const items = [{ key: 'gate|wf-a|inc-1', class: 'stale-gate', workflowId: 'wf-a' }, { key: 'owed|x', class: 'runtime-defect', workflowId: 'wf-b' }, { key: 'kernel|wf-c', class: 'dead-kernel', workflowId: 'wf-c' }];
  const first = withSla(items, { now: NOW, slaMs });
  assert.ok(first.items.every((i) => !i.breach && i.ageMin === 0), 'a first sighting never breaches');
  recordAction({ item: 'owed|x', action: 'worker-job', reason: 'job sup-1 spawned for the cluster', env, now: NOW + 10 * 60_000 });
  assert.throws(() => recordAction({ item: 'owed|x', action: 'x', reason: ' ', env }), /--reason/);
  const acted = withSupervisorRead((db) => actedOf(db), null, { env });
  assert.equal(acted.byKey['owed|x'].action, 'worker-job');
  const later = withSla(items, { seen: first.seen, acted: { ...acted, byWorkflow: { 'wf-c': NOW + 5 * 60_000 } }, now: NOW + 31 * 60_000, slaMs });
  const breach = Object.fromEntries(later.items.map((i) => [i.key, i.breach]));
  assert.deepEqual(breach, { 'gate|wf-a|inc-1': true, 'owed|x': false, 'kernel|wf-c': false });
  const cleared = withSla(items.slice(1, 2), { seen: later.seen, now: NOW + 40 * 60_000, slaMs });
  assert.deepEqual(Object.keys(cleared.seen), ['owed|x'], 'an item a tick no longer sees starts over');
});

test('the tick records the owed actions and files SLA breaches in the Supervisor inbox, never on Telegram', async (t) => {
  const env = envOf(t);
  const settings = { ...tickSettings(), host: { maxNode: 10, maxGit: 10, chainMin: 20, orphanMinAgeMs: 600_000 } };
  const sent = [];
  const deps = {
    listProcesses: () => [], orca: { probe: () => 'ok' }, statusApp: { up: async () => true },
    runTick: async () => ({ digests: [{ stalls: [{ type: 'STALE-GATE', workflowId: 'wf-a', repo: 'D:/r', incidentId: 'inc-aaaaaaaaaaaa', line: 'STALE-GATE wf-a record landed' }] }], clusters: [], owed: [], pushes: [], lines: [] }),
    frontiers: { runningOf: () => [{ workflowId: 'wf-a' }], frontierOf: () => ({ ok: true, frontier: { state: 'engaged', readyOperations: 0 }, kernelRev: { stale: false } }) },
    deadKernels: () => [], load: () => ({ cpuBusy: 0.1, freeMem: 0.5, totalRamBytes: 1 }),
    sendAlerts: async (due) => { sent.push(...due); return { inbox: null, telegram: null }; },
  };
  const r1 = await runSupervisorTick({ repos: ['D:/r'], push: false, heartbeat: false, env, now: () => NOW, settings, deps });
  assert.equal(r1.ok, true, JSON.stringify(r1.errors));
  assert.deepEqual(r1.actions.map((i) => [i.key, i.breach]), [['gate|wf-a|inc-aaaaaaaaaaaa', false]]);
  assert.ok(r1.lines.some((l) => l.startsWith('OWED-ACTION [stale-gate] gate|wf-a|inc-aaaaaaaaaaaa')), r1.lines.join('\n'));
  assert.equal(latestOwedActions({ env }).items.length, 1);
  assert.equal(readInbox('main', env).length, 0);

  const r2 = await runSupervisorTick({ repos: ['D:/r'], push: false, heartbeat: false, env, now: () => NOW + settings.actionSlaMs + 60_000, settings, deps });
  assert.equal(r2.actions[0].breach, true);
  const inbox = readInbox('main', env);
  assert.equal(inbox.length, 1);
  assert.match(inbox[0].text, /^OWED-ACTIONS 1 item\(s\) past the \d+m SLA/);
  assert.ok(!sent.some((a) => a.key.startsWith('sla|')), 'an SLA breach never reaches the owner alerts');

  await runSupervisorTick({ repos: ['D:/r'], push: false, heartbeat: false, env, now: () => NOW + settings.actionSlaMs + 120_000, settings, deps });
  assert.equal(readInbox('main', env).length, 1, 'one breach is filed at most once per SLA window');
});

test('the owner digest: actions since the last digest, open items, owner-only waits; at most once per ownerDigestMs', async (t) => {
  const env = envOf(t);
  recordAction({ item: 'gate|wf-a|inc-1', action: 'resolve', reason: 'record landed; resolved --by supervisor', env, now: NOW });
  const text = digestText({ actions: [{ item: 'gate|wf-a|inc-1', action: 'resolve', reason: 'landed' }], owed: { items: [{ class: 'retry-cap', actedAt: null }], workflows: [{ workflowId: 'wf-a', state: 'engaged', ready: 1 }], ownerWaits: ['STALLED wf-b credentials'] }, language: 'en', now: NOW });
  assert.match(text, /Handled \(1\)/);
  assert.match(text, /retry-cap 1/);
  assert.match(text, /Waiting on you \(credentials \/ handover only\)/);
  const pushed = [];
  const push = async (x) => { pushed.push(x); return { ok: true }; };
  const one = await ownerDigest({ send: true, env, now: NOW + 1000, everyMs: 7_200_000, push, language: 'en' });
  assert.equal(one.sent, true);
  const two = await ownerDigest({ send: true, env, now: NOW + 60_000, everyMs: 7_200_000, push, language: 'en' });
  assert.equal(two.sent, false);
  assert.match(two.skipped, /last digest/);
  assert.equal(pushed.length, 1);
  assert.match(pushed[0], /resolve gate\|wf-a\|inc-1/);
});

test('supervise.yaml carries the mission: the loop, every action class, the SLA and the owner-digest rule', () => {
  const doc = parseYaml(fs.readFileSync(new URL('../modules/supervisor/supervise.yaml', import.meta.url), 'utf8'));
  assert.ok(doc.mission?.loop?.length >= 5, 'the mission loop');
  for (const c of Object.keys(CLASSES)) assert.ok(doc.mission.classes?.[c], `mission.classes.${c}`);
  assert.match(String(doc.mission.message.owner), /digest/);
  assert.ok(doc.kernelSeat.does.some((d) => /actions\.mjs/.test(String(d))));
  const prompt = fs.readFileSync(new URL('../modules/supervisor/supervisor-prompt.md', import.meta.url), 'utf8');
  assert.match(prompt, /actions\.mjs list/);
  assert.match(prompt, /--by supervisor/);
});
