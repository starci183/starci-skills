// launch-held-item.mjs - the Supervisor item a refused launch recovery opens (workflow-launch-custody.mjs escalateHeldLaunch) owns the refusal `kernel-launch-unreconciled`.
// The start-refusal journal counts that refusal toward the start hold, but the seat quarantine does not open a second item for the same cause while this one stands.

/** The step whose refusal the recovery's item owns. */
export const RECOVERY_REFUSAL = 'kernel-launch-unreconciled';

/** Whether a Supervisor Decision Item of the launch recovery is live for the workflow, read from the machine store handle `db`. */
export const recoveryItemOpen = (db, workflowId) => {
  try {
    return db.prepare("SELECT 1 FROM sup_decision_items WHERE workflow_id=? AND status IN ('open','claimed','escalated') AND idempotency_key LIKE 'kernel-launch-held:%' LIMIT 1").get(workflowId) != null;
  } catch { return false; }
};
