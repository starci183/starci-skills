// The per-op removal and reap of scripts/kernel/product-worktree.mjs (part B deletes them with the per-op land; owner
// decision WFWT: one Orca-owned worktree per Kernel workflow replaced the per-op worktree, whose creation, layout,
// node_modules junction overlay and isolation policy part A deleted - tests/workflow-worktree.spec.mjs). Until then the
// removal is exercised on a per-op tree the spec makes itself: links removed first, evidence salvaged, unlanded work
// preserved, the tree verified gone, and the root install untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { openLedger, ledgerFileFor } from '../engine/ledger-db.mjs';
import { removeOpWorktree, reapJobWorktree, preservedOpRef, EVENTS } from '../scripts/kernel/product-worktree.mjs';
import { worktreesRootOf } from '../scripts/lib/worktrees.mjs';

const WF = 'wf-nivo-fe-canon-mujek980';
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };

/** A per-op tree made by the spec (the shape payload.productWorktree had): <repo>/.starciwork/worktrees/<short> on op/<short>. */
function opTree(repo, jobId) {
  const short = jobId.split('-').pop().slice(0, 8);
  const dir = path.join(worktreesRootOf(repo), short);
  const branch = `op/${short}`;
  const baseSha = git(repo, 'rev-parse', 'main');
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  git(repo, 'worktree', 'add', '-q', '-b', branch, dir, baseSha);
  return { repoRoot: repo, workflowId: WF, jobId, main: 'main', op: { short, branch, path: dir }, baseSha, createdAt: Date.now() };
}

/** A monorepo like nivo-fe: npm workspaces, node_modules/@nivo/ui -> packages/ui (a junction), tsconfig `@/*` alias. */
function fixtureRepo(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-pwt-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const repo = path.join(base, 'nivo-fe');
  fs.mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.email', 'spec@starci.test');
  git(repo, 'config', 'user.name', 'spec');
  git(repo, 'config', 'core.autocrlf', 'false');
  write(repo, '.gitignore', 'node_modules/\n');
  write(repo, 'package.json', JSON.stringify({ name: 'nivo', private: true, workspaces: ['apps/*', 'packages/*'] }));
  write(repo, 'packages/ui/package.json', JSON.stringify({ name: '@nivo/ui', version: '1.0.0', main: 'index.js' }));
  write(repo, 'packages/ui/index.js', 'module.exports = "root-ui";\n');
  write(repo, 'apps/app/package.json', JSON.stringify({ name: '@nivo/app', version: '1.0.0' }));
  write(repo, 'apps/app/tsconfig.json', JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['./src/*'] } } }));
  write(repo, 'apps/app/src/i18n/request.ts', 'export const locale = "vi";\n');
  write(repo, 'apps/app/src/a.ts', 'import { locale } from "@/i18n/request";\nexport const a = locale;\n');
  write(repo, 'apps/app/src/b.ts', 'import { locale } from "./i18n/request";\nexport const b = locale;\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'init');
  // The installed tree: a real package, a workspace link (a junction, as npm makes on Windows), a nested node_modules.
  write(repo, 'node_modules/react/package.json', JSON.stringify({ name: 'react', version: '19.0.0', main: 'index.js' }));
  write(repo, 'node_modules/react/index.js', 'module.exports = "react";\n');
  write(repo, 'node_modules/.package-lock.json', '{}');
  fs.mkdirSync(path.join(repo, 'node_modules', '@nivo'), { recursive: true });
  fs.symlinkSync(path.join(repo, 'packages', 'ui'), path.join(repo, 'node_modules', '@nivo', 'ui'), 'junction');
  write(repo, 'apps/app/node_modules/lodash/package.json', JSON.stringify({ name: 'lodash', version: '4.0.0' }));
  write(repo, 'package-lock.json', '{"lockfileVersion":3}');
  git(repo, 'add', 'package-lock.json');
  git(repo, 'commit', '-q', '-m', 'lock');
  return { base, repo };
}

test('a file move in one op worktree is invisible to its sibling; removal never touches a junction target', (t) => {
  const { repo } = fixtureRepo(t);
  const a = opTree(repo, 'op-code.refactor-d704825abb');
  const b = opTree(repo, 'op-code.refactor-97666fb9ba');
  // The links an op tree may hold into the root install (a junction): removed as links, never followed.
  fs.symlinkSync(path.join(repo, 'node_modules'), path.join(a.op.path, 'node_modules'), 'junction');
  fs.mkdirSync(path.join(a.op.path, 'apps/app/src/modules/i18n'), { recursive: true });
  git(a.op.path, 'mv', 'apps/app/src/i18n/request.ts', 'apps/app/src/modules/i18n/request.ts');
  git(a.op.path, 'commit', '-q', '-m', 'move i18n');
  assert.ok(fs.existsSync(path.join(b.op.path, 'apps/app/src/i18n/request.ts')), 'the sibling\'s check inputs never moved');
  assert.ok(fs.existsSync(path.join(repo, 'apps/app/src/i18n/request.ts')), 'nor did the product checkout');
  // Evidence the op left uncommitted under .starciwork is salvaged, verified, before the tree goes.
  write(a.op.path, '.starciwork/evidence/run.json', '{"ok":true}');
  const salvage = path.join(path.dirname(repo), 'evidence', WF, 'op-a');
  const removed = removeOpWorktree({ record: a, salvageTo: salvage });
  assert.ok(removed.ok, JSON.stringify(removed));
  assert.deepEqual(removed.verified, { dirGone: true, pruned: true });
  assert.equal(fs.readFileSync(path.join(salvage, 'worktree-salvage', '.starciwork', 'evidence', 'run.json'), 'utf8'), '{"ok":true}');
  assert.ok(!fs.existsSync(a.op.path));
  assert.ok(!git(repo, 'worktree', 'list', '--porcelain').includes(a.op.path.replace(/\\/g, '/')), 'no registration left');
  assert.ok(fs.existsSync(path.join(repo, 'node_modules', 'react', 'index.js')), 'the root install is untouched');
  assert.ok(fs.existsSync(path.join(repo, 'packages', 'ui', 'index.js')), 'the root workspace package is untouched');
  assert.ok(fs.existsSync(path.join(repo, 'apps', 'app', 'node_modules', 'lodash', 'package.json')));
  assert.ok(fs.existsSync(path.join(b.op.path, 'packages', 'ui', 'index.js')), 'the sibling worktree is untouched');
  assert.equal(removed.links, 1, 'the junction was removed as a link');
  // Its commit never landed: it is preserved for a continuation, not lost, and the op branch is gone.
  assert.equal(removed.preserved?.ref, 'refs/heads/preserved/op-code.refactor-d704825abb', JSON.stringify(removed));
  assert.equal(preservedOpRef(repo, 'op-code.refactor-d704825abb')?.sha, git(repo, 'rev-parse', removed.preserved.ref));
  assert.equal(removed.branch.deleted, true);
  assert.equal(spawnSync('git', ['rev-parse', '--verify', '--quiet', 'refs/heads/op/d704825a'], { cwd: repo }).status, 1, 'no op branch left');
  assert.equal(git(repo, 'show', `${removed.preserved.ref}:apps/app/src/modules/i18n/request.ts`), 'export const locale = "vi";', 'the partial commit is in the preserved ref');
});

test('released -> worktree-removed: the reap records the transition once', (t) => {
  const { base, repo } = fixtureRepo(t);
  const ledgerRepo = path.join(base, 'nivo-backend');
  fs.mkdirSync(ledgerRepo);
  const ledger = openLedger({ file: ledgerFileFor(ledgerRepo) });
  try {
  ledger.ensureWorkflow({ workflowId: WF, title: 'fe canon' });
  const jobId = 'op-code.refactor-d704825abb';
  const made = { record: opTree(repo, jobId) };
  ledger.write.createUnit({ workflowId: WF, unitId: jobId, opId: 'code.refactor', subjectKey: jobId, goalRevision: 1 });
  ledger.enqueueJob({ jobId, workflowId: WF, unitId: jobId, opId: 'code.refactor', kind: 'op', payload: { opId: 'code.refactor', productWorktree: made.record, terminalClosed: { ok: true, verified: { ok: true, proof: 'spec' } } } });
  const now = Date.now();
  assert.equal(reapJobWorktree({ ledger, ledgerRepo, jobId, now }).skipped, 'job-queued', 'a live job keeps its tree');
  for (const to of ['ready', 'leased', 'running', 'reported', 'succeeded'])
    ledger.db.prepare('UPDATE jobs SET status=?, updated_at=? WHERE job_id=?').run(to, now, jobId);
  const r = reapJobWorktree({ ledger, ledgerRepo, jobId, now: now + 1000 });
  assert.equal(r.removed, true, JSON.stringify(r));
  const ev = ledger.db.prepare('SELECT payload_json FROM events WHERE entity_id=? AND kind=?').all(jobId, EVENTS.removed);
  assert.equal(ev.length, 1);
  assert.deepEqual(JSON.parse(ev[0].payload_json).verified, { dirGone: true, pruned: true });
  assert.equal(JSON.parse(ev[0].payload_json).from, 'released');
  assert.equal(reapJobWorktree({ ledger, ledgerRepo, jobId }).skipped, 'already-removed', 'idempotent');
  assert.ok(!fs.existsSync(made.record.op.path));
  assert.ok(fs.existsSync(path.join(repo, 'node_modules', 'react', 'index.js')));
  } finally { ledger.close(); }
});

test('the .starciwork holding the worktrees container is never the Work root of a path inside a worktree', async () => {
  const { workRootOf } = await import('../scripts/work/work-io.mjs');
  const repo = path.resolve(os.tmpdir(), 'nivo-fe');
  assert.equal(workRootOf(path.join(repo, '.starciwork', 'worktrees', 'd704825a', 'apps', 'app')), null);
  assert.equal(workRootOf(path.join(repo, '.starciwork', 'worktrees', 'd704825a', '.starciwork', 'features')),
    path.join(repo, '.starciwork', 'worktrees', 'd704825a', '.starciwork'), 'a worktree\'s own Work dir still is');
});
