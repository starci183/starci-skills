// Replay of the premortem walk of the authentication workflows (provision.ask, the end-of-flow credential checklist; work.author stands for any dispatched op): the contract orders the
// op to file as its question what `starci kernel autopilot --checklist --json` prints, and every `starci kernel` verb is refused to an op terminal (`op-context-refused`): the op
// could never build the question the contract demands. The checklist form is the one read an op may run; the other forms stay the runtime's.
// Real: the dispatch push, the verbs run in the op's own terminal identity. Stubbed: the Orca binary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seededWalk } from '../helpers/walk-seed.mjs';
import { startLeg } from '../helpers/walk-scenarios.mjs';

test('an op may print the credential checklist its contract orders it to file, and may not change autopilot', async (t) => {
  const walk = await seededWalk(t, 'work.author');
  const { jobId } = startLeg(walk, 'work.author');
  const { wf, repo } = walk.world;
  const checklist = walk.sh(['kernel', 'autopilot', '--repo', repo, '--workflow', wf, '--checklist'], { jobId });
  assert.equal(checklist.status, 0, checklist.stderr);
  assert.equal(typeof checklist.json.question.text, 'string');
  const set = walk.sh(['kernel', 'autopilot', '--repo', repo, '--workflow', wf, '--set', 'off'], { jobId });
  assert.notEqual(set.status, 0);
  assert.match(set.stderr, /op-context-refused/);
  const peers = walk.sh(['kernel', 'peers', '--repo', repo, '--workflow', wf], { jobId });
  assert.match(peers.stderr, /op-context-refused/, 'the other kernel verbs stay refused');
  for (const args of [['kernel', 'op-contract', '--repo', repo, '--job', jobId], ['kernel', 'survey', '--repo', repo, '--workflow', wf, '--deliveries'], ['kernel', 'artifacts', '--repo', repo, '--workflow', wf, '--job', jobId]]) {
    assert.equal(walk.sh(args, { jobId }).status, 0, `${args[1]} is a read the contracts teach an op`);
  }
});
