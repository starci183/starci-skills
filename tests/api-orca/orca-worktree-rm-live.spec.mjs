// The real `orca worktree rm` against node_modules junctions (lane ORCAWT step 2, 2026-10-01; lane LIVEORCA, 2026-10-09): a
// throwaway repo stands for the main checkout, with real files in node_modules and packages/node_modules; Orca creates a
// worktree of it; the worktree's node_modules and packages/node_modules are junctions into the fake main. Three things are
// shown, in this order:
//   1. the runtime's Orca client (scripts/machine/worktree-orca.mjs orcaWorktreeClient.remove) refuses that tree with
//      worktree-links-present and never asks Orca: the fake main stays byte-identical and the tree stays. This is the protective invariant.
//   2. the MEASUREMENT of the third-party tool: Orca asked to remove the same linked tree either walks the
//      junctions and deletes what they lead to or does not (the raw call, scripts/api/orca/worktree-rm.mjs, on a throwaway fixture). That is a property of the installed Orca build, not of the runtime;
//      the spec prints it (MEASURED-ORCA-WORKTREE-RM, with the Orca app version) and asserts nothing about it. Orca build
//      1.4.221 walks them (registry entry orca-worktree-rm-walks-junctions-measured).
//   3. the runtime's own removal (scripts/machine/worktree-orca.mjs removeOrcaWorktree: links unlinked first, then Orca) over a
//      fresh linked tree, against the real Orca: the fake main is byte-identical.
//
// The probe talks to the LIVE Orca and registers a repository there that the CLI cannot remove, so a normal `npm test`
// never runs it: it runs only on an explicit opt-in, STARCI_ORCA_LIVE=1, or STARCI_REQUIRE_ORCA_LIVE=1 (CI and the
// release verification), and then a missing Orca fails the test instead of skipping it. Without an opt-in it prints one
// SKIPPED line and makes no Orca call at all - not even a status probe. The throwaway repo lives in a fresh directory
// under the spec's isolated temp root and is removed with every worktree the spec creates; its Orca registration is
// removed in the teardown through `project setup-delete` (Orca has no `repo rm`; a repo-backed setup's id is the repo id
// that `repo add` answered), so no fake repository is left in Orca.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { status } from '../../scripts/api/orca/status.mjs';
import { repoAdd } from '../../scripts/api/orca/repo-add.mjs';
import { projectSetupDelete } from '../../scripts/api/orca/project-setup-delete.mjs';
import { worktreeCreate } from '../../scripts/api/orca/worktree-create.mjs';
import { worktreeRm } from '../../scripts/api/orca/worktree-rm.mjs';
import { removeOrcaWorktree, orcaWorktreeClient } from '../../scripts/machine/worktree-orca.mjs';

export const REQUIRE_ORCA_LIVE = process.env.STARCI_REQUIRE_ORCA_LIVE === '1';
export const ORCA_LIVE_OPT_IN = REQUIRE_ORCA_LIVE || process.env.STARCI_ORCA_LIVE === '1';
let PROBE = null;
const posix = (p) => String(p).replace(/\\/g, '/');

/** Why the live probe cannot run here, or null. */
function unavailable() {
  if (!ORCA_LIVE_OPT_IN) return 'a live Orca probe runs only with STARCI_ORCA_LIVE=1 or STARCI_REQUIRE_ORCA_LIVE=1';
  if (process.platform !== 'win32') return 'the junction probe is Windows-only (mklink /J)';
  if (process.env.STARCI_ORCA_COMMAND || process.env.STARCI_ORCA_ARGS) return 'STARCI_ORCA_COMMAND points at a stub, not the real Orca';
  const st = status();
  return st.ok && st.reachable ? null : `orca runtime not reachable (${String(st.error ?? st.state ?? 'no answer').slice(0, 120)})`;
}
const reason = unavailable();
const gate = (() => {
  if (!reason) return { skip: false, required: null };
  if (REQUIRE_ORCA_LIVE) return { skip: false, required: `REQUIRED (STARCI_REQUIRE_ORCA_LIVE=1) but ${reason}` };
  if (!ORCA_LIVE_OPT_IN) { console.log(`SKIPPED: ${reason}`); return { skip: reason, required: null }; }
  console.log(`SKIPPED: no live Orca - orca worktree rm junction probe: ${reason}`);
  return { skip: reason, required: null };
})();

const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
/** File list + sha256 of every file under `root` (.git skipped, links never followed). */
function picture(root) {
  const out = {};
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name), rel = posix(path.relative(root, p));
      if (rel === '.git' || rel.startsWith('.git/')) continue;
      const st = fs.lstatSync(p);
      if (st.isSymbolicLink()) { out[rel] = 'link'; continue; }
      if (st.isDirectory()) walk(p);
      else out[rel] = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    }
  };
  walk(root);
  return out;
}
/** The real files of node_modules and packages/node_modules in the fake main (written again after a measurement that may have deleted them). */
function fillModules() {
  for (let i = 1; i <= 5; i += 1) {
    fs.mkdirSync(path.join(PROBE, 'node_modules', 'left-pad', 'lib'), { recursive: true });
    fs.mkdirSync(path.join(PROBE, 'packages', 'node_modules', '@x', 'y'), { recursive: true });
    fs.writeFileSync(path.join(PROBE, 'node_modules', 'left-pad', 'lib', `f${i}.js`), `module ${i}
`);
    fs.writeFileSync(path.join(PROBE, 'packages', 'node_modules', '@x', 'y', `g${i}.js`), `pk ${i}
`);
  }
}
/** The throwaway "main": tracked files, real node_modules and packages/node_modules content, registered in Orca. Its repo id. */
function fakeMain() {
  if (!fs.existsSync(path.join(PROBE, '.git'))) {
    fs.mkdirSync(path.join(PROBE, 'packages'), { recursive: true });
    git(PROBE, 'init', '-q', '-b', 'main');
    git(PROBE, 'config', 'user.email', 'spec@starci.test');
    git(PROBE, 'config', 'user.name', 'spec');
    fs.writeFileSync(path.join(PROBE, '.gitignore'), 'node_modules/\n');
    fs.writeFileSync(path.join(PROBE, 'README.md'), 'fake main\n');
    fs.writeFileSync(path.join(PROBE, 'packages', 'README.md'), 'packages\n');
    git(PROBE, 'add', '-A');
    git(PROBE, 'commit', '-q', '-m', 'init');
  }
  fillModules();
  const added = repoAdd({ path: posix(PROBE) });
  assert.ok(added.ok, `orca repo add: ${added.error}`);
  return added.repoId;
}
/** An Orca worktree of the fake main with node_modules and packages/node_modules junctioned into the fake main. */
function linkedTree(name) {
  const made = worktreeCreate({ repo: `path:${posix(PROBE)}`, name, baseBranch: 'main', setup: 'skip' });
  assert.ok(made.ok, `orca worktree create: ${made.error}`);
  const wt = made.worktree.path;
  fs.mkdirSync(path.join(wt, 'packages'), { recursive: true });
  for (const rel of ['node_modules', path.join('packages', 'node_modules')]) {
    const r = spawnSync('cmd', ['/c', 'mklink', '/J', path.join(wt, rel), path.join(PROBE, rel)], { encoding: 'utf8', windowsHide: true });
    assert.equal(r.status, 0, `mklink /J ${rel}: ${r.stdout}${r.stderr}`);
  }
  assert.ok(fs.existsSync(path.join(wt, 'node_modules', 'left-pad', 'lib', 'f1.js')), 'the junction reaches the fake main');
  return made.worktree;
}

test('a linked Orca worktree is refused by the runtime Orca client, Orca removal of it is measured, and the runtime release leaves the main checkout byte-identical', { skip: gate.skip, timeout: 600_000 }, (t) => {
  if (gate.required) assert.fail(gate.required);
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-orca-rm-probe-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  PROBE = path.join(home, 'fake-main');
  const repoId = fakeMain();
  t.after(() => { const gone = projectSetupDelete({ setup: repoId }); assert.ok(gone.ok, `orca project setup-delete ${repoId}: ${gone.error}`); });
  const before = picture(PROBE);
  assert.equal(Object.keys(before).filter((f) => f.includes('node_modules')).length, 10, 'real files in both node_modules');
  // 1. The runtime's removal call over a linked tree: refused, Orca not asked.
  const guarded = linkedTree(`orcawt-probe-guard-${crypto.randomBytes(3).toString('hex')}`);
  const refused = orcaWorktreeClient.remove({ worktree: `id:${guarded.id}`, force: true });
  assert.deepEqual([refused.ok, refused.removed, refused.errorCode], [false, false, 'worktree-links-present'], JSON.stringify(refused));
  assert.ok(fs.existsSync(guarded.path), 'the linked tree is kept');
  assert.deepEqual(picture(PROBE), before, 'a refused removal leaves the fake main byte-identical');
  // 2. The measurement of Orca itself over that same tree: a fact about the installed build, printed, not promised.
  const measured = worktreeRm({ worktree: `id:${guarded.id}`, force: true });
  assert.ok(measured.ok, `orca worktree rm (measurement): ${measured.error}`);
  const after = picture(PROBE);
  const lost = Object.keys(before).filter((f) => !(f in after));
  const walksJunctions = lost.length > 0;
  console.log(`MEASURED-ORCA-WORKTREE-RM ${JSON.stringify({ orcaAppVersion: status().appVersion, walksJunctions, filesLost: lost.length, lost: lost.slice(0, 3) })}`);
  assert.ok(!fs.existsSync(guarded.path), 'Orca removed the tree');
  fillModules();
  assert.deepEqual(picture(PROBE), before, 'the fake main is whole again');
  // 3. The runtime's release: links unlinked first, then Orca.
  const env = { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(path.dirname(PROBE), `machine-${process.pid}.sqlite`) };
  const tree = linkedTree(`orcawt-probe-rt-${crypto.randomBytes(3).toString('hex')}`);
  const out = removeOrcaWorktree({ repoRoot: PROBE, orcaId: tree.id, dir: tree.path, env });
  assert.ok(out.ok, JSON.stringify(out));
  assert.equal(out.links, 2, 'both junctions removed as links before Orca ran');
  assert.ok(!fs.existsSync(tree.path));
  assert.deepEqual(picture(PROBE), before, 'the fake main is byte-identical');
  assert.equal(git(PROBE, 'worktree', 'list', '--porcelain').split(/\r?\n/).filter((l) => l.startsWith('worktree ')).length, 1, 'only the fake main is left');
  for (const f of fs.readdirSync(path.dirname(PROBE)).filter((n) => n.startsWith(`machine-${process.pid}.sqlite`))) fs.rmSync(path.join(path.dirname(PROBE), f), { force: true });
});
