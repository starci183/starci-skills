import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { collectCandidates, promoteFindings, topicOf, slugOf } from './promote-findings.mjs';

const line = (over) => ({ id: `f${String(over.n ?? 0).padStart(12, '0')}`, at: '2026-09-05T10:00:00.000Z', session: 's-one', branch: '4/1', operator: 'uat.verify', family: 'core', surface: 'enrollment/paid-enrollment', unit: 'pay', rule: null, code: 'LANE_BEHAVIOR', statement: 'behavior: the order was not persisted', severity: 'blocking', fixed: null, ...over });
const jsonl = (lines) => lines.map((l) => { const { n, ...rest } = l; return JSON.stringify(rest); }).join('\n') + '\n';
function fresh(lines) {
  const dir = mkdtempSync(path.join(tmpdir(), 'promote-'));
  const ledger = path.join(dir, 'ledger');
  mkdirSync(ledger, { recursive: true });
  writeFileSync(path.join(ledger, 'core.jsonl'), jsonl(lines));
  return { dir, ledger, proposals: path.join(dir, 'proposals'), evidence: path.join(dir, 'evidence') };
}

test('a rule-less finding seen in two sessions is a candidate; one session, a covered rule, or a closed finding is not', async () => {
  const { dir, ledger } = fresh([
    line({ n: 1, session: 's-one' }),
    line({ n: 2, session: 's-two', branch: '3/1' }),
    line({ n: 3, session: 's-one', code: 'CREDENTIAL_VALUE_IN_OUTPUT', statement: 'CREDENTIAL_VALUE_IN_OUTPUT: a diagnostic printed the answer' }),
    line({ n: 4, session: 's-one', rule: 'UX-3', code: 'DIRECTION', statement: 'UX-3: the flow restarted' }),
    line({ n: 5, session: 's-one', code: 'ASSERTION_FAIL', statement: 'terminal: the order never appeared' }),
    line({ n: 5, session: 's-one', code: 'ASSERTION_FAIL', statement: 'terminal: the order never appeared', fixed: 's-two:6/1' }),
    line({ n: 6, session: 's-two', code: 'ASSERTION_FAIL', statement: 'terminal: the order never appeared' }),
  ]);
  try {
    const candidates = await collectCandidates(ledger);
    assert.deepEqual(candidates.map((c) => c.slug), ['core-lane-behavior']);
    assert.equal(candidates[0].sessions.size, 2);
    assert.equal(candidates[0].lines.length, 2);
    assert.equal(topicOf(line({ code: null, statement: 'node: The Order, was NOT persisted!' })), 'statement:the order was not persisted');
    assert.equal(slugOf('core', 'code:LANE_BEHAVIOR'), 'core-lane-behavior');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('promotion drafts one proposal and one evidence stub per candidate, never overwrites, never writes into knowledge/ui, and carries no rule heading', async () => {
  const { dir, ledger, proposals, evidence } = fresh([line({ n: 1, session: 's-one' }), line({ n: 2, session: 's-two', branch: '3/1' })]);
  const root = path.join(dir, 'tree');
  mkdirSync(path.join(root, 'knowledge', 'ui', 'proof'), { recursive: true });
  try {
    const first = await promoteFindings({ root, ledgerDir: ledger, proposalsDir: proposals, evidenceDir: evidence, date: '2026-09-05' });
    assert.equal(first.length, 1);
    assert.equal(first[0].reason, 'drafted');
    const proposal = path.join(proposals, 'core-lane-behavior.md');
    assert.ok(existsSync(proposal));
    const text = readFileSync(proposal, 'utf8');
    assert.match(text, /^# Proposal — core-lane-behavior/);
    assert.ok(text.includes('| Case | When | Observe |'), 'the proof topics\' rule shape');
    assert.ok(text.includes('| s-one | 4/1 |') && text.includes('| s-two | 3/1 |'), 'both occurrences');
    assert.ok(!/^## [A-Z][A-Z0-9-]*-\d+/m.test(text), 'no rule heading a citation gate could read as published');
    assert.ok(text.includes('tests/evidence/20260905-findings-core-lane-behavior.md'));
    assert.ok(existsSync(path.join(evidence, '20260905-findings-core-lane-behavior.md')));
    assert.deepEqual(readdirSync(path.join(root, 'knowledge', 'ui', 'proof')), [], 'nothing under knowledge/ui');
    writeFileSync(proposal, '# a person edited this\n');
    const second = await promoteFindings({ root, ledgerDir: ledger, proposalsDir: proposals, evidenceDir: evidence, date: '2026-09-06' });
    assert.equal(second[0].reason, 'exists');
    assert.equal(readFileSync(proposal, 'utf8'), '# a person edited this\n', 'a proposal a person touched is not overwritten');
    await assert.rejects(() => promoteFindings({ root, ledgerDir: ledger, proposalsDir: path.join(root, 'knowledge', 'ui', 'proof') }), /never written into knowledge\/ui/);
    const dry = await promoteFindings({ root, ledgerDir: ledger, proposalsDir: path.join(dir, 'other'), evidenceDir: evidence, dry: true });
    assert.equal(dry[0].written, false);
    assert.ok(!existsSync(path.join(dir, 'other')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('an empty or missing ledger promotes nothing', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'promote-'));
  try {
    assert.deepEqual(await promoteFindings({ root: dir, ledgerDir: path.join(dir, 'none'), proposalsDir: path.join(dir, 'p'), evidenceDir: path.join(dir, 'e') }), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
