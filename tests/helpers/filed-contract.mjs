// Files an attempt's dispatch contract the way `starci kernel dispatch` does: the selected op contract, the admitted
// packet and the READ snapshot, through the real admission seam (the proof checks of record-checks and settle read them).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { admitPacket, captureDispatchInputs, selectDispatchContract } from '../../scripts/kernel/dispatch-admission.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Writes the contract row of `jobId`'s newest attempt on `ledger`; `tree` is the checkout the worker runs in. */
export function fileDispatchContract(ledger, { jobId, repo, tree = repo, workflowWorktree = null, createdAt }) {
  const { db } = ledger;
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId), payload = JSON.parse(job.payload_json);
  const { attempt_id: attemptId } = db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1').get(jobId);
  const selected = selectDispatchContract(ROOT, job.op_id, payload);
  const placements = (payload.owned_paths ?? []).map((owned) => ({ base: tree, path: owned }));
  const packet = { context: { records: payload.records ?? [], owned_paths: placements.map((place) => ({ root: place.base, path: place.path })),
    selected_op: selected.selected, workflow_worktree: workflowWorktree } };
  admitPacket(ROOT, { packet, op: job.op_id, placements, db, workflowId: job.workflow_id });
  const { inputs, contextPack } = captureDispatchInputs({ skillRoot: ROOT, op: job.op_id, packet, briefDoc: selected.brief,
    params: selected.params, repo, stateDir: path.join(repo, '.starciwork'), workerCwd: tree });
  ledger.write.writeContract({ attemptId, markdown: fs.readFileSync(path.join(ROOT, 'modules', 'ops', 'ops', `${job.op_id}.yaml`), 'utf8'),
    context: { worktree: tree, packet, contract: packet.context.contract, inputs, mandatory: contextPack.mandatory }, ...(createdAt ? { createdAt } : {}) });
  return { attemptId, packet };
}
