import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { extractFindings, recordFindings, readLedger, familyOf, findingId, keyOf, openLines } from './record-findings.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WIDE = 'wide-light-loaded';
const NARROW = 'narrow-light-loaded';
const MAIN = 'body>main';
const SECTION = 'body>main>section';
const TASTE = Array.from({ length: 12 }, (_, i) => `TASTE-${i + 1}`);
const NOW = '2026-09-05T10:00:00.000Z';
const LATER = '2026-09-06T10:00:00.000Z';

// A synthetic session: one interface.audit branch whose verdicts carry an application-owned failure
// on the narrow entry and a taste failure on the wide one; a second audit branch later where the
// narrow node passes. The request binds @knowledge/grammars/core, which is the family the ledger is
// keyed by.
const scope = () => ({ mode: 'primary-surfaces', surfaces: [{ id: 'plan-picker', type: 'page', route: '/plans', matrixIds: [WIDE, NARROW] }], deferredStates: [], coverageClaim: 'selected-surfaces' });
const tasteRows = (fail = []) => TASTE.map((rule) => (fail.includes(rule)
  ? { rule, measured: 'a tinted band whose only occupant is an ornament', score: 2, verdict: 'fail', routeTo: 'direction' }
  : { rule, measured: 'holds', score: 4, verdict: 'pass', routeTo: 'none' }));
const verdicts = ({ narrowFails = true, tasteFails = ['TASTE-2'] } = {}) => ({
  auditScope: scope(),
  entries: [
    { matrixId: WIDE, surfaceClass: 'console', taste: { entries: tasteRows(tasteFails), mean: 4, verdict: 'ship' }, results: [{ path: MAIN, owner: 'app', rule: 'GAP-5', measured: '1.5rem', verdict: 'pass', routeTo: 'none' }] },
    { matrixId: NARROW, surfaceClass: 'console', taste: { entries: tasteRows(), mean: 4, verdict: 'ship' }, results: [
      narrowFails ? { path: MAIN, owner: 'app', rule: 'GAP-5', measured: '1rem', verdict: 'fail', routeTo: 'resolve' } : { path: MAIN, owner: 'app', rule: 'GAP-5', measured: '1.5rem', verdict: 'pass', routeTo: 'none' },
      { path: SECTION, owner: 'grammar', rule: 'PADDING-4', measured: '1rem', verdict: 'pass', routeTo: 'none' },
    ] },
  ],
});
function writeAudit(session, branch, { status = 'done', contexts = [{ alias: '@knowledge/grammars/core', head: null }], verdicts: v = verdicts(), sessionId = 's-one', inputs = {} } = {}) {
  const [n, m] = branch.split('/');
  const dir = path.join(session, `step-${n}`, `parallel-${m}`);
  mkdirSync(path.join(dir, 'request'), { recursive: true });
  mkdirSync(path.join(dir, 'response', 'data'), { recursive: true });
  writeFileSync(path.join(dir, 'request', 'request.json'), JSON.stringify({ schemaVersion: 9, operatorId: 'interface.audit', step: Number(n), parallel: Number(m), sessionId, contexts, requirements: {}, inputs, resume: null }));
  writeFileSync(path.join(dir, 'response', 'response.json'), JSON.stringify({ schemaVersion: 9, operatorId: 'interface.audit', step: Number(n), parallel: Number(m), status, fallbacks: [], fields: {}, commits: [], next: [] }));
  if (v) writeFileSync(path.join(dir, 'response', 'data', 'verdicts.json'), JSON.stringify(v));
  return dir;
}
const fresh = () => { const dir = mkdtempSync(path.join(tmpdir(), 'findings-')); return { session: path.join(dir, 'session'), ledger: path.join(dir, 'ledger'), dir }; };
const lines = (file) => readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l));

test('an audit branch yields one finding per failing result and per failing taste criterion, with ids derived from what they are about', async () => {
  const { session, dir } = fresh();
  const branch = writeAudit(session, '4/1');
  try {
    const found = await extractFindings(branch, { root, now: NOW });
    assert.equal(found.family, 'core');
    assert.equal(found.operator, 'interface.audit');
    assert.deepEqual(found.surfaces, ['plan-picker']);
    assert.equal(found.lines.length, 2);
    const gap = found.lines.find((l) => l.rule === 'GAP-5');
    assert.equal(gap.unit, NARROW);
    assert.equal(gap.code, 'RESOLVE');
    assert.equal(gap.severity, 'blocking');
    assert.equal(gap.statement, `${MAIN}: 1rem`);
    assert.equal(gap.fixed, null);
    assert.equal(gap.session, 's-one');
    assert.equal(gap.branch, '4/1');
    assert.match(gap.id, /^f[0-9a-f]{12}$/);
    assert.equal(gap.id, findingId(gap), 'the id is a function of the finding');
    const taste = found.lines.find((l) => l.rule === 'TASTE-2');
    assert.equal(taste.code, 'DIRECTION');
    assert.equal(taste.unit, WIDE);
    // What passed is what a later run may close.
    assert.ok(found.passing.has(keyOf({ surface: 'plan-picker', unit: WIDE, rule: 'GAP-5', statement: `${MAIN}: 1.5rem` })));
    // Recorded twice, the same finding has the same id.
    const again = await extractFindings(branch, { root, now: LATER });
    assert.deepEqual(again.lines.map((l) => l.id), found.lines.map((l) => l.id));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a branch with no verdicts yields nothing; an operator that feeds no ledger is refused', async () => {
  const { session, dir } = fresh();
  try {
    const branch = writeAudit(session, '4/1', { verdicts: null });
    assert.equal(await extractFindings(branch, { root }), null);
    const other = writeAudit(session, '5/1');
    writeFileSync(path.join(other, 'response', 'response.json'), JSON.stringify({ operatorId: 'quality.verify', status: 'done' }));
    await assert.rejects(() => extractFindings(other, { root }), /feeds no ledger/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the family is the grammars context when the request binds one, else the hydrated route grammarId, else null', async () => {
  const { session, dir } = fresh();
  try {
    assert.equal(await familyOf(session, { contexts: [{ alias: '@knowledge/grammars/offset-pop', head: null }] }), 'offset-pop');
    mkdirSync(path.join(session, 'step-1', 'parallel-1', 'response', 'data'), { recursive: true });
    const hydrated = path.join(dir, 'routes', 'fe', 'config.json');
    mkdirSync(path.dirname(hydrated), { recursive: true });
    writeFileSync(hydrated, JSON.stringify({ context: { grammarId: 'core' } }));
    writeFileSync(path.join(session, 'step-1', 'parallel-1', 'response', 'data', 'route.json'), JSON.stringify({ role: 'fe', hydratedRouteRef: hydrated }));
    assert.equal(await familyOf(session, { contexts: [{ alias: '@workspaces/be', head: null }], inputs: { route: 'step-1/parallel-1/response/data/route.json' } }), 'core');
    writeFileSync(path.join(session, 'step-1', 'parallel-1', 'response', 'data', 'route.json'), JSON.stringify({ role: 'fe', hydratedRouteRef: 'routes/fe/config.json' }));
    assert.equal(await familyOf(session, { contexts: [], inputs: { route: 'step-1/parallel-1/response/data/route.json' } }, { hostRoot: dir }), 'core', 'a relative ref resolves against the host root');
    assert.equal(await familyOf(session, { contexts: [], inputs: {} }), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('recording appends the new lines once, materializes the open lines beside the receipt, and a later passing run closes them by a second line', async () => {
  const { session, ledger, dir } = fresh();
  try {
    const first = writeAudit(session, '4/1');
    const r1 = await recordFindings(first, { root, ledgerDir: ledger, now: NOW, validate: false });
    assert.equal(r1.appended, 2);
    assert.equal(r1.closed, 0);
    const file = path.join(ledger, 'core.jsonl');
    assert.ok(existsSync(file));
    assert.equal(lines(file).length, 2);
    // Materialized beside the receipt, in the findings kind, with every open line for the surface.
    const materialized = JSON.parse(readFileSync(path.join(first, 'response', 'data', 'findings.json'), 'utf8'));
    assert.equal(materialized.schemaVersion, 9);
    assert.equal(materialized.family, 'core');
    assert.deepEqual(materialized.surfaces, ['plan-picker']);
    assert.equal(materialized.lines.length, 2);
    // Idempotent by id.
    const r2 = await recordFindings(first, { root, ledgerDir: ledger, now: LATER, validate: false });
    assert.equal(r2.appended, 0);
    assert.equal(lines(file).length, 2);
    // A later audit of the same surface where the narrow gap passes closes that finding and not the taste one.
    const second = writeAudit(session, '6/1', { verdicts: verdicts({ narrowFails: false }) });
    const r3 = await recordFindings(second, { root, ledgerDir: ledger, now: LATER, validate: false });
    assert.equal(r3.closed, 1);
    assert.equal(r3.appended, 1, 'the taste failure of the second branch is a new finding of its own');
    const all = lines(file);
    assert.equal(all.length, 4);
    const gapId = all.find((l) => l.rule === 'GAP-5').id;
    const closure = all.filter((l) => l.id === gapId);
    assert.equal(closure.length, 2, 'the opening line stays; a second line closes');
    assert.equal(closure[0].fixed, null);
    assert.equal(closure[1].fixed, 's-one:6/1');
    const open = openLines(await readLedger(file));
    assert.ok(!open.some((l) => l.id === gapId));
    const after = JSON.parse(readFileSync(path.join(second, 'response', 'data', 'findings.json'), 'utf8'));
    assert.ok(!after.lines.some((l) => l.id === gapId), 'the materialized file carries only open lines');
    // Recording the closing branch again closes nothing twice.
    const r4 = await recordFindings(second, { root, ledgerDir: ledger, now: LATER, validate: false });
    assert.equal(r4.closed, 0);
    assert.equal(lines(file).length, 4);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a branch that is not done, or whose family is unresolved, records nothing', async () => {
  const { session, ledger, dir } = fresh();
  try {
    const blocked = writeAudit(session, '4/1', { status: 'blocked' });
    await assert.rejects(() => recordFindings(blocked, { root, ledgerDir: ledger, validate: false }), /not done/);
    const orphan = writeAudit(session, '5/1', { contexts: [] });
    await assert.rejects(() => recordFindings(orphan, { root, ledgerDir: ledger, validate: false }), /family is unresolved/);
    assert.ok(!existsSync(path.join(ledger, 'core.jsonl')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a walk yields rule-less findings for a failing lane, a failing assertion and a findings row, and rule findings for the experience lens', async () => {
  const { session, dir } = fresh();
  try {
    const branch = writeAudit(session, '7/1', { contexts: [{ alias: '@knowledge/grammars/core', head: null }], verdicts: null });
    writeFileSync(path.join(branch, 'response', 'response.json'), JSON.stringify({ operatorId: 'uat.verify', status: 'done' }));
    writeFileSync(path.join(branch, 'response', 'data', 'snapshot.json'), JSON.stringify({ feature: 'enrollment', flow: 'paid-enrollment', cases: [{ caseId: 'pay', order: 1 }] }));
    mkdirSync(path.join(branch, 'response', 'data', 'captures'), { recursive: true });
    writeFileSync(path.join(branch, 'response', 'data', 'captures', 'pay.json'), JSON.stringify({ caseId: 'pay', assertions: [{ assertionId: 'entry', observed: 'the entry state was reached', outcome: 'pass' }, { assertionId: 'terminal', observed: 'the order never appeared in the store', outcome: 'fail' }] }));
    const ux = Array.from({ length: 11 }, (_, i) => ({ rule: `UX-${i + 1}`, measured: 'holds', score: 4, verdict: 'pass', routeTo: 'none' }));
    ux[2] = { rule: 'UX-3', measured: 'the flow restarted to correct one field', score: 2, verdict: 'fail', routeTo: 'direction' };
    writeFileSync(path.join(branch, 'response', 'data', 'verdicts.json'), JSON.stringify({ runId: 'r', lanes: [
      { lane: 'behavior', verdict: 'fail', evidenceRefs: ['response/data/captures/pay.json'], statement: 'the order was not persisted' },
      { lane: 'ux', verdict: 'fail', evidenceRefs: ['response/data/captures/pay.json'], statement: 'judged on its own evidence' },
      { lane: 'ui', verdict: 'pass', evidenceRefs: ['response/artifacts/sheet.png'], statement: 'judged on its own evidence' },
    ], experience: { entries: ux } }));
    writeFileSync(path.join(branch, 'response', 'response.md'), '# uat-flow-verification — enrollment/paid-enrollment\n\n## Findings\n\n| Code | Statement |\n| --- | --- |\n| `CREDENTIAL_VALUE_IN_OUTPUT` | a diagnostic printed the store answer |\n');
    const found = await extractFindings(branch, { root, now: NOW });
    assert.equal(found.operator, 'uat.verify');
    assert.deepEqual(found.surfaces, ['enrollment/paid-enrollment']);
    const codes = found.lines.map((l) => `${l.rule ?? '-'}/${l.code}/${l.unit}`).sort();
    assert.deepEqual(codes, ['-/ASSERTION_FAIL/pay', '-/CREDENTIAL_VALUE_IN_OUTPUT/run', '-/LANE_BEHAVIOR/pay', '-/LANE_UX/pay', 'UX-3/DIRECTION/run']);
    assert.ok(found.lines.every((l) => l.severity === 'blocking'));
    assert.ok(found.passing.has(keyOf({ surface: 'enrollment/paid-enrollment', unit: 'pay', rule: null, statement: 'entry: x' })));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('with validation on, a receipt the operator validator refuses records nothing', async () => {
  const { session, ledger, dir } = fresh();
  try {
    // A synthetic branch that is not a lawful interface.audit branch: the validator refuses it, and
    // so does the ledger, through the operator's own validate.mjs.
    const branch = writeAudit(session, '4/1');
    await assert.rejects(() => recordFindings(branch, { root, ledgerDir: ledger }), /does not validate, so nothing is recorded/);
    assert.ok(!existsSync(path.join(ledger, 'core.jsonl')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
