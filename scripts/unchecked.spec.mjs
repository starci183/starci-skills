// The unchecked ledger: scripts/unchecked.mjs and the writer scripts/record-unchecked.mjs. A mission's
// verification covers the surfaces its done-when journey passes through; every unit it does not is
// tiered `secondary` by the plan and written down here, so a narrowed run is narrowed on record. The
// ledger is append-only and an entry is resolved by a second line, exactly as a finding is.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  VERIFY_LANES, appendUnchecked, uncheckedId, uncheckedOfPlan, isJourney, journeyUnits, laneOf, laneOfPlan,
  ledgerFile, loadUncheckedSchema, openUnchecked, planUncheckedErrors, readUnchecked, resolveUnchecked, secondaryUnits,
  tierErrors, tierOf, verifiesUnits,
} from './unchecked.mjs';
import { extractUnchecked, recordUnchecked, ledgerKeyOf, UNCHECKED_OPERATORS } from './record-unchecked.mjs';
import { loadOperatorPackages } from './operator-md.mjs';
import { budgetUnitsOf } from './validate-request.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRODUCT = 'sample-product';
const FEATURE = 'items';
const schema = await loadUncheckedSchema(root);
const unit = (id, extra = {}) => ({ id, kind: 'page', goal: `show ${id}`, inputs: [], dependsOn: [], ...extra });
const deferred = (id, reason = 'no done-when line reaches it') => unit(id, { tier: 'secondary', deferral: { reason } });
const units = (list) => ({ schemaVersion: 9, producedBy: 'interface.plan', units: list });
const line = (over = {}) => {
  const base = { product: PRODUCT, featureId: FEATURE, unit: 'item-archive', state: null, lane: 'audit', tier: 'secondary', reason: 'no done-when line reaches it', recordedBy: 's-1/1/1', recordedAt: '2026-09-05T00:00:00.000Z', resolvedBy: null, resolvedAt: null, ...over };
  return { ...base, id: uncheckedId(base) };
};
const tmp = () => mkdtempSync(path.join(tmpdir(), 'unchecked-'));

test('the lane map is the one home of which operator proves what, and a plan is checked in the lane of its own domain', async () => {
  const packages = await loadOperatorPackages(root);
  for (const id of Object.keys(VERIFY_LANES)) {
    assert.ok(packages.some((p) => p.manifest?.id === id), `${id} is an operator of this tree`);
    assert.ok(verifiesUnits(id) && laneOf(id));
  }
  assert.equal(laneOfPlan('interface.plan'), 'audit');
  assert.equal(laneOfPlan('uat.plan'), 'walk');
  assert.equal(laneOfPlan('data.plan'), null, 'a domain with no verifying operator leaves nothing unchecked');
  assert.ok([...UNCHECKED_OPERATORS].every((id) => packages.some((p) => p.manifest?.id === id)));
  // interface.generate is absent on purpose: generation builds what the plan lists.
  assert.equal(verifiesUnits('interface.generate'), false);
});

test('an absent tier reads as journey, so a plan written before the field stays fully verified', () => {
  assert.equal(tierOf(unit('a')), 'journey');
  assert.ok(isJourney(unit('a')));
  assert.equal(tierOf(deferred('b')), 'secondary');
  const doc = units([unit('a'), deferred('b'), unit('c')]);
  assert.deepEqual(journeyUnits(doc).map((u) => u.id), ['a', 'c']);
  assert.deepEqual(secondaryUnits(doc).map((u) => u.id), ['b']);
  // The fan-out budget is paid for by the units a lane is dispatched over, never by the deferred ones.
  assert.equal(budgetUnitsOf(doc), 2);
});

test('an entry id is derived from what it is about, so recording one receipt twice appends nothing', async () => {
  const hostRoot = tmp();
  try {
    const a = line();
    assert.equal(a.id, uncheckedId(a));
    assert.notEqual(a.id, line({ state: 'offline' }).id);
    assert.notEqual(a.id, line({ lane: 'walk' }).id);
    assert.deepEqual(await openUnchecked(hostRoot, PRODUCT, FEATURE), [], 'a feature nothing was ever left unchecked on is not a broken feature');
    assert.equal((await appendUnchecked(hostRoot, PRODUCT, FEATURE, [a])).appended, 1);
    assert.equal((await appendUnchecked(hostRoot, PRODUCT, FEATURE, [a])).appended, 0);
    assert.equal((await openUnchecked(hostRoot, PRODUCT, FEATURE)).length, 1);
    assert.ok(existsSync(ledgerFile(hostRoot, PRODUCT, FEATURE)));
  } finally { rmSync(hostRoot, { recursive: true, force: true }); }
});

test('no line is ever edited: an entry is resolved by a second line, and the newest line per id is its state', async () => {
  const hostRoot = tmp();
  try {
    const a = line();
    await appendUnchecked(hostRoot, PRODUCT, FEATURE, [a]);
    assert.equal((await resolveUnchecked(hostRoot, PRODUCT, FEATURE, [a.id], { resolvedBy: 's-2/3/1', resolvedAt: '2026-09-06T00:00:00.000Z' })).resolved, 1);
    const ledger = await readUnchecked(hostRoot, PRODUCT, FEATURE);
    assert.equal(ledger.lines.length, 2, 'the open line is still on disk');
    assert.equal(ledger.latest.get(a.id).resolvedBy, 's-2/3/1');
    assert.deepEqual(await openUnchecked(hostRoot, PRODUCT, FEATURE), []);
    assert.equal((await resolveUnchecked(hostRoot, PRODUCT, FEATURE, [a.id], { resolvedBy: 's-3/1/1', resolvedAt: 'x' })).resolved, 0, 'a resolved entry is not resolved twice');
    // Coverage taken and then dropped is unchecked again.
    assert.equal((await appendUnchecked(hostRoot, PRODUCT, FEATURE, [a])).appended, 1);
    assert.equal((await openUnchecked(hostRoot, PRODUCT, FEATURE)).length, 1);
  } finally { rmSync(hostRoot, { recursive: true, force: true }); }
});

test('a line that does not match the kind is refused rather than written', async () => {
  const hostRoot = tmp();
  try {
    await assert.rejects(() => appendUnchecked(hostRoot, PRODUCT, FEATURE, [{ ...line(), lane: 'guesswork' }]));
    await assert.rejects(() => appendUnchecked(hostRoot, PRODUCT, FEATURE, [{ ...line(), reason: '' }]));
    assert.ok(!existsSync(ledgerFile(hostRoot, PRODUCT, FEATURE)));
  } finally { rmSync(hostRoot, { recursive: true, force: true }); }
});

test('a plan leaves one entry per deferred unit, carrying that unit\'s own reason and nothing of its own', () => {
  const owed = uncheckedOfPlan({ product: PRODUCT, featureId: FEATURE, units: units([unit('item-list'), deferred('item-archive', 'the archive is outside this mission')]), lane: 'audit', recordedBy: 's-1/1/1', recordedAt: '2026-09-05T00:00:00.000Z' });
  assert.equal(owed.length, 1);
  assert.equal(owed[0].unit, 'item-archive');
  assert.equal(owed[0].state, null, 'a whole surface nobody looked at');
  assert.equal(owed[0].tier, 'secondary');
  assert.equal(owed[0].reason, 'the archive is outside this mission');
  assert.deepEqual(schemaErrors(owed[0]), []);
});
const schemaErrors = (l) => {
  const errors = [];
  for (const key of schema.required) if (l[key] === undefined) errors.push(key);
  return errors;
};

test('an open entry is covered by planning the unit into the journey, extended by planning it secondary, never dropped', () => {
  const open = [line({ unit: 'item-archive' })];
  assert.deepEqual(planUncheckedErrors(open, units([unit('item-list'), unit('item-archive')]), 'audit'), [], 'covered');
  assert.deepEqual(planUncheckedErrors(open, units([unit('item-list'), deferred('item-archive')]), 'audit'), [], 'extended');
  assert.deepEqual(planUncheckedErrors(open, units([unit('item-list')]), 'walk'), [], 'another lane is untouched here');
  const dropped = planUncheckedErrors(open, units([unit('item-list')]), 'audit');
  assert.equal(dropped.length, 1);
  assert.ok(dropped[0].includes('carries an open audit entry on unit item-archive') && dropped[0].includes('never dropped'));
});

test('the tiering a person reads and the tiering the fan-out runs on are one statement', () => {
  const doc = units([unit('item-list'), deferred('item-archive', 'outside the journey')]);
  const at = { at: 'response/response.md', table: 'Map' };
  assert.deepEqual(tierErrors([['item-list', 'journey'], ['item-archive', 'secondary — outside the journey']], doc, at), []);
  assert.ok(tierErrors([['item-archive', 'journey']], doc, at)[0].includes('secondary — outside the journey'));
  assert.ok(tierErrors([['item-list', 'secondary — because']], doc, at)[0].includes('one statement'));
  assert.deepEqual(tierErrors([['unknown', 'journey']], doc, at), [], 'a row with no unit is the other validator\'s error');
});

// One branch on disk, as record-unchecked.mjs reads it: a done plan that deferred a unit, then the
// audit of the unit it kept, which closes what it covered and records what it left.
function branch({ operatorId, requirements = { feature: FEATURE }, unitId, data = {} }) {
  const session = mkdtempSync(path.join(tmpdir(), 'unchecked-session-'));
  const dir = path.join(session, 'step-1', 'parallel-1');
  mkdirSync(path.join(dir, 'request'), { recursive: true });
  mkdirSync(path.join(dir, 'response', 'data'), { recursive: true });
  writeFileSync(path.join(session, 'state.json'), JSON.stringify({ id: 's-1', project: PRODUCT, startedAt: 'x', status: 'running', chain: [['1/1']], steps: { '1/1': operatorId }, requestHashes: {} }));
  writeFileSync(path.join(dir, 'request', 'request.json'), JSON.stringify({ schemaVersion: 9, operatorId, step: 1, parallel: 1, sessionId: 's-1', contexts: [], requirements, inputs: {}, resume: null, ...(unitId ? { unit: unitId } : {}) }));
  writeFileSync(path.join(dir, 'response', 'response.json'), JSON.stringify({ schemaVersion: 9, operatorId, step: 1, parallel: 1, status: 'done', fallbacks: [], fields: {}, commits: [], next: [] }));
  for (const [name, doc] of Object.entries(data)) writeFileSync(path.join(dir, 'response', 'data', name), JSON.stringify(doc));
  return { session, dir };
}

test('a done plan writes its deferred units to the ledger, and a branch that deferred nothing writes nothing', async () => {
  const hostRoot = tmp();
  const { session, dir } = branch({ operatorId: 'interface.plan', data: { 'units.json': units([unit('item-list'), deferred('item-archive', 'outside this mission')]) } });
  try {
    const found = await extractUnchecked(dir, { root, hostRoot });
    assert.equal(found.lane, 'audit');
    assert.deepEqual(found.append.map((d) => d.unit), ['item-archive']);
    assert.deepEqual(found.resolve, []);
    await recordUnchecked(dir, { root, hostRoot, validate: false, now: '2026-09-05T00:00:00.000Z' });
    const open = await openUnchecked(hostRoot, PRODUCT, FEATURE);
    assert.equal(open.length, 1);
    assert.equal(open[0].reason, 'outside this mission');
    assert.equal(readFileSync(ledgerFile(hostRoot, PRODUCT, FEATURE), 'utf8').trim().split('\n').length, 1);
  } finally { rmSync(session, { recursive: true, force: true }); rmSync(hostRoot, { recursive: true, force: true }); }
});

test('a branch that deferred nothing addresses no ledger; one that did and cannot name a feature says so', async () => {
  const hostRoot = tmp();
  const clean = branch({ operatorId: 'interface.plan', requirements: {}, data: { 'units.json': units([unit('item-list')]) } });
  const owing = branch({ operatorId: 'interface.plan', requirements: {}, data: { 'units.json': units([unit('item-list'), deferred('item-archive')]) } });
  try {
    assert.deepEqual((await extractUnchecked(clean.dir, { root, hostRoot })).append, []);
    await assert.rejects(() => extractUnchecked(owing.dir, { root, hostRoot }), /deferred coverage and names no ledger/);
  } finally { for (const b of [clean, owing]) rmSync(b.session, { recursive: true, force: true }); rmSync(hostRoot, { recursive: true, force: true }); }
});

test('a verification closes the coverage it took in its lane and records the states it deferred, with the receipt\'s own reason', async () => {
  const hostRoot = tmp();
  const owed = line({ unit: 'item-list', state: null, lane: 'audit' });
  await appendUnchecked(hostRoot, PRODUCT, FEATURE, [owed]);
  const scope = { mode: 'primary-surfaces', surfaces: [], deferredStates: ['offline'], deferrals: [{ state: 'offline', reason: 'the offline condition is outside every done-when line' }], coverageClaim: 'selected-surfaces' };
  const { session, dir } = branch({ operatorId: 'interface.audit', unitId: 'item-list', data: { 'verdicts.json': { auditScope: scope } } });
  try {
    const found = await extractUnchecked(dir, { root, hostRoot });
    assert.equal(found.lane, 'audit');
    assert.deepEqual(found.resolve, [owed.id], 'the whole-surface entry this audit just covered');
    assert.equal(found.append.length, 1);
    assert.equal(found.append[0].state, 'offline');
    assert.equal(found.append[0].tier, 'journey', 'a state of a unit the journey passes through');
    assert.equal(found.append[0].reason, 'the offline condition is outside every done-when line');
    await recordUnchecked(dir, { root, hostRoot, validate: false, now: '2026-09-06T00:00:00.000Z' });
    const open = await openUnchecked(hostRoot, PRODUCT, FEATURE);
    assert.deepEqual(open.map((d) => `${d.unit}/${d.state}`), ['item-list/offline']);
  } finally { rmSync(session, { recursive: true, force: true }); rmSync(hostRoot, { recursive: true, force: true }); }
});

test('the ledger records accepted receipts only, and only from the operators that move it', async () => {
  const hostRoot = tmp();
  const other = branch({ operatorId: 'git.publish' });
  const running = branch({ operatorId: 'interface.plan', data: { 'units.json': units([unit('item-list')]) } });
  writeFileSync(path.join(running.dir, 'response', 'response.json'), JSON.stringify({ schemaVersion: 9, operatorId: 'interface.plan', step: 1, parallel: 1, status: 'running', fallbacks: [], fields: {}, commits: [], next: [] }));
  try {
    assert.equal(await extractUnchecked(other.dir, { root, hostRoot }), null);
    await assert.rejects(() => recordUnchecked(other.dir, { root, hostRoot, validate: false }), /leaves nothing unchecked/);
    await assert.rejects(() => recordUnchecked(running.dir, { root, hostRoot, validate: false }), /not done/);
    assert.deepEqual(await ledgerKeyOf(running.dir), { product: PRODUCT, featureId: FEATURE, sessionId: 's-1' });
  } finally { for (const b of [other, running]) rmSync(b.session, { recursive: true, force: true }); rmSync(hostRoot, { recursive: true, force: true }); }
});
