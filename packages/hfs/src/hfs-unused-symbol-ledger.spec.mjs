// proves: HFS_UNUSED_SYMBOL@lite HFS_UNUSED_SYMBOL@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { unusedSymbolFindings } from '../runtime/scripts/hfs/rules/unused-symbol.mjs';

function fixture(t, contents) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-unused-ledger-'));
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  for (const [file, text] of Object.entries(contents)) {
    const target = path.join(repoRoot, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
  return { repoRoot, files: Object.keys(contents), ts };
}

const LEDGER = 'i18n-dynamic-keys.yaml';
const ledger = namespaces => `schema: starci/i18n-dynamic-keys@1\nnamespaces:\n${namespaces}`;
const FE = {
  'apps/web/src/modules/i18n/messages/en.json': JSON.stringify({ hiring: { title: 'T', applyWebsite: 'A', weekday_1: 'M', weekday_2: 'T', salaryHint: 'S', orphan: 'O' }, plain: 'P' }),
  'apps/web/src/features/hiring.tsx': 'const t = useTranslations("hiring"); export const title = t("title");',
};
const BE = {
  'src/modules/domain/orders/messages/orders.messages.ts': `export const ORDER_MESSAGES = {
vi: { "orders.created": "C", "orders.dynamicOne": "D", "orders.day_1": "1", "orders.sizeHint": "H", "orders.orphan": "O" },
en: { "orders.created": "C", "orders.dynamicOne": "D", "orders.day_1": "1", "orders.sizeHint": "H", "orders.orphan": "O" }
};`,
  'src/modules/domain/orders/orders.service.ts': 'export function greet(messages: any) { return messages.get("orders.created"); }',
};
const SIDES = {
  fe: { files: FE, ledgerPath: LEDGER, covered: ['hiring.applyWebsite', 'hiring.weekday_1', 'hiring.weekday_2', 'hiring.salaryHint'],
    entries: '  hiring:\n    - {key: applyWebsite, reason: "wrapper hook"}\n    - {prefix: weekday_, reason: "built as weekday_N"}\n    - {suffix: Hint, reason: "composed"}\n',
    open: ['hiring.orphan', 'plain'] },
  be: { files: BE, ledgerPath: LEDGER, covered: ['orders.dynamicOne', 'orders.day_1', 'orders.sizeHint'],
    entries: '  orders:\n    - {key: dynamicOne, reason: "wrapper"}\n    - {prefix: day_, reason: "built"}\n    - {suffix: Hint, reason: "composed"}\n',
    open: ['orders.orphan'] },
};
const run = (t, side, extra, edition) => unusedSymbolFindings({ ...fixture(t, { ...SIDES[side].files, ...extra }), repo: { profile: side, edition } });
const names = findings => [...new Set(findings.map(finding => finding.name))].sort();

for (const side of ['fe', 'be']) for (const edition of ['lite', 'full']) {
  const { entries, covered, open } = SIDES[side];
  test(`HFS_UNUSED_SYMBOL ${side} ${edition}: without a ledger every unread key is a violation (no file, no finding of its own)`, t => {
    const found = names(run(t, side, {}, edition));
    for (const key of [...covered, ...open]) assert.ok(found.includes(key), key);
    assert.ok(found.every(name => !name.includes('ledger')));
  });

  test(`HFS_UNUSED_SYMBOL ${side} ${edition}: keys named by key, prefix and suffix entries pass as read; unlisted keys are still a violation`, t => {
    const findings = run(t, side, { [LEDGER]: ledger(entries) }, edition);
    assert.deepEqual(names(findings), open.slice().sort());
  });

  test(`HFS_UNUSED_SYMBOL ${side} ${edition}: a stale entry is a violation of the same code and names file, namespace and entry`, t => {
    const ns = entries.split('\n')[0].trim().replace(':', '');
    const findings = run(t, side, { [LEDGER]: ledger(`${entries}    - {key: gone, reason: "old"}\n`) }, edition);
    const stale = findings.filter(finding => finding.path === LEDGER);
    assert.equal(stale.length, 1);
    assert.equal(stale[0].code, 'HFS_UNUSED_SYMBOL');
    assert.match(stale[0].message, new RegExp(`${LEDGER}.*key "gone" in namespace "${ns}" matches no catalog key; delete it`, 'u'));
  });

  test(`HFS_UNUSED_SYMBOL ${side} ${edition}: a malformed ledger is a violation, reported precisely`, t => {
    const bad = {
      'schema: starci/other@1\nnamespaces: {}\n': /schema must be starci\/i18n-dynamic-keys@1/u,
      [ledger('  a:\n    - {key: x}\n')]: /entry 1 must have a non-empty string reason/u,
      [ledger('  a:\n    - {key: x, prefix: y, reason: r}\n')]: /exactly one of key, prefix or suffix \(has key and prefix\)/u,
      [ledger('  a:\n    - {reason: r}\n')]: /exactly one of key, prefix or suffix \(has none\)/u,
      [ledger('  a:\n    - {key: x, reason: r, extra: 1}\n')]: /unknown field "extra"/u,
      [ledger('  a:\n    - {key: 3, reason: r}\n')]: /key must be a non-empty string/u,
      [ledger('  a: {key: x}\n')]: /namespace "a" must be a list/u,
      'schema: starci/i18n-dynamic-keys@1\nextra: 1\nnamespaces: {}\n': /unknown top-level field "extra"/u,
      'schema: [\n': /not valid YAML/u,
    };
    for (const [text, pattern] of Object.entries(bad)) {
      const own = run(t, side, { [LEDGER]: text }, edition).filter(finding => finding.path === LEDGER);
      assert.ok(own.length >= 1 && own.every(finding => finding.code === 'HFS_UNUSED_SYMBOL'), text);
      assert.ok(own.some(finding => pattern.test(finding.message)), `${text} -> ${own.map(finding => finding.message)}`);
    }
  });
}

test('HFS_UNUSED_SYMBOL ledger: a catalog without namespaces uses the empty namespace', t => {
  const findings = run(t, 'fe', { [LEDGER]: ledger("  '':\n    - {key: plain, reason: r}\n") }, 'full');
  assert.ok(!names(findings).includes('plain'));
  assert.ok(!findings.some(finding => finding.path === LEDGER));
});

test('HFS_UNUSED_SYMBOL ledger: an entry only covers its own namespace', t => {
  const findings = run(t, 'fe', { [LEDGER]: ledger('  other:\n    - {key: applyWebsite, reason: r}\n') }, 'full');
  assert.ok(names(findings).includes('hiring.applyWebsite'));
  assert.ok(findings.some(finding => finding.path === LEDGER && /namespace "other"/u.test(finding.message)));
});

test('HFS_UNUSED_SYMBOL ledger: a side without a profile of fe or be ignores the ledger', t => {
  const findings = unusedSymbolFindings({ ...fixture(t, { ...FE, [LEDGER]: 'garbage: [' }), repo: { profile: 'app', edition: 'full' } });
  assert.ok(!findings.some(finding => finding.path === LEDGER));
});
