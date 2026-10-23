// The stacks gate and the provision target owner compose the `operations` schema from the runtime copy @starci/hfs ships.
// That copy once lacked provision-operation.schema.yaml (read through a skillRoot join, which sync-runtime does not follow),
// so `starci app check` failed with ENOENT in every installed app whose stack declaration has an operations block.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PROVISION_OPERATION_SCHEMA_REF, provisionOperationSchema } from '../runtime/scripts/lib/provision-operation-schema.mjs';

test('the bundled runtime carries both schemas the operations block is composed from', () => {
  for (const name of [PROVISION_OPERATION_SCHEMA_REF, 'application-stacks.schema.yaml']) {
    assert.ok(fs.existsSync(new URL(`../runtime/modules/schemas/${name}`, import.meta.url)), `${name} is in the bundled runtime`);
  }
});

test('the bundled composition inlines the service credential the operations schema refers to', () => {
  const schema = provisionOperationSchema();
  assert.equal(typeof schema, 'object');
  assert.ok(schema.$defs.serviceCredential, 'serviceCredential is inlined from application-stacks.schema.yaml');
});
