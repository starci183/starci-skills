// workflow-purged.mjs - which workflows a purge has finished, read from the journal event it writes (kind workflow-purged, scripts/machine/workflow-purge-apply.mjs).
// The debug digest and every other reader of host state skip what names one of them: a purged workflow has no tree, ref, worker or terminal left to count.

/** The ids of the workflows with a workflow-purged event, over an open machine handle. */
export function purgedWorkflowIds(m) {
  return new Set(m.db.prepare("SELECT DISTINCT entity_id FROM sup_events WHERE kind='workflow-purged' AND entity_type='workflow'").all().map((row) => row.entity_id));
}
