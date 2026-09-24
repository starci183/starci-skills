import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { checkArchitecture } from '../scripts/checks/architecture/index.mjs';
import { isGeneratedPath, isToolingModule } from '../scripts/checks/architecture/typescript.mjs';
import { checkScopedLint } from '../scripts/checks/check-scoped-lint.mjs';

// starci-next inc-2260b3754afa: after `next build`, the baseline tsconfig's `.next/types/**/*.ts` include
// pulled generated, gitignored output into the gate, so the same tree was clean before a build and
// unavailable after it. nivo inc-ffe60c49f502: a monorepo app tsconfig including `**/*.ts` pulled .next output
// and next.config.ts/vitest.config.ts in too, the next-intl `import(\`../messages/${locale}.json\`)` stayed
// unproven, an explicit-file run turned every file it was not asked about into an unavailable
// REQUIRED_RULE_FILE_UNCONFIGURED, and a missing project contract was repeated once per file.
const require = createRequire(import.meta.url);
const ts = require('typescript');

const project = (t, files) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-generated-output-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (relative, text) => { const file = path.join(root, ...relative.split('/')); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
  put('package.json', '{"private":true}\n');
  put('architecture.json', `${JSON.stringify({ schema: 'starci/architecture-config@1', kinds: ['frontend'], tsconfig: 'tsconfig.json' })}\n`);
  put('tsconfig.json', `${JSON.stringify({
    compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'preserve', resolveJsonModule: true, skipLibCheck: true, noEmit: true, baseUrl: '.', paths: { '@/*': ['src/*'] } },
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts', '.next/dev/types/**/*.ts'],
  })}\n`);
  for (const [relative, text] of Object.entries(files)) put(relative, text);
  return root;
};

test('generated build output is never source; a tooling module is one only beside a package manifest', (t) => {
  const root = path.resolve('/repo');
  assert.equal(isGeneratedPath(root, path.join(root, '.next', 'types', 'validator.ts')), true);
  assert.equal(isGeneratedPath(root, path.join(root, 'apps', 'app', '.next', 'dev', 'types', 'routes.d.ts')), true);
  assert.equal(isGeneratedPath(root, path.join(root, '.turbo', 'x.ts')), true);
  assert.equal(isGeneratedPath(root, path.join(root, 'src', 'app', 'page.tsx')), false);
  const repo = project(t, { 'next.config.ts': 'export default {}\n', 'src/config/database.config.ts': 'export const db = 1\n' });
  assert.equal(isToolingModule(path.join(repo, 'next.config.ts')), true);
  assert.equal(isToolingModule(path.join(repo, 'src', 'config', 'database.config.ts')), false, 'no manifest beside it');
});

test('the architecture program keeps .next output out of its source coverage', (t) => {
  const root = project(t, {
    'next.config.ts': 'const config = {}; export default config\n',
    'vitest.config.ts': 'export default {}\n',
    'src/app/page.tsx': 'const Page = () => null; export default Page\n',
    'src/config/app.config.ts': 'export const appConfig = { name: "x" }\n',
    '.next/types/validator.ts': 'export type Check = true\n',
    '.next/dev/types/routes.ts': 'export type Routes = "/"\n',
  });
  const result = checkArchitecture({ repositoryRoot: root, configFile: 'architecture.json', injectedTypeScript: ts });
  const files = result.coverage?.sourceFiles ?? [];
  assert.ok(files.includes('src/app/page.tsx'), JSON.stringify(result.errors));
  assert.ok(files.includes('src/config/app.config.ts'), 'a config module inside the source tree is still source');
  assert.deepEqual(files.filter((file) => file.startsWith('.next/')), []);
});

test('a template import of JSON catalogs is the bundler context of that directory, not an unproven dependency', (t) => {
  const root = project(t, {
    'src/messages/en.json': '{"nav":{"home":"Home"}}\n',
    'src/messages/vi.json': '{"nav":{"home":"Trang chu"}}\n',
    'src/i18n/request.ts': 'export const messagesFor = async (locale: string) => (await import(`../messages/${locale}.json`)).default\n',
    'src/i18n/unproven.ts': 'export const load = async (name: string) => import(`../features/${name}`)\n',
    'src/i18n/escape.ts': 'export const load = async (name: string) => import(`../messages/${name}/../../secret.json`)\n',
  });
  const result = checkArchitecture({ repositoryRoot: root, configFile: 'architecture.json', injectedTypeScript: ts });
  const unproven = result.errors.filter((error) => error.ruleId === 'ARCH_DYNAMIC_DEPENDENCY_UNPROVEN').map((error) => error.path).sort();
  assert.deepEqual(unproven, ['src/i18n/escape.ts', 'src/i18n/unproven.ts'], 'a code context or a head that escapes stays unproven');
});

const lintFixture = (t, { ignored = [], architectureFiles = null } = {}) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-scoped-unrequested-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const file of ['src/a.ts', 'src/b.ts', 'src/c.ts']) { fs.mkdirSync(path.join(root, 'src'), { recursive: true }); fs.writeFileSync(path.join(root, file), 'export const x = 1\n'); }
  const digest = 'a'.repeat(64);
  const profileCatalog = { schema: 'starci/code-pattern-profile@1', profiles: { next: {
    canon: { package: '@starci/eslint-canon-fe', version: '1.0.0', contentDigest: { algorithm: 'sha256', include: ['**/*.mjs'], exclude: [], framing: 'sorted-posix-relative-path-null-raw-bytes-null', value: digest, files: 1 } },
    expectedSourceRuleIds: ['FE-1'], sourceGlobs: ['src/**/*.ts'], inputGlobs: [],
    obligations: [{ id: 'TYPES', sourceRuleIds: ['FE-1'], applicability: { include: ['**/*.ts'] }, status: 'implemented',
      mechanical: { requirement: 'x', check: { kind: 'eslint', ruleIds: ['no-var'], expected: { severity: 'error' } } } },
    ...(architectureFiles ? [{ id: 'LAYOUT', sourceRuleIds: ['FE-1'], applicability: { include: ['**/*.ts'] }, status: 'implemented',
      mechanical: { requirement: 'x', check: { kind: 'architecture', ruleIds: ['FE_LAYOUT'] } } }] : [])],
    semanticOnly: [],
  } } };
  const runtime = { package: { name: '@starci/eslint-canon-fe', version: '1.0.0', digest, files: 1 }, canon: { rules: {}, recommended: {} }, builtinRules: new Map([['no-var', { meta: {} }]]), typescriptRules: {}, eslintVersion: 'fixture', eslint: {
    isPathIgnored: async (file) => ignored.some((name) => file.endsWith(name)),
    calculateConfigForFile: async () => ({ linterOptions: { noInlineConfig: true }, rules: { 'no-var': [2] }, plugins: {} }),
    lintFiles: async (files) => { runtime.linted = files; return files.map((filePath) => ({ filePath, messages: [], suppressedMessages: [], errorCount: 0, warningCount: 0, fatalErrorCount: 0 })); },
  } };
  const architecture = () => ({ schema: 'starci/architecture-check@1', ok: true, kinds: ['frontend'], files: architectureFiles.length, violations: [], errors: [],
    coverage: { sourceFiles: [...architectureFiles], checkedRuleIds: ['FE_LAYOUT'] } });
  return { root, runtime, options: { profile: 'next', profileCatalog, runtime, architecture: architectureFiles ? architecture : () => null } };
};

test('neither generated output nor a root tooling module the architecture program read becomes a canon lint subject', async (t) => {
  const f = lintFixture(t, { architectureFiles: ['.next/types/validator.ts', 'next.config.ts', 'src/a.ts', 'src/b.ts', 'src/c.ts'] });
  fs.writeFileSync(path.join(f.root, 'package.json'), '{"private":true}');
  fs.writeFileSync(path.join(f.root, 'next.config.ts'), 'export default {}\n');
  fs.mkdirSync(path.join(f.root, '.next', 'types'), { recursive: true });
  fs.writeFileSync(path.join(f.root, '.next', 'types', 'validator.ts'), 'export type Check = true\n');
  const report = await checkScopedLint(f.root, [], { ...f.options, all: true });
  assert.equal(report.status, 'clean', JSON.stringify(report.issues));
  assert.deepEqual(report.coverage.expectedFiles, ['src/a.ts', 'src/b.ts', 'src/c.ts']);
});

test('an explicit-file run reports the files it was not asked about as unchecked findings, not unavailable', async (t) => {
  const f = lintFixture(t);
  const report = await checkScopedLint(f.root, ['src/a.ts'], f.options);
  assert.equal(report.status, 'findings', JSON.stringify(report.issues));
  assert.deepEqual(report.issues.map((issue) => issue.code).sort(), ['SOURCE_FILE_UNCHECKED', 'SOURCE_FILE_UNCHECKED']);
  const all = await checkScopedLint(f.root, [], { ...f.options, all: true });
  assert.equal(all.status, 'clean', JSON.stringify(all.issues));
});

test('an ESLint-ignored subject is one FILE_IGNORED finding and is never linted into a second issue', async (t) => {
  const f = lintFixture(t, { ignored: ['c.ts'] });
  const report = await checkScopedLint(f.root, [], { ...f.options, all: true });
  assert.equal(report.status, 'findings', JSON.stringify(report.issues));
  assert.deepEqual(report.issues.map((issue) => issue.code), ['FILE_IGNORED']);
  assert.equal(f.runtime.linted.some((file) => file.endsWith('c.ts')), false);
});

test('a repository with no Next project contract reports it once, not once per selected file', async (t) => {
  const { checkNextPatterns } = await import('../scripts/checks/code-patterns/next.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-next-no-projects-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
  fs.symlinkSync(path.dirname(require.resolve('typescript/package.json')), path.join(root, 'node_modules/typescript'), 'junction');
  fs.writeFileSync(path.join(root, 'package.json'), '{"private":true}');
  fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, jsx: 'preserve' }, include: ['**/*.ts', '**/*.tsx'] }));
  const files = ['src/a.tsx', 'src/b.tsx', 'src/c.tsx'];
  for (const file of files) { fs.mkdirSync(path.join(root, 'src'), { recursive: true }); fs.writeFileSync(path.join(root, file), 'export const A = () => null\n'); }
  const result = checkNextPatterns({ root, files, ruleIds: ['FE_SOURCE_NAME_SHAPE'], contextFiles: ['package.json'] });
  assert.equal(result.errors.filter((error) => /needs canonical architectureProjects/.test(error.message)).length, 1, JSON.stringify(result.errors));
  assert.equal(result.errors.filter((error) => /belongs to no declared TypeScript project/.test(error.message)).length, 0);
});
