// debug-digest-fixture.mjs — the snapshot builders the debug digest specs share: one healthy workflow, host and Supervisor, each field
// overridable.
import { incidentPolicy, boundValue } from '../../scripts/kernel/op-incident-policy.mjs';
import { analyze } from '../../scripts/reconciler/debug-digest-analyze.mjs';
import { digestNumbers } from '../../scripts/reconciler/debug-digest-numbers.mjs';

export const NOW = 1_800_000_000_000;
export const MIN = 60_000;
export const REV = 'a'.repeat(40);
export const policy = { ...incidentPolicy(), resolve: boundValue };
export const numbers = digestNumbers();
export const digest = (snap) => analyze(snap, policy, numbers);

export const job = (over = {}) => ({ jobId: 'op-x-1', kind: 'op', opId: 'x', status: 'running', tryNo: 1, retryOf: null, workerId: 'w', deadline: null,
  createdAt: NOW - 60 * MIN, updatedAt: NOW - 5 * MIN, ...over });
export const status = (over = {}) => ({ frontier: { state: 'engaged', openOperations: 1, readyOperations: 0, queued: [] }, legs: [], awaitingOwner: [],
  revisionNotice: { role: 'kernel', state: 'current', from: REV, to: REV, count: 0, files: [], line: 'kernel acked rev x' }, usage: { byOp: [{ opId: 'x', tokens: 1200, turns: 3, attempts: 1, costUsd: 0.5 }] }, ...over });
export const workflow = (over = {}) => ({ id: 'wf-1', name: 'Shop', ledger: 'shop', repo: 'work/shop', phase: 'running', jobs: [job(), job({ jobId: 'kernel-wf-1', kind: 'kernel', opId: null })],
  incidents: [], decisions: [], kernelJob: { status: 'running', updatedAt: NOW - MIN }, kernelSignal: { terminal: 'term_k' }, lastKernelWakeAt: NOW - 2 * MIN,
  status: status(), statusError: null, seatProbe: { action: 'idle-waiting' }, ...over });
export const snapshot = (over = {}) => ({ now: NOW, liveRev: REV,
  engine: { leader: { pid: 7, epoch: 3, heartbeatAt: NOW - 10_000, rev: REV }, modes: { job: 'active', host: 'active' }, configured: { job: 'active', host: 'active' }, safe: [], failingQueue: [] },
  supervisor: { seat: { state: 'live', terminalHandle: 'term_s', lastSeenAt: NOW - MIN, lastInputOkAt: NOW - MIN, deaf: false }, enabled: true, lastWakeAt: NOW - MIN, decisions: [], health: { live: true } },
  reservations: [], seats: ['supervisor'], supJobs: [], workflows: [workflow()], ...over });
export const keys = (d) => d.problems.map((p) => p.key);
