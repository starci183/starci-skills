// scaffold-e2e-verdict.e2e.spec.mjs - the prerequisites of the scaffold e2e (Docker answering, the app installs) are red when missing, never a pass.
// Every scaffold test FAILS on a missing prerequisite instead of skipping, and the gate that runs them (`starci release scaffold-e2e`, the proof of
// `starci release check`) is red for a skipped or todo test as well, so no way of leaving a test unrun is green. The gate runs here over a fake node
// process that writes the TAP report a real run would, so the verdict itself is what is proven.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runScaffoldE2e } from '../scripts/gates/scaffold-e2e.mjs';

const RUNTIME = path.resolve(import.meta.dirname, '..');

/** A scaffold-e2e run whose node process exits `status` after writing a TAP report with `counts`. */
function verdictOf(counts, status = 0) {
  const runNode = (args) => {
    const destination = args.find((arg) => arg.startsWith('--test-reporter-destination=') && arg.endsWith('.tap'));
    const file = destination.slice('--test-reporter-destination='.length);
    const report = ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'].map((key) => `# ${key} ${counts[key] ?? 0}`).join('\n');
    fs.writeFileSync(file, `TAP version 13\n${report}\n`);
    return { status, stdout: '', stderr: '' };
  };
  return runScaffoldE2e({ root: RUNTIME, env: {}, deps: { prepare: () => ({ ok: true, lines: [] }), progress: () => undefined, runNode } });
}

test('a run in which every scaffold test passed is green', () => {
  const run = verdictOf({ tests: 4, pass: 4 });
  assert.equal(run.ok, true);
  assert.equal(run.line, 'scaffold-e2e: 4 of 4 passed, 0 failed, 0 skipped');
});

test('a skipped scaffold test (Docker or an app install that did not answer) makes the run red', () => {
  const run = verdictOf({ tests: 4, pass: 3, skipped: 1 });
  assert.equal(run.ok, false);
  assert.equal(run.skipped, 1);
  assert.equal(run.line, 'scaffold-e2e: 3 of 4 passed, 0 failed, 1 skipped');
});

test('a todo test, a failed test, a cancelled test and a run with no test are red', () => {
  assert.equal(verdictOf({ tests: 4, pass: 3, todo: 1 }).ok, false);
  assert.equal(verdictOf({ tests: 4, pass: 3, fail: 1 }, 1).ok, false);
  assert.equal(verdictOf({ tests: 4, pass: 3, cancelled: 1 }, 1).ok, false);
  assert.equal(verdictOf({ tests: 0, pass: 0 }).ok, false);
});

test('no scaffold e2e file skips: a prerequisite that is missing fails its test', () => {
  const directive = /\bskip\s*[:(]|\.skip\b|\bt\.skip\b|\bonly\s*:|\.todo\b|\btodo\s*:/;
  const files = fs.readdirSync(import.meta.dirname).filter((name) => name.endsWith('.spec.mjs') && name !== path.basename(import.meta.filename));
  assert.ok(files.includes('hfs-scaffold-app.e2e.spec.mjs'), 'the scan reaches the scaffold specs');
  for (const name of files) {
    const hits = fs.readFileSync(path.join(import.meta.dirname, name), 'utf8').split(/\r?\n/).filter((line) => directive.test(line) && !/^\s*(\/\/|\*)/.test(line) && !/never a skip|skips nothing/.test(line));
    assert.deepEqual(hits, [], `${name} writes a skip`);
  }
});
