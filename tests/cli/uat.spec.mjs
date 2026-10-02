import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { CATALOG as catalog } from '../../packages/cli/src/catalog.generated.mjs';
import { main } from '../../scripts/cli/main.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const verbs = {
  'assisted-runner': ['actor', 'after', 'receipt', 'request', 'value'],
  slots: ['record-dir'],
};

test('uat catalog resolves handlers and declares their parsed flags', () => {
  assert.deepEqual(Object.keys(catalog.groups.uat.verbs).sort(), Object.keys(verbs).sort());
  for (const [verb, flags] of Object.entries(verbs)) {
    const command = catalog.groups.uat.verbs[verb];
    assert.equal(fs.existsSync(path.join(root, command.impl.script)), true, command.impl.script);
    assert.deepEqual(command.flags.map((flag) => flag.name).sort(), flags);
  }
});

test('uat dispatches the assisted runner through the injected runtime seam', () => {
  let call;
  assert.equal(main(['uat', 'assisted-runner', 'inspect', '--request', 'request.yaml', '--receipt', 'receipt.yaml', '--json'], {
    catalog,
    runScript: (script, args) => { call = { script, args }; return 0; },
  }), 0);
  assert.match(call.script, /scripts[\\/]uat[\\/]assisted-runner\.mjs$/);
  assert.deepEqual(call.args, ['inspect', '--request', 'request.yaml', '--receipt', 'receipt.yaml']);
});
