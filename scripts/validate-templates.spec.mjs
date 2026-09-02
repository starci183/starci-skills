import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { validateTree } from './validate-templates.mjs';

// A synthetic tree: one template of each shape the validator understands, and documents that
// satisfy or break it in exactly one way each.
const contractOf = (kind, contract) => `# ${kind}\n\n\`\`\`json template-contract\n${JSON.stringify({ kind, ...contract }, null, 2)}\n\`\`\`\n`;

const opContract = {
  applies: ['ops/*/execute.md'],
  title: { en: '^# Execute `[a-z.]+`$', vi: '^# Thực thi `[a-z.]+`$' },
  sections: [
    { en: '^## Single job$', vi: '^## Một việc duy nhất$' },
    { free: true },
    { en: '^## Sequence$', vi: '^## Trình tự$', table: { en: '| # | Step | Reads | Writes | Stops with |', vi: '| # | Bước | Đọc | Ghi | Dừng với |' } },
    { en: '^## Mandatory attacks$', vi: '^## Các đòn tấn công bắt buộc$' },
  ],
  rules: null,
};
const ruleContract = {
  applies: ['kb/**/*.md'],
  title: { en: '^# .+ proof$', vi: '^# .+ proof$' },
  sections: [],
  rules: {
    heading: '^## [A-Z]+-\\d+ — .+$',
    table: { en: '| Case | When | Observe |', vi: '| Case | Dùng khi | Quan sát |' },
    closing: { en: '^## What this file does not decide$', vi: '^## File này không quyết định$' },
    required: true,
  },
};

const goodExecute = (lang) => (lang === 'en'
  ? '# Execute `x.y`\n\n## Single job\n\ntext\n\n## A law\n\ntext\n\n## Sequence\n\n| # | Step | Reads | Writes | Stops with |\n| --- | --- | --- | --- | --- |\n| 1 | a | b | c | d |\n\n## Mandatory attacks\n\n- one\n'
  : '# Thực thi `x.y`\n\n## Một việc duy nhất\n\ntext\n\n## Một luật\n\ntext\n\n## Trình tự\n\n| # | Bước | Đọc | Ghi | Dừng với |\n| --- | --- | --- | --- | --- |\n| 1 | a | b | c | d |\n\n## Các đòn tấn công bắt buộc\n\n- one\n');
const goodProof = (lang) => (lang === 'en'
  ? '# Focus proof\n\nintro\n\n## FOCUS-1 — Visible focus\n\nline\n\n| Case | When | Observe |\n| --- | --- | --- |\n| Case 1 | a | b |\n\n## What this file does not decide\n\nlinks\n'
  : '# Focus proof\n\nintro\n\n## FOCUS-1 — Focus nhìn thấy\n\nline\n\n| Case | Dùng khi | Quan sát |\n| --- | --- | --- |\n| Case 1 | a | b |\n\n## File này không quyết định\n\nlinks\n');

function tree(mutate = () => {}) {
  const root = mkdtempSync(join(tmpdir(), 'templates-'));
  mkdirSync(join(root, 'templates'));
  mkdirSync(join(root, 'ops', 'one'), { recursive: true });
  mkdirSync(join(root, 'kb', 'proof'), { recursive: true });
  writeFileSync(join(root, 'templates', 'execute.template.md'), contractOf('execute', opContract));
  writeFileSync(join(root, 'templates', 'proof.template.md'), contractOf('proof', ruleContract));
  const files = {
    'ops/one/execute.md': goodExecute('en'),
    'ops/one/execute.vi.md': goodExecute('vi'),
    'kb/proof/focus.md': goodProof('en'),
    'kb/proof/focus.vi.md': goodProof('vi'),
    'kb/proof/INDEX.md': '# index\n\nnot a document of a kind\n',
  };
  mutate(files);
  for (const [rel, text] of Object.entries(files)) {
    if (text === null) continue;
    writeFileSync(join(root, rel), text);
  }
  return root;
}

async function run(mutate) {
  const root = tree(mutate);
  try {
    return await validateTree(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('conforming documents pass, INDEX files are not claimed, and both languages are counted', async () => {
  const result = await run();
  assert.deepEqual(result.errors, []);
  assert.equal(result.checked, 4);
  assert.equal(result.templates, 2);
});

test('a missing required section is named', async () => {
  const result = await run((f) => { f['ops/one/execute.md'] = f['ops/one/execute.md'].replace('## Mandatory attacks\n\n- one\n', ''); });
  assert.ok(result.errors.some((e) => e.includes('ops/one/execute.md') && e.includes('missing section ^## Mandatory attacks$')));
});

test('a section outside a free zone is rejected with its line', async () => {
  const result = await run((f) => { f['ops/one/execute.md'] = f['ops/one/execute.md'].replace('# Execute `x.y`\n\n', '# Execute `x.y`\n\n## Preface\n\ntext\n\n'); });
  assert.ok(result.errors.some((e) => /ops\/one\/execute\.md:3: unexpected section "## Preface"/.test(e)));
});

test('a section table with the wrong header is rejected', async () => {
  const result = await run((f) => { f['ops/one/execute.md'] = f['ops/one/execute.md'].replace('| # | Step | Reads | Writes | Stops with |', '| Step | Notes |').replace('| --- | --- | --- | --- | --- |', '| --- | --- |'); });
  assert.ok(result.errors.some((e) => e.includes('section must open with the table | # | Step | Reads | Writes | Stops with |')));
});

test('a rule with the wrong table, two tables, or no table is rejected', async () => {
  const wrong = await run((f) => { f['kb/proof/focus.md'] = f['kb/proof/focus.md'].replace('| Case | When | Observe |', '| Case | When | Decide |'); });
  assert.ok(wrong.errors.some((e) => e.includes('rule table must be | Case | When | Observe |')));
  const two = await run((f) => { f['kb/proof/focus.md'] = f['kb/proof/focus.md'].replace('| Case 1 | a | b |\n', '| Case 1 | a | b |\n\n| Case | When | Observe |\n| --- | --- | --- |\n| Case 2 | c | d |\n'); });
  assert.ok(two.errors.some((e) => e.includes('exactly one table, found 2')));
  const none = await run((f) => { f['kb/proof/focus.md'] = f['kb/proof/focus.md'].replace('| Case | When | Observe |\n| --- | --- | --- |\n| Case 1 | a | b |\n', ''); });
  assert.ok(none.errors.some((e) => e.includes('exactly one table, found 0')));
});

test('the closing section must come last and a rule file must publish a rule', async () => {
  const notLast = await run((f) => { f['kb/proof/focus.md'] = `${f['kb/proof/focus.md']}\n## Afterword\n\ntext\n`; });
  assert.ok(notLast.errors.some((e) => e.includes('last section must be ^## What this file does not decide$')));
  const noRule = await run((f) => { f['kb/proof/focus.md'] = '# Focus proof\n\nintro\n\n## What this file does not decide\n\nlinks\n'; });
  assert.ok(noRule.errors.some((e) => e.includes('publishes no rule heading')));
});

test('a title outside the pattern is rejected in either language', async () => {
  const result = await run((f) => { f['ops/one/execute.vi.md'] = f['ops/one/execute.vi.md'].replace('# Thực thi `x.y`', '# Execute `x.y`'); });
  assert.ok(result.errors.some((e) => e.includes('ops/one/execute.vi.md:1: title must match')));
});

test('a missing Vietnamese mirror is rejected and the English document is still checked', async () => {
  const result = await run((f) => { f['kb/proof/focus.vi.md'] = null; });
  assert.ok(result.errors.some((e) => e.includes('no Vietnamese mirror kb/proof/focus.vi.md')));
  assert.equal(result.checked, 3);
});

test('a template whose kind does not match its file name is refused', async () => {
  const root = tree();
  writeFileSync(join(root, 'templates', 'other.template.md'), contractOf('mismatch', ruleContract));
  await assert.rejects(() => validateTree(root), /contract\.kind must equal the file name/);
  rmSync(root, { recursive: true, force: true });
});
