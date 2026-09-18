import { test } from '@playwright/test';
import { readFlowRecord, skipReason } from '../lib/flow-records';

const FEATURE = 'plan';
const FLOW = 'upgrade-after-cap';
const record = readFlowRecord(FEATURE, FLOW);

/**
 * uat.plan.upgrade-after-cap - blocked by the record's own `blockedBy`
 * (examples/todo-app-backend/.starciwork/features/plan/uat/upgrade-after-cap/index.yaml):
 *   1. Sign in as an owner already at 20 active tasks.
 *   2. Attempt to create a 21st task and see the refusal naming the cap and the upgrade path.
 *   3. Start checkout for the paid plan and complete it at the gateway sandbox.
 *   4. Return to the app once the gateway acknowledges and see the usage screen show no cap.
 *   5. Create the 21st task and see it appear.
 */
test.describe(record.id, () => {
  test.skip(true, skipReason(record));

  test(record.title, async () => {
    // Left unimplemented until the record's blockedBy resolves.
  });
});
