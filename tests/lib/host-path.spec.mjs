// host-path.spec.mjs - scripts/lib/host-path.mjs: the one host-path matcher (hostPathHits) and the one normalizer
// (normalizeHostPaths). Fixtures are built from the temp dir's own root and never spell a drive.
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { hostPathHits, normalizeHostPaths } from '../../scripts/lib/host-path.mjs';

const BS = String.fromCharCode(92);
const ROOT = path.parse(os.tmpdir()).root; // e.g. a drive root with a backslash
const FWD = ROOT.split(BS).join('/');
const REPO = `${FWD}work/repo`;
const roots = { repo: REPO, worktree: `${FWD}lanes/wt`, runtime: `${FWD}rt/.claude`, tmp: `${FWD}tmp`, home: `${FWD}Users/someone` };
const hits = (text) => hostPathHits(text).length;

test('hostPathHits: a drive path, a user-profile path and an AppData path are hits; a URL and a name are not', () => {
  assert.equal(hits(`open ${FWD}work/x`), 1);
  assert.equal(hits(`open ${ROOT}work${BS}x`), 1);
  assert.equal(hits(['', 'Users', 'someone', 'x'].join('/')), 1);
  assert.equal(hits(['', 'home', 'someone', 'x'].join('/')), 1);
  assert.equal(hits(['AppData', 'Roaming', 'x'].join('/')), 1);
  assert.equal(hits(`${FWD}Users/someone/${['AppData', 'Local'].join('/')}/x`), 1, 'the profile and AppData parts of a drive path are the drive path');
  assert.equal(hits('http://localhost:3000/x and file:///tmp/x and https://example.com/a'), 0);
  assert.equal(hits('%LOCALAPPDATA% and <runtime>/scripts and src/a.ts'), 0);
  assert.equal(hits('Grüße:\\n and été:/x'), 0, 'a letter that is part of a longer (non-ASCII) word is not a drive');
});

test('normalizeHostPaths: a path inside the repo becomes repo-relative, in either slash form and either case', () => {
  assert.equal(normalizeHostPaths(`${REPO}/src/a.ts and ${ROOT}work${BS}repo${BS}src${BS}b.ts`, roots), 'src/a.ts and src/b.ts');
  assert.equal(normalizeHostPaths(`cwd ${REPO} here`, roots), 'cwd . here');
  assert.equal(normalizeHostPaths(`${REPO.toUpperCase()}/src/a.ts`, roots), 'src/a.ts');
  assert.equal(normalizeHostPaths(`${REPO}2/x`, roots), '<host>/x', 'a sibling that merely starts with the repo name is not inside it');
});

test('normalizeHostPaths: a path outside the repo becomes <worktree>, <runtime>, <tmp> or <home>', () => {
  assert.equal(normalizeHostPaths(`${roots.worktree}/src/a.ts`, roots), '<worktree>/src/a.ts');
  assert.equal(normalizeHostPaths(`${roots.runtime}/scripts/x.mjs`, roots), '<runtime>/scripts/x.mjs');
  assert.equal(normalizeHostPaths(`${roots.tmp}/x/y`, roots), '<tmp>/x/y');
  assert.equal(normalizeHostPaths(`${roots.home}/notes`, roots), '<home>/notes');
  assert.equal(normalizeHostPaths(`read ${roots.runtime}`, roots), 'read <runtime>');
});

test('normalizeHostPaths: a host shell keeps only its command name, in a plain and in a YAML-escaped command', () => {
  const plain = `${ROOT}PROGRA~1${BS}Git${BS}bin${BS}bash.exe -c "sed s/a/b/"`;
  assert.equal(normalizeHostPaths(plain, roots), 'bash -c "sed s/a/b/"');
  const escaped = `"${ROOT}${BS}PROGRA~1${BS}${BS}Git${BS}${BS}bin${BS}${BS}bash.exe -c ${BS}"sed x${BS}""`;
  assert.equal(hits(normalizeHostPaths(escaped, roots)), 0);
  assert.match(normalizeHostPaths(escaped, roots), /^"bash -c /);
});

test('normalizeHostPaths: any other host path, and a user-profile path, get a placeholder; the result has no hit', () => {
  const other = `read from ${FWD}elsewhere/deep/file.yaml now`;
  assert.equal(normalizeHostPaths(other, roots), 'read from <host>/file.yaml now');
  assert.equal(normalizeHostPaths(['', 'home', 'someone', 'work', 'x.ts'].join('/'), roots), '<home>/work/x.ts');
  for (const text of [other, `${REPO}/a ${roots.tmp}/b ${FWD}z/q/w`]) assert.equal(hits(normalizeHostPaths(text, roots)), 0, text);
});

test('normalizeHostPaths: text without a host path is returned unchanged, and unknown roots are skipped', () => {
  const text = 'node scripts/x.mjs --out <tmp>/a %LOCALAPPDATA% http://localhost:1/x';
  assert.equal(normalizeHostPaths(text, roots), text);
  assert.equal(normalizeHostPaths(`${REPO}/a`, {}), '<host>/a');
});
