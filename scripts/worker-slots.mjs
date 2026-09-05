import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { sessionRootOf, V22_CONTRACT, validateRequest } from './validate-request.mjs';
import { mutateSession } from './session-lock.mjs';
import { effectiveExclusiveResources, resourcesOverlap } from './resource-locks.mjs';

export { effectiveExclusiveResources, normalizeResource, resourcesOverlap } from './resource-locks.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policy = JSON.parse(await readFile(path.join(root, 'resources', 'orchestrator.json'), 'utf8'));
export const MAX_ACTIVE_WORKERS = policy.maxConcurrentAgents;
const sha = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;

export async function acquireWorkerSlot(branch, workerId, { resume = false } = {}) {
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
    if (state.contractVersion !== V22_CONTRACT || request.contractVersion !== V22_CONTRACT) throw new Error(`worker-slots is mandatory for ${V22_CONTRACT} sessions; legacy evidence cannot acquire a live slot`);
    if (state.lifecycle?.phase !== 'active') throw new Error(`state.json: lifecycle.phase ${state.lifecycle?.phase ?? 'missing'} cannot acquire a worker slot`);
    const wantedStatus = resume ? 'waiting' : 'running';
    const attempt = state.attempts?.[key];
    if (attempt?.status !== wantedStatus || attempt.id !== request.attempt.id) throw new Error(`state.json: attempt ${key}/${request.attempt.id} must be ${wantedStatus} before its worker ${resume ? 'resumes' : 'acquires'} a slot`);
    if (state.requestHashes?.[key] !== sha(after)) throw new Error(`request.json: frozen request hash for ${key} changed after attempt-gate open`);
    if (attempt.expectedHash !== sha(Buffer.from(JSON.stringify(request.expected)))) throw new Error(`request.json: expected changed after attempt ${attempt.id} opened`);
    if (JSON.stringify(attempt.frozenInputs) !== JSON.stringify(request.frozenInputs)) throw new Error(`request.json: frozenInputs changed after attempt ${attempt.id} opened`);
    state.workerSlots ??= [];
    state.leases ??= {};
    const owned = state.workerSlots.find((lease) => lease.attemptId === request.attempt.id);
    if (owned) return owned.workerId === workerId
      ? { status: 'acquired', slot: owned.slot, token: owned.token, branch: key, idempotent: true }
      : { status: 'queued', reason: 'attempt-owned', conflictsWith: owned.workerId };
    const conflict = state.workerSlots.find((lease) => lease.exclusive.some((held) => exclusive.some((wanted) => resourcesOverlap(held, wanted))));
    if (conflict) return { status: 'queued', reason: 'resource-conflict', conflictsWith: conflict.branch, resources: conflict.exclusive.filter((held) => exclusive.some((wanted) => resourcesOverlap(held, wanted))) };
    const occupied = new Set(state.workerSlots.map((lease) => lease.slot));
    let slot = 1;
    while (occupied.has(slot) && slot <= MAX_ACTIVE_WORKERS) slot += 1;
    if (slot > MAX_ACTIVE_WORKERS) return { status: 'queued', reason: 'session-cap', active: state.workerSlots.length, max: MAX_ACTIVE_WORKERS };
    const token = randomUUID();
    const lease = { slot, token, attemptId: request.attempt.id, workerId, branch: key, exclusive, environment: request.environment, acquiredAt: new Date().toISOString() };
    state.workerSlots.push(lease);
    state.leases[key] = { agent: workerId, holds: exclusive };
    if (resume) state.attempts[key].status = 'running';
    return { status: 'acquired', slot, token, branch: key };
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
      if (state.attempts?.[lease.branch]?.status === 'running') continue;
      state.workerSlots = state.workerSlots.filter((item) => item.token !== lease.token);
      delete state.leases?.[lease.branch];
      removed.push(lease.branch);
    }
    return { status: 'recovered', removed };
  });
}

async function main() {
  const [command, target, value] = process.argv.slice(2);
  let result;
  if (command === 'acquire' && target && value) result = await acquireWorkerSlot(target, value);
  else if (command === 'resume' && target && value) result = await acquireWorkerSlot(target, value, { resume: true });
  else if (command === 'release' && target && value) result = await releaseWorkerSlot(target, value);
  else if (command === 'recover' && target) result = await recoverWorkerSlots(target);
  else throw new Error('usage: node scripts/worker-slots.mjs acquire|resume <branch> <workerId> | release <session> <token> | recover <session>');
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.status === 'queued') process.exitCode = 3;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
