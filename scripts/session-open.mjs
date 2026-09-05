import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { V22_CONTRACT, goalDecisionId } from './validate-request.mjs';
import { mutateSession, withOwnedFileLock } from './session-lock.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const orchestrator = JSON.parse(await readFile(path.join(root, 'resources', 'orchestrator.json'), 'utf8'));
const now = () => new Date().toISOString();
const slug = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'mission';

async function writeJsonAtomic(file, value) {
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temp, file);
}

function normalizeMission(sessionId, mission, version = 1) {
  const decisionId = goalDecisionId(sessionId, version);
  return {
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
    confirmation: { status: 'draft', decisionId, sourceRef: null }
  };
}

function draftErrors(input) {
  const errors = [];
  for (const key of ['project', 'hostBinding', 'mission']) if (!input?.[key]) errors.push(`draft.${key}: required`);
  for (const key of ['kind', 'hostId', 'worktree', 'sourcePromptRef']) if (!input?.hostBinding?.[key]) errors.push(`draft.hostBinding.${key}: required`);
  for (const key of ['language', 'goal', 'target', 'includes', 'outputs', 'doneWhen', 'verification', 'sourceRef']) if (input?.mission?.[key] === undefined || input.mission[key] === null || input.mission[key] === '') errors.push(`draft.mission.${key}: required`);
  if (!Array.isArray(input?.mission?.includes) || !input.mission.includes.length) errors.push('draft.mission.includes: at least one in-scope item is required');
  if (!Array.isArray(input?.mission?.outputs) || !input.mission.outputs.length) errors.push('draft.mission.outputs: at least one deliverable is required');
  if (!Array.isArray(input?.mission?.doneWhen) || !input.mission.doneWhen.length) errors.push('draft.mission.doneWhen: at least one observable criterion is required');
  if (input?.hostBinding?.worktree && !path.isAbsolute(input.hostBinding.worktree)) errors.push('draft.hostBinding.worktree: absolute path required');
  return errors;
}

async function findReusable(sessionsRoot, binding) {
  if (!existsSync(sessionsRoot)) return null;
  for (const name of await readdir(sessionsRoot)) {
    const file = path.join(sessionsRoot, name, 'state.json');
    if (!existsSync(file)) continue;
    try {
      const state = JSON.parse(await readFile(file, 'utf8'));
      if (state.contractVersion !== V22_CONTRACT || !['draft', 'active', 'blocked', 'failed'].includes(state.lifecycle?.phase)) continue;
      if (state.hostBinding?.hostId === binding.hostId && path.resolve(state.hostBinding.worktree) === path.resolve(binding.worktree)) return { session: path.dirname(file), state };
    } catch {}
  }
  return null;
}

export async function openSession(sessionsRoot, input) {
  sessionsRoot = path.resolve(sessionsRoot);
  const errors = draftErrors(input);
  if (input.sessionId && (!/^[a-z0-9][a-z0-9.-]{0,127}$/.test(input.sessionId) || input.sessionId.includes('..') || input.sessionId === 'central-runtime')) errors.push('draft.sessionId: must be one safe direct-child id and cannot be central-runtime');
  if (errors.length) throw new Error(errors.join('\n'));
  const hostKey = createHash('sha256').update(`${input.hostBinding.kind}\0${input.hostBinding.hostId}\0${path.resolve(input.hostBinding.worktree)}`).digest('hex');
  return withOwnedFileLock(path.join(sessionsRoot, `.host-${hostKey}.lock`), async () => {
    const reused = await findReusable(sessionsRoot, input.hostBinding);
    if (reused) return { status: 'reused', session: reused.session, sessionId: reused.state.id, phase: reused.state.lifecycle.phase };
    const openedAt = now();
    const sessionId = input.sessionId ?? `${openedAt.replace(/[-:TZ.]/g, '').slice(0, 14)}-${slug(input.project)}-${hostKey.slice(0, 8)}`;
    const session = path.join(sessionsRoot, sessionId);
    await mkdir(session, { recursive: false });
    const mission = normalizeMission(sessionId, input.mission);
    const state = {
    contractVersion: V22_CONTRACT,
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
    brief: { proven: [], blocked: [], next: 'Present the versioned scope table and record its explicit confirmation.', peers: {}, report: { shape: 'working', text: 'Goal draft opened; confirmation is pending.', at: openedAt } },
    budget: { maxSteps: orchestrator.budget.maxSteps, maxSameOperator: orchestrator.budget.maxSameOperator }
    };
    await writeJsonAtomic(path.join(session, 'state.json'), state);
    await writeJsonAtomic(path.join(session, 'scope-draft.json'), { contractVersion: V22_CONTRACT, sessionId, mission });
    return { status: 'opened', session, sessionId, phase: 'draft', decisionId: mission.confirmation.decisionId };
  });
}

export async function confirmSession(session, decision) {
  session = path.resolve(session);
  if (!['as-stated', 'corrected', 'rejected'].includes(decision.selected)) throw new Error('decision.selected must be as-stated, corrected or rejected');
  if (decision.selectedBy !== 'user' || !decision.sourceRef) throw new Error('confirmation must bind the user message in selectedBy:user and sourceRef');
  const result = await mutateSession(session, async (state) => {
    if (state.contractVersion !== V22_CONTRACT) throw new Error(`state.json: confirm requires ${V22_CONTRACT}`);
    const current = state.mission;
    const decisionId = current.confirmation.decisionId;
    if (current.confirmation.status === 'confirmed' && decision.selected === 'as-stated') return { status: 'already-confirmed', sessionId: state.id, version: current.version };
    if (state.lifecycle.phase !== 'draft') throw new Error(`state.json: lifecycle ${state.lifecycle.phase} cannot confirm another draft`);
    state.choices[decisionId] = { selected: decision.selected, selectedBy: 'user', sourceRef: decision.sourceRef };
    if (decision.selected === 'as-stated') {
      current.confirmation = { status: 'confirmed', decisionId, sourceRef: decision.sourceRef, confirmedAt: now() };
      state.lifecycle.phase = 'active';
      state.brief.next = 'Plan the chain dynamically from the confirmed done-when evidence, then open the first attempt.';
      return { status: 'confirmed', sessionId: state.id, version: current.version };
    }
    if (decision.selected === 'corrected') {
      if (!decision.mission) throw new Error('a corrected decision carries the corrected mission draft');
      const corrected = { ...decision.mission, sourceRef: decision.sourceRef };
      const validation = draftErrors({ project: state.project, hostBinding: state.hostBinding, mission: corrected });
      if (validation.length) throw new Error(validation.join('\n'));
      state.mission = normalizeMission(state.id, corrected, current.version + 1);
      state.brief.next = `Present corrected scope version ${state.mission.version} for explicit confirmation.`;
      return { status: 'corrected', sessionId: state.id, version: state.mission.version, decisionId: state.mission.confirmation.decisionId, mission: state.mission };
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

async function main() {
  const [command, target, inputFile] = process.argv.slice(2);
  if (!target || !inputFile || !['open', 'confirm'].includes(command)) throw new Error('usage: node scripts/session-open.mjs open <sessionsRoot> <draft.json> | confirm <session> <decision.json>');
  const input = JSON.parse(await readFile(path.resolve(inputFile), 'utf8'));
  const result = command === 'open' ? await openSession(target, input) : await confirmSession(target, input);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
