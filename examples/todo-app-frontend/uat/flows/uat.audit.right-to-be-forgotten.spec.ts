import { test } from '@playwright/test';
import { readFlowRecord, skipReason } from '../lib/flow-records';

const FEATURE = 'audit';
const FLOW = 'right-to-be-forgotten';
const record = readFlowRecord(FEATURE, FLOW);

/**
 * uat.audit.right-to-be-forgotten - blocked by the record's own `blockedBy`
 * (examples/todo-app-backend/.starciwork/features/audit/uat/right-to-be-forgotten/index.yaml):
 *   1. Sign in with the seeded person and create two tasks.
 *   2. Request erasure and confirm it.
 *   3. Export the person's data and see nothing.
 *   4. As the seeded operator, read the log for the same window and see the lines, unnamed.
 */
test.describe(record.id, () => {
  test.skip(true, skipReason(record));

  test(record.title, async () => {
    // Left unimplemented until the record's blockedBy resolves; steps kept here for the walk this
    // spec will run once ui.audit exists: record.steps -> ["Sign in with the seeded person and create
    // two tasks.", "Request erasure and confirm it.", "Export the person's data and see nothing.",
    // "As the seeded operator, read the log for the same window and see the lines, unnamed."]
  });
});
