import { test } from '@playwright/test';
import { readFlowRecord, skipReason } from '../lib/flow-records';

const FEATURE = 'recur';
const FLOW = 'make-recurring';
const record = readFlowRecord(FEATURE, FLOW);

/**
 * uat.recur.make-recurring - `state: todo` but, unlike the other four unimplemented flows, this record
 * declares no `blockedBy` at all (checked: examples/todo-app-backend/.starciwork/features/recur/uat/
 * make-recurring/index.yaml has no `blockedBy` key). `skipReason` reports that absence rather than
 * inventing a blocker the record never named; see the harness report for this gap.
 *   1. Sign in as the owner.
 *   2. Turn a task into a rule that fires every weekday at 09:00 in the owner's own time zone.
 *   3. See the upcoming occurrences preview, and confirm none of them is a weekend date.
 *   4. Wait for (or trigger) a generation run, and see the day's occurrence appear materialised.
 *   5. Complete that occurrence, and see its status become completed.
 *   6. End the rule, and confirm history is preserved and no new occurrence appears after the end date.
 */
test.describe(record.id, () => {
  test.skip(true, skipReason(record));

  test(record.title, async () => {
    // Left unimplemented; there is no ui.recur to walk yet and the record names no blocker to cite.
  });
});
