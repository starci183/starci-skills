import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {emitCheckOutput} from '../scripts/checks/output.mjs';
import {parseCanonScanArgs} from '../scripts/checks/canon-scan.mjs';

const stored = [];
const put = async (bytes, {mediaType}) => {
  const sha = createHash('sha256').update(bytes).digest('hex');
  stored.push({bytes: Buffer.from(bytes), mediaType, sha});
  return {sha, size: bytes.length, mediaType};
};

test('check output writes exact bytes to scratch or stores them by sha', async t => {
  stored.length = 0;
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-check-output-'));
  t.after(() => fs.rmSync(scratch, {recursive: true, force: true}));
  const out = path.join(scratch, 'nested', 'report.json');
  const body = '{"ok":true}\n';
  await emitCheckOutput(body, {out});
  assert.equal(fs.readFileSync(out, 'utf8'), body);
  let printed = '';
  const {sha} = await emitCheckOutput(body, {blob: true, put, write: text => { printed += text; }});
  assert.deepEqual(JSON.parse(printed), {sha, redaction: 'v1'});
  assert.equal(stored[0].bytes.toString(), body);
  assert.equal(stored[0].mediaType, 'application/json');
  await assert.rejects(emitCheckOutput(body, {out, blob: true, put}), /mutually exclusive/);
});

test('canon-scan accepts blob or scratch output', () => {
  assert.equal(parseCanonScanArgs(['--root', '.', '--blob']).blob, true);
  assert.throws(() => parseCanonScanArgs(['--root', '.', '--blob', '--out', 'report.json']), /mutually exclusive/);
});
