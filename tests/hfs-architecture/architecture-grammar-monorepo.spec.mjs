import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { checkArchitecture } from '../../scripts/hfs/architecture/index.mjs';

// nivo-fe: npm workspaces hoisted @starci/grammar 0.4.11 to the root while a workspace whose range was ^0.5.0 resolved its own
// nested copy. The grammar contract read only the hoisted copy, so every correct import of that workspace resolved to a file
// outside the "expected" export targets. Each consumer is now judged against the copy Node resolves for it. In an app the one
// package.json at the app root is the consumer of the fe apps (they have no package.json) and resolves the hoisted copy; a
// workspace package under fe/packages/* is a consumer that may resolve a nested one. One style entry stays the rule: a family
// sheet (core.css) @imports common.css itself, so no app imports two grammar sheets.
const ts = createRequire(import.meta.url)('typescript');

const grammarPackage = (version) => ({
  'package.json': JSON.stringify({ name: '@starci/grammar', version, peerDependencies: { react: '>=18', '@heroui/react': '>=2' },
    exports: { './common': { types: './dist/common/index.d.ts', import: './dist/common/index.js' }, './common.css': './dist/common/styles.css', './core.css': './dist/core/styles.css' } }),
  'dist/common/index.js': 'export const Button = () => null\n',
  'dist/common/index.d.ts': 'export declare const Button: () => null\n',
  'dist/common/styles.css': ':root{}\n',
  'dist/core/styles.css': '@import "../common/styles.css";\n',
});

const PEERS = { react: '19.0.0', '@heroui/react': '2.0.0' };
const TSCONFIG = JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'preserve', skipLibCheck: true, noEmit: true }, include: ['src/**/*'] });

const monorepo = (t) => {
  const app = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-grammar-monorepo-'));
  t.after(() => fs.rmSync(app, { recursive: true, force: true }));
  const root = path.join(app, 'fe');
  const put = (relative, text) => { const file = path.join(root, ...relative.split('/')); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
  put('../package.json', JSON.stringify({ private: true, workspaces: ['fe/packages/*'], dependencies: { '@starci/grammar': '0.4.11', ...PEERS } }));
  put('../hfs.json', JSON.stringify({ hfs: 2, kind: 'app', project: 'fixture', sides: {
    be: { apps: [{ name: 'core', kind: 'api' }] },
    fe: { apps: [{ name: 'app', kind: 'next' }, { name: 'landing', kind: 'next' }], optionalSlots: ['fe.package.ui'] },
  } }));
  put('tsconfig.json', JSON.stringify({ ...JSON.parse(TSCONFIG), include: ['apps/*/src/**/*'] }));
  for (const [file, text] of Object.entries(grammarPackage('0.4.11'))) put(`../node_modules/@starci/grammar/${file}`, text);
  put('packages/demo-ui/package.json', JSON.stringify({ name: '@m/demo-ui', private: true, dependencies: { '@starci/grammar': '^0.5.0', ...PEERS } }));
  put('packages/demo-ui/tsconfig.json', TSCONFIG);
  put('packages/demo-ui/src/index.ts', 'export { Button } from "@starci/grammar/common"\n');
  for (const [file, text] of Object.entries(grammarPackage('0.5.0'))) put(`packages/demo-ui/node_modules/@starci/grammar/${file}`, text);
  for (const name of ['app', 'landing']) {
    put(`apps/${name}/tsconfig.json`, TSCONFIG);
    put(`apps/${name}/src/app/globals.css`, '@import "@starci/grammar/common.css";\n');
    put(`apps/${name}/src/app/page.tsx`, 'import { Button } from "@starci/grammar/common"; export default function Route(){ return <Button/> }\n');
  }
  // The Grammar contract is derived from hfs.json: @starci/grammar, every app's globals.css, the app package.json and every
  // workspace package that declares the grammar as consumers.
  return { root, put, check: () => checkArchitecture({ repositoryRoot: root, injectedTypeScript: ts }) };
};

const grammarViolations = (result) => result.violations.filter((item) => /^ARCH_GRAMMAR_/.test(item.ruleId));

test('each consumer (the app package.json, a workspace package) is checked against the grammar copy it resolves, hoisted or nested', (t) => {
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
  m.put('packages/demo-ui/node_modules/@starci/grammar/package.json', JSON.stringify(manifest));
  const invalid = grammarViolations(m.check()).find((item) => item.ruleId === 'ARCH_GRAMMAR_CONTRACT_INVALID');
  assert.ok(invalid, 'refused');
  assert.match(invalid.message, /common\.css is not a safe declared style export \(as packages\/demo-ui\/package\.json resolves it, packages\/demo-ui\/node_modules\/@starci\/grammar\)/);
});

test('one style entry per app: importing the family sheet beside common.css is a bypass, since core.css imports common itself', (t) => {
  const m = monorepo(t);
  m.put('apps/landing/src/app/globals.css', '@import "@starci/grammar/common.css";\n@import "@starci/grammar/core.css";\n');
  const bypass = grammarViolations(m.check()).filter((item) => item.ruleId === 'ARCH_GRAMMAR_EXPORT_BYPASS');
  assert.deepEqual(bypass.map((item) => [item.path, item.specifier]), [['apps/landing/src/app/globals.css', '@starci/grammar/core.css']]);
});
