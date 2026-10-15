import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseYaml } from '../../engine/yaml.mjs';
import { isSopsEnvelope } from '../../scripts/lib/sops-envelope.mjs';
import { envelopeOf } from '../../scripts/hfs/secret-document.mjs';
import { generateAppIdentity } from '../../scripts/hfs/secret-bootstrap-crypto.mjs';
import { declaredSealedMembers, materializeDeclaredPlaceholders } from '../../scripts/hfs/sealed-members.mjs';
import { materializeExample, runMaterializedCommand, withMaterializedExample } from '../../scripts/hfs/example-secrets.mjs';
import { appSource, renderTargets } from '../../packages/hfs/sync/index.mjs';

function fixture(t, edition = 'lite') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-example-secrets-spec-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'fixture');
  const put = (relative, text) => {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  };
  put('hfs.json', JSON.stringify({
    hfs: 3, kind: 'app', project: 'fixture', edition,
    sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } },
  }));
  put('.starcistacks/application-stacks.yaml', 'environments:\n  production:\n    secrets:\n      - {name: connection, where: secrets/connection}\n');
  put('.starcistacks/production/runtime/env/KEYS.md', '| Key | Consumer |\n| --- | --- |\n| `PRIMARY_DB_URL` | `secrets/connection.enc` |\n');
  put('.sops.yaml', 'creation_rules: []\n');
  return { root, put };
}

for (const edition of ['lite', 'full']) {
  test(`materialized ${edition} example has genuine envelopes for its fresh public recipient and leaves its source untouched`, async (t) => {
    const { root } = fixture(t, edition);
    assert.deepEqual(declaredSealedMembers(root), [{ env: 'production', slug: 'connection', keys: ['PRIMARY_DB_URL'] }]);
    const recipients = [];
    const copies = await Promise.all([0, 1].map(() => withMaterializedExample(root, '.', (app) => {
        const recipient = parseYaml(fs.readFileSync(path.join(app, '.sops.yaml'), 'utf8')).creation_rules[0].age;
        recipients.push(recipient);
        const sealed = fs.readFileSync(path.join(app, '.starcistacks/production/secrets/connection.enc'), 'utf8');
        assert.equal(isSopsEnvelope(sealed), true);
        const envelope = envelopeOf(sealed);
        assert.deepEqual(envelope.recipients, [recipient]);
        assert.deepEqual(envelope.keys, ['PRIMARY_DB_URL']);
        assert.equal(fs.existsSync(path.join(app, '.claude')), false);
        assert.equal(appSource(app).runtimeExample, true);
        return app;
    })));
    for (const copied of copies) assert.equal(fs.existsSync(copied), false, 'the callback result is returned after the copy is removed');
    assert.notEqual(recipients[0], recipients[1], 'every example copy gets its own recipient');
    assert.equal(fs.existsSync(path.join(root, '.starcistacks/production/secrets/connection.enc')), false);
    assert.deepEqual(parseYaml(fs.readFileSync(path.join(root, '.sops.yaml'), 'utf8')), { creation_rules: [] });
  });
}

test('materialization removes its private temp directory and zeroes the identity buffer even when sealing fails', async (t) => {
  const { root } = fixture(t);
  const original = fs.mkdtempSync;
  const directories = [];
  t.mock.method(fs, 'mkdtempSync', (...args) => {
    const directory = original(...args);
    directories.push(directory);
    return directory;
  });
  const selected = generateAppIdentity();
  await assert.rejects(materializeExample(root, {
    createIdentity: () => selected,
    sops: { seal: () => { throw new Error('fixture sealing failure'); } },
  }), /fixture sealing failure/);
  assert.equal(selected.identity.every((byte) => byte === 0), true);
  assert.equal(directories.length, 1);
  assert.equal(directories.every((directory) => !fs.existsSync(directory)), true);
});

test('example materialization refuses existing sealed members before replacing the public recipient', async (t) => {
  const { root, put } = fixture(t);
  put('.starcistacks/production/secrets/connection.enc', 'non-secret preexisting fixture marker');
  let generated = false;
  await assert.rejects(materializeExample(root, { createIdentity: () => { generated = true; } }), /without existing sealed members/);
  assert.equal(generated, false);
  assert.deepEqual(parseYaml(fs.readFileSync(path.join(root, '.sops.yaml'), 'utf8')), { creation_rules: [] });
});

test('the copy excludes local custody and private source symlinks before reading them, and cleans up failed callbacks', async (t) => {
  const { root, put } = fixture(t);
  for (const name of ['.claude/secret.env', '.env', '.env.local', 'keys.txt', 'owner.pem', '.aws/config', '.codex/local.json', '.agents/local.json', 'secrets.env'])
    put(name, 'non-secret local fixture marker');
  put('.env.example', 'PUBLIC_NAME=\n');
  put('custody/secret.env/unlabeled', 'non-secret private-directory fixture marker');
  const linkTarget = path.join(root, 'outside');
  fs.mkdirSync(linkTarget);
  for (const name of ['local-link', 'coverage']) {
    try { fs.symlinkSync(linkTarget, path.join(root, name), process.platform === 'win32' ? 'junction' : 'dir'); } catch { /* host may refuse link creation */ }
  }
  let copied;
  await assert.rejects(withMaterializedExample(root, '.', (app) => {
    copied = app;
    for (const name of ['.claude', '.env', '.env.local', 'keys.txt', 'owner.pem', '.aws', '.codex', '.agents', 'secrets.env', 'local-link', 'coverage', 'custody'])
      assert.equal(fs.existsSync(path.join(app, name)), false, name);
    assert.equal(fs.existsSync(path.join(app, '.env.example')), true);
    throw new Error('fixture callback failure');
  }, { preserveCoverage: true }), /fixture callback failure/);
  assert.equal(fs.existsSync(copied), false);
});

test('names-only fixtures with no sealed declarations need no identity or crypto tooling', async (t) => {
  const { root } = fixture(t);
  fs.rmSync(path.join(root, '.starcistacks'), { recursive: true });
  assert.deepEqual(await materializeExample(root, { createIdentity: () => { throw new Error('must not generate'); } }), { members: [] });
});

test('the reusable member writer preserves existing owner-provisioned members without opening them', (t) => {
  const { root, put } = fixture(t);
  put('.starcistacks/production/secrets/connection.enc', 'non-secret owner fixture marker');
  assert.deepEqual(materializeDeclaredPlaceholders(root), { members: [] });
});

test('runtime example workflows use the temporary runner while ordinary app workflows keep their app commands', (t) => {
  const { root } = fixture(t);
  const app = JSON.parse(fs.readFileSync(path.join(root, 'hfs.json'), 'utf8'));
  const workflow = (runtimeExample) => parseYaml(renderTargets(app, undefined, {
    source: { runtimeExample, files: [], read: () => '' },
  }).find((target) => target.path === '.github/workflows/ci.yml').content);
  const command = (fixture, name) => workflow(fixture).jobs.ci.steps.find((step) => step.name === name).run;
  assert.equal(command(false, 'lint'), 'npm run lint');
  assert.match(command(true, 'lint'), /example-secrets\.mjs --run \. -- npm run lint$/u);
  assert.match(command(true, 'coverage proof'), /example-secrets\.mjs --run \. -- npx starci app check --coverage-from/u);
  const examples = path.join(root, 'examples', 'ordinary');
  fs.mkdirSync(examples, { recursive: true });
  assert.equal(appSource(examples).runtimeExample, false, 'an arbitrary examples directory does not identify a runtime repository');
  fs.writeFileSync(path.join(root, 'hfs.json'), JSON.stringify({ kind: 'runtime' }));
  assert.equal(appSource(examples).runtimeExample, true);
});

test('the CI command runner links installed dependencies, preserves coverage input and returns reports before cleanup', async (t) => {
  const { root, put } = fixture(t);
  put('node_modules/.fixture', 'dependency fixture');
  put('be/coverage/lcov.info', 'coverage fixture');
  let copied;
  const status = await runMaterializedCommand(root, 'fixture-command', ['arg'], { run(command, args, options) {
    copied = options.cwd;
    assert.equal(command, 'fixture-command');
    assert.deepEqual(args, ['arg']);
    assert.equal(fs.lstatSync(path.join(copied, 'node_modules')).isSymbolicLink(), true);
    assert.equal(fs.existsSync(path.join(copied, 'be/coverage/lcov.info')), true);
    fs.mkdirSync(path.join(copied, 'reports'));
    fs.writeFileSync(path.join(copied, 'reports/check.json'), '{}\n');
    return { status: 7 };
  } });
  assert.equal(status, 7);
  assert.equal(fs.existsSync(copied), false);
  assert.equal(fs.existsSync(path.join(root, 'node_modules/.fixture')), true, 'copy cleanup never deletes source dependencies');
  assert.equal(fs.existsSync(path.join(root, 'reports/check.json')), true);
});

test('the CLI runs executable argv in the disposable copy and preserves its exit status', (t) => {
  const { root, put } = fixture(t);
  put('verify-copy.mjs', [
    "import fs from 'node:fs';",
    "import assert from 'node:assert/strict';",
    "assert.equal(fs.existsSync('.starcistacks/production/secrets/connection.enc'), true);",
    "fs.mkdirSync('reports');",
    "fs.writeFileSync('reports/copy-root.txt', process.cwd());",
    'process.exitCode = 3;',
  ].join('\n'));
  const script = path.resolve(import.meta.dirname, '../../scripts/hfs/example-secrets.mjs');
  const result = spawnSync(process.execPath, [script, '--run', root, '--', process.execPath, 'verify-copy.mjs'], {
    encoding: 'utf8', windowsHide: true,
  });
  assert.equal(result.status, 3, result.stderr);
  const copied = fs.readFileSync(path.join(root, 'reports/copy-root.txt'), 'utf8');
  assert.equal(fs.existsSync(copied), false);
  assert.equal(fs.existsSync(path.join(root, '.starcistacks/production/secrets/connection.enc')), false);
});
