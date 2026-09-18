import { test } from '@playwright/test';
import { readFlowRecord, skipReason } from '../lib/flow-records';

const FEATURE = 'notify';
const FLOW = 'digest-and-unsubscribe';
const record = readFlowRecord(FEATURE, FLOW);

/**
 * uat.notify.digest-and-unsubscribe - blocked by the record's own `blockedBy`
 * (examples/todo-app-backend/.starciwork/features/notify/uat/digest-and-unsubscribe/index.yaml):
 *   1. Sign in as the owner.
 *   2. Trigger two notify-worthy events for the owner inside one digest window.
 *   3. Read the owner's inbox and see exactly one message covering both events.
 *   4. Unsubscribe from email in the preferences screen.
 *   5. Trigger a third notify-worthy event.
 *   6. Confirm no new message arrives for it.
 */
test.describe(record.id, () => {
  test.skip(true, skipReason(record));

  test(record.title, async () => {
    // Left unimplemented until the record's blockedBy resolves.
  });
});
