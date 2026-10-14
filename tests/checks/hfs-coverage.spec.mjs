import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseYaml } from '../../engine/yaml.mjs';
import { loadRuleCatalog } from '../../scripts/hfs/rule-catalog.mjs';
import { hfsRulesFindings } from '../../scripts/checks/check-hfs-rules.mjs';
import { coverageReport, formatCoverageReport, hfsCoverageFindings, loadCoverageContext } from '../../scripts/checks/check-hfs-coverage.mjs';
import { runCoverageWitnesses } from '../../scripts/checks/lib/coverage-witness.mjs';

// proves: RT_COVERAGE_NO_ENFORCER@lite RT_COVERAGE_NO_ENFORCER@full
// proves: RT_COVERAGE_NO_SPEC@lite RT_COVERAGE_NO_SPEC@full
// proves: RT_COVERAGE_NO_WITNESS@lite RT_COVERAGE_NO_WITNESS@full
// proves: RT_COVERAGE_NO_DOC@lite RT_COVERAGE_NO_DOC@full
// proves: RT_COVERAGE_NO_TEMPLATE@lite RT_COVERAGE_NO_TEMPLATE@full
// proves: RT_COVERAGE_NO_EXAMPLE@lite RT_COVERAGE_NO_EXAMPLE@full
// proves: RT_COVERAGE_EDITION_ASYMMETRY@lite RT_COVERAGE_EDITION_ASYMMETRY@full
// proves: RT_COVERAGE_SCHEMA_NO_RECORD@lite RT_COVERAGE_SCHEMA_NO_RECORD@full
// proves: RT_COVERAGE_GATE_LIE@lite RT_COVERAGE_GATE_LIE@full
// proves: RT_COVERAGE_SUPERSEDED_CITE@lite RT_COVERAGE_SUPERSEDED_CITE@full
// proves: RT_COVERAGE_SURFACE_UNMAPPED@lite RT_COVERAGE_SURFACE_UNMAPPED@full
// proves: RT_COVERAGE_REQUIREMENT_UNLEDGERED@lite RT_COVERAGE_REQUIREMENT_UNLEDGERED@full
// proves: RT_COVERAGE_PROOF_VACUOUS@lite RT_COVERAGE_PROOF_VACUOUS@full
// proves: RT_COVERAGE_CODE_UNROUTED@lite RT_COVERAGE_CODE_UNROUTED@full

const EDITIONS = ['lite', 'full'];
const SAMPLE = 'RT_SAMPLE_FAILURE';
const DOC = 'docs/coverage.md';
const SPEC = 'tests/checks/sample.spec.mjs';
const ENFORCER = 'scripts/checks/check-sample.mjs';
const TEMPLATE = 'packages/hfs/templates/app/sample/record.yaml';
const RUNTIME_SLOTS = 'knowledge/hfs/runtime-slots.yaml';
const ruleOf = (context) => context.catalog.rules[0];
const otherEdition = (edition) => edition === 'lite' ? 'full' : 'lite';
const examplePath = (edition) => `examples/${edition}-app`;
const recordPath = (edition) => `${examplePath(edition)}/record.yaml`;
const ownerCase = () => ({ id: 'case-1', date: '2026-10-14', source: 'owner', ruling: 'The sample applies in both editions.' });

/** A complete, isolated catalog. Each matrix fixture below breaks the link it proves. */
function completeCatalog() {
  return {
    catalog: { rules: [{
      id: 'R01', code: SAMPLE, law: 'The sample declares its coverage.', scope: 'runtime',
      kinds: ['check'], gates: ['runtime'], failureCodes: [SAMPLE], editions: [...EDITIONS],
      enforcers: [{ kind: 'runtime', id: 'sample', at: ENFORCER }], cases: [ownerCase()],
      docs: [DOC], proves: [SPEC],
      exemplifiedBy: [TEMPLATE, ...EDITIONS.map((edition) => ({ path: recordPath(edition), edition }))],
      witness: EDITIONS.map((edition) => ({
        edition, base: examplePath(edition),
        mutate: [{ op: 'edit', path: 'record.yaml', content: 'sample: invalid\n' }], expect: [SAMPLE],
      })),
    }] },
    manifest: { editions: [...EDITIONS], profiles: ['app'], slots: [{
      id: 'app.sample', profiles: ['app'], path: 'record.yaml', presence: 'required',
      tracked: 'tracked', rules: [SAMPLE], managedBy: 'sample',
    }] },
    files: new Map([
      [DOC, `Owner: Runtime\n\n${SAMPLE} describes the sample.\n`],
      [SPEC, sampleProof()],
      [ENFORCER, `export function sample(invalid) { return invalid ? [{ code: '${SAMPLE}' }] : []; }\n`],
      [TEMPLATE, 'sample: valid\n'],
      [RUNTIME_SLOTS, `ruleParams:\n  runtime:\n    selfChecks:\n      - {id: sample, run: ${ENFORCER}}\n`],
      ...EDITIONS.flatMap((edition) => [
        [`${examplePath(edition)}/hfs.json`, JSON.stringify({ hfs: 3, kind: 'app', project: 'sample', edition })],
        [recordPath(edition), 'sample: valid\n'],
      ]),
    ]),
    examples: EDITIONS.map((edition) => ({
      path: examplePath(edition), edition, files: [`${examplePath(edition)}/hfs.json`, recordPath(edition)],
    })),
    schemas: [],
    surfaces: [{ id: 'sample', editions: [...EDITIONS], rules: ['R01'], slots: ['app.sample'] }],
    requirements: [], rulings: null,
  };
}

function sampleProof() {
  const tests = EDITIONS.map((edition) => `test('invalid ${edition}', () => { assert.equal(sample(true)[0].code, '${SAMPLE}'); });\ntest('valid ${edition}', () => { assert.deepEqual(sample(false), []); });`).join('\n');
  return `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { sample } from '../../${ENFORCER}';\n// proves: ${SAMPLE}@lite ${SAMPLE}@full\n${tests}\n`;
}

/** One fixture catalog per R247 code; each has an invalid and a conforming form for both editions. */
const fixtureCatalogs = {
  RT_COVERAGE_NO_ENFORCER(edition, invalid) {
    const context = completeCatalog();
    if (invalid) ruleOf(context).enforcers = [{
      kind: 'runtime', id: 'sample', at: ENFORCER, editions: [otherEdition(edition)],
      editionWhy: 'The sample enforcer follows ruling:R01/case-1.',
    }];
    return context;
  },
  RT_COVERAGE_NO_SPEC(edition, invalid) {
    const context = completeCatalog();
    if (invalid) context.files.set(SPEC, `// proves: ${SAMPLE}@${otherEdition(edition)}\ntest('invalid', () => {});\ntest('valid', () => {});\n`);
    return context;
  },
  RT_COVERAGE_NO_WITNESS(edition, invalid) {
    const context = completeCatalog();
    if (invalid) ruleOf(context).witness = ruleOf(context).witness.filter((witness) => witness.edition !== edition);
    return context;
  },
  RT_COVERAGE_NO_DOC(edition, invalid) {
    const context = completeCatalog();
    ruleOf(context).docs = EDITIONS.map((entry) => ({ path: DOC, edition: entry }));
    if (invalid) ruleOf(context).docs = ruleOf(context).docs.filter((entry) => entry.edition !== edition);
    return context;
  },
  RT_COVERAGE_NO_TEMPLATE(_edition, invalid) {
    const context = completeCatalog();
    if (invalid) context.files.delete(TEMPLATE);
    return context;
  },
  RT_COVERAGE_NO_EXAMPLE(edition, invalid) {
    const context = completeCatalog();
    if (invalid) {
      context.files.delete(recordPath(edition));
      context.examples.find((entry) => entry.edition === edition).files = [`${examplePath(edition)}/hfs.json`];
    }
    return context;
  },
  RT_COVERAGE_PROOF_VACUOUS(edition, invalid) {
    const context = completeCatalog();
    const violating = `test('invalid ${edition}', () => { assert.equal(sample(true)[0].code, '${SAMPLE}'); });`;
    if (invalid) context.files.set(SPEC, context.files.get(SPEC).replace(violating, `test('invalid ${edition}', () => { const code = '${SAMPLE}'; });`));
    return context;
  },
  RT_COVERAGE_CODE_UNROUTED(_edition, invalid) {
    const context = completeCatalog();
    const machine = 'scripts/hfs/architecture/sample.mjs';
    context.files.set(machine, `export function sample() { return [{ ruleId: '${SAMPLE}' }]; }`);
    context.files.set('scripts/hfs/architecture/surface.mjs', `const BE = ['be'];\nconst enforcer = (id, plugins, codes) => ({id, plugins, codes});\nexport const LINT_ENFORCERS = [enforcer('sample', BE, ['${SAMPLE}'])];`);
    context.files.set('packages/eslint/be/index.mjs', invalid ? 'export const rules = {};' : `export const rules = {'sample': {create() { return {}; }}};`);
    context.files.set('packages/eslint/be/lib/why.mjs', `export const why = {'sample': {code: '${SAMPLE}'}};`);
    if (!invalid) {
      ruleOf(context).enforcers.push({kind: 'eslint-be', id: 'sample'});
      const run = "test(`valid and invalid ${edition}`, () => tester.run('sample', rules.sample, {valid: ['ok'], invalid: [{code: 'bad', errors: 1}]}));";
      context.files.set(SPEC, context.files.get(SPEC) + `import { RuleTester } from 'eslint';\nimport { rules } from '../../packages/eslint/be/index.mjs';\nconst tester = new RuleTester();\nfor (const edition of ['lite', 'full']) ${run}\n`);
    }
    return context;
  },
  RT_COVERAGE_EDITION_ASYMMETRY(edition, invalid) {
    const context = completeCatalog();
    ruleOf(context).editions = [edition];
    context.surfaces = EDITIONS.map((entry) => ({
      id: `sample-${entry}`, editions: [entry], rules: ['R01'], slots: ['app.sample'],
      ...(entry === edition ? {} : { gap: 'This rule belongs to the other edition.' }),
    }));
    if (!invalid) ruleOf(context).editionWhy = 'The scope follows ruling:R01/case-1.';
    return context;
  },
  RT_COVERAGE_SCHEMA_NO_RECORD(edition, invalid) {
    const context = completeCatalog();
    context.schemas = [{ path: 'modules/schemas/work-sample.schema.yaml', document: { type: 'object', properties: { schema: { const: 'work/sample@1' } } } }];
    // A lite record cannot satisfy the full Work schema inventory.
    context.files.set(`${examplePath('lite')}/.starciwork/sample.yaml`, 'schema: work/sample@1\nid: lite-sample\n');
    context.examples.find((entry) => entry.edition === 'lite').files.push(`${examplePath('lite')}/.starciwork/sample.yaml`);
    if (!invalid) {
      const record = `${examplePath('full')}/.starciwork/${edition}-sample.yaml`;
      context.files.set(record, 'schema: work/sample@1\nid: full-sample\n');
      context.examples.find((entry) => entry.edition === 'full').files.push(record);
    }
    return context;
  },
  RT_COVERAGE_GATE_LIE(_edition, invalid) {
    const context = completeCatalog();
    if (invalid) context.files.set(RUNTIME_SLOTS, 'ruleParams:\n  runtime:\n    selfChecks: []\n');
    return context;
  },
  RT_COVERAGE_SUPERSEDED_CITE(_edition, invalid) {
    const context = completeCatalog();
    ruleOf(context).cases = [
      { id: 'case-1', date: '2026-10-12', source: 'owner', ruling: 'The old sample.' },
      { id: 'case-2', date: '2026-10-14', source: 'owner', ruling: 'The current sample.', supersedes: 'case-1' },
    ];
    context.files.set(DOC, `Owner: Runtime\n\n${SAMPLE}: ruling:R01/case-1${invalid ? '' : '; ruling:R01/case-2'}.\n`);
    return context;
  },
  RT_COVERAGE_SURFACE_UNMAPPED(edition, invalid) {
    const context = completeCatalog();
    context.surfaces = EDITIONS.map((entry) => ({
      id: `sample-${entry}`, editions: [entry], rules: invalid && entry === edition ? ['R99'] : ['R01'], slots: ['app.sample'],
    }));
    return context;
  },
  RT_COVERAGE_REQUIREMENT_UNLEDGERED(edition, invalid) {
    const context = completeCatalog();
    const doc = `docs/${edition === 'lite' ? 'lite-edition' : 'application-stacks'}.md`;
    context.files.set(doc, '# Hosting\n\nThe application must use Swarm.\n');
    if (!invalid) context.requirements = [{ id: 'REQ-SAMPLE', doc: `${doc}#hosting`, status: 'enforced', rule: 'R01' }];
    return context;
  },
};

const reportOnly = new Set(['RT_COVERAGE_NO_WITNESS', 'RT_COVERAGE_NO_EXAMPLE']);
for (const [code, fixtureCatalog] of Object.entries(fixtureCatalogs)) {
  for (const edition of EDITIONS) {
    test(`${code} detects the violating ${edition} fixture catalog`, () => {
      const findings = hfsCoverageFindings(fixtureCatalog(edition, true));
      const failures = findings.filter((finding) => finding.code === code);
      assert.ok(failures.length > 0, JSON.stringify(findings));
      assert.ok(failures.every((finding) => finding.level === (reportOnly.has(code) ? 'warning' : 'error')), JSON.stringify(failures));
    });
    test(`${code} accepts the passing ${edition} fixture catalog`, () => {
      const findings = hfsCoverageFindings(fixtureCatalog(edition, false));
      assert.deepEqual(findings, [], JSON.stringify(findings));
    });
  }
}

for (const edition of EDITIONS) {
  test(`the legacy ${edition} ratchet reports metadata-free rules as backlog warnings`, () => {
    const context = completeCatalog();
    for (const key of ['editions', 'docs', 'exemplifiedBy', 'proves', 'witness']) delete ruleOf(context)[key];
    const findings = hfsCoverageFindings(context);
    assert.ok(findings.length > 0);
    assert.ok(findings.every((item) => item.level === 'warning' && item.legacy));
    const report = coverageReport(findings);
    assert.equal(report.ok, true);
    assert.equal(report.legacyBacklog.total, findings.length);
    assert.match(formatCoverageReport(report), /Legacy backlog:/);
    ruleOf(context).docs = [{path: DOC, edition}];
    assert.ok(hfsCoverageFindings(context).some((item) => item.level === 'error' && !item.legacy));
  });

  test(`new ${edition} rules gate missing fixture and witness evidence`, () => {
    const context = completeCatalog();
    ruleOf(context).id = 'R247';
    delete ruleOf(context).witness;
    ruleOf(context).exemplifiedBy = [TEMPLATE];
    const findings = hfsCoverageFindings(context).filter((item) => item.rule === 'R247' && item.edition === edition);
    for (const code of reportOnly) assert.ok(findings.some((item) => item.code === code && item.level === 'error'), code);
  });

  test(`dedicated ${edition} fixtures provide passing example and witness evidence`, () => {
    const context = completeCatalog();
    const fixture = `tests/fixtures/coverage/${edition}/record.yaml`;
    context.files.set(fixture, 'sample: valid\n');
    const evidence = {path: fixture, edition, codes: [SAMPLE]};
    ruleOf(context).exemplifiedBy = [TEMPLATE, evidence];
    ruleOf(context).witness = [evidence];
    const missing = () => hfsCoverageFindings(context).filter((item) => item.rule === 'R01' && reportOnly.has(item.code));
    assert.ok(!missing().some((item) => item.edition === edition));
    assert.ok(missing().some((item) => item.edition === otherEdition(edition)));
    context.files.delete(fixture);
    assert.ok(missing().some((item) => item.edition === edition));
  });

  test(`a ${edition} spec helper provides passing example and witness evidence`, () => {
    const context = completeCatalog();
    const evidence = {path: SPEC, edition, codes: [SAMPLE]};
    ruleOf(context).exemplifiedBy = [TEMPLATE, evidence];
    ruleOf(context).witness = [evidence];
    const relevant = () => hfsCoverageFindings(context).filter((item) => item.rule === 'R01' && item.edition === edition && reportOnly.has(item.code));
    assert.deepEqual(relevant(), []);
    context.files.set(SPEC, `// proves: ${SAMPLE}@${otherEdition(edition)}\n`);
    assert.equal(relevant().length, 2);
  });

  test(`an imported ${edition} helper supplies evidence only through a spec that uses it`, () => {
    const context = completeCatalog();
    const helper = 'tests/helpers/sample.mjs';
    context.files.set(helper, `import { sample } from '../../${ENFORCER}';\nexport function runSample(invalid) { return sample(invalid); }`);
    const direct = `import { sample } from '../../${ENFORCER}';`;
    const throughHelper = "import { runSample as sample } from '../helpers/sample.mjs';";
    context.files.set(SPEC, context.files.get(SPEC).replace(direct, throughHelper));
    const evidence = {path: helper, edition, codes: [SAMPLE]};
    ruleOf(context).exemplifiedBy = [TEMPLATE, evidence];
    ruleOf(context).witness = [evidence];
    const failures = () => hfsCoverageFindings(context).filter((item) => item.rule === 'R01' && item.edition === edition && reportOnly.has(item.code));
    assert.deepEqual(failures(), []);
    context.files.set(SPEC, context.files.get(SPEC).replace(throughHelper, direct));
    assert.equal(failures().length, 2, 'an unused helper import cannot stand in for fixture evidence');
  });

  test(`codeEditions checks only applicable ${edition} proof and documentation codes`, () => {
    const context = completeCatalog();
    ruleOf(context).failureCodes.push('RT_SAMPLE_DETAIL');
    ruleOf(context).codeEditions = {RT_SAMPLE_DETAIL: [otherEdition(edition)]};
    const findings = hfsCoverageFindings(context).filter((item) => /RT_SAMPLE_DETAIL/.test(item.message));
    assert.ok(findings.length > 0);
    assert.ok(findings.every((item) => item.edition === otherEdition(edition)));
  });

  test(`surface mappings cannot cite a code outside its ${edition} applicability`, () => {
    const context = completeCatalog();
    context.surfaces[0].rules = [SAMPLE];
    ruleOf(context).codeEditions = {[SAMPLE]: [otherEdition(edition)]};
    const failures = hfsCoverageFindings(context).filter((item) => item.code === 'RT_COVERAGE_SURFACE_UNMAPPED');
    assert.ok(failures.some((item) => item.edition === edition));
    assert.ok(!failures.some((item) => item.edition === otherEdition(edition)));
  });

  test(`runtime selfChecks truthfully gate runtime-scope ${edition} check enforcers`, () => {
    const context = completeCatalog();
    ruleOf(context).enforcers[0].kind = 'hfs';
    const gateFailures = () => hfsCoverageFindings(context).filter((item) => item.code === 'RT_COVERAGE_GATE_LIE' && item.edition === edition);
    assert.deepEqual(gateFailures(), []);
    delete ruleOf(context).scope;
    assert.equal(gateFailures().length, 1);
    ruleOf(context).scope = 'runtime';
    context.files.set(RUNTIME_SLOTS, 'ruleParams:\n  runtime:\n    selfChecks:\n      - {id: sample, run: scripts/checks/check-unrelated.mjs}\n');
    assert.equal(gateFailures().length, 1);
  });

  test(`runtime gate tracing refuses unused ${edition} imports and command mentions`, () => {
    const context = completeCatalog();
    const driver = 'scripts/hfs/runtime-check.mjs';
    context.files.set(RUNTIME_SLOTS, 'ruleParams:\n  runtime:\n    selfChecks: []\n');
    context.files.set('scripts/checks/check-runtime.mjs', "import { check } from '../hfs/runtime-check.mjs';\nexport function run() { return check(); }\n");
    context.files.set(driver, `import { sample } from '../checks/check-sample.mjs';\nexport function check() { return sample(true); }\n`);
    const failures = () => hfsCoverageFindings(context).filter((item) => item.code === 'RT_COVERAGE_GATE_LIE' && item.edition === edition);
    assert.deepEqual(failures(), []);
    context.files.set(driver, `import { sample } from '../checks/check-sample.mjs';\nexport function check() { return []; }\n`);
    assert.equal(failures().length, 1);
    context.files.set(driver, `import { sample } from '../checks/check-sample.mjs';\nfunction neverCalled() { return sample(true); }\nexport function check() { return []; }\n`);
    assert.equal(failures().length, 1, 'an uncalled helper cannot establish runtime gate coverage');
    context.files.set(RUNTIME_SLOTS, `ruleParams:\n  runtime:\n    selfChecks:\n      - {id: sample, run: ${ENFORCER}}\n`);
    ruleOf(context).gates = ['pre-push'];
    const hook = 'packages/hfs/templates/app/hooks/husky/pre-push';
    for (const command of [`echo node ${ENFORCER}`, `node --check ${ENFORCER}`, 'starci runtime check --only unrelated']) {
      context.files.set(hook, command);
      assert.equal(failures().length, 1, command);
    }
    context.files.set(hook, 'starci runtime check --only sample');
    assert.deepEqual(failures(), []);
  });

  test(`RT_COVERAGE_PROOF_VACUOUS refuses empty ${edition} RuleTester cases`, () => {
    for (const empty of ["valid: []", "invalid: []"]) {
      const context = fixtureCatalogs.RT_COVERAGE_CODE_UNROUTED(edition, false);
      const text = context.files.get(SPEC);
      const source = empty.startsWith('valid') ? "valid: ['ok']" : "invalid: [{code: 'bad', errors: 1}]";
      context.files.set(SPEC, text.replace(source, empty));
      assert.ok(hfsCoverageFindings(context).some((item) => item.code === 'RT_COVERAGE_PROOF_VACUOUS' && item.edition === edition), empty);
    }
  });

  test(`RT_COVERAGE_PROOF_VACUOUS requires each ${edition} enforcer sharing a code to be exercised`, () => {
    const context = completeCatalog();
    const second = 'scripts/checks/check-sample-detail.mjs';
    context.files.set(second, `export function detail(invalid) { return invalid ? [{ code: '${SAMPLE}' }] : []; }`);
    ruleOf(context).enforcers.push({kind: 'runtime', id: 'sample-detail', at: second});
    const failures = () => hfsCoverageFindings(context).filter((item) => item.code === 'RT_COVERAGE_PROOF_VACUOUS' && item.edition === edition);
    assert.equal(failures().length, 1);
    const passing = `test('valid ${edition} detail', () => { assert.deepEqual(detail(false), []); });`;
    const violating = `test('invalid ${edition} detail', () => { assert.equal(detail(true)[0].code, '${SAMPLE}'); });`;
    context.files.set(SPEC, context.files.get(SPEC) + `import { detail } from '../../${second}';\n${passing}\n${violating}\n`);
    assert.deepEqual(failures(), []);
  });

  test(`RT_COVERAGE_PROOF_VACUOUS distinguishes ${edition} enforcers in the same source file`, () => {
    const context = completeCatalog();
    context.files.set(ENFORCER, context.files.get(ENFORCER) + `export function sampleDetail(invalid) { return invalid ? [{code: '${SAMPLE}'}] : []; }`);
    ruleOf(context).enforcers.push({kind: 'runtime', id: 'sample-detail', at: ENFORCER});
    const failures = () => hfsCoverageFindings(context).filter((item) => item.code === 'RT_COVERAGE_PROOF_VACUOUS' && item.edition === edition);
    assert.equal(failures().length, 1);
    const passing = `test('valid ${edition} detail', () => { assert.deepEqual(sampleDetail(false), []); });`;
    const violating = `test('invalid ${edition} detail', () => { assert.equal(sampleDetail(true)[0].code, '${SAMPLE}'); });`;
    context.files.set(SPEC, context.files.get(SPEC) + `import { sampleDetail } from '../../${ENFORCER}';\n${passing}\n${violating}\n`);
    assert.deepEqual(failures(), []);
  });

  test(`RT_COVERAGE_PROOF_VACUOUS requires the ${edition} violation assertion to name its claimed code`, () => {
    const context = completeCatalog();
    const detail = 'RT_SAMPLE_DETAIL';
    ruleOf(context).failureCodes.push(detail);
    context.files.set(ENFORCER, `export function sample(mode) { if (mode === 'detail') return [{code: '${detail}'}]; return mode ? [{code: '${SAMPLE}'}] : []; }`);
    context.files.set(SPEC, context.files.get(SPEC) + `// proves: ${detail}@${edition}\n`);
    const failures = () => hfsCoverageFindings(context).filter((item) => item.code === 'RT_COVERAGE_PROOF_VACUOUS' && item.edition === edition && item.message.includes(detail));
    assert.equal(failures().length, 1);
    const violating = `test('invalid ${edition}', () => { assert.equal(sample(true)[0].code, '${SAMPLE}'); });`;
    const detailTest = `test('invalid ${edition} detail', () => { assert.equal(sample('detail')[0].code, '${detail}'); });`;
    context.files.set(SPEC, context.files.get(SPEC).replace(violating, violating + '\n' + detailTest));
    assert.deepEqual(failures(), []);
  });

  test(`RT_COVERAGE_CODE_UNROUTED respects the ${edition} plugin and code edition`, () => {
    const context = fixtureCatalogs.RT_COVERAGE_CODE_UNROUTED(edition, false);
    const lint = ruleOf(context).enforcers.find((entry) => entry.kind === 'eslint-be');
    lint.editions = [otherEdition(edition)];
    lint.editionWhy = 'This fixture follows ruling:R01/case-1.';
    const failures = () => hfsCoverageFindings(context).filter((item) => item.code === 'RT_COVERAGE_CODE_UNROUTED');
    assert.ok(failures().some((item) => item.edition === edition));
    assert.ok(!failures().some((item) => item.edition === otherEdition(edition)));
    ruleOf(context).codeEditions = {[SAMPLE]: [otherEdition(edition)]};
    assert.deepEqual(failures(), []);
  });

  test(`RT_COVERAGE_CODE_UNROUTED traces ${edition} profile exports in a shared machine file`, () => {
    const context = fixtureCatalogs.RT_COVERAGE_CODE_UNROUTED(edition, false);
    const machine = 'scripts/hfs/architecture/sample.mjs';
    context.files.set(machine, `export function checkBackend() { return [{ruleId: '${SAMPLE}'}]; }\nexport function checkFrontend() { return []; }`);
    context.files.set('scripts/hfs/architecture/index.mjs', "import { checkBackend, checkFrontend } from './sample.mjs';\nconst BACKEND_MACHINE = {sample: checkBackend};\nconst FRONTEND_MACHINE = {sample: checkFrontend};");
    ruleOf(context).enforcers.push({kind: 'machine', id: 'sample-machine', at: machine});
    const failures = () => hfsCoverageFindings(context).filter((item) => item.code === 'RT_COVERAGE_CODE_UNROUTED' && item.edition === edition);
    assert.deepEqual(failures(), []);
    context.files.set(machine, `export function checkBackend() { return []; }\nexport function checkFrontend() { return [{ruleId: '${SAMPLE}'}]; }`);
    assert.ok(failures().some((item) => item.message.includes('fe lint plugin')));
  });
}

test('RT_COVERAGE_NO_SPEC checks every failure code in each edition, rather than only the primary code', () => {
  const context = completeCatalog();
  ruleOf(context).failureCodes.push('RT_SAMPLE_DETAIL');
  context.files.set(ENFORCER, `export const codes = ['${SAMPLE}', 'RT_SAMPLE_DETAIL'];\n`);
  context.files.set(DOC, `Owner: Runtime\n\n${SAMPLE} and RT_SAMPLE_DETAIL describe the sample.\n`);
  context.files.set(SPEC, `${context.files.get(SPEC)}// proves: RT_SAMPLE_DETAIL@full\n`);
  const findings = hfsCoverageFindings(context).filter((finding) => finding.code === 'RT_COVERAGE_NO_SPEC');
  assert.equal(findings.length, 1, JSON.stringify(findings));
  assert.equal(findings[0].edition, 'lite');
  assert.match(findings[0].message, /RT_SAMPLE_DETAIL/);
  context.files.set(SPEC, `${context.files.get(SPEC)}// proves: RT_SAMPLE_DETAIL@lite\n`);
  assert.ok(!hfsCoverageFindings(context).some((finding) => finding.code === 'RT_COVERAGE_NO_SPEC'));
});

test('RT_COVERAGE_NO_SPEC refuses a proof header with no violating and passing tests', () => {
  const context = completeCatalog();
  context.files.set(SPEC, `// proves: ${SAMPLE}@lite ${SAMPLE}@full\n`);
  const findings = hfsCoverageFindings(context).filter((finding) => finding.code === 'RT_COVERAGE_NO_SPEC');
  const byEdition = (left, right) => left.localeCompare(right);
  assert.deepEqual(findings.map((finding) => finding.edition).sort(byEdition), [...EDITIONS].sort(byEdition));
});

test('RT_COVERAGE_NO_ENFORCER refuses a planned, absent or silent enforcer file', () => {
  for (const failure of ['planned', 'absent', 'silent']) {
    const context = completeCatalog();
    if (failure === 'planned') ruleOf(context).enforcers[0].status = 'planned';
    if (failure === 'absent') context.files.delete(ENFORCER);
    if (failure === 'silent') context.files.set(ENFORCER, 'export const codes = [];\n');
    assert.ok(hfsCoverageFindings(context).some((finding) => finding.code === 'RT_COVERAGE_NO_ENFORCER'), failure);
  }
});

test('RT_COVERAGE_NO_DOC requires the declared anchor and code in the owning document', () => {
  const context = completeCatalog();
  ruleOf(context).docs = [`${DOC}#sample`];
  context.files.set(DOC, `Owner: Runtime\n\n# Other\n\n${SAMPLE}.\n`);
  assert.ok(hfsCoverageFindings(context).some((finding) => finding.code === 'RT_COVERAGE_NO_DOC'));
  context.files.set(DOC, 'Owner: Runtime\n\n# Sample\n\nNo rule is mentioned here.\n');
  assert.ok(hfsCoverageFindings(context).some((finding) => finding.code === 'RT_COVERAGE_NO_DOC'));
  context.files.set(DOC, `Owner: Runtime\n\n# Sample\n\n${SAMPLE}.\n`);
  assert.ok(!hfsCoverageFindings(context).some((finding) => finding.code === 'RT_COVERAGE_NO_DOC'));
});

test('RT_COVERAGE_NO_WITNESS accepts a dated unreachable reason', () => {
  const context = completeCatalog();
  ruleOf(context).witness = { status: 'unreachable', reason: 'A runtime catalog rule cannot be tripped by editing an app.', date: '2026-10-14' };
  assert.ok(!hfsCoverageFindings(context).some((finding) => finding.code === 'RT_COVERAGE_NO_WITNESS'));
});

test('RT_COVERAGE_EDITION_ASYMMETRY requires a ruling citation that actually resolves', () => {
  const context = fixtureCatalogs.RT_COVERAGE_EDITION_ASYMMETRY('lite', false);
  ruleOf(context).editionWhy = 'This sample is smaller.';
  assert.ok(hfsCoverageFindings(context).some((finding) => finding.code === 'RT_COVERAGE_EDITION_ASYMMETRY'));
  ruleOf(context).editionWhy = 'The scope follows ruling:R01/case-99.';
  assert.ok(hfsCoverageFindings(context).some((finding) => finding.code === 'RT_COVERAGE_EDITION_ASYMMETRY'));
});

test('RT_COVERAGE_SCHEMA_NO_RECORD exempts a generated Work schema', () => {
  const context = fixtureCatalogs.RT_COVERAGE_SCHEMA_NO_RECORD('full', true);
  context.schemas[0].document.generated = true;
  assert.ok(!hfsCoverageFindings(context).some((finding) => finding.code === 'RT_COVERAGE_SCHEMA_NO_RECORD'));
});

test('RT_COVERAGE_GATE_LIE does not count a commented hook command as enforcement', () => {
  const context = completeCatalog();
  ruleOf(context).gates.push('pre-push');
  const hook = 'packages/hfs/templates/app/hooks/husky/pre-push';
  context.files.set(hook, `# node ${ENFORCER}\n`);
  assert.ok(hfsCoverageFindings(context).some((finding) => finding.code === 'RT_COVERAGE_GATE_LIE'));
  context.files.set(hook, `node ${ENFORCER}\n`);
  assert.ok(!hfsCoverageFindings(context).some((finding) => finding.code === 'RT_COVERAGE_GATE_LIE'));
});

for (const edition of EDITIONS) {
  test(`RT_COVERAGE_GATE_LIE requires an enabled ${edition} CI run step`, () => {
    const context = completeCatalog();
    ruleOf(context).gates.push('ci');
    for (const entry of EDITIONS) {
      const group = entry === 'lite' ? 'ci-workflows-lite' : 'ci-workflows';
      context.files.set(`packages/hfs/templates/app/${group}/github/workflows/ci.yml`, `jobs:\n  check:\n    steps:\n      - run: node ${ENFORCER}\n${entry === edition ? '        if: false\n' : ''}`);
    }
    const failures = hfsCoverageFindings(context).filter((finding) => finding.code === 'RT_COVERAGE_GATE_LIE');
    assert.equal(failures.length, 1, JSON.stringify(failures));
    assert.equal(failures[0].edition, edition);
    const group = edition === 'lite' ? 'ci-workflows-lite' : 'ci-workflows';
    context.files.set(`packages/hfs/templates/app/${group}/github/workflows/ci.yml`, `jobs:\n  check:\n    steps:\n      - run: node ${ENFORCER}\n`);
    assert.ok(!hfsCoverageFindings(context).some((finding) => finding.code === 'RT_COVERAGE_GATE_LIE'));
  });
}

test('RT_COVERAGE_SUPERSEDED_CITE requires the successor in the same paragraph', () => {
  const context = fixtureCatalogs.RT_COVERAGE_SUPERSEDED_CITE('lite', false);
  context.files.set(DOC, `${SAMPLE}: ruling:R01/case-1.\n\nruling:R01/case-2.\n`);
  assert.ok(hfsCoverageFindings(context).some((finding) => finding.code === 'RT_COVERAGE_SUPERSEDED_CITE'));
});

test('RT_COVERAGE_SUPERSEDED_CITE scans staleWhen phrases while exempting CHANGELOG history', () => {
  const context = completeCatalog();
  ruleOf(context).cases[0].staleWhen = ['Supabase Realtime'];
  context.files.set('CHANGELOG.md', 'Supabase Realtime used to be supported.\n');
  assert.ok(!hfsCoverageFindings(context).some((finding) => finding.code === 'RT_COVERAGE_SUPERSEDED_CITE'));
  context.files.set(DOC, `${SAMPLE}: Supabase Realtime is available.\n`);
  assert.ok(hfsCoverageFindings(context).some((finding) => finding.code === 'RT_COVERAGE_SUPERSEDED_CITE'));
});

test('RT_COVERAGE_SURFACE_UNMAPPED accepts an explicit gap reason', () => {
  const context = fixtureCatalogs.RT_COVERAGE_SURFACE_UNMAPPED('lite', true);
  context.surfaces.find((surface) => surface.editions.includes('lite')).gap = 'The owner has deferred this surface.';
  assert.ok(!hfsCoverageFindings(context).some((finding) => finding.code === 'RT_COVERAGE_SURFACE_UNMAPPED'));
});

test('RT_COVERAGE_REQUIREMENT_UNLEDGERED accepts a rule doc anchor as a ledger link', () => {
  const context = fixtureCatalogs.RT_COVERAGE_REQUIREMENT_UNLEDGERED('lite', true);
  ruleOf(context).docs.push('docs/lite-edition.md#hosting');
  assert.ok(!hfsCoverageFindings(context).some((finding) => finding.code === 'RT_COVERAGE_REQUIREMENT_UNLEDGERED'));
});

const root = path.resolve(import.meta.dirname, '..', '..');
const header = parseYaml(fs.readFileSync(path.join(root, 'knowledge/hfs/rules.yaml'), 'utf8'));
const Ajv2020 = (() => { const loaded = createRequire(import.meta.url)('ajv/dist/2020.js'); return loaded.default ?? loaded; })();
const validateCatalog = new Ajv2020({ strict: false, allErrors: true, logger: false }).compile(parseYaml(fs.readFileSync(path.join(root, 'modules/schemas/hfs-rules.schema.yaml'), 'utf8')));

function metadataCatalog() {
  const rule = ruleOf(completeCatalog());
  rule.gates = ['land', 'runtime'];
  rule.editionWhy = 'The editions follow ruling:R01/case-1.';
  rule.enforcers[0].editionWhy = 'The enforcer follows ruling:R01/case-1.';
  rule.cases[0] = { ...ownerCase(), supersedes: ['case-2'], status: 'amended', staleWhen: ['old sample'], amendedBy: 'ruling:R01/case-3' };
  return { schema: header.schema, version: header.version, gates: header.gates, enforcerKinds: header.enforcerKinds, rules: [rule] };
}

test('coverage metadata remains optional for existing rule catalogs', () => {
  const catalog = metadataCatalog();
  for (const field of ['docs', 'exemplifiedBy', 'proves', 'witness', 'editionWhy']) delete catalog.rules[0][field];
  delete catalog.rules[0].enforcers[0].editionWhy;
  catalog.rules[0].cases = [ownerCase()];
  assert.equal(validateCatalog(catalog), true, JSON.stringify(validateCatalog.errors));
  assert.doesNotThrow(() => loadRuleCatalog({ text: JSON.stringify(catalog) }));
});

test('the schema and loader accept coverage refs, witnesses and ruling lifecycle fields', () => {
  const catalog = metadataCatalog();
  catalog.rules[0].docs = [`${DOC}#sample`, { path: DOC, editions: ['lite', 'full'] }];
  catalog.rules[0].proves = [{ path: SPEC, edition: 'lite', codes: [SAMPLE], fixtures: ['invalid', 'valid'] }];
  assert.equal(validateCatalog(catalog), true, JSON.stringify(validateCatalog.errors));
  const loaded = loadRuleCatalog({ text: JSON.stringify(catalog) });
  assert.deepEqual(loaded.rule('R01').witness[0].expect, [SAMPLE]);
  assert.ok(Object.isFrozen(loaded.rule('R01').witness[0].mutate));
  catalog.rules[0].witness = { status: 'unreachable', reason: 'This rule checks the runtime catalog.', date: '2026-10-14' };
  assert.equal(validateCatalog(catalog), true, JSON.stringify(validateCatalog.errors));
  assert.doesNotThrow(() => loadRuleCatalog({ text: JSON.stringify(catalog) }));
});

test('the schema and loader reject malformed optional coverage metadata', () => {
  const mutations = {
    'unsafe doc path': (rule) => { rule.docs = ['../escape.md']; },
    'unknown reference key': (rule) => { rule.docs = [{ path: DOC, reason: 'unknown' }]; },
    'ambiguous reference editions': (rule) => { rule.proves = [{ path: SPEC, edition: 'lite', editions: ['full'] }]; },
    'unknown reference edition': (rule) => { rule.exemplifiedBy = [{ path: TEMPLATE, edition: 'small' }]; },
    'edit mutation without content': (rule) => { delete rule.witness[0].mutate[0].content; },
    'delete mutation with content': (rule) => { rule.witness[0].mutate[0].op = 'delete'; },
    'unreachable without reason': (rule) => { rule.witness = { status: 'unreachable', date: '2026-10-14' }; },
  };
  for (const [label, mutate] of Object.entries(mutations)) {
    const catalog = metadataCatalog();
    mutate(catalog.rules[0]);
    assert.equal(validateCatalog(catalog), false, `${label}: schema accepted invalid metadata`);
    assert.throws(() => loadRuleCatalog({ text: JSON.stringify(catalog) }), (error) => error.code === 'HFS_RULES_INVALID', label);
  }
  for (const mutate of [
    (rule) => { rule.witness = { status: 'unreachable', reason: 'Catalog rule.', date: '2026-02-31' }; },
    (rule) => { rule.cases[0].staleWhen = ['[']; },
  ]) {
    const catalog = metadataCatalog();
    mutate(catalog.rules[0]);
    assert.throws(() => loadRuleCatalog({ text: JSON.stringify(catalog) }), (error) => error.code === 'HFS_RULES_INVALID');
  }
});

test('check-hfs-rules detects an edition without an enforcer and respects justified rule scope', () => {
  const context = completeCatalog();
  ruleOf(context).enforcers[0].editions = ['full'];
  const findingContext = {
    catalog: context.catalog, plugins: {},
    failureCodes: { [SAMPLE]: { title_vi: 'Tiêu đề', meaning_vi: 'Ý nghĩa của lỗi', nextStep_vi: 'Bước tiếp theo' } },
    files: { exists: (file) => context.files.has(file), read: (file) => context.files.get(file) },
  };
  assert.ok(hfsRulesFindings(findingContext).some((finding) => finding.code === 'HFS_RULE_NO_ENFORCER' && /lite/.test(finding.message)));
  ruleOf(context).editions = ['full'];
  assert.ok(!hfsRulesFindings(findingContext).some((finding) => finding.code === 'HFS_RULE_NO_ENFORCER'));
});

test('coverage reports keep only NO_WITNESS and NO_EXAMPLE findings as warnings', () => {
  const warnings = [
    ...hfsCoverageFindings(fixtureCatalogs.RT_COVERAGE_NO_WITNESS('lite', true)),
    ...hfsCoverageFindings(fixtureCatalogs.RT_COVERAGE_NO_EXAMPLE('full', true)),
  ];
  const report = coverageReport(warnings, { rules: 1, slots: 1 });
  assert.equal(report.ok, true);
  assert.equal(report.errors, 0);
  assert.ok(report.warnings > 0);
  assert.ok(report.findings.every((finding) => reportOnly.has(finding.code)));
  const failing = coverageReport([...warnings, ...hfsCoverageFindings(fixtureCatalogs.RT_COVERAGE_NO_DOC('lite', true))]);
  assert.equal(failing.ok, false);
  assert.ok(failing.errors > 0);
  assert.match(formatCoverageReport(failing), /ERROR RT_COVERAGE_NO_DOC/);
  assert.match(formatCoverageReport(report), /WARNING RT_COVERAGE_NO_WITNESS/);
  assert.equal(formatCoverageReport({ refusal: { code: 'HFS_RULES_INVALID', message: 'Invalid fixture.' } }), 'HFS_RULES_INVALID: Invalid fixture.\n');
});

function tempFixture(t) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-coverage-spec-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const fixtureRoot = path.join(temporary, 'source');
  const scratch = path.join(temporary, 'scratch');
  fs.mkdirSync(fixtureRoot);
  fs.mkdirSync(scratch);
  const write = (relative, text) => {
    const file = path.join(fixtureRoot, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  };
  return { fixtureRoot, scratch, write };
}

test('the coverage context loader inventories authored sources and excludes custody and generated copies', (t) => {
  const { fixtureRoot, write } = tempFixture(t);
  write('knowledge/hfs/slots.yaml', fs.readFileSync(path.join(root, 'knowledge/hfs/slots.yaml'), 'utf8'));
  write('knowledge/hfs/rules.yaml', JSON.stringify(metadataCatalog()));
  write(DOC, `${SAMPLE}.\n`);
  write(SPEC, `// proves: ${SAMPLE}@lite ${SAMPLE}@full\n`);
  write('examples/lite-app/hfs.json', JSON.stringify({ hfs: 3, kind: 'app', edition: 'lite' }));
  write('examples/lite-app/record.yaml', 'sample: valid\n');
  const excluded = [
    'examples/lite-app/.env', 'examples/lite-app/.claude/secret.env',
    'examples/lite-app/.starcistacks/production/secrets/sample.enc',
    'packages/hfs/runtime/copied.mjs', 'packages/example/dist/generated.mjs',
  ];
  for (const file of excluded) write(file, 'fixture-marker\n');
  const context = loadCoverageContext(fixtureRoot);
  assert.equal(context.catalog.rules.length, 1);
  assert.ok(context.files.has(DOC));
  assert.ok(context.files.has(SPEC), 'authored tests are part of the proof inventory');
  assert.deepEqual(context.examples.map((example) => [example.path, example.edition]), [['examples/lite-app', 'lite']]);
  for (const file of excluded) assert.ok(!context.files.has(file), file);
});

function witnessFixture(t, edition, mutation) {
  const { fixtureRoot, scratch, write } = tempFixture(t);
  write(`${examplePath(edition)}/hfs.json`, JSON.stringify({ hfs: 3, kind: 'app', project: 'sample', edition }));
  write(recordPath(edition), 'sample: valid\n');
  const rule = ruleOf(completeCatalog());
  rule.witness = [{ edition, base: examplePath(edition), mutate: [mutation], expect: [SAMPLE] }];
  return { context: { root: fixtureRoot, catalog: { rules: [rule] } }, scratch, write };
}

function sampleWitnessJudge({ repoRoot }) {
  const record = path.join(repoRoot, 'record.yaml');
  const invalid = !fs.existsSync(record) || fs.readFileSync(record, 'utf8') !== 'sample: valid\n'
    || fs.existsSync(path.join(repoRoot, 'invalid.yaml'));
  return { findings: invalid ? [{ code: SAMPLE }] : [] };
}

for (const edition of EDITIONS) {
  test(`the ${edition} witness runner accepts dedicated fixture evidence without allocating a mutation`, async (t) => {
    const {fixtureRoot, scratch, write} = tempFixture(t);
    const fixture = `tests/fixtures/coverage/${edition}/record.yaml`;
    write(fixture, 'sample: valid\n');
    const rule = ruleOf(completeCatalog());
    rule.witness = [{path: fixture, edition, codes: [SAMPLE]}];
    const context = {root: fixtureRoot, catalog: {rules: [rule]}};
    const deps = {tempRoot: scratch, judge: () => { throw new Error('Fixture references must not run a mutation judge.'); }};
    assert.deepEqual(await runCoverageWitnesses(context, deps), []);
    assert.deepEqual(fs.readdirSync(scratch), []);
    rule.witness[0].path = 'tests/fixtures/coverage/missing.yaml';
    assert.ok((await runCoverageWitnesses(context, deps)).some((item) => item.code === 'RT_COVERAGE_NO_WITNESS'));
  });
}

for (const edition of EDITIONS) {
  for (const mutation of [
    { op: 'add', path: 'invalid.yaml', content: 'sample: invalid\n' },
    { op: 'edit', path: 'record.yaml', content: 'sample: invalid\n' },
    { op: 'delete', path: 'record.yaml' },
  ]) {
    test(`the ${edition} witness runner proves an ${mutation.op} mutation and cleans its temporary copy`, async (t) => {
      const { context, scratch } = witnessFixture(t, edition, mutation);
      assert.deepEqual(await runCoverageWitnesses(context, { judge: sampleWitnessJudge, tempRoot: scratch }), []);
      assert.deepEqual(fs.readdirSync(scratch), []);
      assert.equal(fs.readFileSync(path.join(context.root, recordPath(edition)), 'utf8'), 'sample: valid\n');
    });
  }
}

test('RT_COVERAGE_NO_WITNESS reports a mutation that fails to trigger its expected code', async (t) => {
  const { context, scratch } = witnessFixture(t, 'lite', { op: 'edit', path: 'record.yaml', content: 'sample: valid\n' });
  const findings = await runCoverageWitnesses(context, { judge: sampleWitnessJudge, tempRoot: scratch });
  assert.ok(findings.some((finding) => finding.code === 'RT_COVERAGE_NO_WITNESS' && finding.level === 'warning'));
  assert.deepEqual(fs.readdirSync(scratch), []);
});

test('RT_COVERAGE_NO_WITNESS rejects a baseline that already emits the expected code', async (t) => {
  const { context, scratch, write } = witnessFixture(t, 'full', { op: 'edit', path: 'record.yaml', content: 'sample: invalid\n' });
  write(recordPath('full'), 'sample: invalid\n');
  let calls = 0;
  const findings = await runCoverageWitnesses(context, { tempRoot: scratch, judge: (input) => { calls += 1; return sampleWitnessJudge(input); } });
  assert.ok(findings.some((finding) => finding.code === 'RT_COVERAGE_NO_WITNESS'));
  assert.equal(calls, 1, 'a failing baseline cannot certify a mutation');
  assert.deepEqual(fs.readdirSync(scratch), []);
});

for (const unsafe of ['../escape.yaml', '/escape.yaml', '.claude/secret.env', '.starcistacks/production/secrets/sample.enc']) {
  test(`RT_COVERAGE_NO_WITNESS rejects ${unsafe} before judging`, async (t) => {
    const { context, scratch } = witnessFixture(t, 'lite', { op: 'add', path: unsafe, content: 'fixture-marker\n' });
    let calls = 0;
    const findings = await runCoverageWitnesses(context, { tempRoot: scratch, judge: () => { calls += 1; return { findings: [] }; } });
    assert.ok(findings.some((finding) => finding.code === 'RT_COVERAGE_NO_WITNESS'), unsafe);
    assert.equal(calls, 0, unsafe);
    assert.deepEqual(fs.readdirSync(scratch), []);
  });
}

test('RT_COVERAGE_NO_WITNESS refuses a symbolic link used as its example base', async (t) => {
  const { context, scratch } = witnessFixture(t, 'lite', { op: 'edit', path: 'record.yaml', content: 'sample: invalid\n' });
  const original = path.join(context.root, examplePath('lite'));
  const alias = path.join(context.root, 'examples', 'alias-app');
  try { fs.symlinkSync(original, alias, process.platform === 'win32' ? 'junction' : 'dir'); } catch (error) {
    if (error.code === 'EPERM' || error.code === 'EACCES') { t.skip('The host does not permit test symbolic links.'); return; }
    throw error;
  }
  ruleOf(context).witness[0].base = 'examples/alias-app';
  let calls = 0;
  const findings = await runCoverageWitnesses(context, { tempRoot: scratch, judge: () => { calls += 1; return { findings: [] }; } });
  assert.ok(findings.some((finding) => finding.code === 'RT_COVERAGE_NO_WITNESS'));
  assert.equal(calls, 0);
  assert.deepEqual(fs.readdirSync(scratch), []);
  assert.equal(fs.readFileSync(path.join(original, 'record.yaml'), 'utf8'), 'sample: valid\n');
});
