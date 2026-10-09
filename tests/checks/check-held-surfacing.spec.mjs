// RT_HELD_UNSURFACED (R241): a runtime fault the catalogue gives to the Supervisor or the owner names a mechanism that reaches them, and the mechanism is wired in the file it names.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkHeldSurfacing, entryFindings, heldEntries, heldSurfacingFindings, MECHANISMS } from '../../scripts/checks/check-held-surfacing.mjs';

/** A world whose files are the given texts: only the proofs' own reads, no tree. */
const worldOf = (files, { sla = {}, departures = [], cases = [] } = {}) => ({
  sla, departures: new Set(departures), cases: new Map(cases.map((entry) => [entry.id, entry])),
  has: (file) => file in files,
  refute: (entry, patterns, what) => (patterns.every((pattern) => pattern.test(files[entry.surfacedAt])) ? null : `${entry.surfacedAt} does not show that it ${what}`),
});
const held = (extra = {}) => ({ kind: 'runtime-fault', owner: 'supervisor', ...extra });
const messageOf = (entry, world) => entryFindings('SOME_CODE', entry, world).map((f) => f.message).join(' | ');

test('only a runtime fault given to the Supervisor or the owner is judged', () => {
  const catalog = { A: held(), B: held({ owner: 'owner' }), C: held({ owner: 'runtime-core' }), D: { kind: 'check-finding', owner: 'supervisor' }, E: { kind: 'blocker', owner: 'owner' } };
  assert.deepEqual(heldEntries(catalog).map(([code]) => code), ['A', 'B']);
});

test('an entry naming no mechanism is a finding: the stop it names would stand silent (violating)', () => {
  const [finding] = entryFindings('SOME_CODE', held(), worldOf({}));
  assert.equal(finding.code, 'RT_HELD_UNSURFACED');
  assert.match(finding.message, /has no surfacedBy/);
  assert.match(messageOf(held({ surfacedBy: 'email' }), worldOf({})), /has no surfacedBy/, 'a mechanism outside the vocabulary is none');
});

test('decision-item: the kind is a Decision Item kind and the file opens items naming it', () => {
  const files = { 'a.mjs': "await ctx.openDecision({ kind: 'runtime-defect' })", 'b.mjs': "const x = 'runtime-defect';" };
  const entry = { surfacedBy: 'decision-item', surfacedAs: 'runtime-defect', surfacedAt: 'a.mjs' };
  assert.equal(messageOf(held(entry), worldOf(files)), '', 'passing');
  assert.match(messageOf(held({ ...entry, surfacedAt: 'b.mjs' }), worldOf(files)), /does not show that it opens Decision Items naming that kind/, 'a file that only names the kind opens nothing (violating)');
  assert.match(messageOf(held({ ...entry, surfacedAs: 'made-up-kind' }), worldOf(files)), /not a Decision Item kind/);
  assert.match(messageOf(held({ ...entry, surfacedAt: 'gone.mjs' }), worldOf(files)), /is no file of the tree/);
});

test('sla-clock: the code is an SLA code with an owner and the file sets a clock under it', () => {
  const files = { 'c.mjs': "await clock(ctx, key, 'SEAT_VACANT', 1)", 'd.mjs': "const code = 'SEAT_VACANT';" };
  const sla = { SEAT_VACANT: { owner: 'host-controller' }, NO_OWNER: {} };
  const entry = { surfacedBy: 'sla-clock', surfacedAs: 'SEAT_VACANT', surfacedAt: 'c.mjs' };
  assert.equal(messageOf(held(entry), worldOf(files, { sla })), '');
  assert.match(messageOf(held({ ...entry, surfacedAt: 'd.mjs' }), worldOf(files, { sla })), /sets a clock under that code/);
  assert.match(messageOf(held({ ...entry, surfacedAs: 'NO_OWNER' }), worldOf(files, { sla })), /no code of modules\/reconciler\/sla.yaml with an owner/);
});

test('digest: the problem line is a departure of the operating standard and the file names it', () => {
  const files = { 'e.mjs': "problem('x', 1, 'k', 'leader-missing')" };
  const entry = { surfacedBy: 'digest', surfacedAs: 'leader-missing', surfacedAt: 'e.mjs' };
  assert.equal(messageOf(held(entry), worldOf(files, { departures: ['leader-missing'] })), '');
  assert.match(messageOf(held(entry), worldOf(files)), /no departure of modules\/reconciler\/operating-standard.yaml/);
});

test('caller: a verb the owning role ran, never a reconciler file (a loop is no owner)', () => {
  const files = { 'scripts/connectors/stop.mjs': "return { reason: 'SOME_CODE' }", 'scripts/reconciler/controllers/host.mjs': "return { reason: 'SOME_CODE' }" };
  assert.equal(messageOf(held({ surfacedBy: 'caller', surfacedAt: 'scripts/connectors/stop.mjs' }), worldOf(files)), '');
  assert.match(messageOf(held({ surfacedBy: 'caller', surfacedAt: 'scripts/reconciler/controllers/host.mjs' }), worldOf(files)), /a reconciler file is a loop/);
  assert.match(messageOf(held({ surfacedBy: 'caller', surfacedAt: 'scripts/connectors/stop.mjs' }), worldOf({ 'scripts/connectors/stop.mjs': 'nothing' })), /contains the code it answers/);
});

test('open: names an edge-case registry entry whose status is open, never a covered or missing one', () => {
  const cases = [{ id: 'carried', status: 'open' }, { id: 'done', status: 'covered' }];
  assert.equal(messageOf(held({ surfacedBy: 'open', openCase: 'carried' }), worldOf({}, { cases })), '');
  assert.match(messageOf(held({ surfacedBy: 'open', openCase: 'done' }), worldOf({}, { cases })), /no edge-case registry entry with status open/);
  assert.match(messageOf(held({ surfacedBy: 'open' }), worldOf({}, { cases })), /\(none\)/);
});

test('the whole catalogue of this runtime names a mechanism for every held fault (passing)', () => {
  assert.deepEqual(checkHeldSurfacing(), []);
  assert.ok(MECHANISMS.includes('open'));
});

test('a catalogue with one silent entry yields exactly one finding naming its code (violating)', () => {
  const findings = heldSurfacingFindings({ SILENT: held(), HEARD: held({ surfacedBy: 'open', openCase: 'carried' }) }, worldOf({}, { cases: [{ id: 'carried', status: 'open' }] }));
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /^SILENT:/);
});
