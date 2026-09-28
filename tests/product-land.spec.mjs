// product-land (DESIGN §16.7; scripts/kernel/product-land.mjs): a workflow branch lands into the product's main through a
// serial per-repository gate - a lock-free merge-tree preflight BEFORE the queue, a scratch merge, checks on the result,
// then a compare-and-swap of main plus a working-tree update of exactly the changed paths of the live checkout.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { productLand, landPreflight } from '../scripts/kernel/product-land.mjs';
import { ensureOpWorktree, integrateOp, productSettings, layoutOf } from '../scripts/kernel/product-worktree.mjs';

const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };

function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-pland-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const repo = path.join(base, 'nivo-fe');
  fs.mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  for (const [k, v] of [['user.email', 'spec@starci.test'], ['user.name', 'spec'], ['core.autocrlf', 'false']]) git(repo, 'config', k, v);
  write(repo, '.gitignore', 'node_modules/\n');
  write(repo, 'tsconfig.json', JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['./src/*'] } } }));
  write(repo, 'src/x.ts', 'export const x = 1;\n');
  write(repo, 'src/y.ts', 'export const y = 1;\n');
  write(repo, 'src/uses.ts', 'import { x } from "@/x";\nexport const u = x;\n');
  git(repo, 'add', '-A'); git(repo, 'commit', '-q', '-m', 'init');
  return { repo };
}

/** One op of workflow `wf` edits `file` to `text`, then integrates into wf/<wf> (the settle-pass step). */
function opEdits(repo, wf, jobId, file, text) {
  const made = ensureOpWorktree({ repoRoot: repo, workflowId: wf, jobId });
  assert.ok(made.ok, JSON.stringify(made));
  write(made.record.op.path, file, text);
  git(made.record.op.path, 'add', '-A'); git(made.record.op.path, 'commit', '-q', '-m', `${jobId} ${file}`);
  const integ = integrateOp({ record: made.record });
  assert.ok(integ.ok, JSON.stringify(integ));
  return made.record;
}

test('two non-conflicting workflows land serially; main and the live checkout move; wf/<wf> follows main', (t) => {
  const { repo } = fixture(t);
  opEdits(repo, 'wf-one-aaaa1111', 'op-code.refactor-1111111111', 'src/x.ts', 'export const x = 2;\n');
  opEdits(repo, 'wf-two-bbbb2222', 'op-code.refactor-2222222222', 'src/y.ts', 'export const y = 2;\n');
  const events = [];
  const one = productLand({ repoRoot: repo, workflowId: 'wf-one-aaaa1111', onEvent: (kind, p) => events.push({ kind, p }) });
  assert.ok(one.ok, JSON.stringify(one));
  assert.equal(git(repo, 'rev-parse', 'main'), one.landed);
  assert.equal(fs.readFileSync(path.join(repo, 'src/x.ts'), 'utf8'), 'export const x = 2;\n', 'the live checkout carries the land');
  assert.equal(git(repo, 'status', '--porcelain'), '', 'and is clean: index and tree moved with main');
  assert.equal(git(repo, 'rev-parse', 'wf/aaaa1111'), one.landed, 'wf/<wf> fast-forwarded to the new main');
  const two = productLand({ repoRoot: repo, workflowId: 'wf-two-bbbb2222' });
  assert.ok(two.ok, JSON.stringify(two));
  assert.equal(git(repo, 'rev-parse', `${two.landed}^1`), one.landed, 'the second land is on top of the first');
  assert.equal(fs.readFileSync(path.join(repo, 'src/y.ts'), 'utf8'), 'export const y = 2;\n');
  assert.deepEqual(events.map((e) => e.kind), ['product-land-queued', 'product-land-landed']);
  assert.equal(productLand({ repoRoot: repo, workflowId: 'wf-one-aaaa1111' }).already, true, 'a landed branch is already landed');
  assert.ok(!fs.readdirSync(path.join(repo, '.starciwork', 'worktrees')).some((n) => n.startsWith('_land-')), 'the scratch is removed');
});

test('a conflicting workflow is refused at preflight, naming the file and its hunks; main is untouched', (t) => {
  const { repo } = fixture(t);
  opEdits(repo, 'wf-one-aaaa1111', 'op-code.refactor-1111111111', 'src/x.ts', 'export const x = 2;\n');
  opEdits(repo, 'wf-three-cccc3333', 'op-code.refactor-3333333333', 'src/x.ts', 'export const x = 3;\n');
  assert.ok(productLand({ repoRoot: repo, workflowId: 'wf-one-aaaa1111' }).ok);
  const main = git(repo, 'rev-parse', 'main');
  const events = [];
  const refused = productLand({ repoRoot: repo, workflowId: 'wf-three-cccc3333', onEvent: (kind, p) => events.push({ kind, p }) });
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, 'product-land-conflict');
  assert.equal(refused.preflight, true, 'refused before it ever queued');
  assert.equal(refused.conflicts[0].file, 'src/x.ts');
  assert.match(refused.conflicts[0].hunks[0].text, /<<<<<<< [\s\S]*x = 2[\s\S]*x = 3|<<<<<<< [\s\S]*x = 3[\s\S]*x = 2/);
  assert.equal(git(repo, 'rev-parse', 'main'), main);
  assert.deepEqual(events.map((e) => e.kind), ['product-land-failed']);
  assert.equal(landPreflight({ repoRoot: repo, branch: 'wf/cccc3333' }).ok, false);
});

test('a red land check, or more broken imports than main had, lands nothing', (t) => {
  const { repo } = fixture(t);
  opEdits(repo, 'wf-four-dddd4444', 'op-code.refactor-4444444444', 'src/y.ts', 'export const y = 4;\n');
  const main = git(repo, 'rev-parse', 'main');
  const settings = productSettings();
  const red = productLand({ repoRoot: repo, workflowId: 'wf-four-dddd4444', settings: { ...settings, land: { ...settings.land, checks: [{ name: 'always-red', argv: ['node', '-e', 'process.exit(3)'] }] } } });
  assert.equal(red.reason, 'product-land-red', JSON.stringify(red));
  assert.equal(red.checks.find((c) => c.name === 'always-red').exitCode, 3);
  assert.equal(git(repo, 'rev-parse', 'main'), main, 'nothing landed');
  // A workflow that moves x.ts without repointing its importer breaks an import main did not have broken.
  const rec = ensureOpWorktree({ repoRoot: repo, workflowId: 'wf-five-eeee5555', jobId: 'op-code.refactor-5555555555' }).record;
  fs.mkdirSync(path.join(rec.op.path, 'src/core'), { recursive: true });
  git(rec.op.path, 'mv', 'src/x.ts', 'src/core/x.ts'); git(rec.op.path, 'commit', '-q', '-m', 'move x');
  assert.ok(integrateOp({ record: rec }).ok, 'the move itself integrates: its own files import nothing broken');
  const broken = productLand({ repoRoot: repo, workflowId: 'wf-five-eeee5555' });
  assert.equal(broken.reason, 'product-land-red');
  assert.match(broken.checks.find((c) => c.name === 'imports-broken-after-move').output, /main 0 -> candidate 1: src\/uses\.ts -> @\/x/);
  assert.equal(git(repo, 'rev-parse', 'main'), main);
  assert.ok(fs.existsSync(path.join(repo, 'src/x.ts')), 'the live checkout never moved');
  assert.ok(layoutOf({ repoRoot: repo, workflowId: 'wf-five-eeee5555' }).workflow.branch === 'wf/eeee5555');
});

test('a live checkout dirty on a path the land writes refuses the land', (t) => {
  const { repo } = fixture(t);
  opEdits(repo, 'wf-six-ffff6666', 'op-code.refactor-6666666666', 'src/y.ts', 'export const y = 6;\n');
  write(repo, 'src/y.ts', 'export const y = "live edit";\n');
  const main = git(repo, 'rev-parse', 'main');
  const r = productLand({ repoRoot: repo, workflowId: 'wf-six-ffff6666' });
  assert.equal(r.reason, 'live-paths-dirty', JSON.stringify(r));
  assert.equal(git(repo, 'rev-parse', 'main'), main);
  assert.equal(fs.readFileSync(path.join(repo, 'src/y.ts'), 'utf8'), 'export const y = "live edit";\n', 'the live edit is never overwritten');
});
