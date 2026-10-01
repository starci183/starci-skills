// hfs-scaffold-app.spec.mjs - `hfs scaffold app demo` makes the one shape of a StarCi product, and `hfs lint` at its root judges it
// with both canons: ESLint with the BE canon over be/ only and with the FE canon over fe/ only, stylelint over fe/, the app check.
// A fresh scaffold has 0 findings and 0 tool errors; a violation planted on each side is reported by its own side's canon alone, and
// every path a finding names, in its path and in its message, is app-relative. The scaffold also type-checks with its own root
// `typecheck` script (after `codegen`), so every import of the skeleton is proven to resolve; an unresolvable import planted on each
// side is reported. The be api also builds with its own build:be script and boots with start:api (GET /health/live answers 200), then stops.
// The scaffold resolves its lockfile with npm (network or the npm cache); nothing is installed: the dependencies are linked from existing installs (tests/_hfs-app-install.mjs; STARCI_APP_INSTALLS may add
// a product app's node_modules when the runtime holds no copy of a framework the skeleton imports).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { main } from '../packages/hfs/bin/hfs.mjs';
import { scaffoldApp } from '../packages/hfs/scaffold/app.mjs';
import { coverageExclusions } from '../packages/hfs/sync/index.mjs';
import { parseYaml } from '../engine/yaml.mjs';
import { LINT_DEPENDENCIES, RUNTIME, installInto, missingFrom, runtimeInstalls, uninstall } from './_hfs-app-install.mjs';

const jestPreset = createRequire(import.meta.url)('../packages/jest-preset/index.cjs');
/** What sync loads from the installed jest preset: the Sonar exclusions and the coverage sources (the one coverage scope). */
const PRESETS = { sonarExclusions: jestPreset.sonarExclusions(), coverageSources: [...jestPreset.COVERAGE_SOURCES] };
/** The one coverage scope of an app: the services of the be side, nothing else. */
const COVERAGE_SCOPE = ['be/src/**/*.service.ts'];
const LCOV = 'be/coverage/lcov.info';
const installs = runtimeInstalls();
const missing = missingFrom(installs);
const skipReason = missing.length ? `no install holds ${missing.join(', ')}; set STARCI_APP_INSTALLS to an app's node_modules` : false;
// A skip must never pass silently. Locally it prints one SKIPPED line. The release verification and CI set
// STARCI_REQUIRE_APP_INSTALLS=1 (scripts/install/fresh-app-installs.mjs provides fresh registry installs), and then a
// missing install fails the test instead of skipping it.
export const REQUIRE_APP_INSTALLS = process.env.STARCI_REQUIRE_APP_INSTALLS === '1';
function gate(name, reason) {
  if (!reason) return { skip: false, required: null };
  if (REQUIRE_APP_INSTALLS) return { skip: false, required: `REQUIRED (STARCI_REQUIRE_APP_INSTALLS=1) but ${reason}` };
  console.log(`SKIPPED: no installs - ${name}: ${reason}`);
  return { skip: reason, required: null };
}
const lintGate = gate('scaffold lint', skipReason);

async function run(argv) {
  let out = '';
  const code = await main(argv, { stdout: (s) => { out += s; }, stderr: (s) => { out += s; }, presets: PRESETS });
  return { code, out };
}

async function lint(app) {
  execFileSync('git', ['-c', 'core.autocrlf=false', 'add', '-A'], { cwd: app });
  const { code, out } = await run(['lint', '--repo', app, '--format', 'json']);
  return { code, report: JSON.parse(out) };
}

/**
 * The scaffold's own root `typecheck` script, step by step: `npm run <script>` runs that root script's command, `tsc <args>` the app's
 * TypeScript (always --noEmit: a spec writes no build output). Returns the compiler's error lines.
 */
function typecheck(app) {
  const scripts = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8')).scripts;
  const tsc = path.join(app, 'node_modules', 'typescript', 'bin', 'tsc');
  const errors = [];
  const step = (command) => {
    const [tool, ...args] = command.trim().split(/\s+/);
    if (tool === 'npm' && args[0] === 'run') return step(scripts[args[1]]);
    if (tool === 'node') { execFileSync(process.execPath, args, { cwd: app, stdio: 'pipe' }); return; }
    assert.equal(tool, 'tsc', `the typecheck script runs only codegen and tsc, not ${command}`);
    const run = spawnSync(process.execPath, [tsc, ...args.filter((arg) => arg !== '--noEmit'), '--noEmit', '--pretty', 'false'], { cwd: app, encoding: 'utf8' });
    errors.push(...`${run.stdout}${run.stderr}`.split(/\r?\n/).filter((line) => /error TS\d+/.test(line)));
  };
  for (const command of scripts.typecheck.split('&&')) step(command);
  return errors;
}

/** What the boot smoke runs besides the lint set: the be build (`build:be`: tsc, tsc-alias) and the HTTP platform the api serves on. */
const BOOT_DEPENDENCIES = Object.freeze(['tsc-alias', '@nestjs/platform-express', 'express', 'rxjs', 'reflect-metadata']);
const bootGate = gate('scaffold api boot', skipReason || (missingFrom(installs, BOOT_DEPENDENCIES).length ? `no install holds ${missingFrom(installs, BOOT_DEPENDENCIES).join(', ')}; set STARCI_APP_INSTALLS to an app's node_modules` : false));

/** The bin script of an installed package (`tsc` of typescript, `tsc-alias`), read from its package.json. */
function binOf(app, pkg, name) {
  const dir = path.join(app, 'node_modules', ...pkg.split('/'));
  const { bin } = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  return path.join(dir, typeof bin === 'string' ? bin : bin[name]);
}

/** Runs a root script of the app the way npm would, step by step: `cd <dir>`, `npm run <script>`, `tsc`, `tsc-alias`. */
function runScript(app, name) {
  const scripts = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8')).scripts;
  let cwd = app;
  for (const command of scripts[name].split('&&')) {
    const [tool, ...args] = command.trim().split(/\s+/);
    if (tool === 'cd') { cwd = path.resolve(cwd, args[0]); continue; }
    if (tool === 'npm' && args[0] === 'run') { runScript(app, args[1]); continue; }
    const bins = { tsc: binOf(app, 'typescript', 'tsc'), 'tsc-alias': binOf(app, 'tsc-alias', 'tsc-alias') };
    assert.ok(bins[tool], `${name} runs only cd, npm run, tsc and tsc-alias, not ${command}`);
    const run = spawnSync(process.execPath, [bins[tool], ...args], { cwd, encoding: 'utf8' });
    assert.equal(run.status, 0, `${command}: ${run.stdout}${run.stderr}`);
  }
}

/** A free TCP port on the loopback interface. */
const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolve(port)); });
});

/** A .properties text as a map (key=value lines; comments and blank lines left out). */
const propertiesOf = (text) => Object.fromEntries(text.split(/\r?\n/).filter((line) => line && !line.startsWith('#')).map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));

/**
 * The coverage contract of a scaffolded app: sonar-project.properties imports the be lcov with exactly the services as its coverage
 * scope (no other coverage key), codecov.yml holds the same scope at 100 on the project and the patch with fe/ ignored, and the
 * managed CI uploads the same lcov with the CODECOV_TOKEN secret after the unit run.
 */
function assertCoverageContract(app) {
  const sonar = propertiesOf(fs.readFileSync(path.join(app, 'sonar-project.properties'), 'utf8'));
  const coverageKeys = Object.keys(sonar).filter((key) => /coverage|lcov/i.test(key)).sort();
  assert.deepEqual(coverageKeys, ['sonar.coverage.exclusions', 'sonar.javascript.lcov.reportPaths'], 'exactly the lcov import and the complement of the services: no other coverage key');
  assert.equal(sonar['sonar.javascript.lcov.reportPaths'], LCOV);
  assert.deepEqual(sonar['sonar.coverage.exclusions'].split(','), coverageExclusions(PRESETS));
  assert.ok(sonar['sonar.coverage.exclusions'].split(',').includes('fe/**') && !/\.service\.ts/.test(sonar['sonar.coverage.exclusions']), 'fe/ is out, the services are in');
  const codecov = parseYaml(fs.readFileSync(path.join(app, 'codecov.yml'), 'utf8'));
  for (const kind of ['project', 'patch']) {
    assert.deepEqual(codecov.coverage.status[kind].default, { target: '100%', threshold: '0%', paths: COVERAGE_SCOPE }, `codecov ${kind} status: the services at 100`);
  }
  assert.deepEqual(codecov.ignore, ['fe/**'], 'fe/ is outside coverage');
  assert.deepEqual(Object.keys(codecov.coverage.status).sort(), ['patch', 'project']);
  const workflow = parseYaml(fs.readFileSync(path.join(app, '.github', 'workflows', 'ci.yml'), 'utf8'));
  const steps = workflow.jobs.ci.steps;
  const unit = steps.findIndex((step) => step.name === 'unit');
  const upload = steps.findIndex((step) => String(step.uses ?? '').startsWith('codecov/codecov-action@'));
  assert.ok(unit >= 0 && upload > unit, 'the coverage upload follows the unit run');
  assert.equal(steps[upload].with.files, LCOV, 'the upload sends the lcov Sonar imports');
  assert.equal(steps[upload].with.token, '${{ env.CODECOV_TOKEN }}');
  assert.equal(workflow.jobs.ci.env.CODECOV_TOKEN, '${{ secrets.CODECOV_TOKEN }}');
}

const edit = (app, file, from, to) => {
  const target = path.join(app, ...file.split('/'));
  const text = fs.readFileSync(target, 'utf8');
  assert.ok(text.includes(from), `${file} holds ${from}`);
  fs.writeFileSync(target, text.replace(from, to));
};

test('a scaffolded app imports the be lcov into Sonar and Codecov with exactly the services as the coverage scope', (t) => {
  // No install and no registry: the lockfile step is the only part that needs npm, and it is not what this proves.
  const into = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-scaffold-coverage-'));
  t.after(() => fs.rmSync(into, { recursive: true, force: true }));
  const { root, files } = scaffoldApp({ name: 'demo', into, presets: PRESETS, lock: () => ({ ok: true }) });
  for (const file of ['sonar-project.properties', 'codecov.yml', '.github/workflows/ci.yml']) assert.ok(files.includes(file), `${file} is scaffolded`);
  assertCoverageContract(root);
  // The be unit run is the preset's: it writes lcov into be/coverage, the path both imports read.
  assert.match(fs.readFileSync(path.join(root, 'be', 'jest.config.js'), 'utf8'), /require\("@starci\/jest-preset"\)\.starciJestConfig\(\)/);
  const config = jestPreset.starciJestConfig();
  assert.ok(config.coverageReporters.includes('lcov'));
  assert.equal(`be/${config.coverageDirectory}/lcov.info`, LCOV);
});

test('hfs scaffold app writes the app shape and hfs lint at its root finds nothing, each side judged by its own canon', { skip: lintGate.skip, timeout: 600_000 }, async (t) => {
  if (lintGate.required) assert.fail(lintGate.required);
  const into = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-scaffold-app-'));
  const app = path.join(into, 'demo');
  let links = [];
  t.after(() => { uninstall(app, links); fs.rmSync(into, { recursive: true, force: true }); });

  const scaffolded = await run(['scaffold', 'app', 'demo', '--into', into]);
  assert.equal(scaffolded.code, 0, scaffolded.out);
  const declaration = JSON.parse(fs.readFileSync(path.join(app, 'hfs.json'), 'utf8'));
  assert.equal(declaration.kind, 'app');
  assert.deepEqual(Object.keys(declaration.sides).sort(), ['be', 'fe']);
  for (const file of ['package.json', 'package-lock.json', 'be/eslint.config.mjs', 'fe/eslint.config.mjs', 'be/tsconfig.json', 'fe/tsconfig.json']) {
    assert.ok(fs.existsSync(path.join(app, ...file.split('/'))), `${file} is scaffolded`);
  }
  for (const side of ['be', 'fe']) {
    for (const file of ['package.json', 'package-lock.json']) assert.ok(!fs.existsSync(path.join(app, side, file)), `${side}/ holds no ${file}: the app root holds the one`);
  }
  assertCoverageContract(app);
  const scripts = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8')).scripts;
  for (const name of ['dev:be', 'dev:fe', 'build:be', 'build:fe', 'start:api', 'lint', 'lint:fix', 'test', 'test:integration', 'test:e2e', 'test:contract', 'test:stack', 'codegen', 'contract:emit', 'typecheck']) {
    assert.ok(scripts[name], `the root package.json has the ${name} script`);
  }

  // The lockfile is npm's own (the scaffold runs `npm install --package-lock-only`): it resolves every dependency of the root and
  // of every workspace, and `npm ci` accepts it. Checked before any node_modules exists, so the dry run touches no link.
  const manifest = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(app, 'package-lock.json'), 'utf8'));
  assert.equal(lock.lockfileVersion, 3);
  assert.deepEqual(lock.packages[''].dependencies, manifest.dependencies, 'the lock root holds the package.json dependencies');
  assert.deepEqual(lock.packages[''].devDependencies, manifest.devDependencies, 'the lock root holds the package.json devDependencies');
  const workspaces = (manifest.workspaces ?? []).flatMap((pattern) => {
    const [base, star] = pattern.split('/*');
    return star === undefined ? [pattern] : (fs.existsSync(path.join(app, base)) ? fs.readdirSync(path.join(app, base)).map((name) => `${base}/${name}`) : []);
  });
  const declared = [manifest, ...workspaces.map((dir) => JSON.parse(fs.readFileSync(path.join(app, dir, 'package.json'), 'utf8')))];
  for (const pkg of declared) {
    for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) assert.ok(lock.packages[`node_modules/${name}`], `the lock resolves ${name}`);
  }
  for (const dir of workspaces) assert.ok(lock.packages[dir], `the lock holds the workspace ${dir}`);
  const ci = spawnSync('npm ci --dry-run --ignore-scripts --no-audit --no-fund', { cwd: app, encoding: 'utf8', shell: true, windowsHide: true });
  assert.equal(ci.status, 0, `npm ci accepts the lock: ${ci.stderr}`);
  assert.ok(!fs.existsSync(path.join(app, 'node_modules')), 'the dry run installed nothing');

  links = installInto(app, installs);
  execFileSync('git', ['init', '-q'], { cwd: app });

  const fresh = await lint(app);
  assert.deepEqual(fresh.report.errors, [], 'every tool ran');
  assert.deepEqual(fresh.report.findings.map((f) => `${f.path}:${f.line ?? ''} ${f.engine}/${f.rule} ${f.message}`), [], 'a fresh scaffold has no finding');
  assert.equal(fresh.code, 0);
  assert.ok(fresh.report.engines.eslint.sides.be.files > 0, 'ESLint linted the be side');
  assert.ok(fresh.report.engines.eslint.sides.fe.files > 0, 'ESLint linted the fe side');
  assert.ok(fresh.report.engines.stylelint.files > 0, 'stylelint linted the fe stylesheets');

  // The scaffold type-checks with its own script: every skeleton import resolves.
  assert.deepEqual(typecheck(app), [], 'a fresh scaffold type-checks');
  // An unresolvable import planted on each side is reported by the same script.
  const unresolvable = { 'be/src/modules/domain/liveness/liveness.service.ts': '@modules/platform/nowhere', 'fe/apps/web/src/features/pages/HomePage/component.tsx': '@/modules/nowhere' };
  const originals = {};
  for (const [file, specifier] of Object.entries(unresolvable)) {
    const target = path.join(app, ...file.split('/'));
    originals[file] = fs.readFileSync(target, 'utf8');
    fs.writeFileSync(target, `import { gone } from "${specifier}"\nvoid gone\n${originals[file]}`);
  }
  const broken = typecheck(app);
  for (const [file, specifier] of Object.entries(unresolvable)) {
    assert.ok(broken.some((line) => line.replace(/\\/g, '/').includes(file) && line.includes('TS2307') && line.includes(specifier)), `${file}: the unresolvable ${specifier} is reported (${broken.join(' | ')})`);
    fs.writeFileSync(path.join(app, ...file.split('/')), originals[file]);
  }

  // One violation per side: a public door with no closed-list reason (BE canon), a raw heading (FE canon), and an alias of a
  // declaration whose message names its file.
  edit(app, 'be/src/features/system-health/transport/http/live.controller.ts', '@Public({ reason: PublicReason.Health })', '@Public({ reason: "health" })');
  edit(app, 'fe/apps/web/src/features/pages/HomePage/component.tsx', '<Heading level={1}>{props.props.title}</Heading>', '<h1>{props.props.title}</h1>');
  fs.writeFileSync(path.join(app, 'fe', 'apps', 'web', 'src', 'modules', 'config', 'alias.ts'), 'import { siteUrl } from "./index"\n\nexport const origin = siteUrl\n');
  const planted = await lint(app);
  assert.equal(planted.code, 1);
  const eslint = planted.report.findings.filter((f) => f.engine === 'eslint');
  assert.ok(eslint.some((f) => f.rule === 'starci-be/public-needs-reason' && f.path === 'be/src/features/system-health/transport/http/live.controller.ts'), 'the BE canon judged be/');
  assert.ok(eslint.some((f) => f.rule.startsWith('starci-fe/') && f.path === 'fe/apps/web/src/features/pages/HomePage/component.tsx'), 'the FE canon judged fe/');
  const alias = eslint.find((f) => f.rule === 'starci-fe/alias-reexport' && f.path === 'fe/apps/web/src/modules/config/alias.ts');
  assert.ok(alias, 'the alias is reported on its app-relative path');
  assert.match(alias.message, / in fe\/apps\/web\/src\/modules\/config\/alias\.ts /, 'its message names the same app-relative path');
  // Every path a finding message names is app-relative, like the finding's own path.
  for (const finding of planted.report.findings) {
    assert.doesNotMatch(finding.message ?? '', /(^|[\s'"`(])(apps|src|packages)\//, `${finding.path}: ${finding.message} names a side-relative path`);
  }
  for (const finding of eslint) {
    const side = finding.path.split('/')[0];
    assert.ok(!finding.rule.startsWith('starci-') || finding.rule.startsWith(`starci-${side}/`), `${finding.rule} on ${finding.path}: a canon judges only its own side`);
  }
});

test('the scaffolded be api builds with build:be and boots with start:api from the linked installs, then stops', { skip: bootGate.skip, timeout: 600_000 }, async (t) => {
  if (bootGate.required) assert.fail(bootGate.required);
  const into = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-scaffold-boot-'));
  const app = path.join(into, 'demo');
  let links = [];
  let child = null;
  t.after(() => { if (child && child.exitCode === null) child.kill(); uninstall(app, links); fs.rmSync(into, { recursive: true, force: true }); });

  assert.equal((await run(['scaffold', 'app', 'demo', '--into', into])).code, 0);
  // The scaffold declares the runtime peer of every driver integration pair it depends on (R111): nothing to add.
  const { peerIntegrationFindings } = await import('../scripts/lib/hfs-rules/peer-integrations.mjs');
  assert.deepEqual(peerIntegrationFindings({ repoRoot: app, files: ['package.json'] }), []);
  links = installInto(app, installs);

  runScript(app, 'build:be');
  const start = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8')).scripts['start:api'];
  const [tool, entry] = start.split(/\s+/);
  assert.equal(tool, 'node', `start:api runs the built api with node: ${start}`);
  const port = await freePort();
  const origin = 'http://localhost:3000';
  const { spawn } = await import('node:child_process');
  child = spawn(process.execPath, [entry], { cwd: app, env: { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('STARCI_'))), PORT: String(port), HTTP_SECURITY_ALLOWED_ORIGINS: origin }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const exited = new Promise((resolve) => child.once('exit', (code) => resolve(code)));

  let live = null;
  for (let attempt = 0; attempt < 120 && live === null && child.exitCode === null; attempt += 1) {
    try { live = await fetch(`http://127.0.0.1:${port}/health/live`, { headers: { origin } }); } catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
  }
  assert.ok(live, `the api answered on port ${port}: ${output}`);
  assert.equal(live.status, 200, `GET /health/live: ${live.status} ${await live.text()} ${output}`);
  assert.match(output, /"event":"server\.started"/, 'the api logged its start');
  child.kill();
  await exited;
});

/** What the be unit run loads besides the lint set: the runner, its TypeScript transform and the decorator helpers. */
const UNIT_DEPENDENCIES = Object.freeze(['jest', 'ts-jest', 'tslib']);
const unitGate = gate('scaffold be unit run', missingFrom(installs, [...LINT_DEPENDENCIES, ...UNIT_DEPENDENCIES]).length ? `no install holds ${missingFrom(installs, [...LINT_DEPENDENCIES, ...UNIT_DEPENDENCIES]).join(', ')}; set STARCI_APP_INSTALLS to an app's node_modules` : false);

test('the scaffolded be unit run (the test script) writes the lcov Sonar and Codecov import, naming services only', { skip: unitGate.skip, timeout: 600_000 }, async (t) => {
  if (unitGate.required) assert.fail(unitGate.required);
  const into = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-scaffold-unit-'));
  const app = path.join(into, 'demo');
  let links = [];
  t.after(() => { uninstall(app, links); fs.rmSync(into, { recursive: true, force: true }); });
  assert.equal((await run(['scaffold', 'app', 'demo', '--into', into])).code, 0);
  assertCoverageContract(app);
  links = installInto(app, installs);
  // The root `test` script, as npm runs it: `cd be && jest --selectProjects unit --coverage` (plus --ci, like the managed CI).
  const script = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8')).scripts.test;
  assert.equal(script, 'cd be && jest --selectProjects unit --coverage');
  const jest = path.join(app, 'node_modules', 'jest', 'bin', 'jest.js');
  const unit = spawnSync(process.execPath, [jest, '--selectProjects', 'unit', '--coverage', '--ci', '--cacheDirectory', path.join(into, 'jest-cache')], { cwd: path.join(app, 'be'), encoding: 'utf8', timeout: 540_000 });
  assert.equal(unit.status, 0, `the scaffold's unit run passes at per-file 100 on its services: ${unit.stdout}${unit.stderr}`);
  const lcov = path.join(app, ...LCOV.split('/'));
  assert.ok(fs.existsSync(lcov), `${LCOV} is written by the unit run`);
  const files = fs.readFileSync(lcov, 'utf8').split(/\r?\n/).filter((line) => line.startsWith('SF:')).map((line) => line.slice(3).replace(/\\/g, '/'));
  assert.ok(files.length > 0, 'the lcov names the services it measured');
  for (const file of files) assert.match(file, /(^|\/)src\/.*\.service\.ts$/, `${file}: only services are measured (jest names the file relative to be/ or absolute)`);
});

/** What the fe build loads besides the lint set: the server-only marker the skeleton's request config imports. */
const FE_BUILD_DEPENDENCIES = Object.freeze(['server-only']);
const feBuildGate = gate('scaffold fe build', missingFrom(installs, [...LINT_DEPENDENCIES, ...FE_BUILD_DEPENDENCIES]).length ? `no install holds ${missingFrom(installs, [...LINT_DEPENDENCIES, ...FE_BUILD_DEPENDENCIES]).join(', ')}; set STARCI_APP_INSTALLS to an app's node_modules` : false);

/** The SWC native-binding cache of `next build`: a directory under the user's home (STARCI_SWC_CACHE overrides), because SWC refuses a cache ancestor whose ACL grants write to other accounts. */
const swcCache = () => { const dir = process.env.STARCI_SWC_CACHE ?? path.join(os.homedir(), 'starci-swc-cache'); fs.mkdirSync(dir, { recursive: true }); return dir; };

/** The environment `next build` runs in. */
const buildEnv = () => ({ ...process.env, NEXT_TELEMETRY_DISABLED: '1', SWC_NATIVE_BINDING_CACHE: swcCache() });

test('the scaffolded fe builds with the root build:fe script: next-intl finds its request config from the directory the build runs in', { skip: feBuildGate.skip, timeout: 900_000 }, async (t) => {
  if (feBuildGate.required) assert.fail(feBuildGate.required);
  // The app sits inside the runtime checkout: the borrowed install links packages from the runtime and its examples, and Turbopack
  // compiles only what lies under its workspace root, so the spec widens that root (below) to the checkout that holds every link target.
  const into = fs.mkdtempSync(path.join(RUNTIME, '.tmp-hfs-fe-build-'));
  const app = path.join(into, 'demo');
  let links = [];
  t.after(() => { uninstall(app, links); fs.rmSync(into, { recursive: true, force: true }); });
  assert.equal((await run(['scaffold', 'app', 'demo', '--into', into])).code, 0);
  links = installInto(app, installs);
  const toRuntime = path.relative(path.join(app, 'fe', 'apps', 'web'), RUNTIME).split(path.sep).join('/');
  edit(app, 'fe/apps/web/next.config.ts', '"..", "..", "..")', `${JSON.stringify(toRuntime)})`);

  // The root `build:fe` script as npm runs it, step by step: the codegen script, then `(cd <app dir> && next build)` per Next app.
  const script = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8')).scripts['build:fe'];
  const next = path.join(app, 'node_modules', 'next', 'dist', 'bin', 'next');
  const dirs = [...script.matchAll(/\(cd (\S+) && next build\)/g)].map((match) => match[1]);
  assert.equal(script.replace(/\(cd \S+ && next build\)/g, '').replace(/[\s&]/g, ''), 'npmruncodegen--silent', `build:fe runs only codegen and one (cd <app dir> && next build) per app: ${script}`);
  execFileSync(process.execPath, ['scripts/codegen.mjs'], { cwd: app, stdio: 'pipe' });
  let built = 0;
  for (const dir of dirs) {
    const build = spawnSync(process.execPath, [next, 'build'], { cwd: path.join(app, dir), encoding: 'utf8', env: buildEnv(), timeout: 840_000 });
    assert.equal(build.status, 0, `(cd ${dir} && next build) must build: ${build.stdout}${build.stderr}`);
    assert.ok(fs.existsSync(path.join(app, dir, '.next', 'BUILD_ID')), `${dir} wrote its build output`);
    built += 1;
  }
  assert.ok(built >= 1, 'build:fe built at least one app');
});
