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

test('readonly props checks index signatures and refuses typeof object shapes', t => {
  const context = fixture(t, {
    'src/components/Card.tsx': `const mutable = { value: "x" }
export type IndexProps = { [key: string]: string }
export type QueryProps = { readonly row: typeof mutable }
`,
  });
  const result = checkNextPatterns({ ...context, ruleIds: ['FE_READONLY_PROPS_CONTRACT'] });
  assert.ok(result.violations.some(item => /index signature/.test(item.message)), JSON.stringify(result, null, 2));
  assert.ok(result.errors.some(item => /computed props shape/.test(item.message)), JSON.stringify(result, null, 2));
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

test('return profile classifies components, hooks, async utilities and primitive helpers', t => {
  const context = fixture(t, {
    'src/components/Card.tsx': `import { memo } from "react"
export const Card = (): null => { const isVisible = () => true; return null }
export const Wrapped = memo((_props: {}): null => null)
export const useRows = (): ReadonlyArray<string> => []
export const isReady = () => true
export const readyLabel = (): string => "ready"
export const save = async () => true
export const persist = async (): Promise<boolean> => true
`,
    'src/app/page.tsx': 'export default async function Page(){ return null }\n',
    'src/app/legacy/page.tsx': 'const LegacyRoute = async () => null; export default LegacyRoute\n',
    'src/app/api/health/route.ts': 'export async function GET(){ return new Response() }\n',
    'src/factories.ts': 'export const WidgetFactory = (): string => "widget"\n',
  });
  const result = checkNextPatterns({ ...context, ruleIds: ['FE_RETURN_TYPE_PROFILE'] });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.checkedRuleIds, ['FE_RETURN_TYPE_PROFILE']);
  assert.equal(result.violations.length, 6, JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => /Component Card/.test(item.message)));
  assert.ok(result.violations.some(item => /Component Wrapped/.test(item.message)));
  assert.ok(result.violations.some(item => /Hook useRows/.test(item.message)));
  assert.ok(result.violations.some(item => /Primitive helper isReady/.test(item.message)));
  assert.ok(result.violations.some(item => /Primitive helper isVisible/.test(item.message)));
  assert.ok(result.violations.some(item => /Async utility save/.test(item.message)));
});

test('return profile refuses overloaded and unresolved dynamic returns', t => {
  const context = fixture(t, {
    'src/helpers.ts': `export function parse(value: string): string
export function parse(value: number): number
export function parse(value: unknown){ return value }
export const dynamic = (): any => 1
`,
  });
  const result = checkNextPatterns({ ...context, ruleIds: ['FE_RETURN_TYPE_PROFILE'] });
  assert.ok(result.errors.some(item => /Overloaded function parse/.test(item.message)), JSON.stringify(result, null, 2));
  assert.ok(result.errors.some(item => /dynamic.*any\/unknown/.test(item.message)), JSON.stringify(result, null, 2));
  assert.deepEqual(result.checkedRuleIds, []);
});

test('closed vocabularies bind exact inventories and boolean prop names', t => {
  const context = fixture(t, {
    'src/components/chat/state.ts': `export type ChatState = "pending" | "failed"
export const CHAT_STATES: ReadonlyArray<ChatState> = ["pending", "failed"] as const
export type ChatProps = { readonly loading: boolean; readonly isReady?: boolean }
`,
    'packages/grammar/src/Button/index.ts': `export type ButtonVariant = "primary" | "secondary"
const VARIANTS = { primary: "primary", secondary: "secondary" } as const
export type ButtonProps = { readonly variant: ButtonVariant }
`,
  });
  const result = checkNextPatterns({ ...context, ruleIds: ['FE_CLOSED_VOCABULARY_SHAPE'] });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.checkedRuleIds, ['FE_CLOSED_VOCABULARY_SHAPE']);
  assert.equal(result.violations.length, 1, JSON.stringify(result, null, 2));
  assert.match(result.violations[0].message, /Boolean prop loading/);
});

test('closed vocabularies reject missing members, shadowed inventory types and presentation enums', t => {
  const context = fixture(t, {
    'src/components/chat/state.ts': `type ReadonlyArray<T> = T[]
export type ChatState = "pending" | "failed"
export const CHAT_STATES: ReadonlyArray<ChatState> = ["pending"] as const
export enum ChatMode { General = "general", History = "history" }
`,
    'packages/grammar/src/Button/index.ts': 'const SIZES = { sm: "sm", md: "md" } as const\n',
  });
  const result = checkNextPatterns({ ...context, ruleIds: ['FE_CLOSED_VOCABULARY_SHAPE'] });
  assert.ok(result.violations.some(item => /exactly one beside-it/.test(item.message)), JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => /instead of enum/.test(item.message)), JSON.stringify(result, null, 2));
  assert.ok(result.errors.some(item => /SIZES.*exact union binding/.test(item.message)), JSON.stringify(result, null, 2));
});

test('closed vocabulary metadata binds nonconventional project roles and validates exact declarations', t => {
  const packageJson = {
    private: true,
    starci: { codePatterns: { next: { schema: 'starci/next-code-pattern-contract@1', owners: [], closedVocabularies: [
      { path: 'src/features/auth/phase.ts', type: 'AuthenticationPhase', inventory: 'AUTH_MODES', role: 'mode' },
    ] } } },
  };
  const context = fixture(t, {
    'package.json': JSON.stringify(packageJson),
    'src/features/auth/phase.ts': `export type AuthenticationPhase = "signIn" | "verify"
export const AUTH_MODES: ReadonlyArray<AuthenticationPhase> = ["signIn", "verify"] as const
`,
  });
  const result = checkNextPatterns({ ...context, files: ['src/features/auth/phase.ts'], ruleIds: ['FE_CLOSED_VOCABULARY_SHAPE'] });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.violations, []);
  packageJson.starci.codePatterns.next.closedVocabularies[0].type = 'MissingPhase';
  fs.writeFileSync(path.join(context.root, 'package.json'), JSON.stringify(packageJson));
  const missing = checkNextPatterns({ ...context, files: ['src/features/auth/phase.ts'], ruleIds: ['FE_CLOSED_VOCABULARY_SHAPE'] });
  assert.ok(missing.errors.some(item => /MissingPhase.*not one exported type alias/.test(item.message)), JSON.stringify(missing, null, 2));
});

test('closed vocabulary coverage permits feature discriminated state but refuses undeclared unions and export wrappers', t => {
  const context = fixture(t, {
    'src/features/auth/state.ts': `export type AuthenticationState = { readonly status: "ready"; readonly id: string }
export type AuthenticationMode = "signIn" | "verify"
`,
    'src/features/auth/index.ts': 'export { type AuthenticationMode as PublicMode } from "./state"\n',
  });
  const result = checkNextPatterns({ ...context, ruleIds: ['FE_CLOSED_VOCABULARY_SHAPE'] });
  assert.ok(result.errors.some(item => /AuthenticationMode.*must be declared/.test(item.message)), JSON.stringify(result, null, 2));
  assert.ok(result.errors.some(item => /Aliased closed-vocabulary export PublicMode/.test(item.message)), JSON.stringify(result, null, 2));
  assert.ok(result.errors.every(item => !/AuthenticationState/.test(item.message)), JSON.stringify(result, null, 2));
  const outside = checkNextPatterns({ root: context.root, files: ['src/features/auth/index.ts'], ruleIds: ['FE_CLOSED_VOCABULARY_SHAPE'] });
  assert.ok(outside.errors.some(item => /outside the exact selected file set/.test(item.message)), JSON.stringify(outside, null, 2));
  fs.writeFileSync(path.join(context.root, 'src/features/auth/index.ts'), 'export type { MissingState } from "./missing"\n');
  const unresolved = checkNextPatterns({ root: context.root, files: ['src/features/auth/index.ts'], ruleIds: ['FE_CLOSED_VOCABULARY_SHAPE'] });
  assert.ok(unresolved.errors.some(item => /MissingState.*outside the exact selected file set/.test(item.message)), JSON.stringify(unresolved, null, 2));
});

test('closed vocabulary follows checked public re-exports and same-file export lists', t => {
  const context = fixture(t, {
    'src/components/chat/state.ts': `export type ChatState = "pending" | "ready"
export const CHAT_STATES: ReadonlyArray<ChatState> = ["pending", "ready"] as const
`,
    'src/components/chat/index.ts': 'export type { ChatState } from "./state"\n',
    'src/components/card/state.ts': `type CardState = "idle" | "active"
export type { CardState }
`,
  });
  const result = checkNextPatterns({ ...context, ruleIds: ['FE_CLOSED_VOCABULARY_SHAPE'] });
  assert.deepEqual(result.errors, []);
  assert.equal(result.violations.length, 1, JSON.stringify(result, null, 2));
  assert.match(result.violations[0].message, /CardState has exactly one beside-it/);
});

test('contract names use type aliases, their visual owner and one symbol through re-exports', t => {
  const context = fixture(t, {
    'src/components/pages/CardPage/component.tsx': `export interface CardPageProps { readonly title: string }
export type WrongData = { readonly value: string }
export const CardPageBase = (_props: CardPageProps) => null
`,
    'src/components/pages/CardPage/index.tsx': `export { CardPageBase, type CardPageProps } from "./component"
export const CardPage = () => null
`,
  });
  const result = checkNextPatterns({ ...context, ruleIds: ['FE_CONTRACT_NAME_SHAPE'] });
  assert.deepEqual(result.errors, []);
  assert.equal(result.violations.length, 2, JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => /CardPageProps uses export type/.test(item.message)));
  assert.ok(result.violations.some(item => /WrongData follows its owning unit/.test(item.message)));
});

test('contract names reject distinct duplicate owner contracts and unselected re-export targets', t => {
  const context = fixture(t, {
    'src/components/pages/CardPage/component.tsx': 'export type CardPageProps = { readonly title: string }; export const CardPageBase=()=>null\n',
    'src/components/pages/CardPage/index.tsx': 'export type CardPageProps = { readonly id: string }; export const CardPage=()=>null\n',
  });
  const duplicate = checkNextPatterns({ ...context, ruleIds: ['FE_CONTRACT_NAME_SHAPE'] });
  assert.ok(duplicate.errors.some(item => /multiple distinct exported CardPageProps/.test(item.message)), JSON.stringify(duplicate, null, 2));
  fs.writeFileSync(path.join(context.root, 'src/components/pages/CardPage/index.tsx'), 'export { type CardPageProps } from "./component"\n');
  const outside = checkNextPatterns({ root: context.root, files: ['src/components/pages/CardPage/index.tsx'], ruleIds: ['FE_CONTRACT_NAME_SHAPE'] });
  assert.ok(outside.errors.some(item => /outside the exact selected file set/.test(item.message)), JSON.stringify(outside, null, 2));
});

test('contract owner metadata covers nonvisual contracts and Grammar rejects interfaces', t => {
  const packageJson = {
    private: true,
    starci: { codePatterns: { next: { schema: 'starci/next-code-pattern-contract@1', owners: [
      { root: 'src/features/auth', name: 'Authentication' },
    ], closedVocabularies: [] } } },
  };
  const context = fixture(t, {
    'package.json': JSON.stringify(packageJson),
    'src/features/auth/contracts.ts': 'export type AuthenticationState = { readonly status: string }\n',
    'packages/grammar/src/Button/contracts.ts': 'export interface ButtonRule { readonly id: string }\n',
  });
  const result = checkNextPatterns({ ...context, files: ['packages/grammar/src/Button/contracts.ts', 'src/features/auth/contracts.ts'],
    ruleIds: ['FE_CONTRACT_NAME_SHAPE'] });
  assert.deepEqual(result.errors, []);
  assert.equal(result.violations.length, 1, JSON.stringify(result, null, 2));
  assert.match(result.violations[0].message, /Grammar contract ButtonRule/);
});

test('contract owner identity uses its declared root when names repeat', t => {
  const contract = { schema: 'starci/next-code-pattern-contract@1', owners: [
    { root: 'packages/a/src', name: 'Shared' }, { root: 'packages/b/src', name: 'Shared' },
  ], closedVocabularies: [] };
  const context = fixture(t, {
    'package.json': JSON.stringify({ private: true, starci: { codePatterns: { next: contract } } }),
    'packages/a/src/state.ts': 'export type SharedState = { readonly source: "a" }\n',
    'packages/b/src/state.ts': 'export type SharedState = { readonly source: "b" }\n',
  });
  const result = checkNextPatterns({ ...context, files: ['packages/a/src/state.ts', 'packages/b/src/state.ts'], ruleIds: ['FE_CONTRACT_NAME_SHAPE'] });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.violations, []);
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
