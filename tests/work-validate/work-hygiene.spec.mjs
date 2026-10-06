// work-hygiene.spec.mjs — YAML the runtime cannot parse and literal credentials never enter a product .starciwork.
//
// 2026-09-29: a colon-space inside a plain scalar was committed to product .starciwork and to .claude knowledge, and
// literal usernames/passwords sat in product accounts.yaml files with no check to flag them. Three paths now refuse
// them: the lib (scripts/work/validate/work-hygiene.mjs), the product repo's pre-commit hook (scripts/guards/hook-install.mjs
// ensureWorkHook) and starci kernel settle (reason work-hygiene-red, current hygiene contract). A clean change passes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileReport, inspectLedger, ledgerFileFor, openLedger, recordCheckRun, writeContract } from '../../engine/db/ledger.mjs';
import { ensureWorkHook, guardReceiptErrors, WORK_HOOK_MARKER } from '../../scripts/guards/hook-install.mjs';
import {
  WORK_ACCOUNT_LITERAL, WORK_SECRET_FILE, WORK_SECRET_LITERAL, WORK_SECRET_PATTERN, WORK_YAML_UNPARSEABLE,
  checkWorkFiles, isLiteralCredential, scanSecrets,
} from '../../scripts/work/validate/work-hygiene.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { settleFixture } from '../helpers/workflow-settle-fixture.mjs';
import { withoutGitLocalEnv } from '../../scripts/lib/git.mjs';
import { captureGateBinding } from '../../scripts/kernel/gate-settle.mjs';
import { sha256File } from '../../engine/digest.mjs';

for (const key of ['GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_CONFIG_PARAMETERS', 'GIT_CONFIG_COUNT', 'GIT_PREFIX']) delete process.env[key];

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const FLOW = '.starciwork/features/login/uat/sign-in';
const CLEAN_ACCOUNTS = 'schema: work/disposable-accounts@1\ndisposable: true\naccounts:\n  - {role: person, identity: identity.ecommerce-app.demo}\n';
const BROKEN_YAML = 'schema: work/disposable-accounts@1\nsummary: Fix the sign-in bug: it breaks the page\n';
const LITERAL_ACCOUNTS = 'schema: work/disposable-accounts@1\ndisposable: true\naccounts:\n  - {role: person, username: qa.tester@acme-mail.io, password: Zx9-qLm2-vT7pRw4}\n';

const put = (repo, rel, body) => { const abs = path.join(repo, rel); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, body); return rel; };
const git = (repo, ...args) => spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', windowsHide: true });
const gitOk = (repo, ...args) => { const r = git(repo, ...args); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
const repoOf = (t) => {
  const repo = mkdtemp(t, 'starci-work-hygiene-');
  gitOk(repo, 'init', '--quiet', '-b', 'main');
  for (const [k, v] of [['user.email', 'lane@starci.test'], ['user.name', 'lane'], ['commit.gpgsign', 'false'], ['core.autocrlf', 'false']]) gitOk(repo, 'config', k, v);
  put(repo, 'README.md', '# product\n');
  gitOk(repo, 'add', '.');
  gitOk(repo, 'commit', '--quiet', '-m', 'init');
  return repo;
};
const codes = (result) => [...new Set(result.findings.map((f) => f.code))].sort();

test('actual commit --only validates its temporary staged blob and foreign hygiene ignores that index', (t) => {
  const repo = repoOf(t), foreign = repoOf(t);
  const record = `${FLOW}/accounts.yaml`;
  for (const target of [repo, foreign]) {
    put(target, record, CLEAN_ACCOUNTS);
    gitOk(target, 'add', record);
    gitOk(target, 'commit', '--quiet', '-m', 'valid Work record');
  }
  assert.equal(ensureWorkHook(repo, { skillRoot: ROOT }).installed, true);
  put(repo, record, BROKEN_YAML);
  const refused = git(repo, 'commit', '--quiet', '--only', '-m', 'broken temporary staged blob', '--', record);
  assert.notEqual(refused.status, 0, refused.stdout + refused.stderr);
  assert.match(refused.stderr, /WORK_YAML_UNPARSEABLE/);
  assert.equal(gitOk(repo, 'show', `:${record}`), CLEAN_ACCOUNTS.trim(), 'the ordinary index remained valid while the selected commit blob was broken');
  const env = { ...withoutGitLocalEnv(process.env), GIT_INDEX_FILE: path.join(repo, 'temporary.index') };
  for (const args of [['read-tree', 'HEAD'], ['add', record]]) {
    const staged = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', windowsHide: true, env });
    assert.equal(staged.status, 0, staged.stderr);
  }
  const checked = spawnSync(process.execPath, [path.join(ROOT, 'packages/cli/bin/starci.mjs'), 'work', 'hygiene', 'staged', '--repo', foreign, '--json'], {cwd:repo,env,encoding:'utf8',windowsHide:true});
  assert.equal(checked.status, 0, checked.stdout + checked.stderr);
  assert.equal(JSON.parse(checked.stdout).ok, true, 'a foreign repository must not read the origin hook temporary index');
});

test('the check refuses an unparseable Work YAML and a literal login and password, and passes a clean record', (t) => {
  const repo = repoOf(t);
  const clean = checkWorkFiles({ repo, files: [put(repo, `${FLOW}/accounts.yaml`, CLEAN_ACCOUNTS)] });
  assert.equal(clean.ok, true, JSON.stringify(clean.findings));
  assert.deepEqual(clean.checked, { parse: 1, validate: 1, secrets: 1 });

  const broken = checkWorkFiles({ repo, files: [put(repo, `${FLOW}/index.yaml`, BROKEN_YAML)] });
  assert.equal(broken.ok, false);
  assert.deepEqual(codes(broken), [WORK_YAML_UNPARSEABLE]);
  assert.equal(broken.findings[0].file, `${FLOW}/index.yaml`);

  const literal = checkWorkFiles({ repo, files: [put(repo, `${FLOW}/accounts.yaml`, LITERAL_ACCOUNTS)] });
  assert.deepEqual(codes(literal), [WORK_ACCOUNT_LITERAL, WORK_SECRET_LITERAL]);
  assert.ok(literal.findings.every((f) => !JSON.stringify(f).includes('Zx9-qLm2') && !JSON.stringify(f).includes('qa.tester')), 'a finding never carries the value');
});

test('a validation refusal counts only when it names a file the change touches', (t) => {
  const repo = repoOf(t);
  // a record another author left invalid, and a clean record beside it: touching the clean one is not blamed for the other
  put(repo, `${FLOW}/fixtures.yaml`, 'schema: work/not-a-real-schema@9\nid: legacy\n');
  const touched = checkWorkFiles({ repo, files: [put(repo, `${FLOW}/accounts.yaml`, CLEAN_ACCOUNTS)] });
  assert.equal(touched.ok, true, JSON.stringify(touched.findings));
});

test('secret scan: encrypted files, references and stand-ins pass; provider tokens, key blocks and secret paths do not', () => {
  assert.deepEqual(scanSecrets('.starcistacks/dev/secrets/db.enc', 'password: Zx9-qLm2-vT7pRw4'), [], 'a .enc file is outside the scan scope, so the hook never hands it over');
  for (const [key, value] of [['password', '$DB_PASSWORD'], ['password', 'secret:db/password'], ['password', '<set-in-vault>'], ['password', 'changeme'], ['apiKey', 'ref:vault/api'], ['token', 'fixture-token-aaaaaaaaaaaa'], ['maxTokens', '4096'], ['tokenBudget', '20000'], ['secretRef', 'sec.db.password']]) {
    assert.deepEqual(scanSecrets('.starciwork/x/index.yaml', `${key}: ${value}\n`), [], `${key}: ${value}`);
  }
  assert.equal(isLiteralCredential('hunter2', 'password'), true);
  assert.equal(isLiteralCredential('--brand-color-primary', 'credential'), false, 'a design token name is no credential');
  assert.deepEqual(scanSecrets('.starciwork/x/index.yaml', 'password: "hunter2"\n').map((f) => f.code), [WORK_SECRET_LITERAL]);
  assert.deepEqual(scanSecrets('.starciwork/x/notes.md', 'A pair `password: hunter2` in prose is documentation.\n'), []);
  assert.deepEqual(scanSecrets('.starciwork/x/notes.md', `key ghp_${'a1B2c3D4'.repeat(5)}\n`).map((f) => f.code), [WORK_SECRET_PATTERN]);
  assert.deepEqual(scanSecrets('.starciwork/x/key.txt', `-----BEGIN ${'RSA'} PRIVATE KEY-----\nabc\n`).map((f) => f.code), [WORK_SECRET_PATTERN]);
  assert.deepEqual(scanSecrets('.starcistacks/dev/secrets/db-password', null).map((f) => f.code), [WORK_SECRET_FILE]);
});

test('the pre-commit hook refuses a staged broken YAML and a literal password, and lets a clean commit through', (t) => {
  const repo = repoOf(t);
  const hook = ensureWorkHook(repo, { skillRoot: ROOT });
  assert.equal(hook.installed, true, JSON.stringify(hook));
  assert.ok(fs.readFileSync(hook.path, 'utf8').includes(WORK_HOOK_MARKER));
  assert.equal(ensureWorkHook(repo, { skillRoot: ROOT }).changed, false, 'idempotent');
  const commit = (message) => git(repo, 'commit', '-m', message);

  put(repo, `${FLOW}/index.yaml`, BROKEN_YAML);
  gitOk(repo, 'add', '.');
  const broken = commit('broken yaml');
  assert.notEqual(broken.status, 0, 'a broken YAML refuses the commit');
  assert.match(broken.stderr, new RegExp(WORK_YAML_UNPARSEABLE));
  gitOk(repo, 'reset', '--quiet');
  fs.rmSync(path.join(repo, FLOW, 'index.yaml'));

  put(repo, `${FLOW}/accounts.yaml`, LITERAL_ACCOUNTS);
  gitOk(repo, 'add', '.');
  const literal = commit('literal password');
  assert.notEqual(literal.status, 0, 'a literal password refuses the commit');
  assert.match(literal.stderr, new RegExp(WORK_SECRET_LITERAL));
  assert.doesNotMatch(literal.stderr + literal.stdout, /Zx9-qLm2/, 'the refusal never echoes the value');
  assert.equal(git(repo, 'rev-list', '--count', 'HEAD').stdout.trim(), '1', 'no commit was made');

  put(repo, `${FLOW}/accounts.yaml`, CLEAN_ACCOUNTS);
  gitOk(repo, 'add', '.');
  const clean = commit('clean accounts');
  assert.equal(clean.status, 0, clean.stderr);

  put(repo, 'src/a.ts', 'export const a = 1;\n');
  gitOk(repo, 'add', '.');
  assert.equal(commit('code only').status, 0, 'a commit with no Work file is not checked');
});

test('the hook wraps husky\'s generated pre-commit dispatcher and never overwrites another foreign hook', (t) => {
  const repo = repoOf(t);
  gitOk(repo, 'config', 'core.hooksPath', '.husky/_');
  fs.mkdirSync(path.join(repo, '.husky', '_'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.husky', '_', '.gitignore'), '*');
  const generated = '#!/usr/bin/env sh\n. "$(dirname "$0")/h"\n';
  fs.writeFileSync(path.join(repo, '.husky', '_', 'pre-commit'), generated);
  fs.writeFileSync(path.join(repo, '.husky', '_', 'h'), 'echo husky-ran >&2\n');
  const wrapped = ensureWorkHook(repo, { skillRoot: ROOT });
  assert.equal(wrapped.installed, true, JSON.stringify(wrapped));
  put(repo, 'src/a.ts', 'export const a = 1;\n');
  gitOk(repo, 'add', '.');
  const r = git(repo, 'commit', '-m', 'code');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /husky-ran/, 'the repository\'s own pre-commit still runs after the work check');

  fs.writeFileSync(path.join(repo, '.husky', '_', 'pre-commit'), '#!/bin/sh\necho mine\n');
  fs.rmSync(path.join(repo, '.git', 'hooks', 'pre-commit'), { force: true });
  assert.deepEqual(ensureWorkHook(repo, { skillRoot: ROOT }), { installed: false, reason: 'foreign-hook', path: path.join(repo, '.husky', '_', 'pre-commit') });
  assert.deepEqual(guardReceiptErrors({ workHooks: [{ repo, installed: false, reason: 'foreign-hook' }] }), [`work hook ${repo}: foreign-hook`]);
});

// ------------------------------------------------------------------------------------------------ starci kernel settle

const checkout = (t) => {
  const repo = repoOf(t);
  put(repo, 'src/a.ts', 'export const a = 1;\n');
  gitOk(repo, 'add', '.');
  gitOk(repo, 'commit', '--quiet', '-m', 'src');
  fs.appendFileSync(path.join(repo, '.git', 'info', 'exclude'), '.starciwork/\n');
  return repo;
};
const seedJob = (repo, { jobId, wf, files, admittedAt, env = process.env }) => {
  const read = spawnSync(process.execPath, [path.join(ROOT, 'scripts/cli/gate-read.mjs'), '--root', repo, '--knowledge', 'docs/architecture.md'], { cwd: ROOT, env, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  assert.equal(read.status, 0, read.stderr || read.stdout);
  // Native READ records the physical target root; keep this operational proof outside portable Work records.
  const evidence = put(repo, 'docs/checks/read-digest.json', JSON.stringify(JSON.parse(read.stdout)));
  files = [...files, evidence];
  const owned = ['src/', '.starciwork/', 'docs/checks/'];
  const placements = owned.map(path => ({ base: repo, path }));
  const ledgerFile = ledgerFileFor(repo, { env });
  const ledger = openLedger({ file: ledgerFile });
  try {
    seedWorkflow(ledger, { id: wf, state: { phase: 'running', job: 'scope' },
      jobs: [{ jobId, opId: 'scope.define', dispatchId: `ctx-${jobId}`, terminalHandle: `term-${jobId}`, status: 'running',
        payload: { opId: 'scope.define', owned_paths: owned, orca: { dispatchId: `ctx-${jobId}`, agentTerminalHandle: `term-${jobId}` } } }] });
    const attemptId = ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get(jobId).attempt_id;
    ledger.transaction((db) => {
      writeContract(db, { attemptId, markdown: '# contract', context: { worktree: repo, packet: { context: { selected_op: { contract: { id: 'scope.define', reads: [{ id: 'standard', path: 'docs/architecture.md' }] }, checks: { required: [], candidates: [] } }, readRefs: [{ path: 'docs/architecture.md', absolute: path.join(ROOT, 'docs/architecture.md'), rootKind: 'source', root: ROOT, sha256: sha256File(path.join(ROOT, 'docs/architecture.md')) }], owned_paths: placements.map(row => ({ root: row.base, path: row.path })), gate_binding: captureGateBinding(placements, { at: admittedAt }) } } }, createdAt: admittedAt });
      fileReport(db, { attemptId, outcome: 'done', createdAt: Date.now(),
        report: { schema: 'starci/op-report@1', outcome: 'done', summary: 'wrote the sign-in accounts record', files,
          head: gitOk(repo, 'rev-parse', 'HEAD') } });
      for (const check of [{ name: 'owned-paths-committed', command: 'git show' }, { name: 'owned-paths-clean', command: 'git status' }, { name: 'head-ancestor', command: 'git merge-base' }]) {
        recordCheckRun(db, { attemptId, name: check.name, phase: 'verify', runner: 'kernel', authority: 'runtime', status: 'pass', exitCode: 0, command: check.command });
      }
    });
  } finally { ledger.close(); }
  // A linked workflow checkout has a .git file; operational CHECK input stays beside its private ledger.
  const scratch = fs.mkdtempSync(path.join(path.dirname(ledgerFile), 'native-read-'));
  try {
    const checks = path.join(scratch, 'checks.json');
    fs.writeFileSync(checks, JSON.stringify({ checks: [{ name: 'read-knowledge', exitCode: 0, command: `starci gate read --root "${repo}" --knowledge docs/architecture.md` }] }));
    const observed = spawnSync(process.execPath, [API, 'record-checks', '--repo', repo, '--job', jobId, '--checks-file', checks, '--json'], { cwd: ROOT, env, encoding: 'utf8', windowsHide: true, timeout: 30000 });
    assert.equal(observed.status, 0, observed.stderr || observed.stdout);
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
  return jobId;
};
const settle = (repo, jobId, env = process.env) => {
  const r = spawnSync(process.execPath, [API, 'settle', '--repo', repo, '--job', jobId, '--verdict', 'pass', '--json'], { cwd: ROOT, env, encoding: 'utf8', windowsHide: true, timeout: 120000 });
  let body = null; try { body = JSON.parse(r.stdout); } catch { /* not json */ }
  return { r, body };
};
const statusOf = (repo, jobId, env = process.env) => { const l = inspectLedger({ file: ledgerFileFor(repo, { env }) }); try { return l.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId).status; } finally { l.close(); } };

test('starci kernel settle refuses an unparseable Work YAML and a literal password (work-hygiene-red), current hygiene also refuses an early admission and cannot invent other proof', (t) => {
  const at = Date.now() - 1000;

  const brokenRepo = checkout(t);
  const broken = seedJob(brokenRepo, { jobId: 'op-scope-broken', wf: 'wf-broken', files: [put(brokenRepo, `${FLOW}/index.yaml`, BROKEN_YAML)], admittedAt: at });
  const refusedBroken = settle(brokenRepo, broken);
  assert.equal(refusedBroken.r.status, 1, refusedBroken.r.stdout || refusedBroken.r.stderr);
  assert.equal(refusedBroken.body.reason, 'work-hygiene-red');
  assert.deepEqual(refusedBroken.body.codes, [WORK_YAML_UNPARSEABLE]);
  assert.equal(statusOf(brokenRepo, broken), 'running', 'a refused settle writes nothing');

  const literalRepo = checkout(t);
  const literal = seedJob(literalRepo, { jobId: 'op-scope-literal', wf: 'wf-literal', files: [put(literalRepo, `${FLOW}/accounts.yaml`, LITERAL_ACCOUNTS)], admittedAt: at });
  const refusedLiteral = settle(literalRepo, literal);
  assert.equal(refusedLiteral.r.status, 1, refusedLiteral.r.stdout || refusedLiteral.r.stderr);
  assert.equal(refusedLiteral.body.reason, 'work-hygiene-red');
  assert.deepEqual(refusedLiteral.body.codes.sort(), [WORK_ACCOUNT_LITERAL, WORK_SECRET_LITERAL]);
  assert.ok(!JSON.stringify(refusedLiteral.body).includes('Zx9-qLm2'), 'the refusal never carries the value');

  const oldRepo = checkout(t);
  const old = seedJob(oldRepo, { jobId: 'op-scope-old', wf: 'wf-old', files: [put(oldRepo, `${FLOW}/index.yaml`, BROKEN_YAML)], admittedAt: at - 24 * 3600 * 1000 });
  const legacy = settle(oldRepo, old);
  assert.equal(legacy.r.status,1,legacy.r.stderr || legacy.r.stdout);
  assert.equal(legacy.body?.reason,'work-hygiene-red','an earlier admission does not waive current hygiene');

  // A passing Git op reaches native checkpointing, so use the existing real worktree/registry fixture.
  const cleanFixture = settleFixture(t), cleanRepo = cleanFixture.tree;
  const clean = seedJob(cleanRepo, { jobId: 'op-scope-clean', wf: cleanFixture.workflowId, files: [put(cleanRepo, `${FLOW}/accounts.yaml`, CLEAN_ACCOUNTS)], admittedAt: at, env: cleanFixture.env });
  const passed = settle(cleanRepo, clean, cleanFixture.env);
  assert.equal(passed.r.status,0,passed.r.stderr || passed.r.stdout);
  assert.equal(statusOf(cleanRepo, clean, cleanFixture.env), 'succeeded','the clean Work record qualifies through its real independent READ');
});
