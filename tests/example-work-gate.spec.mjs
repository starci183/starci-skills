import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { checkWorkTree } from '../scripts/check-example-work.mjs';

/**
 * One fixture tree per new-concept rule in scripts/check-example-work.mjs, proving each rule refuses the
 * exact malformed shape it targets - and, where useful, that the corrected shape is accepted. Fixtures live
 * on the same drive as the repo (never os.tmpdir(), which can be a different drive on this host and break
 * relative path handling used elsewhere in the toolchain).
 */
const TMP_ROOT = path.join(path.parse(process.cwd()).root, 'starci-tmp');

let counter = 0;
function freshDir() {
  counter += 1;
  const dir = path.join(TMP_ROOT, `gate-fixture-${process.pid}-${counter}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function write(root, rel, content) {
  const file = path.join(root, ...rel.split('/'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

/** Builds a minimal-but-valid .starciwork tree; `extra` maps additional relative paths to YAML content. */
function tree(extra) {
  const root = freshDir();
  const workRoot = path.join(root, '.starciwork');
  write(workRoot, 'index.yaml', 'schema: work/catalog\nid: fixture\nfeatures: []\n');
  for (const [rel, content] of Object.entries(extra)) write(workRoot, rel, content);
  return workRoot;
}

function refusalsFor(extra) {
  const workRoot = tree(extra);
  const problems = [];
  checkWorkTree(workRoot, problems);
  return problems;
}

test('concept 1: blocker edges - prose blockedBy is refused, dangling target is refused, a stale (done) blocker is refused', () => {
  const proseOnly = refusalsFor({
    'features/f/br/rule/index.yaml': 'schema: work/business-rule\nid: br.f.rule\ntitle: t\nstate: todo\nblockedBy:\n  - a plain sentence naming nothing\n',
  });
  assert.ok(proseOnly.some(p => p.includes('blockedBy carries a prose string')), proseOnly.join('\n'));

  const danglingTarget = refusalsFor({
    'features/f/br/rule/index.yaml': 'schema: work/business-rule\nid: br.f.rule\ntitle: t\nstate: todo\nblockedBy:\n  - {record: br.f.ghost, because: "waiting"}\n',
  });
  assert.ok(danglingTarget.some(p => p.includes('blockedBy target br.f.ghost does not exist')), danglingTarget.join('\n'));

  const stale = refusalsFor({
    'features/f/br/rule/index.yaml': 'schema: work/business-rule\nid: br.f.rule\ntitle: t\nstate: todo\nblockedBy:\n  - {record: br.f.other, rev: 1, because: "waiting on other"}\n',
    'features/f/br/other/index.yaml': 'schema: work/business-rule\nid: br.f.other\ntitle: t\nstate: done\nchange: {rev: 1, kind: initial, at: 2026-01-01T00:00:00.000Z}\nverificationSource: authored-claim\nbecause: claimed\n',
  });
  assert.ok(stale.some(p => p.includes('blockedBy on br.f.other is stale')), stale.join('\n'));

  const fresh = refusalsFor({
    'features/f/br/rule/index.yaml': 'schema: work/business-rule\nid: br.f.rule\ntitle: t\nstate: todo\nblockedBy:\n  - {record: br.f.other, because: "waiting on other"}\n',
    'features/f/br/other/index.yaml': 'schema: work/business-rule\nid: br.f.other\ntitle: t\nstate: todo\n',
  });
  assert.equal(fresh.length, 0, fresh.join('\n'));
});

test('concept 2: gap records need a valid state, a statement, and a resolving closedBy', () => {
  const badState = refusalsFor({
    'features/f/gap/absence/index.yaml': 'schema: work/gap\nid: gap.f.absence\ntitle: t\nstate: maybe\nstatement: something is missing\n',
  });
  assert.ok(badState.some(p => p.includes('work/gap state must be todo or done')), badState.join('\n'));

  const noStatement = refusalsFor({
    'features/f/gap/absence/index.yaml': 'schema: work/gap\nid: gap.f.absence\ntitle: t\nstate: todo\n',
  });
  assert.ok(noStatement.some(p => p.includes('work/gap needs a statement')), noStatement.join('\n'));

  const badClosedBy = refusalsFor({
    'features/f/gap/absence/index.yaml': 'schema: work/gap\nid: gap.f.absence\ntitle: t\nstate: todo\nstatement: s\nclosedBy: br.f.ghost\n',
  });
  assert.ok(badClosedBy.some(p => p.includes('closedBy names br.f.ghost')), badClosedBy.join('\n'));
});

test('concept 3: conflictsWith rev must match; tension is refused off policy-decision and needs 2+ ids', () => {
  const revMismatch = refusalsFor({
    'features/f/br/a/index.yaml': 'schema: work/business-rule\nid: br.f.a\ntitle: t\nstate: todo\nconflictsWith:\n  - {record: br.f.b, rev: 5, because: "x"}\n',
    'features/f/br/b/index.yaml': 'schema: work/business-rule\nid: br.f.b\ntitle: t\nstate: todo\nchange: {rev: 1, kind: initial, at: 2026-01-01T00:00:00.000Z}\n',
  });
  assert.ok(revMismatch.some(p => p.includes('conflictsWith cites br.f.b at rev 5')), revMismatch.join('\n'));

  const tensionOffDecision = refusalsFor({
    'features/f/br/a/index.yaml': 'schema: work/business-rule\nid: br.f.a\ntitle: t\nstate: todo\ntension: {records: [br.f.a, br.f.b], statement: s}\n',
    'features/f/br/b/index.yaml': 'schema: work/business-rule\nid: br.f.b\ntitle: t\nstate: todo\n',
  });
  assert.ok(tensionOffDecision.some(p => p.includes('tension is only authored on work/policy-decision')), tensionOffDecision.join('\n'));

  const tensionTooFew = refusalsFor({
    'features/f/decision/d/index.yaml': 'schema: work/policy-decision\nid: decision.f.d\ntitle: t\nstate: todo\noutcome: open\ntension: {records: [br.f.a], statement: s}\n',
    'features/f/br/a/index.yaml': 'schema: work/business-rule\nid: br.f.a\ntitle: t\nstate: todo\n',
  });
  assert.ok(tensionTooFew.some(p => p.includes('tension.records needs at least two')), tensionTooFew.join('\n'));
});

test('concept 4: decision outcome is closed, chosen must resolve to an option, targetModule is refused', () => {
  const badOutcome = refusalsFor({
    'features/f/decision/d/index.yaml': 'schema: work/policy-decision\nid: decision.f.d\ntitle: t\nstate: done\noutcome: skip-it\noptions:\n  - {id: skip-it, consequence: c}\n',
  });
  assert.ok(badOutcome.some(p => p.includes('outcome must be open or decided')), badOutcome.join('\n'));

  const chosenNotAnOption = refusalsFor({
    'features/f/decision/d/index.yaml': 'schema: work/policy-decision\nid: decision.f.d\ntitle: t\nstate: done\noutcome: decided\nchosen: not-listed\noptions:\n  - {id: real-option, consequence: c}\n',
  });
  assert.ok(chosenNotAnOption.some(p => p.includes('is not one of options')), chosenNotAnOption.join('\n'));

  const hasTargetModule = refusalsFor({
    'features/f/decision/d/index.yaml': 'schema: work/policy-decision\nid: decision.f.d\ntitle: t\nstate: done\noutcome: decided\nchosen: real-option\noptions:\n  - {id: real-option, consequence: c}\ntargetModule: src/wherever\n',
  });
  assert.ok(hasTargetModule.some(p => p.includes('targetModule is not part of the decision vocabulary')), hasTargetModule.join('\n'));
});

test('concept 5: change.kind is a closed enum; a stale recordDigest must carry stale: true', () => {
  const badKind = refusalsFor({
    'features/f/br/a/index.yaml': 'schema: work/business-rule\nid: br.f.a\ntitle: t\nstate: todo\nchange: {rev: 1, kind: whimsical, at: 2026-01-01T00:00:00.000Z}\n',
  });
  assert.ok(badKind.some(p => p.includes('change.kind "whimsical"')), badKind.join('\n'));

  const workRoot = tree({
    'features/f/br/a/index.yaml': 'schema: work/business-rule\nid: br.f.a\ntitle: t\nstate: done\nverificationSource: authored-claim\nbecause: c\n',
  });
  write(workRoot, 'features/f/br/a/evidence.yaml', 'schema: work/evidence\nrecord: br.f.a\nrecordDigest: "deadbeef00000000000000000000000000000000000000000000000000000000"\noutcome: pass\n');
  const problems = [];
  checkWorkTree(workRoot, problems);
  assert.ok(problems.some(p => p.includes('refused unless it carries stale: true')), problems.join('\n'));

  // now mark it stale and it must be accepted
  fs.writeFileSync(path.join(workRoot, 'features/f/br/a/evidence.yaml'),
    'schema: work/evidence\nrecord: br.f.a\nrecordDigest: "deadbeef00000000000000000000000000000000000000000000000000000000"\noutcome: pass\nstale: true\nstaleSince: {record: br.f.a}\n', 'utf8');
  const problems2 = [];
  checkWorkTree(workRoot, problems2);
  assert.equal(problems2.filter(p => p.includes('recordDigest')).length, 0, problems2.join('\n'));

  // and the real digest algorithm must be exactly sha256 of the record file's bytes (kernel/reconciliation.mjs's recordDigests/nodeFileOf)
  const recordFile = path.join(workRoot, 'features/f/br/a/index.yaml');
  const digest = crypto.createHash('sha256').update(fs.readFileSync(recordFile)).digest('hex');
  fs.writeFileSync(path.join(workRoot, 'features/f/br/a/evidence.yaml'),
    `schema: work/evidence\nrecord: br.f.a\nrecordDigest: ${digest}\noutcome: pass\n`, 'utf8');
  const problems3 = [];
  checkWorkTree(workRoot, problems3);
  assert.equal(problems3.filter(p => p.includes('recordDigest')).length, 0, problems3.join('\n'));
});

test('concept 6: a done record needs evidence or an authored-claim declaration; data/brand/policy-decision are exempt by default', () => {
  const bareDone = refusalsFor({
    'features/f/fr/x/index.yaml': 'schema: work/functional-requirement\nid: fr.f.x\ntitle: t\nstate: done\n',
  });
  assert.ok(bareDone.some(p => p.includes('no sibling evidence.yaml and no verificationSource')), bareDone.join('\n'));

  const exemptData = refusalsFor({
    'features/f/data/x/index.yaml': 'schema: work/data\nid: data.f.x\ntitle: t\nstate: done\nfields: []\n',
  });
  assert.equal(exemptData.length, 0, exemptData.join('\n'));

  const claimedDone = refusalsFor({
    'features/f/fr/x/index.yaml': 'schema: work/functional-requirement\nid: fr.f.x\ntitle: t\nstate: done\nverificationSource: authored-claim\nbecause: agreed by design, not yet run\n',
  });
  assert.equal(claimedDone.length, 0, claimedDone.join('\n'));
});

test('concept 7: appliesTo is refused off business-rule/sds-component (work/data in particular) and its targets must resolve', () => {
  const onData = refusalsFor({
    'features/f/data/x/index.yaml': 'schema: work/data\nid: data.f.x\ntitle: t\nstate: done\nfields: []\nappliesTo: [br.f.a]\n',
    'features/f/br/a/index.yaml': 'schema: work/business-rule\nid: br.f.a\ntitle: t\nstate: todo\n',
  });
  assert.ok(onData.some(p => p.includes('appliesTo is only authored on work/business-rule or work/sds-component, not work/data')), onData.join('\n'));

  const danglingTarget = refusalsFor({
    'features/f/br/a/index.yaml': 'schema: work/business-rule\nid: br.f.a\ntitle: t\nstate: todo\nappliesTo: [fr.other.ghost]\n',
  });
  assert.ok(danglingTarget.some(p => p.includes('appliesTo names fr.other.ghost')), danglingTarget.join('\n'));

  const onSdsComponent = refusalsFor({
    'features/f/sds/a/index.yaml': 'schema: work/sds-component\nid: sds.f.a\ntitle: t\nstate: todo\nappliesTo: [fr.f.b]\n',
    'features/f/fr/b/index.yaml': 'schema: work/functional-requirement\nid: fr.f.b\ntitle: t\nstate: todo\n',
  });
  assert.equal(onSdsComponent.length, 0, onSdsComponent.join('\n'));
});

test('concept 8: event needs a resolving producer, non-empty payload and a closed delivery vocabulary; subscribes must target a work/event; extends must target a work/data; a non-timer object on transitions.on is refused', () => {
  const badEvent = refusalsFor({
    'features/f/fr/x/index.yaml': 'schema: work/functional-requirement\nid: fr.f.x\ntitle: t\nstate: todo\n',
    'features/f/event/e/index.yaml': 'schema: work/event\nid: event.f.e\ntitle: t\nstate: todo\nproducer: fr.f.ghost\npayload: []\ndelivery: {guarantee: usually, ordering: whenever}\n',
  });
  assert.ok(badEvent.some(p => p.includes('producer "fr.f.ghost" does not resolve')), badEvent.join('\n'));
  assert.ok(badEvent.some(p => p.includes('event needs a non-empty payload')), badEvent.join('\n'));
  assert.ok(badEvent.some(p => p.includes('delivery.guarantee "usually"')), badEvent.join('\n'));
  assert.ok(badEvent.some(p => p.includes('delivery.ordering "whenever"')), badEvent.join('\n'));

  const goodEvent = refusalsFor({
    'features/f/fr/x/index.yaml': 'schema: work/functional-requirement\nid: fr.f.x\ntitle: t\nstate: todo\n',
    'features/f/event/e/index.yaml': 'schema: work/event\nid: event.f.e\ntitle: t\nstate: todo\nproducer: fr.f.x\npayload: [{name: id, type: text}]\ndelivery: {guarantee: at-least-once, ordering: per-key}\n',
  });
  assert.equal(goodEvent.length, 0, goodEvent.join('\n'));

  const subscribesToNonEvent = refusalsFor({
    'features/f/fr/x/index.yaml': 'schema: work/functional-requirement\nid: fr.f.x\ntitle: t\nstate: todo\nsubscribes: [fr.f.x]\n',
  });
  assert.ok(subscribesToNonEvent.some(p => p.includes('is a work/functional-requirement, not a work/event')), subscribesToNonEvent.join('\n'));

  const extendsNonData = refusalsFor({
    'features/f/br/a/index.yaml': 'schema: work/business-rule\nid: br.f.a\ntitle: t\nstate: todo\n',
    'features/f/data/x/index.yaml': 'schema: work/data\nid: data.f.x\ntitle: t\nstate: done\nfields: []\nextends: br.f.a\n',
  });
  assert.ok(extendsNonData.some(p => p.includes('is a work/business-rule, not a work/data')), extendsNonData.join('\n'));

  const badTimer = refusalsFor({
    'features/f/sds/a/index.yaml': 'schema: work/sds-component\nid: sds.f.a\ntitle: t\nstate: todo\nstateMachine: {states: [x, y], initial: x, transitions: [{id: t1, from: x, to: y, on: {notATimer: true}}]}\n',
  });
  assert.ok(badTimer.some(p => p.includes("is an object but not {timer")), badTimer.join('\n'));

  const goodTimer = refusalsFor({
    'features/f/sds/a/index.yaml': 'schema: work/sds-component\nid: sds.f.a\ntitle: t\nstate: todo\nstateMachine: {states: [x, y], initial: x, transitions: [{id: t1, from: x, to: y, on: {timer: "5 minutes"}}]}\n',
  });
  assert.equal(goodTimer.length, 0, goodTimer.join('\n'));
});

test('concept 9: work/implementation refuses legacy directory/files/targetFiles and needs role+path on every owner; business-rule.module accepts a string or a list', () => {
  const legacy = refusalsFor({
    'features/f/impl/x/index.yaml': 'schema: work/implementation\nid: impl.f.x\ntitle: t\nstate: todo\nrepository: r\ndirectory: src/f\nfiles: [a.ts]\n',
  });
  assert.ok(legacy.some(p => p.includes('legacy directory/files/targetFiles')), legacy.join('\n'));

  const missingRole = refusalsFor({
    'features/f/impl/x/index.yaml': 'schema: work/implementation\nid: impl.f.x\ntitle: t\nstate: todo\nrepository: r\nowners:\n  - {path: src/f/a.ts}\n',
  });
  assert.ok(missingRole.some(p => p.includes('owners entry missing role or path')), missingRole.join('\n'));

  const goodOwners = refusalsFor({
    'features/f/impl/x/index.yaml': 'schema: work/implementation\nid: impl.f.x\ntitle: t\nstate: todo\nrepository: r\nowners:\n  - {role: module, path: src/f/a.ts}\n  - {role: route, path: app/f/route.tsx}\n',
  });
  assert.equal(goodOwners.length, 0, goodOwners.join('\n'));

  const moduleAsNumber = refusalsFor({
    'features/f/br/a/index.yaml': 'schema: work/business-rule\nid: br.f.a\ntitle: t\nstate: todo\nmodule: 12\n',
  });
  assert.ok(moduleAsNumber.some(p => p.includes('module must be a non-empty string or a non-empty list')), moduleAsNumber.join('\n'));

  const moduleAsList = refusalsFor({
    'features/f/br/a/index.yaml': 'schema: work/business-rule\nid: br.f.a\ntitle: t\nstate: todo\nmodule: [src/f/route.tsx, src/f/entry.tsx]\n',
  });
  assert.equal(moduleAsList.length, 0, moduleAsList.join('\n'));
});

test('concept 10: a done ui-screen needs an asset carrying image_gen.imagegen generation, and coverage.map must name every listed state', () => {
  const doneNoGeneration = refusalsFor({
    'features/f/ui/x/index.yaml': 'schema: work/ui-screen\nid: ui.f.x\ntitle: t\nstate: done\nverificationSource: authored-claim\nbecause: c\nassets: [{path: assets/a.png, role: direction, provenance: p}]\n',
  });
  assert.ok(doneNoGeneration.some(p => p.includes('no asset carries generation.tool: image_gen.imagegen')), doneNoGeneration.join('\n'));

  const missingCoverage = refusalsFor({
    'features/f/ui/x/index.yaml': 'schema: work/ui-screen\nid: ui.f.x\ntitle: t\nstate: done\nverificationSource: authored-claim\nbecause: c\n' +
      'assets: [{path: assets/a.png, role: direction, provenance: p, generation: {tool: image_gen.imagegen, promptPath: assets/a.prompt.txt, inputRefs: []}}]\n' +
      'ui: {intent: i, surfaces: [], states: [{name: empty, trigger: t, behavior: b}, {name: full, trigger: t, behavior: b}], coverage: {scale: bounded, representativeScreens: [x], map: [{screen: x, state: empty, viewport: desktop, components: [], derivation: d}]}, accessibility: [], responsive: [], assets: [], observations: [], gaps: []}\n',
  });
  assert.ok(missingCoverage.some(p => p.includes('coverage.map names no entry for state "full"')), missingCoverage.join('\n'));

  const good = refusalsFor({
    'features/f/ui/x/index.yaml': 'schema: work/ui-screen\nid: ui.f.x\ntitle: t\nstate: done\nverificationSource: authored-claim\nbecause: c\n' +
      'assets: [{path: assets/a.png, role: direction, provenance: p, generation: {tool: image_gen.imagegen, promptPath: assets/a.prompt.txt, inputRefs: []}}]\n' +
      'ui: {intent: i, surfaces: [], states: [{name: empty, trigger: t, behavior: b}], coverage: {scale: bounded, representativeScreens: [x], map: [{screen: x, state: empty, viewport: desktop, components: [], derivation: d}]}, accessibility: [], responsive: [], assets: [], observations: [], gaps: []}\n',
  });
  assert.equal(good.length, 0, good.join('\n'));
});

test('concept 11: a generation-carrying asset is refused outside work/ui-screen, with a dedicated message for work/implementation', () => {
  const onImplementation = refusalsFor({
    'features/f/impl/x/index.yaml': 'schema: work/implementation\nid: impl.f.x\ntitle: t\nstate: todo\nrepository: r\nowners: [{role: module, path: a.ts}]\nassets: [{path: assets/running.png, generation: {tool: image_gen.imagegen, promptPath: p, inputRefs: []}}]\n',
  });
  assert.ok(onImplementation.some(p => p.includes('implementation captures are real running-page screenshots')), onImplementation.join('\n'));

  const onOtherFamily = refusalsFor({
    'features/f/fr/x/index.yaml': 'schema: work/functional-requirement\nid: fr.f.x\ntitle: t\nstate: todo\nassets: [{path: assets/a.png, generation: {tool: image_gen.imagegen, promptPath: p, inputRefs: []}}]\n',
  });
  assert.ok(onOtherFamily.some(p => p.includes('a generated direction asset is ui-owned only')), onOtherFamily.join('\n'));
});

test('concept 12: a done uat-flow needs a sibling evidence.yaml naming a run with screens, videos and a passing result.md', () => {
  const noEvidence = refusalsFor({
    'features/f/uat/x/index.yaml': 'schema: work/uat-flow\nid: uat.f.x\ntitle: t\nstate: done\n',
  });
  assert.ok(noEvidence.some(p => p.includes('no sibling evidence.yaml naming the run')), noEvidence.join('\n'));

  const workRoot = tree({
    'features/f/uat/x/index.yaml': 'schema: work/uat-flow\nid: uat.f.x\ntitle: t\nstate: done\n',
    'features/f/uat/x/evidence.yaml': 'schema: work/evidence\nrecord: uat.f.x\noutcome: pass\nrun: runs/run-1\n',
  });
  const missingRunFolder = [];
  checkWorkTree(workRoot, missingRunFolder);
  assert.ok(missingRunFolder.some(p => p.includes('has no screens/')), missingRunFolder.join('\n'));
  assert.ok(missingRunFolder.some(p => p.includes('has no videos/')), missingRunFolder.join('\n'));
  assert.ok(missingRunFolder.some(p => p.includes('has no result.md')), missingRunFolder.join('\n'));

  write(workRoot, 'features/f/uat/x/runs/run-1/screens/step-1.png', 'x');
  write(workRoot, 'features/f/uat/x/runs/run-1/videos/walk.webm', 'x');
  write(workRoot, 'features/f/uat/x/runs/run-1/result.md', 'outcome: fail\n');
  const failingOutcome = [];
  checkWorkTree(workRoot, failingOutcome);
  assert.ok(failingOutcome.some(p => p.includes('does not record outcome: pass')), failingOutcome.join('\n'));

  write(workRoot, 'features/f/uat/x/runs/run-1/result.md', 'outcome: pass\n');
  const passing = [];
  checkWorkTree(workRoot, passing);
  assert.equal(passing.length, 0, passing.join('\n'));
});

test('concept 13: _resources custody is the plain work/resource schema (no @N), and a uat-flow\'s environment/fixtures/accounts refs resolve to the right kind', () => {
  const wrongSchema = refusalsFor({
    '_resources/environments/dev/resource.yaml': 'schema: work/resource@1\nid: environment.f.dev\nkind: environment\nowner: o\nrevision: r\ndetails: {}\n',
  });
  assert.ok(wrongSchema.some(p => p.includes('this layout forbids the @N suffix here')), wrongSchema.join('\n'));

  const badEnvRef = refusalsFor({
    'features/f/uat/x/index.yaml': 'schema: work/uat-flow\nid: uat.f.x\ntitle: t\nstate: todo\nenvironment: environment.f.ghost\n',
  });
  assert.ok(badEnvRef.some(p => p.includes('environment environment.f.ghost does not resolve')), badEnvRef.join('\n'));

  const wrongKind = refusalsFor({
    'features/f/uat/x/index.yaml': 'schema: work/uat-flow\nid: uat.f.x\ntitle: t\nstate: todo\nenvironment: fixture.f.seed\n',
    '_resources/fixtures/seed/resource.yaml': 'schema: work/resource\nid: fixture.f.seed\nkind: fixture\nowner: o\nrevision: r\ndetails: {}\n',
  });
  assert.ok(wrongKind.some(p => p.includes('resolves to a work/resource of kind "fixture", not environment')), wrongKind.join('\n'));

  const badIdentity = refusalsFor({
    'features/f/uat/x/index.yaml': 'schema: work/uat-flow\nid: uat.f.x\ntitle: t\nstate: todo\naccounts: accounts.yaml\n',
    'features/f/uat/x/accounts.yaml': 'schema: work/disposable-accounts\naccounts: [{role: person, identity: identity.f.ghost}]\n',
  });
  assert.ok(badIdentity.some(p => p.includes('accounts.yaml identity identity.f.ghost does not resolve')), badIdentity.join('\n'));

  const good = refusalsFor({
    'features/f/uat/x/index.yaml': 'schema: work/uat-flow\nid: uat.f.x\ntitle: t\nstate: todo\nenvironment: environment.f.dev\nfixtures: [fixture.f.seed]\naccounts: accounts.yaml\n',
    'features/f/uat/x/accounts.yaml': 'schema: work/disposable-accounts\naccounts: [{role: person, identity: identity.f.demo}]\n',
    '_resources/environments/dev/resource.yaml': 'schema: work/resource\nid: environment.f.dev\nkind: environment\nowner: o\nrevision: r\ndetails: {}\n',
    '_resources/fixtures/seed/resource.yaml': 'schema: work/resource\nid: fixture.f.seed\nkind: fixture\nowner: o\nrevision: r\ndetails: {}\n',
    '_resources/identities/demo/resource.yaml': 'schema: work/resource\nid: identity.f.demo\nkind: identity\nowner: o\nrevision: r\ndetails: {}\n',
  });
  assert.equal(good.length, 0, good.join('\n'));
});
