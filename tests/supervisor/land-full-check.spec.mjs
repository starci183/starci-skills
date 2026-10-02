// 3.5: the land gate runs the FULL `starci check` (bin/starci.mjs check) of the candidate as a step of its own, not only the
// gate: a red run refuses the land, a green one passes, and a tree with no entry point is skipped (a fixture tree).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runChecks } from '../../scripts/supervisor/land.mjs';
import { FULL_CHECK_ENTRY, fullCheck as fullCheckWith } from '../../scripts/supervisor/land-full-check.mjs';

const runner = (args, { cwd, timeout }) => {
  const r = spawnSync(process.execPath, args, { cwd, timeout, encoding: 'utf8', windowsHide: true });
  return { ok: r.status === 0, stdout: String(r.stdout ?? ''), stderr: String(r.stderr ?? '') };
};
const fullCheck = (dir) => fullCheckWith(dir, runner);
const made = [];
test.after(() => { for (const dir of made) fs.rmSync(dir, { recursive: true, force: true }); });

/** A temp tree whose bin/starci.mjs is a stand-in `check` that prints `line` and exits `code`; null: no entry point. */
const tree = (code, line = 'self-checks: 1 of 1 passed') => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'land-full-check-'));
  made.push(dir);
  if (code !== null) {
    fs.mkdirSync(path.join(dir, path.dirname(FULL_CHECK_ENTRY)), { recursive: true });
    fs.writeFileSync(path.join(dir, FULL_CHECK_ENTRY), `if (process.argv[2] !== 'check') process.exit(64);\nconsole.log(${JSON.stringify(line)});\nprocess.exit(${code});\n`);
  }
  return dir;
};

test('the land runs `starci check` of the candidate: green passes, red refuses with its output (passing and violating)', () => {
  const green = fullCheck(tree(0));
  assert.equal(green.ok, true);
  const red = fullCheck(tree(1, 'RT_EXAMPLE a self-check failed'));
  assert.equal(red.ok, false);
  assert.match(red.output, /RT_EXAMPLE a self-check failed/);
});

test('a tree with no bin/starci.mjs is skipped, not a pass of the check it cannot run', () => {
  assert.deepEqual(fullCheck(tree(null)), { ok: true, skipped: true });
});

test('runChecks lists `starci check` as a step of the land and a red one fails the land, whatever else is green', () => {
  const git = (dir, ...args) => spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  const land = (code) => {
    const dir = tree(code);
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.email', 'land@example.test');
    git(dir, 'config', 'user.name', 'land');
    git(dir, 'config', 'commit.gpgsign', 'false');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'base');
    fs.writeFileSync(path.join(dir, 'note.json'), '{}\n');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'change');
    const [base, head] = git(dir, 'rev-list', '--max-count=2', 'HEAD').stdout.trim().split(/\r?\n/).reverse();
    return runChecks({ dir, base, head, specMode: 'none', runSpecs: false });
  };
  const green = land(0);
  assert.deepEqual(green.checks.filter((c) => c.name === 'starci check').map((c) => c.ok), [true]);
  const red = land(1);
  const step = red.checks.find((c) => c.name === 'starci check');
  assert.equal(step.ok, false);
  assert.equal(red.ok, false, 'one red full check refuses the land');
});
