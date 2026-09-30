import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runGit } from '../scripts/lib/git.mjs';

// `git cat-file --batch` readers ask for raw bytes. encoding:'buffer' is the request token the callers
// spell; it is not a real encoding, and spawnSync throws ERR_UNKNOWN_ENCODING for it the moment a
// string `input` must be encoded (Node 24). gitSpawn maps the request to encoding:null, so the readers
// of committed blobs (work-ownership committedReader, canon-parity baseBlobsOf) and format-patch
// indexers (job-artifacts) keep getting a Buffer.

const git = (cwd, args) => {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true, env: { ...process.env,
    GIT_AUTHOR_NAME: 'spec', GIT_AUTHOR_EMAIL: 'spec@example.invalid', GIT_COMMITTER_NAME: 'spec', GIT_COMMITTER_EMAIL: 'spec@example.invalid' } });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
};

const repoWithBlob = (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-git-buffer-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  git(repo, ['init', '-q']);
  fs.writeFileSync(path.join(repo, 'record.yaml'), 'schema: work/business-rule@1\nid: spec\n');
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '-m', 'seed']);
  return repo;
};

test('runGit cat-file --batch with encoding buffer answers the blob bytes as a Buffer', (t) => {
  const repo = repoWithBlob(t);
  const r = runGit(['cat-file', '--batch'], { dir: repo, input: 'HEAD:record.yaml\n', encoding: 'buffer' });
  assert.equal(r.error, undefined);
  assert.equal(r.status, 0, String(r.stderr));
  assert.ok(Buffer.isBuffer(r.stdout), 'raw-bytes output is a Buffer, not utf8 text');
  const eol = r.stdout.indexOf(0x0a);
  assert.match(r.stdout.subarray(0, eol).toString('utf8'), /^[0-9a-f]+ blob \d+$/);
  assert.equal(r.stdout.subarray(eol + 1).toString('utf8'), 'schema: work/business-rule@1\nid: spec\n\n');
});

test('encoding null, the literal the callers pass, answers the same raw Buffer', (t) => {
  const repo = repoWithBlob(t);
  const r = runGit(['cat-file', '--batch'], { dir: repo, input: 'HEAD:record.yaml\n', encoding: null });
  assert.equal(r.status, 0, String(r.stderr));
  assert.ok(Buffer.isBuffer(r.stdout));
  assert.match(r.stdout.subarray(0, r.stdout.indexOf(0x0a)).toString('utf8'), / blob \d+$/);
});
