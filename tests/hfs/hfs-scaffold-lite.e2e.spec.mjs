// hfs-scaffold-lite.e2e.spec.mjs - the lite scaffold proved as an installed app over its own local Supabase stack.
// The source-canon registry supplies this checkout's unpublished @starci packages; every other dependency comes from npm.
// Docker is the only optional prerequisite: scaffold-time type generation, the database proof and type drift all use the
// scaffolded supabase/config.toml and the port block it carries for its project name (never the CLI defaults).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { scaffoldApp } from '../../packages/hfs/scaffold/app.mjs';
import { supabasePortVars } from '../../packages/hfs/scaffold/supabase-ports.mjs';
import { runNpm } from '../../scripts/api/npm/run-npm.mjs';
import { runNpx } from '../../scripts/api/npm/run-npx.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';
import { startSourceCanonRegistry } from '../helpers/source-canon-registry.mjs';

const tail = (run, lines = 30) => `${run.stdout ?? ''}\n${run.stderr ?? ''}`.trim().split(/\r?\n/).slice(-lines).join('\n');

const listFiles = (dir, base = dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const file = path.join(dir, entry.name);
  return entry.isDirectory() ? listFiles(file, base) : [path.relative(base, file).split(path.sep).join('/')];
});

const gitStatus = cwd => execFileSync('git', ['status', '--porcelain=v1'], { cwd, encoding: 'utf8' });

const APP_NAME = 'litedemo';

/** The one prerequisite that may skip: Docker answering. A busy port never skips; it fails (below). */
const dockerProbe = spawnSync('docker', ['info'], { encoding: 'utf8', windowsHide: true, timeout: 60_000 });
const skipReason = dockerProbe.status === 0 ? false
  : `docker is unavailable: ${dockerProbe.error?.message ?? `${dockerProbe.stderr ?? dockerProbe.stdout ?? ''}`.trim().split(/\r?\n/)[0] ?? 'docker info failed'}`;

const portBusy = (port) => new Promise((resolve) => {
  const socket = net.connect({ host: '127.0.0.1', port });
  socket.once('connect', () => { socket.destroy(); resolve(true); });
  socket.once('error', () => resolve(false));
});

/** Who holds a port: the Docker container publishing it, else an unnamed local process. */
const holderOf = (port) => {
  const listing = spawnSync('docker', ['ps', '--format', '{{.Names}} {{.Ports}}'], { encoding: 'utf8', windowsHide: true, timeout: 60_000 });
  const row = String(listing.stdout ?? '').split(/\r?\n/).find((line) => new RegExp(`:${port}->`).test(line));
  return row ? `the container ${row.split(' ')[0]}` : 'a local process outside Docker';
};

test('hfs lite scaffold end to end: clean app, builds, isolated Supabase data, type drift and full-upgrade view', { skip: skipReason, timeout: 1_800_000 }, async (t) => {
  // The installed SQL parser extracts one Bun-built native binding at the isolated temp root. It is process infrastructure,
  // not an app fixture, but this spec owns the installed command that creates it and therefore removes it before the leak guard.
  t.after(() => {
    const isolated = process.env.STARCI_TEST_TEMP_DIR;
    if (!isolated || !fs.existsSync(isolated)) return;
    for (const entry of fs.readdirSync(isolated).filter(name => /^\.bun-[\w-]+\.node$/u.test(name))) {
      fs.rmSync(path.join(isolated, entry), { force: true });
    }
  });
  // The scaffold writes its own port block into supabase/config.toml (one block per project name), so the stack runs beside any other.
  // A port of that block already taken is a failure naming the port and its holder, never a skip.
  for (const port of Object.values(supabasePortVars(APP_NAME)).map(Number)) {
    assert.equal(await portBusy(port), false, `HFS_E2E_PORT_BUSY: the local Supabase port ${port} of the ${APP_NAME} stack is held by ${holderOf(port)}; stop that holder or free the port`);
  }
  let stopDatabase = () => {};
  const into = mkdtemp(t, 'hfs-scaffold-lite-e2e-', () => stopDatabase());
  const app = path.join(into, APP_NAME);
  const registry = await startSourceCanonRegistry();
  t.after(() => registry.close());

  const scaffolded = scaffoldApp({ name: APP_NAME, into, edition: 'lite', lock: registry.lock });
  assert.equal(scaffolded.root, app, 'the lite scaffold wrote the app');

  // Lite has no test layer or test tool. Check before npm ci, so dependencies' own test files are not mistaken for app files.
  const files = listFiles(app);
  const testPath = files.find(file => /(?:^|\/)(?:__tests__|e2e|test-support)(?:\/|$)|(?:^|\/)[^/]*(?:\.spec\.|\.test\.|-spec\.)/i.test(file));
  assert.equal(testPath, undefined, `lite emitted a test path: ${testPath}`);
  for (const file of files.filter(file => path.posix.basename(file) === 'package.json')) {
    const manifest = JSON.parse(fs.readFileSync(path.join(app, ...file.split('/')), 'utf8'));
    const scripts = manifest.scripts ?? {};
    assert.equal(
      Object.entries(scripts).some(([name, command]) => /^(?:test|spec)(?::|$)/i.test(name) || /\b(?:jest|vitest|playwright|cypress)\b/i.test(String(command))),
      false,
      `${file} has a test script`,
    );
    const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
    for (const tool of ['@nestjs/testing', '@playwright/test', '@starci/jest-preset', '@starci/test-world', '@types/jest', 'cypress', 'jest', 'ts-jest', 'vitest']) {
      assert.equal(dependencies[tool], undefined, `${file} has the test tool ${tool}`);
    }
  }
  const typesFile = path.join(app, 'supabase', 'types', 'database.types.ts');
  assert.ok(fs.existsSync(typesFile), 'scaffold-time Supabase type generation wrote database.types.ts');
  assert.match(fs.readFileSync(typesFile, 'utf8'), /\bprofiles\b/, 'the generated types include the baseline profiles table');

  // Install from the lockfile produced through the checkout registry. The temporary .npmrc covers any packument fetch.
  const npmrc = path.join(app, '.npmrc');
  fs.writeFileSync(npmrc, `@starci:registry=${registry.origin}/\n`);
  let ci;
  try {
    ci = runNpm(['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: app, timeout: 1_200_000 });
  } finally {
    fs.rmSync(npmrc, { force: true });
  }
  assert.equal(ci.status, 0, `npm ci failed (${ci.status ?? ci.error?.message}): ${tail(ci)}`);
  assert.ok(fs.existsSync(path.join(app, 'node_modules', '@starci', 'hfs', 'package.json')), 'the install holds the checkout @starci/hfs');

  execFileSync('git', ['init', '-q'], { cwd: app });
  execFileSync('git', ['-c', 'core.autocrlf=false', 'add', '-A'], { cwd: app });

  const step = (label, args, options = {}) => {
    const run = runNpm(args, { cwd: app, timeout: 600_000, ...options });
    assert.equal(run.status, 0, `${label} failed (${run.status ?? run.error?.message}):\n${tail(run)}`);
    return run;
  };
  const secretSafeStep = (label, args, options = {}) => {
    const run = runNpm(args, { cwd: app, timeout: 600_000, ...options });
    assert.equal(run.status, 0, `${label} failed (${run.status ?? run.error?.message}); output withheld because it may contain local keys`);
    return run;
  };
  step('npm run typecheck', ['run', 'typecheck']);
  step('npm run lint', ['run', 'lint']);
  step('npm run build:be', ['run', 'build:be']);
  step('npm run build:fe', ['run', 'build:fe'], { timeout: 900_000 });

  // Keep the scaffold's own stack alive through the data proof, type drift check and full-edition view; always stop it
  // before mkdtemp removes the app (its callback owns teardown ordering on every failure path).
  stopDatabase = () => { runNpm(['run', 'db:stop'], { cwd: app, timeout: 300_000 }); };
  secretSafeStep('npm run db:start', ['run', 'db:start'], { timeout: 600_000 });
  secretSafeStep('npm run db:reset', ['run', 'db:reset'], { timeout: 600_000 });

  // Read the local anon key without writing it to test output. An apikey-only request runs as the anonymous PostgREST role.
  const status = runNpx(['supabase', 'status', '-o', 'json'], { cwd: app, timeout: 120_000 });
  assert.equal(status.status, 0, `supabase status failed (${status.status ?? status.error?.message})`);
  let local;
  try {
    const json = String(status.stdout);
    const start = json.indexOf('{');
    if (start < 0) throw new Error('missing JSON object');
    local = JSON.parse(json.slice(start));
  } catch {
    assert.fail('supabase status did not return valid JSON; output withheld because it contains local keys');
  }
  const anonKey = local.ANON_KEY ?? local.PUBLISHABLE_KEY;
  assert.equal(typeof anonKey, 'string', 'supabase status returned a local anonymous key');
  assert.ok(anonKey.length > 0, 'the local anonymous key is not empty');
  assert.equal(typeof local.API_URL, 'string', 'supabase status returned the local API url');
  const response = await fetch(`${local.API_URL}/rest/v1/profiles`, {
    headers: { accept: 'application/json', apikey: anonKey },
  });
  assert.ok([200, 401, 403].includes(response.status), `anonymous profiles request returned ${response.status}`);
  const body = await response.json().catch(() => null);
  if (response.status === 200) {
    assert.equal(Array.isArray(body), true, 'a successful profiles response is a row array');
    assert.equal(body.length, 0, 'the anonymous request returned no profiles');
  } else {
    assert.equal(Array.isArray(body) && body.length > 0, false, 'a refused anonymous request returned no rows');
  }

  step('npm run contract:emit', ['run', 'contract:emit'], { timeout: 300_000 });
  const typesDiff = spawnSync('git', ['diff', '--exit-code', '--', 'supabase/types'], {
    cwd: app, encoding: 'utf8', windowsHide: true, timeout: 60_000,
  });
  assert.equal(typesDiff.status, 0, 'contract:emit left the committed Supabase types unchanged');

  // Take the product CLI prefix from the managed lite script, so the proof follows the one template-owned binary spelling.
  const rootManifest = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'));
  const lintCommand = rootManifest.scripts.lint.trim().split(/\s+/);
  assert.equal(lintCommand.pop(), 'lint', 'the managed lint script names the app lint verb');
  const runAppCli = (args, timeout = 600_000) => runNpx([...lintCommand, ...args], {
    cwd: app, timeout, maxBuffer: 64 * 1024 * 1024,
  });
  const beforePlan = gitStatus(app);
  const plan = runAppCli(['upgrade', '--edition', 'full', '--plan']);
  assert.equal(plan.status, 0, `hfs upgrade plan failed (${plan.status ?? plan.error?.message}):\n${tail(plan)}`);
  assert.match(plan.stdout, /(?:add|remove-field|rewrite-managed) /, 'the upgrade printed its operations');
  assert.match(plan.stdout, /planned; no file written/, 'the upgrade identified itself as a dry plan');
  assert.equal(gitStatus(app), beforePlan, 'the full-edition upgrade plan wrote nothing');

  const checked = runAppCli(['check', '--edition', 'full', '--json'], 900_000);
  assert.equal(checked.status, 1, `the full-edition view should report additive upgrade gaps:\n${tail(checked)}`);
  const report = JSON.parse(checked.stdout);
  assert.deepEqual(report.editionOverride, { declared: 'lite', judged: 'full' });
  assert.ok(report.findings.length > 0, 'the full-edition view reports work for the upgrade');
  // These codes describe additions made by upgrade: full managed renders, required/minimum slots, the cli app and test world.
  const upgradeGapCodes = new Set([
    'HFS_SLOT_REQUIRED_MISSING',
    'HFS_MIN_INSTANCES',
    'HFS_MANAGED_FILE_DRIFT',
    'HFS_GITIGNORE_BLOCK_DRIFT',
    'HFS_SONAR_CONFIG',
    'HFS_RULE_OFF_WITHOUT_REPLACEMENT',
    'HFS_EMPTY_DIR',
    'HFS_README_DEVELOPMENT_INCOMPLETE',
    'HFS_ROOT_ENTRY_MISSING',
    'BE_CLI_REQUIRED',
    'BE_INTEGRATION_SPEC_MISSING',
    'BE_KIND_DECLARATION',
    'HFS_MONO_NEST_PROJECTS',
    'BE_TEST_TOPOLOGY',
  ]);
  const unexpectedCodes = [...new Set(report.findings.map(finding => finding.code).filter(code => !upgradeGapCodes.has(code)))].sort();
  assert.deepEqual(unexpectedCodes, [], `full-edition view reported non-upgrade findings: ${unexpectedCodes.join(', ')}`);
  const productFinding = report.findings.find((finding) =>
    !upgradeGapCodes.has(finding.code)
    && /^(?:supabase\/|fe\/|be\/src\/)/.test(String(finding.path ?? '').replaceAll('\\', '/')),
  );
  assert.equal(
    productFinding,
    undefined,
    `full-edition view rejected existing product code: ${productFinding ? `${productFinding.code} ${productFinding.path}` : ''}`,
  );
});
