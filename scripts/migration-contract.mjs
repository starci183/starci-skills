// Migration contracts bind a complete architecture producer before a backend write and carry its
// exact operation projection into the receipt. Unpinned legacy operations retain their existing gate.
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import path from 'node:path';
import { validateAgainst } from './json-schema.mjs';
import { validateImportedInput } from './producer-import.mjs';
import { RUNTIME_REVISION } from './workflow-root.mjs';

const validationScope = new AsyncLocalStorage();
const digest = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const hasMigration = (value) => Array.isArray(value?.operations)
  && value.operations.some((operation) => operation?.transport === 'migration');
const producerPattern = /^(step-([1-9]\d*)\/parallel-([1-9]\d*))\/response\/response\.md$/;

function within(base, relative) {
  if (typeof relative !== 'string' || !relative || /[\\:\0]/.test(relative)
    || path.isAbsolute(relative) || relative.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw Error('producer path is unsafe');
  }
  if (lstatSync(base).isSymbolicLink()) throw Error('producer symlinks are forbidden');
  const realBase = realpathSync(base);
  let current = base;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if (lstatSync(current).isSymbolicLink()) throw Error('producer symlinks are forbidden');
    const rel = path.relative(realBase, realpathSync(current));
    if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) throw Error('producer path escaped its session');
  }
  return current;
}

function checkedReferences(session, producer, request, response) {
  for (const ref of Object.values(request.inputs ?? {})) within(session, ref);
  for (const refs of Object.values(response.fields ?? {})) {
    for (const ref of Array.isArray(refs) ? refs : [refs]) {
      if (!lstatSync(within(producer, ref)).isFile()) throw Error('producer output is not a regular file');
    }
  }
}

function metadata(session, relative, sessionId, step, parallel) {
  const producer = within(session, relative);
  const requestFile = within(producer, 'request/request.json');
  const request = json(requestFile);
  const response = json(within(producer, 'response/response.json'));
  if (request.operatorId !== 'architecture.decide' || response.operatorId !== 'architecture.decide'
    || request.sessionId !== sessionId || request.step !== step || request.parallel !== parallel
    || response.step !== step || response.parallel !== parallel || request.exchange || response.exchange
    || response.status !== 'done') throw Error('producer is not the named completed architecture decision');
  for (const [kind, ref] of Object.entries({
    'architecture-decision': 'response/response.md', 'stack-model': 'response/data/stack-model.json',
    'current-state': 'response/data/current-state.json',
  })) if (response.fields?.[kind] !== ref) throw Error(`producer does not emit the exact ${kind} reference`);
  const state = json(within(session, 'state.json'));
  const key = `${step}/${parallel}`;
  if (state.id !== sessionId || state.steps?.[key] !== 'architecture.decide'
    || state.requestHashes?.[key] !== digest(readFileSync(requestFile))) throw Error('producer request is not frozen in its original session');
  checkedReferences(session, producer, request, response);
  const critique = within(producer, 'critique');
  const critiqueRequest = json(within(critique, 'request/request.json'));
  const critiqueResponse = json(within(critique, 'response/response.json'));
  if (critiqueRequest.operatorId !== 'architecture.decide' || critiqueResponse.operatorId !== 'architecture.decide'
    || critiqueRequest.sessionId !== sessionId || critiqueRequest.step !== step || critiqueRequest.parallel !== parallel
    || critiqueResponse.step !== step || critiqueResponse.parallel !== parallel
    || critiqueRequest.exchange !== 'critique' || critiqueResponse.exchange !== 'critique'
    || critiqueResponse.status !== 'done') throw Error('producer critique metadata does not match its architecture decision');
  if (Object.keys(critiqueRequest.inputs ?? {}).length !== 1
    || critiqueRequest.inputs?.['stack-model'] !== `${relative}/response/data/stack-model.json`) {
    throw Error('producer critique does not bind its own stack model');
  }
  checkedReferences(session, critique, critiqueRequest, critiqueResponse);
  return producer;
}

async function unitOperations(root, session, request, operations, fingerprint) {
  if (request.unit === undefined) return operations;
  const input = request.inputs?.units;
  const match = /^(step-([1-9]\d*)\/parallel-([1-9]\d*))\/response\/data\/units\.json$/.exec(input ?? '');
  if (!match || typeof request.unit !== 'string' || !request.unit) throw Error('unit requires an exact backend-plan units input');
  const importErrors = await validateImportedInput(root, session, input, 'units', { receivingSessionId: request.sessionId });
  if (importErrors.length) throw Error(importErrors.join('; '));
  const copied = within(session, match[1]);
  let originSession = session, relative = match[1];
  if (existsSync(path.join(copied, 'import.json'))) {
    const imported = json(within(copied, 'import.json'));
    const { locateWorkflowSession } = await import('./workflow-root.mjs');
    originSession = locateWorkflowSession(path.dirname(root), imported.sourceSessionId).session;
    relative = `step-${imported.sourceStep}/parallel-${imported.sourceParallel}`;
  }
  const producer = within(originSession, relative), state = json(within(originSession, 'state.json'));
  const { localAcceptedInputErrors, V22_CONTRACT } = await import('./validate-request.mjs');
  if (state.contractVersion !== V22_CONTRACT || state.runtimeRevision !== RUNTIME_REVISION || state.upgrade) throw Error('unit plan requires current accepted authority');
  const accepted = await localAcceptedInputErrors(originSession, state, `${relative}/response/data/units.json`, 'units');
  if (accepted.length) throw Error(accepted.join('; '));
  const planRequest = json(within(producer, 'request/request.json'));
  const planResponse = json(within(producer, 'response/response.json'));
  if (planRequest.operatorId !== 'backend.plan' || planResponse.operatorId !== 'backend.plan'
    || planResponse.status !== 'done' || planResponse.fields?.units !== 'response/data/units.json'
    || planResponse.fields?.['backend-plan'] !== 'response/response.md') throw Error('unit producer is not the accepted backend plan');
  const architecture = producerPattern.exec(planRequest.inputs?.['architecture-decision'] ?? '');
  if (!architecture || digest(readFileSync(within(originSession, `${architecture[1]}/response/data/stack-model.json`))) !== fingerprint)
    throw Error('unit plan does not partition the same frozen architecture');
  const { validateBackendPlanStep, backendPlanUnitOperations } = await import('../operators/backend-plan/validate.mjs');
  const verified = await validateBackendPlanStep(producer, root, { origin: true, requestPhase: 'accept' });
  if (verified.errors.length) throw Error(`unit plan: ${verified.errors.join('; ')}`);
  const units = json(within(producer, 'response/data/units.json'));
  if (units.producedBy !== 'backend.plan' || !units.units.some(unit => unit.id === request.unit && unit.kind === 'module')) throw Error('selected unit is not a planned backend module');
  const ids = backendPlanUnitOperations(readFileSync(within(producer, 'response/response.md'), 'utf8'), request.unit);
  if (!ids.length || ids.some(id => !operations.some(operation => operation.operationId === id))) throw Error('unit operations are absent from the frozen architecture');
  return operations.filter(operation => ids.includes(operation.operationId));
}

export async function validateMigrationContract(root, branchDir, request, mutations = null) {
  if (!validationScope.getStore()) {
    return validationScope.run(new Set(), () => validateMigrationContract(root, branchDir, request, mutations));
  }
  const validating = validationScope.getStore();
  const result = { errors: [], active: false, operations: [], fingerprint: null };
  if (request?.operatorId !== 'backend.generate') return result;
  const requirements = request.requirements ?? {};
  result.active = requirements.contractFingerprint != null || hasMigration(mutations);
  let producerKey;
  try {
    const match = producerPattern.exec(request.inputs?.['architecture-decision'] ?? '');
    if (!match) throw Error('architecture-decision must reference the producer receipt');
    const session = path.resolve(branchDir, '..', '..');
    if (!/^step-[1-9]\d*$/.test(path.basename(path.dirname(branchDir)))
      || !/^parallel-[1-9]\d*$/.test(path.basename(branchDir))) throw Error('backend branch is outside a session coordinate');
    const copied = within(session, match[1]);
    const copiedBytes = readFileSync(within(copied, 'response/data/stack-model.json'));
    const model = JSON.parse(copiedBytes.toString('utf8'));
    result.active ||= hasMigration(model);
    if (!result.active) return result;
    result.fingerprint = digest(copiedBytes);
    if (requirements.contractFingerprint !== result.fingerprint) throw Error('contractFingerprint must match the exact producer stack-model bytes');
    const schema = json(path.join(root, 'templates/kinds/stack-model.schema.json'));
    const shapeErrors = validateAgainst(schema, model, 'migration producer stack-model');
    if (shapeErrors.length) { result.errors.push(...shapeErrors); return result; }

    const inputRef = request.inputs['architecture-decision'];
    const importErrors = await validateImportedInput(root, session, inputRef, 'architecture-decision', { receivingSessionId: request.sessionId });
    if (importErrors.length) { result.errors.push(...importErrors); return result; }
    let originalSession = session;
    let relative = match[1];
    let sessionId = request.sessionId;
    let step = Number(match[2]);
    let parallel = Number(match[3]);
    if (existsSync(path.join(copied, 'import.json'))) {
      const manifest = json(within(copied, 'import.json'));
      const { locateWorkflowSession } = await import('./workflow-root.mjs');
      originalSession = locateWorkflowSession(path.dirname(root), manifest.sourceSessionId).session;
      relative = `step-${manifest.sourceStep}/parallel-${manifest.sourceParallel}`;
      sessionId = manifest.sourceSessionId;
      step = manifest.sourceStep;
      parallel = manifest.sourceParallel;
    }
    const producer = metadata(originalSession, relative, sessionId, step, parallel);
    if (digest(readFileSync(within(producer, 'response/data/stack-model.json'))) !== result.fingerprint) {
      throw Error('original and copied stack-model bytes differ');
    }
    producerKey = realpathSync(producer);
    if (validating.has(producerKey)) { producerKey = null; throw Error('cyclic architecture producer validation'); }
    validating.add(producerKey);
    // The producer is judged by its operator's own law — the critique it owed, the model it froze — and an
    // imported one as an origin: its frozen request is held by the import gate, and today's session gates
    // and catalogue are not the law it ran under (scripts/validate-step.mjs#origin).
    const { validateArchitectureStep } = await import('../operators/architecture-decide/validate.mjs');
    const verified = await validateArchitectureStep(producer, root, { origin: existsSync(path.join(copied, 'import.json')) });
    if (verified.errors.length) { result.errors.push(...verified.errors.map((error) => `migration producer: ${error}`)); return result; }
    result.operations = await unitOperations(root, session, request, model.operations, result.fingerprint);
    // The owner boundary is a list of exact refs or globs; the one matcher lives with the backend operator's law.
    const { refToRegExp } = await import('../operators/backend-generate/validate.mjs');
    const boundaries = (Array.isArray(requirements.mutableFileRefs) ? requirements.mutableFileRefs : []).map(refToRegExp);
    for (const operation of result.operations.filter((item) => item.transport === 'migration')) {
      for (const ref of new Set([operation.writerRef, ...operation.migrationRefs])) {
        if (!boundaries.some((re) => re.test(ref))) result.errors.push(`migration operation ${operation.operationId}: ${ref} lies outside mutableFileRefs`);
      }
    }
    if (mutations !== null) {
      if (mutations.contractFingerprint !== requirements.contractFingerprint) result.errors.push('mutations contractFingerprint differs from the frozen request');
      const attempted = Array.isArray(mutations.operations) ? mutations.operations : [];
      const original = new Map(result.operations.map((operation) => [operation.operationId, operation]));
      const seen = new Set();
      const keys = schema.properties.operations.items.required;
      for (const operation of attempted) {
        const id = operation?.operationId;
        if (seen.has(id)) result.errors.push(`migration contract: operation ${id} is repeated`);
        seen.add(id);
        if (!original.has(id)) { result.errors.push(`migration contract: operation ${id} was not declared by the producer`); continue; }
        for (const key of keys) if (JSON.stringify(operation[key]) !== JSON.stringify(original.get(id)[key])) {
          result.errors.push(`migration contract: operation ${id} changed frozen ${key}`);
        }
      }
      for (const id of original.keys()) if (!seen.has(id)) result.errors.push(`migration contract: declared operation ${id} is missing`);
    }
  } catch (error) {
    if (result.active) result.errors.push(`migration contract: ${error.message}`);
  } finally {
    if (producerKey) validating.delete(producerKey);
  }
  return result;
}
