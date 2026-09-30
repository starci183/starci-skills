import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { openLedger, projectsRootFor } from '../engine/ledger-db.mjs';
import { openMachine, projectLedgerFile, readMachine, repoKeyOf } from '../engine/machine-db.mjs';
import {
  ORPHAN_LEDGER_CODE, LEGACY_WORK_SQLITE_CODE, REGISTERED_DIR_MISSING_REASON, archiveOrphanLedger, boundRepoRoots, dateStamp,
  legacyWorkSqliteFindings, orphanLedgerFindings, orphanReason, sourceRootsFromLedgerFile, sourceRootsOf, starciSourceRoot,
  sweepOrphanLedgers, workspaceBoundRepoRoots,
} from '../scripts/lib/hk-orphan-ledgers.mjs';

// The two ledger-hygiene findings of COOK-BRIEF F4 handover (incident 2026-09-30): a registered ledger whose bound
// repo(s) are gone (orphan) and a bound repo that still has an in-repo .starciwork/runtime.sqlite (legacy).
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** A sandbox whose state root is entirely its own: env.STARCI_LOCAL_ROOT resolves machine.sqlite, projects/ and
 * archive/ all under it (engine/machine-db.mjs starciLocalRoot), so every function under test stays inside the
 * fixture and never reads or writes the real %LOCALAPPDATA%/StarCi. Sitting under the OS temp dir also makes the
 * fixture's own machine.sqlite handle `live:false` (isUnderTempDir), so registerLedger accepts fixture repo roots
 * a live registry would refuse (registry-temp-repo) — exactly the gap that let the real incident's ledgers in. */
function sandbox(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-orphan-ledgers-')));
  t.after(() => { try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* best effort */ } });
  return { root, env: { STARCI_LOCAL_ROOT: root } };
}

/** A ledger row plus a real runtime.sqlite file at its registered location, so archiveOrphanLedger has bytes to move. */
function makeLedger(env, { ledgerId, repoRoot, state = null }) {
  const file = projectLedgerFile(ledgerId, env);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, 'not a real sqlite file, just fixture bytes');
  const m = openMachine({ env });
  try {
    assert.equal(m.live, false, 'the fixture machine.sqlite sits under the OS temp dir, so it never enforces the live registry refusals');
    const r = m.registerLedger({ ledgerId, name: ledgerId, repoRoot, file });
    assert.equal(r.registered, true, r.refused);
    if (state) m.setLedgerState(ledgerId, state, { reason: 'fixture' });
  } finally { m.close(); }
  return file;
}

/**
 * A valid runtime.sqlite at `file`, with one workflow carrying `sourceRoots` (or none) — but never registered in
 * machine.sqlite (openLedger's auto-register only fires when the ledger's own meta names a repo_root; passing
 * repoRoot:null skips it), exactly the shape a ledger the registry has forgotten still has on disk.
 */
function makeUnregisteredLedger(file, { workflowId = 'wf-orphan-fixture-one', sourceRoots = null } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const ledger = openLedger({ file, repoRoot: null });
  try { ledger.write.createWorkflow({ workflowId, phase: 'awaiting-approval', sourceRoots }); } finally { ledger.close(); }
}

/** A .workspaces/projects/<name>/work.json under `sourceRoot` (modules/schemas/workspace-routing.yaml bindingShape). */
function makeWorkspaceBinding(sourceRoot, name, repositories) {
  const dir = path.join(sourceRoot, '.workspaces', 'projects', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'work.json'), JSON.stringify({ schema: 'starci/workspace-binding@1', project: name, repositories, work: { ownerRole: 'be', pathFromRepository: '.starciwork' } }));
}

test('orphanReason: no roots, every root unreachable, and at least one reachable', () => {
  assert.equal(orphanReason([]), 'no-source-roots');
  assert.equal(orphanReason(['/a', '/b'], { unreachable: () => true }), 'source-roots-unreachable');
  assert.equal(orphanReason(['/a', '/b'], { unreachable: (r) => r === '/a' }), null, 'one reachable root is enough');
});

test('dateStamp is YYYYMMDD, matching blob-gc.mjs and purge-workflow.mjs', () => {
  assert.equal(dateStamp(Date.UTC(2026, 8, 30, 12, 0, 0)), '20260930');
});

test('legacyWorkSqliteFindings is pure: it never opens a database, only checks the filesystem', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-legacy-store-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const clean = path.join(root, 'clean-repo'), legacy = path.join(root, 'legacy-repo'), missing = path.join(root, 'no-such-repo');
  fs.mkdirSync(path.join(clean, '.starciwork'), { recursive: true });
  fs.mkdirSync(path.join(legacy, '.starciwork'), { recursive: true });
  fs.writeFileSync(path.join(legacy, '.starciwork', 'runtime.sqlite'), 'x');
  fs.writeFileSync(path.join(legacy, '.starciwork', 'runtime.sqlite-wal'), 'x');
  const found = legacyWorkSqliteFindings([clean, legacy, missing, legacy, repoKeyOf(legacy)]); // a duplicate root is deduped across separator styles
  assert.equal(found.length, 1);
  assert.equal(found[0].code, LEGACY_WORK_SQLITE_CODE);
  assert.equal(found[0].repoRoot, repoKeyOf(legacy)); // the canonical registry form (machine-db.mjs repoKey), not the raw OS path
  assert.deepEqual(found[0].files.map((f) => path.basename(f)).sort(), ['runtime.sqlite', 'runtime.sqlite-wal']);
});

test('sourceRootsOf unions machine.sqlite repositories rows with the ledger\'s own repo_root, deduped', (t) => {
  const { env } = sandbox(t);
  const repoA = REPO_ROOT, repoB = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-repo-b-'));
  t.after(() => fs.rmSync(repoB, { recursive: true, force: true }));
  makeLedger(env, { ledgerId: 'multi-repo', repoRoot: repoA });
  const w = openMachine({ env });
  try {
    w.upsertRepository({ repoRoot: repoB, name: 'b', role: 'frontend', ledgerId: 'multi-repo' });
    const ledger = w.listLedgers().find((l) => l.ledgerId === 'multi-repo');
    const roots = sourceRootsOf(w.db, ledger);
    assert.deepEqual([...roots].sort(), [repoKeyOf(repoA), repoKeyOf(repoB)].sort());
  } finally { w.close(); }
});

test('orphanLedgerFindings: a temp/missing-repo ledger is reported, a good one and a retired one are not', (t) => {
  const { env } = sandbox(t);
  const orphanTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-orphan-repo-'));
  const orphanMissing = path.join(REPO_ROOT, 'no-such-dir-hk-orphan-ledgers-spec'); // not under temp: exercises the "gone", not the "temp", branch
  makeLedger(env, { ledgerId: 'orphan-temp', repoRoot: orphanTemp });
  makeLedger(env, { ledgerId: 'orphan-missing', repoRoot: orphanMissing });
  makeLedger(env, { ledgerId: 'good-ledger', repoRoot: REPO_ROOT });
  makeLedger(env, { ledgerId: 'retired-temp', repoRoot: orphanTemp, state: 'retired' });
  const found = orphanLedgerFindings({ env });
  assert.deepEqual(found.map((f) => `${f.ledgerId}:${f.reason}`).sort(), ['orphan-missing:source-roots-unreachable', 'orphan-temp:source-roots-unreachable'].sort());
  assert.ok(found.every((f) => f.code === ORPHAN_LEDGER_CODE && f.registered === true));
});

test('sourceRootsFromLedgerFile reads workflows.source_roots_json from an orphaned ledger\'s own runtime.sqlite', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-orphan-file-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.deepEqual(sourceRootsFromLedgerFile(path.join(root, 'no-such-ledger', 'runtime.sqlite')), [], 'a missing file yields no roots, never throws');

  const noneFile = path.join(root, 'none', 'runtime.sqlite');
  makeUnregisteredLedger(noneFile, { sourceRoots: null });
  assert.deepEqual(sourceRootsFromLedgerFile(noneFile), [], 'a workflow with no source_roots_json (6335dccf in the 2026-09-30 incident) yields no roots');

  const oneFile = path.join(root, 'one', 'runtime.sqlite');
  const probeRepo = 'C:/Users/x/AppData/Local/Temp/probe-x/repo';
  makeUnregisteredLedger(oneFile, { sourceRoots: [probeRepo] });
  assert.deepEqual(sourceRootsFromLedgerFile(oneFile), [probeRepo]);
});

test('orphanLedgerFindings: a ledger directory the registry no longer names at all is still found (the follow-up gap)', (t) => {
  const { env } = sandbox(t);
  const projectsDir = projectsRootFor(env);
  makeLedger(env, { ledgerId: 'good-ledger', repoRoot: REPO_ROOT }); // proves the walk does not double-report a registered, healthy ledger

  const orphanTempDir = path.join(projectsDir, 'unregistered-temp-orphan');
  makeUnregisteredLedger(path.join(orphanTempDir, 'runtime.sqlite'), { sourceRoots: [path.join(os.tmpdir(), 'starci-probe-repo')] });

  const orphanNoneDir = path.join(projectsDir, 'unregistered-no-source-roots');
  makeUnregisteredLedger(path.join(orphanNoneDir, 'runtime.sqlite'), { sourceRoots: null });

  const found = orphanLedgerFindings({ env });
  const byId = Object.fromEntries(found.map((f) => [f.ledgerId, f]));
  assert.equal(byId['good-ledger'], undefined, 'a registered, healthy ledger is not reported by the directory walk');
  assert.equal(byId['unregistered-temp-orphan'].reason, 'source-roots-unreachable');
  assert.equal(byId['unregistered-temp-orphan'].registered, false);
  assert.equal(byId['unregistered-temp-orphan'].name, null);
  assert.equal(byId['unregistered-no-source-roots'].reason, 'no-source-roots');
  assert.equal(byId['unregistered-no-source-roots'].registered, false);
});

test('orphanLedgerFindings: a registered ledger whose directory is gone entirely is its own finding', (t) => {
  const { env } = sandbox(t);
  const file = projectLedgerFile('registered-dir-gone', env); // never created on disk
  const m = openMachine({ env });
  try { assert.equal(m.registerLedger({ ledgerId: 'registered-dir-gone', name: 'registered-dir-gone', repoRoot: REPO_ROOT, file }).registered, true); }
  finally { m.close(); }
  const found = orphanLedgerFindings({ env });
  assert.equal(found.length, 1);
  assert.equal(found[0].ledgerId, 'registered-dir-gone');
  assert.equal(found[0].reason, REGISTERED_DIR_MISSING_REASON);
  assert.equal(found[0].registered, true);
});

test('starciSourceRoot: STARCI_SOURCE_ROOT overrides it, else it is the directory holding this runtime checkout', () => {
  assert.equal(starciSourceRoot({}), path.dirname(REPO_ROOT));
  assert.equal(starciSourceRoot({ STARCI_SOURCE_ROOT: 'D:/somewhere/else' }), path.resolve('D:/somewhere/else'));
});

test('workspaceBoundRepoRoots resolves every role of every .workspaces/projects/*/work.json, pathFromSource "." included', (t) => {
  const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-workspace-source-'));
  t.after(() => fs.rmSync(sourceRoot, { recursive: true, force: true }));
  makeWorkspaceBinding(sourceRoot, 'starci-academy', { be: { pathFromSource: '.' }, fe: { pathFromSource: '../starci-academy-fe' } });
  makeWorkspaceBinding(sourceRoot, 'broken', undefined); // no `repositories` at all: skipped, never a crash
  fs.mkdirSync(path.join(sourceRoot, '.workspaces', 'projects', 'unreadable'), { recursive: true });
  fs.writeFileSync(path.join(sourceRoot, '.workspaces', 'projects', 'unreadable', 'work.json'), '{not json');

  const roots = workspaceBoundRepoRoots({ env: { STARCI_SOURCE_ROOT: sourceRoot } });
  assert.deepEqual(roots.sort(), [path.resolve(sourceRoot).replace(/\\/g, '/'), path.resolve(sourceRoot, '..', 'starci-academy-fe').replace(/\\/g, '/')].sort());
});

test('workspaceBoundRepoRoots: no .workspaces/projects directory yields [] rather than throwing', (t) => {
  const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-no-workspaces-'));
  t.after(() => fs.rmSync(sourceRoot, { recursive: true, force: true }));
  assert.deepEqual(workspaceBoundRepoRoots({ env: { STARCI_SOURCE_ROOT: sourceRoot } }), []);
});

test('boundRepoRoots merges machine.sqlite repositories with every .workspaces binding, deduped across path-separator styles', (t) => {
  const { env: machineEnv } = sandbox(t);
  const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-workspace-source-'));
  t.after(() => fs.rmSync(sourceRoot, { recursive: true, force: true }));
  const env = { ...machineEnv, STARCI_SOURCE_ROOT: sourceRoot };
  // The same repo is bound both ways: registered in machine.sqlite (forward-slash, repoKey-normalized) and in a
  // workspace binding resolved natively (backslash on Windows) — it must land in the merged list exactly once.
  makeLedger(env, { ledgerId: 'shared-repo-ledger', repoRoot: REPO_ROOT });
  makeWorkspaceBinding(sourceRoot, 'shared', { be: { pathFromSource: REPO_ROOT } });
  makeWorkspaceBinding(sourceRoot, 'workspace-only', { fe: { pathFromSource: '.' } });

  const roots = boundRepoRoots({ env });
  const repoRootCount = roots.filter((r) => r.replace(/\\/g, '/').toLowerCase() === REPO_ROOT.replace(/\\/g, '/').toLowerCase()).length;
  assert.equal(repoRootCount, 1, `the shared repo appears once regardless of separator style: ${JSON.stringify(roots)}`);
  assert.ok(roots.some((r) => r.replace(/\\/g, '/').toLowerCase() === sourceRoot.replace(/\\/g, '/').toLowerCase()), 'the workspace-only binding (pathFromSource ".") is included too');
});

test('boundRepoRoots lists every distinct repository root the registry knows', (t) => {
  const { env } = sandbox(t);
  makeLedger(env, { ledgerId: 'ledger-a', repoRoot: REPO_ROOT });
  const roots = boundRepoRoots({ env });
  assert.ok(roots.includes(repoKeyOf(REPO_ROOT)));
});

test('sweepOrphanLedgers dry run only reports; --apply moves the ledger directory (never deletes) and retires the row', async (t) => {
  const { root, env } = sandbox(t);
  const orphanRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-orphan-repo-'));
  const file = makeLedger(env, { ledgerId: 'probe-one', repoRoot: orphanRepo });
  const from = path.dirname(file);

  const dry = await sweepOrphanLedgers({ apply: false, env });
  assert.equal(dry.ok, true);
  assert.equal(dry.moved.length, 0);
  assert.equal(dry.report.length, 1);
  assert.equal(dry.report[0].ledgerId, 'probe-one');
  assert.ok(fs.existsSync(from), 'a dry run never moves anything');

  const now = Date.UTC(2026, 8, 30);
  const applied = await sweepOrphanLedgers({ apply: true, now, env });
  assert.equal(applied.ok, true, JSON.stringify(applied.errors));
  assert.equal(applied.errors.length, 0);
  assert.equal(applied.moved.length, 1);
  assert.ok(applied.movedBytes > 0);
  const expectedTo = path.join(root, 'archive', 'orphan-ledgers', '20260930', 'probe-one');
  assert.equal(applied.moved[0].to, expectedTo);
  assert.ok(!fs.existsSync(from), 'the orphan directory is gone from its original location');
  assert.ok(fs.existsSync(path.join(expectedTo, 'runtime.sqlite')), 'the ledger bytes landed in the archive, never deleted');

  const after = readMachine((m) => m.listLedgers({ includeRetired: true }).find((l) => l.ledgerId === 'probe-one'), null, { env });
  assert.equal(after.state, 'retired');
  assert.match(after.retiredReason, /orphan ledger archived/);

  const clean = await sweepOrphanLedgers({ apply: false, env });
  assert.equal(clean.report.length, 0, 'the retired ledger is never reported again');
});

test('archiveOrphanLedger refuses an already-missing directory instead of silently doing nothing', (t) => {
  const { root, env } = sandbox(t);
  const finding = { ledgerId: 'gone', file: path.join(root, 'projects', 'gone', 'runtime.sqlite'), reason: 'no-source-roots' };
  assert.throws(() => archiveOrphanLedger(finding, { env }), /orphan ledger directory missing/);
});
