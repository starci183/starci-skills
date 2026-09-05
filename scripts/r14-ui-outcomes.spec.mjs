import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { checkDocument, loadKindTemplates, loadTemplates } from './validate-templates.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uiOperators = ['interface-plan', 'interface-generate', 'interface-fix', 'interface-audit', 'library-update', 'knowledge-repair'];

test('all UI-owned operator mirrors declare their reviewable best outcome', async () => {
  const contract = (await loadTemplates(root)).find((candidate) => candidate.kind === 'operator');
  for (const id of uiOperators) {
    for (const [name, lang] of [['operator.md', 'en'], ['operator.vi.md', 'vi']]) {
      const rel = `operators/${id}/${name}`;
      assert.deepEqual(checkDocument(rel, await readFile(path.join(root, rel), 'utf8'), contract, lang), []);
    }
  }
});

test('the direction skeleton carries the selected candidate to served-source to PNG linkage', async () => {
  const contract = (await loadKindTemplates(root)).get('frontend-direction-decision');
  assert.deepEqual(checkDocument(contract.skeleton, await readFile(path.join(root, contract.skeleton), 'utf8'), contract, 'en'), []);
});
