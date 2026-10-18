// `starci app coverage merge`: the lcov reports of the unit shards become one report, hits summed by identity, one record per source file.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { coverageMain } from '../coverage/cli.mjs';
import { mergeLcov } from '../runtime/scripts/hfs/lcov-merge.mjs';

const shardOne = 'TN:\nSF:/w/be/src/a.service.ts\nFN:3,run#0\nFN:9,stop#1\nFNDA:1,run#0\nFNDA:0,stop#1\nFNF:2\nFNH:1\nDA:3,1\nDA:9,0\nLF:2\nLH:1\nBRDA:3,0,0,1\nBRDA:3,0,1,0\nBRF:2\nBRH:1\nend_of_record\n';
const shardTwo = 'TN:\nSF:/w/be/src/a.service.ts\nFN:3,run#0\nFN:9,stop#1\nFNDA:0,run#0\nFNDA:2,stop#1\nDA:3,0\nDA:9,2\nBRDA:3,0,0,0\nBRDA:3,0,1,-\nend_of_record\nSF:/w/be/src/b.service.ts\nDA:1,1\nend_of_record\n';

test('shard reports merge by line, function and branch identity into one record per file', () => {
  const merged = mergeLcov([shardOne, shardTwo]);
  assert.equal(merged.split('\n').filter((line) => line.startsWith('SF:')).length, 2);
  const a = merged.slice(0, merged.indexOf('end_of_record'));
  for (const line of ['FNDA:1,run#0', 'FNDA:2,stop#1', 'FNF:2', 'FNH:2', 'DA:3,1', 'DA:9,2', 'LF:2', 'LH:2', 'BRDA:3,0,0,1', 'BRDA:3,0,1,0', 'BRF:2', 'BRH:1']) assert.ok(a.includes(`${line}\n`), line);
  assert.equal(mergeLcov([shardTwo, shardOne]), merged, 'the merge does not depend on the shard order');
});

test('the verb merges every lcov.info below a directory and refuses when there is none', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-coverage-merge-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [shard, text] of [['coverage-shard-1', shardOne], ['coverage-shard-2', shardTwo]]) {
    fs.mkdirSync(path.join(root, 'be', 'coverage', 'shards', shard), { recursive: true });
    fs.writeFileSync(path.join(root, 'be', 'coverage', 'shards', shard, 'lcov.info'), text);
  }
  let out = '';
  const code = await coverageMain(['merge', '--out', 'be/coverage/lcov.info', 'be/coverage/shards'], { cwd: root, stdout: (s) => { out += s; }, stderr: () => {} });
  assert.equal(code, 0);
  assert.match(out, /2 report\(s\), 2 source file\(s\) -> be\/coverage\/lcov\.info/);
  assert.equal(fs.readFileSync(path.join(root, 'be', 'coverage', 'lcov.info'), 'utf8'), mergeLcov([shardOne, shardTwo]));
  fs.mkdirSync(path.join(root, 'empty'));
  let err = '';
  assert.equal(await coverageMain(['merge', '--out', 'x.info', 'empty'], { cwd: root, stdout: () => {}, stderr: (s) => { err += s; } }), 2);
  assert.match(err, /no lcov report/);
  assert.equal(await coverageMain(['merge', 'empty'], { cwd: root, stdout: () => {}, stderr: () => {} }), 2, '--out is required');
});

test('a shard placeholder of zeros (its own instrumentation of an unloaded file) never adds phantom entries; a file no shard ran stays uncovered', () => {
  const ran = 'SF:/w/be/src/c.service.ts\nFN:2,run#0\nFNDA:3,run#0\nDA:2,3\nBRDA:2,0,0,1\nBRDA:2,0,1,1\nend_of_record\n';
  const placeholder = 'SF:/w/be/src/c.service.ts\nFN:1,(anonymous_0)\nFN:2,run\nFNDA:0,(anonymous_0)\nFNDA:0,run\nDA:2,0\nBRDA:2,0,0,0\nBRDA:2,1,0,0\nBRDA:2,1,1,0\nend_of_record\nSF:/w/be/src/d.service.ts\nFN:1,go\nFNDA:0,go\nDA:1,0\nend_of_record\n';
  const merged = mergeLcov([placeholder, ran, placeholder]);
  const c = merged.slice(merged.indexOf('SF:/w/be/src/c.service.ts'), merged.indexOf('SF:/w/be/src/d.service.ts'));
  for (const line of ['FNF:1', 'FNH:1', 'LF:1', 'LH:1', 'BRF:2', 'BRH:2']) assert.ok(c.includes(`${line}\n`), `${line} in ${c}`);
  const d = merged.slice(merged.indexOf('SF:/w/be/src/d.service.ts'));
  for (const line of ['FNF:1', 'FNH:0', 'LF:1', 'LH:0']) assert.ok(d.includes(`${line}\n`), `${line} in ${d}`);
});

test('branches merge by line and block ordinal across shards that numbered blocks differently; a loaded-only record adds no branch; a real gap stays', () => {
  const tested = 'SF:/w/be/src/e.guard.ts\nFN:21,Guard#0\nFN:24,can#1\nFNDA:8,Guard#0\nFNDA:8,can#1\nDA:21,8\nDA:24,8\nBRDA:21,6,0,8\nBRDA:21,7,0,8\nBRDA:24,8,0,8\nBRDA:24,8,1,0\nend_of_record\n';
  const loadedOnly = 'SF:/w/be/src/e.guard.ts\nFN:21,Guard#0\nFN:24,can#1\nFNDA:0,Guard#0\nFNDA:0,can#1\nDA:1,1\nDA:21,0\nBRDA:21,0,0,0\nend_of_record\n';
  const renumbered = 'SF:/w/be/src/e.guard.ts\nFN:21,Guard#0\nFN:24,can#1\nFNDA:1,Guard#0\nFNDA:1,can#1\nDA:21,1\nDA:24,1\nBRDA:21,0,0,1\nBRDA:21,1,0,1\nBRDA:24,2,0,1\nBRDA:24,2,1,0\nend_of_record\n';
  const merged = mergeLcov([loadedOnly, tested, renumbered]);
  for (const line of ['FNF:2', 'FNH:2', 'BRF:4', 'BRH:3', 'BRDA:24,0,1,0']) assert.ok(merged.includes(`${line}\n`), `${line} in ${merged}`);
});
