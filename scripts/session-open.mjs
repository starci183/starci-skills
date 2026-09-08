import { validateAgainst } from './json-schema.mjs';
import { retainMission } from './mission-history.mjs';
import { evidenceManifestErrors } from './evidence-manifest.mjs';
import { resolveWorkflowOwner, workflowOwnerErrors, sameRoot, RUNTIME_REVISION } from './workflow-root.mjs';
import { scopeErrors, authorityErrors, scopeHash, scopeBindingErrors, completeDeliveryMission, peerScopeErrors } from './mission-scope.mjs';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, realpath, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { V22_CONTRACT, goalDecisionId } from './validate-request.mjs';
import { mutateSession, withOwnedFileLock, replaceFile } from './session-lock.mjs';
import { selectWorkflowTopology, sessionWorkflowTopologyErrors, setWorkflowTopologyMode, setWorkflowTopologyPeers, workflowTopologyMode } from './workflow-topology.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const orchestrator = JSON.parse(await readFile(path.join(root, 'resources', 'orchestrator.json'), 'utf8'));
const topologyPolicy = orchestrator.workflowTopologies;
const stateSchema = JSON.parse(await readFile(path.join(root, 'templates', 'step', 'state.schema.json'), 'utf8'));
const hostKinds = new Set(stateSchema.properties.hostBinding.properties.kind.enum);
const now = () => new Date().toISOString();
const slug = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'mission';

async function writeJsonAtomic(file, value) {
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await replaceFile(temp, file);
}
export async function readWorkflowLocator(file) {
  let bytes;
  try { bytes = await readFile(file, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  return JSON.parse(bytes);
}

function normalizeMission(sessionId, mission, version = 1) {
  mission = completeDeliveryMission(mission, root);
  const decisionId = goalDecisionId(sessionId, version);
  const normalized = {
    version,
    language: mission.language,
    goal: mission.goal,
    target: mission.target,
    includes: mission.includes,
    excludes: mission.excludes ?? [],
    outputs: mission.outputs,
    doneWhen: mission.doneWhen,
    verification: mission.verification,
    example: mission.example ?? null,
    sourceRef: mission.sourceRef,
    ...(mission.discovery ? { discovery: mission.discovery } : {}),
    ...(mission.bankRef ? { bankRef: mission.bankRef } : {}),
    confirmation: { status: 'draft', decisionId, sourceRef: null }
  };
  validateMissionShape(normalized);
  return normalized;
}

function validateMissionShape(mission) {
  const errors = validateAgainst({ type: 'object', properties: { mission: stateSchema.properties.mission }, required: ['mission'], $defs: stateSchema.$defs }, { mission });
  if (errors.length) throw Error(errors.join('\n'));
}

function draftErrors(input) {
  const errors = [];
  for (const key of ['project', 'hostBinding', 'mission']) if (!input?.[key]) errors.push(`draft.${key}: required`);
  for (const key of ['kind', 'hostId', 'worktree', 'sourcePromptRef']) if (!input?.hostBinding?.[key]) errors.push(`draft.hostBinding.${key}: required`);
  if (input?.hostBinding?.kind && !hostKinds.has(input.hostBinding.kind)) errors.push(`draft.hostBinding.kind: expected ${[...hostKinds].join(' or ')}`);
  for (const key of ['language', 'goal', 'target', 'includes', 'outputs', 'doneWhen', 'verification', 'sourceRef']) if (input?.mission?.[key] === undefined || input.mission[key] === null || input.mission[key] === '') errors.push(`draft.mission.${key}: required`);
  if (!Array.isArray(input?.mission?.includes) || !input.mission.includes.length) errors.push('draft.mission.includes: at least one in-scope item is required');
  if (!Array.isArray(input?.mission?.outputs) || !input.mission.outputs.length) errors.push('draft.mission.outputs: at least one deliverable is required');
  if (!Array.isArray(input?.mission?.doneWhen) || !input.mission.doneWhen.length) errors.push('draft.mission.doneWhen: at least one observable criterion is required');
  if (input?.hostBinding?.worktree && !path.isAbsolute(input.hostBinding.worktree)) errors.push('draft.hostBinding.worktree: absolute path required');
  try { selectWorkflowTopology(topologyPolicy, input?.topology); }
  catch (error) { errors.push(error.message); }
  return errors;
}

async function findReusable(sessionsRoot, binding) {
  if (!existsSync(sessionsRoot)) return null;
  for (const name of await readdir(sessionsRoot)) {
    const file = path.join(sessionsRoot, name, 'state.json');
    if (!existsSync(file)) continue;
    try {
      const state = JSON.parse(await readFile(file, 'utf8'));
      if (existsSync(path.join(path.dirname(file), 'relocation.json')) || state.contractVersion !== V22_CONTRACT || !['draft', 'active', 'blocked', 'failed'].includes(state.lifecycle?.phase)) continue;
      if (state.hostBinding?.kind === binding.kind && state.hostBinding?.hostId === binding.hostId && path.resolve(state.hostBinding.worktree) === path.resolve(binding.worktree)) return { session: path.dirname(file), state };
    } catch {}
  }
  return null;
}

export async function openSession(sessionsRoot, input, { sourceRoot = path.dirname(root) } = {}) {
  sessionsRoot = path.resolve(sessionsRoot);
  const errors = draftErrors(input);
  const workflowOwner = resolveWorkflowOwner(sourceRoot, input.project);
  if (!sameRoot(sessionsRoot, path.join(workflowOwner.ownerRoot, '.worktrees', 'sessions'))) errors.push('WORKFLOW_OWNER_INVALID: sessionsRoot must be the declared project owner .worktrees/sessions');
  if (input.mission?.discovery) errors.push(...scopeErrors(input.mission, { root }));
  if (input.sessionId && (!/^[a-z0-9][a-z0-9.-]{0,127}$/.test(input.sessionId) || input.sessionId.includes('..') || input.sessionId === 'central-runtime')) errors.push('draft.sessionId: must be one safe direct-child id and cannot be central-runtime');
  if (errors.length) throw new Error(errors.join('\n'));
  const requestedTopology = input.topology === undefined ? null : selectWorkflowTopology(topologyPolicy, input.topology);
  const defaultTopology = selectWorkflowTopology(topologyPolicy);
  const hostKey = createHash('sha256').update(`${input.hostBinding.kind}\0${input.hostBinding.hostId}\0${path.resolve(input.hostBinding.worktree)}`).digest('hex');
  const locatorRoot = path.join(sourceRoot, '.workspaces', 'local', 'workflows');
  return withOwnedFileLock(path.join(locatorRoot, `.host-${hostKey}.lock`), async () => {
    const sourceSessions = path.join(sourceRoot, '.worktrees', 'sessions');
    if (!sameRoot(sourceSessions, sessionsRoot) && await findReusable(sourceSessions, input.hostBinding)) throw Error('WORKFLOW_RESET_REQUIRED: archive the old Source ledger before opening the fresh project workflow');
    for (const name of await readdir(locatorRoot)) {
      if (name.startsWith('.') || !name.endsWith('.json')) continue;
      const locator = await readWorkflowLocator(path.join(locatorRoot, name));
      if (locator === null) continue;
      const otherRoot = path.join(locator.ownerRoot, '.worktrees', 'sessions');
      if (!sameRoot(otherRoot, sessionsRoot) && await findReusable(otherRoot, input.hostBinding)) throw Error('WORKFLOW_OWNER_CONFLICT: this host already has a ledger under another owner');
    }
    const reused = await findReusable(sessionsRoot, input.hostBinding);
    if (reused) {
      if (reused.state.runtimeRevision !== RUNTIME_REVISION) throw Error('WORKFLOW_RESET_REQUIRED: archive the old host ledger before opening a fresh current session');
      const authorityRoot = sameRoot(sourceRoot, path.dirname(root)) ? root : path.join(sourceRoot, '.claude');
      const ownerErrors = workflowOwnerErrors(authorityRoot, reused.session, reused.state, { dispatch: true });
      if (ownerErrors.length) throw Error(ownerErrors.join('\n'));
      const existingMode = workflowTopologyMode(topologyPolicy, reused.state);
      if (existingMode === undefined) throw Error('WORKFLOW_RESET_REQUIRED: missing current topology; archive the old ledger and open a fresh session');
      if (existingMode !== undefined) {
        const existingErrors = sessionWorkflowTopologyErrors(topologyPolicy, reused.state);
        if (existingErrors.length) throw new Error(existingErrors.join('\n'));
      }
      const topology = requestedTopology ?? { mode: existingMode };
      const changesTopology = existingMode !== undefined && topology.mode !== existingMode;
      if (changesTopology) {
        await mutateSession(reused.session, async (state) => {
          const currentMode = workflowTopologyMode(topologyPolicy, state);
          const cleanDraft = state.lifecycle?.phase === 'draft' && !(state.chain ?? []).length && !Object.keys(state.steps ?? {}).length && !Object.keys(state.attempts ?? {}).length;
          if (currentMode !== undefined && currentMode !== topology.mode && !cleanDraft) {
            throw new Error(`SESSION_TOPOLOGY_MISMATCH: active session uses ${currentMode}, requested ${topology.mode}; finish or close the current mission before changing topology`);
          }
          setWorkflowTopologyMode(topologyPolicy, state, topology.mode);
          if (cleanDraft && topologyPolicy.modes[topology.mode].maximumPeers === 0) setWorkflowTopologyPeers(topologyPolicy, state, {});
          if (!cleanDraft) {
            const topologyErrors = sessionWorkflowTopologyErrors(topologyPolicy, state, { dispatch: true });
            if (topologyErrors.length) throw new Error(topologyErrors.join('\n'));
          }
        });
      }
      return { status: 'reused', session: reused.session, sessionId: reused.state.id, phase: reused.state.lifecycle.phase, topology: topology.mode };
    }
    const topology = requestedTopology ?? defaultTopology;
    const openedAt = now();
    const sessionId = input.sessionId ?? `${openedAt.replace(/[-:TZ.]/g, '').slice(0, 14)}-${slug(input.project)}-${hostKey.slice(0, 8)}`;
    const session = path.join(sessionsRoot, sessionId);
    const mission = normalizeMission(sessionId, input.mission);
    await mkdir(sessionsRoot, { recursive: true });
    await mkdir(session, { recursive: false });
    const state = {
    contractVersion: V22_CONTRACT,
    runtimeRevision: RUNTIME_REVISION,
    workflowOwner,
    id: sessionId,
    project: input.project,
    workflow: null,
    startedAt: openedAt,
    status: 'running',
    hostBinding: input.hostBinding,
    lifecycle: { phase: 'draft', openedAt },
    mission,
    choices: {},
    chain: [],
    steps: {},
    planned: {},
    attempts: {},
    workerSlots: [],
    leases: {},
    requestHashes: {},
    transitions: [],
    brief: { proven: [], blocked: [], next: 'Present the versioned scope table and record its explicit confirmation.', report: { shape: 'working', text: 'Goal draft opened; confirmation is pending.', at: openedAt } },
    budget: { maxSteps: orchestrator.budget.maxSteps, maxSameOperator: orchestrator.budget.maxSameOperator }
    };
    setWorkflowTopologyMode(topologyPolicy, state, topology.mode);
    setWorkflowTopologyPeers(topologyPolicy, state, {});
    await writeJsonAtomic(path.join(session, 'state.json'), state);
    await writeJsonAtomic(path.join(session, 'scope-draft.json'), { contractVersion: V22_CONTRACT, sessionId, mission });
    await writeJsonAtomic(path.join(locatorRoot, `${sessionId}.json`), { version: 1, project: input.project, sessionId, ownerRoot: workflowOwner.ownerRoot });
    return { status: 'opened', session, sessionId, phase: 'draft', decisionId: mission.confirmation.decisionId, topology: topology.mode };
  });
}

export async function missionCorrectionBusy(session, state, { waitingReentry = null } = {}) {
  if ((state.workerSlots ?? []).length || Object.keys(state.leases ?? {}).length) return true;
  if (Object.values(state.attempts ?? {}).some(attempt => attempt.status === 'running')) return true;
  let settled = new Set();
  let reentering = new Set();
  if (Object.values(state.attempts ?? {}).some(attempt => attempt.status === 'waiting')) {
    try {
      const { resolvedWaitingAttemptKeys } = await import('./resolved-waiting.mjs');
      const resolved = await resolvedWaitingAttemptKeys(root, session, state, { reentry: waitingReentry });
      if (resolved.errors.length) return true;
      settled = resolved.settled;
      reentering = resolved.reentering;
    } catch { return true; }
  }
  for (const [key, attempt] of Object.entries(state.attempts ?? {})) {
    if (attempt.status === 'running') return true;
    if (attempt.status !== 'waiting') continue;
    if (settled.has(key) || reentering.has(key)) continue;
    const { isSealedPriorMissionWait } = await import('./resolved-waiting.mjs');
    if (!await isSealedPriorMissionWait(session, state, key, attempt)) return true;
  }
  return false;
}

export async function confirmSession(session, decision) {
  session = path.resolve(session);
  if (decision.authority?.kind === 'coordination-extraction') throw Error('GOAL_AUTHORITY_REQUIRED: derived scope is admitted only by the producer self-enrolment command');
  if (!['as-stated', 'corrected', 'rejected'].includes(decision.selected)) throw new Error('decision.selected must be as-stated, corrected or rejected');
  if (decision.selectedBy !== 'user' || !decision.sourceRef) throw new Error('confirmation must bind the user message in selectedBy:user and sourceRef');
  const result = await mutateSession(session, async (state) => {
    if (state.contractVersion !== V22_CONTRACT) throw new Error(`state.json: confirm requires ${V22_CONTRACT}`);
    const current = state.mission;
    const decisionId = current.confirmation.decisionId;
    const correctedCandidate = decision.selected === 'corrected' && decision.mission
      ? normalizeMission(state.id, { ...decision.mission, sourceRef: decision.sourceRef }, current.version + 1) : null;
    if (decision.selected === 'as-stated') validateMissionShape(current);
    if (current.confirmation.status === 'confirmed' && decision.selected === 'as-stated') return { status: 'already-confirmed', sessionId: state.id, version: current.version };
    if (current.confirmation.status === 'confirmed' && decision.selected === 'corrected') {
      if (await missionCorrectionBusy(session, state)) throw Error('MISSION_BUSY: seal active attempts before correcting their mission');
      await retainMission(session, state, { root });
      state.lifecycle.phase = 'draft';
    }
    if (state.lifecycle.phase !== 'draft') throw new Error(`state.json: lifecycle ${state.lifecycle.phase} cannot confirm another draft`);
    if (current.confirmation.status !== 'confirmed') state.choices[decisionId] = { selected: decision.selected, selectedBy: 'user', sourceRef: decision.sourceRef };
    if (decision.selected === 'as-stated') {
      if (state.runtimeRevision !== RUNTIME_REVISION) throw Error('WORKFLOW_RESET_REQUIRED: old scope cannot be confirmed for current dispatch');
      const authorizationErrors = authorityErrors(current, decision.authority, root);
      authorizationErrors.push(...peerScopeErrors(state, { root }));
      authorizationErrors.push(...scopeBindingErrors(state, {}));
      if (decision.authority?.kind === 'bank-approval') {
        if (!current.bankRef) authorizationErrors.push('GOAL_AUTHORITY_REQUIRED: bank approval requires its unchanged bankRef');
        else { const { bankRefErrors } = await import('./validate-session.mjs'); authorizationErrors.push(...await bankRefErrors(state, { hostRoot: state.workflowOwner.ownerRoot })); }
      }
      if (decision.authority?.sourceRef !== decision.sourceRef) authorizationErrors.push('GOAL_AUTHORITY_REQUIRED: decision source must match the retained authority');
      if (authorizationErrors.length) throw Error(authorizationErrors.join('\n'));
      current.confirmation = { status: 'confirmed', decisionId, sourceRef: decision.sourceRef, confirmedAt: now(), scopeHash: scopeHash(current), authority: decision.authority };
      await retainMission(session, state, { root });
      state.lifecycle.phase = 'active';
      state.brief.next = 'Plan the chain dynamically from the confirmed done-when evidence, then open the first attempt.';
      return { status: 'confirmed', sessionId: state.id, version: current.version };
    }
    if (decision.selected === 'corrected') {
      if (!decision.mission) throw new Error('a corrected decision carries the corrected mission draft');
      const corrected = { ...decision.mission, sourceRef: decision.sourceRef };
      const currentMode = workflowTopologyMode(topologyPolicy, state);
      const topology = selectWorkflowTopology(topologyPolicy, decision.topology ?? (currentMode === undefined ? undefined : { mode: currentMode }));
      const validation = draftErrors({ project: state.project, hostBinding: state.hostBinding, mission: corrected, topology });
      if (validation.length) throw new Error(validation.join('\n'));
      state.mission = correctedCandidate;
      state.transitions ??= [];
      state.transitions.push({ branch: state.current ?? '1/1', event: 'replanned', at: new Date().toISOString(), goalVersion: state.mission.version, note: 'The user supplied a corrected scope; its new version is draft until confirmed.', logged: true });
      setWorkflowTopologyMode(topologyPolicy, state, topology.mode);
      if (topologyPolicy.modes[topology.mode].maximumPeers === 0) setWorkflowTopologyPeers(topologyPolicy, state, {});
      state.brief.next = `Present corrected scope version ${state.mission.version} for explicit confirmation.`;
      return { status: 'corrected', sessionId: state.id, version: state.mission.version, decisionId: state.mission.confirmation.decisionId, topology: topology.mode, mission: state.mission };
    }
    current.confirmation = { status: 'rejected', decisionId, sourceRef: decision.sourceRef };
    state.brief.next = 'The draft was rejected. Preserve it until the user supplies a replacement goal or closes the session.';
    return { status: 'rejected', sessionId: state.id, version: current.version };
  });
  if (result.mission) {
    await writeJsonAtomic(path.join(session, 'scope-draft.json'), { contractVersion: V22_CONTRACT, sessionId: result.sessionId, mission: result.mission });
    delete result.mission;
  }
  return result;
}

export async function discoverSession(session, mission) {
  return mutateSession(path.resolve(session), async state => {
    if (state.lifecycle?.phase !== 'draft') throw Error('GOAL_FROZEN: change a confirmed goal through a new authorized version');
    const errors = draftErrors({ project: state.project, hostBinding: state.hostBinding, mission });
    errors.push(...scopeErrors(mission, { root }));
    if (errors.length) throw Error(errors.join('\n'));
    state.mission = normalizeMission(state.id, mission, state.mission.version);
    return { status: 'discovered', scopeHash: scopeHash(state.mission), mission: state.mission };
  });
}

async function main() {
  const [command, target, inputFile] = process.argv.slice(2);
  if (command === 'preview' && target && !inputFile) {
    const { previewScope } = await import('./scope-presentation.mjs');
    process.stdout.write(`${previewScope(path.resolve(target))}\n`);
    return;
  }
  if (!target || !inputFile || !['open', 'confirm', 'discover'].includes(command)) throw new Error('usage: node scripts/session-open.mjs open <sessionsRoot> <draft.json> | confirm <session> <decision.json>');
  const input = JSON.parse(await readFile(path.resolve(inputFile), 'utf8'));
  const result = command === 'open' ? await openSession(target, input) : command === 'discover' ? await discoverSession(target, input) : await confirmSession(target, input);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
