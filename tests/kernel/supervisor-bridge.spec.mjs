import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { inspectLedger, ledgerFileFor, openLedger } from '../../engine/db/ledger.mjs';
import { claimFoundation, declareDependent, readFoundation, writeFoundation } from '../../scripts/kernel/foundations.mjs';
import { HUB_STUCK_MS, RECORD_CHANGE_REFUSED, dependencyGraph, foundationAliasKey, readBridges } from '../../scripts/kernel/dependency-graph.mjs';
import { createOwnership } from '../../scripts/kernel/work-ownership.mjs';
import { approvalOf, commandFor, main } from '../../scripts/supervisor/bridge.mjs';
import { readMachine } from '../../engine/db/machine.mjs';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';

// The [Supervisor] adds supplementary (bridging) workflows when two workflows depend on
// each other and reorganizes workflows. Fixture ledgers reproduce the three shapes it must find - a circular wait,
// a shared need nobody owns, duplicated work - and a seam: module-studio and collab-group-chat both waiting
// on ONE queued repair job of workspace-provision (op-e2e.verify-9fb01b4fe6), bridged by a Supervisor workflow.
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const json = (text) => { try { return JSON.parse(text); } catch { return null; } };
const WSPV = 'wf-app-workspace-provision', STUDIO = 'wf-app-module-studio', COLLAB = 'wf-app-collab', MOD = 'wf-app-modules', AUTH = 'wf-app-auth', OLD = 'wf-app-fe-debt';
const JOB = 'op-e2e.verify-9fb01b4fe6';

const fixture = (t, { workflows = [WSPV, STUDIO, COLLAB, MOD, AUTH, OLD] } = {}) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-bridge-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const repo = path.join(root, 'repo');
  fs.mkdirSync(repo, { recursive: true });
  const env = { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(root, 'machine.sqlite'), STARCI_PROJECTS_ROOT: path.join(root, 'projects') };
  const priorProjectsRoot = process.env.STARCI_PROJECTS_ROOT;
  process.env.STARCI_PROJECTS_ROOT = env.STARCI_PROJECTS_ROOT;
  t.after(() => { if (priorProjectsRoot === undefined) delete process.env.STARCI_PROJECTS_ROOT; else process.env.STARCI_PROJECTS_ROOT = priorProjectsRoot; });
  for (const key of ['ORCA_TERMINAL_HANDLE', 'STARCI_ROLE', 'STARCI_OP_JOB']) delete env[key];
  const seed = (fn) => { const l = openLedger({ file: ledgerFileFor(repo, { env }) }); try { return l.transaction(() => fn(l)); } finally { l.close(); } };
  const read = (fn) => { const l = inspectLedger({ file: ledgerFileFor(repo, { env }) }); try { return fn(l.db); } finally { l.close(); } };
  seed((ledger) => {
    const at = Date.now() - 10 * 3_600_000;
    workflows.forEach((workflowId, i) => {
      ledger.ensureWorkflow({ workflowId, title: workflowId.replace(/^wf-/, ''), ledgerMode: 'durable', sourceRoots: [repo] });
      const from = ledger.db.prepare('SELECT phase FROM workflows WHERE workflow_id=?').get(workflowId).phase;
      if (from !== 'running') ledger.db.prepare('INSERT INTO lifecycle_changes(workflow_id,from_phase,to_phase,by,reason,at) VALUES(?,?,?,?,?,?)')
        .run(workflowId, from, 'running', 'test-fixture', 'seed', at + i * 1000);
      ledger.db.prepare("UPDATE workflows SET phase='running',created_at=? WHERE workflow_id=?").run(at + i * 1000, workflowId);
      ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
        .run(workflowId, 0, `goal-${workflowId}`, '# goal', JSON.stringify({ derivedFrom: 'bridge-spec' }), at);
    });
  });
  const job = (workflowId, jobId, { status = 'queued', paths = [], ago = 0 } = {}) => {
    const at = Date.now() - ago;
    const opId = jobId.replace(/^op-/, '').replace(/-[0-9a-f]{10}$/, '');
    const ledger = openLedger({ file: ledgerFileFor(repo, { env }) });
    try { seedWorkflow(ledger, { id: workflowId, now: at, jobs: [{ jobId, opId, status, createdAt: at, updatedAt: at,
      payload: { opId, owned_paths: paths, title: `${jobId} title` } }] }); } finally { ledger.close(); }
  };
  const api = (args) => spawnSync(process.execPath, [API, ...args, '--repo', repo, '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000, env });
  const ok = (args) => { const r = api(args); assert.equal(r.status, 0, `${args.join(' ')}: ${r.stderr || r.stdout}`); return json(r.stdout); };
  const bridge = (argv) => main([...argv, '--repo', repo, '--no-notify'], { env });
  const ago = (incidentId, ms) => seed((ledger) => {
    const raised = ledger.db.prepare("SELECT workflow_id,payload_json FROM events WHERE entity_type='incident' AND entity_id=? AND kind='incident-raised' ORDER BY seq DESC LIMIT 1").get(incidentId);
    ledger.appendEvent({ workflowId: raised.workflow_id, entityType: 'incident', entityId: incidentId, kind: 'incident-raised',
      payload: JSON.parse(raised.payload_json), createdAt: Date.now() - ms });
  });
  return { root, repo, env, seed, read, job, api, ok, bridge, ago };
};

test('alias keys fold one foundation spelled two ways', () => {
  assert.equal(foundationAliasKey('app.brand'), 'brand');
  assert.equal(foundationAliasKey('starci-grammar'), 'grammar');
  assert.equal(foundationAliasKey('shell'), 'layout-tree');
  assert.equal(foundationAliasKey('layout-tree'), 'layout-tree');
  assert.throws(() => approvalOf({}, { autopilot: false }), { code: 'autopilot-off' });
  assert.deepEqual(approvalOf({ 'owner-ok': true }, { autopilot: false }), { approvedBy: 'owner', provisional: false });
  assert.deepEqual(approvalOf({}, { autopilot: true }), { approvedBy: 'supervisor-autopilot', provisional: true });
});

test('circular wait: found, designated, and the lead side released', async (t) => {
  const fx = fixture(t, { workflows: [STUDIO, WSPV] });
  const a = fx.ok(['incident', '--workflow', STUDIO, '--kind', 'peer-wait', '--peer', WSPV, '--detail', 'studio waits for the provisioning seam']);
  const b = fx.ok(['incident', '--workflow', WSPV, '--kind', 'peer-wait', '--peer', STUDIO, '--detail', 'provisioning waits for the studio registry']);
  // WSPV is waited on by one more workflow outside the cycle? No: equal weight, so the older (STUDIO) leads.
  const graph = fx.read((db) => dependencyGraph(db, { repo: fx.repo }));
  const cycle = graph.findings.find((f) => f.kind === 'circular-wait');
  assert.ok(cycle, JSON.stringify(graph.findings));
  assert.deepEqual(cycle.workflows, [STUDIO, WSPV].sort());
  assert.equal(cycle.proposal.action, 'designate');
  assert.equal(cycle.proposal.owner, STUDIO, 'equal waiters: the oldest workflow leads');
  assert.deepEqual(cycle.proposal.releases, [a.incidentId]);
  assert.equal(cycle.proposal.clearCut, true);
  assert.match(commandFor(fx.repo, cycle), /designate .*--lead wf-app-module-studio --waiter wf-app-workspace-provision --releases inc-/);

  const out = await fx.bridge(['designate', '--lead', STUDIO, '--waiter', WSPV, '--reason', 'break the seam cycle', '--finding', cycle.key]);
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.deepEqual(out.resolved.map((r) => r.incidentId), [a.incidentId]);
  fx.read((db) => {
    assert.equal(db.prepare('SELECT status FROM incidents WHERE incident_id=?').get(a.incidentId).status, 'resolved');
    assert.equal(db.prepare('SELECT status FROM incidents WHERE incident_id=?').get(b.incidentId).status, 'open', 'the waiter keeps waiting on the lead');
    const resolved = json(db.prepare("SELECT payload_json FROM events WHERE entity_id=? AND kind='incident-resolved' ORDER BY seq DESC LIMIT 1").get(a.incidentId).payload_json);
    assert.equal(resolved.by, 'supervisor');
    const [rec] = readBridges(db);
    assert.deepEqual([rec.action, rec.state, rec.provisional, rec.approvedBy, rec.owner, rec.waiter], ['designate', 'applied', true, 'supervisor-autopilot', STUDIO, WSPV]);
    assert.ok(db.prepare("SELECT 1 FROM events WHERE kind='supervisor-cycle-designated' AND workflow_id=?").get(WSPV));
    assert.equal(dependencyGraph(db, { repo: fx.repo }).findings.filter((f) => f.kind === 'circular-wait').length, 0, 'the cycle is gone');
  });
  // machine.sqlite sup_events records the action for the SLA (scripts/supervisor/actions.mjs reads supervisor-action).
  const [row] = readMachine((m) => m.supEvents({ kind: 'supervisor-action' }), [], { env: fx.env });
  assert.deepEqual([row.payload.item, row.payload.action], [cycle.key, 'designate']);
});

test('shared unowned need: an alias merges into the owned foundation, a stopped owner hands over', async (t) => {
  const fx = fixture(t);
  fx.seed((ledger) => {
    const db = ledger.db, now = Date.now();
    writeFoundation(db, claimFoundation(null, { name: 'brand', workflowId: MOD, ownerRunning: false, kind: 'brand', now }).record, now);
    writeFoundation(db, declareDependent(null, { name: 'app.brand', workflowId: AUTH, now }).record, now);
    let contract = claimFoundation(null, { name: 'fe-contract', workflowId: OLD, ownerRunning: false, kind: 'contract', now }).record;
    contract = declareDependent(contract, { name: 'fe-contract', workflowId: COLLAB, now }).record;
    writeFoundation(db, contract, now);
    db.prepare('UPDATE workflows SET archived_at=? WHERE workflow_id=?').run(now, OLD);
  });
  const graph = fx.read((db) => dependencyGraph(db, { repo: fx.repo }));
  const alias = graph.findings.find((f) => f.key === 'unowned-need|foundation:app.brand');
  assert.deepEqual([alias.kind, alias.proposal.action, alias.proposal.mergeInto, alias.proposal.to, alias.proposal.clearCut], ['unowned-need', 'transfer', 'brand', MOD, true]);
  const stopped = graph.findings.find((f) => f.key === 'unowned-need|foundation:fe-contract');
  assert.deepEqual([stopped.proposal.action, stopped.proposal.to, stopped.proposal.clearCut], ['transfer', COLLAB, false]);
  assert.match(stopped.summary, /owner wf-app-fe-debt is not running/);

  const merged = await fx.bridge(['transfer', '--foundation', 'app.brand', '--merge-into', 'brand', '--reason', alias.proposal.why, '--finding', alias.key]);
  assert.equal(merged.ok, true, JSON.stringify(merged));
  const moved = await fx.bridge(['transfer', '--foundation', 'fe-contract', '--to', COLLAB, '--reason', 'its owner stopped; collab builds it']);
  assert.deepEqual([moved.from, moved.to, moved.provisional], [OLD, COLLAB, true]);
  fx.read((db) => {
    assert.deepEqual(readFoundation(db, 'brand').dependents.map((d) => d.workflowId), [AUTH]);
    assert.equal(readFoundation(db, 'app.brand').mergedInto, 'brand');
    const fe = readFoundation(db, 'fe-contract');
    assert.deepEqual([fe.owner.workflowId, fe.owner.by, fe.dependents.length, fe.history.at(-1).event], [COLLAB, 'supervisor', 0, 'transferred']);
    const after = dependencyGraph(db, { repo: fx.repo });
    assert.equal(after.findings.filter((f) => f.kind === 'unowned-need').length, 0, JSON.stringify(after.findings));
    assert.deepEqual(readBridges(db).map((b) => b.action), ['transfer', 'transfer']);
  });
  // A record transfer is rule 0 of the ownership resolver.
  fx.job(MOD, 'op-work.author-aaaaaaaaaa', { paths: ['.starciwork/features/brand-kit'] });
  const rec = await fx.bridge(['transfer', '--record', '.starciwork/features/brand-kit', '--to', AUTH, '--reason', 'auth builds the kit now']);
  assert.deepEqual([rec.from, rec.to], [MOD, AUTH]);
  fx.read((db) => assert.deepEqual(createOwnership(db, { repo: fx.repo })('.starciwork/features/brand-kit/index.yaml').by, 'transfer'));
});

test('duplicate work: two workflows own one path; shared wiring is not duplication; a revision is requested', async (t) => {
  const fx = fixture(t, { workflows: [MOD, COLLAB] });
  fx.job(MOD, 'op-backend.implement-1111111111', { paths: ['src/modules/chat', 'src/app.module.ts'] });
  fx.job(COLLAB, 'op-backend.implement-2222222222', { paths: ['src/modules/chat/gateway', 'src/app.module.ts'] });
  const graph = fx.read((db) => dependencyGraph(db, { repo: fx.repo }));
  const dup = graph.findings.find((f) => f.kind === 'duplicate-work');
  assert.ok(dup, JSON.stringify(graph.findings));
  assert.deepEqual(dup.evidence.map((e) => e.path), ['src/modules/chat'], 'app.module.ts is shared wiring');
  assert.deepEqual([dup.proposal.action, dup.proposal.workflow, dup.proposal.keeps, dup.proposal.clearCut], ['revise', COLLAB, MOD, false]);

  const out = await fx.bridge(['revise', '--workflow', COLLAB, '--text', 'Collab group chat without the chat gateway (Modules owns it)', '--reason', dup.summary, '--request-only']);
  assert.equal(out.state, 'requested', JSON.stringify(out));
  fx.read((db) => {
    const [rec] = readBridges(db);
    assert.deepEqual([rec.action, rec.state, rec.workflowId], ['revise', 'requested', COLLAB]);
    assert.ok(rec.preview.token);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM goals WHERE workflow_id=?').get(COLLAB).n, 1, 'a request revises nothing');
  });
});

test('hub blocker: two workflows on one stuck job -> a bridging workflow owns it, their waits move onto it, its landing releases them', async (t) => {
  const fx = fixture(t, { workflows: [WSPV, STUDIO, COLLAB] });
  fx.job(WSPV, JOB, { ago: 4 * 3_600_000, paths: ['src/tests/e2e/app/workspace-provision'] });
  const s = fx.ok(['incident', '--workflow', STUDIO, '--kind', 'peer-wait', '--peer', WSPV, '--until-job', `${JOB}:succeeded`, '--holds', 'op-backend.implement-3333333333', '--detail', `seam settle waits on ${JOB}: TS18046 at workspace-purchase-flow.e2e-spec.ts:1045`]);
  const c = fx.ok(['incident', '--workflow', COLLAB, '--kind', 'peer-wait', '--peer', WSPV, '--until-job', `${JOB}:succeeded`, '--holds', 'op-backend.implement-4444444444', '--detail', `collab seam waits on ${JOB}`]);
  fx.ago(s.incidentId, 3 * 3_600_000); fx.ago(c.incidentId, 3 * 3_600_000);

  const fresh = fx.read((db) => dependencyGraph(db, { repo: fx.repo, now: Date.now() - 2 * 3_600_000 }));
  assert.equal(fresh.findings.find((f) => f.kind === 'hub-blocker').proposal.clearCut, false, `waited < ${HUB_STUCK_MS / 60000}m: not clear-cut yet`);
  const graph = fx.read((db) => dependencyGraph(db, { repo: fx.repo }));
  const hub = graph.findings.find((f) => f.kind === 'hub-blocker');
  assert.deepEqual([hub.blocker, hub.sharedItem, hub.sharedWaiters.sort(), hub.proposal.action, hub.proposal.clearCut], [WSPV, `job:${JOB}`, [COLLAB, STUDIO].sort(), 'bridge', true]);
  assert.match(hub.proposal.goalDraft, /TS18046/);

  const out = await fx.bridge(['bridge', '--blocker', WSPV, '--dependents', `${STUDIO},${COLLAB}`, '--foundation', 'bridge-wspv-e2e-typecheck', '--kind', 'contract',
    '--goal', 'Repair TS18046 at src/tests/e2e/app/workspace-provision/integration/workspace-purchase-flow.e2e-spec.ts:1045 so the repo typecheck is green for every workflow', '--title', 'bridge-wspv-typecheck',
    '--paths', 'src/tests/e2e/app/workspace-provision/integration/workspace-purchase-flow.e2e-spec.ts', '--reason', hub.summary, '--finding', hub.key]);
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(out.rewire.pending, true, 'not running yet: the waits cannot name it');
  const bridgeWf = out.workflowId;
  fx.read((db) => {
    const wf = db.prepare('SELECT phase FROM workflows WHERE workflow_id=?').get(bridgeWf);
    assert.equal(wf.phase, 'queued');
    const goal = json(db.prepare('SELECT json FROM goals WHERE workflow_id=?').get(bridgeWf).json);
    assert.deepEqual([goal.definedBy, goal.provisional, goal.bridge.bridgeId, goal.derivedFrom], ['supervisor', true, out.bridgeId, 'supervisor-bridge']);
    const f = readFoundation(db, 'bridge-wspv-e2e-typecheck');
    assert.deepEqual([f.owner.workflowId, f.owner.by, f.state, f.dependents.map((d) => d.workflowId).sort()], [bridgeWf, 'supervisor', 'claimed', [COLLAB, STUDIO].sort()]);
    const [rec] = readBridges(db);
    assert.deepEqual([rec.action, rec.state, rec.blocker, rec.waits.map((w) => w.incidentId).sort()], ['bridge', 'defined', WSPV, [c.incidentId, s.incidentId].sort()]);
    assert.ok(db.prepare("SELECT 1 FROM events WHERE kind='supervisor-bridge-linked' AND workflow_id=?").get(WSPV));
  });

  // start-workflow would flip it to running; the spec stands in for the Kernel boot.
  fx.seed((ledger) => {
    const from = ledger.db.prepare('SELECT phase FROM workflows WHERE workflow_id=?').get(bridgeWf).phase;
    ledger.db.prepare('INSERT INTO lifecycle_changes(workflow_id,from_phase,to_phase,by,reason,at) VALUES(?,?,?,?,?,?)')
      .run(bridgeWf, from, 'running', 'test-fixture', 'start-workflow', Date.now());
    ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(bridgeWf);
  });
  const rewired = await fx.bridge(['rewire', '--bridge', out.bridgeId]);
  assert.equal(rewired.ok, true, JSON.stringify(rewired));
  assert.equal(rewired.record.state, 'rewired');
  const byWf = Object.fromEntries(rewired.rewired.map((r) => [r.workflowId, r]));
  fx.read((db) => {
    for (const [wf, old, holds] of [[STUDIO, s.incidentId, ['op-backend.implement-3333333333']], [COLLAB, c.incidentId, ['op-backend.implement-4444444444']]]) {
      assert.equal(db.prepare('SELECT status FROM incidents WHERE incident_id=?').get(old).status, 'resolved');
      const raised = json(db.prepare("SELECT payload_json FROM events WHERE entity_id=? AND kind='incident-raised'").get(byWf[wf].to).payload_json);
      assert.deepEqual([raised.kind, raised.peer, raised.untilFoundation, raised.holds], ['peer-wait', bridgeWf, 'bridge-wspv-e2e-typecheck', holds]);
    }
    const g = dependencyGraph(db, { repo: fx.repo });
    assert.equal(g.findings.filter((f) => f.kind === 'hub-blocker').length, 0, `nobody waits on the blocker any more: ${JSON.stringify(g.findings)} ${JSON.stringify(g.edges)}`);
    assert.deepEqual([...new Set(g.edges.filter((e) => e.strength === 'hard').map((e) => e.to))], [bridgeWf]);
  });
  // api status / api peers show the graph and the bridge.
  const status = fx.ok(['status', '--workflow', STUDIO]);
  assert.deepEqual(status.dependencies.waitsOn, [bridgeWf]);
  assert.equal(status.dependencies.bridges[0].id, out.bridgeId);
  const peers = fx.ok(['peers', '--workflow', WSPV]);
  assert.equal(peers.dependencies.bridges[0].workflowId, bridgeWf);
  assert.ok(peers.dependencies.edges.some((e) => e.from === COLLAB && e.to === bridgeWf && e.via === 'until-foundation'));

  // The bridge lands its foundation: every re-typed wait is released.
  const landed = fx.ok(['foundation', '--workflow', bridgeWf, '--land', 'bridge-wspv-e2e-typecheck', '--proof', 'commit abc: tsc --noEmit green']);
  assert.deepEqual(landed.released.map((r) => r.workflowId).sort(), [COLLAB, STUDIO].sort());
});

test('a refused record-change is a soft record-owner dependency', (t) => {
  const fx = fixture(t, { workflows: [MOD, AUTH] });
  fx.seed((ledger) => ledger.appendEvent({ workflowId: AUTH, entityType: 'workflow', entityId: AUTH, kind: RECORD_CHANGE_REFUSED,
    payload: { record: '.starciwork/brand', reach: 'follow-up', owners: [{ file: '.starciwork/brand/index.yaml', workflowId: MOD, by: 'foundation' }] } }));
  const g = fx.read((db) => dependencyGraph(db, { repo: fx.repo }));
  assert.deepEqual(g.edges.map((e) => [e.from, e.to, e.via, e.strength]), [[AUTH, MOD, 'record-owner', 'soft']]);
  assert.equal(g.findings.length, 0, 'a soft edge alone is no finding');
});
