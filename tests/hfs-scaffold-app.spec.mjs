// hfs-scaffold-app.spec.mjs - `hfs scaffold app demo` makes the one shape of a StarCi product, and `hfs lint` at its root judges it
// with both canons: ESLint with the BE canon over be/ only and with the FE canon over fe/ only, stylelint over fe/, the app check.
// A fresh scaffold has 0 findings and 0 tool errors; a violation planted on each side is reported by its own side's canon alone.
// Nothing is installed: the dependencies are linked from existing installs (tests/_hfs-app-install.mjs; STARCI_APP_INSTALLS may add
// a product app's node_modules when the runtime holds no copy of a framework the skeleton imports).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { main } from '../packages/hfs/bin/hfs.mjs';
import { installInto, missingFrom, runtimeInstalls, uninstall } from './_hfs-app-install.mjs';

const PRESETS = { sonarExclusions: '**/*.spec.ts,**/*.e2e-spec.ts,**/dist/**,**/coverage/**' };
const installs = runtimeInstalls();
const missing = missingFrom(installs);
const skip = missing.length ? `no install holds ${missing.join(', ')}; set STARCI_APP_INSTALLS to an app's node_modules` : false;

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

const edit = (app, file, from, to) => {
  const target = path.join(app, ...file.split('/'));
  const text = fs.readFileSync(target, 'utf8');
  assert.ok(text.includes(from), `${file} holds ${from}`);
  fs.writeFileSync(target, text.replace(from, to));
};

test('hfs scaffold app writes the app shape and hfs lint at its root finds nothing, each side judged by its own canon', { skip, timeout: 600_000 }, async (t) => {
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

  // One violation per side: a public door with no closed-list reason (BE canon), a raw heading (FE canon).
  edit(app, 'be/src/features/system-health/transport/http/live.controller.ts', '@Public({ reason: PublicReason.Health })', '@Public({ reason: "health" })');
  edit(app, 'fe/apps/web/src/features/pages/HomePage/component.tsx', '<Heading level={1}>{props.props.title}</Heading>', '<h1>{props.props.title}</h1>');
  const planted = await lint(app);
  assert.equal(planted.code, 1);
  const eslint = planted.report.findings.filter((f) => f.engine === 'eslint');
  assert.ok(eslint.some((f) => f.rule === 'starci-be/public-needs-reason' && f.path === 'be/src/features/system-health/transport/http/live.controller.ts'), 'the BE canon judged be/');
  assert.ok(eslint.some((f) => f.rule.startsWith('starci-fe/') && f.path === 'fe/apps/web/src/features/pages/HomePage/component.tsx'), 'the FE canon judged fe/');
  for (const finding of eslint) {
    const side = finding.path.split('/')[0];
    assert.ok(!finding.rule.startsWith('starci-') || finding.rule.startsWith(`starci-${side}/`), `${finding.rule} on ${finding.path}: a canon judges only its own side`);
  }
});
