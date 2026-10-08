import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { checkSonarRules } from '../../scripts/checks/check-sonar-rules.mjs';
import { lintSources } from '../../scripts/gates/sonar-rules-engine.mjs';
import { analysedExampleFile, exampleFiles, exampleScopes } from '../../scripts/gates/sonar-rules-scope.mjs';
import { NOT_COVERED, RULES, TS_RULES } from '../../scripts/gates/sonar-rules-table.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const ROOT = new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

// One minimal TypeScript fixture per rule of the example table: the code SonarCloud flagged in an example, and the fixed form (which must be quiet).
const FIXTURES = Object.freeze({
  S9382: ['export async function f(list: Array<string>, g: (x: string) => Promise<void>) { for (const x of list) { await g(x) } }\n', 'export async function f(list: Array<string>, g: (x: string) => Promise<void>) { await Promise.all(list.map((x) => g(x))) }\n'],
  S7758: ['export const f = (c: string) => c.charCodeAt(0)\n', 'export const f = (c: string) => c.codePointAt(0)\n'],
  S7780: ["export const f = '\\\\d+'\n", 'export const f = String.raw`\\d+`\n'],
  S3358: ['export const f = (a: boolean, b: boolean) => (a ? 1 : b ? 2 : 3)\n', 'export const f = (a: boolean, b: boolean) => { if (a) return 1; return b ? 2 : 3 }\n'],
  S3735: ['export const f = (p: object) => { void p }\n', 'export const f = (g: () => Promise<void>) => { void g() }\n'],
  S1128: ["import { Order } from './order'\nexport const f = 1\n", 'export const f = 1\n'],
  S7763: ["import { meta } from './page'\nexport const generateMetadata = meta\n", "export { meta as generateMetadata } from './page'\n"],
  S6767: ["type Props = { readonly state: 'list'; readonly title: string }\nexport const Block = (props: Props) => <h1>{props.title}</h1>\n", 'type Props = { readonly title: string }\nexport const Block = (props: Props) => <h1>{props.title}</h1>\n'],
  S8786: ['export const re = /^[^@]+@[^@]+.[^@]+$/\n', 'export const re = /^[^@]+@[^@]+$/\n'],
});

const found = async (source, file = 'examples/app/fe/src/fixture.tsx') => (await lintSources(ROOT, [{ file, source }])).map((finding) => finding.rule);

test('every rule of the example table has a fixture, and no fixture names a rule the table lacks', () => {
  assert.deepEqual(Object.keys(FIXTURES).sort(), TS_RULES.map((entry) => entry.sonar).sort());
});

for (const entry of TS_RULES) {
  test(`${entry.sonar} (${entry.rule}) fires on the TypeScript it flagged and stays quiet on the fixed form`, async () => {
    const [bad, good] = FIXTURES[entry.sonar];
    assert.ok((await found(bad)).includes(entry.sonar), `${entry.sonar} must fire on:\n${bad}`);
    assert.deepEqual(await found(good), [], `the fixed form of ${entry.sonar} must be clean:\n${good}`);
  });
}

test('the example table is not a copy of the runtime table, and the ids it cannot judge are listed with the reason', () => {
  const mapped = new Set(TS_RULES.map((entry) => entry.sonar));
  for (const id of ['S1874', 'S6551', 'S7503']) {
    const entry = NOT_COVERED.find((candidate) => candidate.sonar === id);
    assert.match(entry?.reason ?? '', /type checker/, id);
    assert.ok(!mapped.has(id) && !RULES.some((rule) => rule.sonar === id), `${id} is both mapped and not covered`);
  }
});

test('a spec, an end-to-end spec and an import of a Next matcher are outside the example rules', async () => {
  const loop = 'export async function f(list: Array<string>, g: (x: string) => Promise<void>) { for (const x of list) { await g(x) } }\n';
  assert.deepEqual(await found(loop, 'examples/app/be/src/a.spec.ts'), []);
  assert.deepEqual(await found(loop, 'examples/app/be/src/a.e2e-spec.ts'), []);
  assert.ok((await found(loop, 'examples/app/be/src/a.contract-spec.ts')).includes('S9382'));
  assert.deepEqual(await found("export const config = { matcher: ['/((?!api|.*\\\\..*).*)'] }\n", 'examples/app/fe/src/proxy.ts'), []);
});

const put = (root, relative, text = '') => {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};

const withExample = (t, files) => {
  const root = mkdtemp(t, 'starci-sonar-examples-');
  put(root, 'sonar-project.properties', 'sonar.sources=src\nsonar.inclusions=**/*.mjs\n');
  put(root, 'examples/app/sonar-project.properties', 'sonar.sources=be/src,fe/apps\nsonar.exclusions=**/*.spec.ts,**/.next/**\n');
  for (const [file, text] of Object.entries(files)) put(root, file, text);
  return root;
};

test('the example scope is read from the example\'s own sonar-project.properties: its TypeScript only, sorted', (t) => {
  const root = withExample(t, {
    'examples/app/be/src/b.ts': 'export const b = 1\n',
    'examples/app/be/src/a.ts': 'export const a = 1\n',
    'examples/app/be/src/a.spec.ts': 'export const s = 1\n',
    'examples/app/be/src/readme.md': 'text\n',
    'examples/app/fe/apps/web/src/page.tsx': 'export const p = 1\n',
    'examples/app/fe/apps/web/.next/x.ts': 'export const n = 1\n',
    'examples/app/fe/apps/web/node_modules/m/i.ts': 'export const m = 1\n',
    'examples/app/other/c.ts': 'export const c = 1\n',
    'examples/no-sonar/be/src/d.ts': 'export const d = 1\n',
  });
  const examples = exampleScopes(root);
  assert.deepEqual(examples.map((example) => example.dir), ['examples/app']);
  const files = exampleFiles(root, examples);
  assert.deepEqual(files, ['examples/app/be/src/a.ts', 'examples/app/be/src/b.ts', 'examples/app/fe/apps/web/src/page.tsx']);
  for (const file of files) assert.ok(analysedExampleFile(file, examples), file);
  for (const file of ['examples/app/be/src/a.spec.ts', 'examples/app/other/c.ts', 'examples/no-sonar/be/src/d.ts', 'examples/app/be/src/readme.md']) assert.ok(!analysedExampleFile(file, examples), file);
});

test('the check judges an example\'s TypeScript with the example table and names the file under examples/', async (t) => {
  const root = withExample(t, {
    'examples/app/be/src/a.ts': 'export async function f(list: Array<string>, g: (x: string) => Promise<void>) { for (const x of list) { await g(x) } }\n',
    'examples/app/be/src/ok.ts': 'export const ok = 1\n',
  });
  const result = await checkSonarRules({ root });
  assert.equal(result.ok, false);
  assert.deepEqual(result.findings.map((finding) => finding.code), ['S9382']);
  assert.match(result.findings[0].message, /^examples\/app\/be\/src\/a\.ts:1 /);
  assert.equal(result.checked, 2);
});
