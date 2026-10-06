import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { diffSnapshots, dockerArgs, exitCodeFor, findOnPath, missingIgnores, parseArgs, sandboxEnv, snapshotTree, summaryMarkdown, summaryOf, tarballVersion, watchedPaths } from '../../scripts/gates/install-sandbox.mjs';

test('the tarball version comes from the npm pack name only', () => {
  assert.equal(tarballVersion('/x/starci-1.0.5.tgz'), '1.0.5');
  assert.equal(tarballVersion(path.join('x', 'starci-1.0.5-rc.1.tgz')), '1.0.5-rc.1');
  assert.equal(tarballVersion('starci.tgz'), null);
  assert.equal(tarballVersion('starci-1.0.5.zip'), null);
});

test('the sandbox environment points every home variable into the sandbox and drops outer npm and starci settings', () => {
  const base = { PATH: '/bin', HOME: '/real', npm_config_registry: 'x', NPM_CONFIG_CACHE: 'y', STARCI_RUNTIME: '/live', KEEP: '1' };
  const posix = sandboxEnv({ base, home: '/sb/home', platform: 'linux' });
  assert.equal(posix.HOME, '/sb/home');
  assert.equal(posix.KEEP, '1');
  for (const key of ['npm_config_registry', 'NPM_CONFIG_CACHE', 'STARCI_RUNTIME', 'USERPROFILE']) assert.equal(key in posix, false, key);
  const win = sandboxEnv({ base, home: '/sb/home', platform: 'win32' });
  assert.equal(win.USERPROFILE, '/sb/home');
  assert.equal(win.LOCALAPPDATA, path.join('/sb/home', 'AppData', 'Local'));
  assert.equal(win.APPDATA, path.join('/sb/home', 'AppData', 'Roaming'));
});

test('snapshots compare by presence, size and mtime', () => {
  const before = new Map([['a', '1:1'], ['b', '2:2'], ['c', 'dir']]);
  const after = new Map([['a', '1:1'], ['b', '3:2'], ['d', 'dir']]);
  assert.deepEqual(diffSnapshots(before, after), { added: ['d'], removed: ['c'], changed: ['b'] });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx-spec-'));
  try {
    fs.mkdirSync(path.join(root, 'd', 'e'), { recursive: true });
    fs.writeFileSync(path.join(root, 'd', 'f.txt'), 'x');
    assert.equal(snapshotTree(path.join(root, 'missing')).size, 0);
    assert.equal(snapshotTree(root, 1).size, 2);
    assert.equal(snapshotTree(root, 5).size, 4);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('the watched real-home paths are the install writes, not the whole .starci', () => {
  const posix = watchedPaths({ realHome: '/h', realLocal: undefined, platform: 'linux' });
  assert.deepEqual(posix, [path.join('/h', '.starci', 'runtime.json'), path.join('/h', '.starci', 'bin'), path.join('/h', '.starci', 'runtime'), path.join('/h', '.npm')]);
  assert.equal(watchedPaths({ realHome: '/h', realLocal: '/l', platform: 'win32' }).at(-1), path.join('/l', 'npm-cache'));
});

test('a step that could not run is exit 2, a false assertion exit 1, never 0', () => {
  assert.equal(exitCodeFor([{ status: 'pass' }]), 0);
  assert.equal(exitCodeFor([{ status: 'pass' }, { status: 'fail' }]), 1);
  assert.equal(exitCodeFor([{ status: 'fail' }, { status: 'error' }]), 2);
});

test('gitignore entries match with or without the leading slash and CRLF', () => {
  assert.deepEqual(missingIgnores('.starciwork/\r\n/.claude/config.yaml\r\n'), ['.claude/secret.env']);
  assert.deepEqual(missingIgnores('', ['/a']), ['/a']);
});

test('a tool is found on PATH with the Windows extensions only on win32', () => {
  const present = new Set([path.join('/b', 'age-keygen'), path.join('/c', 'age-keygen.exe')]);
  const probe = (file) => present.has(file);
  assert.equal(findOnPath('age-keygen', { pathValue: ['/a', '/b'].join(':'), platform: 'linux', exists: probe }), path.join('/b', 'age-keygen'));
  assert.equal(findOnPath('age-keygen', { pathValue: '/c', platform: 'linux', exists: probe }), null);
  assert.equal(findOnPath('age-keygen', { pathValue: '/c', platform: 'win32', exists: probe }), path.join('/c', 'age-keygen.exe'));
});

test('the container gets one named run, the stage read-only and the tools mount only when given', () => {
  const args = dockerArgs({ name: 'n', stage: '/s', image: 'node:22', tarballName: 'starci-1.0.5.tgz', script: 'install-sandbox.mjs' });
  assert.deepEqual(args.slice(0, 4), ['--name', 'n', '--mount', 'type=bind,source=/s,target=/in,readonly']);
  assert.equal(args.filter((a) => a === '--mount').length, 1);
  assert.match(args.at(-1), /^node \/in\/install-sandbox\.mjs --tarball \/in\/starci-1\.0\.5\.tgz$/);
  const withTools = dockerArgs({ name: 'n', stage: '/s', image: 'node:22', tarballName: 't-1.0.0.tgz', script: 's.mjs', tools: '/t' });
  assert.ok(withTools.includes('type=bind,source=/t,target=/tools,readonly'));
  assert.match(withTools.at(-1), /^PATH=\/tools:\$PATH node /);
  assert.equal(withTools.some((a) => /\bports?\b|-p$|--network/.test(a)), false);
});

test('the summary counts results and the markdown escapes table pipes', () => {
  const results = [{ name: 'a', status: 'pass' }, { name: 'b', status: 'fail', detail: 'x|y\nz' }];
  const summary = summaryOf({ results, version: '1.0.5', platform: 'linux-x64', node: 'v22', sandbox: '<removed>' });
  assert.deepEqual([summary.passed, summary.failed, summary.errored], [1, 1, 0]);
  const md = summaryMarkdown(summary);
  assert.match(md, /\| fail \| b \| x\/y z \|/);
  assert.match(md, /passed 1, failed 1, could not run 0/);
});

test('the arguments parse flags with values and switches', () => {
  assert.deepEqual(parseArgs(['--tarball', 't.tgz', '--docker', '--tools', 'd', '--keep', '--json', 'o.json']), { tarball: 't.tgz', keep: true, docker: true, tools: 'd', json: 'o.json' });
  assert.equal(parseArgs([]).tarball, undefined);
});
