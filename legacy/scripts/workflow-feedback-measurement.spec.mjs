import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { interfaceBaseFiles, INTERFACE_PAGE, startInterfaceRuntime } from './workflow-interface-fixture.mjs';
import { transformWalksFor, judgeTransformExperience } from './workflow-verifier-fixture.mjs';
import { put } from './workflow-source-fixture.mjs';
import { runWalk } from './browser-walk.mjs';
import { hostRootOf } from './validate-request.mjs';

const root = path.resolve(import.meta.dirname, '..');
const timingOf = record => JSON.parse(decodeURIComponent(/data-fixture-feedback="([^"]+)"/.exec(record.captures.find(c => c.capture.name === 'correct-feedback').dom.html)[1]));
function changeTiming(records, edit) {
  const changed = structuredClone(records), feedback = changed[0].captures.find(c => c.capture.name === 'correct-feedback');
  const timing = timingOf(changed[0]); edit(timing, changed[0]);
  feedback.dom.html = feedback.dom.html.replace(/data-fixture-feedback="[^"]+"/, `data-fixture-feedback="${encodeURIComponent(JSON.stringify(timing))}"`);
  return changed;
}

test('actual browser event and visible rendering frames prove feedback without counting evidence capture overhead', async t => {
  const home = mkdtempSync(path.join(tmpdir(), 'starci-feedback-measurement-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const files = await interfaceBaseFiles();
  files[INTERFACE_PAGE] = files[INTERFACE_PAGE].replace('>Run</button>', '>Transform</button>');
  for (const [ref, value] of Object.entries(files)) put(path.join(home, ref), value);
  const runtime = await startInterfaceRuntime(t, { root, feWorktree: home });
  const [walk] = transformWalksFor({ runId: '20260906-000000-1111111', flow: 'feedback-fixture', route: runtime.endpoint, cases: [{ caseId: 'result', order: 1 }] });
  const walkFile = path.join(home, 'walk.json'), response = path.join(home, 'response'); put(walkFile, walk);
  const ran = await runWalk(walkFile, response, { root, hostRoot: process.env.STARCI_WALK_HOST_ROOT ?? hostRootOf(root) });
  assert.equal(ran.code, 0, ran.errors.join('; '));
  const read = ref => JSON.parse(readFileSync(path.join(home, ref), 'utf8'));
  const result = read(`response/data/walks/${walk.id}/walk-result.json`);
  const records = [{ walk, result, ledger: read(result.ledgerRef), captures: result.captures.map(capture => ({ capture, dom: read(capture.domRef), measurements: read(capture.measurementsRef), ax: readFileSync(path.join(home, capture.axRef), 'utf8') })) }];
  assert.equal(judgeTransformExperience(records).verdict, 'ship');
  const timing = timingOf(records[0]);
  t.diagnostic(JSON.stringify({ actualTiming: timing, activationToVisibleUpperBoundMs: timing.afterPaint.at - timing.activation.at }));
  const slowCapture = structuredClone(records); for(const owner of [slowCapture[0].result,slowCapture[0].ledger])owner.steps.find(step => step.id === 'correct-feedback').ms += 1000;
  assert.equal(judgeTransformExperience(slowCapture).verdict, 'ship', 'later screenshot/AX/DOM serialization does not change the measured UI latency');
  for (const [name, edit] of [
    ['stale document', value => { value.documentTimeOrigin -= 10000; }],
    ['prior submission', value => { value.sequence = 1; }],
    ['unrelated input', value => { value.input = 'wrong'; }],
    ['untrusted event', value => { value.activation.trusted = false; }],
    ['old event', value => { value.activation.at = 0; }],
    ['missing raw time', value => { delete value.handlerAt; }],
    ['no state change', value => { value.changedState.text = 'Ready to transform.'; }],
    ['hidden frame', value => { value.beforePaint.visible = false; }],
    ['unrelated rendered result', value => { value.afterPaint.text = 'WRONG'; }],
    ['same rendering frame', value => { value.afterPaint.frameTimestamp = value.beforePaint.frameTimestamp; }],
    ['over 100ms', (value, record) => { value.afterPaint.at = value.activation.at + 101; for(const owner of [record.result,record.ledger])owner.steps.find(step => step.id === 'correct-feedback').ms += 1000; }]
  ]) assert.throws(() => judgeTransformExperience(changeTiming(records, edit)), undefined, name);
});
