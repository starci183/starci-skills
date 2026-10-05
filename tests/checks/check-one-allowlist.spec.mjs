import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { runGit } from '../../scripts/api/git/lib.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';
import { allowlistSprawlFindings, checkOneAllowlist, ALLOWLIST_SCHEMA_FILE } from '../../scripts/checks/check-one-allowlist.mjs';
import { ALLOWLIST_FILE } from '../../scripts/lib/allowlist.mjs';

const codes = (findings) => findings.map((f) => [f.code, f.path]);

test('the allowlist, its schema, the check and its spec are the only list-named files allowed', () => {
  assert.deepEqual(allowlistSprawlFindings([
    ALLOWLIST_FILE,
    ALLOWLIST_SCHEMA_FILE,
    'scripts/checks/check-one-allowlist.mjs',
    'scripts/lib/allowlist.mjs',
    'tests/checks/one-allowlist.spec.mjs',
  ]), []);
});

test('a file named like a retired list mechanism is sprawl wherever it lives', () => {
  assert.deepEqual(codes(allowlistSprawlFindings([
    'modules/kernel/dead-codes.not-codes',
    'modules/schemas/yaml-exceptions.yaml',
    'scripts/checks/gone-scripts.entries',
    'knowledge/hfs/audit.pending',
    'tools/lint-baseline.json',
    'docs/scan-baseline.txt',
    'modules/ops/allowlist.yaml',
  ])), [
    ['RT_ALLOWLIST_SPRAWL', 'modules/kernel/dead-codes.not-codes'],
    ['RT_ALLOWLIST_SPRAWL', 'modules/schemas/yaml-exceptions.yaml'],
    ['RT_ALLOWLIST_SPRAWL', 'scripts/checks/gone-scripts.entries'],
    ['RT_ALLOWLIST_SPRAWL', 'knowledge/hfs/audit.pending'],
    ['RT_ALLOWLIST_SPRAWL', 'tools/lint-baseline.json'],
    ['RT_ALLOWLIST_SPRAWL', 'docs/scan-baseline.txt'],
    ['RT_ALLOWLIST_SPRAWL', 'modules/ops/allowlist.yaml'],
  ]);
});

test('a bare non-.mjs file under scripts/checks/ is a list a check should not keep', () => {
  assert.deepEqual(codes(allowlistSprawlFindings([
    'scripts/checks/check-ok.mjs',
    'scripts/checks/known-hosts.allow',
    'scripts/checks/notes.txt',
  ])), [
    ['RT_ALLOWLIST_SPRAWL', 'scripts/checks/known-hosts.allow'],
    ['RT_ALLOWLIST_SPRAWL', 'scripts/checks/notes.txt'],
  ]);
});

test('current module list mechanisms are sprawl; the actual retired-paths declaration stays data', () => {
  assert.deepEqual(codes(allowlistSprawlFindings(['modules/kernel/baseline-eslint-ignores-work.yaml', 'modules/kernel/json-exceptions-shape-slot-and-ui.yaml', 'modules/kernel/retired-paths.yaml'])), [['RT_ALLOWLIST_SPRAWL', 'modules/kernel/baseline-eslint-ignores-work.yaml'], ['RT_ALLOWLIST_SPRAWL', 'modules/kernel/json-exceptions-shape-slot-and-ui.yaml']]);
});

test('this runtime keeps exactly one allowlist', () => {
  assert.deepEqual(checkOneAllowlist(path.resolve(import.meta.dirname, '..', '..')), []);
});

const listed = paths => ({ status: 0, error: null, signal: null, stdout: `${paths.join('\0')}\0`, stderr: '' });

test('the real current-tree check drops indexed deletions and refuses tracked and nonignored new lists', t => {
  const root = mkdtemp(t, 'starci-one-current-');
  const git = args => {
    const result = runGit(args, { cwd: root });
    assert.equal(result.status, 0, String(result.stderr ?? result.error));
  };
  git(['init', '--quiet']);
  fs.mkdirSync(path.join(root, 'docs'));
  for (const name of ['deleted-baseline.yaml', 'tracked baseline.json', 'ordinary.md']) {
    fs.writeFileSync(path.join(root, 'docs', name), 'fixture\n');
  }
  fs.writeFileSync(path.join(root, '.gitignore'), '/docs/ignored-baseline.yaml\n');
  git(['add', '--', '.gitignore', 'docs']);
  fs.unlinkSync(path.join(root, 'docs/deleted-baseline.yaml'));
  fs.writeFileSync(path.join(root, 'docs/m\u1edbi allowlist.yaml'), 'fixture\n');
  fs.writeFileSync(path.join(root, 'docs/ignored-baseline.yaml'), 'fixture\n');
  assert.deepEqual(codes(checkOneAllowlist(root)).sort(), [
    ['RT_ALLOWLIST_SPRAWL', 'docs/m\u1edbi allowlist.yaml'],
    ['RT_ALLOWLIST_SPRAWL', 'docs/tracked baseline.json'],
  ]);
  assert.equal(fs.existsSync(path.join(root, 'docs/deleted-baseline.yaml')), false);
});

test('the consumer asks its inventory owner once for cached and nonignored new files', t => {
  const root = mkdtemp(t, 'starci-one-owner-');
  fs.writeFileSync(path.join(root, 'live-baseline.yaml'), 'fixture\n');
  let calls = 0;
  const findings = checkOneAllowlist(root, { listFiles: (args, options) => {
    calls += 1;
    assert.deepEqual(args, ['--cached', '--others', '--exclude-standard', '-z']);
    assert.equal(options.cwd, root);
    assert.equal(options.maxBuffer, 64 * 1024 * 1024);
    return listed(['missing-baseline.yaml', 'live-baseline.yaml', 'live-baseline.yaml']);
  } });
  assert.equal(calls, 1);
  assert.deepEqual(codes(findings), [['RT_ALLOWLIST_SPRAWL', 'live-baseline.yaml']]);
});

test('failed or missing native Git status and spawn errors never become an empty inventory', t => {
  const root = mkdtemp(t, 'starci-one-git-');
  for (const status of [1, null]) {
    assert.throws(() => checkOneAllowlist(root, { listFiles: () => ({ status, stdout: '', stderr: 'fixture Git refused' }) }), /git ls-files -z exited/);
  }
  const fault = Object.assign(new Error('fixture spawn refused'), { code: 'EACCES' });
  assert.throws(() => checkOneAllowlist(root, { listFiles: () => ({ status: 0, stdout: '', error: fault }) }), error => error === fault);
});

test('malformed successful Git output is rejected instead of returning no findings', t => {
  const root = mkdtemp(t, 'starci-one-malformed-');
  for (const stdout of [undefined, null, 7, {}]) {
    assert.throws(() => checkOneAllowlist(root, { listFiles: () => ({ status: 0, stdout }) }), TypeError);
  }
});

test('invalid root type and NUL path errors propagate through current-tree inventory', t => {
  const root = mkdtemp(t, 'starci-one-path-');
  const listFiles = () => listed(['live-baseline.yaml']);
  assert.throws(() => checkOneAllowlist({}, { listFiles }), { code: 'ERR_INVALID_ARG_TYPE' });
  assert.throws(() => checkOneAllowlist(`${root}\0`, { listFiles }), { code: 'ERR_INVALID_ARG_VALUE' });
});

test('inventory filesystem errors other than absence retain their exact fault', t => {
  const root = mkdtemp(t, 'starci-one-io-');
  for (const code of ['EACCES', 'EIO', 'ENOTDIR']) {
    const fault = Object.assign(new Error(`fixture inventory ${code}`), { code });
    const statMock = t.mock.method(fs, 'lstatSync', () => { throw fault; });
    try {
      assert.throws(() => checkOneAllowlist(root, { listFiles: () => listed(['live-baseline.yaml']) }), error => error === fault);
    } finally {
      statMock.mock.restore();
    }
  }
});

test('the POSIX current-tree law refuses a live literal-backslash Git basename', {skip: process.platform === 'win32' ? 'Windows does not allow a literal backslash in a filename; run this fixture on POSIX' : false}, t => {
  const root = mkdtemp(t, 'starci-one-literal-');
  const git = args => {
    const result = runGit(args, {cwd: root});
    assert.equal(result.status, 0, String(result.stderr ?? result.error));
  };
  git(['init', '--quiet']);
  fs.mkdirSync(path.join(root, 'docs'));
  const indexed = 'docs/part\\baseline.yaml';
  fs.writeFileSync(path.join(root, indexed), 'fixture\n');
  git(['add', '--', 'docs']);
  assert.deepEqual(codes(checkOneAllowlist(root)), [['RT_ALLOWLIST_SPRAWL', indexed]]);
});
