// One accepted waiting parent may be superseded without resuming only when its exact nested exchange
// returned a sealed mismatch and a later same-operator attempt explicitly binds that outcome. This
// module is the single law used at successor admission, whole-session validation and close-success.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
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

export async function resolvedWaitingReplanErrors(root, session, state, successorRequest, { requireSuccessorRecorded = false, requireSuccessorTerminal = false } = {}) {
  const errors = [];
  const successorKey = `${successorRequest?.step}/${successorRequest?.parallel}`;
  const resume = successorRequest?.resume;
  const parentKey = resume ? `${resume.step}/${resume.parallel}` : null;
  const parent = parentKey ? state.attempts?.[parentKey] : null;
  if (!resume || parent?.status !== 'waiting') return [`request.json: ${successorKey} does not name an accepted waiting parent`];
  if (!state.id || successorRequest.sessionId !== state.id) errors.push(`request.json: successor ${successorKey} is not bound to session ${state.id ?? 'missing'}`);
  if (successorRequest.exchange) errors.push(`request.json: resolved waiting parent ${parentKey} re-enters through a top-level attempt, not another exchange`);
  if (Number(resume.step) >= Number(successorRequest.step)) errors.push(`request.json: resolved waiting parent ${parentKey} must precede successor ${successorKey}`);
  if (successorRequest.operatorId !== parent.operatorId || state.steps?.[successorKey] !== parent.operatorId) errors.push(`request.json: resolved waiting parent ${parentKey} and successor ${successorKey} must run the same recorded operator`);
  if (successorRequest.attempt?.previous !== parent.id || successorRequest.attempt?.number !== parent.number + 1) errors.push(`request.json: successor ${successorKey} does not directly follow waiting attempt ${parent.id}`);
  const resumeRecord = state.resumes?.[successorKey];
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
  if (parentResponse?.contractVersion !== V22_CONTRACT
    || parentResponse?.status !== 'waiting'
    || parentResponse?.operatorId !== parent.operatorId
    || parentResponse?.attempt?.id !== parent.id
    || parentResponse?.attempt?.expectedVersion !== parent.expectedVersion
    || !exchange
    || !awaitedKind) errors.push(`state.json: waiting parent ${parentKey} has no intact accepted exchange checkpoint`);

  const childKey = exchange ? `${parentKey}/${exchange}` : null;
  const child = childKey ? state.attempts?.[childKey] : null;
  if (!child || !['mismatched', 'inconclusive'].includes(child.status)) errors.push(`state.json: waiting parent ${parentKey} has no accepted mismatched or inconclusive ${exchange ?? 'missing'} exchange`);
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
      || childResponse?.status !== 'mismatch'
      || childResponse?.attempt?.id !== child.id
      || childResponse?.attempt?.expectedVersion !== child.expectedVersion
      || canonical(childResponse?.comparison) !== canonical(child.comparison)
      || childResponse?.comparison?.verdict !== child.status
      || !CHILD_NEXT.has(childResponse?.comparison?.next)
      || !refs.length) errors.push(`state.json: awaited exchange ${childKey} is not the accepted terminal review for ${awaitedKind ?? 'missing'}`);
    for (const ref of refs) if (!child.evidenceManifest?.files?.some((item) => item.ref === ref)) errors.push(`state.json: awaited exchange ${childKey} accepted manifest does not contain ${awaitedKind} output ${ref}`);
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
