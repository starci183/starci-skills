// admit.mjs - the admission a dispatched op leaves in the ledger, written through the runtime's own admission functions (admitPacket, captureDispatchInputs,
// writeContract) and the mechanical proof its op owes (`read-knowledge`: a real run of the knowledge READ gate over the replay tree, observed and recorded by
// the same functions the settler uses). Without them a replayed reported job stops at "no filed selected contract or READ snapshot" instead of reaching the gate under test.
import fs from 'node:fs';
import path from 'node:path';
import { admitPacket, captureDispatchInputs, selectDispatchContract } from '../../scripts/kernel/dispatch-admission.mjs';
import { observationContextOf, observeCheck, stageObservation } from '../../scripts/kernel/mechanism-observation.mjs';
import { classifyCheck, rerunCheck } from '../../scripts/kernel/settle/job-settle.mjs';
import { recordCheck } from '../../scripts/machine/evidence-store.mjs';
import { workflowWorktreeOf } from '../../scripts/machine/workflow-tree.mjs';
import { ROOT, ownedPathOf } from './replay-world.mjs';

/** Writes the admission and the selected contract of `job` (a fixture job) for its newest attempt. */
export function admitJob(world, ledger, job) {
  const { tree, repo, env, wf } = world;
  const attemptId = ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1').get(job.id).attempt_id;
  const owned = (job.owned ?? []).map(ownedPathOf);
  const payload = { opId: job.op, records: [], owned_paths: owned };
  const selection = selectDispatchContract(ROOT, job.op, payload);
  const packet = { context: { records: [], owned_paths: owned.map((file) => ({ root: tree.dir, path: file })), selected_op: selection.selected, workflow_worktree: workflowWorktreeOf({ env }, wf) } };
  admitPacket(ROOT, { packet, op: job.op, placements: owned.map((file) => ({ base: tree.dir, path: file })), db: ledger.db, workflowId: wf });
  const { inputs, contextPack } = captureDispatchInputs({ skillRoot: ROOT, op: job.op, packet, briefDoc: selection.brief, params: selection.params, repo,
    stateDir: path.join(repo, '.starciwork'), workerCwd: tree.dir });
  ledger.write.writeContract({ attemptId, markdown: fs.readFileSync(path.join(ROOT, 'modules/ops/ops', `${job.op}.yaml`), 'utf8'),
    context: { worktree: tree.dir, packet, contract: packet.context.contract, inputs, mandatory: contextPack.mandatory } });
  return attemptId;
}

/** Runs the read-knowledge proof of `job` over the replay tree and records it as the kernel's observation. Answers the file the report attaches. */
export function fileReadProof(world, ledger, job, attemptId) {
  const { tree, repo, env } = world;
  const row = ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(job.id);
  const context = observationContextOf(ledger.db, row, { repo, skillRoot: ROOT });
  const knowledge = context.readRefs.filter((ref) => ref.rootKind === 'source' && ref.path.startsWith('knowledge/')).map((ref) => ref.path);
  const args = ['node', path.join(ROOT, 'scripts/cli/gate-read.mjs'), '--root', tree.dir, '--knowledge', ...knowledge];
  const command = args.map((arg) => JSON.stringify(String(arg).replaceAll(path.sep, '/'))).join(' ');
  const check = classifyCheck({ command }, { skillRoot: ROOT, mechanical: true });
  const run = observeCheck(check, context, (cwd) => rerunCheck(check, { repo: cwd, env, timeoutMs: 180_000 }));
  if (run.processStatus !== 0) throw new Error(`the read-knowledge proof of the replay tree failed: ${run.stderr}`);
  const file = path.join(world.base, 'proofs', `${job.id}-read-knowledge.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(run.output, null, 2)}\n`);
  const previous = process.env.STARCI_ARTIFACT_ROOT;
  try {
    process.env.STARCI_ARTIFACT_ROOT = env.STARCI_ARTIFACT_ROOT;
    const { native, ...staged } = stageObservation(run, [tree.dir]);
    ledger.transaction(() => recordCheck(ledger.db, { attemptId, name: 'native-read-knowledge', phase: 'verify', runner: 'kernel', command, ...staged, summary: { native } }));
  } finally { if (previous === undefined) delete process.env.STARCI_ARTIFACT_ROOT; else process.env.STARCI_ARTIFACT_ROOT = previous; }
  return file;
}

/** The admission, the contract and the read-knowledge proof of a reported fixture job: the files its filed report attaches (the proof output). */
export function admitReported(world, ledger, job) {
  const attemptId = admitJob(world, ledger, job);
  return [fileReadProof(world, ledger, job, attemptId)];
}
