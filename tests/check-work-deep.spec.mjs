import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {runTimeOf} from '../scripts/checks/check-work-deep.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

test('a work/evidence@1 run object is read by its minted id, never joined as a runs/ directory', () => {
  const run = {id: '20260919T155312Z-5c10a673', outcome: 'pass', result: {name: 'result.md', sha256: 'a'.repeat(64)}, screens: [], videos: []};
  assert.equal(runTimeOf(run)?.toISOString(), '2026-09-19T15:53:12.000Z');
  assert.equal(runTimeOf(undefined), null);
  assert.equal(runTimeOf('runs/20260919T155312Z-5c10a673'), null, 'a path string is not the run object');
  assert.equal(runTimeOf({id: 'not-a-run-id'}), null);
});

test('check-work-deep.mjs over the shipped examples reports findings and never crashes on a run object', () => {
  const run = spawnSync(process.execPath, ['scripts/checks/check-work-deep.mjs'], {cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 300000});
  assert.ok(run.status === 0 || run.status === 1, `exit ${run.status}\n${run.stderr}`);
  assert.doesNotMatch(run.stderr, /TypeError|ERR_INVALID_ARG_TYPE/);
  assert.match(run.stdout, /\d+ refused, \d+ suspect, \d+ info/);
});
