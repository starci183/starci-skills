// Fixed provider adapters share local acceptance, private custody and durable unknown outcomes.
import { randomUUID } from 'node:crypto';
import { canonicalJSON } from '../../engine/canonical-json.mjs';
import { sha256 } from '../../engine/digest.mjs';
import { putBlob, getBlob, blobPath } from '../../engine/db/blob.mjs';
import { openLedger, inspectLedger, ledgerFileFor, provisionOperation, priorProvisionOperations, isProvisionOperationFailure } from '../../engine/db/ledger.mjs';
import { openMachine, pidAlive } from '../../engine/db/machine.mjs';
import { resolveProvisionTarget } from './provision-target.mjs';
import { withProvisionCredentials, assertProvisionCustodyScope, isProvisionCustodyFailure } from './provision-custody.mjs';
import { repositoryHome } from '../hfs/repo-identity.mjs';
import { resolveProvisionAuthority } from './provision-authority.mjs';
import { canonicalPath, pathKey } from '../lib/path-key.mjs';
export { sealProvisionValues, provisionChildEnvironment, provisionNativeChildEnvironment } from './provision-custody.mjs';

const METADATA = new Set(['resourceId', 'generationName', 'destinationRef', 'phase', 'code', 'nativeRecordSha256', 'nativeTag', 'ceTaskId']);
const OUTCOMES = new Set(['applied', 'verified', 'failed', 'unknown', 'partial']);
const activeLocks = new Set();
const PROOF = new Set(['analysisId', 'revision', 'ceTaskId', 'issues', 'qualityGate', 'metrics', 'publicKeys', 'privateCount', 'privateValuesVerified', 'logins', 'name', 'type', 'projectKey', 'credentialAccepted', 'custodyWritten', 'valueToNameBindingVerified', 'authentication', 'sessionCleanup', 'jwtExpiryRemaining', 'nativeGateVerified', 'nativeTag', 'nativeRecordSha256', 'nativeGates']);
const METRICS = new Set(['coverage', 'line_coverage', 'branch_coverage', 'duplicated_lines_density', 'violations', 'ncloc', 'new_coverage', 'new_violations', 'bugs', 'vulnerabilities', 'code_smells']);
const failures = new WeakSet();
const authorityFailures = new WeakSet();
const fail = code => { const error = Object.assign(new Error(code), { code }); failures.add(error); return error; };
const refusedAuthority = code => { const error = fail(code); authorityFailures.add(error); return error; };
const PUBLIC_FAILURES = new Set(['provider-operation-failed', 'provision-action-policy-mismatch', 'provision-target-action-refused',
  'provision-credential-role-required', 'provision-destination-required', 'provision-adapter-result-invalid', 'provision-proof-invalid',
  'provision-checkpoint-invalid', 'provision-acceptance-required', 'provision-reconcile-unsupported', 'provision-reconcile-required',
  'provision-target-busy', 'provision-target-reconciliation-held', 'provision-target-lock-lost', 'provision-journal-recovery-required',
  'provision-cleanup-recovery-required', 'provision-operation-unknown', 'provision-plan-input-drift', 'provision-owner-checkpoint-required',
  'provision-plan-digest-mismatch', 'provision-control-unavailable', 'owner-terminal-required', 'owner-plan-not-accepted',
  'credential-reference-invalid', 'credential-custody-scope-refused', 'credential-custody-missing', 'credential-custody-unavailable',
  'credential-member-missing', 'credential-host-owner-required', 'credential-host-owner-unavailable', 'credential-destination-aliases-input',
  'credential-native-context-unverified',
  'credential-destination-format-refused', 'credential-destination-key-refused', 'credential-seal-failed',
  'provision-native-caller-unverified', 'provision-native-attempt-unverified', 'provision-native-attempt-stale',
  'provision-native-placement-unverified', 'provision-goal-grant-stale', 'provision-filed-contract-unverified',
  'provision-operation-id-invalid', 'provision-operation-intent-conflict', 'provision-accept-state-refused', 'provision-executor-stale', 'provision-state-invalid',
  'provision-goal-grant-unsupported', 'provision-goal-grant-unaccepted', 'provision-goal-grant-missing', 'provision-goal-grant-refused']);
const OUTCOME_CODES = Object.freeze({ applied: 'provider-write-applied', verified: 'provider-result-verified', failed: 'provider-operation-failed', unknown: 'provider-outcome-unknown', partial: 'provider-operation-partial' });
const safeCode = code => PUBLIC_FAILURES.has(code) ? code : 'provider-operation-failed';

/** Return one closed, value-free CLI refusal without serializing an exception or provider body. */
const provisionRefusal = code => ({ code: 2, data: { schema: 'starci/provision-operation@1', ok: false, code: safeCode(code) } });

function blob(ledger, value) {
  const stored = putBlob(Buffer.from(canonicalJSON(JSON.parse(JSON.stringify(value)))), { mediaType: 'application/json' });
  ledger.write.recordBlob({ sha256: stored.sha, bytes: stored.size, mediaType: stored.mediaType, fileUri: blobPath(stored.sha), redaction: 'public-provision-record' });
  return stored.sha;
}

const readJson = ref => ref ? JSON.parse(getBlob(ref).toString('utf8')) : null;
const descriptor = row => row ? {
  id: row.operation_id, action: row.action, target: row.target_id, digest: row.plan_sha,
  transport: row.transport, endpointIdentity: row.endpoint_identity,
  state: row.state, code: row.code, generation: row.generation,
  writeAck: row.write_ack === 1, accepted: row.accepted_at !== null,
  receiptRef: row.receipt_sha, metadata: readJson(row.metadata_sha),
} : null;

function snapshot(spec, policy) {
  if (!policy || policy.action !== spec.action) throw fail('provision-action-policy-mismatch');
  if (spec.target.actions.length && !spec.target.actions.includes(spec.action)) throw fail('provision-target-action-refused');
  for (const role of policy.credentials ?? []) {
    if (!spec.credentialRefs?.[role] || spec.credentialRefs[role].optional === true) throw fail('provision-credential-role-required');
  }
  if (policy.destination === 'required' && !spec.destination) throw fail('provision-destination-required');
  return {
    schema: 'starci/provision-plan@1', action: spec.action,
    target: { id: spec.target.id, project: spec.target.project, repoRoot: spec.target.ledgerRoot,
      provider: spec.target.provider, origin: spec.target.origin, context: spec.target.context,
      transport: spec.target.transport, endpointIdentity: spec.target.endpointIdentity,
      resource: spec.publicResource ?? null, declaration: { path: '.starcistacks/application-stacks.yaml', sha256: spec.target.declaration.sha256 } },
    policy, credentials: spec.credentialRefs, destination: spec.destination, input: spec.plan,
  };
}

function publicResult(result, codes) {
  if (!result || !OUTCOMES.has(result.outcome)) throw fail('provision-adapter-result-invalid');
  return {
    outcome: result.outcome, code: codes instanceof Set && codes.has(result.code) ? result.code : OUTCOME_CODES[result.outcome],
    writeAck: result.writeAck === true, publicReadback: result.publicReadback === true,
    consumerVerified: result.consumerVerified === true,
    ...(result.proof === undefined ? {} : { proof: publicProof(result.proof) }),
    ...(typeof result.resourceId === 'string' && result.resourceId.length <= 256 ? { resourceId: result.resourceId } : {}),
  };
}

const proofScalar = value => typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))
  || value === null || (typeof value === 'string' && value.length <= 1024 && !/[\r\n]/u.test(value));
const proofArray = value => Array.isArray(value) && value.length <= 100 && value.every(proofScalar);
const proofMetrics = value => value && typeof value === 'object' && !Array.isArray(value)
  && Object.entries(value).every(([metric, item]) => METRICS.has(metric) && proofScalar(item));
const validNativeTag = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,255}$/u.test(value);
const PROOF_RULES = Object.freeze({
  authentication: value => ['existing-session', 'password-session'].includes(value),
  sessionCleanup: value => ['not-created', 'acknowledged'].includes(value),
  jwtExpiryRemaining: value => typeof value === 'boolean',
  nativeGateVerified: value => typeof value === 'boolean',
  nativeRecordSha256: value => /^[a-f0-9]{64}$/u.test(value ?? ''),
  nativeTag: validNativeTag,
  nativeGates: value => Number.isSafeInteger(value) && value >= 0,
  metrics: proofMetrics, publicKeys: proofArray, logins: proofArray,
});

function publicProof(proof) {
  if (!proof || typeof proof !== 'object' || Array.isArray(proof)) throw fail('provision-proof-invalid');
  for (const [key, value] of Object.entries(proof)) {
    if (!PROOF.has(key) || !(PROOF_RULES[key] ?? proofScalar)(value)) throw fail('provision-proof-invalid');
  }
  return proof;
}

function checkpointMetadata(previous, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail('provision-checkpoint-invalid');
  for (const [key, scalar] of Object.entries(value)) {
    if (!METADATA.has(key) || typeof scalar !== 'string' || scalar.length > 1024 || /[\r\n]/u.test(scalar))
      throw fail('provision-checkpoint-invalid');
    if (key === 'nativeRecordSha256' && !/^[a-f0-9]{64}$/u.test(scalar)) throw fail('provision-checkpoint-invalid');
    if (key === 'nativeTag' && !validNativeTag(scalar)) throw fail('provision-checkpoint-invalid');
  }
  return { ...previous, ...value };
}

function currentPlan(ledger, spec, policy) {
  const plan = snapshot(spec, policy);
  const planSha = blob(ledger, plan);
  const endpointIdentity = sha256(canonicalJSON(spec.target.endpointIdentity));
  const coordinationKey = coordinationOf(spec.target);
  const row = ledger.write.prepareProvisionOperation({ operationId: spec.requestId, action: spec.action,
    targetId: spec.target.id, transport: spec.target.transport, endpointIdentity, coordinationKey, planSha });
  return { plan, planSha, row, coordinationKey };
}

function coordinationOf(target) {
  if (target.transport === 'native') return sha256(canonicalJSON(['app-native', pathKey(canonicalPath(target.ledgerRoot))]));
  let realm = target.provider;
  if (['sonar-server', 'sonar-community'].includes(realm)) realm = 'sonar-selfhost';
  return sha256(canonicalJSON([realm, target.origin]));
}

function operationSpec(ctx, input) {
  let destination = input.target.destination ?? null;
  if (Object.hasOwn(input, 'destination')) destination = input.destination;
  return { ...input, destination, requestId: input.requestId ?? ctx.args.operation ?? randomUUID(),
    execute: input.execute ?? ctx.args.execute === true,
    credentialRefs: input.credentialRefs ?? input.target.credentials };
}

function admitOperation(state, ctx) {
  const { ledger, spec, prepared } = state;
  state.authorityInput = { ledger, target: spec.target, operationId: state.row.operation_id, planSha: prepared.planSha };
  const authority = resolveProvisionAuthority(ctx, state.authorityInput);
  if (!authority.ok) throw refusedAuthority(authority.reason);
  if (authority.bound) {
    const { caller, ...proof } = authority;
    state.row = ledger.write.authorizeProvisionGrant({ operationId: state.row.operation_id, planSha: prepared.planSha,
      caller, ledgerId: ledger.ledgerId, repoRoot: spec.target.ledgerRoot, worktree: spec.target.repoRoot,
      authoritySha: blob(ledger, proof) });
  } else if (state.row.accepted_by === 'owner-goal') throw fail('provision-goal-grant-missing');
  const row = state.row;
  if (row.accepted_at === null) {
    const refused = provisionRefusal('provision-acceptance-required');
    return { ...refused, data: { ...refused.data, operation: descriptor(row) } };
  }
  if (['applied', 'verified', 'failed'].includes(row.state)) return { code: row.state === 'failed' ? 1 : 0,
    data: { schema: 'starci/provision-operation@1', ok: row.state !== 'failed', reused: true,
      operation: descriptor(row), receipt: readJson(row.receipt_sha) } };
  return null;
}

function acquireProvisionTarget(state) {
  const { machine, spec, reconcile } = state;
  state.lock = `provision:${state.prepared.coordinationKey}`;
  state.holder = `${state.ledger.ledgerId}:${spec.requestId}`;
  const { lock, holder } = state;
  if (activeLocks.has(lock)) throw fail('provision-target-busy');
  const held = machine.hostLock(lock);
  if (held && held.state !== 'released' && (held.holder_pid !== process.pid || held.holder !== holder)) {
    if (held.holder !== holder || !reconcile || pidAlive(held.holder_pid)
      || !machine.releaseObservedProvisionLock({ observed: held, holder })) throw fail('provision-target-reconciliation-held');
  }
  if (!machine.acquireHostLock({ name: lock, holder, ttlMs: 120_000, retainExpired: true }).ok) throw fail('provision-target-busy');
  state.lockOwned = true;
  activeLocks.add(lock);
}

function claimOperation(state, ctx) {
  const { spec, ledger, prepared } = state;
  state.reconcile = ctx.args.reconcile === true;
  if (state.reconcile && typeof spec.reconcile !== 'function') throw fail('provision-reconcile-unsupported');
  const uncertain = ['running', 'unknown', 'partial'].includes(state.row.state);
  if (!state.reconcile && uncertain) throw fail('provision-reconcile-required');
  if (state.reconcile && uncertain) state.heldOutcome = state.row.state === 'running' ? 'unknown' : state.row.state;
  assertProvisionCustodyScope(spec.credentialRefs, spec.destination, { repoRoot: spec.target.repoRoot });
  state.machine = openMachine({ env: ctx.env });
  acquireProvisionTarget(state);
  state.row = ledger.write.claimProvisionOperation({ operationId: state.row.operation_id, planSha: prepared.planSha, reconcile: state.reconcile });
  state.accepted = true;
  state.metadata = readJson(state.row.metadata_sha);
}

function writeCheckpoint(state, value, writeAck) {
  const next = checkpointMetadata(state.metadata, value);
  if (value.code !== undefined && !(state.spec.resultCodes instanceof Set && state.spec.resultCodes.has(value.code)) && !PUBLIC_FAILURES.has(value.code))
    throw fail('provision-checkpoint-invalid');
  state.metadata = next;
  state.row = state.ledger.write.updateProvisionOperation({ operationId: state.row.operation_id, generation: state.row.generation,
    metadataSha: blob(state.ledger, state.metadata), writeAck, code: writeAck ? 'provider-write-acknowledged' : 'operation-checkpoint' });
}

function adapterCallbacks(state, ctx) {
  const assertAuthority = () => {
    const authority = resolveProvisionAuthority(ctx, state.authorityInput);
    if (!authority.ok) throw refusedAuthority(authority.reason);
  };
  return {
    assertAuthority,
    checkpoint(value) {
      assertAuthority();
      writeCheckpoint(state, value, false);
      state.effectStarted = true;
    },
    acknowledge(value) {
      state.effectStarted = true;
      writeCheckpoint(state, value, true);
    },
  };
}

async function executeAdapter(state, ctx) {
  const { spec, ledger, prepared, machine, lock, holder } = state;
  const prior = priorProvisionOperations(ledger.db, { planSha: prepared.planSha, excludeId: state.row.operation_id })
    .map(previous => ({ ...descriptor(previous), receipt: readJson(previous.receipt_sha) }));
  const operation = { ...descriptor(state.row), prior };
  const callbacks = adapterCallbacks(state, ctx);
  let lockLost = false;
  const heartbeat = setInterval(() => {
    try { if (!machine.renewProvisionLock({ name: lock, holder, ttlMs: 120_000 })) lockLost = true; }
    catch { lockLost = true; }
  }, 30_000);
  try {
    const adapter = state.reconcile ? spec.reconcile : spec.apply;
    const outcome = await withProvisionCredentials(spec.credentialRefs, { repoRoot: spec.target.repoRoot, env: ctx.env,
      target: spec.target, hostCredentialOwner: spec.hostCredentialOwner },
    credentials => adapter({ credentials, ...callbacks, operation }));
    const result = publicResult(outcome, spec.resultCodes);
    if (lockLost) throw fail('provision-target-lock-lost');
    return result;
  } finally { clearInterval(heartbeat); }
}

function persistOutcome(state, result) {
  const { ledger, spec, prepared } = state;
  let outcome = result;
  // Failed readback cannot clear a prior unknown write or turn an acknowledged write into failure.
  if (state.row.write_ack === 1 && ['failed', 'unknown'].includes(outcome.outcome)) outcome = { ...outcome, outcome: 'partial' };
  else if (state.heldOutcome && outcome.outcome === 'failed') outcome = { ...outcome, outcome: state.heldOutcome };
  const receipt = { schema: 'starci/provision-receipt@1', operation: state.row.operation_id, action: spec.action,
    target: spec.target.id, plan: prepared.planSha, ...outcome, writeAck: state.row.write_ack === 1 || outcome.writeAck,
    authorityRef: state.row.approval_ref, fullGoalProof: 'incomplete' };
  state.row = ledger.write.updateProvisionOperation({ operationId: state.row.operation_id, generation: state.row.generation,
    state: outcome.outcome, receiptSha: blob(ledger, receipt), writeAck: receipt.writeAck, code: outcome.code });
  const ok = ['applied', 'verified'].includes(state.row.state);
  return { code: ok ? 0 : 1, data: { schema: 'starci/provision-operation@1', ok, operation: descriptor(state.row), receipt } };
}

function recoveryState(state, error) {
  if (state.row.write_ack === 1) return 'partial';
  if (state.heldOutcome) return state.heldOutcome;
  if (!state.effectStarted && (isProvisionCustodyFailure(error) || authorityFailures.has(error))) return 'failed';
  return 'unknown';
}

function recoverOperation(state, error) {
  const owned = failures.has(error) || isProvisionCustodyFailure(error) || isProvisionOperationFailure(error);
  const code = owned ? safeCode(error.code) : 'provider-operation-failed';
  if (state.accepted && state.row?.state === 'running') {
    try { state.row = state.ledger.write.updateProvisionOperation({ operationId: state.row.operation_id, generation: state.row.generation,
      state: recoveryState(state, error), code }); }
    catch { return provisionRefusal('provision-journal-recovery-required'); }
  }
  return provisionRefusal(code);
}

function closeOperation(state) {
  let failed = false;
  try {
    if (state.machine && state.lockOwned && !['running', 'unknown', 'partial'].includes(state.row?.state)
      && !state.machine.releaseProvisionLock({ name: state.lock, holder: state.holder })) failed = true;
  } catch { failed = true; }
  if (state.lockOwned) activeLocks.delete(state.lock);
  for (const handle of [state.machine, state.ledger]) {
    try { handle?.close(); } catch { failed = true; }
  }
  return failed;
}

// Cleanup failure has explicit precedence over either a returned or rejected operation completion.
async function completeProvision(body, cleanup) {
  let result, cause, rejected = false;
  try { result = await body(); }
  catch (error) { cause = error; rejected = true; }
  if (cleanup()) return provisionRefusal('provision-cleanup-recovery-required');
  if (rejected) throw cause;
  return result;
}

/**
 * Prepare or execute one fixed adapter action. Only an accepted exact plan can open custody.
 * Local request replay does not deduplicate remote calls: running, partial and unknown operations
 * require the adapter's explicit reconciliation path, which must not repeat a create or mint.
 */
export async function runProvisionOperation(ctx, input) {
  const state = { lockOwned: false, accepted: false, effectStarted: false, heldOutcome: null };
  return completeProvision(async () => {
    try {
      state.spec = operationSpec(ctx, input);
      const { spec } = state;
      state.ledger = openLedger({ file: ledgerFileFor(spec.target.ledgerRoot, { env: ctx.env }), repoRoot: spec.target.ledgerRoot });
      state.prepared = currentPlan(state.ledger, spec, ctx.operationPolicy);
      state.row = state.prepared.row;
      if (!spec.execute) return { code: 0, data: { schema: 'starci/provision-operation@1', ok: true,
        operation: descriptor(state.row), plan: state.prepared.plan, next: state.row.accepted_at === null ? 'owner-plan-acceptance' : 'execute' } };
      const admission = admitOperation(state, ctx);
      if (admission) return admission;
      claimOperation(state, ctx);
      return persistOutcome(state, await executeAdapter(state, ctx));
    } catch (error) { return recoverOperation(state, error); }
  }, () => closeOperation(state));
}

/** Inspect a prepared plan or record its real native terminal checkpoint without provider effects. */
export async function runProvisionControl(ctx) {
  let ledger;
  return completeProvision(async () => {
    try {
      const ledgerRoot = repositoryHome(ctx.cwd), file = ledgerFileFor(ledgerRoot, { env: ctx.env });
      ledger = inspectLedger({ file });
      let row = provisionOperation(ledger.db, ctx.args.operation);
      if (!row) return provisionRefusal('provision-operation-unknown');
      const plan = readJson(row.plan_sha);
      const selected = resolveProvisionTarget({ cwd: ctx.cwd, targetId: row.target_id });
      if (selected.declaration.sha256 !== plan.target.declaration.sha256) return provisionRefusal('provision-plan-input-drift');
      const command = ctx.positionals[0];
      if (command !== 'accept') return { code: 0, data: { schema: 'starci/provision-operation@1', ok: true,
        operation: descriptor(row), ...(command === 'plan' ? { plan } : {}) } };
      if (ctx.role !== 'owner' || typeof ctx.confirmProvisionPlan !== 'function') return provisionRefusal('provision-owner-checkpoint-required');
      const authorityInput = { ledger, target: selected, operationId: row.operation_id, planSha: row.plan_sha };
      const authority = resolveProvisionAuthority(ctx, authorityInput);
      if (!authority.ok || authority.bound) return provisionRefusal('provision-owner-checkpoint-required');
      if (ctx.args.digest !== row.plan_sha) return provisionRefusal('provision-plan-digest-mismatch');
      if (!['planned', 'accepted', 'unknown', 'partial'].includes(row.state)) return provisionRefusal('provision-reconcile-required');
      if (row.accepted_by === 'owner-terminal') return { code: 0, data: { schema: 'starci/provision-operation@1', ok: true, operation: descriptor(row) } };
      const confirmed = await ctx.confirmProvisionPlan({ plan, digest: row.plan_sha }, { db: ledger.db, file, root: ledgerRoot });
      if (confirmed.accepted !== true) return provisionRefusal(confirmed.code);
      const currentAuthority = resolveProvisionAuthority(ctx, authorityInput);
      if (!currentAuthority.ok || currentAuthority.bound) return provisionRefusal('provision-owner-checkpoint-required');
      if (resolveProvisionTarget({ cwd: ctx.cwd, targetId: row.target_id }).declaration.sha256 !== plan.target.declaration.sha256)
        return provisionRefusal('provision-plan-input-drift');
      const operationId = row.operation_id, planSha = row.plan_sha;
      ledger.close(); ledger = null;
      ledger = openLedger({ file, repoRoot: ledgerRoot });
      row = ledger.write.acceptProvisionOperation({ operationId, planSha });
      return { code: 0, data: { schema: 'starci/provision-operation@1', ok: true, operation: descriptor(row) } };
    } catch { return provisionRefusal('provision-control-unavailable'); }
  }, () => {
    try { ledger?.close(); return false; }
    catch { return true; }
  });
}
