import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../engine/yaml.mjs';
import { loadOp, root, blocker, readOf, writeOf, states, statesOnce } from './helpers/op-contract.mjs';

// Specs are authored progressively: an op seeds the smallest decision-complete
// slice and refines it from evidence, rather than writing a whole speculative
// tree up front. Asserted through the enums, ids and policy keys that carry the
// rule, not through the sentences that explain it.
const readFile = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('the SRS and SDS ops seed the smallest slice and leave it todo until evidence closes it', () => {
  for (const [id, noun] of [['business.decide', 'decision-complete'], ['architecture.decide', 'design-complete']]) {
    const op = loadOp(id);
    statesOnce(assert, op, ['smallest', noun], { label: `${id} seeds the smallest ${noun} slice` });
    states(assert, op, ['todo', 'evidence']);
    states(assert, op, ['final reconciliation'], { label: `${id} reserves done for final reconciliation` });
    // The revision path is a repair, not a second decision, and it appends one
    // decision-log entry per revision.
    states(assert, op, ['decisionLog']);
    statesOnce(assert, op, ['params.readingsStated'], { section: '$.steps', label: 'how many readings a repair enumerates' });
    assert.equal(op.params.readingsStated.setBy, 'kernel');
    assert.equal(JSON.stringify(op.steps).match(/\btwo or three readings\b/i), null,
      `${id} restates the reading count instead of citing the param`);
  }
});

test('implementation feedback is classified before it is allowed to move a spec', () => {
  for (const id of ['business.decide', 'architecture.decide', 'backend.implement', 'interface.implement']) {
    const op = loadOp(id);
    states(assert, op, ['implementation feedback'], { label: `${id} classifies implementation feedback` });
  }
  for (const id of ['backend.implement', 'interface.implement'])
    states(assert, loadOp(id), ['smallest', 'delta']);

  const refactor = loadOp('code.refactor');
  states(assert, refactor, ['source-local']);
  const tests = loadOp('test.author');
  assert.ok(blocker(tests, 'REQUIREMENT_UNSETTLED'), 'test.author has no REQUIREMENT_UNSETTLED blocker');
  states(assert, tests, ['suite-local']);
});

test('the Work lifecycle keeps its closed state enum and shows progress through activity', () => {
  const schema = parseYaml(readFile('modules/schemas/work.schema.yaml'));
  const nodeState = schema.$defs.node.allOf.find((rule) => rule?.if?.properties?.schema?.const === 'work/node@1')
    .then.properties.state.enum;
  assert.deepEqual(nodeState, ['uninvestigate', 'todo', 'done']);
  assert.deepEqual(schema.$defs.node.properties.activity.enum, ['idle', 'investigating', 'implementing', 'verifying']);

  const layout = readFile('modules/schemas/work-layout.yaml');
  assert.match(layout, /todo \+ activity: idle/);
  assert.match(layout, /Never add an inprogress state/);
  assert.match(layout, /final reconciliation/);
});

test('final delivery verification requires one current full-chain revision', () => {
  const review = loadOp('review.verify');
  // review.verify runs one selected mode; the delivery chain belongs to the
  // modes that reconcile it, so the blocker lives with them.
  const modes = Object.entries(review.policy.executionModes)
    .filter(([, mode]) => (mode.blockers ?? []).some((b) => b.code === 'DELIVERY_CHAIN_INCOMPLETE'))
    .map(([name]) => name);
  assert.ok(modes.length >= 1, 'no review.verify mode blocks on DELIVERY_CHAIN_INCOMPLETE');
  assert.equal(review.policy.modePolicy.selection, 'required-exactly-one');
  states(assert, review, ['delivery revision']);
  assert.match(readFile('modules/kernel/driver-loop.yaml'), /current reconciliation\s+proving SRS, SDS/);
  assert.match(readFile('modules/kernel/verdict-contract.yaml'), /delivery-done-with-incomplete-chain/);
});

test('test.author accepts only the proposal its packet explicitly bound', () => {
  const op = loadOp('test.author');
  assert.equal(op.graphPolicy.prerequisiteState, 'done-or-exact-direct-predecessor-proposal');
  const authority = op.policy.proposalAuthority;
  assert.ok(authority, 'proposalAuthority belongs under policy:');
  assert.equal(authority.scope, 'workspace-canonicalization-only');
  const text = JSON.stringify(authority).toLowerCase();
  for (const term of ['packet context.records', 'scope.define', 'repository-wide discovery', 'workspace.manage'])
    assert.ok(text.includes(term), `proposalAuthority should bound ${term}`);

  const target = readOf(op, 'target');
  assert.match(target.path, /packet context\.records/);
  states(assert, op, ['do not scan'], { label: 'the target is the bound record, not a search' });
  states(assert, op, ['goal identity'], { label: 'the packet binds the approved goal' });
  assert.ok(blocker(op, 'DECLARED_DEPENDENCY_UNMET'));
  assert.match(JSON.stringify(writeOf(op, 'node')), /workspace\.manage/,
    'the node write must say who materializes the proposed record later');
});

test('code.refactor consumes the same bound proposal, and only after regression proof', () => {
  const op = loadOp('code.refactor');
  assert.equal(op.graphPolicy.prerequisiteState, 'done-or-exact-workspace-canonicalization-proposal-with-regression');
  const authority = op.policy.proposalAuthority;
  assert.equal(authority.scope, 'workspace-canonicalization-only');
  const text = JSON.stringify(authority).toLowerCase();
  for (const term of ['packet context.records', 'test.author', 'regression', 'repository-wide discovery', 'workspace.manage'])
    assert.ok(text.includes(term), `proposalAuthority should bound ${term}`);

  const migration = op.policy.migrationAuthority;
  assert.equal(migration.scope, 'workspace-canonicalization-only');
  const migrationText = JSON.stringify(migration).toLowerCase();
  for (const term of ['red before source edits', 'green after', 'unrelated failure', 'collection-only'])
    assert.ok(migrationText.includes(term), `migrationAuthority should bound ${term}`);
  assert.match(op.policy.refactorPolicy.workspaceCanonicalizationMigration, /red-before-green-after/);

  const target = readOf(op, 'target');
  assert.match(target.path, /packet context\.records/);
  states(assert, op, ['do not scan'], { label: 'the target is the bound record, not a search' });
  assert.match(JSON.stringify(writeOf(op, 'node')), /workspace\.manage/);

  // The cut-set authority is what lets one semantic op run as several slices.
  assert.equal(op.policy.cutSetAuthority.scope, 'workspace-canonicalization-only');
});

test('every op in the catalog holds the one shape, with no authored summary block', () => {
  const dir = path.join(root, 'modules', 'ops', 'ops');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.yaml'))) {
    const op = parseYaml(fs.readFileSync(path.join(dir, file), 'utf8'));
    assert.equal(op.schema, 'starci/op@1', `${file} does not stamp starci/op@1`);
    assert.ok(!Object.hasOwn(op, 'business'), `${file} still authors a business: summary`);
    for (const key of Object.keys(op))
      assert.ok(!/Policy$|Authority$|^executionModes$|^findingSchema$/.test(key) || key === 'graphPolicy' || key === 'layoutPolicy',
        `${file} declares ${key} at the top level instead of under policy:`);
  }
});
