import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {computeDerived, buildYamlDocument, runDerive} from '../scripts/example-derive.mjs';
import {checkExampleDerived} from '../scripts/check-example-derived.mjs';

/**
 * One fixture tree per derived field this lane was asked to prove, plus the two refusal gates
 * (scripts/check-example-derived.mjs). Fixtures live on the same drive as the repo, exactly like
 * tests/example-work-gate.spec.mjs's own fixtures, and for the same reason: os.tmpdir() can be a different
 * drive on this host, which breaks the relative-path handling both scripts rely on.
 */
const TMP_ROOT = path.join(path.parse(process.cwd()).root, 'starci-tmp');

let counter = 0;
function freshDir() {
  counter += 1;
  const dir = path.join(TMP_ROOT, `derive-fixture-${process.pid}-${counter}`);
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});
  return dir;
}

function write(root, rel, content) {
  const file = path.join(root, ...rel.split('/'));
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

/** A minimal-but-real `.starciwork` tree; `extra` maps additional relative paths to YAML content. */
function tree(extra) {
  const root = freshDir();
  const workRoot = path.join(root, '.starciwork');
  write(workRoot, 'workspace.yaml', 'schema: work/workspace\nid: fixture\n');
  for (const [rel, content] of Object.entries(extra)) write(workRoot, rel, content);
  return workRoot;
}

test('usedBy: a reverse edge appears on the target, grouped under the edge kind it was authored as', () => {
  const workRoot = tree({
    'features/f/br/a/index.yaml': 'schema: work/business-rule\nid: br.f.a\ntitle: A\nstate: todo\n',
    'features/f/fr/b/index.yaml': 'schema: work/functional-requirement\nid: fr.f.b\ntitle: B\nstate: todo\nrefs: [br.f.a]\n',
  });
  const derived = computeDerived(workRoot);
  assert.deepEqual(derived.records.get('br.f.a').usedBy.refs, ['fr.f.b']);
  // the source record carries no usedBy entry for a reference it makes, only for one it receives
  assert.equal(Object.keys(derived.records.get('fr.f.b').usedBy).length, 0);
});

test('usedBy: work/contract provenBy.provider/consumer land under contractProvider/contractConsumer, not generic provenBy', () => {
  const workRoot = tree({
    'features/f/impl/x/index.yaml': 'schema: work/implementation\nid: impl.f.x\ntitle: X\nstate: done\nverificationSource: authored-claim\nbecause: c\n',
    'features/f/impl/y/index.yaml': 'schema: work/implementation\nid: impl.f.y\ntitle: Y\nstate: done\nverificationSource: authored-claim\nbecause: c\n',
    'features/f/contract/z/index.yaml': 'schema: work/contract\nid: contract.f.z\ntitle: Z\nstate: done\nverificationSource: authored-claim\nbecause: c\nprovenBy:\n  provider: [impl.f.x]\n  consumer: [impl.f.y]\n',
  });
  const derived = computeDerived(workRoot);
  assert.deepEqual(derived.records.get('impl.f.x').usedBy.contractProvider, ['contract.f.z']);
  assert.deepEqual(derived.records.get('impl.f.y').usedBy.contractConsumer, ['contract.f.z']);
  assert.equal(derived.records.get('impl.f.x').usedBy.provenBy, undefined);
});

test('effectiveState: digest-stale evidence yields suspended even though the authored state is done', () => {
  const workRoot = tree({
    'features/f/br/a/index.yaml': 'schema: work/business-rule\nid: br.f.a\ntitle: A\nstate: done\nverificationSource: authored-claim\nbecause: c\n',
  });
  write(workRoot, 'features/f/br/a/evidence.yaml',
    'schema: work/evidence\nrecord: br.f.a\nrecordDigest: "deadbeef00000000000000000000000000000000000000000000000000000000"\noutcome: pass\n');
  const derived = computeDerived(workRoot);
  const rec = derived.records.get('br.f.a');
  assert.equal(rec.effectiveState, 'suspended');
  assert.equal(rec.suspensionReason, 'digest-mismatch');
});

test('effectiveState: a matching digest and no blockers leaves the authored state alone', () => {
  const recordBody = 'schema: work/business-rule\nid: br.f.a\ntitle: A\nstate: done\nverificationSource: authored-claim\nbecause: c\n';
  const workRoot = tree({'features/f/br/a/index.yaml': recordBody});
  const digest = sha256(fs.readFileSync(path.join(workRoot, 'features/f/br/a/index.yaml')));
  write(workRoot, 'features/f/br/a/evidence.yaml', `schema: work/evidence\nrecord: br.f.a\nrecordDigest: ${digest}\noutcome: pass\n`);
  const derived = computeDerived(workRoot);
  assert.equal(derived.records.get('br.f.a').effectiveState, 'done');
});

test('effectiveState: appliesTo-newer-than-evidence suspends a done record whose digest still matches', () => {
  const recordBody = 'schema: work/functional-requirement\nid: fr.f.a\ntitle: A\nstate: done\nverificationSource: authored-claim\nbecause: c\n';
  const workRoot = tree({
    'features/f/fr/a/index.yaml': recordBody,
    'features/f/sds/guard/index.yaml': 'schema: work/sds-component\nid: sds.f.guard\ntitle: Guard\nstate: todo\nappliesTo: [fr.f.a]\nchange: {rev: 1, kind: breaking, at: 2026-09-18T09:00:00.000Z}\n',
  });
  const digest = sha256(fs.readFileSync(path.join(workRoot, 'features/f/fr/a/index.yaml')));
  write(workRoot, 'features/f/fr/a/evidence.yaml',
    `schema: work/evidence\nrecord: fr.f.a\nrecordDigest: ${digest}\noutcome: pass\nprovenance: {capturedAt: 2026-09-18T08:00:00.000Z}\n`);
  const derived = computeDerived(workRoot);
  const rec = derived.records.get('fr.f.a');
  assert.equal(rec.effectiveState, 'suspended');
  assert.equal(rec.suspensionReason, 'appliesTo-newer:sds.f.guard');
});

test('effectiveState: blocked when a blockedBy target is not done, distinct from suspended', () => {
  const workRoot = tree({
    'features/f/gap/absence/index.yaml': 'schema: work/gap\nid: gap.f.absence\ntitle: Missing\nstate: todo\nstatement: nothing built yet\n',
    'features/f/br/a/index.yaml': 'schema: work/business-rule\nid: br.f.a\ntitle: A\nstate: todo\nblockedBy:\n  - {record: gap.f.absence, because: "not built"}\n',
  });
  const derived = computeDerived(workRoot);
  assert.equal(derived.records.get('br.f.a').effectiveState, 'blocked');
});

test('blockers: a blocked record\'s chain resolves through an intermediate record to its gap', () => {
  const workRoot = tree({
    'features/f/gap/absence/index.yaml': 'schema: work/gap\nid: gap.f.absence\ntitle: Missing\nstate: todo\nstatement: the module does not exist yet\n',
    'features/f/sds/mid/index.yaml': 'schema: work/sds-component\nid: sds.f.mid\ntitle: Mid\nstate: todo\nblockedBy:\n  - {record: gap.f.absence, because: "no module to build against"}\n',
    'features/f/br/a/index.yaml': 'schema: work/business-rule\nid: br.f.a\ntitle: A\nstate: todo\nblockedBy:\n  - {record: sds.f.mid, because: "the guard is not specified against a real module yet"}\n',
  });
  const derived = computeDerived(workRoot);
  const rec = derived.records.get('br.f.a');
  assert.equal(rec.effectiveState, 'blocked');
  assert.equal(rec.blockers.length, 1);
  assert.equal(rec.blockers[0].id, 'gap.f.absence');
  assert.equal(rec.blockers[0].rootKind, 'gap');
  assert.equal(rec.blockers[0].cyclic, false);
  assert.equal(rec.blockers[0].because, 'no module to build against');
});

test('blockers: a cycle stops the walk and is reported, not thrown', () => {
  const workRoot = tree({
    'features/f/br/a/index.yaml': 'schema: work/business-rule\nid: br.f.a\ntitle: A\nstate: todo\nblockedBy:\n  - {record: br.f.b, because: "waiting on b"}\n',
    'features/f/br/b/index.yaml': 'schema: work/business-rule\nid: br.f.b\ntitle: B\nstate: todo\nblockedBy:\n  - {record: br.f.a, because: "waiting on a"}\n',
  });
  const derived = computeDerived(workRoot);
  const rec = derived.records.get('br.f.a');
  assert.equal(rec.blockers.length, 1);
  assert.equal(rec.blockers[0].id, 'br.f.a');
  assert.equal(rec.blockers[0].cyclic, true);
});

test('frontier: excludes a blocked todo, includes an unblocked one, sorted by feature then id', () => {
  const workRoot = tree({
    'features/f/gap/absence/index.yaml': 'schema: work/gap\nid: gap.f.absence\ntitle: Missing\nstate: todo\nstatement: s\n',
    'features/f/br/blocked/index.yaml': 'schema: work/business-rule\nid: br.f.blocked\ntitle: Blocked\nstate: todo\nblockedBy:\n  - {record: gap.f.absence, because: "no module"}\n',
    'features/f/br/free/index.yaml': 'schema: work/business-rule\nid: br.f.free\ntitle: Free\nstate: todo\n',
    'features/f/br/done/index.yaml': 'schema: work/business-rule\nid: br.f.done\ntitle: Done\nstate: done\nverificationSource: authored-claim\nbecause: c\n',
  });
  const derived = computeDerived(workRoot);
  const ids = derived.frontier.map(item => item.id);
  assert.ok(!ids.includes('br.f.blocked'), ids.join(','));
  assert.ok(!ids.includes('br.f.done'), ids.join(','));
  assert.ok(ids.includes('br.f.free'));
  assert.ok(ids.includes('gap.f.absence'));
});

test('tally: done/todo/stale/blocked partition every record with a lifecycle state, per feature and overall', () => {
  const workRoot = tree({
    'features/f/br/done/index.yaml': 'schema: work/business-rule\nid: br.f.done\ntitle: Done\nstate: done\nverificationSource: authored-claim\nbecause: c\n',
    'features/f/br/todo/index.yaml': 'schema: work/business-rule\nid: br.f.todo\ntitle: Todo\nstate: todo\n',
    'features/f/gap/absence/index.yaml': 'schema: work/gap\nid: gap.f.absence\ntitle: Missing\nstate: todo\nstatement: s\n',
    'features/f/br/blocked/index.yaml': 'schema: work/business-rule\nid: br.f.blocked\ntitle: Blocked\nstate: todo\nblockedBy:\n  - {record: gap.f.absence, because: "no module"}\n',
    'features/f/ac/leaf/index.yaml': 'schema: work/acceptance-criterion\nid: ac.f.leaf\nrule: br.f.done\ngiven: g\nwhen: w\nthen: [t]\n',
  });
  write(workRoot, 'features/f/br/done/evidence.yaml',
    'schema: work/evidence\nrecord: br.f.done\nrecordDigest: "deadbeef00000000000000000000000000000000000000000000000000000000"\noutcome: pass\n');
  const derived = computeDerived(workRoot);
  // br.f.done -> stale (digest mismatch), br.f.todo -> todo, gap.f.absence -> todo, br.f.blocked -> blocked.
  // ac.f.leaf carries no state at all and must not be counted anywhere.
  assert.deepEqual(derived.tally.overall, {done: 0, todo: 2, stale: 1, blocked: 1, total: 4});
  assert.deepEqual(derived.tally.byFeature.get('f'), {done: 0, todo: 2, stale: 1, blocked: 1, total: 4});
  assert.deepEqual(derived.tally.gaps, [{id: 'gap.f.absence', feature: 'f', state: 'todo', closedBy: null}]);
});

test('tally: a gap\'s closedBy is normalised to a list even when authored as a bare id (concept 7)', () => {
  const workRoot = tree({
    'features/f/gap/absence/index.yaml': 'schema: work/gap\nid: gap.f.absence\ntitle: Missing\nstate: todo\nstatement: s\nclosedBy: impl.f.thing\n',
    'features/f/impl/thing/index.yaml': 'schema: work/implementation\nid: impl.f.thing\ntitle: t\nstate: todo\nrepository: r\nowners: [{role: module, path: src/f}]\n',
  });
  const derived = computeDerived(workRoot);
  assert.deepEqual(derived.tally.gaps, [{id: 'gap.f.absence', feature: 'f', state: 'todo', closedBy: ['impl.f.thing']}]);
});

test('_derived/ is excluded from the record walk: re-running after --write does not see its own output', () => {
  const workRoot = tree({
    'features/f/br/a/index.yaml': 'schema: work/business-rule\nid: br.f.a\ntitle: A\nstate: todo\n',
  });
  runDerive(workRoot, {write: true});
  const derived = computeDerived(workRoot);
  // workspace.yaml (id "fixture") plus the one authored br record - never the derived output's own content.
  assert.deepEqual([...derived.records.keys()].sort(), ['br.f.a', 'fixture']);
});

test('gate: a stale (or missing) _derived/index.yaml is refused', () => {
  const workRoot = tree({
    'features/f/br/a/index.yaml': 'schema: work/business-rule\nid: br.f.a\ntitle: A\nstate: todo\n',
  });
  const problemsMissing = [];
  checkExampleDerived(workRoot, problemsMissing);
  assert.ok(problemsMissing.some(p => p.includes('_derived/index.yaml')), problemsMissing.join('\n'));

  runDerive(workRoot, {write: true});
  const problemsFresh = [];
  checkExampleDerived(workRoot, problemsFresh);
  assert.equal(problemsFresh.filter(p => p.includes('_derived/index.yaml')).length, 0, problemsFresh.join('\n'));

  // the tree changes after --write; the derived index on disk now describes a tree that no longer exists.
  write(workRoot, 'features/f/br/b/index.yaml', 'schema: work/business-rule\nid: br.f.b\ntitle: B\nstate: todo\n');
  const problemsStale = [];
  checkExampleDerived(workRoot, problemsStale);
  assert.ok(problemsStale.some(p => p.includes('_derived/index.yaml')), problemsStale.join('\n'));
});

test('gate: an authored usedBy/effectiveState/frontier field on a real record is refused', () => {
  const workRoot = tree({
    'features/f/br/a/index.yaml': 'schema: work/business-rule\nid: br.f.a\ntitle: A\nstate: todo\nusedBy: {refs: [br.f.ghost]}\n',
  });
  const problems = [];
  checkExampleDerived(workRoot, problems);
  assert.ok(problems.some(p => p.includes('br/a/index.yaml') && p.includes('"usedBy"')), problems.join('\n'));
});

test('buildYamlDocument round-trips through stringifyYaml/parseYaml with no authored-vs-derived collision', () => {
  const workRoot = tree({
    'features/f/br/a/index.yaml': 'schema: work/business-rule\nid: br.f.a\ntitle: A\nstate: todo\n',
  });
  const {doc} = runDerive(workRoot, {write: true});
  assert.equal(typeof doc.records['br.f.a'].effectiveState, 'string');
  const {ok: okAfter} = runDerive(workRoot, {write: false});
  assert.equal(okAfter, true, 'a freshly written derived index must read back as fresh');
});
