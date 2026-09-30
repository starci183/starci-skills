import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { archFixture, runArch, findings } from './_hfs-arch-fixture.mjs';
import { docLanguageFindings } from '../scripts/checks/check-doc-language.mjs';
import { documentLanguageHits, hasSecondLanguage } from '../scripts/lib/language.mjs';

// R96 doc-language (HFS_DOC_NOT_ENGLISH): Markdown and YAML under knowledge/, docs/, src/ and apps/ are English, code fences
// included; only YAML data in a message-catalog or i18n-fixtures slot may hold another language. Vietnamese letters in this file
// are written as \u escapes so the spec itself stays English-only ASCII.
const VI = 'h\u1EA1n cu\u1ED1i \u0111\u00E3 qua';
const VI_NFD = VI.normalize('NFD');
const CLEAN = {
  'apps/web/src/modules/config/index.ts': 'export const config = 1;\n',
  'docs/guide.md': '# Guide\n\nAll prose is English, and so is `code`.\n\n```ts\nconst deadline = "passed";\n```\n',
  'knowledge/notes.yaml': 'summary: An English sentence, with naive facade Muller loanwords.\n',
};
const hits = report => findings(report, 'HFS_DOC_NOT_ENGLISH');
const run = (t, extra = {}) => runArch(archFixture(t, { profile: 'fe', files: { ...CLEAN, ...extra } }));

test('English documents, loanwords and a YAML catalog in an i18n slot raise no HFS_DOC_NOT_ENGLISH', t => {
  const report = run(t, { 'apps/web/src/modules/i18n/messages/vi.yaml': `greeting: ${VI}\n` });
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  assert.equal(report.coverage.hfsMachine.docLanguage.status, 'checked');
  assert.ok(report.coverage.checkedRuleIds.includes('HFS_DOC_NOT_ENGLISH'));
});

test('Vietnamese prose, a Markdown code fence, a YAML value and a decomposed spelling are HFS_DOC_NOT_ENGLISH', t => {
  const report = run(t, {
    'docs/prose.md': `# Title\n\n${VI}\n`,
    'docs/fence.md': `# Example\n\n\`\`\`ts\nconst message = "${VI}";\n\`\`\`\n`,
    'knowledge/vi.yaml': `summary: ${VI}\n`,
    'knowledge/nfd.yaml': `summary: ${VI_NFD}\n`,
    // Markdown is prose, never catalogue data: a README in an i18n slot is judged like any document
    'apps/web/src/modules/i18n/README.md': `${VI}\n`,
  });
  const at = hits(report).map(item => `${item.path}:${item.line}`).sort();
  assert.deepEqual(at, ['apps/web/src/modules/i18n/README.md:1', 'docs/fence.md:4', 'docs/prose.md:3', 'knowledge/nfd.yaml:1', 'knowledge/vi.yaml:1']);
});

test('the failure-code catalog exempts only its declared Vietnamese fields, not its English ones', () => {
  const rel = 'modules/kernel/failure-codes.yaml';
  const entry = ['SAMPLE_CODE:', '  title: "Sample"', `  title_vi: "${VI}"`, `  meaning_vi: "${VI}"`, '  causes_vi:', `    - "${VI}"`, `  nextStep_vi: "${VI}"`, '  owner: op-retry'].join('\n');
  assert.deepEqual(documentLanguageHits(rel, `${entry}\n`), []);
  assert.deepEqual(documentLanguageHits(rel, `${entry}\n  title: "${VI}"\n`).map(hit => hit.line), [9]);
  // the same fields in any other file are hits: the exception is declared for that one file's typed entry
  assert.equal(documentLanguageHits("modules/other.yaml", entry).length, 4);
});

test('detection is structural on characters: NFC and NFD are caught, loanwords are not', () => {
  assert.equal(hasSecondLanguage(VI), true);
  assert.equal(hasSecondLanguage(VI_NFD), true);
  assert.equal(hasSecondLanguage('\u0110'), true);
  assert.equal(hasSecondLanguage('naive facade Muller resume'), false);
});

// The runtime repository's own `npm run check` gate (scripts/checks/check-doc-language.mjs): same law, same detection.
const runtimeTree = (t, files) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-language-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
};

test('the runtime gate passes English documents, the failure-code catalog fields and a bundle copy (HFS_DOC_NOT_ENGLISH)', t => {
  const root = runtimeTree(t, {
    'docs/guide.md': '# Guide\n\nEnglish only.\n',
    'modules/kernel/failure-codes.yaml': `SAMPLE:\n  title: "Sample"\n  title_vi: "${VI}"\n  causes_vi:\n    - "${VI}"\n`,
    'packages/hfs/runtime/knowledge/copy.yaml': `note: ${VI}\n`,
    'src/ignored.md': `${VI}\n`,
  });
  assert.deepEqual(docLanguageFindings(root), []);
});

test('the runtime gate refuses Vietnamese in docs, modules, packages and examples (HFS_DOC_NOT_ENGLISH)', t => {
  const root = runtimeTree(t, {
    'docs/guide.md': `# Guide\n\n${VI}\n`,
    'modules/kernel/failure-codes.yaml': `SAMPLE:\n  title: "${VI}"\n`,
    'packages/eslint/fe/docs/rule.md': `${VI_NFD}\n`,
    'examples/app/README.md': `${VI}\n`,
  });
  assert.deepEqual(docLanguageFindings(root).map(item => `${item.path}:${item.line}`).sort(),
    ['docs/guide.md:3', 'examples/app/README.md:1', 'modules/kernel/failure-codes.yaml:2', 'packages/eslint/fe/docs/rule.md:1']);
});
