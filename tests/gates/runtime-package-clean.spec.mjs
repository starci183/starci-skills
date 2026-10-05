import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { sha256 } from '../../engine/digest.mjs';
import { tarFiles } from '../../scripts/lib/tar-files.mjs';
import { proveRuntimePackage } from '../../scripts/gates/runtime-package-clean.mjs';
import { verifyPackedDependencies } from '../../scripts/gates/package-clean-test.mjs';
import { tgz } from '../helpers/npm-tarball.mjs';

function fixture(t, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-gate-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const manifest = { name: 'starci', version: '1.0.0-alpha.9', scripts: { test: 'full-suite-must-not-run' } };
  const source = {
    'package.json': JSON.stringify(manifest), 'skills/starci/SKILL.md': 'entry\r\n',
    'skills/starci/agents/openai.yaml': 'policy: manual\n', '.starci/host/startup.md': 'startup\n',
    '.starci/host/maintenance.md': 'maintenance\n', 'ui/server.mjs': 'export const server = true;\n',
    'ui/api/index.mjs': 'export const api = true;\n', 'ui/package.json': '{}\n', 'ui/package-lock.json': '{}\n',
    'ui/src/main.tsx': 'export default null;\n', 'scripts/cli/main.mjs': 'dispatcher\n',
  };
  if (options.privatePath) source[options.privatePath] = 'PRIVATE_CONFIG_FIXTURE=do-not-package\n';
  const write = (file, bytes) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); };
  for (const [file, bytes] of Object.entries(source)) write(path.join(root, file), bytes);
  const packed = Object.fromEntries(Object.entries(source).filter(([file]) => file !== options.omit).map(([file, bytes]) => [`package/${file}`, bytes]));
  if (options.identity) packed['package/package.json'] = JSON.stringify({ ...manifest, name: options.identity });
  const archive = tgz(packed), expectedShasum = createHash('sha1').update(archive).digest('hex');
  const files = tarFiles(archive), calls = [];
  const entries = [{ relative: '.agents/skills/starci/SKILL.md', source: 'skills/starci/SKILL.md' },
    { relative: '.agents/skills/starci/agents/openai.yaml', source: 'skills/starci/agents/openai.yaml' }];
  const deps = {
    trackedUnder: directory => { assert.equal(directory, path.join(root, 'ui')); return options.noInventory ? null : ['src/main.tsx', 'api/index.mjs']; },
    pack: (spec, destination) => {
      assert.equal(spec, root); calls.push('pack');
      if (options.packRefused) return { ok: false, detail: 'owning pack refused' };
      if (!options.packMissing) write(path.join(destination, 'runtime.tgz'), options.packMalformed ? Buffer.from('not a gzip') : archive);
      return { ok: true, file: 'runtime.tgz' };
    },
    runNpm: (args, opts) => {
      calls.push('install'); assert.equal(args[0], 'install'); assert.ok(args.includes('--no-save')); assert.ok(args.includes('--package-lock=false'));
      assert.ok(args.includes('--omit=dev')); assert.equal(args.includes('test'), false);
      assert.equal(opts.env.NODE_PATH, undefined); assert.notEqual(opts.env.STARCI_LOCAL_ROOT, 'ambient-host');
      assert.equal(opts.env.STARCI_MACHINE_DB, undefined); assert.equal(opts.env.STARCI_OWNER_ROOT, undefined); assert.equal(opts.env.NODE_OPTIONS, undefined);
      assert.equal(opts.env.ORCA_TERMINAL_HANDLE, undefined); assert.equal(opts.env.STARCI_ROLE, 'owner');
      const installRoot = args[args.indexOf('--prefix') + 1];
      assert.equal(opts.cwd, installRoot);
      if (options.installRed) return { status: 1, stdout: 'actual install red', stderr: 'ETARGET unpublished' };
      if (options.installIncomplete) return { status: null, stdout: '', stderr: '', error: new Error('process unavailable') };
      for (const [file, bytes] of files) write(path.join(installRoot, 'node_modules', 'starci', file.slice('package/'.length)), bytes);
      if (options.installedTamper) write(path.join(installRoot, 'node_modules/starci/.starci/host/startup.md'), 'tampered');
      return { status: 0, stdout: 'real API fixture install', stderr: '' };
    },
    runNode: (args, opts) => {
      assert.ok(opts.env.STARCI_TEST_MACHINE_FILE.startsWith(path.dirname(opts.env.TEMP)));
      if (args[0] === '--input-type=module') {
        calls.push('graph');
        assert.equal(path.basename(args.at(-2)), 'starci'); assert.equal(args.at(-1), opts.cwd);
        if (options.graphIncomplete) return { status: null, stdout: '', stderr: '' };
        if (options.graphMalformed) return { status: 0, stdout: 'incomplete JSON', stderr: '' };
        if (options.graphNoProjection) return { status: 0, stdout: JSON.stringify(manifest), stderr: '' };
        return options.graphRed ? { status: 1, stderr: 'ERR_MODULE_NOT_FOUND missing UI', stdout: '' }
          : { status: 0, stdout: JSON.stringify({ ...manifest, payload: Object.keys(source), entries }), stderr: '' };
      }
      if (args[2] === 'doctor') {
        calls.push('doctor');
        assert.deepEqual(args, [path.join(opts.cwd, '.claude', 'scripts', 'cli', 'main.mjs'), 'runtime', 'doctor', '--cwd', opts.cwd]);
        assert.equal(args.includes('--quick'), false);
        if (options.doctorRed) return {status: 1, stdout: 'FAIL installed dependencies: fixture dependency missing', stderr: ''};
        if (options.doctorIncomplete) return {status: null, stdout: '', stderr: ''};
        if (options.doctorSignal) return {status: null, signal: 'SIGTERM', stdout: '', stderr: ''};
        if (options.doctorError) return {error: {code: 'ENOENT', message: 'fixture doctor runner missing'}, stdout: '', stderr: ''};
        if (options.doctorTamper) write(path.join(opts.cwd, '.claude/.starci/host/maintenance.md'), 'changed during diagnosis');
        return {status: 0, stdout: 'doctor: installed source and local runtime capabilities passed', stderr: ''};
      }
      assert.deepEqual(args.slice(1), ['runtime', args[2], '--cwd', opts.cwd, '--no-bootstrap']);
      assert.ok(args[0].endsWith(path.join('node_modules', 'starci', 'scripts', 'cli', 'main.mjs')));
      if (args[2] === 'update') {
        calls.push('update');
        const custodyFile = path.join(opts.cwd, '.claude/.starci-skills.json');
        const custody = JSON.parse(fs.readFileSync(custodyFile));
        if (options.custodyDigestTamper) { custody.keptLocal = ['ui/server.mjs']; fs.writeFileSync(custodyFile, JSON.stringify(custody)); }
        return { status: 0, stdout: 'native custody checked', stderr: '' };
      }
      calls.push('dispatch'); assert.equal(args[2], 'install');
      if (options.dispatchRed) return { status: 1, stdout: '', stderr: 'native installer refusal' };
      const target = path.join(opts.cwd, '.claude');
      for (const [file, bytes] of Object.entries(source)) write(path.join(target, file), bytes);
      for (const entry of entries) write(path.join(opts.cwd, entry.relative), source[entry.source]);
      if (options.projectedTamper) write(path.join(target, '.starci/host/maintenance.md'), 'different');
      if (options.entryTamper) write(path.join(opts.cwd, entries[0].relative), 'different');
      if (options.bootstrap) write(path.join(opts.cwd, 'AGENTS.md'), 'unexpected');
      write(path.join(target, '.starci-skills.json'), JSON.stringify({ ...manifest,
        version: options.custodyMismatch ? 'wrong' : manifest.version,
        files: { ...Object.fromEntries(Object.entries(source).map(([file, bytes]) => [file, sha256(bytes)])), ...(options.custodyDigestTamper ? { 'ui/server.mjs': 'wrong-digest' } : {}) },
        hostSkills: { files: Object.fromEntries(entries.map(entry => [entry.relative, sha256(source[entry.source])])) } }));
      return { status: 0, stdout: 'native installer completed', stderr: '' };
    },
  };
  const run = extra => {
    const result = proveRuntimePackage({ root, sourceSha: 'a'.repeat(40), expectedShasum, env: { ...process.env, NODE_PATH: 'ambient', NODE_OPTIONS: '--import ambient-preload', STARCI_LOCAL_ROOT: 'ambient-host', STARCI_MACHINE_DB: 'ambient-machine', STARCI_OWNER_ROOT: 'ambient-source', ORCA_TERMINAL_HANDLE: 'live' }, deps, ...extra });
    if (result.attempt) t.after(() => fs.rmSync(result.attempt, { recursive: true, force: true }));
    return result;
  };
  return { root, calls, expectedShasum, run };
}

test('root archive proof uses real packed bytes and isolated owning dispatch, with immutable raw stage receipts', t => {
  const f = fixture(t), result = f.run();
  assert.equal(result.status, 'green', result.detail);
  assert.deepEqual(f.calls, ['pack', 'install', 'graph', 'dispatch', 'update', 'doctor']);
  assert.equal(result.archive.shasum, f.expectedShasum);
  assert.ok(result.projectedFiles.includes('.starci/host/startup.md')); assert.equal(result.discoveryFiles.length, 2);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(result.attempt, 'result.json'))), result);
  assert.equal(fs.readFileSync(path.join(result.attempt, 'install.stdout.txt'), 'utf8'), 'real API fixture install');
  assert.equal(fs.readFileSync(path.join(result.attempt, 'runtime-install.stdout.txt'), 'utf8'), 'native installer completed');
  assert.throws(() => fs.writeFileSync(path.join(result.attempt, 'result.json'), '{}', { flag: 'wx' }), /EEXIST/);
});

test('root proof requires exact public identity and frozen archive before installation', t => {
  const mismatch = fixture(t, { identity: 'other-runtime' });
  assert.equal(mismatch.run().status, 'red'); assert.deepEqual(mismatch.calls, ['pack']);
  const changed = fixture(t);
  assert.equal(changed.run({ expectedShasum: '0'.repeat(40) }).status, 'red'); assert.deepEqual(changed.calls, ['pack']);
  const missing = fixture(t);
  assert.equal(missing.run({ expectedShasum: null }).status, 'unrun'); assert.deepEqual(missing.calls, []);
});

test('root proof refuses omitted host prompts or UI inputs and unavailable tracked inventory', t => {
  for (const omit of ['.starci/host/startup.md', 'ui/server.mjs', 'ui/src/main.tsx', 'skills/starci/agents/openai.yaml']) {
    const f = fixture(t, { omit }); assert.equal(f.run().status, 'red', omit); assert.deepEqual(f.calls, ['pack']);
  }
  const f = fixture(t, { noInventory: true }); assert.equal(f.run().status, 'unrun'); assert.deepEqual(f.calls, ['pack']);
});

test('root proof rejects private configuration and encrypted host custody before installation', t => {
  for (const privatePath of ['secret.env', 'config/secret.env', 'examples/app/secret.env', 'SECRET.ENV',
    'ext/sonar/secrets/fixture.key.enc', 'ext/sonar/secrets/fixture.txt', 'EXT/SONAR/SECRETS/fixture.key.enc']) {
    const f = fixture(t, { privatePath }), result = f.run();
    assert.equal(result.status, 'red', privatePath);
    assert.match(result.detail, /private host configuration or custody/);
    assert.ok(result.archive.packedFiles.includes(`package/${privatePath}`));
    assert.deepEqual(f.calls, ['pack']);
    assert.equal(result.detail.includes('PRIVATE_CONFIG_FIXTURE'), false);
  }
  const template = fixture(t, { privatePath: 'secret.env.example' });
  assert.equal(template.run().status, 'green');
  assert.deepEqual(template.calls, ['pack', 'install', 'graph', 'dispatch', 'update', 'doctor']);
});

test('root proof retains failed install and graph outcomes and never advances to dispatch', t => {
  const install = fixture(t, { installRed: true }), result = install.run();
  assert.equal(result.status, 'red'); assert.deepEqual(install.calls, ['pack', 'install']);
  assert.match(fs.readFileSync(path.join(result.attempt, 'install.stderr.txt'), 'utf8'), /ETARGET/);
  const tampered = fixture(t, { installedTamper: true }); assert.equal(tampered.run().status, 'red'); assert.deepEqual(tampered.calls, ['pack', 'install']);
  const graph = fixture(t, { graphRed: true }); assert.equal(graph.run().status, 'red'); assert.deepEqual(graph.calls, ['pack', 'install', 'graph']);
});

test('native projection requires exact payload, discovery, custody and no-bootstrap behavior', t => {
  for (const option of ['dispatchRed', 'projectedTamper', 'entryTamper', 'custodyMismatch', 'bootstrap']) {
    const f = fixture(t, { [option]: true }); assert.equal(f.run().status, 'red', option); assert.deepEqual(f.calls, ['pack', 'install', 'graph', 'dispatch']);
  }
  const f = fixture(t, { custodyDigestTamper: true });
  assert.equal(f.run().status, 'red'); assert.deepEqual(f.calls, ['pack', 'install', 'graph', 'dispatch', 'update']);
});

test('incomplete archives and process responses never qualify or advance to a later stage', t => {
  for (const option of ['packRefused', 'packMissing', 'packMalformed']) {
    const f = fixture(t, { [option]: true }); assert.equal(f.run().status, 'unrun', option); assert.deepEqual(f.calls, ['pack']);
  }
  const incomplete = fixture(t, { installIncomplete: true }); assert.equal(incomplete.run().status, 'unrun'); assert.deepEqual(incomplete.calls, ['pack', 'install']);
  for (const option of ['graphIncomplete', 'graphMalformed', 'graphNoProjection']) {
    const f = fixture(t, { [option]: true }); assert.notEqual(f.run().status, 'green', option); assert.deepEqual(f.calls, ['pack', 'install', 'graph']);
  }
});

test('full installed doctor is mandatory and failures retain raw diagnostics without qualifying the root archive', t => {
  const red = fixture(t, {doctorRed: true}), result = red.run();
  assert.equal(result.status, 'red');
  assert.deepEqual(red.calls, ['pack', 'install', 'graph', 'dispatch', 'update', 'doctor']);
  assert.match(fs.readFileSync(path.join(result.attempt, 'runtime-doctor.stdout.txt'), 'utf8'), /dependency missing/);
  for (const option of ['doctorIncomplete', 'doctorSignal', 'doctorError']) {
    const f = fixture(t, {[option]: true}), incomplete = f.run();
    assert.equal(incomplete.status, 'unrun', option);
    assert.deepEqual(f.calls, ['pack', 'install', 'graph', 'dispatch', 'update', 'doctor']);
  }
  const changed = fixture(t, {doctorTamper: true});
  assert.equal(changed.run().status, 'red', 'diagnosis cannot mutate the verified payload and leave the proof green');
});

test('shared installed-byte verifier rejects traversal and a linked projection root', t => {
  const f = fixture(t);
  const payload = { name: 'starci', version: 'test', files: new Map([['package/../outside', Buffer.from('x')]]) };
  assert.match(verifyPackedDependencies([payload], f.root, { packageRoots: new Map([['starci', f.root]]) }), /invalid packed path/);
  const target = path.join(f.root, 'plain'), link = path.join(f.root, 'linked'); fs.mkdirSync(target);
  fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  assert.match(verifyPackedDependencies([{ ...payload, files: new Map([['package/a', Buffer.from('x')]]) }], f.root, { packageRoots: new Map([['starci', link]]) }), /root is missing or linked/);
});
