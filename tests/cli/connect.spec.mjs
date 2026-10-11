import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { CATALOG as catalog } from '../../packages/cli/src/catalog.generated.mjs';


const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const verbs = {
  'ask-gateway': ['port', 'repo'],
  'telegram-media': ['attempt', 'dispatch', 'job', 'ledger', 'op', 'repo', 'verdict', 'workflow'],
  telegram: ['discover-chat', 'dispatch', 'ledger', 'repo', 'workflow'],
  tunnel: ['fast', 'port'],
};

test('connect catalog resolves handlers and declares their parsed flags', () => {
  assert.deepEqual(Object.keys(catalog.groups.connect.verbs).sort(), Object.keys(verbs).sort());
  for (const [verb, flags] of Object.entries(verbs)) {
    const command = catalog.groups.connect.verbs[verb];
    assert.equal(fs.existsSync(path.join(root, command.impl.script)), true, command.impl.script);
    assert.deepEqual(command.flags.map((flag) => flag.name).sort(), flags);
  }
});
