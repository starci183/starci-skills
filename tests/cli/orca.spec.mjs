import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { CATALOG as catalog } from '../../packages/cli/src/catalog.generated.mjs';


const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const verbs = {
  'terminal-read': ['limit', 'tail', 'terminal'],
  'terminal-send': ['no-enter', 'terminal', 'text', 'text-file', 'wait-submit'],
};

test('orca catalog resolves wrappers and declares their parsed flags', () => {
  assert.deepEqual(Object.keys(catalog.groups.orca.verbs).sort(), Object.keys(verbs).sort());
  for (const [verb, flags] of Object.entries(verbs)) {
    const command = catalog.groups.orca.verbs[verb];
    assert.equal(fs.existsSync(path.join(root, command.impl.script)), true, command.impl.script);
    assert.deepEqual(command.flags.map((flag) => flag.name).sort(), flags);
  }
});
