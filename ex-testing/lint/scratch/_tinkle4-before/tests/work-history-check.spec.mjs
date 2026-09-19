import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {checkWorkHistoryTree} from '../scripts/check-work-history.mjs';

/**
 * One git repository per fixture, built step by step, proving each change-discipline rule in
 * scripts/check-work-history.mjs refuses the transition it targets - and that the cases it must NOT refuse (a
 * comment-only edit, a verbatim withdrawal, a tree with no repository at all) stay quiet or land in the
 * severity tier they belong to. Same TMP_ROOT convention as tests/example-work-gate.spec.mjs: on the same
 * drive as the repo, never os.tmpdir(), which can be another drive on this host.
 *
 * Every fixture commits through `git -c user.*` rather than touching the developer's identity, and each step
 * names the commit it makes, so a finding's `HEAD -> uncommitted` label can be read against the steps below it.
 */
const TMP_ROOT = path.join(path.parse(process.cwd()).root, 'starci-tmp');

let counter = 0;
function freshDir() {
  counter += 1;
  const dir = path.join(TMP_ROOT, `history-fixture-${process.pid}-${counter}`);
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});
  return dir;
}

function git(cwd, args) {
  const run = spawnSync('git', ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example',
    '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args],
  {cwd, encoding: 'utf8', maxBuffer: 1 << 26});
  assert.equal(run.status, 0, `git ${args.join(' ')} failed: ${run.stderr}`);
  return run.stdout;
}

function write(root, rel, content) {
  const file = path.join(root, ...rel.split('/'));
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

const catalog = 'schema: work/catalog\nid: fixture\nfeatures: []\n';

/** rev 1 of a business rule: one clause, one trigger, a change record that says it is the first revision. */
const revOne = 'schema: work/business-rule\nid: br.f.a\ntitle: t\nstate: todo\n'
  + 'trigger: The owner opens the list.\nstatements:\n  - A completed task is never reopened.\n'
  + 'change: {rev: 1, kind: initial, at: 2026-09-18T00:00:00.000Z}\n';

/** rev 2 of the same rule, withdrawing that clause verbatim and replacing it. */
const revTwoWithdrawal = 'schema: work/business-rule\nid: br.f.a\ntitle: t\nstate: todo\n'
  + 'trigger: The owner opens the list.\nstatements:\n  - The owner may reopen a completed task.\n'
  + 'change:\n  rev: 2\n  kind: breaking\n  at: 2026-09-19T00:00:00.000Z\n'
  + '  withdraws: ["A completed task is never reopened."]\n';

/**
 * Builds a repository whose `.starciwork` goes through `steps`, each `{files, commit}`. A step carrying a
 * `commit` is landed on the mainline; a step without one is left in the worktree, which is what an in-flight
 * lane edit looks like to this check. `init: false` leaves the directory outside any repository.
 */
function build(steps, {init = true} = {}) {
  const dir = freshDir();
  const workRoot = path.join(dir, '.starciwork');
  write(workRoot, 'index.yaml', catalog);
  if (init) git(dir, ['init', '-q', '--initial-branch=main']);
  for (const step of steps) {
    for (const [rel, content] of Object.entries(step.files ?? {})) write(workRoot, rel, content);
    if (!step.commit) continue;
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', step.commit]);
  }
  return {dir, workRoot};
}

function findings(steps, options = {}) {
  const {workRoot} = build(steps, options);
  const out = {refuse: [], suspect: [], info: []};
  const summary = checkWorkHistoryTree(workRoot, out, {limit: options.limit ?? 50});
  return {...out, summary, joined: [...out.refuse, ...out.suspect, ...out.info].join('\n')};
}

const RECORD = 'features/f/br/a/index.yaml';

test('REV_NOT_BUMPED: normative text moved with change.rev unchanged is refused, naming the transition', () => {
  const moved = findings([
    {files: {[RECORD]: revOne}, commit: 'rev 1'},
    {files: {[RECORD]: revOne.replace('The owner opens the list.', 'The owner opens a filtered list.')}},
  ]);
  assert.ok(moved.refuse.some(line => line.includes('[CHANGE_UNRECORDED]')
    && line.includes('HEAD -> uncommitted') && line.includes('(trigger)')), moved.refuse.join('\n'));
  assert.equal(moved.summary.transitions, 1, moved.joined);
});

test('a comment-only edit is not a revision: identical parsed content moves no finding at all', () => {
  const annotated = findings([
    {files: {[RECORD]: revOne}, commit: 'rev 1'},
    {files: {[RECORD]: revOne + '# lane v7-5: the evidence beside this rule was re-captured against the module\n'
      + '# it names today. Nothing the rule says moved, so there is no revision to declare.\n'}},
  ]);
  assert.deepEqual(annotated.refuse, [], annotated.joined);
  assert.deepEqual(annotated.suspect, [], annotated.joined);
  assert.equal(annotated.summary.transitions, 0, annotated.joined);
});

test('a record that never authored a change block is counted once per tree, not suspected per edit', () => {
  const bare = 'schema: work/business-rule\nid: br.f.b\ntitle: t\nstate: todo\nstatements:\n'
    + '  - The list is scoped to the owner.\n';
  const moved = findings([
    {files: {'features/f/br/b/index.yaml': bare}, commit: 'written'},
    {files: {'features/f/br/b/index.yaml': bare.replace('scoped to the owner.',
      'scoped to the owner and their collaborators.')}, commit: 'edited'},
  ]);
  assert.deepEqual(moved.refuse, [], moved.joined);
  assert.deepEqual(moved.suspect, [], moved.joined);
  assert.ok(moved.info.some(line => line.includes('[CHANGE_UNDECLARED]') && line.includes('1 committed')),
    moved.info.join('\n'));
});

test('REV_NOT_MONOTONIC: a revision number that goes backwards across committed history is refused', () => {
  const revTwoOnly = revOne.replace('rev: 1, kind: initial', 'rev: 2, kind: breaking');
  const back = findings([
    {files: {[RECORD]: revTwoOnly}, commit: 'rev 2'},
    {files: {[RECORD]: revOne}, commit: 'mistakenly back to rev 1'},
  ]);
  assert.ok(back.refuse.some(line => line.includes('[REV_NOT_MONOTONIC]')
    && line.includes('carried 2') && line.includes('carries 1')), back.refuse.join('\n'));
});

test('a withdrawal quoted verbatim from the previous revision is exactly what the check expects', () => {
  const held = findings([
    {files: {[RECORD]: revOne}, commit: 'rev 1'},
    {files: {[RECORD]: revTwoWithdrawal}, commit: 'rev 2'},
  ]);
  assert.deepEqual(held.refuse, [], held.joined);
  assert.deepEqual(held.suspect, [], held.joined);
});

test('a withdrawal naming a clause no committed revision carried is refused down to the record birth', () => {
  const invented = revTwoWithdrawal.replace('A completed task is never reopened."',
    'A deleted task may be restored by an operator."');
  const found = findings([{files: {[RECORD]: invented}, commit: 'born at rev 2'}]);
  assert.ok(found.refuse.some(line => line.includes('[WITHDRAWS_NOT_VERBATIM]')
    && line.includes('no committed revision of br.f.a carried anywhere')), found.joined);
});

test('the same claim drops to SUSPECT when --limit hides the birth, so a truncated walk never refuses', () => {
  const invented = revTwoWithdrawal.replace('A completed task is never reopened."',
    'A deleted task may be restored by an operator."');
  const truncated = findings([{files: {[RECORD]: invented}, commit: 'born at rev 2'}], {limit: 1});
  assert.equal(truncated.refuse.filter(line => line.includes('WITHDRAWS')).length, 0, truncated.refuse.join('\n'));
  assert.ok(truncated.suspect.some(line => line.includes('[WITHDRAWS_NOT_VERBATIM]')
    && line.includes('no older revision carries, whole or in part')), truncated.suspect.join('\n'));
});

test('a withdrawal quoting a fragment of a longer clause is a suspicion, not a refusal', () => {
  const longClause = revOne.replace('A completed task is never reopened.',
    'A completed task is never reopened, and a deleted task is never listed.');
  const fragment = revTwoWithdrawal.replace('withdraws: ["A completed task is never reopened."]',
    'withdraws: ["A completed task is never reopened"]');
  const found = findings([
    {files: {[RECORD]: longClause}, commit: 'rev 1'},
    {files: {[RECORD]: fragment}, commit: 'rev 2'},
  ]);
  assert.ok(found.suspect.some(line => line.includes('[WITHDRAWS_NOT_VERBATIM]')
    && line.includes('piece of a longer sentence')), found.suspect.join('\n'));
  assert.equal(found.refuse.filter(line => line.includes('WITHDRAWS')).length, 0, found.refuse.join('\n'));
});

test('a withdrawal quoting prose the record only carried in a blocker reason is a suspicion', () => {
  const withProse = revOne.replace('change: {rev: 1',
    'blockedBy:\n  - {record: br.f.b, because: "the module is not built yet"}\nchange: {rev: 1');
  const other = 'schema: work/business-rule\nid: br.f.b\ntitle: t\nstate: todo\ntrigger: nobody\n'
    + 'statements: []\n';
  const quotedProse = revTwoWithdrawal.replace('withdraws: ["A completed task is never reopened."]',
    'withdraws: ["the module is not built yet"]');
  const found = findings([
    {files: {[RECORD]: withProse, 'features/f/br/b/index.yaml': other}, commit: 'rev 1'},
    {files: {[RECORD]: quotedProse}, commit: 'rev 2'},
  ]);
  assert.ok(found.suspect.some(line => line.includes('[WITHDRAWS_NOT_VERBATIM]')
    && line.includes('only as prose')), found.suspect.join('\n'));
  assert.equal(found.refuse.filter(line => line.includes('WITHDRAWS')).length, 0, found.refuse.join('\n'));
});

test('CHANGE_KIND_SUSPECT: a declared editorial that moved normative content while bumping rev is suspected', () => {
  const lying = revOne.replace('The owner opens the list.', 'The owner opens a filtered list.')
    .replace('rev: 1, kind: initial', 'rev: 2, kind: editorial');
  const found = findings([
    {files: {[RECORD]: revOne}, commit: 'rev 1'},
    {files: {[RECORD]: lying}, commit: 'rev 2'},
  ]);
  assert.ok(found.suspect.some(line => line.includes('[CHANGE_KIND_SUSPECT]')
    && line.includes('rev 1 -> 2') && line.includes('declared kind: editorial')), found.suspect.join('\n'));

  // and an honest editorial - prose alone moved - is left alone
  const honest = revOne.replace('title: t', 'title: Completing a task twice changes nothing')
    .replace('rev: 1, kind: initial', 'rev: 2, kind: editorial');
  const quiet = findings([
    {files: {[RECORD]: revOne}, commit: 'rev 1'},
    {files: {[RECORD]: honest}, commit: 'rev 2'},
  ]);
  assert.deepEqual(quiet.suspect.filter(line => line.includes('CHANGE_KIND_SUSPECT')), [], quiet.joined);
});

test('UNTRACKED_RECORD: a record file never committed is counted, never judged', () => {
  const never = 'schema: work/business-rule\nid: br.f.c\ntitle: t\nstate: todo\n'
    + 'trigger: The owner deletes a task.\nstatements:\n  - A deleted task is gone.\n'
    + 'change: {rev: 3, kind: breaking, at: 2026-09-19T00:00:00.000Z}\n';
  const found = findings([
    {files: {[RECORD]: revOne}, commit: 'rev 1'},
    {files: {'features/f/br/c/index.yaml': never}},
  ]);
  assert.ok(found.info.some(line => line.includes('[UNTRACKED_RECORD]') && line.includes('1 record file')),
    found.info.join('\n'));
  assert.deepEqual(found.refuse, [], found.refuse.join('\n'));
});

test('a record that moved directory keeps the lineage its withdrawal claim refers to', () => {
  // The shape the todo tree actually has: rev 1 and the rev-2 claim were authored at one path, and a later
  // commit moved the file with its bytes unchanged. The mainline listing of the new path therefore shows only
  // the move, which carries the claim - so the revision the claim quotes is reachable only by walking the file
  // back through the rename, and a refusal would be an artifact of not doing so.
  const dir = freshDir();
  const workRoot = path.join(dir, '.starciwork');
  write(workRoot, 'index.yaml', catalog);
  write(workRoot, RECORD, revOne);
  git(dir, ['init', '-q', '--initial-branch=main']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'rev 1 at the old path']);
  write(workRoot, RECORD, revTwoWithdrawal);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'rev 2 at the old path, withdrawing the rev-1 clause']);
  fs.mkdirSync(path.join(workRoot, 'features', 'f', 'br', 'kept'), {recursive: true});
  git(dir, ['mv', `.starciwork/${RECORD}`, '.starciwork/features/f/br/kept/index.yaml']);
  git(dir, ['commit', '-q', '-m', 'moved directory, bytes unchanged']);

  const out = {refuse: [], suspect: [], info: []};
  const summary = checkWorkHistoryTree(workRoot, out, {limit: 50});
  const joined = [...out.refuse, ...out.suspect, ...out.info].join('\n');
  assert.equal(out.refuse.filter(line => line.includes('WITHDRAWS')).length, 0, joined);
  assert.equal(out.suspect.filter(line => line.includes('WITHDRAWS')).length, 0, joined);
  assert.equal(summary.followed, 1, joined);
});

test('NO_GIT: a tree outside a repository is skipped, and the skip names the checks it stands in for', () => {
  const {dir, workRoot} = build([{files: {[RECORD]: revOne}}], {init: false});
  const out = {refuse: [], suspect: [], info: []};
  const summary = checkWorkHistoryTree(workRoot, out, {limit: 50});
  assert.ok(!fs.existsSync(path.join(dir, '.git')), 'the fixture must not be a repository');
  assert.deepEqual(out.refuse, [], out.refuse.join('\n'));
  assert.ok(out.info.some(line => line.includes('[NO_GIT]') && line.includes('CHANGE_UNRECORDED')
    && line.includes('WITHDRAWS_NOT_VERBATIM') && line.includes('CHANGE_KIND_SUSPECT')), out.info.join('\n'));
  assert.equal(summary.records, 2, JSON.stringify(summary));
});
