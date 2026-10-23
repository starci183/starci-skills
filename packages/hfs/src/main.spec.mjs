// The clean-install proof of @starci/hfs (scripts/gates/package-clean-test.mjs runs `npm test` in a copy of this folder with
// nothing installed): the CLI's whole static module graph loads from the published folders alone - hfs declares no
// dependency, so any bare import here would fail - and a call with no verb prints the usage and refuses with exit 2.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { main, VERBS } from './main.mjs';

test('the app implementation loads with no installed dependency and refuses a missing verb with its usage', async () => {
  let err = '';
  const code = await main([], { stdout: () => {}, stderr: (s) => { err += s; } });
  assert.equal(code, 2);
  assert.match(err, /^starci app check /m);
  assert.match(err, /^starci app scaffold <name>/m);
  assert.match(err, /^starci app secret list/m);
  assert.match(err, /^starci app coverage merge --out <lcov>/m);
  assert.deepEqual(VERBS, ['scaffold', 'add', 'lint', 'sync', 'check', 'upgrade', 'stack', 'release', 'explain', 'emit', 'new', 'secret', 'ci', 'db', 'hygiene', 'coverage']);
});

test('global options use cwd, upgrade refuses a lite target with its typed usage exit and a full app it cannot give a world', async (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-app-main-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const wanted = path.join(base, 'app');
  fs.mkdirSync(wanted);
  let call;
  const stackMain = async (argv, io) => { call = { argv, cwd: io.cwd }; return 0; };
  assert.equal(await main(['stack', 'status', '--cwd', 'app', '--edition', 'full'], { cwd: base, stackMain }), 0);
  assert.deepEqual(call, { argv: ['status'], cwd: wanted });
  let err = '';
  assert.equal(await main(['upgrade', '--edition', 'lite'], { stderr: (text) => { err += text; } }), 2);
  assert.match(err, /^HFS_UPGRADE_TARGET_INVALID: .*--edition full\n$/);
  const declaration = { hfs: 3, kind: 'app', project: 'app', sides: { be: { apps: [{ name: 'core', kind: 'api' }] }, fe: { apps: [{ name: 'landing', kind: 'next' }], reads: ['be/contracts/'] } } };
  const declared = JSON.stringify(declaration);
  fs.writeFileSync(path.join(wanted, 'hfs.json'), declared);
  err = '';
  assert.equal(await main(['upgrade', '--edition', 'full', '--plan', '--cwd', wanted], { stderr: (text) => { err += text; } }), 2);
  assert.match(err, /^HFS_SCAFFOLD_TEST_WORLD: the test world migrates the connections of hfs\.json, and it declares none\n$/);
  assert.equal(fs.readFileSync(path.join(wanted, 'hfs.json'), 'utf8'), declared);
});

test('upgrade adds the test world a full app lacks, never overwrites one, and then reports the app complete', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-app-world-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const declaration = {
    hfs: 3, kind: 'app', project: 'shop',
    sides: {
      be: { apps: [{ name: 'core', kind: 'api' }, { name: 'cli', kind: 'cli' }], kinds: ['api', 'cli'], connections: [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'database' }] },
      fe: { apps: [{ name: 'landing', kind: 'next' }], reads: ['be/contracts/'] },
    },
  };
  fs.writeFileSync(path.join(root, 'hfs.json'), JSON.stringify(declaration));
  const tools = ['@nestjs/testing', '@starci/jest-preset', '@starci/test-world', '@types/jest', 'jest', 'ts-jest'];
  const manifest = `${JSON.stringify({ name: 'shop', devDependencies: Object.fromEntries(tools.map((name) => [name, '1.0.0'])) }, null, 2)}\n`;
  fs.writeFileSync(path.join(root, 'package.json'), manifest);
  const world = [
    'be/src/tests/world/test-world.config.ts', 'be/src/tests/world/test-apps.options.ts', 'be/src/tests/world/use-test-world.ts',
    'be/src/tests/world/global-setup.ts', 'be/src/tests/world/global-teardown.ts', 'be/src/tests/fixtures/persistence/migrations.sql.ts',
    'be/src/tests/integration/readiness/readiness.integration-spec.ts', 'be/src/tests/e2e/system-health/core-serves-once-migrated.e2e-spec.ts',
  ];
  const run = async (argv) => {
    let stdout = '';
    let stderr = '';
    const code = await main([...argv, '--cwd', root], { stdout: (text) => { stdout += text; }, stderr: (text) => { stderr += text; } });
    return { code, stdout, stderr };
  };

  const planned = await run(['upgrade', '--plan']);
  assert.equal(planned.code, 0, planned.stderr);
  assert.deepEqual(planned.stdout.trim().split('\n').slice(0, -1).map((line) => line.slice(0, line.indexOf(':'))), world.map((file) => `add ${file}`));
  assert.match(planned.stdout, /starci app upgrade --plan: 8 steps planned; no file written\n$/);
  assert.equal(fs.existsSync(path.join(root, 'be')), false);

  const applied = await run(['upgrade']);
  assert.equal(applied.code, 0, applied.stderr);
  assert.match(applied.stdout, /starci app upgrade: 8 steps applied\n$/);
  const config = fs.readFileSync(path.join(root, 'be/src/tests/world/test-world.config.ts'), 'utf8');
  assert.ok(config.includes('import { AppModule as CoreApp } from "../../../apps/core/src/app.module"'));
  assert.ok(config.includes('postgresql: { connections: [{ name: "primary" }] },'));
  assert.ok(config.includes('core: { module: CoreApp, options: coreOptionsOf },'));
  const options = fs.readFileSync(path.join(root, 'be/src/tests/world/test-apps.options.ts'), 'utf8');
  assert.ok(options.includes('PRIMARY_DB_URL: w.db.primary.url,'));
  assert.ok(options.includes('readCoreEnv(environmentOf(w, { PORT: String(w.apps.core.port) }))'));
  assert.ok(fs.readFileSync(path.join(root, 'be/src/tests/fixtures/persistence/migrations.sql.ts'), 'utf8').includes('SELECT name FROM primary_migrations ORDER BY id LIMIT 500'));
  assert.equal(fs.readFileSync(path.join(root, 'package.json'), 'utf8'), manifest);

  const again = await run(['upgrade']);
  assert.equal(again.code, 0, again.stderr);
  assert.equal(again.stdout, 'starci app upgrade: 0 steps applied (the full app is complete)\n');

  fs.rmSync(path.join(root, 'be/src/tests/world/global-setup.ts'));
  fs.writeFileSync(path.join(root, 'be/src/tests/world/test-world.config.ts'), 'export const owned = true\n');
  const conflict = await run(['upgrade']);
  assert.equal(conflict.code, 2);
  assert.match(conflict.stderr, /^HFS_UPGRADE_FILE_CONFLICT: be\/src\/tests\/world\/test-world\.config\.ts already exists/);
  assert.equal(fs.readFileSync(path.join(root, 'be/src/tests/world/test-world.config.ts'), 'utf8'), 'export const owned = true\n');
  assert.equal(fs.existsSync(path.join(root, 'be/src/tests/world/global-setup.ts')), false);
});

test('stack refuses with exit 2 and an install hint when the app has no test-world package', async (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-app-stack-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  let err = '';
  const code = await main(['stack', 'status'], { cwd, stdout: () => {}, stderr: (text) => { err += text; } });
  assert.equal(code, 2);
  assert.match(err, /needs @starci\/test-world installed in the app/);
});
