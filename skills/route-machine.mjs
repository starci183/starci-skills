import crypto from 'node:crypto';
import { createReceipt, isCanonicalReceipt, isRoutableOperatorReturnReceipt, MATERIAL_AI_OPERATORS } from '../runtime/trace.mjs';
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
const issuedWaitResolutions = new Set();
const invocationBindings = createOperatorInvocationBindingRegistry();

function fingerprint(value) {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
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
  const canonicalInput = await canonicalInputValidator(operatorId);
  const canonicalValidator = await canonicalOutputValidator(operatorId);
  if (validateOutput !== canonicalValidator) throw new Error('validated operator return requires the exact canonical operator output validator export');
  if (!isRoutableOperatorReturnReceipt(returnReceipt) || returnReceipt?.type !== 'RETURN' || returnReceipt.operatorId !== operatorId || returnReceipt.version !== '7.5.0-alpha.1') {
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
  if (!isCanonicalReceipt(resumeReceipt) || resumeReceipt.type !== 'RESUME') throw new Error('wait resume requires a canonical runtime-issued RESUME receipt');
  if (resumeReceipt.skillId !== machineId || resumeReceipt.missionId !== missionId) throw new Error('wait resume belongs to another Skill or mission');
  if (!resumeReceipt.parentId || resumeReceipt.trace?.resumeState !== stateId || resumeReceipt.trace?.context?.waitState !== stateId || !resumeReceipt.trace?.context?.invocationRef) throw new Error('wait resume is not bound to the exact waiting state and parent invocation');
  const resolutionFingerprint = fingerprint(resolution);
  if (resumeReceipt.trace?.context?.resolvedInputFingerprint !== resolutionFingerprint || fingerprint(resumeReceipt.trace?.actualOutput) !== resolutionFingerprint) throw new Error('wait resume resolution differs from the canonical receipt');
  if (wrappedResumeReceipts.has(resumeReceipt)) throw new Error('canonical RESUME receipt was already wrapped');
  const waitIdentity = `${machineId}:${missionId}:${stateId}:${resumeReceipt.parentId}:${resumeReceipt.trace.context.invocationRef}`;
  if (issuedWaitResolutions.has(waitIdentity)) throw new Error('active WAIT identity already has a canonical RESUME resolution');
  const frozenResolution = deepFreeze(structuredClone(resolution));
  const envelope = { type: 'RESUME', missionId, machineId, stateId, ...frozenResolution };
  Object.defineProperty(envelope, VALIDATED_WAIT_RESUME, { value: true });
  Object.defineProperty(envelope, WAIT_RESUME_RECEIPT, { value: resumeReceipt });
  Object.defineProperty(envelope, WAIT_RESUME_RESOLUTION, { value: frozenResolution });
  wrappedResumeReceipts.add(resumeReceipt);
  issuedWaitResolutions.add(waitIdentity);
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
    consumedReturns.add(envelope);
  }
  if (state.kind === 'wait') {
    const resumeReceipt = envelope?.[WAIT_RESUME_RECEIPT];
    if (envelope?.[VALIDATED_WAIT_RESUME] !== true || !isCanonicalReceipt(resumeReceipt) || envelope.type !== 'RESUME') throw new Error(`${machine.id}/${stateId}: wait requires a validator-issued canonical RESUME`);
    if (!currentMissionId || envelope.missionId !== currentMissionId || envelope.machineId !== machine.id || envelope.stateId !== stateId || resumeReceipt.skillId !== machine.id || resumeReceipt.missionId !== currentMissionId) throw new Error(`${machine.id}/${stateId}: RESUME identity differs from the active wait`);
    if (fingerprint(envelope[WAIT_RESUME_RESOLUTION]) !== resumeReceipt.trace.context.resolvedInputFingerprint) throw new Error(`${machine.id}/${stateId}: RESUME resolution was retargeted`);
    if (consumedResumes.has(envelope)) throw new Error(`${machine.id}/${stateId}: RESUME was already consumed`);
    consumedResumes.add(envelope);
  }
  const matches = (state.on ?? []).filter((edge) => conditionMatches(edge.when, envelope, input));
  if (matches.length !== 1) throw new Error(`${machine.id}/${stateId}: expected one route, matched ${matches.length}`);
  const target = matches[0].target;
  if (state.kind === 'wait' && target !== state.approval?.resumeTarget) {
    throw new Error(`${machine.id}/${stateId}: RESUME target differs from declared authority target`);
  }
  if (state.kind === 'operator') {
    const returnReceipt = envelope[OPERATOR_RETURN_RECEIPT];
    invocationBindings.record(envelope.operatorId, returnReceipt.trace.actualOutput, returnReceipt);
  }
  if (state.kind === 'operator') {
    const returnReceipt = envelope[OPERATOR_RETURN_RECEIPT];
    const transitionHash = crypto.createHash('sha256').update(`${returnReceipt.receiptId}:${target}`).digest('hex');
    const transitionReceipt = createReceipt('TRANSITION', {
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
  return target;
}
