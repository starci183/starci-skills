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
 *
 * v9-1 surface check (2026-09-19): steps 1-3 are servable today - ui.audit.privacy at
 * /audit/privacy drives requestErasure/completeErasure through a real confirm pair and exportMyData
 * through a JSON download. Step 4 is not walkable in this deployment: no operator-facing audit-log
 * screen exists (the auditLog resolver keeps its filter args "for when the operator-facing UI
 * lands"), and the running API's AUDIT_OPERATOR_SUBJECTS roster is empty, so even a correctly-headed
 * auditLog read as the seeded operator takes the own-lines fallback - after erasure that returns an
 * empty list, the opposite of "the lines exist, unnamed". Both absences are named on
 * gap.audit.live-proof (rev 3); this stays skipped rather than faking the leg.
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
