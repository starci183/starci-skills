import test from 'node:test';
import assert from 'node:assert/strict';
import { backendPlanUnitOperations } from '../operators/backend-plan/validate.mjs';

const plan = `# backend-plan — fixture

## Modules

| Module | Goal | Operations | Stores | Proof kinds |
| --- | --- | --- | --- | --- |
| schema | Upgrade schema | \`migrate-records\` | records | migration |
| commands | Implement commands | \`create-record\`, \`update-record\` | records | concurrency |

## Order

| Module | After |
| --- | --- |
| schema | — |
| commands | schema |
`;

test('backend unit projection separates a prerequisite migration from dependent command obligations', () => {
  assert.deepEqual(backendPlanUnitOperations(plan, 'schema'), ['migrate-records']);
  assert.deepEqual(backendPlanUnitOperations(plan, 'commands'), ['create-record', 'update-record']);
  assert.throws(() => backendPlanUnitOperations(plan, 'records'), /exactly one/);
  assert.throws(() => backendPlanUnitOperations(plan, ''), /exactly one/);
});

test('ambiguous module rows cannot select a smaller operation set', () => {
  const duplicate = plan.replace('| commands | Implement commands', '| schema | Implement commands');
  assert.throws(() => backendPlanUnitOperations(duplicate, 'schema'), /exactly one/);
});
