import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { checkArchitecture } from '../scripts/checks/architecture/index.mjs';

// nivo-fe: npm workspaces hoist @starci/grammar 0.4.11 to the root while apps/app, whose range is ^0.5.0,
// resolves its own apps/app/node_modules copy. The grammar contract read only the hoisted copy, so every
// correct import in apps/app resolved to a file outside the "expected" export targets. Each consumer is now
// judged against the copy Node resolves for it. One style entry stays the rule: a family sheet
// (core.css) @imports common.css itself, so no app imports two grammar sheets.
const ts = createRequire(import.meta.url)('typescript');

const grammarPackage = (version) => ({
  'package.json': JSON.stringify({ name: '@starci/grammar', version, peerDependencies: { react: '>=18', '@heroui/react': '>=2' },
    exports: { './common': { types: './dist/common/index.d.ts', import: './dist/common/index.js' }, './common.css': './dist/common/styles.css', './core.css': './dist/core/styles.css' } }),
  'dist/common/index.js': 'export const Button = () => null\n',
  'dist/common/index.d.ts': 'export declare const Button: () => null\n',
  'dist/common/styles.css': ':root{}\n',
  'dist/core/styles.css': '@import "../common/styles.css";\n',
});

const monorepo = (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-grammar-monorepo-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (relative, text) => { const file = path.join(root, ...relative.split('/')); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
  put('package.json', JSON.stringify({ private: true, workspaces: ['apps/*'] }));
  put('hfs.json', JSON.stringify({ hfs: 1, profile: 'fe', project: 'fixture', apps: [{ name: 'app', kind: 'next' }, { name: 'landing', kind: 'next' }] }));
  for (const [file, text] of Object.entries(grammarPackage('0.4.11'))) put(`node_modules/@starci/grammar/${file}`, text);
  for (const [file, text] of Object.entries(grammarPackage('0.5.0'))) put(`apps/app/node_modules/@starci/grammar/${file}`, text);
  for (const app of ['app', 'landing']) {
    put(`apps/${app}/package.json`, JSON.stringify({ name: `@m/${app}`, private: true, dependencies: { '@starci/grammar': app === 'app' ? '^0.5.0' : '0.4.11', react: '19.0.0', '@heroui/react': '2.0.0' } }));
    put(`apps/${app}/tsconfig.json`, JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'preserve', skipLibCheck: true, noEmit: true }, include: ['src/**/*'] }));
    put(`apps/${app}/src/app/globals.css`, '@import "@starci/grammar/common.css";\n');
    put(`apps/${app}/src/app/page.tsx`, 'import { Button } from "@starci/grammar/common"; export default function Route(){ return <Button/> }\n');
  }
  // The Grammar contract is derived from hfs.json: @starci/grammar, every app's globals.css, every app manifest as consumer.
  return { root, put, check: () => checkArchitecture({ repositoryRoot: root, injectedTypeScript: ts }) };
};

const grammarViolations = (result) => result.violations.filter((item) => /^ARCH_GRAMMAR_/.test(item.ruleId));

test('each workspace consumer is checked against the grammar copy it resolves, hoisted or nested', (t) => {
  const m = monorepo(t);
  // A local `export { x }` has no module specifier; the grammar import scan crashed on it (TypeError) in nivo-fe.
  m.put('apps/landing/src/app/local.ts', 'const label = "x"\nexport { label }\n');
  const result = m.check();
  assert.deepEqual(result.errors, []);
  assert.deepEqual(grammarViolations(result), [], JSON.stringify(result.violations, null, 1));
  assert.equal(result.coverage.grammarContract.status, 'checked');
});

test('a nested copy that lacks the selected export is refused and named', (t) => {
  const m = monorepo(t);
  const nested = grammarPackage('0.5.0');
  const manifest = JSON.parse(nested['package.json']);
  delete manifest.exports['./common.css'];
  m.put('apps/app/node_modules/@starci/grammar/package.json', JSON.stringify(manifest));
  const invalid = grammarViolations(m.check()).find((item) => item.ruleId === 'ARCH_GRAMMAR_CONTRACT_INVALID');
  assert.ok(invalid, 'refused');
  assert.match(invalid.message, /common\.css is not a safe declared style export \(as apps\/app\/package\.json resolves it, apps\/app\/node_modules\/@fixture\/grammar\)/);
});

test('one style entry per app: importing the family sheet beside common.css is a bypass, since core.css imports common itself', (t) => {
  const m = monorepo(t);
  m.put('apps/landing/src/app/globals.css', '@import "@starci/grammar/common.css";\n@import "@starci/grammar/core.css";\n');
  const bypass = grammarViolations(m.check()).filter((item) => item.ruleId === 'ARCH_GRAMMAR_EXPORT_BYPASS');
  assert.deepEqual(bypass.map((item) => [item.path, item.specifier]), [['apps/landing/src/app/globals.css', '@starci/grammar/core.css']]);
});
