// The digest judges whether the policy's next step happened for a failed or blocked leg. A supervisor-gate or owner-gate is that step and carries no job_id of its own:
// it names the jobs it holds in its raising event. Matching incidents by job_id alone read a failed leg with a standing gate as "no step" (verdict step-missing, NOT reasonable)
// while the Supervisor's overdue gate item said a gate existed (StarCi 2026-10-09, interface.draw blocked environment).
import test from 'node:test';
import assert from 'node:assert/strict';
import { digest, job, MIN, NOW, snapshot, status, workflow } from '../helpers/debug-digest-fixture.mjs';

const failedJob = job({ jobId: 'op-b-1', opId: 'b', status: 'failed', createdAt: NOW - 200 * MIN, updatedAt: NOW - 180 * MIN });
const leg = { op: 'b', jobId: 'op-b-1', status: 'failed', why: { headline: 'the host is not ready', owner: 'supervisor', next: 'gate', codes: ['blocker:environment'] } };
const gate = (over = {}) => ({ id: 'inc-1', kind: 'runtime-defect', owner: 'supervisor', dueAt: null, jobId: null, opId: 'b', status: 'open', detail: 'gate', holds: [], ...over });
const judged = (incidents) => digest(snapshot({ workflows: [workflow({ jobs: [job(), failedJob], incidents, status: status({ legs: [leg] }) })] })).workflows[0].judgements[0];

test('a gate that holds the failed job by its raising event is the step taken', () => {
  const held = judged([gate({ holds: ['op-b-1'] })]);
  assert.deepEqual([held.verdict, held.stepBy.kind, held.reasonable], ['reasonable', 'incident', true]);
});

test('a gate that holds another job, or none, is not the step of this leg', () => {
  assert.equal(judged([gate({ holds: ['op-c-1'] })]).verdict, 'step-missing');
  assert.equal(judged([gate()]).verdict, 'step-missing');
  assert.equal(judged([gate({ jobId: 'op-b-1' })]).verdict, 'reasonable', 'an incident with the job_id still counts');
});
