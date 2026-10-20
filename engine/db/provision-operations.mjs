// Standalone operation writes are reached only through the ledger writer's typed namespace.
import { sha256 } from '../digest.mjs';
import { provisionGoalGrant } from './provision-authority.mjs';
import { describeSchema, readSchemaObjects } from './machine-schema.mjs';

const failures = new WeakSet();
const need = (condition, code) => {
  if (!condition) { const error = Object.assign(new Error(code), { code }); failures.add(error); throw error; }
};
/** Recognize only this writer's fixed invariant refusals; arbitrary database errors stay private. */
export const isProvisionOperationFailure = error => typeof error === 'object' && error !== null && failures.has(error);

const SCHEMA_FAILURE = 'STARCI_LEDGER_SCHEMA_REFUSED';
const SCHEMA_BEGIN = '-- starci:provision-schema:begin';
const SCHEMA_END = '-- starci:provision-schema:end';
const identifierKey = name => name.toLowerCase();
const provisionName = name => identifierKey(name).startsWith('provision_');

function canonicalProvisionSchema(canonicalSql) {
  const begin = canonicalSql.indexOf(SCHEMA_BEGIN), end = canonicalSql.indexOf(SCHEMA_END);
  need(begin >= 0 && end > begin && canonicalSql.lastIndexOf(SCHEMA_BEGIN) === begin
    && canonicalSql.lastIndexOf(SCHEMA_END) === end, SCHEMA_FAILURE);
  const canonical = describeSchema(canonicalSql);
  const objects = canonical.objects.filter(row => provisionName(row.name));
  const names = new Set(objects.map(row => identifierKey(row.name)));
  const tables = new Set(objects.filter(row => row.type === 'table').map(row => identifierKey(row.name)));
  const blobRefs = canonical.blobRefs.filter(row => tables.has(identifierKey(row.table_name)));
  need(objects.length > 0 && tables.size > 0 && blobRefs.length > 0, SCHEMA_FAILURE);
  return { sql: canonicalSql.slice(begin + SCHEMA_BEGIN.length, end), objects, names, tables, blobRefs };
}

function provisionSchemaState(db, schema) {
  const all = readSchemaObjects(db);
  need(['blobs', 'blob_ref_columns'].every(name => all.some(row => row.type === 'table' && row.name === name)), SCHEMA_FAILURE);
  return {
    objects: all.filter(row => provisionName(row.name) || schema.names.has(identifierKey(row.name)) || schema.tables.has(identifierKey(row.tbl_name))),
    blobRefs: db.prepare('SELECT table_name,column_name FROM blob_ref_columns ORDER BY table_name,column_name').all()
      .filter(row => provisionName(row.table_name) || schema.tables.has(identifierKey(row.table_name))),
  };
}

function exactProvisionSchema(actual, expected) {
  const objects = rows => JSON.stringify(rows.map(row => [row.type, row.name, row.tbl_name, row.identity]));
  return objects(actual.objects) === objects(expected.objects)
    && JSON.stringify(actual.blobRefs) === JSON.stringify(expected.blobRefs);
}

/** Install only a wholly absent canonical domain inside the ledger's fenced write transaction. */
function ensureProvisionSchema(db, schema) {
  const before = provisionSchemaState(db, schema);
  if (before.objects.length || before.blobRefs.length) {
    need(exactProvisionSchema(before, schema), SCHEMA_FAILURE);
    return;
  }
  db.exec(schema.sql);
  need(exactProvisionSchema(provisionSchemaState(db, schema), schema), SCHEMA_FAILURE);
}

/** Read one provider operation; older compatible ledgers without this additive store return null. */
export function provisionOperation(db, operationId) {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='provision_operations'").get()) return null;
  return db.prepare('SELECT * FROM provision_operations WHERE operation_id=?').get(operationId) ?? null;
}

/** Prior completed operations bind the exact public plan, including credential references and destination. */
export function priorProvisionOperations(db, { planSha, excludeId }) {
  return db.prepare("SELECT * FROM provision_operations WHERE plan_sha=? AND operation_id<>? AND state IN ('applied','verified') ORDER BY updated_at DESC LIMIT 1")
    .all(planSha, excludeId);
}

function journal(db, row, kind, at) {
  const prior = db.prepare('SELECT digest FROM provision_events WHERE operation_id=? ORDER BY seq DESC LIMIT 1').get(row.operation_id)?.digest ?? null;
  const digest = sha256(JSON.stringify([prior, row.operation_id, kind, row.state, row.receipt_sha, at]));
  db.prepare('INSERT INTO provision_events(operation_id,kind,state,receipt_sha,prev_digest,digest,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(row.operation_id, kind, row.state, row.receipt_sha, prior, digest, at);
  return row;
}

/** Prepare immutable intent. A reused identifier must retain the exact original plan and target. */
function prepareProvisionOperation(db, { operationId, action, targetId, transport, endpointIdentity, coordinationKey, planSha, at = Date.now() }) {
  need(typeof operationId === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9-]{0,127}$/u.test(operationId), 'provision-operation-id-invalid');
  const previous = provisionOperation(db, operationId);
  if (previous) {
    need(previous.action === action && previous.transport === transport && previous.endpoint_identity === endpointIdentity
      && previous.coordination_key === coordinationKey && previous.plan_sha === planSha, 'provision-operation-intent-conflict');
    return previous;
  }
  db.prepare("INSERT INTO provision_operations(operation_id,action,target_id,transport,endpoint_identity,coordination_key,plan_sha,state,code,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'planned','plan-prepared',?,?)")
    .run(operationId, action, targetId, transport, endpointIdentity, coordinationKey, planSha, at, at);
  return journal(db, provisionOperation(db, operationId), 'prepared', at);
}

/** Record the native terminal's scoped acceptance; a digest flag alone never reaches this writer. */
function acceptProvisionOperation(db, { operationId, planSha, at = Date.now() }) {
  const row = provisionOperation(db, operationId);
  need(row && row.plan_sha === planSha, 'provision-plan-digest-mismatch');
  need(['planned', 'accepted', 'unknown', 'partial'].includes(row.state), 'provision-accept-state-refused');
  if (row.accepted_by === 'owner-terminal') return row;
  db.prepare("UPDATE provision_operations SET state=CASE WHEN state='planned' THEN 'accepted' ELSE state END,accepted_by='owner-terminal',approval_ref=?,accepted_at=?,updated_at=?,code='owner-plan-accepted' WHERE operation_id=?")
    .run(planSha, at, at, operationId);
  return journal(db, provisionOperation(db, operationId), 'accepted', at);
}

/** Consume an exact accepted goal grant after the native binding check, rejoining current rows atomically. */
function authorizeProvisionGrant(db, { operationId, planSha, caller, ledgerId, repoRoot, worktree, authoritySha, at = Date.now() }) {
  const authority = provisionGoalGrant(db, { operationId, planSha, caller, ledgerId, repoRoot, worktree });
  need(authority.ok, 'provision-goal-grant-refused');
  const row = provisionOperation(db, operationId);
  need(row && row.plan_sha === planSha, 'provision-plan-digest-mismatch');
  db.prepare("UPDATE provision_operations SET state=CASE WHEN state='planned' THEN 'accepted' ELSE state END,accepted_by='owner-goal',approval_ref=?,accepted_at=COALESCE(accepted_at,?),updated_at=? WHERE operation_id=?")
    .run(authoritySha, at, at, operationId);
  return journal(db, provisionOperation(db, operationId), 'goal-authorized', at);
}

/** Atomically claim one accepted execution or explicit unknown-outcome reconciliation. */
function claimProvisionOperation(db, { operationId, planSha, reconcile = false, at = Date.now(), pid = process.pid }) {
  const row = provisionOperation(db, operationId);
  need(row && row.plan_sha === planSha && row.accepted_at !== null, 'provision-acceptance-required');
  need(reconcile ? ['unknown', 'partial', 'running'].includes(row.state) : row.state === 'accepted', 'provision-reconcile-required');
  db.prepare("UPDATE provision_operations SET state='running',owner_pid=?,generation=generation+1,updated_at=?,code=? WHERE operation_id=?")
    .run(pid, at, reconcile ? 'reconciliation-started' : 'execution-started', operationId);
  return journal(db, provisionOperation(db, operationId), reconcile ? 'reconciling' : 'started', at);
}

/** Persist safe checkpoints and terminal receipts under the execution generation that owns them. */
function updateProvisionOperation(db, { operationId, generation, state = 'running', receiptSha = null, metadataSha = null, writeAck = false, code, at = Date.now(), pid = process.pid }) {
  const row = provisionOperation(db, operationId);
  need(row?.state === 'running' && row.generation === generation && row.owner_pid === pid, 'provision-executor-stale');
  need(['running', 'applied', 'verified', 'failed', 'unknown', 'partial'].includes(state), 'provision-state-invalid');
  db.prepare('UPDATE provision_operations SET state=?,receipt_sha=COALESCE(?,receipt_sha),metadata_sha=COALESCE(?,metadata_sha),write_ack=MAX(write_ack,?),code=?,updated_at=? WHERE operation_id=?')
    .run(state, receiptSha, metadataSha, writeAck ? 1 : 0, code, at, operationId);
  return journal(db, provisionOperation(db, operationId), state === 'running' ? 'checkpoint' : 'finished', at);
}

/** Canonical schema text is injected once; schema work stays lazy inside the existing typed transaction. */
export function provisionWrites(canonicalSql) {
  let schema;
  return Object.freeze({
    prepareProvisionOperation(db, args) {
      schema ??= canonicalProvisionSchema(canonicalSql);
      ensureProvisionSchema(db, schema);
      return prepareProvisionOperation(db, args);
    },
    acceptProvisionOperation, authorizeProvisionGrant, claimProvisionOperation, updateProvisionOperation,
  });
}
