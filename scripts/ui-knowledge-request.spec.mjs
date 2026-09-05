import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parseOperatorMd, isYes, kindOf } from './operator-md.mjs';
import { uiKnowledgeBindingsFor } from './validate-request.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('knowledge.repair expands its declared Common UI context to every UI group plus its routed family', async () => {
  const authored = parseOperatorMd(await readFile(path.join(root, 'operators', 'knowledge-repair', 'operator.md'), 'utf8'));
  const aliases = authored.tables.context.rows
    .filter((row) => isYes(row.required))
    .map((row) => kindOf(row.alias).replace('<family>', 'starci'));
  assert.ok(aliases.includes('@knowledge/ui'), 'the regression must exercise the actual Common UI owner binding');
  assert.deepEqual(uiKnowledgeBindingsFor({
    operatorId: 'knowledge.repair',
    contexts: aliases.map((alias) => ({ alias }))
  }), [
    '@knowledge/ui/composition',
    '@knowledge/ui/presentation',
    '@knowledge/ui/proof',
    '@knowledge/grammars/starci'
  ]);
});
