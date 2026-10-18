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
