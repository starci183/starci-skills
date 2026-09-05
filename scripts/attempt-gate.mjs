import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateRequest, sessionRootOf, V22_CONTRACT } from './validate-request.mjs';
import { validateStep } from './validate-step.mjs';
import { mutateSession } from './session-lock.mjs';
import { buildEvidenceManifest } from './evidence-manifest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const branchKey = (branch) => {
  const exchange = /^parallel-\d+$/.test(path.basename(branch)) ? null : path.basename(branch);
  const parallelDir = exchange ? path.dirname(branch) : branch;
  const step = /^step-(\d+)$/.exec(path.basename(path.dirname(parallelDir)));
  const parallel = /^parallel-(\d+)$/.exec(path.basename(parallelDir));
  if (!step || !parallel) throw new Error('branch must be <session>/step-N/parallel-M');
  return `${step[1]}/${parallel[1]}${exchange ? `/${exchange}` : ''}`;
};
const statePath = (branch) => path.join(sessionRootOf(branch) ?? '', 'state.json');

export async function openAttempt(branch) {
  branch = path.resolve(branch);
  const session = sessionRootOf(branch);
  if (!session || !existsSync(statePath(branch))) throw new Error('SESSION_MISSING: open the owning user session before dispatch');
  const key = branchKey(branch);
  const requestFile = path.join(branch, 'request', 'request.json');
  let frozenRequest;
  const result = await mutateSession(session, async (state) => {
    const before = await readFile(requestFile);
    const inside = await validateRequest(root, branch);
    if (inside.errors.length) throw new Error(inside.errors.join('\n'));
    const after = await readFile(requestFile);
    if (sha(before) !== sha(after)) throw new Error('request/request.json changed while attempt-gate was freezing it');
    const request = inside.request;
    if (request.contractVersion !== V22_CONTRACT) throw new Error(`request.json: attempt-gate opens only ${V22_CONTRACT} attempts; legacy bundles are read-only compatibility`);
    frozenRequest = request;
    const expectedBytes = Buffer.from(JSON.stringify(request.expected));
    state.attempts ??= {};
    const existing = state.attempts[key];
    if (existing) {
      if (existing.id === request.attempt.id && existing.status === 'running') return { state: 'already-open', attempt: existing };
      throw new Error(`state.json: attempts[${key}] already preserves ${existing.id} as ${existing.status}; a retry uses a new branch`);
    }
    state.requestHashes ??= {};
    state.requestHashes[key] = sha(after);
    const refBase = `step-${request.step}/parallel-${request.parallel}${request.exchange ? `/${request.exchange}` : ''}`;
    const record = {
      id: request.attempt.id,
      operatorId: request.operatorId,
      number: request.attempt.number,
      kind: request.attempt.kind,
      previous: request.attempt.previous,
      expectedVersion: request.expected.version,
      expectedHash: sha(expectedBytes),
      expected: request.expected,
      frozenInputs: request.frozenInputs,
      status: 'running',
      requestRef: `${refBase}/request/request.json`,
      startedAt: new Date().toISOString()
    };
    state.attempts[key] = record;
    return { state: 'opened', attempt: record };
  });
  const request = frozenRequest;
  const responseDir = path.join(branch, 'response');
  await mkdir(responseDir, { recursive: true });
  const skeleton = path.join(responseDir, 'response.json');
  if (!existsSync(skeleton)) {
    await writeFile(skeleton, `${JSON.stringify({
      contractVersion: V22_CONTRACT,
      schemaVersion: request.schemaVersion,
      operatorId: request.operatorId,
      step: request.step,
      parallel: request.parallel,
      ...(request.exchange ? { exchange: request.exchange } : {}),
      status: 'running', fields: {}, fallbacks: [], commits: [], next: [],
      attempt: { id: request.attempt.id, number: request.attempt.number, expectedVersion: request.expected.version }
    }, null, 2)}\n`, 'utf8');
  }
  return result;
}

export async function acceptAttempt(branch) {
  branch = path.resolve(branch);
  const session = sessionRootOf(branch);
  if (!session || !existsSync(statePath(branch))) throw new Error('SESSION_MISSING: no owning user session');
  const request = JSON.parse(await readFile(path.join(branch, 'request', 'request.json'), 'utf8'));
  if (request.contractVersion !== V22_CONTRACT) throw new Error(`request.json: attempt-gate accepts only ${V22_CONTRACT} attempts`);
  const exchange = /^parallel-\d+$/.test(path.basename(branch)) ? null : path.basename(branch);
  const topBranch = exchange ? path.dirname(branch) : branch;
  const checked = await validateStep(root, topBranch, { operator: true, requestPhase: 'accept' });
  if (checked.errors.length) throw new Error(checked.errors.join('\n'));
  const responseFile = path.join(branch, 'response', 'response.json');
  const responseBytes = await readFile(responseFile);
  const response = exchange ? JSON.parse(responseBytes) : checked.response;
  const evidenceManifest = await buildEvidenceManifest(branch);
  const key = branchKey(branch);
  const result = await mutateSession(session, async (state) => {
    const record = state.attempts?.[key];
    if (!record || record.id !== request.attempt.id) throw new Error(`state.json: attempts[${key}] was not opened for ${request.attempt.id}`);
    if (record.status !== 'running' && record.status !== 'waiting') throw new Error(`state.json: attempt ${record.id} is already ${record.status}`);
    const requestCheck = await validateRequest(root, branch, undefined, { phase: 'accept' });
    if (requestCheck.errors.length) throw new Error(requestCheck.errors.join('\n'));
    if (sha(await readFile(responseFile)) !== sha(responseBytes)) throw new Error('response/response.json changed during acceptance; rerun the full step gate');
    const stableManifest = await buildEvidenceManifest(branch);
    if (stableManifest.fingerprint !== evidenceManifest.fingerprint || JSON.stringify(stableManifest.files) !== JSON.stringify(evidenceManifest.files)) throw new Error('request/response evidence changed during acceptance; rerun the full step gate');
    if (response.actual && Date.parse(response.actual.observedAt) < Date.parse(record.startedAt)) throw new Error(`response/response.json: actual.observedAt predates attempt ${record.id}; stale evidence cannot satisfy its expected`);
    const mapped = response.status === 'done' ? 'matched' : response.status === 'mismatch' ? response.comparison.verdict : response.status;
    record.status = mapped;
    const refBase = `step-${request.step}/parallel-${request.parallel}${request.exchange ? `/${request.exchange}` : ''}`;
    record.responseRef = `${refBase}/response/response.json`;
    record.endedAt = new Date().toISOString();
    if (response.comparison) record.comparison = response.comparison;
    record.evidenceManifest = evidenceManifest;
    state.workerSlots = (state.workerSlots ?? []).filter((lease) => lease.attemptId !== record.id);
    delete state.leases?.[key];
    return { state: mapped, next: response.comparison?.next ?? null, attempt: record };
  });
  return result;
}

async function main() {
  const [command, target] = process.argv.slice(2);
  if (!['open', 'accept'].includes(command) || !target) throw new Error('usage: node scripts/attempt-gate.mjs <open|accept> <session>/step-N/parallel-M');
  const result = command === 'open' ? await openAttempt(target) : await acceptAttempt(target);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (command === 'accept' && ['mismatched', 'inconclusive'].includes(result.state)) process.exitCode = 3;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
