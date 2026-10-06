// runtime-mirror-drift (2026-10-01): 6ba66d84a/df2c3c52e changed engine/db/ledger.mjs and added ledger migration 0005
// through the land gate, which never ran sync-runtime --check, so packages/hfs/runtime went stale on main. The gate now
// runs `sync-runtime --check` as a tree check whenever the candidate changes a file a runtime bundle mirrors (computed
// from the candidate's own BUNDLES), with the findings-based red-on-main baseline of the other tree checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runChecks, mirrorDriftCheck, mirroredFiles, mirrorRun, MIRROR_CHECK, MIRROR_FIX } from '../../scripts/supervisor/land.mjs';
import { withoutGitLocalEnv } from '../../scripts/lib/git.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// A minimal generator with the real one's shape: exported BUNDLES/CATALOG, --check prints one drift line per file.
const GENERATOR = `import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CATALOG = 'cat.yaml';
export const BUNDLES = Object.freeze({ 'mirror': Object.freeze({ files: Object.freeze(['src/a.mjs']), catalog: false }) });
if (process.argv.includes('--check')) {
  const problems = [];
  for (const [bundle, spec] of Object.entries(BUNDLES)) for (const f of spec.files) {
    const copy = path.join(root, bundle, f);
    if (!fs.existsSync(copy)) problems.push('missing ' + bundle + '/' + f);
    else if (fs.readFileSync(copy, 'utf8') !== fs.readFileSync(path.join(root, f), 'utf8')) problems.push('stale ' + bundle + '/' + f);
  }
  for (const p of problems) process.stderr.write('runtime copy drift: ' + p + ' (run starci release sync-runtime)\\n');
  if (!problems.length) process.stdout.write('OK: 1 runtime copies match the runtime\\n');
  process.exitCode = problems.length ? 1 : 0;
}
`;

const env = withoutGitLocalEnv(process.env);
const git = (dir, ...args) => {
  const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8', env, windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const write = (dir, file, text) => { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), text); };

/** A git repo whose main mirrors src/a.mjs into mirror/src/a.mjs; returns {dir, base}. */
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'land-mirror-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'spec@example.invalid');
  git(dir, 'config', 'user.name', 'spec');
  git(dir, 'config', 'core.autocrlf', 'false');
  write(dir, MIRROR_CHECK, GENERATOR);
  write(dir, 'src/a.mjs', 'export const a = 1;\n');
  write(dir, 'mirror/src/a.mjs', 'export const a = 1;\n');
  write(dir, 'src/other.mjs', 'export const o = 1;\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'base');
  return { dir, base: git(dir, 'rev-parse', 'HEAD') };
}
const commit = (dir, files) => { for (const [f, text] of Object.entries(files)) write(dir, f, text); git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'candidate'); return git(dir, 'rev-parse', 'HEAD'); };
const mirrorOf = (r) => r.checks.find((c) => c.name === 'sync-runtime --check');
const gate = (dir, base, head, baseline = null) => runChecks({ dir, base, head, specMode: 'none', runSpecs: false, baseline });

test('the gate reads the mirrored file set from the candidate generator\'s own BUNDLES', (t) => {
  const { dir } = fixture(t);
  assert.deepEqual(mirroredFiles(dir), { bundles: ['mirror'], files: ['src/a.mjs'] });
});

test('a candidate changing a mirrored file without the mirror is refused with the one fix', (t) => {
  const { dir, base } = fixture(t);
  const baseline = { [MIRROR_CHECK]: mirrorRun(dir) };
  assert.equal(baseline[MIRROR_CHECK].ok, true);
  const head = commit(dir, { 'src/a.mjs': 'export const a = 2;\n' });
  const r = gate(dir, base, head, baseline);
  const check = mirrorOf(r);
  assert.ok(check, 'sync-runtime --check ran');
  assert.equal(check.ok, false);
  assert.equal(r.ok, false);
  assert.equal(check.hint, MIRROR_FIX);
  assert.deepEqual(check.touches, ['src/a.mjs']);
  assert.deepEqual(check.newFindings, ['runtime copy drift: stale mirror/src/a.mjs (run starci release sync-runtime)']);
});

test('the same change carrying the refreshed mirror passes', (t) => {
  const { dir, base } = fixture(t);
  const baseline = { [MIRROR_CHECK]: mirrorRun(dir) };
  const head = commit(dir, { 'src/a.mjs': 'export const a = 2;\n', 'mirror/src/a.mjs': 'export const a = 2;\n' });
  const check = mirrorOf(gate(dir, base, head, baseline));
  assert.ok(check, 'sync-runtime --check ran');
  assert.equal(check.ok, true);
});

test('a candidate touching no mirrored file does not run the check', (t) => {
  const { dir, base } = fixture(t);
  const head = commit(dir, { 'src/other.mjs': 'export const o = 2;\n' });
  assert.equal(mirrorOf(gate(dir, base, head)), undefined);
  assert.equal(mirrorDriftCheck({ dir, changed: ['src/other.mjs'] }), null);
});

test('drift inherited from main is advisory, not blocking', (t) => {
  const { dir } = fixture(t);
  // main itself already drifted (the 6ba66d84a shape): the mirror is stale before the candidate.
  write(dir, 'src/a.mjs', 'export const a = 3;\n');
  git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'drifted main');
  const base = git(dir, 'rev-parse', 'HEAD');
  const baseline = { [MIRROR_CHECK]: mirrorRun(dir) };
  assert.equal(baseline[MIRROR_CHECK].ok, false);
  const head = commit(dir, { 'src/a.mjs': 'export const a = 4;\n' });
  const check = mirrorOf(gate(dir, base, head, baseline));
  assert.ok(check, 'sync-runtime --check ran');
  assert.equal(check.ok, true);
  assert.equal(check.note, 'red on main too, unchanged by this land');
});

test('the real generator mirrors the published closure only (no ledger writer: the caller owns the artifact hold), and the mirrors on main are current', () => {
  const { files, bundles } = mirroredFiles(ROOT);
  assert.ok(bundles.includes('packages/hfs/runtime'));
  assert.ok(files.includes('scripts/hfs/check.mjs'));
  assert.ok(!files.includes('engine/db/ledger.mjs'), 'safe-remove takes its hold from the caller, so no bundle drags the ledger writer in');
  for (const file of files.filter((f) => f.startsWith('engine/db/schema/'))) assert.ok(fs.existsSync(path.join(ROOT, file)), file);
  const r = mirrorRun(ROOT);
  assert.equal(r.ok, true, r.full);
});
