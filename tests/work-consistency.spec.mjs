import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {checkWorkConsistencyTree, checkTreeParity, declaredStateValues} from '../scripts/checks/check-work-consistency.mjs';
import {loadRecords} from '../scripts/example/example-ownership.mjs';
import {walk} from '../scripts/checks/check-example-work.mjs';

/**
 * One fixture tree per cross-record rule in scripts/checks/check-work-consistency.mjs, proving each rule fires on the
 * exact disagreement between two records that it targets - and, where the same shape is legitimate, that it
 * stays quiet. The base gate's own fixtures (tests/example-work-gate.spec.mjs) build the same minimal
 * `.starciwork`; these trees are deliberately NOT run through that gate, because most of them break a
 * cross-record rule on purpose and would otherwise drown in unrelated refusals.
 *
 * Fixtures live on the same drive as the repo (never os.tmpdir(), which can be a different drive on this host
 * and break relative path handling used elsewhere in the toolchain).
 */
const TMP_ROOT = path.join(path.parse(process.cwd()).root, 'starci-tmp');

let counter = 0;
function freshDir() {
  counter += 1;
  const dir = path.join(TMP_ROOT, `consistency-fixture-${process.pid}-${counter}`);
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

/** A `.starciwork` whose catalog is empty unless a test passes entries; `files` maps record paths to YAML. */
function consistencySink(files, catalogEntries = null) {
  const catalogBody = catalogEntries === null ? 'features: []\n'
    : `features:\n${catalogEntries.map(entry => `  - {id: ${entry.id}, directory: ${entry.directory}, description: "${entry.description}"}\n`).join('')}`;
  const workRoot = path.join(freshDir(), '.starciwork');
  write(workRoot, 'index.yaml', `schema: work/catalog\nid: fixture\n${catalogBody}`);
  for (const [rel, content] of Object.entries(files)) write(workRoot, rel, content);
  return checkWorkConsistencyTree(workRoot);
}

const refusedWith = (sink, code) => sink.refuse.filter(line => line.includes(`[${code}]`));
const suspectedWith = (sink, code) => sink.suspect.filter(line => line.includes(`[${code}]`));
const joinAll = sink => [...sink.refuse, ...sink.suspect, ...sink.info].join('\n');

const criterion = (name, rule) => `schema: work/acceptance-criterion\nid: ${rule.replace(/^br\./, 'ac.')}.${name}\nrule: ${rule}\ngiven: g\nwhen: w\nthen: [t]\n`;
const rule = (id, criteria, extra = '') => `schema: work/business-rule\nid: ${id}\ntitle: t\nstate: todo\nstatements: [s]\nacceptanceCriteria: [${criteria.join(', ')}]\nmodule: src/f\n${extra}`;

test('concept 1: a rule naming a criterion that no ac/ directory answers is refused when the rule owns criteria', () => {
  const staleName = consistencySink({
    'features/f/br/complete/once/index.yaml': rule('br.f.complete.once', ['is-idempotent', 'is-reversible']),
    'features/f/br/complete/once/ac/is-idempotent/index.yaml': criterion('is-idempotent', 'br.f.complete.once'),
  });
  assert.equal(refusedWith(staleName, 'AC_NAMING_ASYMMETRY').length, 1, joinAll(staleName));
  assert.ok(refusedWith(staleName, 'AC_NAMING_ASYMMETRY')[0].includes('is-reversible'), joinAll(staleName));
  assert.ok(refusedWith(staleName, 'AC_NAMING_ASYMMETRY')[0].includes('the name is stale, not the convention'), joinAll(staleName));

  // no ac/ directory at all is a deferral somebody may have chosen: suspected, never refused
  const noCriterionDirs = consistencySink({
    'features/f/br/complete/once/index.yaml': rule('br.f.complete.once', ['is-idempotent']),
  });
  assert.equal(refusedWith(noCriterionDirs, 'AC_NAMING_ASYMMETRY').length, 0, joinAll(noCriterionDirs));
  assert.equal(suspectedWith(noCriterionDirs, 'AC_NAMING_ASYMMETRY').length, 1, joinAll(noCriterionDirs));

  // the matching shape is silent
  const agreed = consistencySink({
    'features/f/br/complete/once/index.yaml': rule('br.f.complete.once', ['is-idempotent', 'is-reversible']),
    'features/f/br/complete/once/ac/is-idempotent/index.yaml': criterion('is-idempotent', 'br.f.complete.once'),
    'features/f/br/complete/once/ac/is-reversible/index.yaml': criterion('is-reversible', 'br.f.complete.once'),
  });
  assert.equal(agreed.refuse.length, 0, joinAll(agreed));
});

test('concept 1: the reverse direction - a criterion its rule does not list, and a criterion whose id lost touch with its directory', () => {
  const unlisted = consistencySink({
    'features/f/br/complete/once/index.yaml': rule('br.f.complete.once', ['is-idempotent']),
    'features/f/br/complete/once/ac/is-idempotent/index.yaml': criterion('is-idempotent', 'br.f.complete.once'),
    'features/f/br/complete/once/ac/is-reversible/index.yaml': criterion('is-reversible', 'br.f.complete.once'),
  });
  assert.ok(refusedWith(unlisted, 'AC_NAMING_ASYMMETRY').some(line => line.includes('it does not list is-reversible')), joinAll(unlisted));

  // the criterion carries the id its place requires but answers a different rule than the one listing it
  const wrongOwner = consistencySink({
    'features/f/br/complete/once/index.yaml': rule('br.f.complete.once', ['is-idempotent']),
    'features/f/br/complete/twice/index.yaml': rule('br.f.complete.twice', []),
    'features/f/br/complete/once/ac/is-idempotent/index.yaml': 'schema: work/acceptance-criterion\nid: ac.f.complete.once.is-idempotent\nrule: br.f.complete.twice\ngiven: g\nwhen: w\nthen: [t]\n',
  });
  assert.ok(refusedWith(wrongOwner, 'AC_NAMING_ASYMMETRY').some(line => line.includes('answers br.f.complete.twice, not br.f.complete.once')), joinAll(wrongOwner));
  assert.ok(refusedWith(wrongOwner, 'AC_NAMING_ASYMMETRY').some(line => line.includes('it does not list is-idempotent')), joinAll(wrongOwner));

  // a criterion directory whose record carries an id its place does not support
  const mislabelled = consistencySink({
    'features/f/br/complete/once/index.yaml': rule('br.f.complete.once', ['is-idempotent']),
    'features/f/br/complete/once/ac/is-idempotent/index.yaml': 'schema: work/acceptance-criterion\nid: ac.f.complete.other\nrule: br.f.complete.once\ngiven: g\nwhen: w\nthen: [t]\n',
  });
  assert.ok(refusedWith(mislabelled, 'AC_NAMING_ASYMMETRY').some(line => line.includes('no record inside it carries the id')), joinAll(mislabelled));
});

test('concept 2: a forEach demand naming a field the record does not carry is refused, and a dotted path resolves', () => {
  const dangling = consistencySink({
    'features/f/sds/store/index.yaml': 'schema: work/sds-component\nid: sds.f.store\ntitle: t\nstate: done\nrequiresProof: {implementation: {required: true}, transitions: {forEach: stateMachine.transitions}}\n',
    'features/f/impl/built/index.yaml': 'schema: work/implementation\nid: impl.f.built\ntitle: t\nstate: done\nproves: [sds.f.store]\n',
  });
  assert.equal(refusedWith(dangling, 'PROOF_FOREACH_DANGLING').length, 1, joinAll(dangling));

  const resolved = consistencySink({
    'features/f/sds/store/index.yaml': 'schema: work/sds-component\nid: sds.f.store\ntitle: t\nstate: done\nrequiresProof: {implementation: {required: true}, transitions: {forEach: stateMachine.transitions}}\nstateMachine: {transitions: [{id: open, to: closed}]}\n',
    'features/f/impl/built/index.yaml': 'schema: work/implementation\nid: impl.f.built\ntitle: t\nstate: done\nproves: [sds.f.store]\n',
  });
  assert.equal(resolved.refuse.length, 0, joinAll(resolved));
});

test('concept 2: proof coverage of a done flow - thin where nothing is demanded, gap where the bar does not grow', () => {
  const thin = consistencySink({
    'features/f/fr/create/index.yaml': 'schema: work/functional-requirement\nid: fr.f.create\ntitle: t\nstate: done\ncomposes: [{rule: br.f.title.required, module: src/f}, {rule: br.f.owner.only, module: src/f}]\n',
  });
  assert.equal(suspectedWith(thin, 'PROOF_COVERAGE_THIN').length, 1, joinAll(thin));
  // the single THIN line says everything; the sub-rules must not pile on for the same record
  assert.equal(suspectedWith(thin, 'PROOF_COVERAGE_GAP').length, 0, joinAll(thin));

  const noForEach = consistencySink({
    'features/f/fr/create/index.yaml': 'schema: work/functional-requirement\nid: fr.f.create\ntitle: t\nstate: done\ncomposes: [{rule: br.f.title.required, module: src/f}, {rule: br.f.owner.only, module: src/f}]\nrequiresProof: {unit: {required: true}, e2e: {command: "npm run test:e2e"}, uat: {required: true}}\n',
    'features/f/uat/create/index.yaml': 'schema: work/uat-flow\nid: uat.f.create\ntitle: t\nstate: done\nproves: [fr.f.create]\n',
  });
  assert.ok(suspectedWith(noForEach, 'PROOF_COVERAGE_GAP').some(line => line.includes('no forEach: composes')), joinAll(noForEach));
  assert.equal(suspectedWith(noForEach, 'PROOF_UNCLAIMED').length, 0, joinAll(noForEach));

  const covering = consistencySink({
    'features/f/fr/create/index.yaml': 'schema: work/functional-requirement\nid: fr.f.create\ntitle: t\nstate: done\ncomposes: [{rule: br.f.title.required, module: src/f}, {rule: br.f.owner.only, module: src/f}]\nrequiresProof: {unit: {forEach: composes}, e2e: {command: "npm run test:e2e"}, uat: {required: true}}\n',
    'features/f/uat/create/index.yaml': 'schema: work/uat-flow\nid: uat.f.create\ntitle: t\nstate: todo\nproves: [fr.f.create]\n',
  });
  // the demand is now claimed by a walk that has not run: concept 4 names that, concept 2 must not
  assert.equal(covering.suspect.filter(line => line.includes('[PROOF_')).length, 0, joinAll(covering));
  assert.equal(suspectedWith(covering, 'PROVES_ASYMMETRY').length, 1, joinAll(covering));

  // a demanded walk that no uat-flow claims at all is the coverage hole worth naming
  const unclaimed = consistencySink({
    'features/f/fr/create/index.yaml': 'schema: work/functional-requirement\nid: fr.f.create\ntitle: t\nstate: done\ncomposes: [{rule: br.f.title.required, module: src/f}]\nrequiresProof: {unit: {forEach: composes}, e2e: {command: "npm run test:e2e"}, uat: {required: true}}\n',
  });
  assert.ok(suspectedWith(unclaimed, 'PROOF_UNCLAIMED').some(line => line.includes('fr.f.create')), joinAll(unclaimed));
});

test('concept 2: a done journey whose own route list contains an unfinished requirement is refused', () => {
  const unheld = consistencySink({
    'features/j/journey/walk/index.yaml': 'schema: work/customer-journey\nid: journey.f.walk\ntitle: t\nstate: done\nrequirements: [fr.f.create, fr.f.delete]\nrequiresProof: {uat: {required: true}, requirements: {forEach: requirements}}\n',
    'features/f/fr/create/index.yaml': 'schema: work/functional-requirement\nid: fr.f.create\ntitle: t\nstate: done\ncomposes: [{rule: br.f.title.required, module: src/f}]\nrequiresProof: {unit: {forEach: composes}, e2e: {command: "npm run test:e2e"}}\n',
    'features/f/fr/delete/index.yaml': 'schema: work/functional-requirement\nid: fr.f.delete\ntitle: t\nstate: todo\ncomposes: [{rule: br.f.title.required, module: src/f}]\n',
  });
  assert.equal(refusedWith(unheld, 'PROOF_ROUTE_UNHOLDS').length, 1, joinAll(unheld));
  assert.ok(refusedWith(unheld, 'PROOF_ROUTE_UNHOLDS')[0].includes('fr.f.delete is todo'), joinAll(unheld));

  const held = consistencySink({
    'features/j/journey/walk/index.yaml': 'schema: work/customer-journey\nid: journey.f.walk\ntitle: t\nstate: done\nrequirements: [fr.f.create]\nrequiresProof: {uat: {required: true}, requirements: {forEach: requirements}}\n',
    'features/f/fr/create/index.yaml': 'schema: work/functional-requirement\nid: fr.f.create\ntitle: t\nstate: done\ncomposes: [{rule: br.f.title.required, module: src/f}]\nrequiresProof: {unit: {forEach: composes}, e2e: {command: "npm run test:e2e"}}\n',
  });
  assert.equal(refusedWith(held, 'PROOF_ROUTE_UNHOLDS').length, 0, joinAll(held));
});

test('concept 3: two done records that declare each other impossible need a decided policy-decision naming both', () => {
  const pair = (leftState, rightState, decision = '') => consistencySink({
    'features/f/br/keep/index.yaml': `schema: work/business-rule\nid: br.f.keep\ntitle: t\nstate: ${leftState}\nstatements: [s]\nacceptanceCriteria: [kept]\nmodule: src/f\nconflictsWith: [{record: br.f.erase, because: "erase removes what keep promises to hold"}]\n`,
    'features/f/br/erase/index.yaml': `schema: work/business-rule\nid: br.f.erase\ntitle: t\nstate: ${rightState}\nstatements: [s]\nacceptanceCriteria: [erased]\nmodule: src/f\n`,
    'features/f/br/keep/ac/kept/index.yaml': criterion('kept', 'br.f.keep'),
    'features/f/br/erase/ac/erased/index.yaml': criterion('erased', 'br.f.erase'),
    ...(decision ? {'features/f/decision/method/index.yaml': decision} : {}),
  });

  const undecided = pair('done', 'done');
  assert.equal(refusedWith(undecided, 'CONFLICT_WITHOUT_DECISION').length, 1, joinAll(undecided));
  assert.ok(refusedWith(undecided, 'CONFLICT_WITHOUT_DECISION')[0].includes('br.f.keep'), joinAll(undecided));

  // one side still todo: a conflict that is honest about being open, so it is not a contradiction yet
  const open = pair('done', 'todo');
  assert.equal(refusedWith(open, 'CONFLICT_WITHOUT_DECISION').length, 0, joinAll(open));
  assert.equal(suspectedWith(open, 'CONFLICT_WITHOUT_DECISION').length, 1, joinAll(open));

  const settled = pair('done', 'done', 'schema: work/policy-decision\nid: decision.f.method\ntitle: t\nstate: done\noutcome: decided\nchosen: shred\noptions: [{id: shred, consequence: c}]\ntension: {records: [br.f.keep, br.f.erase], statement: jointly unsatisfiable as written}\n');
  assert.equal(refusedWith(settled, 'CONFLICT_WITHOUT_DECISION').length, 0, joinAll(settled));
  assert.equal(suspectedWith(settled, 'CONFLICT_WITHOUT_DECISION').length, 0, joinAll(settled));

  // an undecided decision names the pair without settling it
  const stillOpen = pair('done', 'done', 'schema: work/policy-decision\nid: decision.f.method\ntitle: t\nstate: todo\noutcome: open\noptions: [{id: shred, consequence: c}]\ntension: {records: [br.f.keep, br.f.erase], statement: c}\n');
  assert.equal(refusedWith(stillOpen, 'CONFLICT_WITHOUT_DECISION').length, 1, joinAll(stillOpen));
});

test('concept 4: a todo prover of a done record is suspected; the done-prover direction belongs to the base gate', () => {
  const unprovenProver = consistencySink({
    'features/f/fr/create/index.yaml': 'schema: work/functional-requirement\nid: fr.f.create\ntitle: t\nstate: done\ncomposes: [{rule: br.f.title.required, module: src/f}]\nrequiresProof: {unit: {forEach: composes}, e2e: {command: "npm run test:e2e"}}\n',
    'features/f/uat/create/index.yaml': 'schema: work/uat-flow\nid: uat.f.create\ntitle: t\nstate: todo\nproves: [fr.f.create]\n',
  });
  assert.equal(suspectedWith(unprovenProver, 'PROVES_ASYMMETRY').length, 1, joinAll(unprovenProver));
  assert.ok(suspectedWith(unprovenProver, 'PROVES_ASYMMETRY')[0].includes('uat.f.create is todo'), joinAll(unprovenProver));

  const provenProver = consistencySink({
    'features/f/fr/create/index.yaml': 'schema: work/functional-requirement\nid: fr.f.create\ntitle: t\nstate: done\ncomposes: [{rule: br.f.title.required, module: src/f}]\nrequiresProof: {unit: {forEach: composes}, e2e: {command: "npm run test:e2e"}}\n',
    'features/f/uat/create/index.yaml': 'schema: work/uat-flow\nid: uat.f.create\ntitle: t\nstate: done\nproves: [fr.f.create]\n',
  });
  assert.equal(suspectedWith(provenProver, 'PROVES_ASYMMETRY').length, 0, joinAll(provenProver));

  // both edges of one unfinished story: nothing is claimed as proven, so there is no asymmetry
  const bothTodo = consistencySink({
    'features/f/fr/create/index.yaml': 'schema: work/functional-requirement\nid: fr.f.create\ntitle: t\nstate: todo\ncomposes: [{rule: br.f.title.required, module: src/f}]\n',
    'features/f/uat/create/index.yaml': 'schema: work/uat-flow\nid: uat.f.create\ntitle: t\nstate: todo\nproves: [fr.f.create]\n',
  });
  assert.equal(suspectedWith(bothTodo, 'PROVES_ASYMMETRY').length, 0, joinAll(bothTodo));
});

test('concept 5: a gap closed by nothing, and a gap still open though every closer is done', () => {
  const closedByNothing = consistencySink({
    'features/f/gap/reopen/index.yaml': 'schema: work/gap\nid: gap.f.reopen\ntitle: t\nstate: done\nstatement: reopening is unspecified\n',
  });
  assert.equal(suspectedWith(closedByNothing, 'GAP_CLOSED_BY_NOTHING').length, 1, joinAll(closedByNothing));

  const closerDoneGapOpen = consistencySink({
    'features/f/gap/live-proof/index.yaml': 'schema: work/gap\nid: gap.f.live-proof\ntitle: t\nstate: todo\nstatement: no live run\nclosedBy: impl.f.built\n',
    'features/f/impl/built/index.yaml': 'schema: work/implementation\nid: impl.f.built\ntitle: t\nstate: done\nproves: [fr.f.create]\n',
    'features/f/fr/create/index.yaml': 'schema: work/functional-requirement\nid: fr.f.create\ntitle: t\nstate: done\ncomposes: [{rule: br.f.title.required, module: src/f}]\nrequiresProof: {unit: {forEach: composes}, e2e: {command: "npm run test:e2e"}}\n',
  });
  assert.equal(suspectedWith(closerDoneGapOpen, 'GAP_CLOSURE_STALE').length, 1, joinAll(closerDoneGapOpen));

  const honestlyOpen = consistencySink({
    'features/f/gap/live-proof/index.yaml': 'schema: work/gap\nid: gap.f.live-proof\ntitle: t\nstate: todo\nstatement: no live run\nclosedBy: impl.f.built\n',
    'features/f/impl/built/index.yaml': 'schema: work/implementation\nid: impl.f.built\ntitle: t\nstate: todo\n',
  });
  assert.equal(suspectedWith(honestlyOpen, 'GAP_CLOSURE_STALE').length, 0, joinAll(honestlyOpen));
  assert.equal(suspectedWith(honestlyOpen, 'GAP_CLOSED_BY_NOTHING').length, 0, joinAll(honestlyOpen));
});

test('concept 6: a catalog entry without its feature node is refused; a title that no longer says the same thing is suspected', () => {
  const catalogEntry = [{id: 'keep', directory: 'features/keep', description: 'A feature that keeps what it is told.'}];

  const missingNode = consistencySink({}, catalogEntry);
  assert.equal(refusedWith(missingNode, 'CATALOG_DIRTY').length, 1, joinAll(missingNode));
  assert.ok(refusedWith(missingNode, 'CATALOG_DIRTY')[0].includes('is absent'), joinAll(missingNode));

  const idDrift = consistencySink({
    'features/keep/index.yaml': 'schema: work/feature\nid: keeps\ntitle: A feature that keeps what it is told\ndescription: d\n',
  }, catalogEntry);
  assert.ok(refusedWith(idDrift, 'CATALOG_DIRTY').some(line => line.includes('the feature record beside it is keeps')), joinAll(idDrift));
  assert.ok(refusedWith(idDrift, 'CATALOG_DIRTY').some(line => line.includes('is absent') === false), joinAll(idDrift));

  const directoryDrift = consistencySink({
    'features/kept/index.yaml': 'schema: work/feature\nid: keep\ntitle: A feature that keeps what it is told\ndescription: d\n',
  }, [{id: 'keep', directory: 'features/kept', description: 'A feature that keeps what it is told.'}]);
  assert.ok(refusedWith(directoryDrift, 'CATALOG_DIRTY').some(line => line.includes('its directory is named kept')), joinAll(directoryDrift));

  const titleDrift = consistencySink({
    'features/keep/index.yaml': 'schema: work/feature\nid: keep\ntitle: A feature that keeps\ndescription: d\n',
  }, catalogEntry);
  assert.equal(refusedWith(titleDrift, 'CATALOG_DIRTY').length, 0, joinAll(titleDrift));
  assert.equal(suspectedWith(titleDrift, 'CATALOG_TITLE_DRIFT').length, 1, joinAll(titleDrift));
  assert.ok(suspectedWith(titleDrift, 'CATALOG_TITLE_DRIFT')[0].includes('one is the other truncated'), joinAll(titleDrift));

  // the catalog's sentence and the feature's title agree once punctuation is not counted
  const agreed = consistencySink({
    'features/keep/index.yaml': 'schema: work/feature\nid: keep\ntitle: A feature that keeps what it is told\ndescription: d\n',
  }, catalogEntry);
  assert.equal(agreed.suspect.length, 0, joinAll(agreed));
  assert.equal(agreed.refuse.length, 0, joinAll(agreed));
});

test('concept 7: a state outside the family schema is refused where the schema is readable and unclaimed where it is not', () => {
  assert.deepEqual(declaredStateValues('work/business-rule'), ['todo', 'done']);
  assert.equal(declaredStateValues('work/gap'), null, 'work/gap has no per-family schema file, so no enum claim is made');

  const invented = consistencySink({
    'features/f/br/keep/index.yaml': 'schema: work/business-rule\nid: br.f.keep\ntitle: t\nstate: uninvestigate\nstatements: [s]\nacceptanceCriteria: [kept]\nmodule: src/f\n',
    'features/f/br/keep/ac/kept/index.yaml': criterion('kept', 'br.f.keep'),
  });
  assert.equal(refusedWith(invented, 'STATE_VOCABULARY_UNKNOWN').length, 1, joinAll(invented));
  assert.ok(refusedWith(invented, 'STATE_VOCABULARY_UNKNOWN')[0].includes('work-business-rule.schema.yaml'), joinAll(invented));
  // the invented value must not also read as a proof thin spot: it is not done, so coverage rules stay out of it
  assert.equal(refusedWith(invented, 'CONFLICT_WITHOUT_DECISION').length, 0, joinAll(invented));

  const gapInvented = consistencySink({
    'features/f/gap/live-proof/index.yaml': 'schema: work/gap\nid: gap.f.live-proof\ntitle: t\nstate: uninvestigate\nstatement: s\n',
  });
  assert.equal(refusedWith(gapInvented, 'STATE_VOCABULARY_UNKNOWN').length, 0, joinAll(gapInvented));
});

test('concept 8: parity reports one line per record family whose authored fields differ between trees', () => {
  const buildTree = (files, label) => {
    const workRoot = path.join(freshDir(), label, '.starciwork');
    write(workRoot, 'index.yaml', 'schema: work/catalog\nid: fixture\nfeatures: []\n');
    for (const [rel, content] of Object.entries(files)) write(workRoot, rel, content);
    return {workRoot, label, records: loadRecords(workRoot, walk)};
  };
  const sink = {refuse: [], suspect: [], info: []};
  const leftTree = buildTree({
    'features/f/br/keep/index.yaml': rule('br.f.keep', ['kept'], 'blockedBy: [{record: gap.f.live-proof, because: waiting}]\n'),
    'features/f/br/keep/ac/kept/index.yaml': criterion('kept', 'br.f.keep'),
    'features/f/gap/live-proof/index.yaml': 'schema: work/gap\nid: gap.f.live-proof\ntitle: t\nstate: todo\nstatement: s\n',
  }, 'left-app');
  const rightTree = buildTree({
    'features/f/br/keep/index.yaml': rule('br.f.keep', ['kept']),
    'features/f/br/keep/ac/kept/index.yaml': criterion('kept', 'br.f.keep'),
    'features/f/brand/index.yaml': 'schema: work/brand\nid: brand\ntitle: t\nstate: done\ncolour: {primary: "#123456"}\n',
  }, 'right-app');

  checkTreeParity([leftTree, rightTree], sink);
  const parityLines = sink.info.filter(line => line.includes('[PARITY_FIELD]'));
  assert.equal(parityLines.length, 1, sink.info.join('\n'));
  assert.ok(parityLines[0].includes('work/business-rule'), parityLines[0]);
  assert.ok(parityLines[0].includes('only left-app: blockedBy'), parityLines[0]);
  assert.ok(parityLines[0].includes('left-app=1, right-app=1'), parityLines[0]);

  // a family with no records at all in the other tree is a scope fact, not a forked convention
  assert.ok(!sink.info.some(line => line.includes('work/brand')), sink.info.join('\n'));

  const singleTree = {refuse: [], suspect: [], info: []};
  checkTreeParity([leftTree], singleTree);
  assert.equal(singleTree.info.length, 1, singleTree.info.join('\n'));
  assert.ok(singleTree.info[0].includes('[PARITY_SKIPPED]'), singleTree.info[0]);
});

test('a tree whose records agree with each other produces no finding at all', () => {
  const clean = consistencySink({
    'features/f/index.yaml': 'schema: work/feature\nid: f\ntitle: The fixture feature\ndescription: A feature kept for these fixtures.\n',
    'features/f/br/keep/index.yaml': 'schema: work/business-rule\nid: br.f.keep\ntitle: t\nstate: done\nstatements: [s]\nacceptanceCriteria: [kept]\nmodule: src/f\nchange: {rev: 1, kind: initial, at: 2026-09-01T00:00:00Z}\n',
    'features/f/br/keep/ac/kept/index.yaml': criterion('kept', 'br.f.keep'),
    'features/f/fr/create/index.yaml': 'schema: work/functional-requirement\nid: fr.f.create\ntitle: t\nstate: done\ncomposes: [{rule: br.f.keep, module: src/f}]\nrequiresProof: {unit: {forEach: composes}, e2e: {command: "npm run test:e2e"}, uat: {required: true}}\n',
    'features/f/uat/create/index.yaml': 'schema: work/uat-flow\nid: uat.f.create\ntitle: t\nstate: done\nproves: [fr.f.create, br.f.keep]\n',
    'features/f/gap/live-proof/index.yaml': 'schema: work/gap\nid: gap.f.live-proof\ntitle: t\nstate: done\nstatement: the walk was never run\nclosedBy: uat.f.create\n',
  }, [{id: 'f', directory: 'features/f', description: 'The fixture feature.'}]);
  assert.equal(clean.refuse.length, 0, joinAll(clean));
  assert.equal(clean.suspect.length, 0, joinAll(clean));
});
