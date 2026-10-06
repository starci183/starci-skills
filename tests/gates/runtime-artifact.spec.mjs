import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { explicitWorkPaths, forbiddenEntries, inventoryText, main, releaseMetadata } from '../../scripts/gates/runtime-artifact.mjs';

test('host-local and secret material is forbidden, the example secret file is not', () => {
  const allowed = ['knowledge/patterns/be/config.yaml', 'secret.env.example', 'config.example.yaml', 'examples/.runtimes/app/runtime.sqlite', 'be/.env.example', 'docs/keys.md', 'examples/.runtimes/app/artifacts/ab/abcd', 'packages/hfs/templates/app/skeleton/.starciwork/index.yaml', 'packages/hfs/templates/app/skeleton-lite/.starcistacks/dev/secrets/.gitkeep'];
  const bad = ['config.yaml', 'config.json', 'secret.env', 'x/settings.local.json', 'ui/.secrets/k', 'machine.sqlite', 'a/b.sqlite-wal', 'a/b.sqlite-shm', 'a/b.sqlite-journal', 'node_modules/x/i.js', 'ui/node_modules/y', 'run.log', '.git/HEAD', 'be/.env', 'be/.env.local', 'x/id.pem', 'x/tls.key', 'stacks/secrets/a.yaml', 'packages/hfs/templates/app/skeleton/.starcistacks/dev/secrets/db.txt', 'stacks/secrets/.gitkeep', 'packages/cli/.starciwork/index.yaml', 'Secret.env', 'UI/Node_Modules/y', 'a\\secret.env', '.runtime/artifacts/ab/abcd', 'x/.runtime/projects/p/runtime.sqlite'];
  assert.deepEqual(forbiddenEntries([...bad, ...allowed]).map((f) => f.path), bad);
});

test('a .starciwork entry passes only as a curated example fixture or an explicit files entry', () => {
  const allowed = explicitWorkPaths(['examples/**', '!examples/**/.starciwork/**', 'lib/.starciwork/index.yaml', 'docs/']);
  assert.deepEqual([...allowed], ['lib/.starciwork/index.yaml']);
  const paths = ['examples/a/.starciwork/index.yaml', 'lib/.starciwork/index.yaml', 'lib/.starciwork/x.yaml', '.starciwork/index.yaml'];
  assert.deepEqual(forbiddenEntries(paths, allowed).map((f) => f.path), ['lib/.starciwork/x.yaml', '.starciwork/index.yaml']);
});

test('the inventory is sorted with sizes and the metadata takes identity from its inputs', () => {
  assert.equal(inventoryText([{ path: 'b', size: 2 }, { path: 'a', size: 1 }]), '1\ta\n2\tb\n');
  const meta = releaseMetadata({ manifest: { name: 'n', version: '9.9.9' }, packed: { files: [{}], integrity: 'sha512-x' }, tarball: 'n-9.9.9.tgz', sha256: 'h', bytes: 5,
    env: { GITHUB_SHA: 'abc', GITHUB_REF: 'refs/heads/main', GITHUB_RUN_ID: '1', GITHUB_RUN_ATTEMPT: '2' }, nodeVersion: 'v22' });
  assert.deepEqual([meta.name, meta.version, meta.sha, meta.runAttempt, meta.fileCount, meta.node], ['n', '9.9.9', 'abc', '2', 1, 'v22']);
});

test('main writes the hash of the tarball bytes, exits 1 on forbidden material and 2 when the list does not describe the tarball', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-artifact-'));
  try {
    const bytes = Buffer.from('tarball bytes');
    const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'n', version: '1.2.3', files: [] }));
    fs.writeFileSync(path.join(dir, 'n-1.2.3.tgz'), bytes);
    const run = (files, packedIntegrity = integrity) => {
      fs.writeFileSync(path.join(dir, 'pack.json'), JSON.stringify([{ name: 'n', version: '1.2.3', filename: 'n-1.2.3.tgz', integrity: packedIntegrity, files }]));
      return main(['--pack', path.join(dir, 'pack.json'), '--dir', dir, '--out', path.join(dir, 'out'), '--root', dir], { GITHUB_SHA: 'abc' });
    };
    assert.equal(run([{ path: 'index.mjs', size: 1 }]), 0);
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'out', 'release-metadata.json'), 'utf8'));
    assert.equal(meta.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.deepEqual([meta.version, meta.sha, meta.bytes, meta.integrity], ['1.2.3', 'abc', bytes.length, integrity]);
    assert.equal(run([{ path: 'index.mjs', size: 1 }, { path: 'secret.env', size: 1 }]), 1);
    assert.equal(run([]), 2);
    assert.equal(run([{ path: 'index.mjs', size: 1 }], 'sha512-not-the-tarball'), 2);
    assert.equal(main(['--pack', path.join(dir, 'absent.json'), '--dir', dir, '--out', path.join(dir, 'out'), '--root', dir], {}), 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
