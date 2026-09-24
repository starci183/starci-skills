import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import dns from 'node:dns/promises';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { parseYaml } from '../engine/yaml.mjs';
import { CITATION, placeholdersIn, resolveCitation, writeProfile, SAMPLE_PARAMETERS } from './helpers/repository-baseline.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = rel => parseYaml(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const BASELINE = 'knowledge/repository-baseline.yaml';

test('the repository baseline is one registered knowledge source with nest and next profiles', () => {
  const index = read('knowledge/index.yaml');
  assert.ok(index.branches.some(b => b.id === 'repository-baseline' && b.path === 'repository-baseline.yaml'));
  const doc = read(BASELINE);
  assert.equal(doc.schema, 'starci/knowledge-source@1');
  assert.equal(doc.id, 'repository-baseline');
  const shapes = Object.fromEntries(doc.shapes.map(s => [s.id, s]));
  assert.deepEqual(Object.keys(shapes).sort(), ['common', 'nest', 'next']);
  assert.equal(shapes.nest.eslintKit, '@starci/eslint-canon-be');
  assert.equal(shapes.next.eslintKit, '@starci/eslint-canon-fe');
  assert.equal(shapes.nest.testRunner, 'jest');
  assert.equal(shapes.next.testRunner, 'vitest');
  assert.equal(shapes.common.typescript.strict, true);
  assert.deepEqual(shapes.common.ci.gates, ['lint', 'typecheck', 'test', 'build']);
  const ciRuns = shapes.common.ci.steps.filter(s => s.name).map(s => s.name);
  assert.deepEqual(ciRuns, shapes.common.ci.gates, 'every CI gate is a named step');
  for (const entry of ['.starciwork/runtime.sqlite*', 'config.yaml', '.env.*', '!.env.example']) {
    assert.ok(shapes.common.gitignore.includes(entry), `gitignore carries ${entry}`);
  }
  assert.ok(shapes.common.gitattributes.includes('* text=auto eol=lf'));
  assert.equal(shapes.common.editorconfig.end_of_line, 'lf');
  assert.ok(doc.provenance.observedReference.some(r => r.repository === 'nivo-backend'));
  assert.ok(doc.provenance.observedReference.some(r => r.repository === 'nivo-fe'));
});

test('baseline numbers live once: every <key.path> placeholder resolves inside the common shape or names a parameter', () => {
  const text = fs.readFileSync(path.join(ROOT, BASELINE), 'utf8');
  const doc = read(BASELINE);
  const common = doc.shapes.find(s => s.id === 'common');
  const placeholders = new Set(placeholdersIn(text));
  assert.ok(placeholders.size > 0);
  for (const key of placeholders) {
    if (Object.hasOwn(doc.parameters, key)) continue;
    const value = key.split('.').reduce((node, part) => node?.[part], common);
    assert.ok(value !== undefined && typeof value !== 'object', `<${key}> resolves to a scalar in shapes.common or a declared parameter`);
  }
  for (const key of Object.keys(doc.parameters)) assert.ok(placeholders.has(key), `parameter <${key}> is used`);
  assert.doesNotMatch(text, /--max-warnings=\d/, 'the warning budget is data, not a restated literal');
});

const SCAFFOLD_KEYS = {
  common: {
    scripts: ['lint', 'lint:check', 'typecheck', 'prepare'],
    devDependencies: ['typescript', '@types/node', 'eslint', '@eslint/js', 'typescript-eslint', 'globals', 'husky', 'lint-staged'],
  },
  nest: {
    scripts: ['build', 'start', 'start:dev', 'test', 'test:unit', 'test:ci', 'test:affected'],
    dependencies: ['@nestjs/common', '@nestjs/core', '@nestjs/platform-express', 'reflect-metadata', 'rxjs'],
    devDependencies: ['@nestjs/cli', '@nestjs/schematics', '@nestjs/testing', 'jest', 'ts-jest', '@types/jest', 'supertest', '@types/supertest'],
    files: ['tsconfig.json', 'tsconfig.build.json', 'nest-cli.json', 'jest.config.js', 'eslint.config.mjs', 'architecture.json'],
    compilerOptions: ['module', 'moduleResolution', 'target', 'experimentalDecorators', 'emitDecoratorMetadata', 'outDir', 'strict'],
  },
  next: {
    scripts: ['build', 'dev', 'start', 'test', 'test:unit', 'test:ci', 'test:affected'],
    dependencies: ['next', 'react', 'react-dom', '@starci/grammar'],
    devDependencies: ['@types/react', '@types/react-dom', 'tailwindcss', '@tailwindcss/postcss', 'vitest', '@vitest/coverage-v8', 'jsdom', '@testing-library/react', '@testing-library/jest-dom'],
    files: ['tsconfig.json', 'next.config.ts', 'postcss.config.mjs', 'vitest.config.ts', 'vitest.setup.ts', 'eslint.config.mjs', 'src/app/globals.css', 'architecture.json'],
    compilerOptions: ['module', 'moduleResolution', 'target', 'jsx', 'strict'],
  },
};
const MANIFEST_SOURCES = ['name', 'version', 'private', 'packageManager', 'engines', 'scripts', 'lint-staged', 'starci', 'dependencies', 'devDependencies'];

for (const profile of ['nest', 'next']) {
  test(`the ${profile} shape carries every key a scaffold needs to install, build, lint, typecheck and test`, () => {
    const shapes = Object.fromEntries(read(BASELINE).shapes.map(s => [s.id, s]));
    const { common } = shapes;
    const shape = shapes[profile];
    const want = SCAFFOLD_KEYS[profile];
    for (const key of ['packageManager', 'nodeMajor', 'lockfile', 'install']) assert.ok(common[key], `common.${key}`);
    assert.ok(common.engines.node, 'common.engines.node');
    for (const key of common.manifest.order) assert.ok(MANIFEST_SOURCES.includes(key), `manifest key ${key} has a source`);
    for (const key of ['name', 'version', 'private', 'lint-staged']) assert.notEqual(common.manifest[key], undefined, `common.manifest.${key}`);
    assert.deepEqual(Object.keys(common.hooks.files).sort(), ['.husky/pre-commit', '.husky/pre-push']);
    const merged = {
      scripts: { ...common.scripts, ...shape.scripts },
      dependencies: { ...shape.dependencies },
      devDependencies: { ...common.devDependencies, ...shape.devDependencies },
    };
    const required = {
      scripts: [...SCAFFOLD_KEYS.common.scripts, ...want.scripts],
      dependencies: want.dependencies,
      devDependencies: [...SCAFFOLD_KEYS.common.devDependencies, ...want.devDependencies, shape.eslintKit, ...shape.testDependencies],
    };
    for (const [section, names] of Object.entries(required)) {
      for (const name of names) assert.ok(typeof merged[section][name] === 'string' && merged[section][name], `${profile} ${section} carries ${name}`);
    }
    const pinned = [...Object.keys(common.devDependencies), ...Object.keys(shape.dependencies), ...Object.keys(shape.devDependencies)];
    assert.equal(new Set(pinned).size, pinned.length, 'each package is pinned once');
    const fill = text => text.replace(/<([a-zA-Z][\w.]*)>/g, 'x');
    for (const file of want.files) assert.equal(typeof shape.files[file], 'string', `${profile} files carries ${file}`);
    for (const [file, content] of Object.entries(shape.files)) {
      if (file.endsWith('.json')) assert.doesNotThrow(() => JSON.parse(fill(content)), `${file} is JSON`);
    }
    const { compilerOptions } = JSON.parse(fill(shape.files['tsconfig.json']));
    for (const key of want.compilerOptions) assert.notEqual(compilerOptions[key], undefined, `${profile} tsconfig sets ${key}`);
    assert.equal(compilerOptions.strict, common.typescript.strict, 'the baseline stays strict');
  });
}

for (const [op, profile] of [['backend.scaffold', 'nest'], ['interface.scaffold', 'next']]) {
  test(`${op} takes its toolchain from the baseline and needs a settled SDS only beyond it`, () => {
    const manifest = read(`modules/ops/ops/${op}.yaml`);
    const baseline = manifest.reads.find(r => r.id === 'baseline');
    assert.ok(baseline, 'baseline read declared');
    assert.match(baseline.path, /knowledge\/repository-baseline\.yaml/);
    assert.match(baseline.path, new RegExp(`\\b${profile}\\b`));
    assert.match(baseline.path, /CONTEXT\.md/);
    const citing = manifest.steps.filter(s => /knowledge\/repository-baseline\.yaml/.test(s.action.en));
    assert.equal(citing.length, 1, 'exactly one step writes the toolchain from the baseline');
    assert.ok(citing[0].reads.includes('baseline'));
    const proof = manifest.proofs.find(p => p.id === 'baseline-runs');
    assert.ok(proof, 'baseline-runs proof declared');
    assert.match(proof.requirement.en, /lint-staged/);
    assert.match(proof.requirement.en, /ci\.yml/);
    for (const pre of manifest.route.prerequisites) {
      assert.doesNotMatch(pre, /^architecture\.decide\b/, 'a baseline-only scaffold does not chain architecture.decide');
    }
    assert.ok(manifest.blockers.some(b => b.code === 'SDS_MISSING'), 'SDS-owned wiring without a settled SDS still blocks');
  });
}

test('the canon kit version has one owner: each shape cites the exact version code-patterns.yaml pins', () => {
  const shapes = Object.fromEntries(read(BASELINE).shapes.map(s => [s.id, s]));
  const patterns = read('modules/models/code-patterns.yaml');
  for (const profile of ['nest', 'next']) {
    const shape = shapes[profile];
    const cited = shape.devDependencies[shape.eslintKit];
    assert.match(cited, CITATION, `${profile} cites the canon version instead of restating it`);
    assert.equal(patterns.profiles[profile].canon.package, shape.eslintKit);
    assert.equal(resolveCitation(cited), patterns.profiles[profile].canon.version);
    assert.match(resolveCitation(cited), /^\d+\.\d+\.\d+$/, 'an exact version, since the gate pins its content digest');
  }
});

// End to end: materialise each shape exactly as a scaffold must, install it, and run every gate the
// scaffold proof runs - the runtime's own check-scoped-lint included - so a baseline edit cannot drift
// from the checker again. check-scoped-lint loads the target's own ESLint, canon kit and TypeScript, so
// it needs node_modules and minutes of install time, so it runs only when STARCI_E2E_BASELINE=1 (the
// release checklist in docs/releasing.md runs it before tagging), and then skips only when the npm
// registry is unreachable.
const E2E = process.env.STARCI_E2E_BASELINE === '1';
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const OFFLINE = /\b(?:ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENETUNREACH)\b/;
const registryResolves = () => dns.lookup('registry.npmjs.org').then(() => true, () => false);
const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer().once('error', reject).listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    server.close(() => resolve(port));
  });
});
// npm is a .cmd shim on Windows, which only a shell can start, so it gets one fixed command line;
// node itself never goes through a shell. Every argument here is a constant of this file or a temp path.
const WINDOWS = process.platform === 'win32';
const viaShell = (command, args) => (command === NPM && WINDOWS ? [[command, ...args].join(' '), [], true] : [command, args, false]);
const run = (cwd, command, args) => new Promise(resolve => {
  const [file, argv, shell] = viaShell(command, args);
  const child = spawn(file, argv, { cwd, shell, env: { ...process.env, HUSKY: '0', CI: 'true' } });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.on('error', error => resolve({ status: null, stdout, stderr: `${stderr}${error}` }));
  child.on('close', status => resolve({ status, stdout, stderr }));
});
const killTree = child => {
  if (WINDOWS) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } }
};
async function bootsAndAnswers(cwd, script) {
  const port = await freePort();
  const [file, argv, shell] = viaShell(NPM, ['run', script]);
  const child = spawn(file, argv, {
    cwd, shell, detached: !WINDOWS, stdio: 'ignore', env: { ...process.env, PORT: String(port) },
  });
  try {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/health/live`, { signal: AbortSignal.timeout(2000) });
        return { status: response.status, body: await response.json() };
      } catch { await new Promise(resolve => setTimeout(resolve, 500)); }
    }
    return { status: null, body: null };
  } finally { killTree(child); }
}

describe('each baseline shape materialises into a repository every gate accepts', { concurrency: 2 }, () => {
  for (const [profile, start] of [['nest', 'start:prod'], ['next', 'start']]) {
    it(`${profile}: install, check-scoped-lint, typecheck, lint, test, build and ${start} all pass`, { timeout: 900_000 }, async t => {
      if (!E2E) { t.skip('set STARCI_E2E_BASELINE=1 to materialise, install and run every gate on this shape'); return; }
      const offline = 'npm registry unreachable: the target-local toolchain cannot be installed';
      if (!await registryResolves()) { t.skip(offline); return; }
      const root = fs.mkdtempSync(path.join(os.tmpdir(), `sbl-${profile}-`));
      t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));
      writeProfile(root, profile, SAMPLE_PARAMETERS);
      const install = await run(root, NPM, ['install', '--no-audit', '--no-fund']);
      if (install.status !== 0 && OFFLINE.test(`${install.stdout}${install.stderr}`)) { t.skip(offline); return; }
      assert.equal(install.status, 0, `npm install\n${install.stdout}\n${install.stderr}`);
      const lint = await run(ROOT, process.execPath, ['scripts/checks/check-scoped-lint.mjs', '--profile', profile, '--root', root, '--architecture-config', 'architecture.json', '--all']);
      const report = JSON.parse(lint.stdout);
      assert.equal(lint.status, 0, `check-scoped-lint ${report.status}\n${JSON.stringify(report.issues, null, 1)}`);
      assert.equal(report.status, 'clean');
      for (const script of ['typecheck', 'lint:check', 'test:ci', 'build']) {
        const result = await run(root, NPM, ['run', script]);
        assert.equal(result.status, 0, `npm run ${script}\n${result.stdout}\n${result.stderr}`);
      }
      // The build wrote framework output the tsconfig includes (Next: .next/types/**); the gate still
      // reads only source (starci-next inc-2260b3754afa), so its verdict does not depend on gate order.
      const rebuilt = await run(ROOT, process.execPath, ['scripts/checks/check-scoped-lint.mjs', '--profile', profile, '--root', root, '--architecture-config', 'architecture.json', '--all']);
      const rebuiltReport = JSON.parse(rebuilt.stdout);
      assert.equal(rebuilt.status, 0, `check-scoped-lint after build ${rebuiltReport.status}\n${JSON.stringify(rebuiltReport.issues, null, 1)}`);
      const live = await bootsAndAnswers(root, start);
      assert.equal(live.status, 200, `${start} boots and GET /health/live answers`);
      assert.equal(live.body.status, 'ok');
    });
  }
});
