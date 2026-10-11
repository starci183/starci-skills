// The five questions Debug could not answer after the first four signals, each now read from a fact the runtime records where it occurs:
// a provider outage and the resumption of work (provider_health_events), a runtime change applied (signal.runtime-change-applied), a secret
// that survived redaction (the scan seam over the stored artifacts), host-versus-ledger drift (signal.host-ledger-drift) and the claims of a
// port (signal.port-claim). Real machine stores for the writers and readers; fixtures for the pure checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { TEST_REGISTRY_ENV, openMachine } from '../../engine/db/machine.mjs';
import { loadQuestions, answerQuestions } from '../../scripts/reconciler/debug-questions.mjs';
import { machineFacts } from '../../scripts/reconciler/debug-digest-machine.mjs';
import { collectSnapshot } from '../../scripts/reconciler/debug-digest-collect.mjs';
import { scanText, scanBlobs } from '../../scripts/reconciler/debug-secret-scan.mjs';
import { startRecovery } from '../../scripts/reconciler/engine-process.mjs';
import { swapRow } from '../../scripts/reconciler/revision-swap.mjs';
import { outageEpisodes } from '../../scripts/reconciler/debug-signal-checks.mjs';
import { DRIFT_KINDS } from '../../scripts/reconciler/host-ledger-drift.mjs';
import { slaPass, setClock } from '../../scripts/reconciler/sla.mjs';
import { redactText, survivingSecrets } from '../../scripts/lib/redact.mjs';
import { portClaimer } from '../../scripts/uat/port-claim.mjs';
import { SIGNAL } from '../../scripts/machine/debug-signals.mjs';
import { digest, numbers, snapshot, workflow, NOW, MIN } from '../helpers/debug-digest-fixture.mjs';

const IDS = ['pl-network-loss', 'cu-live-state-untouched', 'co-secret-in-transcript', 'rr-claimed-vs-observed', 'cc-port-claims'];
const only = (ids) => loadQuestions().map((g) => ({ ...g, questions: g.questions.filter((q) => ids.includes(q.id)) }));
const answers = (snap, d = { workflows: [] }) => Object.fromEntries(answerQuestions(only(IDS), d, snap, numbers).flatMap((g) => g.questions).map((q) => [q.id, q]));

function store(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-debug-rest-'));
  const env = { ...process.env, STARCI_LOCAL_ROOT: path.join(root, 'la'), STARCI_CONNECTORS_OFF: '1', [TEST_REGISTRY_ENV]: path.join(root, 'machine.sqlite') };
  let now = NOW;
  const m = openMachine({ env, now: () => now });
  t.after(() => { m.close(); fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }); });
  return { m, env, set: (at) => { now = at; } };
}

test('every one of the 34 questions is answerable; none is a documented gap', () => {
  const all = loadQuestions().flatMap((g) => g.questions);
  assert.equal(all.length, 34);
  assert.deepEqual(all.filter((q) => q.answerable !== 'today').map((q) => q.id), []);
  const state = answers(snapshot({ providerEvents: [], runtimeChanges: [], hostDrift: [], portClaims: [], secrets: { scanned: 0, unreadable: 0, hits: [] } }));
  assert.deepEqual(IDS.map((id) => state[id].state), ['ok', 'unknown', 'unknown', 'ok', 'unknown']);
});

// ------------------------------------------------------------------------------------------------ pl-network-loss

test('a circuit transition keeps the failing job, step and kind and the end of the circuit; an outage ends at its recovery or its cooldown, and work resumed when the provider dispatched again', (t) => {
  const s = store(t);
  const until = NOW + 30 * MIN;
  s.m.setProviderHealth({ provider: 'codex', status: 'striking', failureKind: 'worker-start', strikes: 1, detail: { jobId: 'op-a-1', step: 'launch-trust', signal: null } });
  s.m.setProviderHealth({ provider: 'codex', status: 'unavailable', failureKind: 'worker-start', strikes: 2, circuitOpenUntil: until, detail: { jobId: 'op-a-2', step: 'launch-trust', signal: 'app-server answered nothing' } });
  const facts = machineFacts({ env: s.env });
  assert.deepEqual(facts.providerEvents.map((e) => [e.provider, e.from, e.to, e.failureKind, e.jobId, e.step, e.circuitOpenUntil]),
    [['codex', null, 'striking', 'worker-start', 'op-a-1', 'launch-trust', null], ['codex', 'striking', 'unavailable', 'worker-start', 'op-a-2', 'launch-trust', until]]);
  const at = (now, attempts, held = []) => answers({ ...snapshot({ now, providerEvents: facts.providerEvents, workflows: [workflow({ attempts })] }) }, { workflows: [{ held }] })['pl-network-loss'];
  const open = at(NOW + 10 * MIN, []);
  assert.equal(open.state, 'ok');
  assert.match(open.evidence, /1 provider outage\(s\): 1 open, 0 closed/);
  assert.match(open.evidence, /codex worker-start at launch-trust \(op-a-2\)/);
  const resumed = at(NOW + 120 * MIN, [{ provider: 'codex', dispatchedAt: until + 5 * MIN }]);
  assert.equal(resumed.state, 'ok');
  assert.match(resumed.evidence, /1 closed \(1 followed by new work of that provider\)/);
  const stuck = at(NOW + 120 * MIN, [{ provider: 'claude', dispatchedAt: until + 5 * MIN }], [{ hold: 'circuit-open' }]);
  assert.equal(stuck.state, 'attention');
  assert.match(stuck.evidence, /closed over [0-9]+ min ago while work is still held by circuit-open: codex/);
  s.m.setProviderHealth({ provider: 'codex', status: 'recovered', failureKind: 'worker-start', detail: { jobId: 'op-a-3' } });
  const recovered = machineFacts({ env: s.env }).providerEvents.at(-1);
  assert.deepEqual([recovered.to, recovered.circuitOpenUntil], ['recovered', null]);
});

test('a circuit with no recorded end closes at the next transition of the provider out of unavailable, and a circuit still unavailable with no end stays open', () => {
  const row = (seq, to, at, over = {}) => ({ seq, provider: 'codex', to, at, failureKind: 'worker-start', jobId: `op-${seq}`, step: 'launch-trust', circuitOpenUntil: null, ...over });
  const closed = outageEpisodes([row(1, 'unavailable', 1000), row(2, 'striking', 5000)], 9000);
  assert.deepEqual(closed.map((e) => [e.from, e.until, e.open]), [[1000, 5000, false]]);
  assert.deepEqual(outageEpisodes([row(1, 'unavailable', 1000)], 9000).map((e) => [e.until, e.open]), [[null, true]]);
  assert.deepEqual(outageEpisodes([row(1, 'unavailable', 1000, { circuitOpenUntil: 3000 }), row(2, 'recovered', 8000)], 9000).map((e) => [e.until, e.open]), [[3000, false]], 'the cooldown ended before the recovery row');
});

// ------------------------------------------------------------------------------------------------ cu-live-state-untouched

test('an engine that starts on another revision records the swap with what the start performed; the same revision records none', (t) => {
  const s = store(t);
  const engine = (rev) => ({ rev, state: s.m, now: () => NOW, queue: { rearmParked: () => ['host seat:supervisor'] }, log: (kind, msg, data) => s.m.log({ actor: 'reconciler', kind: 'reconciler.event', msg, data }) });
  const boot = () => ({ bootAt: 1, uptimeMs: 1, bootId: 'b' });
  const reap = () => ({ released: [{ id: 'r1' }, { id: 'r2' }], kept: [], held: [] });
  startRecovery(engine('a'.repeat(40)), { reevaluated: false }, { reap, boot });
  assert.deepEqual(machineFacts({ env: s.env }).runtimeChange, [], 'the first engine has no previous revision to differ from');
  startRecovery(engine('a'.repeat(40)), { reevaluated: false }, { reap, boot });
  assert.deepEqual(machineFacts({ env: s.env }).runtimeChange, [], 'the same revision is no change');
  startRecovery(engine('b'.repeat(40)), { reevaluated: false }, { reap, boot });
  const [change] = machineFacts({ env: s.env }).runtimeChange;
  assert.deepEqual([change.cause, change.fromRev, change.toRev], ['engine-start', 'a'.repeat(40), 'b'.repeat(40)]);
  assert.deepEqual(change.applied, [{ action: 'engine-restarted', count: 1 }, { action: 'provider-receipts-released', count: 2 }, { action: 'queue-rearmed', count: 1 }]);
  assert.match(change.schemas.machine, /^starci\/machine@1#\d+$/);
  const verdict = answers(snapshot({ runtimeChanges: [change] }))['cu-live-state-untouched'];
  assert.equal(verdict.state, 'ok');
  assert.match(verdict.evidence, /none closed, restarted or rewrote a terminal, ledger or product file; they released 2 dead receipt\(s\), re-armed 1 queue key/);
});

test('a swap that lists a live touch, or that moves a store schema, is a departure; a land re-look is recorded as a swap too', () => {
  const clean = swapRow({ cause: 'land', toRev: 'c'.repeat(40), applied: [{ action: 'workflows-looked-at', count: 3 }, { action: 'kernel-doorbells-rung', count: 1 }] }).data;
  const closing = swapRow({ cause: 'engine-start', fromRev: 'a'.repeat(40), toRev: 'b'.repeat(40), applied: [{ action: 'terminal-closed', count: 1 }] }).data;
  assert.equal(answers(snapshot({ runtimeChanges: [clean] }))['cu-live-state-untouched'].state, 'ok');
  const bad = answers(snapshot({ runtimeChanges: [clean, closing] }))['cu-live-state-untouched'];
  assert.equal(bad.state, 'attention');
  assert.match(bad.evidence, /1 revision change\(s\) touched live state: bbbbbbbbb terminal-closed/);
  const migrated = { ...clean, schemas: { ...clean.schemas, ledger: 'starci/runtime@1#2' } };
  assert.match(answers(snapshot({ runtimeChanges: [clean, migrated] }))['cu-live-state-untouched'].evidence, /store-migrated/);
});

// ------------------------------------------------------------------------------------------------ co-secret-in-transcript

const PLANTED = Object.freeze({
  'aws-access-key': `AKIA${'ABCDEFGHIJKLMNOP'}`,
  'github-token': `ghp_${'a1'.repeat(20)}`,
  'anthropic-key': `sk-ant-${'x9'.repeat(14)}`,
  jwt: `eyJ${'a'.repeat(12)}.eyJ${'b'.repeat(12)}.${'c'.repeat(12)}`,
  'url-credentials': 'https://deploy:Pl4nt3dPassw0rd@registry.example/x',
  'auth-header': 'Authorization: Bearer abcdef0123456789xyz',
  'url-secret': 'GET /callback?access_token=abc123def456ghi',
  'env-secret': 'MY_SERVICE_API_KEY=planted-env-value-42',
  'keyed-secret': 'password = planted-keyed-value-42',
  otp: 'verification code: 482913',
  'private-key-block': `${['-----BEGIN', 'RSA', 'PRIVATE', 'KEY-----'].join(' ')}\n${randomBytes(24).toString('base64')}\n${['-----END', 'RSA', 'PRIVATE', 'KEY-----'].join(' ')}`,
});

test('the scan names the artifact and the rule of every kind of secret that survived, counts it, and never returns the text', () => {
  for (const [rule, planted] of Object.entries(PLANTED)) {
    const hits = scanText({ artifact: 'attempt-transcript:Shop/9', kind: 'transcript', text: `line one\n${planted}\nline three` });
    assert.ok(hits.some((h) => h.rule === rule), `${rule} is found in ${JSON.stringify(hits)}`);
    assert.ok(hits.every((h) => h.artifact === 'attempt-transcript:Shop/9' && h.count >= 1));
    assert.doesNotMatch(JSON.stringify(hits), new RegExp(planted.slice(8, 20).replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)), `${rule}: no text of the match leaves the scan`);
    assert.deepEqual(survivingSecrets(redactText(planted)), [], `${rule}: what redaction wrote reports no hit`);
  }
});

test('a stored blob is scanned through the blob seam; an unreadable one is counted, never guessed', () => {
  const blobs = new Map([['s1', Buffer.from(`ok\n${PLANTED.jwt}\n`)], ['s2', Buffer.from('nothing here')]]);
  const scan = scanBlobs([{ artifact: 'seat-snapshot:kernel-a', kind: 'transcript', sha: 's1' }, { artifact: 'sup-report:3', kind: 'report', sha: 's2' }, { artifact: 'sup-report:4', kind: 'report', sha: 'gone' }],
    { maxBytes: 1000, readBlob: (sha) => { if (!blobs.has(sha)) throw new Error('blob not found'); return blobs.get(sha); } });
  assert.deepEqual([scan.scanned, scan.unreadable, scan.hits.map((h) => [h.artifact, h.rule])], [2, 1, [['seat-snapshot:kernel-a', 'jwt']]]);
  assert.equal(scanBlobs([{ artifact: 'x', kind: 'report', sha: 's1' }], { maxBytes: 8, readBlob: (sha) => blobs.get(sha) }).hits.length, 0, 'only the first maxBytes are read');
});

test('the digest scans the machine log rows and blobs it reads, answers the question and lists the survivor as a problem of the runtime', (t) => {
  const s = store(t);
  s.m.log({ actor: 'reconciler', kind: 'reconciler.event', msg: 'clean line', data: { note: 'nothing secret' } });
  s.m.db.prepare("INSERT INTO machine_logs(at,actor,level,kind,msg,data_json) VALUES(?,?,?,?,?,?)").run(NOW, 'worker', 'info', 'worker.output', `leaked ${PLANTED['github-token']}`, JSON.stringify({ line: PLANTED['env-secret'] }));
  const seq = s.m.db.prepare("SELECT MAX(seq) AS seq FROM machine_logs").get().seq;
  const facts = machineFacts({ env: s.env });
  assert.deepEqual(facts.secrets.hits.map((h) => [h.artifact, h.kind, h.rule]).sort(), [[`machine-log:${seq}`, 'log', 'env-secret'], [`machine-log:${seq}`, 'log', 'github-token']].sort());
  const d = digest(snapshot({ secrets: facts.secrets }));
  const verdict = answers(snapshot({ secrets: facts.secrets }), d)['co-secret-in-transcript'];
  assert.equal(verdict.state, 'attention');
  assert.match(verdict.evidence, new RegExp(`machine-log:${seq} \\(github-token\\)`));
  assert.doesNotMatch(JSON.stringify([verdict, d.problems]), /ghp_|planted-env-value/, 'neither the answer nor the problem list carries the text');
  const problem = d.problems.find((p) => p.code === 'secret-survived');
  assert.equal(problem.role, 'runtime');
  assert.equal(d.problems.filter((p) => p.code === 'secret-survived').length, 2);
  assert.equal(answers(snapshot({ secrets: { scanned: 12, unreadable: 1, hits: [] } }))['co-secret-in-transcript'].state, 'ok');
});

// ------------------------------------------------------------------------------------------------ rr-claimed-vs-observed

test('a clock of a drift code that outlives its bound writes one open signal and, when it clears, one cleared signal; the question reads them', async (t) => {
  const s = store(t);
  const ctx = { mode: 'shadow', env: s.env, machine: s.m, stateFile: s.m.file, now: () => NOW + 40 * MIN, openDecision: async () => ({ ok: true, shadow: true }) };
  await setClock(ctx, { entity: 'host:terminals', state: 'TERMINAL_COUNT_DRIFT', slaMs: 10 * MIN, ledgerId: 'supervisor', enteredAt: NOW + 20 * MIN });
  await setClock(ctx, { entity: 'workflow:shop:wf-1', state: 'STALL_UNOWNED', slaMs: 10 * MIN, ledgerId: 'shop', enteredAt: NOW });
  const passed = await slaPass(ctx);
  assert.equal(passed.violated.length, 2);
  const rows = () => machineFacts({ env: s.env }).hostDrift;
  assert.deepEqual(rows().map((r) => [r.driftKind, r.code, r.entity, r.state]), [['terminal', 'TERMINAL_COUNT_DRIFT', 'host:terminals', 'open']], 'only the code that names a driftKind is a host-ledger drift');
  assert.equal(answers(snapshot({ hostDrift: rows() }))['rr-claimed-vs-observed'].state, 'attention');
  s.m.clearSla({ entity: 'host:terminals', state: 'TERMINAL_COUNT_DRIFT' });
  await slaPass({ ...ctx, now: () => NOW + 50 * MIN });
  assert.deepEqual(rows().map((r) => r.state), ['open', 'cleared']);
  const settled = answers(snapshot({ hostDrift: rows() }))['rr-claimed-vs-observed'];
  assert.equal(settled.state, 'ok');
  assert.match(settled.evidence, /1 drift\(s\) outlived their bound \(terminal\); 1 cleared/);
  assert.equal(answers(snapshot({ hostDrift: [] }))['rr-claimed-vs-observed'].state, 'ok');
});

test('every drift kind a code names is one the event declares', () => {
  const doc = fs.readFileSync(new URL('../../modules/reconciler/sla.yaml', import.meta.url), 'utf8');
  const kinds = [...doc.matchAll(/driftKind: (\w+)/g)].map((x) => x[1]);
  assert.ok(kinds.length >= 6);
  assert.deepEqual(kinds.filter((k) => !DRIFT_KINDS.includes(k)), []);
});

// ------------------------------------------------------------------------------------------------ cc-port-claims

test('the claims of a port are recorded with the holder and the connect probe; two grants without a release are two claimants, a stranger refused is the happy outcome', async (t) => {
  const s = store(t);
  const probe = (state) => async () => ({ state });
  await portClaimer({ port: 3000, envId: 'environment.shop.dev', service: 'web', env: s.env, probe: probe('down') })('claimed', { pid: 41 });
  await portClaimer({ port: 3000, envId: 'environment.blog.dev', service: 'web', env: s.env, probe: probe('answered') })('refused', { pid: 41 });
  let rows = machineFacts({ env: s.env }).portClaim;
  assert.deepEqual(rows.map((r) => [r.port, r.claimant, r.outcome, r.holderPid, r.connects]),
    [[3000, 'environment.shop.dev/web', 'claimed', 41, null], [3000, 'environment.blog.dev/web', 'refused', 41, true]]);
  const ok = answers(snapshot({ portClaims: rows }))['cc-port-claims'];
  assert.equal(ok.state, 'ok');
  assert.match(ok.evidence, /2 claim\(s\) on 1 port\(s\); 1 refused because a stranger held the port; 3000 held by environment\.shop\.dev\/web/);
  await portClaimer({ port: 3000, envId: 'environment.blog.dev', service: 'web', env: s.env, probe: probe('down') })('claimed', { pid: 52 });
  rows = machineFacts({ env: s.env }).portClaim;
  const bad = answers(snapshot({ portClaims: rows }))['cc-port-claims'];
  assert.equal(bad.state, 'attention');
  assert.match(bad.evidence, /two claimants hold 3000: environment\.shop\.dev\/web and environment\.blog\.dev\/web/);
  await portClaimer({ port: 3000, envId: 'environment.shop.dev', service: 'web', env: s.env, probe: probe('down') })('released', { pid: 41 });
  assert.equal(answers(snapshot({ portClaims: [] }))['cc-port-claims'].state, 'unknown');
});

test('a port held by a stale server of another claimant that a claim stops is named', () => {
  const rows = [{ seq: 1, port: 4000, claimant: 'a/web', outcome: 'claimed' }, { seq: 2, port: 4000, claimant: 'b/web', outcome: 'replaced', previous: 'a/web' }, { seq: 3, port: 4000, claimant: 'b/web', outcome: 'claimed' }];
  const verdict = answers(snapshot({ portClaims: rows }))['cc-port-claims'];
  assert.equal(verdict.state, 'attention');
  assert.match(verdict.evidence, /a live server was stopped for another claimant, 4000: b\/web stopped a\/web/);
  assert.equal(SIGNAL.portClaim, 'signal.port-claim');
});

test('the collector hands the five signals and the attempt transcripts to the snapshot', async (t) => {
  const s = store(t);
  s.m.setProviderHealth({ provider: 'claude', status: 'unavailable', failureKind: 'quota', circuitOpenUntil: NOW + MIN, detail: { jobId: 'op-q-1', step: 'worker-screen' } });
  const blobs = new Map([['t1', Buffer.from(`transcript\n${PLANTED['auth-header']}\n`)]]);
  const wf = { id: 'wf-1', name: 'Shop', phase: 'running', jobs: [], incidents: [], decisions: [], attempts: [{ attemptId: 5, transcriptSha: 't1', settledAt: NOW }], events: [] };
  const snap = await collectSnapshot({ env: s.env, now: NOW, liveRev: () => 'a'.repeat(40), readBlob: (sha) => blobs.get(sha),
    run: async () => ({ ok: true, stdout: '{"ok":true}', error: null }), ledger: () => [wf], history: () => [],
    machine: (o) => ({ ...machineFacts({ ...o, env: s.env }), ledgers: [{ name: 'shop', repo_root: 'work/shop', file: 'f' }] }) });
  assert.deepEqual(snap.providerEvents.map((e) => [e.provider, e.to, e.failureKind, e.step]), [['claude', 'unavailable', 'quota', 'worker-screen']]);
  assert.deepEqual(snap.secrets.hits.map((h) => [h.artifact, h.rule]), [['attempt-transcript:Shop/5', 'auth-header']]);
  assert.deepEqual([snap.runtimeChanges, snap.hostDrift, snap.portClaims], [[], [], []]);
});
