import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { CATALOG as catalog } from '../../packages/cli/src/catalog.generated.mjs';
import { main } from '../../scripts/cli/main.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('route catalog resolves op and declares its parsed flags', () => {
  assert.deepEqual(Object.keys(catalog.groups.route.verbs), ['op']);
  const command = catalog.groups.route.verbs.op;
  assert.equal(fs.existsSync(path.join(root, command.impl.script)), true, command.impl.script);
  assert.deepEqual(command.flags.map((flag) => flag.name).sort(), ['intent', 'kind', 'node-kind', 'ops-dir', 'phase']);
});

test('route op dispatches through the injected runtime seam', () => {
  let call;
  assert.equal(main(['route', 'op', '--node-kind', 'ui', '--intent', 'implement', '--json'], {
    catalog,
    runScript: (script, args) => { call = { script, args }; return 0; },
  }), 0);
  assert.match(call.script, /scripts[\\/]route[\\/]route-op\.mjs$/);
  assert.deepEqual(call.args, ['--node-kind', 'ui', '--intent', 'implement', '--json']);
});
