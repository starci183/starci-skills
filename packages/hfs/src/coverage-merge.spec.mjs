// `starci app coverage merge`: the shard reports go to the app's installed @starci/jest-preset merge (istanbul-lib-coverage by source location; the
// preset's own spec proves the merge itself), and the verb refuses a bad usage, a missing preset and a merge that found no report.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { coverageMain } from '../coverage/cli.mjs';

const io = () => { const out = { stdout: '', stderr: '' }; return { out, stdout: (s) => { out.stdout += s; }, stderr: (s) => { out.stderr += s; } }; };

test('the verb hands the absolute shard inputs and the lcov directory to the preset merge', async () => {
  const seen = [];
  const { out, stdout, stderr } = io();
  const code = await coverageMain(['merge', '--out', 'be/coverage/lcov.info', 'be/coverage/shards'], { cwd: '/app', stdout, stderr, merge: (args) => { seen.push(args); return { reports: 6, files: 40 }; } });
  assert.equal(code, 0, out.stderr);
  assert.deepEqual(seen, [{ inputs: [path.resolve('/app', 'be/coverage/shards')], outDir: path.resolve('/app', 'be/coverage') }]);
  assert.match(out.stdout, /6 shard report\(s\), 40 source file\(s\) -> be\/coverage\/lcov\.info/);
});

test('a merge that found no report, a bad usage and an app without the preset refuse with exit 2', async (t) => {
  const failing = io();
  assert.equal(await coverageMain(['merge', '--out', 'be/coverage/lcov.info', 'x'], { cwd: '/app', ...failing, merge: () => { throw new Error('no coverage-final.json under x'); } }), 2);
  assert.match(failing.out.stderr, /no coverage-final\.json/);
  for (const argv of [['merge', 'x'], ['merge', '--out', 'be/coverage/other.txt', 'x'], ['split', '--out', 'be/coverage/lcov.info', 'x']]) {
    const bad = io();
    assert.equal(await coverageMain(argv, { cwd: '/app', ...bad, merge: () => ({ reports: 1, files: 1 }) }), 2, argv.join(' '));
  }
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-coverage-noapp-'));
  t.after(() => fs.rmSync(empty, { recursive: true, force: true }));
  const missing = io();
  assert.equal(await coverageMain(['merge', '--out', 'be/coverage/lcov.info', 'be/coverage/shards'], { cwd: empty, ...missing }), 2);
  assert.match(missing.out.stderr, /@starci\/jest-preset\/merge is not installed/);
});

test('verify proves the merged report with the coverage judgement alone: exit 0 proved, 1 refused, 2 when it cannot run', async () => {
  const calls = [];
  const proved = io();
  const ok = (args) => { calls.push(args); return { ok: true, measured: ['src/modules/domain/a/a.service.ts'], unmeasured: [], unmeasuredScopes: [], findings: [], scope: { roots: [], roles: ['service'] } }; };
  assert.equal(await coverageMain(['verify', 'be/coverage/lcov.info'], { cwd: '/app', ...proved, prove: ok }), 0, proved.out.stderr);
  assert.deepEqual(calls, [{ repoRoot: path.resolve('/app'), coverageFrom: 'be/coverage/lcov.info' }]);
  assert.match(proved.out.stdout, /^coverage: passed \(1 measured logic files/u);
  const refused = io();
  const below = () => ({ ok: false, measured: ['src/modules/domain/a/a.service.ts'], unmeasured: [], unmeasuredScopes: [], scope: { roots: [], roles: ['service'] },
    findings: [{ code: 'BE_COVERAGE_BELOW', path: 'be/src/modules/domain/a/a.service.ts', message: 'lines 90' }] });
  assert.equal(await coverageMain(['verify', 'be/coverage/lcov.info'], { cwd: '/app', ...refused, prove: below }), 1);
  assert.match(refused.out.stdout, /BE_COVERAGE_BELOW be\/src\/modules\/domain\/a\/a\.service\.ts: lines 90/u);
  const broken = io();
  assert.equal(await coverageMain(['verify', 'be/coverage/lcov.info'], { cwd: '/app', ...broken, prove: () => { throw new Error('coverage proof requires an app root or its be side'); } }), 2);
  assert.match(broken.out.stderr, /requires an app root/u);
  for (const argv of [['verify'], ['verify', 'a.info', 'b.info'], ['verify', '--out', 'be/coverage/lcov.info', 'a.info']]) {
    const bad = io();
    assert.equal(await coverageMain(argv, { cwd: '/app', ...bad, prove: ok }), 2, argv.join(' '));
  }
});
