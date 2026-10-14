// proves: HFS_UNUSED_SYMBOL@lite HFS_UNUSED_SYMBOL@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { unusedSymbolFindings } from '../../scripts/hfs/rules/unused-symbol.mjs';
import { checkDeadExports } from '../../scripts/hfs/architecture/dead-exports.mjs';

function fixture(t, contents) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-unused-symbol-'));
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  for (const [file, text] of Object.entries(contents)) {
    const target = path.join(repoRoot, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
  return { repoRoot, files: Object.keys(contents), ts };
}

const DECLARATIONS = {
  'src/modules/domain/orders/orders.type.ts': 'export enum State { Active = "active", Retired = "retired" }',
  'src/modules/domain/orders/errors/orders.error.ts': `export enum OrdersErrorCode { Missing = "ORDERS_MISSING", Obsolete = "ORDERS_OBSOLETE" }
export const ORDER_ERROR_KINDS = { [OrdersErrorCode.Missing]: "not-found", [OrdersErrorCode.Obsolete]: "conflict" };`,
  'src/modules/queues/orders/orders.queue.ts': 'export const ORDERS_QUEUE = "orders"; export const RETIRED_QUEUE = "retired";',
  'src/modules/domain/orders/messages/orders.messages.ts': `export const ORDER_MESSAGES = {
vi: { "orders.created": "Created", "orders.retired": "Retired", "errors.ORDERS_MISSING": "Missing", "errors.ORDERS_OBSOLETE": "Obsolete" },
en: { "orders.created": "Created", "orders.retired": "Retired", "errors.ORDERS_MISSING": "Missing", "errors.ORDERS_OBSOLETE": "Obsolete" }
};`,
  'src/modules/domain/orders/index.ts': `export { State } from './orders.type';
export { OrdersErrorCode } from './errors/orders.error';`,
  'src/modules/domain/orders/orders.service.ts': `import { State, OrdersErrorCode as Code } from './index';
import { ORDERS_QUEUE } from '../../queues/orders/orders.queue';
export function run(messages: any, queue: any) { queue.send(ORDERS_QUEUE, State.Active); throw new Error(Code.Missing); }
export function greet(messages: any) { return messages.get('orders.created'); }`,
};

for (const edition of ['lite', 'full']) {
  test(`HFS_UNUSED_SYMBOL ${edition}: dead enum, queue, error and catalog declarations are refused even when imported or mapped`, t => {
    const findings = unusedSymbolFindings({ ...fixture(t, DECLARATIONS), repo: { profile: 'be', edition } });
    assert.ok(findings.every(finding => finding.code === 'HFS_UNUSED_SYMBOL' && finding.level === 'error'));
    assert.deepEqual(findings.map(finding => `${finding.kind}:${finding.name}`).sort(), [
      'catalog key:errors.ORDERS_OBSOLETE', 'catalog key:orders.retired', 'enum member:State.Retired', 'error code:OrdersErrorCode.Obsolete', 'queue constant:RETIRED_QUEUE',
    ]);
    const obsolete = findings.find(finding => finding.name === 'OrdersErrorCode.Obsolete');
    assert.equal(obsolete.path, 'src/modules/domain/orders/errors/orders.error.ts');
    assert.equal(obsolete.line, 1);
  });

  test(`HFS_UNUSED_SYMBOL ${edition}: removing unused declarations leaves genuine consumers clean`, t => {
    const contents = { ...DECLARATIONS };
    contents['src/modules/domain/orders/orders.type.ts'] = 'export enum State { Active = "active" }';
    contents['src/modules/domain/orders/errors/orders.error.ts'] = 'export enum OrdersErrorCode { Missing = "ORDERS_MISSING" }';
    contents['src/modules/queues/orders/orders.queue.ts'] = 'export const ORDERS_QUEUE = "orders";';
    contents['src/modules/domain/orders/messages/orders.messages.ts'] = 'export const ORDER_MESSAGES = { "orders.created": { vi: "Created", en: "Created" }, "errors.ORDERS_MISSING": { vi: "Missing", en: "Missing" } };';
    assert.deepEqual(unusedSymbolFindings({ ...fixture(t, contents), repo: { profile: 'be', edition } }), []);
  });

  test(`HFS_UNUSED_SYMBOL ${edition}: locale JSON catalogs report unused leaves and honor static translation namespaces`, t => {
    const contents = {
      'apps/web/src/modules/i18n/messages/en.json': JSON.stringify({ orders: { title: 'Orders', retired: 'Retired' } }),
      'apps/web/src/modules/i18n/messages/vi.json': JSON.stringify({ orders: { title: 'Orders', retired: 'Retired' } }),
      'apps/web/src/features/orders/orders.tsx': 'const t = useTranslations("orders"); export const title = t("title");',
    };
    const findings = unusedSymbolFindings({ ...fixture(t, contents), repo: { profile: 'fe', edition } });
    assert.deepEqual(findings.map(finding => finding.name), ['orders.retired', 'orders.retired']);
    contents['apps/web/src/features/orders/orders.tsx'] += 'export const retired = t("retired");';
    assert.deepEqual(unusedSymbolFindings({ ...fixture(t, contents), repo: { profile: 'fe', edition } }), []);
  });
}

test('HFS_UNUSED_SYMBOL: comments, type references, re-exports and tests alone cannot keep a member alive', t => {
  const contents = {
    'src/modules/domain/order/order.type.ts': 'export enum State { Gone = "gone" }',
    'src/modules/domain/order/index.ts': 'export { State } from "./order.type";',
    'src/modules/domain/order/order.service.ts': 'import { State } from "./index"; export type Gone = State.Gone; // State.Gone',
    'src/modules/domain/order/order.service.spec.ts': 'import { State } from "./index"; run(State.Gone);',
    'src/tests/integration/order/order.integration-spec.ts': 'import { State } from "../../../modules/domain/order"; run(State.Gone);',
  };
  assert.deepEqual(unusedSymbolFindings(fixture(t, contents)).map(finding => finding.name), ['State.Gone']);
});

test('HFS_UNUSED_SYMBOL: receiver identity survives named aliases and tsconfig paths and rejects lookalike objects', t => {
  const contents = {
    'tsconfig.json': '{ "compilerOptions": { "baseUrl": ".", "paths": { "@domain/*": ["src/modules/domain/*"] } } }',
    'src/modules/domain/order/order.type.ts': 'export enum State { Active = "active", Gone = "gone" }',
    'src/modules/domain/order/index.ts': 'export { State as OrderState } from "./order.type";',
    'src/modules/domain/order/order.service.ts': `import { OrderState as S } from '@domain/order';
run(S['Active']); const State = { Gone: 1 }; run(State.Gone);`,
  };
  assert.deepEqual(unusedSymbolFindings(fixture(t, contents)).map(finding => finding.name), ['State.Gone']);
});

test('HFS_UNUSED_SYMBOL: enum escape and computed reads conservatively keep the possible members', t => {
  for (const consumer of ['run(State);', 'run(State[key]);', 'const { Active } = State; run(Active);']) {
    const contents = {
      'src/modules/domain/order/order.type.ts': 'export enum State { Active = "active", Gone = "gone" }',
      'src/modules/domain/order/order.service.ts': `import { State } from './order.type'; ${consumer}`,
    };
    assert.deepEqual(unusedSymbolFindings(fixture(t, contents)), []);
  }
});

test('HFS_UNUSED_SYMBOL: fast-check scope filters declarations after reading every tracked consumer', t => {
  const context = fixture(t, DECLARATIONS);
  const findings = unusedSymbolFindings({ ...context, inScope: file => file.endsWith('.queue.ts') });
  assert.deepEqual(findings.map(finding => finding.name), ['RETIRED_QUEUE']);
  assert.deepEqual(unusedSymbolFindings({ ...context, isRoot: true }), [], 'the side check owns these declarations');
});

test('HFS_UNUSED_SYMBOL: translation receiver namespaces and aliases keep only their own catalog keys alive', t => {
  const context = fixture(t, {
    'apps/web/src/modules/i18n/messages/en.json': JSON.stringify({ orders: { title: 'Orders', notices: { saved: 'Saved' } }, users: { title: 'Users' }, incidental: 'Incidental' }),
    'apps/web/src/features/orders/orders.tsx': `import { useTranslations as useTexts } from 'next-intl';
const tx = useTexts('orders'); export const title = tx('title');
export const saved = tx.rich(\`notices.\${status}\`); const incidental = 'incidental';`,
  });
  assert.deepEqual(unusedSymbolFindings(context).map(finding => finding.name).sort((a, b) => a.localeCompare(b)), ['incidental', 'users.title']);
});

test('HFS_UNUSED_SYMBOL: real dispatch-table error-code keys are consumers and kind/message-only maps are not', t => {
  const contents = {
    'src/modules/domain/orders/errors/orders.error.ts': `export enum OrdersErrorCode { Missing = "ORDERS_MISSING", Obsolete = "ORDERS_OBSOLETE" }
export const ORDER_ERROR_KINDS = { [OrdersErrorCode.Missing]: "not-found", [OrdersErrorCode.Obsolete]: "conflict" };`,
    'src/modules/domain/orders/orders.service.ts': `import { OrdersErrorCode as Code } from './errors/orders.error';
const handlers = { [Code.Missing]: () => recover() }; export function run(code: any) { return handlers[code](); }`,
  };
  assert.deepEqual(unusedSymbolFindings(fixture(t, contents)).map(finding => finding.name), ['OrdersErrorCode.Obsolete']);
});

test('HFS_UNUSED_SYMBOL: scalar and object error code declarations do not consume their own literals', t => {
  const contents = {
    'src/modules/domain/order/order.error.ts': 'export const LIVE_ERROR_CODE = "ORDER_LIVE"; export const DEAD_ERROR_CODE = "ORDER_DEAD"; export const OrderErrorCodes = { Live: "ORDER_FOUND", Dead: "ORDER_GONE" };',
    'src/modules/domain/order/order.service.ts': 'import { LIVE_ERROR_CODE, OrderErrorCodes } from "./order.error"; run(LIVE_ERROR_CODE, OrderErrorCodes.Live);',
  };
  assert.deepEqual(unusedSymbolFindings(fixture(t, contents)).map(finding => finding.name), ['DEAD_ERROR_CODE', 'OrderErrorCodes.Dead']);
});

test('HFS_UNUSED_SYMBOL: a nested namespace enum access preserves member precision and shorthand escape preserves all', t => {
  const contents = {
    'src/modules/domain/order/order.type.ts': 'export enum State { Active = "active", Gone = "gone" }',
    'src/modules/domain/order/order.service.ts': 'import * as values from "./order.type"; run(values.State.Active);',
  };
  assert.deepEqual(unusedSymbolFindings(fixture(t, contents)).map(finding => finding.name), ['State.Gone']);
  contents['src/modules/domain/order/order.service.ts'] = 'import { State } from "./order.type"; run({ State });';
  assert.deepEqual(unusedSymbolFindings(fixture(t, contents)), []);
});

test('HFS_UNUSED_SYMBOL: numeric reverse enum indexing reads the member at that value', t => {
  const contents = {
    'src/modules/domain/order/order.type.ts': 'export enum State { Active, Gone }',
    'src/modules/domain/order/order.service.ts': 'import { State } from "./order.type"; run(State[0]);',
  };
  assert.deepEqual(unusedSymbolFindings(fixture(t, contents)).map(finding => finding.name), ['State.Gone']);
});

function namespaceFindings(t, consumer, entry = 'export const Keep = () => 1; export const Dead = () => 2;', javascript = false) {
  const root = 'src/modules/domain/values';
  const publicEntry = `${root}/index.ts`;
  const from = `src/consumer.service.${javascript ? 'js' : 'ts'}`;
  const context = fixture(t, { [publicEntry]: entry, [from]: consumer });
  const source = file => ts.createSourceFile(path.join(context.repoRoot, file), fs.readFileSync(path.join(context.repoRoot, file), 'utf8'), ts.ScriptTarget.Latest, true);
  const owner = { root, tier: 'domain', slot: 'be.domain' };
  const consumerSource = source(from);
  const graph = {
    files: new Map([[publicEntry, { sourceFile: source(publicEntry), ...owner, owner }], [from, { sourceFile: consumerSource, tier: 'route' }]]),
    ownerRoots: new Map([['owner', owner]]),
    edges: consumerSource.statements.filter(statement => ts.isImportDeclaration(statement)).map(declaration => ({ from, to: publicEntry, reexport: false, edge: { declaration } })),
    unit: file => file === publicEntry ? 'owner' : null,
    resolver: { classifyPath: () => ({ slot: null }), ruleParams: () => ({}), slot: () => ({ tier: 'domain' }), ownerOf: () => null },
  };
  return checkDeadExports({ context: { ts }, graph, config: { root: context.repoRoot, apps: [] } }).violations.filter(finding => finding.ruleId === 'HFS_UNUSED_EXPORT').map(finding => finding.name).sort((a, b) => a.localeCompare(b));
}

for (const edition of ['lite', 'full']) {
  test(`HFS_UNUSED_EXPORT ${edition}: a namespace import counts precise property, bracket and destructured reads`, t => {
    for (const consumer of [
      'import * as values from "./modules/domain/values"; values.Keep();',
      'import * as values from "./modules/domain/values"; values["Keep"]();',
      'import * as values from "./modules/domain/values"; const { Keep: local } = values; local();',
    ]) assert.deepEqual(namespaceFindings(t, consumer), ['Dead']);
  });
  test(`HFS_UNUSED_EXPORT ${edition}: a namespace used by no expression leaves every export dead`, t => {
    assert.deepEqual(namespaceFindings(t, 'import * as values from "./modules/domain/values";'), ['Dead', 'Keep']);
  });
}

test('HFS_UNUSED_EXPORT: qualified types count their member and nested shadowing is not a namespace read', t => {
  assert.deepEqual(namespaceFindings(t, 'import * as values from "./modules/domain/values"; type T = values.Keep;', 'export interface Keep {} export interface Dead {}'), ['Dead']);
  assert.deepEqual(namespaceFindings(t, 'import * as values from "./modules/domain/values"; values.Keep(); function f(values: any) { values.Dead(); }'), ['Dead']);
});

test('HFS_UNUSED_EXPORT: computed, rest and whole namespace consumers keep all exports', t => {
  for (const consumer of ['values[key]();', 'run(values);', 'const { ...rest } = values; run(rest);']) {
    assert.deepEqual(namespaceFindings(t, `import * as values from './modules/domain/values'; ${consumer}`), []);
  }
});

test('HFS_UNUSED_EXPORT: JSDoc type references consume their export while documentation-only references do not', t => {
  const imported = 'import * as values from "./modules/domain/values";\n';
  assert.deepEqual(namespaceFindings(t, `${imported}/** @type {values.Keep} */\nlet example;`, undefined, true), ['Dead']);
  assert.deepEqual(namespaceFindings(t, `${imported}/** @see values.Keep */\nlet example;`, undefined, true), ['Dead', 'Keep']);
});
