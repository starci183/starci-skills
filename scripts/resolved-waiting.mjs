// One accepted waiting parent may be superseded without resuming only when its exact nested exchange
// returned a sealed mismatch and a later same-operator attempt explicitly binds that outcome. This
// module is the single law used at successor admission, whole-session validation and close-success.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { readFileSync, realpathSync } from 'node:fs';
import { readContext, invocationState } from './mission-history.mjs';
import { scopeHash } from './mission-scope.mjs';
import { evidenceManifestErrors } from './evidence-manifest.mjs';
import { loadErrorsRegistry } from './errors-registry.mjs';
import { loadOperatorPackages } from './operator-md.mjs';

const V22_CONTRACT = 'starci/v2.2';
const TERMINAL = new Set(['matched', 'mismatched', 'inconclusive', 'blocked']);
const CHILD_NEXT = new Set(['repair', 'retry', 'blocked']);
const sha = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};
const unquote = (value) => { const text = String(value ?? '').trim(); return /^`[^`]*`$/.test(text) ? text.slice(1, -1) : text; };
const branchDir = (session, key) => {
  const [step, parallel, exchange] = key.split('/');
  return path.join(session, `step-${step}`, `parallel-${parallel}`, ...(exchange ? [exchange] : []));
};
const refBase = (key) => {
  const [step, parallel, exchange] = key.split('/');
  return `step-${step}/parallel-${parallel}${exchange ? `/${exchange}` : ''}`;
};
async function readJson(file, errors, label) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { errors.push(`${label} is unreadable: ${error.message}`); return null; }
}

export async function resolvedWaitingReplanErrors(root, session, state, successorRequest, { requireSuccessorRecorded = false, requireSuccessorTerminal = false, reviewBinding = null } = {}) {
  const errors = [];
  const successorKey = `${successorRequest?.step}/${successorRequest?.parallel}`;
  const resume = successorRequest?.resume;
  const parentKey = resume ? `${resume.step}/${resume.parallel}` : null;
  if (!/^[1-9][0-9]*\/[1-9][0-9]*$/.test(parentKey ?? '') || !/^[1-9][0-9]*\/[1-9][0-9]*$/.test(successorKey)) return ['REVIEW_REENTRY_UNBOUND: parent and successor must be positive execution coordinates'];
  const parent = parentKey ? state.attempts?.[parentKey] : null;
  if (!resume || parent?.status !== 'waiting') return [`request.json: ${successorKey} does not name an accepted waiting parent`];
  if (!state.id || successorRequest.sessionId !== state.id) errors.push(`request.json: successor ${successorKey} is not bound to session ${state.id ?? 'missing'}`);
  if (successorRequest.exchange) errors.push(`request.json: resolved waiting parent ${parentKey} re-enters through a top-level attempt, not another exchange`);
  if (Number(resume.step) >= Number(successorRequest.step)) errors.push(`request.json: resolved waiting parent ${parentKey} must precede successor ${successorKey}`);
  if (successorRequest.operatorId !== parent.operatorId || state.steps?.[successorKey] !== parent.operatorId) errors.push(`request.json: resolved waiting parent ${parentKey} and successor ${successorKey} must run the same recorded operator`);
  if (successorRequest.attempt?.previous !== parent.id || successorRequest.attempt?.number !== parent.number + 1) errors.push(`request.json: successor ${successorKey} does not directly follow waiting attempt ${parent.id}`);
  const resumeRecord = state.resumes?.[successorKey];
  const claimedSuccessors = Object.entries(state.resumes ?? {}).filter(([, value]) => value?.resumes === parentKey).map(([key]) => key);
  if (claimedSuccessors.length !== 1 || claimedSuccessors[0] !== successorKey) errors.push(`REVIEW_REENTRY_UNBOUND: waiting parent ${parentKey} requires exactly one recorded successor`);
  if (!reviewBinding && state.planHistory?.active) reviewBinding = readContext(session, state.planHistory.active, 'plans').forecast.reviewResumes?.[successorKey] ?? null;
  if (resumeRecord?.resumes !== parentKey) errors.push(`state.json: resumes[${successorKey}] does not bind waiting parent ${parentKey}`);
  const cells = (state.chain ?? []).flat();
  if (cells.filter((cell) => cell === parentKey).length !== 1 || cells.filter((cell) => cell === successorKey).length !== 1 || cells.indexOf(parentKey) >= cells.indexOf(successorKey)) errors.push(`state.json: chain does not place exact waiting parent ${parentKey} before successor ${successorKey}`);

  const parentDir = branchDir(session, parentKey);
  const parentBase = refBase(parentKey);
  if (parent.requestRef !== `${parentBase}/request/request.json` || parent.responseRef !== `${parentBase}/response/response.json` || !parent.endedAt) errors.push(`state.json: waiting parent ${parentKey} is not linked to its accepted request and response`);
  for (const error of await evidenceManifestErrors(parentDir, parent.evidenceManifest)) errors.push(`state.json: waiting parent ${parentKey} ${error}`);
  const parentRequestFile = path.join(parentDir, 'request', 'request.json');
  const parentResponseFile = path.join(parentDir, 'response', 'response.json');
  const parentRequest = await readJson(parentRequestFile, errors, `waiting parent ${parentKey} request`);
  const parentResponse = await readJson(parentResponseFile, errors, `waiting parent ${parentKey} response`);
  let parentRequestHash = null;
  try { parentRequestHash = sha(await readFile(parentRequestFile)); } catch {}
  if (state.requestHashes?.[parentKey] !== parentRequestHash
    || parentRequest?.contractVersion !== V22_CONTRACT
    || parentRequest?.sessionId !== state.id
    || parentRequest?.attempt?.id !== parent.id
    || parentRequest?.expected?.version !== parent.expectedVersion
    || parentRequest?.operatorId !== parent.operatorId
    || parentRequest?.step !== Number(resume.step)
    || parentRequest?.parallel !== Number(resume.parallel)) errors.push(`state.json: waiting parent ${parentKey} does not match its frozen request identity`);
  const exchange = parentResponse?.awaiting?.exchange;
  const awaitedKind = parentResponse?.awaiting?.kind;
  if (!/^[a-z][a-z0-9-]*$/.test(exchange ?? '') || !/^[a-z][a-z0-9-]*$/.test(awaitedKind ?? '')) return [...errors, 'REVIEW_REENTRY_UNBOUND: accepted checkpoint has an invalid exchange or kind'];
  if (parentResponse?.contractVersion !== V22_CONTRACT
    || parentResponse?.status !== 'waiting'
    || parentResponse?.operatorId !== parent.operatorId
    || parentResponse?.attempt?.id !== parent.id
    || parentResponse?.attempt?.expectedVersion !== parent.expectedVersion
    || !exchange
    || !awaitedKind) errors.push(`state.json: waiting parent ${parentKey} has no intact accepted exchange checkpoint`);

  const childKey = exchange ? `${parentKey}/${exchange}` : null;
  const child = childKey ? state.attempts?.[childKey] : null;
  if (!child || !['matched', 'mismatched', 'inconclusive'].includes(child.status)) errors.push(`state.json: waiting parent ${parentKey} has no accepted terminal ${exchange ?? 'missing'} exchange`);
  if (child) {
    const childDir = branchDir(session, childKey);
    const childBase = refBase(childKey);
    if (child.operatorId !== parent.operatorId || child.requestRef !== `${childBase}/request/request.json` || child.responseRef !== `${childBase}/response/response.json` || !child.endedAt) errors.push(`state.json: awaited exchange ${childKey} is not linked to the waiting parent identity`);
    for (const error of await evidenceManifestErrors(childDir, child.evidenceManifest)) errors.push(`state.json: awaited exchange ${childKey} ${error}`);
    const childRequestFile = path.join(childDir, 'request', 'request.json');
    const childResponseFile = path.join(childDir, 'response', 'response.json');
    const childRequest = await readJson(childRequestFile, errors, `awaited exchange ${childKey} request`);
    const childResponse = await readJson(childResponseFile, errors, `awaited exchange ${childKey} response`);
    let childRequestHash = null;
    try { childRequestHash = sha(await readFile(childRequestFile)); } catch {}
    if (state.requestHashes?.[childKey] !== childRequestHash
      || childRequest?.contractVersion !== V22_CONTRACT
      || childRequest?.sessionId !== state.id
      || childRequest?.operatorId !== parent.operatorId
      || childRequest?.step !== Number(resume.step)
      || childRequest?.parallel !== Number(resume.parallel)
      || childRequest?.exchange !== exchange
      || childRequest?.attempt?.id !== child.id
      || childRequest?.expected?.version !== child.expectedVersion) errors.push(`state.json: awaited exchange ${childKey} does not match its frozen request identity`);
    const acceptedParentInputs = Object.entries(childRequest?.inputs ?? {}).filter(([kind, inputRef]) => {
      const declared = parentResponse?.fields?.[kind];
      const refs = Array.isArray(declared) ? declared : declared ? [declared] : [];
      return inputRef === childRequest?.expected?.sourceRef && refs.some((ref) => inputRef === `${parentBase}/${ref}`);
    });
    if (acceptedParentInputs.length !== 1) errors.push(`state.json: awaited exchange ${childKey} does not consume its expected model from the exact accepted waiting output of ${parentKey}`);
    const declared = childResponse?.fields?.[awaitedKind];
    const refs = Array.isArray(declared) ? declared : declared ? [declared] : [];
    if (childResponse?.contractVersion !== V22_CONTRACT
      || childResponse?.operatorId !== parent.operatorId
      || childResponse?.step !== Number(resume.step)
      || childResponse?.parallel !== Number(resume.parallel)
      || childResponse?.exchange !== exchange
      || childResponse?.status !== (child.status === 'matched' ? 'done' : 'mismatch')
      || childResponse?.attempt?.id !== child.id
      || childResponse?.attempt?.expectedVersion !== child.expectedVersion
      || canonical(childResponse?.comparison) !== canonical(child.comparison)
      || childResponse?.comparison?.verdict !== child.status
      || !(child.status === 'matched' ? childResponse?.comparison?.next === 'advance' : CHILD_NEXT.has(childResponse?.comparison?.next))
      || !refs.length) errors.push(`state.json: awaited exchange ${childKey} is not the accepted terminal review for ${awaitedKind ?? 'missing'}`);
    for (const ref of refs) if (!child.evidenceManifest?.files?.some((item) => item.ref === ref)) errors.push(`state.json: awaited exchange ${childKey} accepted manifest does not contain ${awaitedKind} output ${ref}`);
    if (child.status === 'matched' || reviewBinding) {
      try {
        const contract = JSON.parse(await readFile(path.join(root, 'templates/kinds', `${awaitedKind}.contract.json`), 'utf8'));
        if (!contract.reentry || resumeRecord?.stop !== contract.reentry.stop) throw Error('the awaited kind has no matching declared return route');
        const expectedBinding = reviewIdentity(state, parentKey, childKey);
        if (!reviewBinding || canonical(reviewBinding.identity) !== canonical(expectedBinding)) throw Error('the review recovery is not bound to this exact mission, parent and child proof');
        if (reviewBinding.mode === 'integrity') {
          const disclosure = reviewBinding.disclosure;
          if (sha(disclosure?.bytes ?? '') !== disclosure?.hash) throw Error('the retained integrity disclosure digest changed');
          const value = JSON.parse(disclosure.bytes);
          if (canonical(value.identity) !== canonical(expectedBinding) || value.version !== 1 || value.disposition !== 'fresh-review-required' || typeof value.reason !== 'string' || !value.reason.trim() || typeof value.sourceRef !== 'string' || !value.sourceRef.trim() || Object.keys(value).some(key => !['version','identity','disposition','reason','sourceRef'].includes(key))) throw Error('integrity disclosure must identify the admitted concern, not authorize delivery');
        } else if (reviewBinding.mode === 'return') {
          const { tableUnder } = await import('./validate-response.mjs');
          if (refs.length !== 1 || (tableUnder(await readFile(path.join(childDir, refs[0]), 'utf8'), contract.reentry.heading) ?? []).find(row => row[0] === contract.reentry.row)?.[1] !== contract.reentry.value) throw Error('the accepted review does not select the declared return verdict');
        } else throw Error('unknown review recovery mode');
        for (const input of Object.values(successorRequest.inputs ?? {}).flat()) if (typeof input === 'string' && (input.startsWith(`${childBase}/`) || input.startsWith(`${parentBase}/`))) throw Error('the replacement must use fresh review evidence, not the disputed or returned parent/child as delivery input');
      } catch (error) { errors.push(`REVIEW_REENTRY_UNBOUND: ${error.message}`); }
    }
  }

  const registry = await loadErrorsRegistry(root);
  const stop = resumeRecord?.stop;
  const stopEntry = registry.codes?.[stop];
  const packages = await loadOperatorPackages(root);
  const pkg = packages.find((item) => item.manifest.id === parent.operatorId);
  const declaredStops = new Set((pkg?.en.tables.stops?.rows ?? []).map((row) => unquote(row.code)));
  if (!stopEntry || !registry.allowed(stop, parent.operatorId) || !declaredStops.has(stop) || stopEntry.domain !== 'self' || stopEntry.disposition !== 'terminate') errors.push(`state.json: resumes[${successorKey}].stop ${stop ?? 'missing'} is not a declared terminating self-route of ${parent.operatorId}`);

  const successor = state.attempts?.[successorKey];
  if (requireSuccessorRecorded && !successor) errors.push(`state.json: resolved waiting parent ${parentKey} has no recorded successor ${successorKey}`);
  if (successor) {
    const successorDir = branchDir(session, successorKey);
    const successorBase = refBase(successorKey);
    const successorRequestFile = path.join(successorDir, 'request', 'request.json');
    let successorRequestHash = null;
    try { successorRequestHash = sha(await readFile(successorRequestFile)); } catch {}
    if (successor.id !== successorRequest.attempt?.id
      || successorRequest.sessionId !== state.id
      || successor.operatorId !== successorRequest.operatorId
      || successor.number !== successorRequest.attempt?.number
      || successor.previous !== parent.id
      || successor.expectedVersion !== successorRequest.expected?.version
      || successor.requestRef !== `${successorBase}/request/request.json`
      || state.requestHashes?.[successorKey] !== successorRequestHash) errors.push(`state.json: successor ${successorKey} is not linked to the admitted frozen replan request`);
    if (successor.status !== 'running') {
      if (successor.responseRef !== `${successorBase}/response/response.json` || !successor.endedAt) errors.push(`state.json: successor ${successorKey} is not linked to its accepted response`);
      for (const error of await evidenceManifestErrors(successorDir, successor.evidenceManifest)) errors.push(`state.json: successor ${successorKey} ${error}`);
      const successorResponse = await readJson(path.join(successorDir, 'response', 'response.json'), errors, `successor ${successorKey} response`);
      const mapped = successorResponse?.status === 'done' ? 'matched' : successorResponse?.status === 'mismatch' ? successorResponse?.comparison?.verdict : successorResponse?.status;
      if (mapped !== successor.status
        || successorResponse?.contractVersion !== V22_CONTRACT
        || successorResponse?.operatorId !== successor.operatorId
        || successorResponse?.step !== successorRequest.step
        || successorResponse?.parallel !== successorRequest.parallel
        || successorResponse?.attempt?.id !== successor.id
        || successorResponse?.attempt?.expectedVersion !== successor.expectedVersion
        || (successorResponse?.comparison && canonical(successorResponse.comparison) !== canonical(successor.comparison))) errors.push(`state.json: successor ${successorKey} is not its accepted ${successor.status} response`);
    }
  }
  if (requireSuccessorTerminal && (!successor || !TERMINAL.has(successor.status))) errors.push(`state.json: resolved waiting parent ${parentKey} has no terminal accepted successor ${successorKey}`);
  return errors;
}

function reviewIdentity(state, parent, child) {
  const identity = cell => ({ cell, attemptId: state.attempts?.[cell]?.id, requestHash: state.requestHashes?.[cell], evidenceFingerprint: state.attempts?.[cell]?.evidenceManifest?.fingerprint });
  return { sessionId: state.id, missionVersion: state.mission?.version, scopeHash: scopeHash(state.mission), parent: identity(parent), child: identity(child) };
}

// The disclosure is retained inside the sealed forecast; it is never a typed delivery output.
export async function waitingReviewBinding(root, session, state, parentKey, integrity = null) {
  if (!/^[1-9][0-9]*\/[1-9][0-9]*$/.test(parentKey)) throw Error('REVIEW_REENTRY_UNBOUND: invalid parent coordinate');
  const parent = state.attempts?.[parentKey];
  const response = JSON.parse(await readFile(path.join(branchDir(session, parentKey), 'response/response.json'), 'utf8'));
  const exchange = response.awaiting?.exchange;
  if (!/^[a-z][a-z0-9-]*$/.test(exchange ?? '') || !/^[a-z][a-z0-9-]*$/.test(response.awaiting?.kind ?? '')) throw Error('REVIEW_REENTRY_UNBOUND: parent has no declared review checkpoint');
  const childKey = `${parentKey}/${exchange}`, child = state.attempts?.[childKey];
  if (parent?.expected?.goalVersion !== state.mission?.version || child?.expected?.goalVersion !== state.mission?.version || !parent?.context || !child?.context) throw Error('REVIEW_REENTRY_UNBOUND: recovery requires current invocation contexts');
  for (const cell of [parentKey, childKey]) {
    const request = JSON.parse(await readFile(path.join(branchDir(session, cell), 'request/request.json'), 'utf8'));
    if (scopeHash(invocationState(session, state, request).mission) !== scopeHash(state.mission)) throw Error('REVIEW_REENTRY_UNBOUND: retained invocation belongs to another confirmed scope');
  }
  const contract = JSON.parse(await readFile(path.join(root, 'templates/kinds', `${response.awaiting.kind}.contract.json`), 'utf8'));
  if (!contract.reentry) throw Error('REVIEW_REENTRY_UNBOUND: the awaited kind does not declare review re-entry');
  const binding = { mode: integrity ? 'integrity' : 'return', stop: contract.reentry.stop, identity: reviewIdentity(state, parentKey, childKey) };
  if (integrity) {
    if (typeof integrity.ref !== 'string' || path.isAbsolute(integrity.ref) || integrity.ref.includes('\\') || integrity.ref.split('/').some(part => !part || part === '.' || part === '..') || !/^sha256:[a-f0-9]{64}$/.test(integrity.hash ?? '') || Object.keys(integrity).some(key => !['ref','hash'].includes(key))) throw Error('REVIEW_REENTRY_UNBOUND: name the exact session-owned disclosure and digest');
    const file = path.resolve(session, integrity.ref), relative = path.relative(realpathSync(session), realpathSync(file));
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('REVIEW_REENTRY_UNBOUND: disclosure escaped the session');
    binding.disclosure = { ref: integrity.ref, hash: integrity.hash, bytes: readFileSync(file, 'utf8') };
  }
  const next = `${Math.max(...Object.keys(state.steps).map(key => Number(key.split('/')[0]))) + 1}/1`;
  const [step, parallel] = next.split('/').map(Number), [sourceStep, sourceParallel] = parentKey.split('/').map(Number);
  const request = { sessionId: state.id, operatorId: parent.operatorId, step, parallel, resume: { step: sourceStep, parallel: sourceParallel }, attempt: { previous: parent.id, number: parent.number + 1 } };
  const projected = { ...state, steps: { ...state.steps, [next]: parent.operatorId }, chain: [...state.chain, [next]], resumes: { ...state.resumes, [next]: { resumes: parentKey, stop: binding.stop } } };
  const errors = await resolvedWaitingReplanErrors(root, session, projected, request, { reviewBinding: binding });
  if (errors.length) throw Error(errors.join('\n'));
  return binding;
}

export async function resolvedWaitingAttemptKeys(root, session, state, { requireSuccessorTerminal = false } = {}) {
  const settled = new Set();
  const retired = new Set();
  const errors = [];
  const { planHistoryErrors, retiredPlanCell } = await import('./plan-history.mjs');
  errors.push(...planHistoryErrors(session, state).filter(error => !error.startsWith('PLAN_SCOPE_CHANGED:')));
  if (errors.length) return { settled, retired, errors };
  const successors = new Map();
  for (const [parentKey, parent] of Object.entries(state.attempts ?? {})) {
    if (parent.status !== 'waiting' || parentKey.split('/').length !== 2) continue;
    if (retiredPlanCell(state, parentKey)) { retired.add(parentKey); continue; }
    const successorKeys = Object.entries(state.resumes ?? {}).filter(([, value]) => value?.resumes === parentKey).map(([key]) => key);
    if (!successorKeys.length) continue;
    if (successorKeys.length !== 1) { errors.push(`state.json: waiting parent ${parentKey} has ${successorKeys.length} claimed replan successors; exactly one may resolve it`); continue; }
    const successorKey = successorKeys[0];
    const forecast = state.planHistory?.active ? readContext(session, state.planHistory.active, 'plans').forecast : null;
    if (!state.attempts?.[successorKey] && forecast?.reviewResumes?.[successorKey] && forecast.resumes?.[successorKey] === parentKey) {
      // A sealed replacement forecast is an outstanding obligation, not an executed successor.
      const [step, parallel] = successorKey.split('/').map(Number), [sourceStep, sourceParallel] = parentKey.split('/').map(Number);
      const planned = { sessionId: state.id, operatorId: parent.operatorId, step, parallel, resume: { step: sourceStep, parallel: sourceParallel }, attempt: { previous: parent.id, number: parent.number + 1 } };
      errors.push(...await resolvedWaitingReplanErrors(root, session, state, planned));
      if (requireSuccessorTerminal) errors.push(`state.json: resolved waiting parent ${parentKey} has no terminal accepted successor ${successorKey}`);
      continue;
    }
    const requestFile = path.join(branchDir(session, successorKey), 'request', 'request.json');
    const local = [];
    const request = await readJson(requestFile, local, `resolved waiting successor ${successorKey} request`);
    if (request) local.push(...await resolvedWaitingReplanErrors(root, session, state, request, { requireSuccessorRecorded: true }));
    if (local.length) errors.push(...local);
    else successors.set(parentKey, successorKey);
  }
  const visiting = new Set();
  const resolved = (parentKey) => {
    if (settled.has(parentKey)) return true;
    if (visiting.has(parentKey)) { errors.push(`state.json: resolved waiting chain cycles through ${parentKey}`); return false; }
    visiting.add(parentKey);
    const successorKey = successors.get(parentKey);
    const successor = state.attempts?.[successorKey];
    const closes = Boolean(successor) && (TERMINAL.has(successor.status) || (successor.status === 'waiting' && successors.has(successorKey) && resolved(successorKey)));
    visiting.delete(parentKey);
    if (closes) settled.add(parentKey);
    return closes;
  };
  for (const parentKey of successors.keys()) resolved(parentKey);
  if (requireSuccessorTerminal) {
    for (const [parentKey, successorKey] of successors) if (!settled.has(parentKey)) errors.push(`state.json: resolved waiting parent ${parentKey} has no terminal accepted successor chain through ${successorKey}`);
  }
  return { settled, retired, errors };
}
