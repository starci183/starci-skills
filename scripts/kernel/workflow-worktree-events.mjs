// workflow-worktree-events.mjs - the ledger events a workflow start records about its worktree (created, repaired, installed).
/** Append one workflow-worktree-* event of `workflowId` to its ledger, in one transaction at the workflow's generation. */
export function appendWorktreeEvent(ledger, workflowId, kind, payload) {
  const wf = ledger.db.prepare('SELECT generation FROM workflows WHERE workflow_id=?').get(workflowId);
  ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'workflow', entityId: workflowId, generation: wf?.generation ?? 0, kind, payload }));
}
