import { test } from '@playwright/test';
import { readFlowRecord, skipReason } from '../lib/flow-records';

const FEATURE = 'share';
const FLOW = 'invite-and-collaborate';
const record = readFlowRecord(FEATURE, FLOW);

/**
 * uat.share.invite-and-collaborate - blocked by the record's own `blockedBy`
 * (examples/todo-app-backend/.starciwork/features/share/uat/invite-and-collaborate/index.yaml):
 *   1. Sign in as the owner and create a task.
 *   2. Invite a second person as editor and a third as viewer.
 *   3. Sign in as the editor, accept the invitation, and complete the task.
 *   4. Sign in as the viewer, accept the invitation, and attempt to complete the task.
 *   5. See the viewer's attempt refused, and the task still complete.
 *   6. Sign in as the owner and revoke the editor.
 *   7. Sign in as the editor and read the task again.
 *   8. See the editor's access already gone, with no wait and no sweep in between.
 */
test.describe(record.id, () => {
  test.skip(true, skipReason(record));

  test(record.title, async () => {
    // Left unimplemented until the record's blockedBy resolves.
  });
});
