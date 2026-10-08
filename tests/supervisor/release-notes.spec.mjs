// release-notes.spec.mjs - `starci release notes` (scripts/supervisor/release-notes.mjs): the CHANGELOG section of a tag, the one text the
// annotated tag message and the GitHub Release (ci.yml, job github-release) carry.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isPrerelease, releaseNotes } from '../../scripts/supervisor/release-notes.mjs';
import { changelogSection } from '../../scripts/hfs/runtime-rules/release-notes.mjs';

const CHANGELOG = '# Changelog\n\n## [1.0.0-alpha.4] — 2026-10-04\n\n- shipped: the notes\n\n## [1.0.0] — 2026-11-01\n\n- stable\n\n## [0.9.0] — 2026-09-30\n\n- TODO finish\n';
const run = (args, extra = {}) => releaseNotes({ args, positionals: [] }, { readChangelog: () => CHANGELOG, ...extra });

test('the notes are exactly the section the annotated tag message is made of', () => {
  const result = run({ tag: 'v1.0.0-alpha.4' });
  assert.equal(result.code, 0);
  assert.equal(result.text, changelogSection(CHANGELOG, '1.0.0-alpha.4').body);
  assert.equal(result.data.prerelease, true);
});

test('a version with no pre-release part is a full release', () => {
  assert.equal(run({ tag: 'v1.0.0' }).data.prerelease, false);
  for (const version of ['1.0.0-alpha.7', '2.0.0-beta.1', '2.0.0-rc.2']) assert.equal(isPrerelease(version), true, version);
  assert.equal(isPrerelease('1.2.3'), false);
});

test('a missing or unfinished section is refused by name', () => {
  assert.equal(run({ tag: 'v9.9.9' }).code, 1);
  const unfinished = run({ tag: 'v0.9.0' });
  assert.equal(unfinished.code, 1);
  assert.match(unfinished.text, /TODO/);
});

test('usage errors exit 2', () => {
  assert.equal(run({}).code, 2);
  assert.equal(run({ tag: 'latest' }).code, 2);
  assert.equal(releaseNotes({ args: { tag: 'v1.0.0' }, positionals: ['x'] }).code, 2);
});

test('--out writes the notes and reports the pre-release kind', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-release-notes-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const out = path.join(dir, 'notes.md');
  const result = run({ tag: 'v1.0.0-alpha.4', out });
  assert.equal(result.code, 0);
  assert.equal(result.data.prerelease, true);
  assert.equal(fs.readFileSync(out, 'utf8'), `${changelogSection(CHANGELOG, '1.0.0-alpha.4').body}\n`);
});

test('an unreadable CHANGELOG is a refusal', () => {
  const result = releaseNotes({ args: { tag: 'v1.0.0' }, positionals: [] }, { readChangelog: () => { throw new Error('no file'); } });
  assert.equal(result.code, 1);
});
