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

  test(`HFS_UNUSED_SYMBOL ${edition}: imported namespace constants and finite parameter values resolve only runtime translation reads`, t => {
    const context = fixture(t, {
      'apps/web/src/modules/i18n/messages/en.json': JSON.stringify({ app: { title: 'App', retired: 'Retired' }, cart: { title: 'Cart', retired: 'Retired' }, checkout: { title: 'Checkout' }, unused: { title: 'Unused' } }),
      'apps/web/src/modules/i18n/namespace.ts': 'export const APP_NAMESPACE = "app"; export const UNUSED_NAMESPACE = "unused";',
      'apps/web/src/modules/i18n/index.ts': 'export { APP_NAMESPACE as PAGE_NAMESPACE, UNUSED_NAMESPACE } from "./namespace";',
      'apps/web/src/modules/meta.ts': `export function metadata(namespace: string) { const copy = getTranslations(namespace); return copy('title'); }
export function section(namespace: 'cart' | 'checkout') { const text = useTranslations(namespace); return text('title'); }`,
      'apps/web/src/features/page.ts': `import { PAGE_NAMESPACE, UNUSED_NAMESPACE } from '../modules/i18n';
import { metadata, section } from '../modules/meta';
const text = getTranslations(PAGE_NAMESPACE); render(text('title')); metadata('cart'); section('checkout');`,
    });
    assert.deepEqual(unusedSymbolFindings({ ...context, repo: { profile: 'fe', edition } }).map(finding => finding.name), ['app.retired', 'cart.retired', 'unused.title']);
  });

  test(`HFS_UNUSED_SYMBOL ${edition}: finite mapped labels consume their keys while an unbounded key gives no evidence`, t => {
    const context = fixture(t, {
      'apps/web/src/modules/i18n/messages/en.json': JSON.stringify({ nav: { browse: 'Browse', cart: 'Cart', retired: 'Retired' } }),
      'apps/web/src/features/nav.tsx': `const links = [{ key: 'browse' }, { key: 'cart' }] as const;
const text = useTranslations('nav'); export const labels = links.map(link => text(link.key));
function unknown(key: string) { return text(key); }`,
    });
    assert.deepEqual(unusedSymbolFindings({ ...context, repo: { profile: 'fe', edition } }).map(finding => finding.name), ['nav.retired']);
  });

  test(`HFS_UNUSED_SYMBOL ${edition}: direct JSON runtime member reads follow aliases and barrels without retaining imported dead leaves`, t => {
    const context = fixture(t, {
      'tsconfig.json': '{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["apps/web/src/*"] } } }',
      'apps/web/src/modules/i18n/messages/en.json': JSON.stringify({ errors: { global: { title: 'Error', retry: 'Retry', retired: 'Retired' } }, unused: 'Unused' }),
      'apps/web/src/modules/config/settings.json': JSON.stringify({ unused: 'Config value' }),
      'apps/web/src/modules/i18n/catalog.ts': `import messages from './messages/en.json'; export const GLOBAL = messages.errors.global;`,
      'apps/web/src/modules/i18n/index.ts': `export { GLOBAL as ERROR_COPY } from './catalog';`,
      'apps/web/src/features/error.tsx': `import { ERROR_COPY } from '../modules/i18n';
import messages from '@/modules/i18n/messages/en.json'; render(messages.errors.global.title);
import settings from '../modules/config/settings.json'; render(settings.unused);
export const error = <div title={ERROR_COPY.title}>{ERROR_COPY['retry']}</div>;`,
    });
    assert.deepEqual(unusedSymbolFindings({ ...context, repo: { profile: 'fe', edition } }).map(finding => finding.name), ['errors.global.retired', 'unused']);
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

const namesOf = (context, edition, profile = 'fe') => unusedSymbolFindings({ ...context, repo: { profile, edition } }).map(finding => finding.name);

for (const edition of ['lite', 'full']) {
  test(`HFS_UNUSED_SYMBOL ${edition}: a catalog key read through an imported object, as const or nested, is live and its dead sibling is not`, t => {
    const contents = {
      'apps/api/src/m.messages.ts': 'export const COPY = { badEngine: "x", retired: "y" }; export const NESTED = { group: { deep: "a", dead: "b" } } as const;',
      'apps/api/src/u.ts': 'import { COPY, NESTED } from "./m.messages"; export const v = COPY.badEngine; export const w = NESTED.group.deep;',
    };
    assert.deepEqual(namesOf(fixture(t, contents), edition, 'be'), ['group.dead', 'retired']);
    contents['apps/api/src/u.ts'] += ' export const x = [COPY.retired, NESTED.group.dead];';
    assert.deepEqual(namesOf(fixture(t, contents), edition, 'be'), []);
  });

  test(`HFS_UNUSED_SYMBOL ${edition}: a translator handed to a component through props keeps its own namespace keys and nothing else`, t => {
    const context = fixture(t, {
      'apps/web/src/modules/i18n/messages/en.json': JSON.stringify({ content: { queueOpen: 'Open', panelTitle: 'Panel', retired: 'Retired' }, other: { queueOpen: 'Other', floating: 'Floating', dead: 'Dead' } }),
      'apps/web/src/features/page.tsx': `import { Card, Panel } from './card';
const t = useTranslations("content"); export const page = <div><Card t={t} /><Panel t={t} /></div>;`,
      'apps/web/src/features/card.tsx': `export function Card({ t }: { t: any }) { return t("queueOpen"); }
export function Panel(props: { t: any }) { return props.t("panelTitle"); }
export function Orphan({ t }: { t: any }) { return t("floating"); }`,
    });
    assert.deepEqual(namesOf(context, edition), ['content.retired', 'other.dead', 'other.queueOpen']);
  });

  test(`HFS_UNUSED_SYMBOL ${edition}: an array-destructured translator from Promise.all binds its namespace by position`, t => {
    const contents = {
      'apps/web/src/modules/i18n/messages/en.json': JSON.stringify({ landing: { hero: 'Hero', retired: 'Retired' }, other: { hero: 'Other' } }),
      'apps/web/src/app/page.ts': 'export async function page() { const [t, locale] = await Promise.all([getTranslations("landing"), getLocale()]); return t("hero") + locale; }',
    };
    assert.deepEqual(namesOf(fixture(t, contents), edition), ['landing.retired', 'other.hero']);
    contents['apps/web/src/app/page.ts'] += ' export const more = () => { const [u] = [useTranslations("other")]; return u("hero"); };';
    assert.deepEqual(namesOf(fixture(t, contents), edition), ['landing.retired']);
  });

  test(`HFS_UNUSED_SYMBOL ${edition}: a template key passed to a wrapper parameter reads every key under its static head`, t => {
    const contents = {
      'apps/api/src/hiring.messages.ts': `export const HIRING = { "hiring.weekday.1": { vi: "a", en: "a" }, "hiring.weekday.2": { vi: "b", en: "b" }, "hiring.retired": { vi: "c", en: "c" } };`,
      'apps/api/src/hiring.service.ts': `export class Hiring {
  constructor(private catalog: any) {}
  text(key: string) { return this.catalog.get(key, {}, "vi"); }
  day(n: number) { return this.text(\`hiring.weekday.\${n}\`) + this.text(\`\${n}\`); }
}`,
    };
    assert.deepEqual(namesOf(fixture(t, contents), edition, 'be'), ['hiring.retired']);
    contents['apps/api/src/hiring.service.ts'] += ' export const direct = (catalog: any) => catalog.get("hiring.retired");';
    assert.deepEqual(namesOf(fixture(t, contents), edition, 'be'), []);
  });

  test(`HFS_UNUSED_SYMBOL ${edition}: a JSON catalog read through a helper function counts the literal and array arguments it receives`, t => {
    const contents = {
      'apps/web/src/modules/i18n/messages/en.json': JSON.stringify({ a: { b: 'B', c: 'C', d: 'D', dead: 'Dead' } }),
      'apps/web/src/modules/i18n/read.ts': `import vi from './messages/en.json';
const read = (k: string) => vi[k]; export const one = read("a.b");
export const list = (keys: string[]) => keys.map(k => vi[k]); export const many = list(["a.c", "a.d"]);`,
    };
    assert.deepEqual(namesOf(fixture(t, contents), edition), ['a.dead']);
    contents['apps/web/src/modules/i18n/read.ts'] += ' export const last = read("a.dead");';
    assert.deepEqual(namesOf(fixture(t, contents), edition), []);
  });

  test(`HFS_UNUSED_SYMBOL ${edition}: a key taken from a nested tuple table by destructuring consumes only the tuple slot that is read`, t => {
    const contents = {
      'apps/web/src/modules/i18n/messages/en.json': JSON.stringify({ footer: { linkTry: 'Try', login: 'Login', retired: 'Retired' } }),
      'apps/web/src/features/footer.tsx': `const COLS = [{ id: "c", links: [["linkTry", "login"]] }] as const;
const t = useTranslations("footer"); export const keys = COLS.map(c => c.links.map(([key]) => t(key)));`,
    };
    assert.deepEqual(namesOf(fixture(t, contents), edition), ['footer.login', 'footer.retired']);
    contents['apps/web/src/features/footer.tsx'] += ' export const pages = COLS.map(c => c.links.map(([, page]) => t(page)));';
    assert.deepEqual(namesOf(fixture(t, contents), edition), ['footer.retired']);
  });
}

for (const edition of ['lite', 'full']) {
  test(`HFS_UNUSED_SYMBOL ${edition}: a key builder returning a template and inline templates with unknown holes read the keys they can spell, in their own namespace only`, t => {
    const contents = {
      'apps/web/src/modules/i18n/messages/en.json': JSON.stringify({ connections: { catalog_airtable_blurb: 'A', filterGmail: 'G', retired: 'Retired' }, other: { catalog_a_b: 'Other' } }),
      'apps/web/src/features/catalog.tsx': `const keyOf = (id: string, part: "name" | "blurb") => \`catalog_\${id}_\${part}\`;
const t = useTranslations("connections");
export const label = t(keyOf(entry.id, "blurb"));
export const filter = (id: string) => t(\`filter\${id.charAt(0).toUpperCase()}\${id.slice(1)}\`);
export const anything = (x: string) => t(\`\${x}\`);`,
    };
    assert.deepEqual(namesOf(fixture(t, contents), edition), ['connections.retired', 'other.catalog_a_b']);
    contents['apps/web/src/features/catalog.tsx'] += ' export const direct = t("retired");';
    assert.deepEqual(namesOf(fixture(t, contents), edition), ['other.catalog_a_b']);
  });

  test(`HFS_UNUSED_SYMBOL ${edition}: a translator hook or forwarding wrapper keeps the namespace of the translator it forwards to`, t => {
    const contents = {
      'apps/web/src/modules/i18n/messages/en.json': JSON.stringify({ hiring: { applyWebsite: 'Apply', retired: 'Retired' }, audit: { auditDetail: 'Detail', retired: 'Retired' }, other: { applyWebsite: 'Other' } }),
      'apps/web/src/features/use-say.ts': 'export const useHiringSay = () => { const t = useTranslations("hiring"); return useCallback((key: string, values?: any) => t(key, values), [t]); };',
      'apps/web/src/features/apply.tsx': `import { useHiringSay } from './use-say';
const say = useHiringSay(); export const a = say("applyWebsite");
const audit = useTranslations("audit"); const text = (key: string) => audit(key);
export function Row(props: { text: (key: string) => string }) { return props.text("auditDetail"); }
export const row = <Row text={text} />;`,
    };
    assert.deepEqual(namesOf(fixture(t, contents), edition), ['audit.retired', 'hiring.retired', 'other.applyWebsite']);
    contents['apps/web/src/features/apply.tsx'] += ' export const b = say("retired");';
    assert.deepEqual(namesOf(fixture(t, contents), edition), ['audit.retired', 'other.applyWebsite']);
  });

  test(`HFS_UNUSED_SYMBOL ${edition}: an imported key table consumed through a wrapper reads the property that is handed on, not its siblings`, t => {
    const contents = {
      'apps/web/src/modules/i18n/messages/en.json': JSON.stringify({ smtpPresets: { gmail_label: 'Gmail', gmail_hint: 'Hint', retired: 'Retired' } }),
      'apps/web/src/features/presets.ts': 'export const PRESETS = [{ label: "gmail_label", hint: "gmail_hint" }] as const;',
      'apps/web/src/features/use-say.ts': 'export const useSmtpSay = () => { const t = useTranslations("smtpPresets"); return useCallback((key: string) => t(key), [t]); };',
      'apps/web/src/features/form.tsx': `import { PRESETS } from './presets';
import { useSmtpSay } from './use-say';
const say = useSmtpSay(); export const options = PRESETS.map(p => ({ label: say(p.label) }));`,
    };
    assert.deepEqual(namesOf(fixture(t, contents), edition), ['smtpPresets.gmail_hint', 'smtpPresets.retired']);
    contents['apps/web/src/features/form.tsx'] += ' export const hints = () => { for (const p of PRESETS) say(p.hint); };';
    assert.deepEqual(namesOf(fixture(t, contents), edition), ['smtpPresets.retired']);
  });
}
