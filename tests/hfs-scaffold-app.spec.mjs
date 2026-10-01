// hfs-scaffold-app.spec.mjs - `hfs scaffold app demo` makes the one shape of a StarCi product, and `hfs lint` at its root judges it
// with both canons: ESLint with the BE canon over be/ only and with the FE canon over fe/ only, stylelint over fe/, the app check.
// A fresh scaffold has 0 findings and 0 tool errors; a violation planted on each side is reported by its own side's canon alone, and
// every path a finding names, in its path and in its message, is app-relative. The scaffold also type-checks with its own root
// `typecheck` script (after `codegen`), so every import of the skeleton is proven to resolve; an unresolvable import planted on each
// side is reported. The be api also builds with its own build:be script and boots with start:api (GET /health/live answers 200), then stops.
// Nothing is installed: the dependencies are linked from existing installs (tests/_hfs-app-install.mjs; STARCI_APP_INSTALLS may add
// a product app's node_modules when the runtime holds no copy of a framework the skeleton imports).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { main } from '../packages/hfs/bin/hfs.mjs';
import { installInto, missingFrom, runtimeInstalls, uninstall } from './_hfs-app-install.mjs';

const PRESETS = { sonarExclusions: '**/*.spec.ts,**/*.e2e-spec.ts,**/dist/**,**/coverage/**' };
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

const edit = (app, file, from, to) => {
  const target = path.join(app, ...file.split('/'));
  const text = fs.readFileSync(target, 'utf8');
  assert.ok(text.includes(from), `${file} holds ${from}`);
  fs.writeFileSync(target, text.replace(from, to));
};

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
  const scripts = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8')).scripts;
  for (const name of ['dev:be', 'dev:fe', 'build:be', 'build:fe', 'start:api', 'lint', 'lint:fix', 'test', 'test:integration', 'test:e2e', 'test:contract', 'test:stack', 'codegen', 'contract:emit', 'typecheck']) {
    assert.ok(scripts[name], `the root package.json has the ${name} script`);
  }

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
  child = spawn(process.execPath, [entry], { cwd: app, env: { ...process.env, PORT: String(port), HTTP_SECURITY_ALLOWED_ORIGINS: origin }, stdio: ['ignore', 'pipe', 'pipe'] });
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
