import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DECLARED_SOURCE_CATALOGS, sourceLanguageFindings } from '../../scripts/checks/check-doc-language.mjs';
import { declaredVietnameseFieldsOf, documentLanguageHits } from '../../scripts/lib/language.mjs';

// HFS_SOURCE_NOT_ENGLISH: runtime source is English; Vietnamese lives only in a declared catalog. Vietnamese letters in this
// file are written as \u escapes so the spec itself stays English-only ASCII.
const VI = 'h\u1ea1n cu\u1ed1i \u0111\u00e3 qua';
const fixture = (t, files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-source-language-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  for (const [rel, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); }
  return dir;
};
const found = (dir) => sourceLanguageFindings(dir).map((f) => [f.code, f.path]);

test('English source, comments, SQL comments and loanwords are clean', (t) => {
  assert.deepEqual(found(fixture(t, {
    'scripts/a.mjs': '// An English comment with naive facade Muller loanwords.\nexport const x = "ready";\n',
    'engine/db/migrations/machine/0001-init.sql': '-- the machine registry\nCREATE TABLE t(a TEXT);\n',
    'ui/src/pages/home.tsx': 'export const label = "Overview";\n',
    'tests/a.spec.mjs': "assert.equal(1, 1);\n",
  })), []);
});

test('a Vietnamese string, comment or SQL comment in source is refused, in every source root', (t) => {
  assert.deepEqual(found(fixture(t, {
    'scripts/kernel/a.mjs': `export const message = '${VI}';\n`,
    'engine/db/migrations/runtime/0001-init.sql': `-- ${VI}\nCREATE TABLE t(a TEXT);\n`,
    'ui/src/pages/home.tsx': `// ${VI}\n`,
    'packages/x/index.cjs': `/* ${VI} */\n`,
    'tests/a.spec.mjs': `assert.equal(text, '${VI}');\n`,
  })).sort(), [
    ['HFS_SOURCE_NOT_ENGLISH', 'engine/db/migrations/runtime/0001-init.sql'], ['HFS_SOURCE_NOT_ENGLISH', 'packages/x/index.cjs'],
    ['HFS_SOURCE_NOT_ENGLISH', 'scripts/kernel/a.mjs'], ['HFS_SOURCE_NOT_ENGLISH', 'tests/a.spec.mjs'], ['HFS_SOURCE_NOT_ENGLISH', 'ui/src/pages/home.tsx'],
  ]);
});

test('a declared catalog file, a bundle copy and a document are not source findings', (t) => {
  assert.deepEqual(DECLARED_SOURCE_CATALOGS, ['ui/src/i18n/', 'scripts/lib/language.mjs']);
  assert.deepEqual(found(fixture(t, {
    'ui/src/i18n/vi.ts': `export const nav = { overview: '${VI}' };\n`,
    'packages/hfs/runtime/scripts/lib/x.mjs': `// ${VI}\n`,
    'docs/note.md': `${VI}\n`,
    'scripts/machine/ask-recommendation.mjs': `const MARK = /(${VI})/u;\n`,
  })), []);
  assert.deepEqual(found(fixture(t, { 'scripts/machine/other.mjs': `const MARK = /(${VI})/u;\n` })), [['HFS_SOURCE_NOT_ENGLISH', 'scripts/machine/other.mjs']]);
});

test('the i18n catalog files declare their vi field, so a catalog is the one place Vietnamese is allowed in YAML', () => {
  const rel = 'modules/i18n/messages/common.yaml';
  assert.deepEqual([...declaredVietnameseFieldsOf(rel).fields], ['vi']);
  assert.deepEqual(documentLanguageHits(rel, `messages:\n  - {en: "Open", vi: "M\u1edf"}\n`), []);
  assert.deepEqual(documentLanguageHits(rel, `messages:\n  - {en: "Open, then close", vi: "M\u1edf, r\u1ed3i \u0111\u00f3ng"}\n`), [], 'a comma inside the quoted vi value stays inside the declared field');
  assert.equal(documentLanguageHits('modules/i18n/other.yaml', `note: ${VI}\n`).length, 1);
  assert.equal(documentLanguageHits(rel, `purpose: ${VI}\n`).length, 1);
});
