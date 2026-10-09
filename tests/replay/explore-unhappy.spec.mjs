import test from 'node:test';
import fs from 'node:fs';
import { seededWalk } from '../helpers/walk-seed.mjs';
import { fileShape, ownedNext, startLeg, STANDINS } from '../helpers/walk-scenarios.mjs';
const SCEN = process.env.WALK_SCEN;
const OP = process.env.WALK_OP ?? 'work.author';
test('unhappy ' + SCEN, { timeout: 900_000 }, async (t) => {
  const walk = await seededWalk(t, OP);
  const out = { scen: SCEN, op: OP };
  const { jobId, dispatched } = startLeg(walk, OP);
  out.dispatched = dispatched.json?.results?.[0];
  const orcaStateFile = walk.world.env.STARCI_FAKE_ORCA_STATE;
  if (SCEN === 'blocked') out.filed = fileShape(walk, jobId, { outcome: 'blocked', blocker: { kind: 'sds-gap', detail: 'the session store owner is not declared by any sds record' } }).json;
  else if (SCEN === 'ask') out.filed = fileShape(walk, jobId, { outcome: 'ask', question: { text: 'Which session lifetime does sign-in keep?', options: ['15 minutes', '12 hours'], recommended: 1, recommendedReason: 'the product is a daily tool' } }).json;
  else if (SCEN === 'red') {
    const work = await STANDINS[OP]({ walk, jobId });
    walk.sh(['runtime', 'validate', '.starciwork'], { jobId });
    const bad = `${walk.tree}/.starciwork/features/identity/impl/be/account/index.yaml`;
    fs.writeFileSync(bad, fs.readFileSync(bad, 'utf8').replace('state: todo', 'state: bogus'));
    out.filed = walk.file(jobId, work.report, work.attach).json;
  } else if (SCEN === 'dies') {
    walk.world.env.STARCI_FAKE_ORCA_MODE = 'dead-terminal';
  } else if (SCEN === 'restart') {
    const work = await STANDINS[OP]({ walk, jobId });
    out.filed = walk.file(jobId, work.report, work.attach).json;
    out.engineWorkflowOnly = walk.world.engine({ controllers: ['workflow'], passes: 1 });
  } else if (SCEN === 'critic') {
    const work = await STANDINS[OP]({ walk, jobId });
    out.filed = walk.file(jobId, work.report, work.attach).json;
  } else if (SCEN === 'revision') {
    const work = await STANDINS[OP]({ walk, jobId });
    walk.world.reviseRuntime({ 'docs/notes.md': 'a docs-only revision\n' }, 'docs-only revision');
    walk.world.reviseRuntime({ [`modules/ops/ops/${OP}.yaml`]: 'id: ' + OP + '\nrevised: true\n' }, 'revision of the op contract');
    out.filed = walk.file(jobId, work.report, work.attach).json;
  }
  out.engine = walk.engine({ op: OP, within: ['features/identity'], passes: SCEN === 'dies' ? 3 : 2, beauty: process.env.WALK_BEAUTY ? Number(process.env.WALK_BEAUTY) : undefined });
  out.next = ownedNext(walk, OP);
  const st = walk.status();
  out.menuFull = st.menu.map((m) => ({ id: m.id, question: m.question.slice(0, 400), options: m.options.map((o) => [o.choice, o.effect.slice(0, 160)]) }));
  out.kernelRev = st.kernelRev; out.revisionNotice = st.revisionNotice; out.workers = st.workers; out.failures = st.failures;
  out.job = walk.why(jobId);
  fs.writeFileSync(`D:/starci-tmp/triage/unhappy-${SCEN}-${OP}.json`, JSON.stringify(out, null, 1));
});
