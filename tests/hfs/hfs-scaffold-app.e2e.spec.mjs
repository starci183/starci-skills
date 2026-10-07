// hfs-scaffold-app.e2e.spec.mjs - the single-service case end to end. `starci app scaffold demo` writes the monorepo into a
// temp dir (fs.mkdtempSync under os.tmpdir(), removed with fs.rmSync in after), then the app REALLY installs: `npm ci` on
// its own lockfile, the @starci scope resolved from this checkout's packed packages through the source-canon registry
// (tests/helpers/source-canon-registry.mjs, the same registry the scaffold's lock step wrote the lockfile against; every
// other package comes from the public registry). Then the app's own commands, run for real through npm:
//   npm run typecheck   codegen, the be tsc and the turbo `typecheck` task of every fe workspace (turbo builds the fe
//                       packages first: ^build) - every import of the skeleton resolves
//   npm run lint        `starci app lint` of the installed @starci/hfs: both side canons, the app check and stylelint - 0 findings
//   npm run test        the be unit run (`cd be && jest --selectProjects unit --coverage`)
//   npm run build:be    the be build (tsc, tsc-alias) that be/dist/apps/cli/src/main.js comes from
//   npm run migrate     `cli migrate run` against a REAL Postgres: @starci/test-world's stack.attach (the world/attach API
//                       the jest world setup itself calls) provisions the run's own database and the `primary`
//                       connection's schema-per-context login over the shared warm stack; stack.detach drops them again.
// The Postgres image is the one the example app's stack declaration pins (examples/ecommerce-app/.starcistacks). The whole
// proof needs Docker; unavailable docker is the one and only reason it may skip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { scaffoldApp } from '../../packages/hfs/scaffold/app.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { runNpm } from '../../scripts/api/npm/run-npm.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';
import { runNpmAsync } from '../helpers/hfs-hfs-scaffold-app-e2e-fixture.mjs';
import { startSourceCanonRegistry } from '../helpers/source-canon-registry.mjs';

const RUNTIME = path.resolve(import.meta.dirname, '..', '..');
const require_ = createRequire(import.meta.url);
const jestPreset = require_('../../packages/jest-preset/index.cjs');
/** What sync loads from the installed jest preset: the Sonar exclusions and the coverage sources (the one coverage scope). */
const PRESETS = { sonarExclusions: jestPreset.sonarExclusions() };

const elapsed = (started) => Math.round(performance.now() - started);
const timed = async (label, action) => {
  const started = performance.now();
  try { return await action(); } finally { console.log(`# scaffold e2e ${label}: ${elapsed(started)}ms`); }
};

/** The checkout's @starci/test-world, built (dist is build output, never committed; the build runs once when it is absent). */
const TEST_WORLD = path.join(RUNTIME, 'packages', 'test-world');

/** The runtime packages of `dir`'s package.json (dependencies and devDependencies, no @types) that its own node_modules lacks. */
function missingOwnDependencies(dir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  return Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })
    .filter((name) => !name.startsWith('@types/') && !fs.existsSync(path.join(dir, 'node_modules', name, 'package.json')));
}

/** Fails at once, naming the command, when the test-world package has no install of its own (CI installs it in a separate step). */
function assertTestWorldInstalled(dir = TEST_WORLD) {
  const missing = missingOwnDependencies(dir);
  assert.deepEqual(missing, [], `@starci/test-world has no install of its own (missing in packages/test-world/node_modules: ${missing.join(', ')}). Run \`npm ci --ignore-scripts\` in packages/test-world, then run this spec again.`);
}

function testWorldRequire() {
  if (!fs.existsSync(path.join(TEST_WORLD, 'dist', 'stack', 'index.js'))) {
    const build = runNpm(['run', 'build'], { cwd: TEST_WORLD, timeout: 300_000 });
    assert.equal(build.status, 0, `npm run build of packages/test-world failed: ${tail(build)}`);
  }
  return createRequire(path.join(TEST_WORLD, 'package.json'));
}

/** The Postgres image the canon stack pins (the example app's stack declaration: what a world attaches to). */
const POSTGRES_IMAGE = parseYaml(fs.readFileSync(path.join(RUNTIME, 'examples', 'ecommerce-app', '.starcistacks', 'application-stacks.yaml'), 'utf8')).components?.postgres?.image;
test('the example app stack declaration pins a postgres image', () => {
  assert.ok(typeof POSTGRES_IMAGE === 'string' && POSTGRES_IMAGE.length > 0, 'the example app stack declaration pins a postgres image');
});

test('a test-world package without its own install fails at once with the command that installs it', (t) => {
  const dir = mkdtemp(t, 'starci-test-world-install-');
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ dependencies: { yaml: '^2' }, devDependencies: { pg: '^8', typescript: '^5', '@types/pg': '^8' } }));
  assert.deepEqual(missingOwnDependencies(dir), ['yaml', 'pg', 'typescript']);
  assert.throws(() => assertTestWorldInstalled(dir), /no install of its own \(missing in packages\/test-world\/node_modules: yaml, pg, typescript\)\. Run `npm ci --ignore-scripts` in packages\/test-world/);
  for (const name of ['yaml', 'pg', 'typescript']) {
    fs.mkdirSync(path.join(dir, 'node_modules', name), { recursive: true });
    fs.writeFileSync(path.join(dir, 'node_modules', name, 'package.json'), '{}');
  }
  assert.deepEqual(missingOwnDependencies(dir), []);
  assert.doesNotThrow(() => assertTestWorldInstalled(dir));
});

/** The last lines of a run's output, for failure messages. */
const tail = (run, lines = 30) => `${run.stdout ?? ''}\n${run.stderr ?? ''}`.trim().split(/\r?\n/).slice(-lines).join('\n');

/** Docker answering: the warm stack `stack.attach` uses. The only thing the proof may skip on. */
const dockerProbe = spawnSync('docker', ['info'], { encoding: 'utf8', windowsHide: true, timeout: 60_000 });
const skipReason = dockerProbe.status === 0 ? false
  : `docker is unavailable: ${dockerProbe.error?.message ?? `${dockerProbe.stderr ?? dockerProbe.stdout ?? ''}`.trim().split(/\r?\n/)[0] ?? 'docker info failed'}`;

test('starci app scaffold end to end: npm ci, codegen + typecheck, starci app lint clean, the be unit run and cli migrate run over a real Postgres', { skip: skipReason, timeout: 1_800_000 }, async (t) => {
  assertTestWorldInstalled();
  const into = mkdtemp(t, 'hfs-scaffold-e2e-');
  const app = path.join(into, 'demo');
  const registry = await timed('source registry', () => startSourceCanonRegistry());
  t.after(() => registry.close());
  const scaffolded = await timed('scaffold and lock', () => scaffoldApp({ name: 'demo', into, presets: PRESETS, lock: registry.lock }));
  assert.equal(scaffolded.root, app, 'the scaffold wrote the app');

  // The real install over the app's own lockfile: the @starci scope answers from the source-canon registry for the one
  // call (the lockfile's resolved tarball URLs already name it; the .npmrc covers any packument fetch); removed after.
  const npmrc = path.join(app, '.npmrc');
  fs.writeFileSync(npmrc, `@starci:registry=${registry.origin}/\n`);
  let ci;
  try {
    ci = await timed('npm ci', () => runNpmAsync(['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: app, timeout: 1_200_000 }));
  } finally {
    fs.rmSync(npmrc, { force: true });
  }
  assert.equal(ci.status, 0, `npm ci failed (${ci.status ?? ci.error?.message}): ${tail(ci)}`);
  assert.ok(fs.existsSync(path.join(app, 'node_modules', '.bin', 'turbo')), 'the install linked the workspace tools');
  assert.ok(fs.existsSync(path.join(app, 'node_modules', '@starci', 'cli', 'bin', 'starci.mjs')), 'the install holds @starci/cli from the canon registry');
  assert.ok(fs.existsSync(path.join(app, 'node_modules', '@starci', 'hfs', 'src', 'main.mjs')), 'the install holds @starci/hfs, the transitive implementation @starci/cli runs');

  // starci app lint (and the starci app check it carries) read the app's tracked files: git ls-files of the index.
  execFileSync('git', ['init', '-q'], { cwd: app });
  execFileSync('git', ['-c', 'core.autocrlf=false', 'add', '-A'], { cwd: app });

  const step = async (label, args, options = {}) => {
    const started = performance.now();
    const run = await runNpmAsync(args, { cwd: app, timeout: 600_000, ...options });
    console.log(`# scaffold e2e ${label}: ${elapsed(started)}ms`);
    assert.equal(run.status, 0, `${label} failed (${run.status ?? run.error?.message}):\n${tail(run)}`);
    return run;
  };
  await Promise.all([
    step('npm run typecheck', ['run', 'typecheck']),
    step('npm run lint', ['run', 'lint']),
    // Jest's default cache lives in the OS temp root, which this suite keeps empty: the app's run keeps it inside the fixture.
    step('npm run test', ['test', '--', `--cacheDirectory=${path.join(into, '.jest-cache')}`], { timeout: 900_000 }),
    step('npm run build:be', ['run', 'build:be']),
  ]);
  assert.ok(fs.existsSync(path.join(app, 'be', 'dist', 'apps', 'cli', 'src', 'main.js')), 'the cli app is built');

  // The real Postgres the migrate runs against: the shared warm stack, attached the way the jest world setup attaches -
  // the run's own namespace, its own database, and the schema and login of the schema-isolated `primary` connection.
  const requireTestWorld = testWorldRequire();
  const { stack } = requireTestWorld('./dist/stack/index.js');
  const { namespaceOf, runToken } = requireTestWorld('./dist/stack/namespace.js');
  const namespace = namespaceOf(app, 1);
  const runId = runToken(4);
  const infra = await timed('postgres attach', () => stack.attach({
    namespace,
    runId,
    services: [{ service: 'postgresql', image: POSTGRES_IMAGE }],
    postgresql: { connections: [{ name: 'primary', schema: 'primary' }] },
  }));
  t.after(async () => { await stack.detach({ namespace, runId, infra }).catch(() => undefined); });
  const postgres = infra.postgresql;
  const login = postgres.schemas.primary ?? postgres;
  const url = `postgres://${encodeURIComponent(login.user)}:${encodeURIComponent(login.password)}@${postgres.host}:${postgres.port}/${postgres.databases.primary}`;

  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('STARCI_'))), PRIMARY_DB_URL: url };
  const migrate = await step('npm run migrate (cli migrate run)', ['run', 'migrate'], { env, timeout: 300_000 });
  const output = `${migrate.stdout}\n${migrate.stderr}`;
  assert.match(output, /"event":"migrations\.applied"/, `the cli logged the applied migrations: ${output}`);
  assert.ok(output.includes('InitNote1790000000000'), `the init-note migration ran on the real database: ${output}`);

  // And the table it created is really there, in the connection's schema, checked through the app's own pg install.
  const { Client } = createRequire(path.join(app, 'package.json'))('pg');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const found = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'primary' ORDER BY table_name");
    const names = found.rows.map((row) => row.table_name);
    assert.ok(names.includes('notes'), `the notes table exists in the primary schema: ${names.join(', ')}`);
    assert.ok(names.includes('primary_migrations'), `the migrations ledger exists in the primary schema: ${names.join(', ')}`);
  } finally {
    await client.end().catch(() => undefined);
  }
});


test('source canon registry close settles after prior real cleanup', { timeout: 360_000 }, async (t) => {
  const root = mkdtemp(t, 'hfs-registry-close-');
  const pkg = path.join(root, 'packages', 'close-probe');
  fs.mkdirSync(pkg, { recursive: true });
  fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: '@starci/close-probe', version: '0.0.0', files: ['index.mjs'] }) + '\n');
  fs.writeFileSync(path.join(pkg, 'index.mjs'), 'export const closeProbe = true;\n');
  const registry = await startSourceCanonRegistry({ root });
  let closed = false;
  t.after(async () => { if (!closed) await registry.close(); });
  const url = `${registry.origin}/@starci%2fclose-probe`;
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  assert.equal(response.status, 200, 'the real loopback registry serves its packed package');
  const metadata = await response.json();
  assert.equal(metadata.versions['0.0.0'].name, '@starci/close-probe');

  // The fixture's first close signals its real child and awaits exit; a repeat must not await another exit event.
  await registry.close();
  closed = true;
  await assert.rejects(fetch(url, { signal: AbortSignal.timeout(5_000) }), 'the closed registry no longer serves requests');
  let deadline;
  try {
    await Promise.race([
      registry.close(),
      new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error('repeated source canon registry close did not settle after cleanup')), 5_000); }),
    ]);
  } finally {
    clearTimeout(deadline);
  }
});
