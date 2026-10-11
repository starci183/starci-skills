// release-cut-verb.spec.mjs - `starci release cut` is the catalog door of cutRelease, the only path that pushes main with a release tag.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { CATALOG } from '../../packages/cli/src/catalog.generated.mjs';
import { main, parseArgs } from '../../scripts/supervisor/release-cut-cli.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const capture = () => {
  const value = { out: '', err: '' };
  return { value, stdout: (text) => { value.out += text; }, stderr: (text) => { value.err += text; } };
};

test('the catalog resolves release cut to its entry and declares exactly the flags the entry parses', () => {
  const verb = CATALOG.groups.release.verbs.cut;
  assert.equal(verb.impl.script, 'scripts/supervisor/release-cut-cli.mjs');
  assert.ok(fs.existsSync(path.join(repoRoot, verb.impl.script)));
  assert.deepEqual(verb.flags.map((flag) => flag.name).sort(), ['branch', 'no-reuse', 'plan', 'remote', 'repo', 'rows', 'tag']);
  assert.deepEqual(parseArgs(['--repo', 'r', '--remote', 'o', '--branch', 'b', '--tag', 'v1', '--json']), { json: true, repo: 'r', remote: 'o', branch: 'b', tag: 'v1' });
  assert.deepEqual(parseArgs(['--plan']), { json: false, plan: true });
  assert.deepEqual(parseArgs(['--tag', 'v1', '--rows', 'npm test,linux-parity', '--no-reuse']), { json: false, tag: 'v1', rows: 'npm test,linux-parity', 'no-reuse': true });
});

test('a bad argument is exit 2 and cutRelease is never reached', async () => {
  for (const argv of [['--nope'], ['--tag'], ['--tag', '--json']]) {
    const io = capture();
    let called = false;
    assert.equal(await main(argv, { ...io, cutRelease: () => { called = true; return { ok: true }; } }), 2);
    assert.equal(called, false);
    assert.match(io.value.err, /starci release cut: /);
  }
});

test('a refused release is exit 1 with its verdict, a cut release is exit 0, --json prints the result', async () => {
  const refused = capture();
  assert.equal(await main([], { ...refused, cutRelease: () => ({ ok: false, verdict: 'dirty', why: 'tracked change' }) }), 1);
  assert.match(refused.value.out, /refused \(dirty\): tracked change/);

  const done = capture();
  let seen;
  assert.equal(await main(['--repo', 'x', '--tag', 'v1.0.0', '--json'], { ...done, cutRelease: (options) => { seen = options; return { ok: true, verdict: 'pushed', tag: 'v1.0.0', pushed: true }; } }), 0);
  assert.deepEqual(JSON.parse(done.value.out), { ok: true, verdict: 'pushed', tag: 'v1.0.0', pushed: true });
  assert.equal(seen.tag, 'v1.0.0');
  assert.equal(seen.repo, path.resolve('x'));
});

test('an asynchronous cutRelease (the L4 Sonar proof runs in-process) is awaited before the exit code is decided', async () => {
  const slow = capture();
  const code = await main(['--tag', 'v1.0.0'], { ...slow, cutRelease: async () => { await new Promise((resolve) => setImmediate(resolve)); return { ok: false, verdict: 'sonar', why: 'gate red' }; } });
  assert.equal(code, 1);
  assert.match(slow.value.out, /refused \(sonar\): gate red/);
});

// The lead started `starci release cut` in the backend repository whose ignored .claude folder is the runtime: the cut judged that repository (565 tracked changes) instead of the runtime.
test('without --repo the cut and the release notes take the runtime this command runs from, whatever directory they are started in', async (t) => {
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-cut-cwd-'));
  const before = process.cwd();
  t.after(() => { process.chdir(before); fs.rmSync(elsewhere, { recursive: true, force: true }); });
  process.chdir(elsewhere);
  let seen;
  const io = capture();
  await main(['--tag', 'v1.0.0', '--plan'], { ...io, cutRelease: (options) => { seen = options; return { ok: true, verdict: 'plan' }; } });
  assert.equal(seen.repo, repoRoot, 'the cut resolves the runtime root, not the git top of the working directory');
  const { releaseNotes } = await import('../../scripts/supervisor/release-notes.mjs');
  let read;
  releaseNotes({ args: { tag: 'v1.0.0' }, positionals: [], cwd: elsewhere }, { readChangelog: (dir) => { read = dir; return ''; } });
  assert.equal(read, repoRoot);
});
