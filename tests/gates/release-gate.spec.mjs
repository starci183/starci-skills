// release-gate.spec.mjs - the one release gate (scripts/gates/release-check.mjs, release-publish.mjs and their parts) on a temp
// runtime tree, with fakes at the npm and process edge: no network, no install, no publish. It proves the plan order, every
// blocker, that `release-check` prints GREEN only with every proof and never publishes, and that `release-publish` publishes
// only with --publish, leaves first and the bundling packages last.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { tarFiles } from '../../scripts/lib/tar-files.mjs';
import { tapSummary } from '../../scripts/lib/tap-summary.mjs';
import { classifyContent } from '../../scripts/gates/release-registry.mjs';
import { buildPlan, publishOrder, readRows } from '../../scripts/gates/release-plan.mjs';
import { FINAL_PROOFS, PROOFS, parseArgs, runProofs, verdictOf } from '../../scripts/gates/release-check.mjs';
import { EXIT, releasePublish } from '../../scripts/gates/release-publish.mjs';

/** A one-file-per-entry ustar gzip, the shape `npm pack` writes. */
function tgz(files) {
  const blocks = [];
  for (const [name, text] of Object.entries(files)) {
    const body = Buffer.from(text);
    const header = Buffer.alloc(512);
    header.write(name, 0, 100, 'utf8');
    header.write('0000644\0', 100);
    header.write(`${body.length.toString(8).padStart(11, '0')}\0`, 124);
    header.write('0', 156);
    blocks.push(header, body, Buffer.alloc((512 - (body.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return zlib.gzipSync(Buffer.concat(blocks));
}

const PIN = (name, dir, version) => `  '${name}':\n    version: ${version}\n    group: starci\n    install: registry\n    source: ${dir}/package.json\n`;

/** A runtime tree: leaf-b depends on leaf-a, canon bundles the pins copy, plus a private package nobody publishes. */
function tree(t, { versions = {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-gate-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const pkg = (dir, body) => { fs.mkdirSync(path.join(root, dir), { recursive: true }); fs.writeFileSync(path.join(root, dir, 'package.json'), JSON.stringify(body)); };
  pkg('packages/leaf-b', { name: '@starci/leaf-b', version: versions.b ?? '1.0.0', dependencies: { '@starci/leaf-a': '1.0.0' } });
  pkg('packages/leaf-a', { name: '@starci/leaf-a', version: '1.0.0' });
  pkg('packages/canon', { name: '@starci/canon', version: '2.0.0', scripts: { prepack: 'x' } });
  fs.writeFileSync(path.join(root, 'packages/canon/package-lock.json'), '{}');
  fs.mkdirSync(path.join(root, 'packages/canon/runtime/knowledge/hfs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'packages/canon/runtime/knowledge/hfs/canon-pins.yaml'), 'pins: {}\n');
  pkg('packages/internal', { name: 'internal-tool', version: '0.0.1', private: true });
  fs.mkdirSync(path.join(root, 'knowledge/hfs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'knowledge/hfs/canon-pins.yaml'),
    `schema: starci/canon-pins@1\npins:\n${PIN('@starci/leaf-a', 'packages/leaf-a', '1.0.0')}${PIN('@starci/leaf-b', 'packages/leaf-b', versions.bPin ?? '1.0.0')}${PIN('@starci/canon', 'packages/canon', '2.0.0')}`);
  for (const dir of ['node_modules', 'packages/node_modules']) { fs.mkdirSync(path.join(root, dir, 'x'), { recursive: true }); }
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'starci', version: '1.0.0-alpha.9' }));
  fs.writeFileSync(path.join(root, 'CHANGELOG.md'), '# Changelog\n\n## [1.0.0-alpha.9] - 2026-10-02\n\n- done\n');
  return root;
}

/** A fake registry: `published` maps name -> shasum; the local pack of every folder is `local`. */
function fakeRegistry({ published = {}, local = 'sha-local', unreachable = [], content = 'same', whoami = 'releaser', log = [] } = {}) {
  return {
    log,
    state: (name) => (unreachable.includes(name) ? { state: 'unreachable', detail: 'offline' } : name in published ? { state: 'present', shasum: published[name] } : { state: 'absent', latest: '-' }),
    localShasum: () => local,
    contentClass: (name) => (typeof content === 'function' ? content(name) : content),
    whoami: () => whoami,
    publish: (dir) => { log.push(`publish ${dir}`); published[`@starci/${path.basename(dir)}`] = local; return { ok: true, status: 0, stderr: '' }; },
  };
}
const allPublished = (extra = {}) => fakeRegistry({ published: { '@starci/leaf-a': 'sha-local', '@starci/leaf-b': 'sha-local', '@starci/canon': 'sha-local' }, ...extra });

test('tarFiles reads the regular files of an npm tarball and refuses a truncated one', () => {
  const files = tarFiles(tgz({ 'package/package.json': '{"name":"x"}', 'package/dist/a.js': 'a'.repeat(700) }));
  assert.deepEqual([...files.keys()], ['package/package.json', 'package/dist/a.js']);
  assert.equal(files.get('package/dist/a.js').length, 700);
  assert.throws(() => tarFiles(zlib.gzipSync(zlib.gunzipSync(tgz({ 'package/a': 'x'.repeat(2000) })).subarray(0, 700))), /truncated/);
});

test('classifyContent: line endings, stale dist and real drift are told apart', () => {
  const f = (o) => new Map(Object.entries(o).map(([k, v]) => [k, Buffer.from(v)]));
  assert.equal(classifyContent(f({ 'package/a.js': 'x\n' }), f({ 'package/a.js': 'x\n' })), 'same');
  assert.equal(classifyContent(f({ 'package/a.js': 'x\n' }), f({ 'package/a.js': 'x\r\n' })), 'crlf');
  assert.equal(classifyContent(f({ 'package/dist/a.js': '1' }), f({ 'package/dist/a.js': '2' })), 'dist 1');
  assert.match(classifyContent(f({ 'package/a.js': '1' }), f({ 'package/a.js': '2', 'package/b.js': '3' })), /^drift 2: differs a\.js; only-local b\.js$/);
});

test('tapSummary reads the counts and the deepest failing names', () => {
  const tap = ['TAP version 13', '# Subtest: outer', '    # Subtest: inner', '    not ok 1 - inner', '    1..1', 'not ok 1 - outer', 'ok 2 - fine', '# tests 3', '# pass 1', '# fail 2', '# cancelled 0', '# skipped 0', '# todo 0'].join('\n');
  const sum = tapSummary(tap);
  assert.deepEqual([sum.tests, sum.pass, sum.fail, sum.cancelled], [3, 1, 2, 0]);
  assert.deepEqual(sum.failing, ['outer > inner']);
  assert.equal(tapSummary('').tests, null);
});

test('the plan reads the publish set from canon-pins, orders leaves by dependency and the bundling package last', (t) => {
  const root = tree(t);
  const rows = readRows(root);
  assert.deepEqual(rows.filter((r) => r.kind === 'private').map((r) => r.name), ['internal-tool'], 'a private package is never in the set');
  assert.deepEqual(publishOrder(rows).map((r) => r.name), ['@starci/leaf-a', '@starci/leaf-b', '@starci/canon']);
  const plan = buildPlan({ root, registry: fakeRegistry() });
  assert.equal(plan.toPublish.length, 3);
  assert.deepEqual(plan.blockers, []);
});

test('plan blockers: a pin mismatch, an unreachable registry, content drift and the canon cascade', (t) => {
  const mismatch = buildPlan({ root: tree(t, { versions: { b: '1.0.1' } }), registry: fakeRegistry() });
  assert.match(mismatch.blockers.join('|'), /leaf-b: local 1\.0\.1 differs from its canon-pins version 1\.0\.0/);
  const offline = buildPlan({ root: tree(t), registry: fakeRegistry({ unreachable: ['@starci/leaf-a'] }) });
  assert.match(offline.blockers.join('|'), /leaf-a: registry unreachable \(offline\)/);
  const drift = buildPlan({ root: tree(t), registry: allPublished({ local: 'other', content: (name) => (name === '@starci/leaf-a' ? 'drift 1: differs a.js' : 'same') }) });
  assert.match(drift.blockers.join('|'), /leaf-a@1\.0\.0 is on the registry but the source differs/);
  assert.match(drift.blockers.join('|'), /canon@2\.0\.0 is already published, but a publish or version bump of another package changes the canon-pins copy/);
  const ok = buildPlan({ root: tree(t), registry: allPublished({ local: 'other', content: 'crlf' }) });
  assert.deepEqual(ok.blockers, [], 'a CRLF-only difference is a note, not a blocker');
  const newLeaf = buildPlan({ root: tree(t), registry: fakeRegistry({ published: { '@starci/leaf-a': 'sha-local', '@starci/canon': 'sha-local' } }) });
  assert.match(newLeaf.blockers.join('|'), /canon@2\.0\.0 is already published, but a publish/, 'a leaf still to publish forces the bundling package to bump');
});

/** Fake process edge: every step passes unless `fail` names it. */
function fakeNode({ fail = [], log = [] } = {}) {
  return (args) => {
    const script = String(args.find((a) => /\.mjs$/.test(a) && !a.includes('tests/setup')) ?? '');
    log.push(path.basename(script) || 'spec-run');
    if (args.includes('--test')) {
      const dest = args.find((a) => a.startsWith('--test-reporter-destination=') && a.endsWith('.tap'));
      const failed = fail.includes('specs');
      if (dest) fs.writeFileSync(dest.split('=')[1], `# tests 10\n# pass ${failed ? 9 : 10}\n# fail ${failed ? 1 : 0}\n# cancelled 0\n# skipped 0\n# todo 0\n`);
      return { status: failed ? 1 : 0, stdout: '', stderr: '' };
    }
    if (script.endsWith('check-canon-pins.mjs')) return { status: fail.includes('canon-pins') ? 1 : 0, stdout: JSON.stringify({ ok: !fail.includes('canon-pins'), profiles: 2, pins: 3, errors: [] }), stderr: '' };
    if (script.endsWith('package-clean-test.mjs')) return { status: fail.includes('package-clean') ? 1 : 0, stdout: `package-clean-test: ${fail.includes('package-clean') ? '2 green, 1 red' : '3 green, 0 red'}, 0 not run, of 3\n`, stderr: '' };
    if (script.endsWith('release-app-installs.mjs')) return { status: 0, stdout: fail.includes('app-installs') ? 'SKIPPED: no installs\n' : 'release-app-installs: OK\n', stderr: '' };
    return { status: 0, stdout: '', stderr: '' };
  };
}
const fakeNpm = (log = []) => (args) => { log.push(`npm ${args.join(' ')}`); return { status: 0, stdout: '', stderr: '' }; };
const cleanGit = { status: () => ({ ok: true, stdout: '', stderr: '' }) };

test('release-check prints GREEN only when every proof of the checklist holds, and never publishes', (t) => {
  const root = tree(t);
  const registry = allPublished();
  const calls = [];
  const rows = runProofs({ root, deps: { node: fakeNode({ log: calls }), npm: fakeNpm(calls), registry, git: cleanGit } });
  assert.deepEqual(rows.map((r) => r.id), [...PROOFS]);
  assert.equal(verdictOf(rows), 'GREEN', JSON.stringify(rows.map((r) => [r.id, r.status, r.detail])));
  assert.deepEqual(registry.log, [], 'the check never calls publish');
  assert.ok(calls.includes('npm run check'));
});

test('release-check goes RED on a skipped app install, a failing spec, a pending publish and a dirty tree; a subset is PARTIAL', (t) => {
  const root = tree(t);
  const verdict = (deps, ids = PROOFS) => { const rows = runProofs({ root, ids, deps: { npm: fakeNpm(), git: cleanGit, registry: allPublished(), node: fakeNode(), ...deps } }); return [verdictOf(rows), rows]; };
  const [skipped, skippedRows] = verdict({ node: fakeNode({ fail: ['app-installs'] }) });
  assert.equal(skipped, 'RED');
  assert.match(skippedRows.find((r) => r.id === 'app-installs').detail, /a proof skipped/);
  assert.equal(verdict({ node: fakeNode({ fail: ['specs'] }) })[0], 'RED');
  assert.equal(verdict({ node: fakeNode({ fail: ['package-clean'] }) })[0], 'RED');
  assert.equal(verdict({ node: fakeNode({ fail: ['canon-pins'] }) })[0], 'RED');
  const [pending, pendingRows] = verdict({ registry: fakeRegistry({ published: { '@starci/leaf-a': 'sha-local', '@starci/leaf-b': 'sha-local' } }) });
  assert.equal(pending, 'RED');
  assert.match(pendingRows.find((r) => r.id === 'publish-plan').detail, /1 package\(s\) still to publish: @starci\/canon@2\.0\.0/);
  assert.equal(verdict({ git: { status: () => ({ ok: true, stdout: ' M a.mjs', stderr: '' }) } })[0], 'RED');
  assert.equal(verdict({ git: { status: () => ({ ok: false, stdout: '', stderr: 'no git' }) } })[0], 'UNRUN');
  assert.equal(verdictOf(runProofs({ root, ids: ['canon-pins'], deps: { node: fakeNode() } }), { complete: false }), 'PARTIAL');
});

test('--final adds the identity proof: a dated changelog section on main, no open markers', (t) => {
  const root = tree(t);
  const onMain = () => ({ stdout: 'main\n' });
  const run = () => runProofs({ root, ids: FINAL_PROOFS, deps: { branch: onMain } })[0];
  assert.equal(run().status, 'pass');
  fs.writeFileSync(path.join(root, 'CHANGELOG.md'), '## [1.0.0-alpha.9] - in preparation\n- TODO(x) later\n');
  assert.match(run().detail, /in preparation.*open marker/);
  assert.match(runProofs({ root, ids: FINAL_PROOFS, deps: { branch: () => ({ stdout: 'lane/x' }) } })[0].detail, /not main/);
  assert.deepEqual(parseArgs(['--final', '--only', 'check,specs', '--json']), { final: true, only: ['check', 'specs'], json: true });
  assert.throws(() => parseArgs(['--only', 'nope']), /unknown proof nope/);
});

test('release-publish: the plan is the default; --publish needs --npm-user, a clean main and the right account, and publishes leaves first', (t) => {
  const root = tree(t);
  const lines = [];
  const out = (line) => lines.push(line);
  const calls = [];
  const registry = fakeRegistry({ log: calls });
  const git = { dirty: () => ({ ok: true, stdout: '' }), branch: () => ({ stdout: 'main' }), head: () => ({ stdout: 'abc' }) };
  const base = { root, deps: { registry, node: fakeNode({ log: calls }), ci: (dir) => { calls.push(`ci ${dir}`); return { ok: true }; }, git, sleep: () => {}, out } };

  assert.equal(releasePublish({ ...base }), EXIT.done);
  assert.deepEqual(calls.filter((c) => c.startsWith('publish')), [], 'the default run publishes nothing');
  assert.match(lines.join('\n'), /3 to publish, 0 blocker\(s\)/);
  assert.equal(releasePublish({ ...base, publish: true }), EXIT.usage, '--publish needs --npm-user');
  assert.equal(releasePublish({ ...base, publish: true, npmUser: 'someone-else' }), EXIT.usage, 'the logged-in account must match');
  assert.equal(releasePublish({ ...base, publish: true, npmUser: 'releaser', deps: { ...base.deps, git: { ...git, branch: () => ({ stdout: 'lane/x' }) } } }), EXIT.usage, 'off main is refused');
  assert.equal(releasePublish({ ...base, publish: true, npmUser: 'releaser', deps: { ...base.deps, git: { ...git, dirty: () => ({ ok: true, stdout: ' M packages/x' }) } } }), EXIT.usage, 'a dirty tree is refused');
  assert.deepEqual(calls.filter((c) => c.startsWith('publish')), [], 'every refusal came before a publish');

  assert.equal(releasePublish({ ...base, publish: true, npmUser: 'releaser' }), EXIT.done, lines.join('\n'));
  assert.deepEqual(calls.filter((c) => c.startsWith('publish') || c.startsWith('ci')), ['publish packages/leaf-a', 'publish packages/leaf-b', 'ci packages/canon', 'publish packages/canon'],
    'leaves by dependency, the bundling package last, npm ci only for a prepack package with a lockfile');
  assert.equal(releasePublish({ ...base }), EXIT.done, 'a second plan finds everything published');
});

test('release-publish stops at a blocker, a red clean proof and an unbound canon', (t) => {
  const root = tree(t, { versions: { bPin: '9.9.9' } });
  const out = () => {};
  const git = { dirty: () => ({ ok: true, stdout: '' }), branch: () => ({ stdout: 'main' }), head: () => ({ stdout: 'abc' }) };
  const deps = { registry: fakeRegistry(), node: fakeNode(), ci: () => ({ ok: true }), git, sleep: () => {}, out };
  assert.equal(releasePublish({ root, deps }), EXIT.blocked);
  assert.equal(releasePublish({ root, publish: true, npmUser: 'releaser', deps }), EXIT.failed, 'no publish with a blocker');
  const ok = tree(t);
  const cleanRed = { ...deps, registry: fakeRegistry(), node: fakeNode({ fail: ['package-clean'] }) };
  assert.equal(releasePublish({ root: ok, publish: true, npmUser: 'releaser', deps: cleanRed }), EXIT.failed);
  assert.deepEqual(cleanRed.registry.log, [], 'a red clean proof publishes nothing');
  const unbound = { ...deps, registry: fakeRegistry(), node: fakeNode({ fail: ['canon-pins'] }) };
  assert.equal(releasePublish({ root: ok, publish: true, npmUser: 'releaser', deps: unbound }), EXIT.unbound);
});
