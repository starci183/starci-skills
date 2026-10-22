import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { unusedSymbolFindings } from '../runtime/scripts/hfs/rules/unused-symbol.mjs';

function findings(t, edition, sources, catalog, qualified = false) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-catalog-flow-'));
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  const contents = { ...sources, 'fe/src/messages/en.json': JSON.stringify(catalog) };
  for (const [file, text] of Object.entries(contents)) {
    fs.mkdirSync(path.dirname(path.join(repoRoot, file)), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, file), text);
  }
  return unusedSymbolFindings({ repoRoot, files: Object.keys(contents), repo: { edition }, ts }).map(item => qualified ? `${item.path}:${item.name}` : item.name).sort();
}

for (const edition of ['full', 'lite']) {
  test(`${edition} follows shorthand translators through destructured factory parameters`, t => {
    assert.deepEqual(findings(t, edition, {
      'fe/src/factory.ts': `
        export const createActions = ({ tw, meta: { tm } }) => {
          tw('editSaved'); tm('pickPick');
        };
      `,
      'fe/src/view.ts': `
        import { createActions } from './factory';
        const tw = useTranslations('wizard');
        const tm = useTranslations('metadata');
        createActions({ tw, meta: { tm } });
      `,
    }, {
      wizard: { editSaved: 'Saved', unused: 'Unused', pickPick: 'Wrong namespace' },
      metadata: { pickPick: 'Pick', unused: 'Unused', editSaved: 'Wrong namespace' },
    }), ['metadata.editSaved', 'metadata.unused', 'wizard.pickPick', 'wizard.unused']);
  });

  test(`${edition} reads bounded dynamic key tails through handed-in translators and key variables`, t => {
    assert.deepEqual(findings(t, edition, {
      'fe/src/view.ts': `
        export function row(t: (key: string) => string, stage: string, error: string, key: string) {
          t(\`stage_\${stage}\`);
          const reasonKey = error === null ? null : \`err_\${error}\`;
          t(reasonKey);
          t(\`\${key}\`);
        }
        export function unrelated(format: (key: string) => number, stage: string) {
          format(\`other_\${stage}\`);
        }
      `,
    }, { workbench: { stage_new: 'New', stage_done: 'Done', err_failed: 'Failed', unused: 'Unused', other_new: 'Unused' } }),
    ['workbench.other_new', 'workbench.unused']);
  });

  test(`${edition} follows translator forwarding properties returned through a memoized hook`, t => {
    assert.deepEqual(findings(t, edition, {
      'fe/src/words.ts': `
        export const useWords = () => {
          const g = useTranslations('governance');
          return useMemo(() => ({ g: (key, values) => g(key, values) }), [g]);
        };
      `,
      'fe/src/view.ts': `
        import { useWords } from './words';
        const words = useWords();
        render(words);
        function render(words, reason: string) { words.g(\`reasonHint_\${reason}\`); }
      `,
    }, {
      governance: { reasonHint_routine: 'Routine', reasonHint_missing: 'Missing', unused: 'Unused' },
      unrelated: { reasonHint_routine: 'Unused' },
    }), ['governance.unused', 'unrelated.reasonHint_routine']);
  });

  test(edition + ' follows two spread-forwarded money-wizard factories without reading sibling namespaces', t => {
    assert.deepEqual(findings(t, edition, {
      'fe/src/actions.ts': [
        'export const createMoneyWizardActions = ({ tw }) => ({ save: () => tw("editSaved") });',
        'export const createMoneyWizardActions2 = ({ tw, save }) => { save(); tw("payosLocal"); };',
        'export const useMoneyWizardActions = input => {',
        '  const startTransition = action => action();',
        '  const { save } = createMoneyWizardActions({ ...input, startTransition });',
        '  createMoneyWizardActions2({ ...input, save, startTransition });',
        '};',
      ].join('\n'),
      'fe/src/view.ts': [
        'import { useMoneyWizardActions } from "./actions";',
        'const tw = useTranslations("connectionWizard");',
        'useMoneyWizardActions({ tw });',
      ].join('\n'),
    }, {
      connectionWizard: { editSaved: 'Saved', payosLocal: 'Local', unused: 'Unused' },
      unrelated: { editSaved: 'Wrong namespace', payosLocal: 'Wrong namespace' },
    }), ['connectionWizard.unused', 'unrelated.editSaved', 'unrelated.payosLocal']);
  });

  test(edition + ' follows renamed destructuring by symbol identity across spread forwarding', t => {
    assert.deepEqual(findings(t, edition, {
      'fe/src/actions.ts': [
        'const consume = ({ tw: words }) => words("read");',
        'export const forward = input => consume({ ...input });',
      ].join('\n'),
      'fe/src/view.ts': [
        'import { forward } from "./actions";',
        'const tw = useTranslations("chosen");',
        'forward({ tw });',
        'function unrelatedScope() { const tw = useTranslations("shadow"); return { tw }; }',
      ].join('\n'),
    }, { chosen: { read: 'Live', unused: 'Unused' }, shadow: { read: 'Unused' } }),
    ['chosen.unused', 'shadow.read']);
  });

  test(edition + ' respects the last definite property write around object spreads', t => {
    const cases = [
      { input: '{ tw: first, ...{ tw: second } }', used: 'second.read' },
      { input: '{ ...{ tw: second }, tw: first }', used: 'first.read' },
      { input: '{ tw: first, tw: second }', used: 'second.read' },
    ];
    for (const item of cases) {
      assert.deepEqual(findings(t, edition, {
        'fe/src/view.ts': [
          'const consume = ({ tw }) => tw("read");',
          'const first = useTranslations("first");',
          'const second = useTranslations("second");',
          'consume(' + item.input + ');',
        ].join('\n'),
      }, { first: { read: 'First' }, second: { read: 'Second' }, unrelated: { read: 'Unused' } }),
      ['first.read', 'second.read', 'unrelated.read'].filter(name => name !== item.used), item.input);
    }
  });

  test(edition + ' preserves the earlier value when a known conditional spread can omit it', t => {
    assert.deepEqual(findings(t, edition, {
      'fe/src/view.ts': [
        'declare const flag: boolean;',
        'const consume = ({ tw }) => tw("read");',
        'const first = useTranslations("first");',
        'const second = useTranslations("second");',
        'consume({ tw: first, ...(flag ? { tw: second } : {}) });',
      ].join('\n'),
    }, { first: { read: 'Live', unused: 'Unused' }, second: { read: 'Live', unused: 'Unused' }, unrelated: { read: 'Unused' } }),
    ['first.unused', 'second.unused', 'unrelated.read']);
  });

  test(edition + ' treats unknown spreads and unsupported property writes as provenance barriers', t => {
    const inputs = [
      '{ tw: chosen, ...opaque }',
      '{ tw: chosen, ...(flag ? {} : opaque) }',
      '{ tw: chosen, ...{ [key]: null } }',
      '{ tw: chosen, ...cycle() }',
      '{ tw: chosen, ...{ tw() { return "ordinary"; } } }',
      '{ tw: chosen, ...{ get tw() { return 1; } } }',
      '{ tw: chosen, ...table[key] }',
      '{ tw: chosen, ...carrier.value }',
      '{ tw: chosen, ...tupleValue }',
    ];
    for (const input of inputs) {
      assert.deepEqual(findings(t, edition, {
        'fe/src/view.ts': [
          'declare const opaque: any;',
          'declare const flag: boolean;',
          'declare const key: string;',
          'const consume = ({ tw }) => tw("read");',
          'const chosen = useTranslations("chosen");',
          'function cycle() { return cycle(); }',
          'const table = { known: { tw: chosen }, ...opaque };',
          'const carrier = flag ? { value: { tw: chosen } } : opaque;',
          'const [tupleValue] = flag ? [{ tw: chosen }] : opaque;',
          'consume(' + input + ');',
        ].join('\n'),
      }, { chosen: { read: 'Unproved', unused: 'Unused' }, unrelated: { read: 'Unused' } }),
      ['chosen.read', 'chosen.unused', 'unrelated.read'], input);
    }
  });

  test(edition + ' restores precise provenance with an explicit write after an unknown spread', t => {
    for (const input of ['{ ...opaque, tw: chosen }', '{ ...cycle(), tw: chosen }', '{ ...{ [key]: null }, tw: chosen }']) {
      assert.deepEqual(findings(t, edition, {
        'fe/src/view.ts': [
          'declare const opaque: any;',
          'declare const key: string;',
          'const consume = ({ tw }) => tw("read");',
          'const chosen = useTranslations("chosen");',
          'function cycle() { return cycle(); }',
          'consume(' + input + ');',
        ].join('\n'),
      }, { chosen: { read: 'Live', unused: 'Unused' }, unrelated: { read: 'Unused' } }),
      ['chosen.unused', 'unrelated.read'], input);
    }
  });

  test(edition + ' keeps spread-forwarded bounded dynamic keys inside their resolved namespace', t => {
    assert.deepEqual(findings(t, edition, {
      'fe/src/view.ts': [
        'const consume = ({ tw: words }, stage: string, key: string) => { words(`stage_${stage}`); words(key); };',
        'const forward = input => consume({ ...input });',
        'const tw = useTranslations("chosen");',
        'forward({ tw });',
      ].join('\n'),
    }, { chosen: { stage_new: 'New', stage_done: 'Done', unused: 'Unused' }, unrelated: { stage_new: 'Unused' } }),
    ['chosen.unused', 'unrelated.stage_new']);
  });


  test(edition + ' never turns observed unknown translator bindings into loose namespace reads', t => {
    const sources = [
      [
        'const consume = ({ tw }: { tw: (key: string) => string }) => tw("read");',
        'consume({ tw: chosen, ...opaque });',
      ],
      [
        'const consume = ({ t }) => t("read");',
        'consume({ t: chosen, ...opaque });',
      ],
      [
        'const items = flag ? [{ t: chosen }] : opaque;',
        'items.forEach(({ t }) => t("read"));',
      ],
      [
        'const { t } = { t: chosen, ...opaque };',
        't("read");',
      ],
    ];
    for (const source of sources) {
      assert.deepEqual(findings(t, edition, {
        'fe/src/view.ts': [
          'declare const opaque: any;',
          'declare const flag: boolean;',
          'const chosen = useTranslations("chosen");',
          ...source,
        ].join('\n'),
      }, { chosen: { read: 'Unproved', unused: 'Unused' }, unrelated: { read: 'Unused' } }),
      ['chosen.read', 'chosen.unused', 'unrelated.read'], source.join('\n'));
    }
  });

  test(edition + ' retains bounded prefix reads for genuinely unbound named and typed generic translators', t => {
    assert.deepEqual(findings(t, edition, {
      'fe/src/view.ts': [
        'export function typed(words: (key: string) => string, stage: string) { words(`stage_${stage}`); }',
        'export function named({ t }, reason: string) { t(`reason_${reason}`); }',
      ].join('\n'),
    }, { chosen: { stage_new: 'Live', reason_failed: 'Live', unused: 'Unused' }, unrelated: { stage_new: 'Live', other: 'Unused' } }),
    ['chosen.unused', 'unrelated.other']);
  });


  test(edition + ' retains explicit root catalog get reads independently of generic translator fallback', t => {
    assert.deepEqual(findings(t, edition, {
      'fe/src/view.ts': [
        'const messages = { get: (key: string) => key };',
        'messages.get("read");',
      ].join('\n'),
    }, { read: 'Live', unused: 'Unused' }), ['unused']);
  });

  test(edition + ' recognizes imported translator factories with root and explicit namespace options', t => {
    assert.deepEqual(findings(t, edition, {
      'fe/src/view.ts': [
        'import { createTranslator as makeTranslator } from "next-intl";',
        'const root = makeTranslator({ locale: "en", messages: {} }); root("app.title");',
        'const scoped = makeTranslator({ locale: "en", messages: {}, namespace: "screen" }); scoped("label");',
        'declare const opaque: any;',
        'const t = makeTranslator(opaque); t("unproved");',
        'function shadow(makeTranslator) { const t = makeTranslator({ locale: "en", messages: {} }); t("shadowed"); }',
        'shadow(opaque);',
      ].join('\n'),
    }, { app: { title: 'Live', unused: 'Unused' }, screen: { label: 'Live', unused: 'Unused' }, unrelated: { label: 'Unused' }, unproved: 'Unused', shadowed: 'Unused' }),
    ['app.unused', 'screen.unused', 'shadowed', 'unproved', 'unrelated.label']);
  });

  test(edition + ' follows typed root catalog get wrappers through their actual policy arguments', t => {
    assert.deepEqual(findings(t, edition, {
      'fe/src/view.ts': [
        'const policy = (t: (key: string) => string) => t("bundle.title");',
        'class Builder { catalog: any; build() { const t = (key: string, params = {}) => this.catalog.get(key, params, "vi"); policy(t); } }',
        'const direct = (messages: { get: (key: string) => string }) => messages.get("bundle.direct");',
        'direct({ get: key => key });',
      ].join('\n'),
    }, { bundle: { title: 'Live', direct: 'Live', unused: 'Unused' }, unrelated: { title: 'Unused' } }),
    ['bundle.unused', 'unrelated.title']);
  });

  test(edition + ' follows guarded identity-fallback translators into finite imported table consumers', t => {
    assert.deepEqual(findings(t, edition, {
      'fe/src/banks.ts': [
        'export const CODES: ReadonlyArray<string> = ["ACB", "VCB"];',
        'const listed = (code: string) => CODES.includes(code);',
        'export const useBankName = () => { const banks = useTranslations("banks"); return useCallback((code: string) => listed(code) ? banks(code) : code, [banks]); };',
        'export const options = (bankName: (code: string) => string) => CODES.map(code => ({ label: bankName(code) }));',
      ].join('\n'),
      'fe/src/view.ts': 'import { useBankName, options } from "./banks"; const bankName = useBankName(); options(bankName);',
    }, { banks: { ACB: 'Live', VCB: 'Live', unused: 'Unused' }, unrelated: { ACB: 'Unused' } }),
    ['banks.unused', 'unrelated.ACB']);
  });

  test(edition + ' rejects conditional forwarders with unknown results or a different argument', t => {
    for (const returned of ['flag ? banks(code) : opaque(code)', 'flag ? banks(other) : code', 'flag ? banks(code) : "fixed"', '((code = "VCB"), flag) ? banks(code) : code', '((code += "X"), flag) ? banks(code) : code', '(([code] = ["VCB"]), flag) ? banks(code) : code']) {
      assert.deepEqual(findings(t, edition, {
        'fe/src/view.ts': [
          'declare const flag: boolean; declare const opaque: any; declare const other: string;',
          'const useBankName = () => { const banks = useTranslations("banks"); return useCallback((code: string) => ' + returned + ', [banks]); };',
          'const consume = (words: (code: string) => string) => words("ACB"); consume(useBankName());',
        ].join('\n'),
      }, { banks: { ACB: 'Unproved', unused: 'Unused' }, unrelated: { ACB: 'Unused' } }),
      ['banks.ACB', 'banks.unused', 'unrelated.ACB'], returned);
    }
  });

  test(edition + ' consumes exact two-locale catalog leaves through an imported spread aggregate', t => {
    const unused = ['template.unused', 'template.unknown', 'template.ordinary'];
    const words = Object.fromEntries(['template.read', ...unused].map(key => [key, key]));
    assert.deepEqual(findings(t, edition, {
      'be/src/booking.messages.ts': 'export const BOOKING = ' + JSON.stringify({ vi: words, en: words }) + ';',
      'be/src/unrelated.messages.ts': 'export const OTHER = { vi: { "template.read": "Unrelated" }, en: { "template.read": "Unrelated" } };',
      'be/src/aggregate.messages.ts': 'import { BOOKING } from "./booking.messages"; export const ALL = { vi: { ...BOOKING.vi }, en: { ...BOOKING.en } };',
      'be/src/localized.ts': [
        'import { ALL as catalog } from "./aggregate.messages";',
        'export const localize = (key: string) => { const vi = catalog.vi[key]; const en = catalog.en[key]; if (vi === undefined || en === undefined) throw Error(key); return { vi, en }; };',
      ].join('\n'),
      'be/src/view.ts': [
        'import { localize } from "./localized"; export const rendered = localize("template.read");',
        'declare const opaque: any; localize(opaque);',
        'const unknown = (key: string) => opaque.vi[key]; unknown("template.unknown");',
        'const ordinary = { vi: { "template.ordinary": "Ordinary" } }; ordinary.vi["template.ordinary"];',
      ].join('\n'),
    }, {}, true), [
      ...unused.map(key => `be/src/booking.messages.ts:${key}`),
      'be/src/unrelated.messages.ts:template.read',
    ].sort());
  });

  test(edition + ' preserves ordered catalog writes and refuses unknown spread owners', t => {
    const cases = [
      { owner: '{ ...FIRST.vi, ...SECOND.vi }', used: 'second' },
      { owner: '{ ...SECOND.vi, ...FIRST.vi }', used: 'first' },
      { owner: '{ ...FIRST.vi, ...opaque }', used: null },
      { owner: '{ ...FIRST.vi, ...{ [key]: "Unknown" } }', used: null },
      { owner: '{ ...opaque, ...FIRST.vi }', used: 'first' },
    ];
    for (const item of cases) {
      assert.deepEqual(findings(t, edition, {
        'be/src/first.messages.ts': 'export const FIRST = { vi: { read: "First", unused: "Unused" } };',
        'be/src/second.messages.ts': 'export const SECOND = { vi: { read: "Second", unused: "Unused" } };',
        'be/src/aggregate.messages.ts': 'import { FIRST } from "./first.messages"; import { SECOND } from "./second.messages"; declare const opaque: any; declare const key: string; export const ALL = { vi: ' + item.owner + ' };',
        'be/src/view.ts': 'import { ALL } from "./aggregate.messages"; ALL.vi["read"];',
      }, {}, true), ['first', 'second'].flatMap(owner => [
        `be/src/${owner}.messages.ts:unused`,
        ...(owner === item.used ? [] : [`be/src/${owner}.messages.ts:read`]),
      ]).sort(), item.owner);
    }
  });

  test(edition + ' follows symbol-resolved methods returning translators through locals and arguments', t => {
    assert.deepEqual(findings(t, edition, {
      'be/src/view.ts': [
        'const localPolicy = (t: (key: string) => string) => t("bundle.local");',
        'const directPolicy = (t: (key: string) => string) => t("bundle.direct");',
        'class Builder { catalog: any; private say() { return (key: string, params = {}) => this.catalog.get(key, params, "vi"); } build() { const t = this.say(); localPolicy(t); directPolicy(this.say()); } }',
      ].join('\n'),
    }, { bundle: { local: 'Live', direct: 'Live', unused: 'Unused' }, unrelated: { local: 'Unused' } }),
    ['bundle.unused', 'unrelated.local']);
    assert.deepEqual(findings(t, edition, {
      'be/src/view.ts': 'declare const opaque: any; const consume = (t: (key: string) => string) => t("read"); class Builder { say() { return opaque; } build() { const t = this.say(); consume(t); consume(this.say()); } }',
    }, { chosen: { read: 'Unproved' }, unrelated: { read: 'Unused' } }), ['chosen.read', 'unrelated.read']);
  });

  test(edition + ' follows ordered JSX spreads without losing unknown or overwritten properties', t => {
    const cases = [
      { attrs: '{...props}', props: '{ t: first }', used: 'first' },
      { attrs: '{...props} t={second}', props: '{ t: first }', used: 'second' },
      { attrs: 't={first} {...props}', props: '{ t: second }', used: 'second' },
      { attrs: 't={first} {...opaque}', props: '{}', used: null },
      { attrs: '{...opaque} t={first}', props: '{}', used: 'first' },
      { attrs: '{...props}', props: 'flag ? { t: first } : opaque', used: null },
    ];
    for (const item of cases) {
      assert.deepEqual(findings(t, edition, {
        'fe/src/view.tsx': [
          'declare const opaque: any; declare const flag: boolean;',
          'const first = useTranslations("first"); const second = useTranslations("second");',
          'const Leaf = ({ t }) => t("read");',
          'const Middle = props => <Leaf ' + item.attrs + ' />;',
          'const props = ' + item.props + '; const rendered = <Middle {...props} />;',
        ].join('\n'),
      }, { first: { read: 'First' }, second: { read: 'Second' }, unrelated: { read: 'Unused' } }),
      ['first.read', 'second.read', 'unrelated.read'].filter(key => key !== `${item.used}.read`), item.attrs + item.props);
    }
  });

  test(edition + ' follows exact readonly class translator fields through their declared forwarding methods', t => {
    const cases = [
      { field: 'readonly textOf = (key: string, params = {}) => this.text(key, { ...params });', method: 'return this.catalog.get(key, params, "vi");', after: '', used: true },
      { field: 'textOf = (key: string) => this.text(key);', method: 'return this.catalog.get(key, params, "vi");', after: '', used: false },
      { field: 'readonly textOf = (key: string) => this.text(key);', method: 'return this.catalog.get(key, params, "vi");', after: 'words.textOf = opaque;', used: false },
      { field: 'readonly textOf = (key: string) => this.text(key);', method: 'return this.catalog.get(key, params, "vi");', after: '[words.text] = [opaque];', used: false },
      { field: 'get textOf() { return (key: string) => this.text(key); }', method: 'return this.catalog.get(key, params, "vi");', after: '', used: false },
      { field: 'readonly textOf = (key: string) => this.text(key);', method: 'return this.formatter.get(key);', after: '', used: false },
      { field: 'readonly textOf = (key: string) => this.text(key);', method: 'return "fixed";', after: '', used: false },
      { field: 'readonly textOf = opaque;', method: 'return this.catalog.get(key, params, "vi");', after: '', used: false },
    ];
    for (const item of cases) {
      assert.deepEqual(findings(t, edition, {
        'be/src/policy.ts': 'export const phrase = (t: (key: string) => string) => t("hiring.pay");',
        'be/src/view.ts': [
          'import { phrase } from "./policy"; declare const opaque: any;',
          'class Words { catalog: any; formatter: any; text(key: string, params = {}) { ' + item.method + ' } ' + item.field + ' }',
          'const words = new Words(); ' + item.after + ' export const rendered = phrase(words.textOf);',
        ].join('\n'),
      }, { hiring: { pay: 'Live', unused: 'Unused' }, unrelated: { pay: 'Unused' } }),
      ['hiring.unused', 'unrelated.pay', ...(item.used ? [] : ['hiring.pay'])].sort(), item.field + item.method + item.after);
    }
  });

  test(edition + ' resolves finite template products in catalog member reads and preserves unknown spans', t => {
    const words = { 'sheet.order.date': 'Live', 'sheet.order.code': 'Live', 'sheet.lead.date': 'Live', 'sheet.order.unused': 'Unused', 'sheet.other.date': 'Unused' };
    const cases = [
      { expression: '`sheet.order.${column}`', source: 'const columns = ["date", "code"] as const; columns.map(column => translate(' , used: ['sheet.order.date', 'sheet.order.code'] },
      { expression: '`sheet.${kind}.${column}`', source: 'const kind = "order"; const columns = ["date", "code"] as const; columns.map(column => translate(', used: ['sheet.order.date', 'sheet.order.code'] },
      { expression: '`sheet.${kind}.${column}`', source: 'declare const kind: string; const columns = ["date", "code"] as const; columns.map(column => translate(', used: [] },
      { expression: '`sheet.order.${column}${tail}`', source: 'declare const tail: string; const columns = ["date", "code"] as const; columns.map(column => translate(', used: [] },
      { expression: '`sheet.${kind}.${column}`', source: 'declare const flag: boolean; declare const opaque: any; const kind = flag ? "order" : opaque; const columns = ["date", "code"] as const; columns.map(column => translate(', used: [] },
      { expression: '`sheet.${kind}.${column}`', source: 'const kind = cycle; const cycle = kind; const columns = ["date", "code"] as const; columns.map(column => translate(', used: [] },
    ];
    for (const item of cases) {
      assert.deepEqual(findings(t, edition, {
        'be/src/words.messages.ts': 'export const WORDS = ' + JSON.stringify({ vi: words, en: words }) + ';',
        'be/src/view.ts': 'import { WORDS } from "./words.messages"; const TEXT = WORDS.vi; const translate = (key: string) => (TEXT[key] ?? key).replace(/x/g, ""); ' + item.source + item.expression + '));',
      }, {}, true), Object.keys(words).filter(key => !item.used.includes(key)).map(key => 'be/src/words.messages.ts:' + key).sort(), item.source);
    }
    const choices = Array.from({ length: 17 }, (_, index) => JSON.stringify('v' + index)).join(' | ');
    assert.deepEqual(findings(t, edition, {
      'be/src/words.messages.ts': 'export const WORDS = { vi: { "v0.v0.tail": "Unused" }, en: { "v0.v0.tail": "Unused" } };',
      'be/src/view.ts': 'import { WORDS } from "./words.messages"; declare const a: ' + choices + '; declare const b: ' + choices + '; WORDS.vi[`${a}.${b}.tail`];',
    }, {}, true), ['be/src/words.messages.ts:v0.v0.tail']);
  });

  test(edition + ' narrows a const producer only at a strict-null early-return use site', t => {
    assert.deepEqual(findings(t, edition, {
      'fe/src/view.ts': [
        'declare const flag: boolean;',
        'const build = t => flag ? { t } : null;',
        'const consume = ({ t }) => t("read");',
        'export const view = () => { const t = useTranslations("chosen"); const connected = build(t); if (connected === null) return null; consume(connected); };',
      ].join('\n'),
    }, { chosen: { read: 'Live', unused: 'Unused' }, unrelated: { read: 'Unused' } }),
    ['chosen.unused', 'unrelated.read']);
  });

  test(edition + ' retains null and unknown barriers without an exact immutable use-site guard', t => {
    const cases = [
      'const connected = build(t); consume(connected);',
      'const connected = build(t); consume(connected); if (connected === null) return;',
      'const connected = build(t); if (connected === null) console.log("empty"); consume(connected);',
      'let connected = build(t); if (connected === null) return; connected = build(t); consume(connected);',
      'const connected = build(t); if (other === null) return; consume(connected);',
      'const connected = build(t); if (connected === null) return; const later = () => consume(connected); later();',
      'const connected = build(t); function shadow(connected) { if (connected === null) return; } consume(connected);',
      'const connected = flag ? build(t) : opaque; if (connected === null) return; consume(connected);',
      'const connected = flag ? build(t) : cycle(); if (connected === null) return; consume(connected);',
    ];
    for (const source of cases) {
      assert.deepEqual(findings(t, edition, {
        'fe/src/view.ts': [
          'declare const flag: boolean; declare const opaque: any; declare const other: any;',
          'const build = t => flag ? { t } : null; const consume = ({ t }) => t("read"); function cycle() { return cycle(); }',
          'export const view = () => { const t = useTranslations("chosen"); ' + source + ' };',
        ].join('\n'),
      }, { chosen: { read: 'Unproved', unused: 'Unused' }, unrelated: { read: 'Unused' } }),
      ['chosen.read', 'chosen.unused', 'unrelated.read'], source);
    }
  });

  test(edition + ' retains only the same known bundle locale siblings after a one-locale read', t => {
    assert.deepEqual(findings(t, edition, {
      'be/src/words.messages.ts': 'export const WORDS = { vi: { read: "Vietnamese", unused: "Unused" }, en: { read: "English", unused: "Unused" } };',
      'be/src/other.messages.ts': 'export const OTHER = { vi: { read: "Unrelated" }, en: { read: "Unrelated" } };',
      'be/src/view.ts': 'import { WORDS } from "./words.messages"; const text = WORDS.vi["read"]; export const rendered = text;',
    }, {}, true), ['be/src/other.messages.ts:read', 'be/src/words.messages.ts:unused']);
  });

  test(edition + ' follows finite numeric-key tables without admitting unknown table writers', t => {
    const cases = [
      { table: '{ 7: "since7", 30: "since30", 90: "since90" }', used: true },
      { table: '{ 7: "since7", 30: "since30", 90: "since90", ...opaque }', used: false },
      { table: '{ 7: "since7", 30: "since30", 90: "since90", [key]: "unknown" }', used: false },
    ];
    for (const item of cases) {
      assert.deepEqual(findings(t, edition, {
        'fe/src/view.ts': [
          'declare const opaque: any; declare const key: string;',
          'const DAYS: ReadonlyArray<number> = [7, 30, 90]; const KEYS = ' + item.table + ';',
          'const t = useTranslations("connectorImap"); DAYS.map(days => t(KEYS[days]));',
        ].join('\n'),
      }, { connectorImap: { since7: 'Live', since30: 'Live', since90: 'Live', unused: 'Unused' }, unrelated: { since7: 'Unused' } }),
      ['connectorImap.unused', 'unrelated.since7', ...(item.used ? [] : ['connectorImap.since7', 'connectorImap.since30', 'connectorImap.since90'])].sort(), item.table);
    }
  });

  test(edition + ' narrows an exact immutable property only in its strict-null conditional branch', t => {
    const cases = [
      { source: 'const p = { drawer: build(t), other: null }; return p.drawer === null ? null : <Leaf props={p.drawer} />;', used: true },
      { source: 'const p = { drawer: build(t) }; return p.drawer !== null ? <Leaf props={p.drawer} /> : null;', used: true },
      { source: 'const p = { drawer: build(t), other: null }; return p.other === null ? null : <Leaf props={p.drawer} />;', used: false },
      { source: 'const p = { drawer: build(t) }; return p.drawer === null ? <Leaf props={p.drawer} /> : null;', used: false },
      { source: 'const p = { drawer: build(t) }; return <Leaf props={p.drawer} />;', used: false },
      { source: 'const p = { drawer: build(t) }; return p.drawer === null ? null : (p.drawer = null, <Leaf props={p.drawer} />);', used: false },
      { source: 'const p = { drawer: build(t) }; return p.drawer === null ? null : ([p.drawer] = [null], <Leaf props={p.drawer} />);', used: false },
      { source: 'const p = { drawer: build(t) }; return p.drawer === null ? null : ({ value: p.drawer } = { value: null }, <Leaf props={p.drawer} />);', used: false },
      { source: 'const p = { drawer: build(t) }; return p.drawer === null ? null : ([p.drawer = null] = [], <Leaf props={p.drawer} />);', used: false },
      { source: 'const p = { drawer: build(t) }; return p.drawer === null ? null : ([...p.drawer] = [], <Leaf props={p.drawer} />);', used: false },
      { source: 'const p = { drawer: build(t) }; return p.drawer === null ? null : ({ ...p.drawer } = {}, <Leaf props={p.drawer} />);', used: false },
      { source: 'const p = { drawer: build(t) }; return p.drawer === null ? null : (p.drawer++, <Leaf props={p.drawer} />);', used: false },
      { source: 'const p = { drawer: build(t) }; return p.drawer === null ? null : ((() => { for (p.drawer of [null]) {} })(), <Leaf props={p.drawer} />);', used: false },
      { source: 'const p = { drawer: build(t) }; return p.drawer === null ? null : ((() => { for (p.drawer in {}) {} })(), <Leaf props={p.drawer} />);', used: false },
      { source: 'const p = { panel: { drawer: build(t) } }; return p.panel.drawer === null ? null : (p.panel = { drawer: null }, <Leaf props={p.panel.drawer} />);', used: false },
      { source: 'const p = { panel: { drawer: build(t) } }; return p.panel.drawer === null ? null : ([p.panel] = [{ drawer: null }], <Leaf props={p.panel.drawer} />);', used: false },
      { source: 'const p = { drawer: build(t), other: null }; return p.drawer === null ? null : ([p.other] = [null], <Leaf props={p.drawer} />);', used: true },
      { source: 'const p = { drawer: build(t) }; p.drawer = opaque; return p.drawer === null ? null : <Leaf props={p.drawer} />;', used: false },
      { source: 'const p = { panel: { drawer: build(t) } }; p.panel = { drawer: opaque }; return p.panel.drawer === null ? null : <Leaf props={p.panel.drawer} />;', used: false },
      { source: 'const p = { drawer: build(t), other: null }; p.other = opaque; return p.drawer === null ? null : <Leaf props={p.drawer} />;', used: true },
      { source: 'const p = { drawer: build(t) }; return (p.drawer = opaque, p.drawer === null ? null : <Leaf props={p.drawer} />);', used: false },
      { source: 'const p = { panel: { drawer: build(t) } }; return (p.panel = { drawer: opaque }, p.panel.drawer === null ? null : <Leaf props={p.panel.drawer} />);', used: false },
      { source: 'const p = { drawer: build(t), other: null }; return (p.other = opaque, p.drawer === null ? null : <Leaf props={p.drawer} />);', used: true },
      { source: 'const p = { drawer: build(t) }; const render = () => (p.drawer = opaque, p.drawer === null ? null : <Leaf props={p.drawer} />); return render();', used: false },
      { source: 'const p = { drawer: build(t), other: null }; const render = () => (p.other = opaque, p.drawer === null ? null : <Leaf props={p.drawer} />); return render();', used: true },
      { source: 'const p = { drawer: build(t) }; for (p.drawer = opaque; flag;) { return p.drawer === null ? null : <Leaf props={p.drawer} />; }', used: false },
      { source: 'const p = { drawer: build(t) }; while ((p.drawer = opaque, flag)) { return p.drawer === null ? null : <Leaf props={p.drawer} />; }', used: false },
      { source: 'let p = { drawer: build(t) }; return p.drawer === null ? null : <Leaf props={p.drawer} />;', used: false },
      { source: 'const p = { drawer: flag ? build(t) : opaque }; return p.drawer === null ? null : <Leaf props={p.drawer} />;', used: false },
    ];
    for (const item of cases) {
      assert.deepEqual(findings(t, edition, {
        'fe/src/view.tsx': [
          'declare const flag: boolean; declare const opaque: any;',
          'const build = t => flag ? { t } : null; const Leaf = ({ props: { t } }) => t("read");',
          'export const view = () => { const t = useTranslations("chosen"); ' + item.source + ' };',
        ].join('\n'),
      }, { chosen: { read: 'Live', unused: 'Unused' }, unrelated: { read: 'Unused' } }),
      ['chosen.unused', 'unrelated.read', ...(item.used ? [] : ['chosen.read'])].sort(), item.source);
    }
  });

  test(`${edition} reads keys typed as a union of literals through the standard library's array callbacks`, t => {
    assert.deepEqual(findings(t, edition, {
      'fe/src/nav.ts': [
        'type Label = "navHome" | "navLeads";',
        'interface Destination { readonly key: string; readonly label: Label }',
        'declare const DESTINATIONS: ReadonlyArray<Destination>;',
        'export const useNav = (admin: boolean) => {',
        '  const t = useTranslations("shell");',
        '  return DESTINATIONS.filter(row => admin || row.key !== "admin").map(row => t(row.label));',
        '};',
      ].join('\n'),
    }, { shell: { navHome: 'Home', navLeads: 'Leads', navTeam: 'Team' } }), ['shell.navTeam']);
  });

  test(`${edition} reads the strings of a typed table of constants through the readonly field that holds them`, t => {
    assert.deepEqual(findings(t, edition, {
      'fe/src/presets.ts': [
        'interface Step { readonly text: string; readonly link?: { readonly label: string; readonly url: string } }',
        'interface Mode { readonly id: string; readonly title: string; readonly steps: ReadonlyArray<Step> }',
        'interface Preset { readonly id: string; readonly modes: ReadonlyArray<Mode> }',
        'export const PRESETS: ReadonlyArray<Preset> = [',
        '  { id: "a", modes: [{ id: "m", title: "a_title", steps: [{ text: "a_step1", link: { label: "a_link", url: "https://a" } }, { text: "a_step2" }] }] },',
        '  { id: "b", modes: [{ id: "n", title: "b_title", steps: [{ text: "b_step1" }] }] },',
        '];',
        'export const find = (id: string): Preset => PRESETS.find(item => item.id === id) ?? PRESETS[0];',
      ].join('\n'),
      'fe/src/view.ts': [
        'import { find } from "./presets";',
        'export const useView = (id: string) => {',
        '  const say = useTranslations("presets");',
        '  const preset = find(id);',
        '  return preset.modes.map(mode => ({ title: say(mode.title), steps: mode.steps.map(step => ({ text: say(step.text), link: step.link === undefined ? null : say(step.link.label) })) }));',
        '};',
      ].join('\n'),
    }, { presets: { a_title: 'A', a_step1: 'One', a_step2: 'Two', a_link: 'Link', b_title: 'B', b_step1: 'One', unused: 'Unused' } }), ['presets.unused']);
  });

  test(`${edition} does not read a typed table through a field that can be reassigned or that no literal of the type sets`, t => {
    assert.deepEqual(findings(t, edition, {
      'fe/src/rows.ts': [
        'interface Row { label: string; readonly other: string }',
        'const ROWS: ReadonlyArray<Row> = [{ label: "mutable_key", other: "other_key" }];',
        'export const keep = ROWS;',
        'export const use = (row: Row) => { const t = useTranslations("rows"); return [t(row.label), t(row.other)]; };',
      ].join('\n'),
    }, { rows: { mutable_key: 'Mutable', other_key: 'Other', unused: 'Unused' } }), ['rows.mutable_key', 'rows.unused']);
  });

  test(`${edition} reads both sides of a nullish default and skips a null owner`, t => {
    assert.deepEqual(findings(t, edition, {
      'fe/src/kinds.ts': [
        'const KEYS: Readonly<Record<string, string>> = { ad: "refAd", form: "refForm" };',
        'export const refKey = (kind: string): string => KEYS[kind] ?? "refPost";',
        'const effectOf = (open: boolean) => ({ submitKey: open ? "adjustAsk" : "adjustApply" });',
        'export const useEffectKey = (open: boolean) => { const effect = open === undefined ? null : effectOf(open); return effect === null ? null : effect.submitKey; };',
        'export const label = (t: (key: string) => string, kind: string, open: boolean) => [t(refKey(kind)), t(useEffectKey(open) ?? "none")];',
      ].join('\n'),
      'fe/src/view.ts': 'import { label } from "./kinds"; const t = useTranslations("lead"); label(t, "ad", true);',
    }, { lead: { refAd: 'Ad', refForm: 'Form', refPost: 'Post', adjustAsk: 'Ask', adjustApply: 'Apply', none: 'None', unused: 'Unused' } }), ['lead.unused']);
  });

}
