import crypto from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertProgress, createReceipt, isCanonicalReceipt, isRoutableOperatorReturnReceipt, MATERIAL_AI_OPERATORS } from '../runtime/trace.mjs';
import { createOperatorInvocationBindingRegistry } from '../operators/invocation-binding.mjs';
import { isCompletionCounterevidenceEnvelope } from '../runtime/counterevidence-envelope.mjs';
import { recordRouteIssuedTransition } from '../runtime/route-transition.mjs';

export { isRouteIssuedTransitionReceipt, routeIssuedTransitionFor } from '../runtime/route-transition.mjs';

const VALIDATED_OPERATOR_RETURN = Symbol('starci.validated-operator-return');
const OPERATOR_RETURN_RECEIPT = Symbol('starci.operator-return-receipt');
const VALIDATED_WAIT_RESUME = Symbol('starci.validated-wait-resume');
const WAIT_RESUME_RECEIPT = Symbol('starci.wait-resume-receipt');
const WAIT_RESUME_RESOLUTION = Symbol('starci.wait-resume-resolution');
const consumedReturns = new WeakSet();
const wrappedReturnReceipts = new WeakSet();
const consumedResumes = new WeakSet();
const wrappedResumeReceipts = new WeakSet();
const validatedDirectionResumeReceipts = new WeakSet();
const issuedWaitResolutions = new Set();
const invocationBindings = createOperatorInvocationBindingRegistry();
const directionWaits = new Map();
const sourceRoot = fileURLToPath(new URL('../../', import.meta.url));
const skillCatalog = JSON.parse(readFileSync(new URL('./catalog.json', import.meta.url), 'utf8'));
const canonicalMachines = new Map(skillCatalog.skills.map(({ id }) => {
  const machine = JSON.parse(readFileSync(new URL(`./${id}/machine.json`, import.meta.url), 'utf8'));
  if (machine.id !== id) throw new Error(`canonical machine id mismatch for ${id}`);
  return [id, deepFreeze(machine)];
}));
const canonicalMachineFingerprints = new Map([...canonicalMachines].map(([id, machine]) => [id, fingerprint(machine)]));

function fingerprint(value) {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function canonicalMachine(id) {
  const machine = canonicalMachines.get(id);
  if (!machine) throw new Error(`unknown canonical Skill machine ${id}`);
  return machine;
}

export function canonicalMachineFingerprint(id) {
  canonicalMachine(id);
  return canonicalMachineFingerprints.get(id);
}

function assertCanonicalMachine(machine) {
  const canonical = canonicalMachines.get(machine?.id);
  if (canonical !== machine || canonicalMachineFingerprints.get(machine.id) !== fingerprint(machine)) {
    throw new Error(`${machine?.id ?? 'unknown'}: caller-supplied or mutated Skill machine is not runtime-owned canonical state`);
  }
}

export function assertNeutralAdversarialDecision(input) {
  const decision = input?.neutralAdversarialDecision;
  const allowed = new Set(['adopt', 'reject', 'not-applicable']);
  for (const direction of ['add', 'change', 'remove']) {
    const item = decision?.[direction];
    if (!item || !allowed.has(item.disposition) || typeof item.rationale !== 'string' || item.rationale.trim() === '' || !Array.isArray(item.evidenceRefs) || item.evidenceRefs.length === 0) {
      throw new Error(`analysis requires an evidenced neutral ${direction} decision`);
    }
  }
  return true;
}

async function canonicalOutputValidator(operatorId) {
  if (typeof operatorId !== 'string' || !/^[a-z0-9-]+\/[a-z0-9-]+$/.test(operatorId)) {
    throw new Error('validated operator return requires a safe canonical operator id');
  }
  const module = await import(new URL(`../operators/${operatorId}/validate-output.mjs`, import.meta.url));
  if (typeof module.validateOutput !== 'function') throw new Error(`${operatorId}: canonical output validator is missing`);
  return module.validateOutput;
}

async function canonicalInputValidator(operatorId) {
  if (typeof operatorId !== 'string' || !/^[a-z0-9-]+\/[a-z0-9-]+$/.test(operatorId)) {
    throw new Error('validated operator return requires a safe canonical operator id');
  }
  const module = await import(new URL(`../operators/${operatorId}/validate-input.mjs`, import.meta.url));
  if (typeof module.validateInput !== 'function') throw new Error(`${operatorId}: canonical input validator is missing`);
  return module.validateInput;
}

export async function validatedOperatorReturn({ machineId, stateId, operatorId, input, outputDocument, validateOutput, returnReceipt }) {
  const machine = canonicalMachine(machineId);
  if (machine.states[stateId]?.kind !== 'operator' || machine.states[stateId]?.ref !== operatorId) {
    throw new Error('validated operator return must name the exact canonical machine state and operator');
  }
  const canonicalInput = await canonicalInputValidator(operatorId);
  const canonicalValidator = await canonicalOutputValidator(operatorId);
  if (validateOutput !== canonicalValidator) throw new Error('validated operator return requires the exact canonical operator output validator export');
  if (!isRoutableOperatorReturnReceipt(returnReceipt) || returnReceipt?.type !== 'RETURN' || returnReceipt.operatorId !== operatorId || returnReceipt.version !== '7.6.0-beta.1') {
    throw new Error('validated operator return requires the canonical operator RETURN receipt');
  }
  if (returnReceipt.skillId !== machineId) throw new Error('canonical operator RETURN belongs to another Skill machine');
  const inputValidation = canonicalInput(input);
  if (!inputValidation?.valid) throw new Error(`operator input failed validation: ${(inputValidation?.errors ?? []).join('; ')}`);
  if (!returnReceipt.trace?.expectedOutput || typeof returnReceipt.trace.expectedOutput !== 'object') {
    throw new Error('canonical operator RETURN requires a non-null expected output contract');
  }
  if (wrappedReturnReceipts.has(returnReceipt)) throw new Error('canonical operator RETURN receipt was already wrapped');
  if (fingerprint(returnReceipt.trace?.input) !== fingerprint(input) || fingerprint(returnReceipt.trace?.actualOutput) !== fingerprint(outputDocument)) {
    throw new Error('canonical RETURN receipt is not bound to the exact input and output documents');
  }
  const executionRef = returnReceipt.trace?.aiActivity?.executionRef ?? returnReceipt.trace?.context?.executionRef;
  const invocationRef = returnReceipt.trace?.context?.invocationRef;
  if (!executionRef || !invocationRef) throw new Error('canonical RETURN receipt lacks execution or invocation identity');
  const validation = validateOutput(outputDocument);
  if (!validation?.valid) throw new Error(`operator output failed validation: ${(validation?.errors ?? []).join('; ')}`);
  if (outputDocument?.operatorId !== operatorId) throw new Error('validated operator return operatorId mismatch');
  const bindingErrors = invocationBindings.validate(operatorId, input, outputDocument, returnReceipt);
  if (bindingErrors.length > 0) throw new Error(`operator invocation binding failed: ${bindingErrors.join('; ')}`);
  const envelope = {
    type: 'RETURN',
    missionId: returnReceipt.missionId,
    machineId,
    stateId,
    operatorId,
    executionRef,
    invocationRef,
    inputFingerprint: fingerprint(input),
    outputFingerprint: fingerprint(outputDocument),
    output: returnReceipt.trace.actualOutput.output,
  };
  Object.defineProperty(envelope, VALIDATED_OPERATOR_RETURN, { value: true });
  Object.defineProperty(envelope, OPERATOR_RETURN_RECEIPT, { value: returnReceipt });
  wrappedReturnReceipts.add(returnReceipt);
  return Object.freeze(envelope);
}

export function validatedWaitResume({ machineId, stateId, missionId, resumeReceipt, resolution }) {
  let pendingDirectionSelection = null;
  if (!isCanonicalReceipt(resumeReceipt) || resumeReceipt.type !== 'RESUME') throw new Error('wait resume requires a canonical runtime-issued RESUME receipt');
  if (resumeReceipt.skillId !== machineId || resumeReceipt.missionId !== missionId) throw new Error('wait resume belongs to another Skill or mission');
  if (!resumeReceipt.parentId || resumeReceipt.trace?.resumeState !== stateId || resumeReceipt.trace?.context?.waitState !== stateId || !resumeReceipt.trace?.context?.invocationRef) throw new Error('wait resume is not bound to the exact waiting state and parent invocation');
  if (machineId === 'starci-fe-process' && stateId === 'direction-choice') {
    const authority = directionWaits.get(resumeReceipt.parentId);
    if (!authority || authority.machineId !== machineId || authority.missionId !== missionId || authority.waitReceipt.receiptId !== resumeReceipt.parentId) throw new Error('direction choice RESUME does not descend from the exact generated-direction WAIT');
    const keys = Object.keys(resolution).sort();
    if (resolution?.decision === 'approve') {
      const expectedKeys = ['comparisonArtifactRef','decision','generatedDirectionReceiptRef','selectedDirectionId'];
      if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) throw new Error('approved direction resolution has an invalid shape');
      if (!authority.directionIds.has(resolution.selectedDirectionId)) throw new Error('selected direction is not a generated candidate');
      pendingDirectionSelection = {
        directionReturnReceiptRef: resolution.generatedDirectionReceiptRef,
        selectedDirectionId: resolution.selectedDirectionId,
        comparisonArtifactRef: resolution.comparisonArtifactRef,
        resumeReceiptId: resumeReceipt.receiptId,
      };
    } else if (resolution?.decision === 'reject') {
      const expectedKeys = ['comparisonArtifactRef','decision','generatedDirectionReceiptRef','reason'];
      if (JSON.stringify(keys) !== JSON.stringify(expectedKeys) || typeof resolution.reason !== 'string' || resolution.reason.trim() === '') throw new Error('rejected direction resolution requires one exact reason');
    } else {
      throw new Error('direction resolution decision must be approve or reject');
    }
    if (resolution.generatedDirectionReceiptRef !== authority.directionReturnReceipt.receiptId || resolution.comparisonArtifactRef !== authority.comparisonArtifactRef) throw new Error('direction resolution was substituted from another generated comparison');
  }
  const resolutionFingerprint = fingerprint(resolution);
  if (resumeReceipt.trace?.context?.resolvedInputFingerprint !== resolutionFingerprint || fingerprint(resumeReceipt.trace?.actualOutput) !== resolutionFingerprint) throw new Error('wait resume resolution differs from the canonical receipt');
  if (wrappedResumeReceipts.has(resumeReceipt)) throw new Error('canonical RESUME receipt was already wrapped');
  const waitIdentity = `${machineId}:${missionId}:${stateId}:${resumeReceipt.parentId}:${resumeReceipt.trace.context.invocationRef}`;
  if (issuedWaitResolutions.has(waitIdentity)) throw new Error('active WAIT identity already has a canonical RESUME resolution');
  const frozenResolution = deepFreeze(structuredClone(resolution));
  const envelope = { type: 'RESUME', missionId, machineId, stateId, payload: frozenResolution, ...frozenResolution };
  Object.defineProperty(envelope, VALIDATED_WAIT_RESUME, { value: true });
  Object.defineProperty(envelope, WAIT_RESUME_RECEIPT, { value: resumeReceipt });
  Object.defineProperty(envelope, WAIT_RESUME_RESOLUTION, { value: frozenResolution });
  wrappedResumeReceipts.add(resumeReceipt);
  if (pendingDirectionSelection) invocationBindings.recordDirectionSelection(pendingDirectionSelection.directionReturnReceiptRef, pendingDirectionSelection);
  if (machineId === 'starci-fe-process' && stateId === 'direction-choice') validatedDirectionResumeReceipts.add(resumeReceipt);
  issuedWaitResolutions.add(waitIdentity);
  if (machineId === 'starci-fe-process' && stateId === 'direction-choice') directionWaits.delete(resumeReceipt.parentId);
  return Object.freeze(envelope);
}

function readPath(value, dottedPath) {
  return dottedPath.split('.').reduce((node, part) => node?.[part], value);
}

export function conditionMatches(condition, envelope, input) {
  if (condition.stage !== undefined && envelope?.stage !== condition.stage) return false;
  if (condition.status !== undefined && envelope?.status !== condition.status) return false;
  if (condition.decision !== undefined && envelope?.payload?.decision !== condition.decision) return false;
  const facts = new Set(envelope?.facts ?? []);
  if ((condition.allFacts ?? []).some((fact) => !facts.has(fact))) return false;
  if ((condition.noneFacts ?? []).some((fact) => facts.has(fact))) return false;
  for (const [key, expected] of Object.entries(condition.inputEquals ?? {})) {
    if (readPath(input, key) !== expected) return false;
  }
  const output = envelope?.output;
  for (const [key, expected] of Object.entries(condition.outputEquals ?? {})) {
    if (readPath(output, key) !== expected) return false;
  }
  return true;
}

export function nextState(machine, stateId, envelope, input, currentInvocationRef = null, currentMissionId = null) {
  assertCanonicalMachine(machine);
  const state = machine.states[stateId];
  if (!state) throw new Error(`unknown state ${stateId}`);
  if (state.kind === 'analysis') assertNeutralAdversarialDecision(input);
  if (state.kind === 'terminal') {
    if (!envelope) return null;
    if (!isCompletionCounterevidenceEnvelope(envelope) || envelope.missionId !== currentMissionId || envelope.skillId !== machine.id) throw new Error(`${machine.id}/${stateId}: terminal may reopen only from canonical same-mission same-skill counterevidence`);
    if (envelope.canClose) return null;
    if (!machine.states[envelope.nextState]) throw new Error(`${machine.id}/${stateId}: counterevidence resume target is not owned by this machine`);
    return envelope.nextState;
  }
  if (state.kind === 'operator') {
    if (envelope?.[VALIDATED_OPERATOR_RETURN] !== true) {
      throw new Error(`${machine.id}/${stateId}: operator route requires a validator-issued RETURN envelope`);
    }
    if (envelope.type !== 'RETURN' || envelope.machineId !== machine.id || envelope.stateId !== stateId || envelope.operatorId !== state.ref) {
      throw new Error(`${machine.id}/${stateId}: validated RETURN is bound to another invocation`);
    }
    if (!currentInvocationRef || envelope.invocationRef !== currentInvocationRef) {
      throw new Error(`${machine.id}/${stateId}: validated RETURN invocation identity differs from the active invocation`);
    }
    if (!currentMissionId || envelope.missionId !== currentMissionId) throw new Error(`${machine.id}/${stateId}: validated RETURN mission identity differs from the active mission`);
    if (!envelope.executionRef || !envelope.invocationRef || !/^sha256:[0-9a-f]{64}$/.test(envelope.inputFingerprint) || !/^sha256:[0-9a-f]{64}$/.test(envelope.outputFingerprint)) {
      throw new Error(`${machine.id}/${stateId}: validated RETURN lacks execution provenance`);
    }
    if (envelope.inputFingerprint !== fingerprint(input)) {
      throw new Error(`${machine.id}/${stateId}: validated RETURN input fingerprint differs from the current invocation`);
    }
    if (consumedReturns.has(envelope)) {
      throw new Error(`${machine.id}/${stateId}: validated RETURN was already consumed`);
    }
    const returnReceipt = envelope[OPERATOR_RETURN_RECEIPT];
    assertProgress([...(input?.progressHistory ?? []), returnReceipt.progressFingerprint]);
    consumedReturns.add(envelope);
  }
  if (state.kind === 'wait') {
    const resumeReceipt = envelope?.[WAIT_RESUME_RECEIPT];
    if (envelope?.[VALIDATED_WAIT_RESUME] !== true || !isCanonicalReceipt(resumeReceipt) || envelope.type !== 'RESUME') throw new Error(`${machine.id}/${stateId}: wait requires a validator-issued canonical RESUME`);
    if (!currentMissionId || envelope.missionId !== currentMissionId || envelope.machineId !== machine.id || envelope.stateId !== stateId || resumeReceipt.skillId !== machine.id || resumeReceipt.missionId !== currentMissionId) throw new Error(`${machine.id}/${stateId}: RESUME identity differs from the active wait`);
    if (fingerprint(envelope[WAIT_RESUME_RESOLUTION]) !== resumeReceipt.trace.context.resolvedInputFingerprint) throw new Error(`${machine.id}/${stateId}: RESUME resolution was retargeted`);
    if (consumedResumes.has(envelope)) throw new Error(`${machine.id}/${stateId}: RESUME was already consumed`);
    assertProgress([...(input?.progressHistory ?? []), resumeReceipt.progressFingerprint]);
    consumedResumes.add(envelope);
  }
  const matches = (state.on ?? []).filter((edge) => conditionMatches(edge.when, envelope, input));
  if (matches.length !== 1) throw new Error(`${machine.id}/${stateId}: expected one route, matched ${matches.length}`);
  const target = matches[0].target;
  if (state.kind === 'wait' && envelope?.payload?.decision !== 'reject' && target !== state.approval?.resumeTarget) {
    throw new Error(`${machine.id}/${stateId}: RESUME target differs from declared authority target`);
  }
  let transitionReceipt = null;
  if (state.kind === 'operator') {
    const returnReceipt = envelope[OPERATOR_RETURN_RECEIPT];
    invocationBindings.record(envelope.operatorId, returnReceipt.trace.actualOutput, returnReceipt);
  }
  if (state.kind === 'operator') {
    const returnReceipt = envelope[OPERATOR_RETURN_RECEIPT];
    const transitionHash = crypto.createHash('sha256').update(`${returnReceipt.receiptId}:${target}`).digest('hex');
    transitionReceipt = createReceipt('TRANSITION', {
      receiptId: `receipt:transition-${transitionHash}`,
      missionId: returnReceipt.missionId,
      skillId: returnReceipt.skillId,
      operatorId: returnReceipt.operatorId,
      parentId: returnReceipt.receiptId,
      childId: null,
      missionContext: returnReceipt.trace.missionContext,
      context: returnReceipt.trace.context,
      input: returnReceipt.trace.input,
      expectedOutput: returnReceipt.trace.expectedOutput,
      actualOutput: returnReceipt.trace.actualOutput,
      evidenceRefs: returnReceipt.trace.evidenceRefs,
      sourceHeads: returnReceipt.trace.sourceHeads,
      transitionRule: { outcome: envelope.output?.outcome ?? null, target },
      aiActivity: returnReceipt.trace.aiActivity,
    }, { debug: true });
    recordRouteIssuedTransition(returnReceipt, transitionReceipt);
  }
  if (state.kind === 'operator' && target === 'direction-choice') {
    const returnReceipt = envelope[OPERATOR_RETURN_RECEIPT];
    const result = returnReceipt.trace?.actualOutput?.output?.result;
    const comparisonArtifactRef = result?.comparisonArtifactRef;
    const artifactPath = typeof comparisonArtifactRef === 'string' ? path.resolve(sourceRoot, comparisonArtifactRef) : '';
    const relativeArtifactPath = artifactPath ? path.relative(sourceRoot, artifactPath) : '..';
    if (result?.mode !== 'alternatives' || result?.requiresChoice !== true || ![3,4].includes(result?.directionCount) || result?.directions?.length !== result.directionCount ||
        !result?.artifactRefs?.includes(comparisonArtifactRef) || !/\.html$/.test(comparisonArtifactRef ?? '') || relativeArtifactPath.startsWith('..') || path.isAbsolute(relativeArtifactPath) || !existsSync(artifactPath)) {
      throw new Error('direction-choice requires one exact existing local HTML comparison with three or four validated alternatives');
    }
    const waitHash = crypto.createHash('sha256').update(`${transitionReceipt.receiptId}:direction-choice`).digest('hex');
    const waitReceipt = createReceipt('WAIT', {
      receiptId: `receipt:direction-wait-${waitHash}`,
      missionId: returnReceipt.missionId,
      skillId: machine.id,
      operatorId: null,
      parentId: transitionReceipt.receiptId,
      childId: null,
      context: {
        waitState: 'direction-choice',
        invocationRef: returnReceipt.trace.context.invocationRef,
        generatedDirectionReceiptRef: returnReceipt.receiptId,
        comparisonArtifactRef,
        directionIds: result.directions.map(({ id }) => id),
      },
      evidenceRefs: [comparisonArtifactRef, ...result.directions.map(({ visualPanelRef }) => visualPanelRef)],
      resumeState: 'direction-choice',
    }, { debug: true });
    directionWaits.set(waitReceipt.receiptId, {
      machineId: machine.id,
      missionId: returnReceipt.missionId,
      waitReceipt,
      directionReturnReceipt: returnReceipt,
      comparisonArtifactRef,
      directionIds: new Set(result.directions.map(({ id }) => id)),
    });
  }
  return target;
}

export function directionChoiceWaitReceipt(missionId) {
  return [...directionWaits.values()].reverse().find((entry) => entry.missionId === missionId)?.waitReceipt ?? null;
}

export function isValidatedDirectionChoiceResume(receipt) {
  return validatedDirectionResumeReceipts.has(receipt) && isCanonicalReceipt(receipt);
}
