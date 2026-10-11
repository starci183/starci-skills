// Replay of the premortem walk of the authentication workflows, the last leg (handover.review): the handover ask is judged against the proof coverage of the workflow, and the coverage was read
// from the main checkout, where the records of a running workflow are not (a checkpoint lands on main when the workflow finishes): every handover ask was refused `handover-proof-unjudged`
// (ENOENT on a record the workflow tree holds) and the last leg could never reach the owner. The sequence: the world with every leg before it settled, the leg dispatched, the op reads the
// autopilot bundle through the survey verb its contract names and files the ask with the three options.
// Real: status, decide, enqueue, dispatch, survey, report and the coverage the report judges. Stubbed: the Orca binary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seededWalk } from '../helpers/walk-seed.mjs';
import { startLeg } from '../helpers/walk-scenarios.mjs';

test('the handover ask is judged on the records of the workflow tree, and a well-formed ask reaches the owner', async (t) => {
  const walk = await seededWalk(t, 'handover.review');
  const { jobId } = startLeg(walk, 'handover.review');
  const survey = walk.sh(['kernel', 'survey', '--repo', walk.world.repo, '--workflow', walk.world.wf, '--deliveries'], { jobId });
  assert.equal(survey.status, 0, 'the op reads the autopilot bundle its contract names');
  const question = { text: 'Two lines of summary.\nThe package: sign-in was built.', options: ['Approve - workflow complete', 'Feedback / report a bug - describe it in the note', 'Ask a question - write it in the note'], refs: [], assets: [], autopilot: survey.json.autopilot };
  const filed = walk.file(jobId, { schema: 'starci/op-report@1', outcome: 'ask', summary: 'handover', files: [], checks: [], question });
  assert.equal(filed.status, 0, `${filed.json?.code}: ${filed.json?.error}`);
  const row = walk.world.ledger((ledger) => ledger.db.prepare('SELECT outcome FROM reports WHERE job_id=?').get(jobId));
  assert.equal(row.outcome, 'ask', 'the handover ask is filed');
  // The handover is the owner's act: the runtime hands the report to the Kernel's menu, and the option that serves the ask settles it blocked (an ask waits on the owner).
  const item = walk.status().menu.find((entry) => entry.id === `job-decision:${jobId}`);
  assert.ok(item, 'the handover ask is on the Kernel menu');
  const serve = item.options.find((option) => option.choice === 'settle-fail');
  assert.deepEqual(serve.steps.map((step) => [step.verb, step.args.verdict]), [['settle', 'blocked']], 'for an ask the option settles it blocked: the ask then waits on the owner');
  const answered = walk.world.cli('decide', ['--workflow', walk.world.wf, '--item', item.id, '--choice', 'settle-fail', '--reason', 'serve the handover ask to the owner']);
  assert.equal(answered.status, 0, answered.stderr || answered.stdout);
  assert.equal(walk.job(jobId).status, 'awaiting_owner', 'the handover waits for the owner review');
});
