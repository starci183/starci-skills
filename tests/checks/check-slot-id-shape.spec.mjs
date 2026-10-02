import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { slotIdFindings, suffixFindings, prefixesOf, checkSlotIdShape, CODE } from '../../scripts/checks/check-slot-id-shape.mjs';

const doc = (slots, extra = {}) => ({
  naming: { prefixes: ['app', 'be', 'fe', 'repo'], sameConceptPairs: [['step', 'saga-step']], refusedPairs: [['use-case', 'handler']] },
  appKinds: { be: ['api', 'worker', 'cli'], fe: ['next'] },
  slots: slots.map((s) => (typeof s === 'string' ? { id: s } : s)),
  ...extra,
});
const ctx = (d, file = 'knowledge/hfs/slots.yaml') => ({ file, doc: d });
const messages = (findings) => findings.map((f) => [f.code, f.path, f.message]);

test('a well-shaped manifest reports nothing', () => {
  const findings = slotIdFindings(ctx(doc([
    'app.readme', 'repo.docs',
    'be.app.api', 'be.app.cli', 'be.app.worker', 'fe.app.next',
    'be.feature', 'be.feature.jobs', 'be.feature.jobs.queue',
    'be.tests.contract', 'be.tests.e2e', 'be.tests.fixtures', 'be.tests.fixtures.builders',
    'fe.package.api', 'fe.package.api.client', 'fe.package.i18n',
  ])));
  assert.deepEqual(findings, []);
  assert.ok(findings.every((f) => f.code !== 'RT_SLOT_ID_SHAPE'));
});

test('an id segment that is not lowercase kebab is refused', () => {
  const findings = slotIdFindings(ctx(doc(['be.feature', 'be.feature.Bad_name', 'be.feature.-x'])));
  assert.equal(findings.length, 2);
  assert.ok(findings.every((f) => f.code === 'RT_SLOT_ID_SHAPE'));
  assert.match(findings[0].message, /be\.feature\.Bad_name/);
});

test('an id with an undeclared prefix is refused', () => {
  const findings = slotIdFindings(ctx(doc(['be.feature', 'be.feature.jobs', 'acme.feature'])));
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /acme\.feature.*not a declared prefix/);
});

test('<side>.app.<kind> must name a kind of appKinds.<side>', () => {
  const d = doc(['be.app.api', 'fe.app.express']);
  const findings = slotIdFindings(ctx(d));
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /fe\.app\.express.*appKinds\.fe/);
});

test('a deep id must extend a declared id or a shared family', () => {
  const findings = slotIdFindings(ctx(doc(['be.feature', 'be.weird.deep.orphan', 'be.tests.a', 'be.tests.b'])));
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /be\.weird\.deep\.orphan.*extends no declared slot id/);
  // be.weird.deep.orphan has a proper prefix (be.weird.deep) that is undeclared and a lone family — refused;
  // be.tests.* is a two-member family — allowed.
});

test('an explicit parent must be a declared id the id extends', () => {
  const d = doc(['be.feature', { id: 'be.feature.jobs.queue', parent: 'be.feature.jobs' }, { id: 'be.other.leaf', parent: 'be.feature' }]);
  const findings = slotIdFindings(ctx(d));
  assert.equal(findings.length, 2);
  assert.match(findings[0].message, /parent "be\.feature\.jobs".*not a declared slot id/);
  assert.match(findings[1].message, /be\.other\.leaf must extend its parent be\.feature/);
});

test('the runtime manifest derives its prefix from profiles', () => {
  const runtime = ctx({ profiles: ['runtime'], slots: [{ id: 'runtime.checks' }, { id: 'runtime.ext.sonar' }] }, 'knowledge/hfs/runtime-slots.yaml');
  const findings = slotIdFindings(runtime);
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /runtime\.ext\.sonar.*extends no declared slot id/);
  assert.deepEqual(prefixesOf(runtime.doc), ['runtime']);
});

test('a word in both suffixes and bannedSuffixes is refused', () => {
  const d = doc(['be.feature'], { ruleParams: { be: { suffixes: ['service', 'fixture', 'step', 'saga-step'], bannedSuffixes: ['fixture', 'helper'] } } });
  const findings = suffixFindings(ctx(d));
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /"fixture" is both a suffix and a bannedSuffix/);
});

test('a refused pair live on both sides of suffixes is refused', () => {
  const d = doc(['be.feature'], { ruleParams: { be: { suffixes: ['use-case', 'handler', 'step', 'saga-step'], bannedSuffixes: [] } } });
  const findings = suffixFindings(ctx(d));
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /refused synonym pair use-case\/handler/);
});

test('the declared same-concept pair must be both live, and a suffix-less profile is skipped', () => {
  const live = doc(['be.feature'], { ruleParams: { common: { fileLines: {} }, be: { suffixes: ['step', 'saga-step'], bannedSuffixes: [] } } });
  assert.deepEqual(suffixFindings(ctx(live)), []);
  const stale = doc(['be.feature'], { ruleParams: { be: { suffixes: ['step'], bannedSuffixes: [] } } });
  const findings = suffixFindings(ctx(stale));
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /sameConceptPairs.*step\/saga-step is not both live/);
});

test('this runtime keeps every slot id inside the declared grammar', () => {
  assert.deepEqual(checkSlotIdShape(path.resolve(import.meta.dirname, '..', '..')), []);
});
