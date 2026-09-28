import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {emitCheckOutput} from '../scripts/checks/output.mjs';
import {blobOutputMain} from '../scripts/checks/blob-output.mjs';
import {parseCanonScanArgs} from '../scripts/checks/canon-scan.mjs';
import {parseScopedLintArgs,scopedLintMain} from '../scripts/checks/check-scoped-lint.mjs';
import {getBlob} from '../scripts/lib/artifact-store.mjs';

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

test('generic blob helper captures draw or grammar stdout and preserves the check exit code', async () => {
  stored.length = 0;
  let printed = '';
  let errors = '';
  const status = await blobOutputMain(['--media-type', 'application/json', '--', process.execPath, 'check.mjs'], {
    run: () => ({stdout: Buffer.from('{"ok":false}\n'), stderr: Buffer.from('finding\n'), status: 1}),
    put, write: text => { printed += text; }, fail: text => { errors += text; },
  });
  assert.equal(status, 1);
  const refs = JSON.parse(printed);
  assert.equal(refs.sha, stored[0].sha);
  assert.equal(refs.stderrSha, stored[1].sha);
  assert.equal(errors, 'finding\n');
});

test('generic helper stores a scratch file through the real artifact store', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-check-blobs-'));
  const previous = process.env.STARCI_ARTIFACT_ROOT;
  process.env.STARCI_ARTIFACT_ROOT = path.join(root, 'artifacts');
  t.after(() => {
    if (previous === undefined) delete process.env.STARCI_ARTIFACT_ROOT;
    else process.env.STARCI_ARTIFACT_ROOT = previous;
    fs.rmSync(root, {recursive: true, force: true});
  });
  const file = path.join(root, 'check.json');
  fs.writeFileSync(file, '{"findings":2}\n');
  let printed = '';
  assert.equal(await blobOutputMain(['--file', file], {write: text => { printed += text; }}), 0);
  const {sha} = JSON.parse(printed);
  assert.equal(getBlob(sha).toString(), '{"findings":2}\n');
});

test('canon and scoped lint accept blob or scratch output without changing the verdict', async () => {
  assert.equal(parseCanonScanArgs(['--root', '.', '--blob']).blob, true);
  assert.throws(() => parseCanonScanArgs(['--root', '.', '--blob', '--out', 'report.json']), /mutually exclusive/);
  assert.equal(parseScopedLintArgs(['--profile', 'next', '--root', '.', '--blob', '--', 'a.ts']).blob, true);
  stored.length = 0;
  let printed = '';
  const result = await scopedLintMain(['--profile', 'next', '--root', '.', '--blob', '--', 'a.ts'], {
    checker: async () => ({status: 'findings', ok: false}), put, write: text => { printed += text; },
  });
  assert.equal(result.exitCode, 1);
  assert.deepEqual(JSON.parse(printed), {sha: stored[0].sha, redaction: 'v1'});
  assert.deepEqual(JSON.parse(stored[0].bytes.toString()), result.report);
});
