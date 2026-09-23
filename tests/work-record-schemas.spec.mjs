import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import {parseYaml} from '../engine/yaml.mjs';

/**
 * One schema per Work record family, checked against the tree that is the readable statement of the shape.
 *
 * The example is the subject, not a sample: every record file under `examples/todo-app-backend/.starciwork` is
 * validated against the schema its own `schema:` key names, and a file naming a schema that does not exist
 * fails as loudly as a file the schema rejects. A spec that walked only the families it remembered would go
 * green the day somebody added a family nobody wrote a schema for, which is the one failure this file is
 * here to prevent.
 *
 * The negative cases are not decoration either. Each one is a rule that was argued for and decided, and a
 * schema that quietly stopped enforcing it would still validate the whole example: a withdrawal recorded as
 * editorial, an NFR with no measurement, an acceptance criterion or a feature carrying a state. Those four
 * are exactly the edits that make a tree look finished, so they are asserted as refusals rather than trusted
 * to the presence of a keyword.
 */
const root = path.resolve(import.meta.dirname, '..');
const schemaDir = path.join(root, 'modules', 'schemas');
const workRoot = path.join(root, 'examples', 'todo-app-backend', '.starciwork');

const ajv = new Ajv2020({strict: true, allErrors: true});

const readSchema = file => parseYaml(fs.readFileSync(path.join(schemaDir, file), 'utf8'));

// The family list is read off the catalog rather than typed out here. A hand-kept list is a third copy of
// the same fact - the catalog has it, each schema's `schema` const has it - and the copy that rots is
// always the one a spec keeps privately. `subsystem: work-tree` is what the catalog calls the schemas a
// .starciwork tree's own files carry; `node scripts/checks/check-schema-catalog.mjs` keeps that list from
// drifting away from the files. The one entry with no `properties.schema.const` is the metadata monolith,
// which discriminates through a oneOf instead and is not a per-family authority.
const catalog = parseYaml(fs.readFileSync(path.join(schemaDir, 'index.yaml'), 'utf8'));
const SCHEMA_FILES = Object.fromEntries((catalog?.schemas ?? [])
  .filter(entry => entry?.subsystem === 'work-tree' && entry?.dialect === 'json-schema')
  .map(entry => [entry, readSchema(path.basename(String(entry.file)))?.properties?.schema?.const])
  .filter(([, family]) => typeof family === 'string')
  .map(([entry, family]) => {
    assert.equal(family, String(entry.id).trim(), `${entry.file} pins ${family} on its schema key, which is not the ${entry.id} the catalog lists it under`);
    return [family, path.basename(String(entry.file))];
  }));

// v11 collapsed every acceptance criterion onto the rule it accepts, so no file in the example stamps
// work/acceptance-criterion@1 any more. work-layout.yaml still declares the ac family folder, so the
// schema stays and this is the one family the tree encodes inline rather than as its own record.
const INLINED_FAMILIES = new Set(['work/acceptance-criterion@1']);
// A superseded family stays catalogued only so a record written before its successor still validates until it
// is converted (work/app-shell@1 -> work/layout-tree@1, scripts/work/layout-tree.mjs convert); no example
// writes one anew.
const SUPERSEDED_FAMILIES = new Set(['work/app-shell@1']);

const compiled = new Map(Object.entries(SCHEMA_FILES).map(([family, file]) => [family, ajv.compile(readSchema(file))]));
const validatorFor = family => compiled.get(family);

const errorText = validate => (validate.errors ?? []).map(error => `${error.instancePath || '/'} ${error.message}`).join('; ');

function recordFiles() {
  const found = [];
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.yaml')) found.push(full);
    }
  };
  walk(workRoot);
  return found.sort();
}

test('every record family named in the example has a schema, and every schema is named by the example', () => {
  const files = recordFiles();
  assert.ok(files.length > 0, 'the example tree has no record files; the subject of this spec is missing');
  const named = new Set();
  const unparseable = [];
  for (const file of files) {
    let record;
    try {
      record = parseYaml(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      unparseable.push(`${path.relative(root, file)}: ${error.message}`);
      continue;
    }
    named.add(record?.schema);
  }
  assert.deepEqual(unparseable, [], 'these example records are not valid YAML, so no schema can accept them');
  const unknown = [...named].filter(family => !SCHEMA_FILES[family]);
  assert.deepEqual(unknown, [], 'the example names these schemas and no schema file defines them');
  const unused = Object.keys(SCHEMA_FILES).filter(family => !named.has(family) && !INLINED_FAMILIES.has(family) && !SUPERSEDED_FAMILIES.has(family));
  assert.deepEqual(unused, [], 'these schemas are defined and no example record exercises them');
});

test('every record in the example validates against the schema it names', () => {
  const rejected = [];
  for (const file of recordFiles()) {
    let record;
    try {
      record = parseYaml(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      rejected.push(`${path.relative(root, file)}: unreadable YAML - ${error.message}`);
      continue;
    }
    const validate = validatorFor(record?.schema);
    if (!validate) {
      rejected.push(`${path.relative(root, file)}: names schema ${record?.schema}, which does not exist`);
      continue;
    }
    if (!validate(record)) rejected.push(`${path.relative(root, file)}: ${errorText(validate)}`);
  }
  assert.deepEqual(rejected, [], 'the example is the statement of the shape; a rejected record means the schema and the shape disagree');
});

test('every schema compiles under ajv strict mode and closes its objects', () => {
  const open = [];
  // A conditional branch describes a condition, not a record shape, so `if`/`then`/`else`/`not` are not
  // walked: they legitimately mention a handful of keys without defining the whole object.
  const CONDITIONAL = new Set(['if', 'then', 'else', 'not']);
  const closed = node => {
    if (Array.isArray(node)) return node.forEach(closed);
    if (!node || typeof node !== 'object') return;
    // `propertyNames` closes an open map by constraining its keys instead of listing them, which is how the
    // brand's token maps stay extensible without accepting a value of any shape.
    if (node.type === 'object' && node.additionalProperties !== false && node.propertyNames === undefined)
      open.push(JSON.stringify(Object.keys(node.properties ?? {})));
    for (const [key, value] of Object.entries(node)) if (!CONDITIONAL.has(key)) closed(value);
  };
  for (const file of Object.values(SCHEMA_FILES)) closed(readSchema(file));
  assert.deepEqual(open, [], 'an object that accepts unknown keys accepts a field nobody agreed to');
});

const base = {
  rule: () => ({
    schema: 'work/business-rule@1',
    id: 'br.task.title.required',
    title: 'A task without a title does not exist',
    state: 'todo',
    statements: ['A task is created only with a non-empty title.'],
    acceptance: [{
      id: 'ac.task.title.required.refuses-empty',
      given: 'A creation request',
      when: 'Its title is empty',
      then: ['Creation is refused.']
    }],
    module: 'src/task/create',
    change: {rev: 2, kind: 'breaking', at: '2026-09-18T02:11:00.000Z'}
  }),
  nfr: () => ({
    schema: 'work/non-functional-requirement@1',
    id: 'nfr.task.list.latency',
    title: 'A list read feels immediate',
    quality: 'latency',
    state: 'todo',
    observableCriterion: 'The list endpoint answers in under 200 ms at the 95th percentile.',
    measurement: {how: 'k6 run scripts/load/list.js', threshold: 'p95 < 200ms', environment: 'dev'},
    appliesTo: ['br.task.list.owned']
  }),
  criterion: () => ({
    schema: 'work/acceptance-criterion@1',
    id: 'ac.task.title.required.refuses-empty',
    rule: 'br.task.title.required',
    given: 'A creation request',
    when: 'Its title is empty',
    then: ['Creation is refused.']
  }),
  feature: () => ({
    schema: 'work/feature@1',
    id: 'task',
    title: 'A task a person creates, completes and deletes',
    description: 'The core of the product.'
  })
};

const refuses = (family, record, because) => {
  const validate = validatorFor(family);
  assert.equal(validate(record), false, because);
};

test('a rule that withdraws a statement without calling the change breaking is refused', () => {
  const editorial = base.rule();
  editorial.change = {rev: 2, kind: 'editorial', at: '2026-09-18T02:11:00.000Z', withdraws: ['A complete task is never reopened.']};
  refuses('work/business-rule@1', editorial, 'withdrawing a statement is a breaking change; recording it as editorial under-reports what the product stopped promising');
  const clarifying = base.rule();
  clarifying.change = {rev: 2, kind: 'clarifying', at: '2026-09-18T02:11:00.000Z', withdraws: ['A complete task is never reopened.']};
  refuses('work/business-rule@1', clarifying, 'a clarification adds nothing and removes nothing, so it cannot carry a withdrawal');
  const breaking = base.rule();
  breaking.change = {rev: 2, kind: 'breaking', at: '2026-09-18T02:11:00.000Z', withdraws: ['A complete task is never reopened.'], reason: 'The owner decided completion is reversible.'};
  assert.equal(validatorFor('work/business-rule@1')(breaking), true, 'the same withdrawal recorded as breaking is exactly what the family is for');
});

test('a non-functional requirement without a measurement is refused', () => {
  const unmeasured = base.nfr();
  delete unmeasured.measurement;
  refuses('work/non-functional-requirement@1', unmeasured, 'an NFR with no way to measure it cannot be passed, failed or regressed against');
  for (const missing of ['how', 'threshold', 'environment']) {
    const partial = base.nfr();
    delete partial.measurement[missing];
    refuses('work/non-functional-requirement@1', partial, `a measurement missing ${missing} cannot be repeated by a second person`);
  }
});

test('an acceptance criterion carrying a state is refused', () => {
  const stateful = base.criterion();
  stateful.state = 'done';
  refuses('work/acceptance-criterion@1', stateful, 'a criterion is the unit of proof, not a unit of work; a done criterion would let a tree report proof it never observed');
  assert.equal(validatorFor('work/acceptance-criterion@1')(base.criterion()), true, 'the same criterion without a state is the normal case');
});

test('a feature carrying a state is refused', () => {
  const stateful = base.feature();
  stateful.state = 'done';
  refuses('work/feature@1', stateful, 'a parent derives from its descendants; a feature that can claim done can report done while its leaves say otherwise');
  const catalog = {
    schema: 'work/catalog@1',
    id: 'todo',
    description: 'Product catalog.',
    features: [{id: 'task', directory: 'features/task', description: 'A task.'}],
    state: 'done'
  };
  refuses('work/catalog@1', catalog, 'the catalog is a parent for the same reason and refuses a state for the same reason');
});

test('no leaf schema accepts a derived state, and none accepts an authored stale flag', () => {
  const leaves = {
    'work/business-rule@1': base.rule(),
    'work/non-functional-requirement@1': base.nfr()
  };
  for (const [family, record] of Object.entries(leaves)) {
    const derived = {...record, state: 'stale'};
    refuses(family, derived, `${family} must not author stale; the checker derives it from an input that moved`);
    const flagged = {...record, stale: true};
    refuses(family, flagged, `${family} must not carry a stale flag; a record that can mark itself fresh or expired replaces a measurement with an opinion`);
  }
});

test('evidence records what was observed, and refuses a pass that contradicts its own assertions', () => {
  const manifest = () => ({
    schema: 'work/evidence@1',
    record: 'br.task.title.required',
    recordDigest: 'a'.repeat(64),
    codeDigest: {algorithm: 'sha256', files: [{path: 'src/task/create/create.handler.ts', sha256: 'b'.repeat(64)}], digest: 'c'.repeat(64)},
    outcome: 'pass',
    assertions: [{
      id: 'br.task.title.required#ac.task.title.required.refuses-empty',
      command: 'npx jest src/task/create',
      exit: 0,
      outcome: 'pass',
      observation: 'npx jest src/task/create exited 0'
    }],
    provenance: {
      actor: 'example-evidence',
      tool: 'scripts/example/example-evidence.mjs',
      environment: 'local',
      capturedAt: '2026-09-18T04:38:00.000Z'
    }
  });
  assert.equal(validatorFor('work/evidence@1')(manifest()), true, 'the ordinary manifest shape must validate or every other case here is meaningless');

  const unreplayable = manifest();
  delete unreplayable.assertions[0].command;
  refuses('work/evidence@1', unreplayable, 'a prose observation alone cannot be replayed, only read; the command is what lets a later run compare outcomes rather than re-read a claim');

  const contradictory = manifest();
  contradictory.assertions[0].outcome = 'fail';
  refuses('work/evidence@1', contradictory, 'a manifest reporting pass while one of its own assertions failed is the shape a green tree hides a red check in');

  const failed = manifest();
  failed.outcome = 'fail';
  failed.assertions[0].outcome = 'fail';
  assert.equal(validatorFor('work/evidence@1')(failed), true, 'a failed run is still evidence and is kept, because it is how a regression is dated');

  const marked = manifest();
  marked.stale = true;
  refuses('work/evidence@1', marked, 'evidence is marked stale with the reason it expired; a mark with no reason becomes a file nobody can interpret and therefore deletes');
  marked.staleReason = 'Proven against rev 1, whose never-reopen clause rev 2 withdrew.';
  assert.equal(validatorFor('work/evidence@1')(marked), true, 'marked with its reason, expired evidence stays as readable history');

  const unmarked = manifest();
  unmarked.staleReason = 'Proven against rev 1.';
  refuses('work/evidence@1', unmarked, 'a reason for expiry without the mark leaves the evidence reading as current');
});

test('an implementation names owners, plural, and labels a verification it did not run', () => {
  const module = () => ({
    schema: 'work/implementation@1',
    id: 'impl.task.todo-app-backend.ownership',
    title: 'Ownership binding and its guard',
    state: 'done',
    repository: 'todo-app-backend',
    owners: [{role: 'module', path: 'src/task/ownership'}, {role: 'route', path: 'src/app/tasks'}],
    revision: '6'.repeat(40),
    proves: ['br.task.single-owner'],
    verification: ['npm run test:unit -- src/task/ownership exited 0'],
    verificationSource: 'kernel-observed'
  });
  assert.equal(validatorFor('work/implementation@1')(module()), true, 'the ordinary implementation shape must validate');

  // work-layout.yaml: one screen or one flow spans more than one owned artifact, and a single
  // directory/files pair cannot name more than one shape at a time, so the gate refuses both fields.
  const pathed = module();
  delete pathed.owners;
  pathed.directory = 'src/task/ownership';
  pathed.files = ['ownership.guard.ts'];
  refuses('work/implementation@1', pathed, 'directory/files is the shape owners[] replaced; a record carrying it names one artifact where the work spans several');

  const nameless = module();
  nameless.owners = [{path: 'src/task/ownership'}];
  refuses('work/implementation@1', nameless, 'an owner entry without a role names a path and not what it is, which is what a reader needs to know before opening it');

  const invented = module();
  invented.verificationSource = 'reviewed';
  refuses('work/implementation@1', invented, 'a fourth source would be a way of describing a claim that is neither run by the kernel, run by somebody, nor admitted as a claim');

  // Every other schema needs a sibling evidence.yaml OR this declaration; the declaration is worthless
  // without the sentence saying why nothing ran.
  const claimed = module();
  delete claimed.verification;
  claimed.verificationSource = 'authored-claim';
  refuses('work/implementation@1', claimed, 'an authored claim with no because is a done record asserting itself');
  claimed.because = 'The module is a re-export; there is nothing to run that its consumers do not already run.';
  assert.equal(validatorFor('work/implementation@1')(claimed), true, 'with its reason, an authored claim is the declaration work-layout.yaml allows in place of a run');
});

test('a proof demand may not be both required and optional, and must ask for something', () => {
  const requirement = () => ({
    schema: 'work/functional-requirement@1',
    id: 'fr.task.create',
    title: 'Create a task',
    state: 'todo',
    actors: ['owner'],
    trigger: 'The owner submits a title.',
    mainFlow: ['The task is created.'],
    composes: [{rule: 'br.task.title.required', module: 'src/task/create'}],
    requiresProof: {uat: {required: true}}
  });
  assert.equal(validatorFor('work/functional-requirement@1')(requirement()), true, 'the ordinary requirement shape must validate');
  const both = requirement();
  both.requiresProof.uat = {required: true, optional: true};
  refuses('work/functional-requirement@1', both, 'a demand that is both required and optional is a demand nobody decided');
  const empty = requirement();
  empty.requiresProof.uat = {};
  refuses('work/functional-requirement@1', empty, 'a kind named with nothing asked of it reads as a bar that has been set and is unmeetable');
  const invented = requirement();
  invented.requiresProof.review = {required: true};
  refuses('work/functional-requirement@1', invented, 'the kinds are closed so that a weaker bar cannot be invented by choosing a new word for it');
});

const decisionEntry = () => ({
  rev: 2,
  at: '2026-09-23T03:10:00Z',
  gap: 'The design is silent on where the Shell session token is verified.',
  chosen: 'The session store verifies the token on every read.',
  why: 'The accepted rule br.login.session.expires reads expiry on use, and the other features verify on read.',
  alternatives: ['A sweep revokes expired tokens.']
});

test('a revised record carries its decisionLog under extensions.work3, and an entry is closed', () => {
  const component = () => ({
    schema: 'work/sds-component@1',
    id: 'sds.login.session-store',
    title: 'The store that owns a signed-in session',
    state: 'todo',
    responsibility: 'Holds each session and refuses one past its expiry on read.',
    refs: ['br.login.session.expires'],
    change: {rev: 2, kind: 'clarifying', at: '2026-09-23T03:10:00Z', reason: 'A builder reported the verification point missing.'},
    extensions: {work3: {decisionLog: [decisionEntry()]}}
  });
  const cases = {
    'work/sds-component@1': component,
    'work/business-rule@1': () => ({...base.rule(), extensions: {work3: {decisionLog: [decisionEntry()]}}})
  };
  for (const [family, record] of Object.entries(cases)) {
    const validate = validatorFor(family);
    assert.equal(validate(record()), true, `${family}: a revise op appends a decisionLog entry, so the record it writes must validate: ${errorText(validate)}`);
    const extra = record();
    extra.extensions.work3.decisionLog[0].owner = 'nivo';
    refuses(family, extra, `${family}: a decisionLog entry is closed; a key nobody agreed to is refused`);
    const bare = record();
    delete bare.extensions.work3.decisionLog[0].why;
    refuses(family, bare, `${family}: an entry without why records a choice nobody can overturn on its merits`);
  }
});

test('every family schema that carries change.rev also accepts the decisionLog a revision appends', () => {
  const missing = Object.entries(SCHEMA_FILES)
    .map(([family, file]) => [family, readSchema(file)])
    .filter(([, schema]) => schema.properties?.change && schema.$defs?.extensions?.properties?.work3)
    .filter(([, schema]) => schema.properties.extensions?.$ref !== '#/$defs/extensions'
      || schema.$defs.extensions.properties.work3.properties?.decisionLog?.$ref !== '#/$defs/decisionLog')
    .map(([family]) => family);
  assert.deepEqual(missing, [], 'a revise op bumps change.rev and appends a decisionLog entry; a family refusing the entry makes every correct revision invalid');
});

// inc-eb76d3be0a2b: interface.draw writes `ui.flow` and its coverage proof requires it, while the closed `ui`
// block declared no such key, so every draw failed either the schema or the op. The flow map is a declared,
// closed shape; a screen drawn before the op demanded it stays valid without one.
test('a ui-screen carries the interaction-flow map interface.draw writes, and the map is closed', () => {
  const screen = () => parseYaml(fs.readFileSync(path.join(root, 'examples', 'ecommerce-app-be', '.starciwork', 'features', 'identity', 'ui', 'sign-in', 'index.yaml'), 'utf8'));
  const validate = validatorFor('work/ui-screen@1');
  assert.equal(validate(screen()), true, `a ui record without ui.flow stays valid: ${errorText(validate)}`);
  const flow = () => ({
    route: '/sign-in',
    transitions: [
      {from: 'entry', trigger: 'open sign-in', to: 'sign-in-ready', rule: 'withhold protected content'},
      {id: 'submit-refused', from: ['sign-in-ready', 'sign-in-refused'], trigger: 'submit wrong password', to: 'sign-in-refused', guard: 'the form is valid', effect: 'no session'}
    ],
    edgeCases: [
      'Refresh mid-flow restores only server-held custody.',
      {name: 'double-submit', handling: 'one pending request; the second press is disabled'}
    ]
  });
  const drawn = screen();
  drawn.ui.flow = flow();
  assert.equal(validate(drawn), true, `the flow map interface.draw writes must validate: ${errorText(validate)}`);
  const holed = screen();
  holed.ui.flow = flow();
  delete holed.ui.flow.transitions[0].to;
  refuses('work/ui-screen@1', holed, 'a transition with no landing state is a hole in the map, not an edge');
  const extra = screen();
  extra.ui.flow = {...flow(), matrix: []};
  refuses('work/ui-screen@1', extra, 'the flow map is closed; a key nobody declared is refused');
  const empty = screen();
  empty.ui.flow = {route: '/sign-in'};
  refuses('work/ui-screen@1', empty, 'a flow map with no transitions accounts for nothing');
});
