import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { checkNextPatterns, NEXT_SCRIPT_RULES } from '../checks/code-patterns/next.mjs';

const require = createRequire(import.meta.url);
function fixture(t, sources) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-next-pattern-'));
  fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
  fs.symlinkSync(path.dirname(require.resolve('typescript/package.json')), path.join(root, 'node_modules/typescript'), 'junction');
  fs.writeFileSync(path.join(root, 'package.json'), '{"private":true}');
  for (const [relative, source] of Object.entries(sources)) {
    const file = path.join(root, ...relative.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, source);
  }
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, files: Object.keys(sources).sort() };
}

test('readonly props checks direct, nested, collection and tuple syntax without inventing domain state', t => {
  const context = fixture(t, {
    'src/components/Card.tsx': `export type GoodProps = {
  readonly label: string
  readonly nested: { readonly id: string }
  readonly rows: ReadonlyArray<{ readonly id: string }>
  readonly key: readonly [string, string]
}
export interface BadProps {
  label: string
  readonly nested: { id: string }
  readonly rows: Array<string>
  readonly key: [string, string]
}
export const Card = (_props: GoodProps) => null
`,
  });
  const result = checkNextPatterns({ ...context, ruleIds: ['FE_READONLY_PROPS_CONTRACT'] });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.checkedRuleIds, ['FE_READONLY_PROPS_CONTRACT']);
  assert.equal(result.violations.length, 4, JSON.stringify(result, null, 2));
});

test('readonly props fails unavailable for inherited or opaque top-level aliases', t => {
  const context = fixture(t, {
    'src/components/Card.tsx': `type ExternalProps = { mutable: string }
export interface InheritedProps extends ExternalProps { readonly label: string }
export type AliasProps = ExternalProps
`,
  });
  const result = checkNextPatterns({ ...context, ruleIds: ['FE_READONLY_PROPS_CONTRACT'] });
  assert.equal(result.errors.length, 2, JSON.stringify(result, null, 2));
  assert.deepEqual(result.checkedRuleIds, []);
});

test('readonly props refuses nested referenced shapes and a shadowed Readonly alias', t => {
  const context = fixture(t, {
    'src/components/shapes.ts': 'export type MutableShape = { value: string }\n',
    'src/components/Card.tsx': `import type { MutableShape } from "./shapes"
type Readonly<T> = T
export type CardProps = { readonly row: MutableShape }
export type ShadowProps = Readonly<{ value: string }>
`,
  });
  const result = checkNextPatterns({ ...context, ruleIds: ['FE_READONLY_PROPS_CONTRACT'] });
  assert.equal(result.errors.length, 2, JSON.stringify(result, null, 2));
  assert.ok(result.errors.some(item => /MutableShape/.test(item.message)));
  assert.ok(result.errors.some(item => /Readonly/.test(item.message)));
});

test('readonly props refuses computed nested shapes and checks named tuple members', t => {
  const context = fixture(t, {
    'src/components/Card.tsx': `export type ComputedProps<T> = { readonly row: { [K in keyof T]: T[K] } }
export type TupleProps = { readonly rows: readonly [row: { value: string }] }
`,
  });
  const result = checkNextPatterns({ ...context, ruleIds: ['FE_READONLY_PROPS_CONTRACT'] });
  assert.ok(result.errors.some(item => /computed props shape/.test(item.message)), JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => /inline nested field/.test(item.message)), JSON.stringify(result, null, 2));
});

test('source names enforce hook basename, module kebab-case and syntactically frozen constants', t => {
  const context = fixture(t, {
    'src/hooks/wrong.ts': 'export const useSession = () => null\n',
    'src/modules/query/BadModule.ts': 'export const badInventory = ["a"] as const\nexport const queryClassNames = {} as const\n',
    'src/components/Card.tsx': 'export const Card = () => null\n',
  });
  const result = checkNextPatterns({ ...context, ruleIds: ['FE_SOURCE_NAME_SHAPE'] });
  assert.deepEqual(result.errors, []);
  assert.equal(result.violations.length, 3, JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => /useSession/.test(item.message)));
  assert.ok(result.violations.some(item => /kebab-case/.test(item.message)));
  assert.ok(result.violations.some(item => /UPPER_SNAKE/.test(item.message)));
});

test('hook role naming overrides generic module kebab naming', t => {
  const context = fixture(t, { 'src/modules/session/useSession.ts': 'export const useSession = () => null\n' });
  const result = checkNextPatterns({ ...context, ruleIds: ['FE_SOURCE_NAME_SHAPE'] });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.violations, []);
});

test('source names preserve fixed Next config and route export contracts', t => {
  const context = fixture(t, {
    'next.config.ts': 'const nextConfig = {} as const\nexport default nextConfig\n',
    'src/app/layout.tsx': 'export const viewport = {} as const\nexport default function Layout(){return null}\n',
  });
  const result = checkNextPatterns({ ...context, ruleIds: ['FE_SOURCE_NAME_SHAPE'] });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.violations, []);
});

test('spec subject and describe check exact collocation and exported subject identity', t => {
  const context = fixture(t, {
    'src/components/Card.tsx': 'export const Card = () => null\n',
    'src/components/Card.spec.tsx': 'describe("Wrong", () => { it("renders", () => {}) })\n',
  });
  const bad = checkNextPatterns({ ...context, ruleIds: ['FE_SPEC_SUBJECT_AND_DESCRIBE'] });
  assert.deepEqual(bad.errors, []);
  assert.equal(bad.violations.length, 1);
  fs.writeFileSync(path.join(context.root, 'src/components/Card.spec.tsx'), 'describe("Card", () => { it("renders", () => {}) })\n');
  const good = checkNextPatterns({ ...context, ruleIds: ['FE_SPEC_SUBJECT_AND_DESCRIBE'] });
  assert.deepEqual(good.errors, []);
  assert.deepEqual(good.violations, []);
});

test('spec subject recognizes Vitest describe aliases and rejects a same-spelling local helper', t => {
  const context = fixture(t, {
    'src/components/Card.tsx': 'export const Card = () => null\n',
    'src/components/Card.spec.tsx': 'import { describe as suite } from "vitest"; suite("Card", () => {})\n',
  });
  let result = checkNextPatterns({ ...context, ruleIds: ['FE_SPEC_SUBJECT_AND_DESCRIBE'] });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.violations, []);
  fs.writeFileSync(path.join(context.root, 'src/components/Card.spec.tsx'), 'const describe=(..._args: unknown[])=>undefined; describe("Card", () => {})\n');
  result = checkNextPatterns({ ...context, ruleIds: ['FE_SPEC_SUBJECT_AND_DESCRIBE'] });
  assert.equal(result.violations.length, 1, JSON.stringify(result, null, 2));
  assert.match(result.violations[0].message, /top-level describe/);
});

test('spec subject recognizes Vitest namespace describe bindings', t => {
  const context = fixture(t, {
    'src/components/Card.tsx': 'export const Card = () => null\n',
    'src/components/Card.spec.tsx': 'import * as vitest from "vitest"; vitest.describe("Card", () => {})\n',
  });
  const result = checkNextPatterns({ ...context, ruleIds: ['FE_SPEC_SUBJECT_AND_DESCRIBE'] });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.violations, []);
});

test('spec subject coverage fails unavailable when the subject is outside the exact selected files', t => {
  const context = fixture(t, {
    'src/components/Card.tsx': 'export const Card = () => null\n',
    'src/components/Card.spec.tsx': 'describe("Card", () => {})\n',
  });
  const result = checkNextPatterns({ root: context.root, files: ['src/components/Card.spec.tsx'], ruleIds: ['FE_SPEC_SUBJECT_AND_DESCRIBE'] });
  assert.ok(result.errors.some(item => /exact checked file set/.test(item.message)), JSON.stringify(result, null, 2));
  assert.deepEqual(result.checkedRuleIds, []);
});

test('snapshot rule follows aliased expect matcher chains, computed literals and inline error snapshots', t => {
  const context = fixture(t, {
    'src/components/Card.tsx': 'export const Card = () => null\n',
    'src/components/Card.spec.tsx': `import { expect as verify } from "vitest"
describe("Card", () => {
  it("renders", () => {
    verify({})["toMatchInlineSnapshot"]()
    verify(() => {}).toThrowErrorMatchingInlineSnapshot()
    recorder.toMatchSnapshot()
  })
})
`,
  });
  const result = checkNextPatterns({ ...context, ruleIds: ['FE_SPEC_NO_SNAPSHOT'] });
  assert.deepEqual(result.errors, []);
  assert.equal(result.violations.length, 2, JSON.stringify(result, null, 2));
});

test('snapshot coverage fails unavailable for a dynamic expect matcher', t => {
  const context = fixture(t, {
    'src/components/Card.tsx': 'export const Card = () => null\n',
    'src/components/Card.spec.tsx': 'const matcher = "toMatchSnapshot"; describe("Card",()=>{ expect({})[matcher]() })\n',
  });
  const result = checkNextPatterns({ ...context, ruleIds: ['FE_SPEC_NO_SNAPSHOT'] });
  assert.ok(result.errors.some(item => /computed expect matcher/.test(item.message)), JSON.stringify(result, null, 2));
});

test('snapshot rule ignores a local same-spelling expect helper', t => {
  const context = fixture(t, {
    'src/components/Card.tsx': 'export const Card = () => null\n',
    'src/components/Card.spec.tsx': 'const expect=(value:unknown)=>value as {toMatchSnapshot:()=>void}; describe("Card",()=>{ expect({}).toMatchSnapshot() })\n',
  });
  const result = checkNextPatterns({ ...context, ruleIds: ['FE_SPEC_NO_SNAPSHOT'] });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.violations, []);
});

test('semantic-role rules fail unavailable instead of being relabeled clean', t => {
  const context = fixture(t, { 'src/value.ts': 'export const value = 1\n' });
  const ruleIds = ['FE_RETURN_TYPE_PROFILE', 'FE_CLOSED_VOCABULARY_SHAPE'];
  const result = checkNextPatterns({ ...context, ruleIds });
  assert.deepEqual(result.checkedRuleIds, []);
  assert.deepEqual(new Set(result.errors.map(item => item.ruleId)), new Set(ruleIds));
  assert.ok(result.errors.every(item => item.code === 'FE_PATTERN_CONTRACT_REQUIRED'));
});

test('adapter rejects malformed, missing, redirected, duplicate and unsupported input', t => {
  const context = fixture(t, { 'src/value.ts': 'export const value = 1\n' });
  assert.ok(checkNextPatterns({ ...context, files: ['src/value.ts', 'src/value.ts'], ruleIds: ['FE_SOURCE_NAME_SHAPE'] }).errors.length);
  assert.ok(checkNextPatterns({ ...context, files: ['src/missing.ts'], ruleIds: ['FE_SOURCE_NAME_SHAPE'] }).errors.length);
  assert.ok(checkNextPatterns({ ...context, files: ['../value.ts'], ruleIds: ['FE_SOURCE_NAME_SHAPE'] }).errors.length);
  assert.ok(checkNextPatterns({ ...context, ruleIds: ['UNKNOWN'] }).errors.length);
  fs.symlinkSync(path.join(context.root, 'src'), path.join(context.root, 'redirected'), 'junction');
  assert.ok(checkNextPatterns({ ...context, files: ['redirected/value.ts'], ruleIds: ['FE_SOURCE_NAME_SHAPE'] }).errors.length);
  const malformed = fixture(t, { 'src/value.tsx': 'export const = <div>' });
  assert.ok(checkNextPatterns({ ...malformed, ruleIds: NEXT_SCRIPT_RULES }).errors.length);
});
