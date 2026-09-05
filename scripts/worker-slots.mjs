import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { sessionRootOf, V22_CONTRACT, validateRequest } from './validate-request.mjs';
import { mutateSession } from './session-lock.mjs';
import { effectiveExclusiveResources, normalizeResource, resourcesOverlap } from './resource-locks.mjs';
import { validateAgainst } from './json-schema.mjs';

export { effectiveExclusiveResources, normalizeResource, resourcesOverlap } from './resource-locks.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policy = JSON.parse(await readFile(path.join(root, 'resources', 'orchestrator.json'), 'utf8'));
export const MAX_ACTIVE_WORKERS = policy.maxConcurrentAgents;
const sha = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const profiles = {};
const profilesDir = path.join(root, 'resources', 'agents', 'profiles');
for (const file of (await readdir(profilesDir)).filter((name) => name.endsWith('.json')).sort()) Object.assign(profiles, JSON.parse(await readFile(path.join(profilesDir, file), 'utf8')).profiles);

function assertRunProfile(boundProfile, ranProfile) {
  if (!ranProfile) throw new Error('ranProfile is required before a v2.2 worker starts; the actual dispatch profile is recorded, never inferred afterward');
  if (!profiles[boundProfile] || profiles[boundProfile].retired === true) throw new Error(`bound profile ${boundProfile} is missing or retired`);
  if (!profiles[ranProfile] || profiles[ranProfile].retired === true) throw new Error(`ran profile ${ranProfile} is missing or retired`);
  if (ranProfile !== boundProfile && policy.profileEquivalents?.pairs?.[boundProfile] !== ranProfile) throw new Error(`ran profile ${ranProfile} is not ${boundProfile} or its configured active equivalent`);
}

function allocate(state, { identity, workerId, exclusive, environment, leaseFields = {} }) {
  state.workerSlots ??= [];
  state.leases ??= {};
  const owned = state.workerSlots.find((lease) => lease.attemptId === identity);
  if (owned) {
    if (owned.workerId !== workerId) return { status: 'queued', reason: 'attempt-owned', conflictsWith: owned.workerId };
    for (const field of ['branch', 'helperId', 'runId', 'requestHash', 'boundProfile', 'ranProfile']) if (leaseFields[field] !== undefined && owned[field] !== leaseFields[field]) throw new Error(`${identity} is already leased with a different ${field}`);
    return { status: 'acquired', slot: owned.slot, token: owned.token, branch: owned.branch, idempotent: true };
  }
  const conflict = state.workerSlots.find((lease) => lease.exclusive.some((held) => exclusive.some((wanted) => resourcesOverlap(held, wanted))));
  if (conflict) return { status: 'queued', reason: 'resource-conflict', conflictsWith: conflict.branch, resources: conflict.exclusive.filter((held) => exclusive.some((wanted) => resourcesOverlap(held, wanted))) };
  const occupied = new Set(state.workerSlots.map((lease) => lease.slot));
  let slot = 1;
  while (occupied.has(slot) && slot <= MAX_ACTIVE_WORKERS) slot += 1;
  if (slot > MAX_ACTIVE_WORKERS) return { status: 'queued', reason: 'session-cap', active: state.workerSlots.length, max: MAX_ACTIVE_WORKERS };
  const token = randomUUID();
  const lease = { slot, token, attemptId: identity, workerId, exclusive, environment, acquiredAt: new Date().toISOString(), ...leaseFields };
  state.workerSlots.push(lease);
  state.leases[lease.branch] = { agent: workerId, holds: exclusive };
  return { status: 'acquired', slot, token, branch: lease.branch };
}

async function stampOperatorProfile(branch, boundProfile, ranProfile) {
  const file = path.join(branch, 'response', 'response.json');
  const response = JSON.parse(await readFile(file, 'utf8'));
  if (response.boundProfile !== undefined && response.boundProfile !== boundProfile) throw new Error(`response.json boundProfile ${response.boundProfile} does not match ${boundProfile}`);
  if (response.ranProfile !== undefined && response.ranProfile !== ranProfile) throw new Error(`response.json ranProfile ${response.ranProfile} does not match dispatched ${ranProfile}`);
  response.boundProfile = boundProfile;
  response.ranProfile = ranProfile;
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(response, null, 2)}\n`, 'utf8');
  await rename(temp, file);
}

export async function acquireWorkerSlot(branch, workerId, { resume = false, ranProfile = null } = {}) {
  branch = path.resolve(branch);
  const session = sessionRootOf(branch);
  if (!session) throw new Error('SESSION_MISSING: branch is not inside a user session');
  const requestFile = path.join(branch, 'request', 'request.json');
  return mutateSession(session, async (state) => {
    const before = await readFile(requestFile);
    const checked = await validateRequest(root, branch);
    if (checked.errors.length) throw new Error(checked.errors.join('\n'));
    const after = await readFile(requestFile);
    if (sha(before) !== sha(after)) throw new Error('request.json changed while worker slot acquisition was validating it');
    const request = checked.request;
    const key = `${request.step}/${request.parallel}${request.exchange ? `/${request.exchange}` : ''}`;
    const exclusive = effectiveExclusiveResources(request);
    const boundProfile = checked.pkg.manifest.resources?.profile;
    assertRunProfile(boundProfile, ranProfile);
    if (state.contractVersion !== V22_CONTRACT || request.contractVersion !== V22_CONTRACT) throw new Error(`worker-slots is mandatory for ${V22_CONTRACT} sessions; legacy evidence cannot acquire a live slot`);
    if (state.lifecycle?.phase !== 'active') throw new Error(`state.json: lifecycle.phase ${state.lifecycle?.phase ?? 'missing'} cannot acquire a worker slot`);
    const wantedStatus = resume ? 'waiting' : 'running';
    const attempt = state.attempts?.[key];
    if (attempt?.status !== wantedStatus || attempt.id !== request.attempt.id) throw new Error(`state.json: attempt ${key}/${request.attempt.id} must be ${wantedStatus} before its worker ${resume ? 'resumes' : 'acquires'} a slot`);
    if (state.requestHashes?.[key] !== sha(after)) throw new Error(`request.json: frozen request hash for ${key} changed after attempt-gate open`);
    if (attempt.expectedHash !== sha(Buffer.from(JSON.stringify(request.expected)))) throw new Error(`request.json: expected changed after attempt ${attempt.id} opened`);
    if (JSON.stringify(attempt.frozenInputs) !== JSON.stringify(request.frozenInputs)) throw new Error(`request.json: frozenInputs changed after attempt ${attempt.id} opened`);
    const result = allocate(state, { identity: request.attempt.id, workerId, exclusive, environment: request.environment, leaseFields: { branch: key, boundProfile, ranProfile } });
    if (result.status === 'acquired' && !result.idempotent) {
      await stampOperatorProfile(branch, boundProfile, ranProfile);
      if (resume) state.attempts[key].status = 'running';
    }
    return result;
  });
}

function helperWriteErrors(state, request, requestFile) {
  const errors = [];
  if (state.contractVersion !== V22_CONTRACT || request.contractVersion !== V22_CONTRACT) errors.push(`helper request: ${V22_CONTRACT} session and request markers are required`);
  if (state.lifecycle?.phase !== 'active' || state.status !== 'running') errors.push('helper request: owning session must be active and running');
  const binding = request.hostBinding ?? {};
  if (binding.starciSessionId !== state.id || binding.kind !== state.hostBinding?.kind || binding.hostId !== state.hostBinding?.hostId || normalizeResource(binding.worktree) !== normalizeResource(state.hostBinding?.worktree)) errors.push('helper request: hostBinding does not match the existing owning user session');
  const runDir = path.join(path.resolve(binding.worktree ?? '.'), '.worktrees', 'helpers', request.helperId ?? '', 'runs', request.runId ?? '');
  if (normalizeResource(requestFile) !== normalizeResource(path.join(runDir, 'request.json'))) errors.push(`helper request: request.json must be ${path.join(runDir, 'request.json')}`);
  if (normalizeResource(request.environment?.outputRoot ?? '.') !== normalizeResource(runDir)) errors.push('helper request: environment.outputRoot is not this helper run directory');
  const supportRoot = normalizeResource(path.join(path.resolve(binding.worktree ?? '.'), '.worktrees'));
  const insideSupport = (value) => { const normalized = normalizeResource(value); return normalized.startsWith(`${supportRoot}/`); };
  const ownerCovers = (owner, value) => { const normalizedOwner = normalizeResource(owner); const normalizedValue = normalizeResource(value); return normalizedValue === normalizedOwner || normalizedValue.startsWith(`${normalizedOwner}/`); };
  for (const item of request.environment?.writes ?? []) {
    if (!path.isAbsolute(item.path)) errors.push(`helper request: write ${item.path} is not an absolute concrete resource`);
    else if (!insideSupport(item.path)) errors.push(`helper request: write ${item.path} escapes the host worktree's .worktrees support root`);
    if (!(request.environment?.exclusive ?? []).some((owner) => path.isAbsolute(owner) && ownerCovers(owner, item.path))) errors.push(`helper request: write ${item.path} has no covering exclusive resource owner`);
  }
  for (const owner of request.environment?.exclusive ?? []) if (!path.isAbsolute(owner) || !insideSupport(owner)) errors.push(`helper request: exclusive owner ${owner} must be a concrete path inside the host worktree's .worktrees support root`);
  return { errors, runDir };
}

export async function acquireHelperSlot(session, requestFile, workerId) {
  session = path.resolve(session);
  requestFile = path.resolve(requestFile);
  return mutateSession(session, async (state) => {
    const before = await readFile(requestFile);
    let request;
    try { request = JSON.parse(before); } catch (error) { throw new Error(`helper request: ${error.message}`); }
    const schema = JSON.parse(await readFile(path.join(root, 'templates', 'step', 'helper-request.schema.json'), 'utf8'));
    const errors = validateAgainst(schema, request, 'helper request.json');
    const helperFile = path.join(root, 'helpers', request.helperId ?? '', 'helper.json');
    let helper;
    if (!existsSync(helperFile)) errors.push(`helper request: unknown helper ${request.helperId ?? 'missing'}`);
    else helper = JSON.parse(await readFile(helperFile, 'utf8'));
    const checked = helperWriteErrors(state, request, requestFile);
    errors.push(...checked.errors);
    if (helper) {
      if (helper.id !== request.helperId) errors.push(`helper request: helper.json id ${helper.id} does not match ${request.helperId}`);
      if (helper.resources?.mode !== request.environment?.mode) errors.push(`helper request: environment.mode ${request.environment?.mode} does not match helper mode ${helper.resources?.mode}`);
      if (helper.resources?.profile !== request.profile?.boundProfile) errors.push(`helper request: boundProfile ${request.profile?.boundProfile} does not match helper profile ${helper.resources?.profile}`);
      for (const item of request.environment?.writes ?? []) if (!(helper.writes ?? []).some((base) => item.alias === base || item.alias.startsWith(`${base}/`))) errors.push(`helper request: write alias ${item.alias} is outside ${request.helperId}'s declared Writes`);
    }
    try { assertRunProfile(request.profile?.boundProfile, request.profile?.ranProfile); } catch (error) { errors.push(`helper request: ${error.message}`); }
    const after = await readFile(requestFile);
    if (sha(before) !== sha(after)) errors.push('helper request: request.json changed while the scheduler was validating it');
    if (errors.length) throw new Error(errors.join('\n'));
    const key = `helper/${request.helperId}/${request.runId}`;
    const exclusive = [...new Set(request.environment.exclusive.map(normalizeResource))].sort();
    return allocate(state, {
      identity: `helper:${request.helperId}:${request.runId}`,
      workerId,
      exclusive,
      environment: request.environment,
      leaseFields: { branch: key, workerKind: 'helper', helperId: request.helperId, runId: request.runId, requestHash: sha(after), boundProfile: request.profile.boundProfile, ranProfile: request.profile.ranProfile }
    });
  });
}

export async function releaseWorkerSlot(session, token) {
  session = path.resolve(session);
  return mutateSession(session, async (state) => {
    state.workerSlots ??= [];
    const lease = state.workerSlots.find((item) => item.token === token);
    if (!lease) return { status: 'already-released', token };
    state.workerSlots = state.workerSlots.filter((item) => item.token !== token);
    delete state.leases?.[lease.branch];
    return { status: 'released', slot: lease.slot, branch: lease.branch };
  });
}

export async function recoverWorkerSlots(session) {
  session = path.resolve(session);
  return mutateSession(session, async (state) => {
    state.workerSlots ??= [];
    const removed = [];
    for (const lease of [...state.workerSlots]) {
      if (lease.workerKind === 'helper' || state.attempts?.[lease.branch]?.status === 'running') continue;
      state.workerSlots = state.workerSlots.filter((item) => item.token !== lease.token);
      delete state.leases?.[lease.branch];
      removed.push(lease.branch);
    }
    return { status: 'recovered', removed };
  });
}

async function main() {
  const [command, target, value, extra] = process.argv.slice(2);
  let result;
  if (command === 'acquire' && target && value && extra) result = await acquireWorkerSlot(target, value, { ranProfile: extra });
  else if (command === 'resume' && target && value && extra) result = await acquireWorkerSlot(target, value, { resume: true, ranProfile: extra });
  else if (command === 'acquire-helper' && target && value && extra) result = await acquireHelperSlot(target, value, extra);
  else if (command === 'release' && target && value) result = await releaseWorkerSlot(target, value);
  else if (command === 'recover' && target) result = await recoverWorkerSlots(target);
  else throw new Error('usage: node scripts/worker-slots.mjs acquire|resume <branch> <workerId> <ranProfile> | acquire-helper <session> <helper-request.json> <workerId> | release <session> <token> | recover <session>');
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.status === 'queued') process.exitCode = 3;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
