import { one, many } from './query.mjs';
import { uiState } from './state.mjs';

const states = new Set(['bad', 'warn', 'running', 'waiting', 'ok', 'done', 'unknown']);
const state = value => {
  if (states.has(value)) return value;
  if (value === 'awaiting-owner') return 'waiting';
  if (value === 'rejected') return 'bad';
  return 'unknown';
};
const encoded = value => encodeURIComponent(String(value));
const sha = value => /^[a-f0-9]{64}$/.test(String(value ?? ''));

function hitOf(hit, scope, ref, ui = 'unknown') {
  const matched = { ...scope, kind: hit.kind, id: String(hit.id) };
  return { kind: ref?.kind ?? hit.kind, id: ref?.id ?? String(hit.id), title: String(hit.title ?? hit.id),
    project: scope.name ?? undefined, ui: state(ui), href: ref?.href ?? null,
    matched: { store: matched.store, ledgerId: matched.ledgerId, workflow: matched.workflow, kind: matched.kind, id: matched.id }, ref };
}
function reference(scope, kind, id, href) {
  return { store: scope.store, ledgerId: scope.ledgerId, workflow: scope.workflow, kind, id: String(id), href };
}

/** Resolve native index aliases only through the entity's persisted scoped identity. */
export function ledgerSearchHit(db, row, hit) {
  const scope = { store: 'ledger', ledgerId: row.ledgerId, name: row.name, workflow: hit.workflow_id ?? null };
  const workflowHref = wf => `#/w/${encoded(row.name)}/${encoded(wf)}`;
  const attemptHit = attempt => attempt ? hitOf({ ...hit, title: `${attempt.op_id} #${attempt.try_no}.${attempt.dispatch_seq}` }, scope,
    reference(scope, 'attempt', attempt.attempt_id, `#/a/${encoded(row.name)}/${attempt.attempt_id}`), attempt.ui) : hitOf(hit, scope, null);
  if (hit.kind === 'workflow' || hit.kind === 'trace') {
    const workflow = one(db, hit.kind === 'workflow' ? 'SELECT * FROM workflows WHERE workflow_id=?'
      : 'SELECT * FROM workflows WHERE workflow_id=? AND trace_id=?',
    ...(hit.kind === 'workflow' ? [hit.id] : [scope.workflow, hit.id]));
    return hitOf(hit, scope, workflow ? reference(scope, 'workflow', workflow.workflow_id, workflowHref(workflow.workflow_id)) : null,
      workflow ? uiState(db, 'workflow', workflow.phase) : 'unknown');
  }
  if (hit.kind === 'unit') {
    const unit = one(db, 'SELECT * FROM v_units WHERE workflow_id=? AND unit_id=?', scope.workflow, hit.id);
    return hitOf(hit, scope, unit ? reference(scope, 'unit', unit.unit_id,
      `${workflowHref(unit.workflow_id)}?tab=units&unit=${encoded(unit.unit_id)}`) : null, unit?.ui);
  }
  if (hit.kind === 'attempt') return attemptHit(one(db, 'SELECT * FROM v_op_history WHERE workflow_id=? AND attempt_id=?', scope.workflow, hit.id));
  if (hit.kind === 'job') return attemptHit(one(db, 'SELECT * FROM v_op_history WHERE workflow_id=? AND job_id=? ORDER BY dispatch_seq DESC,attempt_id DESC LIMIT 1', scope.workflow, hit.id));
  if (hit.kind === 'dispatch' || hit.kind === 'span') {
    const column = hit.kind === 'dispatch' ? 'dispatch_id' : 'span_id';
    const attempt = one(db, `SELECT h.* FROM op_attempts a JOIN v_op_history h ON h.attempt_id=a.attempt_id WHERE a.workflow_id=? AND a.${column}=?`, scope.workflow, hit.id);
    return attemptHit(attempt);
  }
  if (hit.kind === 'terminal' || hit.kind === 'commit') {
    const column = hit.kind === 'terminal' ? 'terminal_handle' : 'head_sha';
    const attempts = many(db, `SELECT h.* FROM op_attempts a JOIN v_op_history h ON h.attempt_id=a.attempt_id WHERE a.workflow_id=? AND a.${column}=? LIMIT 2`, scope.workflow, hit.id);
    // A reused terminal/head does not identify one dispatch.
    return attempts.length === 1 ? attemptHit(attempts[0]) : hitOf(hit, scope, null);
  }
  if (hit.kind === 'artifact' || hit.kind === 'blob') {
    const blob = hit.kind === 'artifact'
      ? one(db, 'SELECT b.sha256 FROM job_artifacts a JOIN blobs b ON b.sha256=a.sha256 WHERE a.workflow_id=? AND a.artifact_id=?', scope.workflow, hit.id)
      : one(db, 'SELECT sha256 FROM blobs WHERE sha256=?', hit.id);
    return hitOf(hit, scope, sha(blob?.sha256) ? reference(scope, 'blob', blob.sha256, `/api/blob/${blob.sha256}`) : null);
  }
  if (hit.kind === 'decision') {
    const item = one(db, 'SELECT * FROM v_decision_rows WHERE workflow_id IS ? AND di_id=?', scope.workflow, hit.id);
    return hitOf(item?.kind === 'credential-missing' ? { ...hit, title: item.kind } : hit, scope, item ? reference(scope, 'di', item.di_id,
      `#/decisions?store=ledger&ledger=${encoded(row.ledgerId)}&project=${encoded(row.name)}&id=${encoded(item.di_id)}`) : null, item?.ui);
  }
  if (hit.kind === 'incident') {
    const item = one(db, 'SELECT * FROM incidents WHERE workflow_id=? AND incident_id=?', scope.workflow, hit.id);
    return hitOf(hit, scope, item ? reference(scope, 'incident', item.incident_id,
      `#/decisions?tab=incidents&store=ledger&project=${encoded(row.name)}&wf=${encoded(scope.workflow)}&id=${encoded(item.incident_id)}`) : null,
    item ? uiState(db, 'incident', item.status) : 'unknown');
  }
  return hitOf(hit, scope, null);
}

export function machineSearchHit(db, hit) {
  const scope = { store: 'machine', ledgerId: null, workflow: null };
  if (hit.kind === 'sup-decision') {
    const item = one(db, 'SELECT d.*,v.ui FROM sup_decision_items d LEFT JOIN v_open_sup_decisions v ON v.di_id=d.di_id WHERE d.di_id=?', hit.id);
    const resolvedScope = item ? { ...scope, ledgerId: item.ledger_id ?? null, workflow: item.workflow_id ?? null } : scope;
    return hitOf(item?.kind === 'credential-missing' ? { ...hit, title: item.kind } : hit, resolvedScope,
      item ? reference(resolvedScope, 'di', item.di_id, `#/decisions?store=machine&id=${encoded(item.di_id)}`) : null, item?.ui);
  }
  const service = { service: ['v_services', 'name'], seat: ['v_seats', 'seat_id'], terminal: ['terminals', 'handle'] }[hit.kind];
  if (service) {
    const item = one(db, `SELECT * FROM ${service[0]} WHERE ${service[1]}=?`, hit.id);
    return hitOf(hit, scope, item ? reference(scope, hit.kind, hit.id,
      `#/system/services?target=${hit.kind}&id=${encoded(hit.id)}`) : null, item?.ui);
  }
  const land = { lane: ['lanes', 'name'], 'land-ticket': ['land_queue', 'ticket_id'], commit: ['land_runs', 'landed_sha'] }[hit.kind];
  if (land) {
    const item = one(db, `SELECT 1 FROM ${land[0]} WHERE ${land[1]}=? LIMIT 1`, hit.id);
    return hitOf(hit, scope, item ? reference(scope, hit.kind, hit.id,
      `#/system/land?target=${hit.kind}&id=${encoded(hit.id)}`) : null);
  }
  if (hit.kind === 'blob') {
    const item = one(db, 'SELECT sha256 FROM blobs WHERE sha256=?', hit.id);
    return hitOf(hit, scope, sha(item?.sha256) ? reference(scope, 'blob', item.sha256, `/api/blob/${item.sha256}`) : null);
  }
  return hitOf(hit, scope, null);
}

export function logSearchHit(log, row = null) {
  const scope = { store: row ? 'ledger' : 'machine', ledgerId: row?.ledgerId ?? log.ledger_id ?? null, name: row?.name,
    workflow: log.workflow_id ?? null };
  const hit = { kind: 'log', id: String(log.seq), title: log.kind };
  const query = new URLSearchParams({ source: row ? 'ledger' : 'machine', id: String(log.seq) });
  if (row) query.set('project', row.name);
  return hitOf(hit, scope, reference(scope, 'log', log.seq, `#/logs?${query}`));
}
