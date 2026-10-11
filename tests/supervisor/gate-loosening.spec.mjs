// gate-loosening.spec.mjs — a change that loosens a gate is owner-class (modules/kernel/gate-loosening.yaml, scripts/lib/gate-loosening.mjs):
// the land gate refuses it and the `gate-loosening` self-check flags it unless the tree it is judged against already holds the owner's
// approval of exactly that loosening.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { approvalIdOf, looseningsOf } from '../../scripts/lib/gate-loosening.mjs';
import { gateLooseningCheck } from '../../scripts/supervisor/land-gate-loosening.mjs';
import { checkGateLoosening } from '../../scripts/checks/check-gate-loosening.mjs';
import { releaseTagOf } from '../../scripts/guards/release-definition.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const RULES_TEXT = fs.readFileSync(path.join(ROOT, 'modules', 'kernel', 'gate-loosening.yaml'), 'utf8');
const RULES = parseYaml(RULES_TEXT);

const fileDiff = (file, removed = [], added = [], { deleted = false } = {}) => [`diff --git a/${file} b/${file}`, ...(deleted ? ['deleted file mode 100644'] : []),
  `--- a/${file}`, `+++ b/${file}`, '@@ -1 +1 @@', ...removed.map((line) => `-${line}`), ...added.map((line) => `+${line}`)].join('\n');
const kinds = (diff) => looseningsOf(diff, RULES).map((finding) => finding.kind);

test('a list item removed from a gate file loosens it, and one moved inside the file does not', () => {
  assert.deepEqual(kinds(fileDiff('knowledge/hfs/runtime-slots.yaml', ['      - {id: sonar-rules, run: a.mjs}'], [])), ['check-removed']);
  assert.deepEqual(kinds(fileDiff('knowledge/hfs/runtime-slots.yaml', ['      - {id: sonar-rules, run: a.mjs}'], ['      - {id: sonar-rules, run: a.mjs, spec: a.spec.mjs}'])), [], 'a row whose fields change keeps its id and stays a check');
  assert.deepEqual(kinds(fileDiff('knowledge/hfs/runtime-slots.yaml', ['      - {id: sonar-rules, run: a.mjs}'], ['      - {id: other, run: a.mjs}'])), ['check-removed'], 'another id does not restore it');
  assert.deepEqual(kinds(fileDiff('knowledge/hfs/runtime-slots.yaml', ['      - {id: sonar-rules, run: a.mjs}'], ['      - {id: sonar-rules, run: a.mjs}'])), []);
  assert.deepEqual(kinds(fileDiff('docs/readme.md', ['- an item'], [])), [], 'a file that is no gate is not judged');
});

test('a floor lowered or a ceiling raised in a gate file loosens it; the other directions do not', () => {
  assert.deepEqual(kinds(fileDiff('modules/kernel/verdict-contract.yaml', ['  minScore: 8'], ['  minScore: 5'])), ['threshold-lowered']);
  assert.deepEqual(kinds(fileDiff('modules/kernel/verdict-contract.yaml', ['  maxAttempts: 3'], ['  maxAttempts: 9'])), ['threshold-lowered']);
  assert.deepEqual(kinds(fileDiff('modules/kernel/verdict-contract.yaml', ['  minScore: 5'], ['  minScore: 8'])), []);
  assert.deepEqual(kinds(fileDiff('modules/kernel/verdict-contract.yaml', ['  maxAttempts: 9'], ['  maxAttempts: 3'])), []);
  assert.deepEqual(kinds(fileDiff('modules/kernel/verdict-contract.yaml', ['  pollIntervalMs: 9'], ['  pollIntervalMs: 3'])), [], 'a number that is no threshold');
});

test('an allowlist entry added loosens it; an entry removed does not', () => {
  assert.deepEqual(kinds(fileDiff('modules/kernel/allowlist.yaml', [], ['  - {file: scripts/a.mjs, reason: later}'])), ['allowlist-added']);
  assert.deepEqual(kinds(fileDiff('modules/kernel/allowlist.yaml', ['  - {file: scripts/a.mjs, reason: later}'], [])), []);
});

test('a spec deleted, weakened or skipped loosens only together with product code', () => {
  const product = fileDiff('scripts/lib/a.mjs', ['old'], ['new']);
  assert.deepEqual(kinds([product, fileDiff('tests/lib/a.spec.mjs', ['x'], [], { deleted: true })].join('\n')), ['spec-deleted']);
  assert.deepEqual(kinds([product, fileDiff('tests/lib/a.spec.mjs', ['  assert.equal(a, 1);', '  assert.equal(b, 2);'], ['  assert.equal(a, 1);'])].join('\n')), ['assertion-weakened']);
  assert.deepEqual(kinds([product, fileDiff('tests/lib/a.spec.mjs', ["test('a', () => {"], [`test.${'skip'}('a', () => {`])].join('\n')), ['spec-skipped']);
  assert.deepEqual(kinds(fileDiff('tests/lib/a.spec.mjs', ['x'], [], { deleted: true })), [], 'a spec alone is a test change');
  const moved = [product, fileDiff('tests/old/a.spec.mjs', ['x'], [], { deleted: true }), fileDiff('tests/new/a.spec.mjs', [], ['x'])].join('\n');
  assert.deepEqual(kinds(moved), [], 'a moved spec is not a deleted one');
});

test('the fingerprint names exactly the loosenings it was computed from', () => {
  const one = looseningsOf(fileDiff('modules/kernel/allowlist.yaml', [], ['  - {file: a}']), RULES);
  const two = looseningsOf(fileDiff('modules/kernel/allowlist.yaml', [], ['  - {file: b}']), RULES);
  assert.match(approvalIdOf(one), /^gate-loosening-[0-9a-f]{12}$/);
  assert.notEqual(approvalIdOf(one), approvalIdOf(two));
  assert.equal(approvalIdOf(one), approvalIdOf(looseningsOf(fileDiff('modules/kernel/allowlist.yaml', [], ['  - {file: a}']), RULES)));
});

const git = (cwd, ...args) => {
  const run = spawnSync('git', ['-c', 'user.name=spec', '-c', 'user.email=spec@example.test', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(run.status, 0, `${args.join(' ')}: ${run.stderr}`);
  return run.stdout.trim();
};
const write = (dir, file, text) => { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), text); };
const commit = (dir, message) => { git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', message); return git(dir, 'rev-parse', 'HEAD'); };

// A repository whose release commit holds a gate file with two checks, the loosening table and no approvals.
const repo = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-loosening-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  git(dir, 'init', '-q', '-b', 'main');
  write(dir, 'modules/kernel/gate-loosening.yaml', RULES_TEXT);
  write(dir, 'modules/kernel/owner-rulings.yaml', 'schema: starci/owner-rulings@1\nrulings: []\n');
  write(dir, 'knowledge/hfs/runtime-slots.yaml', 'checks:\n  - {id: one}\n  - {id: two}\n');
  write(dir, 'package.json', '{\n  "version": "1.0.0-alpha.1"\n}\n');
  write(dir, 'tests/x/released.spec.mjs', 'assert.ok(1);\n');
  write(dir, 'scripts/x/released.mjs', 'export const released = 1;\n');
  const release = commit(dir, 'release');
  git(dir, 'tag', '-a', 'v1.0.0-alpha.1', '-m', 'released');
  return { dir, release };
};

test('the land gate refuses a removed check, prints the approval it needs, and passes once the base holds that approval', (t) => {
  const { dir, release } = repo(t);
  write(dir, 'knowledge/hfs/runtime-slots.yaml', 'checks:\n  - {id: one}\n');
  const head = commit(dir, 'drop a check');
  const refused = gateLooseningCheck({ dir, base: release, head });
  assert.equal(refused.ok, false);
  assert.match(refused.output, /check-removed knowledge\/hfs\/runtime-slots\.yaml: - \{id: two\}/);
  assert.match(refused.hint, /owner-rulings\.yaml whose id is gate-loosening-[0-9a-f]{12}/);
  assert.equal(gateLooseningCheck({ dir, base: release, head: release }), null, 'a change that loosens nothing passes silently');
  // The owner lands the approval first; the same loosening then passes against that base.
  git(dir, 'checkout', '-q', '-b', 'owner', release);
  write(dir, 'modules/kernel/owner-rulings.yaml', `schema: starci/owner-rulings@1\nrulings:\n  - id: ${refused.hint.match(/gate-loosening-[0-9a-f]{12}/)[0]}\n    date: '2026-10-08'\n    ruling: the check two is retired\n`);
  const approvedBase = commit(dir, 'owner approves');
  git(dir, 'cherry-pick', head);
  const landed = git(dir, 'rev-parse', 'HEAD');
  const passed = gateLooseningCheck({ dir, base: approvedBase, head: landed });
  assert.equal(passed.ok, true);
  assert.match(passed.output, /approved by the owner/);
});

test('a change cannot approve its own loosening', (t) => {
  const { dir, release } = repo(t);
  const probe = (() => { write(dir, 'knowledge/hfs/runtime-slots.yaml', 'checks:\n  - {id: one}\n'); return commit(dir, 'probe'); })();
  const id = gateLooseningCheck({ dir, base: release, head: probe }).hint.match(/gate-loosening-[0-9a-f]{12}/)[0];
  git(dir, 'reset', '-q', '--hard', release);
  write(dir, 'knowledge/hfs/runtime-slots.yaml', 'checks:\n  - {id: one}\n');
  write(dir, 'modules/kernel/owner-rulings.yaml', `schema: starci/owner-rulings@1\nrulings:\n  - id: ${id}\n    date: '2026-10-08'\n    ruling: self approved\n`);
  const head = commit(dir, 'drop a check and approve it');
  assert.equal(gateLooseningCheck({ dir, base: release, head }).ok, false);
});

test('the self-check flags an unapproved loosening in a commit since the release commit and passes an approved history', (t) => {
  const { dir, release } = repo(t);
  assert.deepEqual(checkGateLoosening(dir), []);
  write(dir, 'knowledge/hfs/runtime-slots.yaml', 'checks:\n  - {id: one}\n');
  const bad = commit(dir, 'drop a check');
  const found = checkGateLoosening(dir);
  assert.equal(found.length, 1);
  assert.equal(found[0].code, 'RT_GATE_LOOSENING');
  assert.match(found[0].message, new RegExp(bad.slice(0, 10)));
  assert.match(found[0].message, /add the owner-rulings entry gate-loosening-[0-9a-f]{12} first/);
  // History that was not judged when it was written is approved after the fact: a later commit of its own holds the ruling.
  write(dir, 'modules/kernel/owner-rulings.yaml', `schema: starci/owner-rulings@1
rulings:
  - id: ${found[0].message.match(/gate-loosening-[0-9a-f]{12}/)[0]}
    date: '2026-10-09'
    ruling: the check one is retired
`);
  commit(dir, 'owner approves after the fact');
  assert.deepEqual(checkGateLoosening(dir), [], 'a ruling in the checked-out tree approves the earlier commit');
  assert.ok(release);
});

test('the self-check judges a loosening against the released state: what a lane added after the release and folded away is no finding', (t) => {
  const { dir } = repo(t);
  // after the release: a lane adds a check and a spec, then folds both into others before anything ships
  write(dir, 'knowledge/hfs/runtime-slots.yaml', 'checks:\n  - {id: one}\n  - {id: two}\n  - {id: late}\n');
  write(dir, 'tests/x/late.spec.mjs', 'assert.ok(1);\nassert.ok(2);\n');
  write(dir, 'scripts/x/late.mjs', 'export const late = 1;\n');
  commit(dir, 'a lane adds a check and its spec');
  write(dir, 'package.json', '{"version":"1.0.0-alpha.2"}\n');
  commit(dir, 'prepare the next version without a release tag');
  write(dir, 'knowledge/hfs/runtime-slots.yaml', 'checks:\n  - {id: one}\n  - {id: two}\n');
  fs.rmSync(path.join(dir, 'tests/x/late.spec.mjs'));
  write(dir, 'scripts/x/late.mjs', 'export const late = 2;\n');
  commit(dir, 'the lane folds them away');
  assert.deepEqual(checkGateLoosening(dir), [], 'neither was a gate of the release');
  // a released check removed in the same history is still a finding
  write(dir, 'knowledge/hfs/runtime-slots.yaml', 'checks:\n  - {id: one}\n');
  commit(dir, 'drop a released check');
  assert.equal(checkGateLoosening(dir).length, 1);
});


test('a preparation version commit never hides deletion of a released spec', (t) => {
  const { dir, release } = repo(t);
  write(dir, 'package.json', '{"version":"1.0.0-alpha.2"}\n');
  commit(dir, 'prepare next version');
  fs.rmSync(path.join(dir, 'tests/x/released.spec.mjs'));
  write(dir, 'scripts/x/released.mjs', 'export const released = 2;\n');
  commit(dir, 'delete released protection while changing its product');
  assert.equal(releaseTagOf({ repo: dir }).head, release);
  assert.ok(checkGateLoosening(dir).some((entry) => entry.message.includes('spec-deleted')));
});

test('release selection uses annotated manifest-bound ancestry, excluding HEAD only for the affected range', (t) => {
  const { dir, release } = repo(t);
  git(dir, 'tag', '-a', 'v2.0.0', '-m', 'historical tag whose manifest is another version', release);
  write(dir, 'package.json', '{"version":"1.0.0-alpha.2"}\n');
  const newer = commit(dir, 'second real release');
  git(dir, 'tag', '-a', 'v1.0.0-alpha.2', '-m', 'released second');
  assert.deepEqual(releaseTagOf({ repo: dir }), { ok: true, tag: 'v1.0.0-alpha.2', head: newer });
  assert.equal(releaseTagOf({ repo: dir, excludeHead: true }).head, release);
  assert.equal(releaseTagOf({ repo: dir, tag: 'v2.0.0' }).ok, false);
  git(dir, 'tag', 'v9.0.0');
  assert.equal(releaseTagOf({ repo: dir, tag: 'v9.0.0' }).ok, false, 'lightweight tags cannot become release evidence');
});

test('missing or unreadable real release history holds the check while a non-Git source stays unjudged', (t) => {
  const { dir, release } = repo(t);
  git(dir, 'tag', '-d', 'v1.0.0-alpha.1');
  assert.equal(releaseTagOf({ repo: dir }).ok, false);
  assert.match(checkGateLoosening(dir)[0].message, /cannot judge released gates/);
  write(dir, 'package.json', 'unreadable manifest\n');
  commit(dir, 'invalid release manifest');
  git(dir, 'tag', '-a', 'v1.0.0-alpha.2', '-m', 'invalid release');
  assert.match(releaseTagOf({ repo: dir }).why, /manifest.*unreadable/);
  const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-no-git-'));
  t.after(() => fs.rmSync(plain, { recursive: true, force: true }));
  write(plain, 'modules/kernel/gate-loosening.yaml', RULES_TEXT);
  assert.deepEqual(checkGateLoosening(plain), []);
  assert.ok(release);
});

test('incomparable released ancestors hold instead of choosing by creation date or version', (t) => {
  const { dir, release } = repo(t);
  git(dir, 'checkout', '-q', '-b', 'left', release);
  write(dir, 'package.json', '{"version":"1.0.0-alpha.2"}\n');
  const left = commit(dir, 'left release');
  git(dir, 'tag', '-a', 'v1.0.0-alpha.2', '-m', 'left released');
  git(dir, 'checkout', '-q', '-b', 'right', release);
  write(dir, 'package.json', '{"version":"1.0.0-alpha.3"}\n');
  commit(dir, 'right release');
  git(dir, 'tag', '-a', 'v1.0.0-alpha.3', '-m', 'right released');
  git(dir, 'merge', '--no-ff', '-s', 'ours', left, '-m', 'combine incomparable releases');
  const selected = releaseTagOf({ repo: dir });
  assert.equal(selected.ok, false);
  assert.match(selected.why, /ambiguous/);
  assert.match(checkGateLoosening(dir)[0].message, /ambiguous/);
});

test('an installed runtime copy inside application Git never judges the enclosing app release', (t) => {
  const { dir, release } = repo(t);
  const installed = path.join(dir, '.claude');
  write(installed, 'modules/kernel/gate-loosening.yaml', RULES_TEXT);
  write(installed, 'modules/kernel/owner-rulings.yaml', 'schema: starci/owner-rulings@1\nrulings: []\n');
  write(installed, 'package.json', '{"version":"1.0.0-alpha.9"}\n');
  const before = releaseTagOf({ repo: installed });
  assert.equal(before.ok, false);
  assert.equal(before.status, 'no-runtime-repository');
  assert.equal(before.head, undefined, 'the enclosing release SHA is never borrowed');
  assert.deepEqual(checkGateLoosening(installed), [], 'installed source has no runtime Git history to judge');
  assert.equal(releaseTagOf({ repo: dir }).head, release, 'the real repository still resolves its own release');
  git(dir, 'tag', '-d', 'v1.0.0-alpha.1');
  assert.equal(releaseTagOf({ repo: dir }).status, 'unknown');
  assert.match(checkGateLoosening(dir)[0].message, /cannot judge released gates/);
  assert.deepEqual(checkGateLoosening(installed), [], 'enclosing app history remains inapplicable without its tag');
});


test('a real shallow runtime clone holds even when HEAD has an eligible annotated release tag', (t) => {
  const { dir } = repo(t);
  write(dir, 'package.json', '{"version":"1.0.0-alpha.2"}\n');
  const head = commit(dir, 'second release with a parent');
  git(dir, 'tag', '-a', 'v1.0.0-alpha.2', '-m', 'second released');
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-shallow-release-'));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const shallow = path.join(parent, 'clone');
  git(parent, 'clone', '-q', '--depth=1', pathToFileURL(dir).href, shallow);
  assert.equal(git(shallow, 'rev-parse', '--is-shallow-repository'), 'true', 'the file URL honors depth, unlike a plain local path');
  assert.equal(git(shallow, 'cat-file', '-t', 'refs/tags/v1.0.0-alpha.2'), 'tag');
  assert.equal(git(shallow, 'rev-parse', 'refs/tags/v1.0.0-alpha.2^{commit}'), head);
  assert.equal(JSON.parse(git(shallow, 'show', `${head}:package.json`)).version, '1.0.0-alpha.2');
  const boundary = releaseTagOf({ repo: shallow });
  assert.equal(boundary.ok, false);
  assert.equal(boundary.status, 'unknown');
  assert.match(boundary.why, /shallow/);
  const found = checkGateLoosening(shallow);
  assert.equal(found.length, 1);
  assert.equal(found[0].code, 'RT_GATE_LOOSENING');
  assert.match(found[0].message, /cannot judge released gates.*shallow/);
});
