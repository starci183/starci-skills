import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { decodeBase85Line, parsePatchText, pathsOfDiffLine, unquoteGitPath, writePatchJson } from '../../scripts/kernel/patch-json.mjs';

// A job .patch pre-structured as <patch>.json (scripts/kernel/patch-json.mjs): statuses, renames, binary and image
// flags with decoded literals, hunk line numbers, multi-commit series, the mail signature, and the caps.
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6360000002000154a24f5d0000000049454e44ae426082', 'hex');
const git = (cwd, ...args) => {
  const r = spawnSync('git', ['-C', cwd, '-c', 'user.name=spec', '-c', 'user.email=spec@example.invalid', '-c', 'core.autocrlf=false', ...args], { encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
};
const series = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-patch-json-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  git(dir, 'init', '-q', '-b', 'main');
  const write = (p, v) => { fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true }); fs.writeFileSync(path.join(dir, p), v); };
  write('src/keep.ts', 'export const a = 1;\nexport const b = 2;\nexport const c = 3;\n');
  write('src/old-name.ts', 'export const moved = true;\nexport const same = 1;\nexport const more = 2;\n');
  write('src/gone.ts', 'export const gone = 1;\n');
  git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'base');
  const base = git(dir, 'rev-parse', 'HEAD').trim();
  write('src/keep.ts', 'export const a = 1;\nexport const b = 20;\nexport const c = 3;\n');
  fs.renameSync(path.join(dir, 'src/old-name.ts'), path.join(dir, 'src/new-name.ts'));
  fs.rmSync(path.join(dir, 'src/gone.ts'));
  write('docs/ảnh chụp.png', PNG);
  write('src/secret-free.md', '-- \nnot a signature\n');
  git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'feat: first change');
  write('src/keep.ts', 'export const a = 1;\nexport const b = 20;\nexport const c = 30;\nexport const d = 4;\n');
  git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'feat: second change');
  const head = git(dir, 'rev-parse', 'HEAD').trim();
  const patch = git(dir, 'format-patch', '--stdout', '--binary', '--full-index', `${base}..${head}`);
  return { dir, base, head, patch };
};

test('path helpers: git quoting, diff --git splitting, base85', () => {
  assert.equal(unquoteGitPath('"docs/\\341\\272\\243nh.png"'), 'docs/ảnh.png');
  assert.deepEqual(pathsOfDiffLine('diff --git a/src/a b/c.ts b/src/a b/c.ts'), ['src/a b/c.ts', 'src/a b/c.ts']);
  assert.deepEqual(pathsOfDiffLine('diff --git a/x.ts b/y.ts'), ['x.ts', 'y.ts']);
  assert.deepEqual([...decodeBase85Line('D00000')], [0, 0, 0, 0]);
});

test('a real format-patch series: statuses, rename, delete, binary image, merged commits, signature ignored', (t) => {
  const { patch, base, head } = series(t);
  const doc = parsePatchText(patch);
  assert.equal(doc.commits.length, 2);
  assert.deepEqual(doc.commits.map((c) => c.subject), ['feat: first change', 'feat: second change']);
  const byPath = new Map(doc.files.map((f) => [f.path, f]));
  const keep = byPath.get('src/keep.ts');
  assert.equal(keep.status, 'M');
  assert.equal(keep.touches, 2, 'two commits touched it: one file');
  assert.equal(keep.hunks.length, 2);
  assert.deepEqual([keep.added, keep.removed], [3, 2]);
  const first = keep.hunks[0];
  assert.equal(first.oldStart, 1);
  assert.deepEqual(first.lines.map((l) => [l.t, l.o, l.n]), [[' ', 1, 1], ['-', 2, null], ['+', null, 2], [' ', 3, 3]]);
  assert.equal(keep.language, 'typescript');
  const moved = byPath.get('src/new-name.ts');
  assert.deepEqual([moved.status, moved.oldPath], ['R', 'src/old-name.ts']);
  assert.equal(byPath.get('src/gone.ts').status, 'D');
  const image = byPath.get('docs/ảnh chụp.png');
  assert.ok(image, 'the quoted non-ASCII path is decoded');
  assert.deepEqual([image.status, image.binary, image.image], ['A', true, true]);
  assert.ok(image.after?.blob && !image.before, 'an added image has an after blob only');
  const md = byPath.get('src/secret-free.md');
  assert.deepEqual(md.hunks[0].lines.map((l) => [l.t, l.s]), [['+', '-- '], ['+', 'not a signature']], 'a "-- " content line is not the mail signature');
  assert.deepEqual(doc.totals, { files: 5, added: 3 + 2, removed: 2 + 1 });
  assert.equal(doc.truncated, false);
  void base; void head;
});

test('caps: per-file and total line caps and the file cap mark what they cut', (t) => {
  const { patch } = series(t);
  const small = parsePatchText(patch, { caps: { fileLines: 2, totalLines: 1000, files: 400, lineChars: 5, assetBytes: 1 } });
  const keep = small.files.find((f) => f.path === 'src/keep.ts');
  assert.equal(keep.truncated, true);
  assert.equal(keep.hunks.flatMap((h) => h.lines).length, 2);
  assert.deepEqual([keep.added, keep.removed], [3, 2], 'counts stay whole when lines are cut');
  assert.ok(keep.hunks[0].lines.every((l) => l.s.length <= 6));
  assert.equal(small.truncated, true);
  const few = parsePatchText(patch, { caps: { fileLines: 100, totalLines: 1000, files: 2, lineChars: 100, assetBytes: 1 } });
  assert.equal(few.files.length, 2);
  assert.equal(few.omittedFiles, 3);
  assert.equal(few.totals.files, 5);
});

test('writePatchJson writes once, with image literals decoded into assets', (t) => {
  const { dir, patch, base, head } = series(t);
  const file = path.join(dir, 'job.patch');
  fs.writeFileSync(file, patch);
  const r = writePatchJson(file, { base, head, landed: null, state: 'unlanded' });
  assert.equal(r.written, true);
  assert.equal(r.assets, 1);
  const doc = JSON.parse(fs.readFileSync(`${file}.json`, 'utf8'));
  assert.equal(doc.schema, 'starci/patch-json@1');
  assert.deepEqual([doc.base, doc.head, doc.unlanded], [base, head, true]);
  const image = doc.files.find((f) => f.image);
  assert.ok(image.after.asset);
  assert.deepEqual(fs.readFileSync(path.join(dir, image.after.asset)), PNG, 'the decoded literal is the committed image');
  assert.equal(writePatchJson(file, {}).kept, true, 'an existing json is kept');
  assert.equal(writePatchJson(path.join(dir, 'none.patch'), {}, { dryRun: true }).error, 'patch missing');
});
