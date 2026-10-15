import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { coverageGateFindings } from '../../scripts/checks/lib/coverage-gates.mjs';
import { workflowRunCommands } from '../../scripts/checks/lib/coverage-workflows.mjs';
import { loadRuleCatalog } from '../../scripts/hfs/rule-catalog.mjs';
import { ciWorkflowCommands } from '../../packages/hfs/sync/ci-commands.mjs';

// proves: RT_COVERAGE_GATE_LIE@lite RT_COVERAGE_GATE_LIE@full
const EDITIONS = ['lite', 'full'];
const GATE = 'scripts/gates/gate.mjs';
const CONTENT = 'scripts/hfs/rules/sample.mjs';
const MACHINE = 'scripts/hfs/architecture/sample.mjs';
const STACKS = 'scripts/gates/stacks-gate.mjs';
const RUNTIME = 'scripts/checks/check-sample.mjs';
const CI_GROUP = (edition) => edition === 'lite' ? 'ci-workflows-lite' : 'ci-workflows';
const CI = (edition) => `packages/hfs/templates/app/${CI_GROUP(edition)}/github/workflows/ci.yml`;

function contextFor(kind, gates, at = kind === 'hfs' ? CONTENT : MACHINE) {
  const rule = {
    id: 'R01', code: 'SAMPLE_GATE', law: 'The sample runs at its declared gates.',
    kinds: ['check'], gates, failureCodes: ['SAMPLE_GATE'], editions: [...EDITIONS],
    enforcers: [{ kind, id: 'sample', at }],
  };
  return { catalog: { rules: [rule] }, files: new Map([[at, 'export function sample() {}']]) };
}

const findings = (context, edition) => coverageGateFindings(context, context.catalog.rules[0], edition);
const appSource = (verb) => `export function runGate() { runNode([hfs.bin, 'app', '${verb}', '--format', 'json']); }`;

function workflow(command, condition = '', jobCondition = '') {
  return [
    '{{header}}', 'name: ci', 'on: workflow_dispatch',
    'jobs:', '  ci:', '    runs-on: ubuntu-latest',
    ...jobCondition ? [`    if: ${jobCondition}`] : [],
    '    steps:', '      - uses: actions/setup-node@pinned',
    '        with:', '          node-version: {{nodeMajor}}',
    '      - name: quality',
    ...condition ? [`        if: ${condition}`] : [],
    `        run: ${command}`, '{{> app/ci-workflows/sonar-steps.yml}}',
    '  after:', '    runs-on: ubuntu-latest', '    steps:', '      - run: npm run typecheck',
  ].join('\n');
}

for (const edition of EDITIONS) {
  for (const [kind, command] of [
    ['eslint-be', 'eslint be/src'], ['eslint-fe', 'eslint fe/src'],
    ['stylelint', 'stylelint styles.css'], ['work-validate', 'starci work validate'],
    ['sonar', 'sonar-scanner'], ['runtime', `node ${RUNTIME}`],
  ]) {
    test(`reachable process strings preserve ${kind} land and settle tracing in ${edition}`, () => {
      const context = contextFor(kind, ['land', 'settle'], RUNTIME);
      context.files.set(GATE, `function execute() { execSync('${command}'); } export function runGate() { execute(); }`);
      assert.deepEqual(findings(context, edition), []);
      context.files.set(GATE, `function execute() { execSync('${command}'); } export function runGate() {}`);
      assert.equal(findings(context, edition)[0].code, 'RT_COVERAGE_GATE_LIE');
    });
  }

  for (const kind of ['hfs', 'machine']) {
    test(`app lint and check trace ${kind} enforcers through land and settle in ${edition}`, () => {
      const context = contextFor(kind, ['land', 'settle']);
      for (const verb of ['lint', 'check']) {
        context.files.set(GATE, appSource(verb));
        assert.deepEqual(findings(context, edition), []);
      }
      context.files.set(GATE, appSource('explain'));
      const failed = findings(context, edition);
      assert.equal(failed.length, 2);
      assert.ok(failed.every((finding) => finding.code === 'RT_COVERAGE_GATE_LIE'));
      context.files.set(GATE, '// starci app lint\nexport function runGate() {}');
      assert.equal(findings(context, edition).length, 2);
      context.files.set(GATE, "export function runGate() { memoize([hfs.bin, 'app', 'lint']); }");
      assert.equal(findings(context, edition).length, 2);
      context.files.set(GATE, "function unused() { runNode([hfs.bin, 'app', 'lint']); } export function runGate() {}");
      assert.equal(findings(context, edition).length, 2);
      context.files.set(GATE, "const mention = 'starci app lint'; export function runGate() {}");
      assert.equal(findings(context, edition).length, 2);
      context.files.set(GATE, "function unused() { execSync('starci app lint'); } export function runGate() {}");
      assert.equal(findings(context, edition).length, 2);
      context.files.set(GATE, "export function runGate() { execSync('echo starci app lint'); }");
      assert.equal(findings(context, edition).length, 2);
      context.files.set(GATE, "export function runGate() { execSync('starci app lint'); }");
      assert.deepEqual(findings(context, edition), []);
      context.files.set(GATE, "function lint() { runNode([hfs.bin, 'app', 'lint']); } export function runGate() { lint(); }");
      assert.deepEqual(findings(context, edition), []);
    });

    test(`the actual land and settle implementation traces ${kind} lint coverage in ${edition}`, () => {
      const context = contextFor(kind, ['land', 'settle']);
      context.files.set(GATE, fs.readFileSync(new URL(`../../${GATE}`, import.meta.url), 'utf8'));
      assert.deepEqual(findings(context, edition), []);
    });

    test(`CI Mustache partials allow npm lint and check to trace ${kind} in ${edition}`, () => {
      const context = contextFor(kind, ['ci']);
      for (const script of ['lint', 'check']) {
        context.files.set(CI(edition), workflow(`npm run ${script}`));
        assert.deepEqual(findings(context, edition), []);
      }
      context.files.set(CI(edition), workflow('npm run lint:other'));
      assert.equal(findings(context, edition)[0].code, 'RT_COVERAGE_GATE_LIE');
      context.files.set(CI(edition), workflow('npm run typecheck'));
      assert.equal(findings(context, edition)[0].code, 'RT_COVERAGE_GATE_LIE');
    });

    test(`disabled CI steps and jobs cannot prove ${kind} gate claims in ${edition}`, () => {
      const context = contextFor(kind, ['ci']);
      for (const condition of ['false', '${{ false }}']) {
        context.files.set(CI(edition), workflow('npm run lint', condition));
        assert.equal(findings(context, edition)[0].code, 'RT_COVERAGE_GATE_LIE');
        context.files.set(CI(edition), workflow('npm run lint', '', condition));
        assert.equal(findings(context, edition)[0].code, 'RT_COVERAGE_GATE_LIE');
      }
      context.files.set(CI(edition), workflow('npm run lint', '${{ !cancelled() }}'));
      assert.deepEqual(findings(context, edition), []);
    });

    test(`the managed ${edition} CI workflow proves its ${kind} lint gate`, () => {
      const context = contextFor(kind, ['ci']);
      context.files.set(CI(edition), fs.readFileSync(new URL(`../../${CI(edition)}`, import.meta.url), 'utf8'));
      assert.deepEqual(findings(context, edition), []);
    });
  }

  test(`app check adds the explicit stacks gate to app lint in ${edition}`, () => {
    const context = contextFor('hfs', ['land', 'settle'], STACKS);
    context.files.set(GATE, appSource('lint'));
    assert.equal(findings(context, edition)[0].code, 'RT_COVERAGE_GATE_LIE');
    context.files.set(GATE, appSource('check'));
    assert.deepEqual(findings(context, edition), []);
    context.catalog.rules[0].gates = ['ci'];
    context.files.set(CI(edition), workflow('npm run lint'));
    assert.equal(findings(context, edition)[0].code, 'RT_COVERAGE_GATE_LIE');
    context.files.set(CI(edition), workflow('npm run check'));
    assert.deepEqual(findings(context, edition), []);
  });

  test(`CI evidence belongs to the selected ${edition} template group`, () => {
    const context = contextFor('hfs', ['ci']);
    const otherEdition = edition === 'lite' ? 'full' : 'lite';
    context.files.set(CI(otherEdition), workflow('npm run lint'));
    assert.equal(findings(context, edition)[0].code, 'RT_COVERAGE_GATE_LIE');
    context.files.set(CI(edition), workflow('npm run lint'));
    assert.deepEqual(findings(context, edition), []);
  });
}

test('workflow parsing preserves GitHub conditions while omitting Mustache partials', () => {
  assert.deepEqual(workflowRunCommands(workflow('npm run lint', '${{ false }}')), ['npm run typecheck']);
  assert.deepEqual(workflowRunCommands(workflow('npm run lint', '${{ !cancelled() }}')), ['npm run lint', 'npm run typecheck']);
  assert.deepEqual(workflowRunCommands('jobs: ['), []);
});

test('the catalog loader accepts hfs and machine claims for lint-driven land and settle gates', () => {
  const header = loadRuleCatalog();
  for (const kind of ['hfs', 'machine']) {
    const context = contextFor(kind, ['land', 'settle', 'ci']);
    const catalog = loadRuleCatalog({ text: JSON.stringify({
      schema: 'starci/hfs-rules@1', version: '1.0.0', gates: header.gates,
      enforcerKinds: header.enforcerKinds, rules: context.catalog.rules,
    }) });
    assert.deepEqual(catalog.rule('R01').gates, ['land', 'settle', 'ci']);
  }
});

for (const edition of EDITIONS) {
  test(`managed command bindings prove only their real app gates in ${edition}`, () => {
    const content = contextFor('hfs', ['ci']);
    for (const binding of ['ciLint', 'ciLintSonar', 'ciCoverageProof']) {
      content.files.set(CI(edition), workflow('{{' + binding + '}}'));
      assert.deepEqual(findings(content, edition), []);
    }
    const stacks = contextFor('hfs', ['ci'], STACKS);
    for (const binding of ['ciLint', 'ciLintSonar', 'ciDatabaseLint', 'unknownCiCommand']) {
      stacks.files.set(CI(edition), workflow('{{' + binding + '}}'));
      assert.equal(findings(stacks, edition)[0].code, 'RT_COVERAGE_GATE_LIE');
    }
    stacks.files.set(CI(edition), workflow('{{ciCoverageProof}}'));
    assert.deepEqual(findings(stacks, edition), []);
    stacks.files.set(CI(edition), workflow('{{ciCoverageProof}}', 'false'));
    assert.equal(findings(stacks, edition)[0].code, 'RT_COVERAGE_GATE_LIE');
  });
}

test('workflow command binding resolution uses the renderer values and preserves explicit variants', () => {
  for (const runtimeExample of [false, true]) {
    const bindings = ciWorkflowCommands({ runtimeExample });
    for (const [binding, command] of Object.entries(bindings)) {
      assert.deepEqual(workflowRunCommands(workflow('{{' + binding + '}}'), bindings), [command, 'npm run typecheck']);
    }
  }
  assert.deepEqual(workflowRunCommands(workflow('{{ciLint}}'), { ciLint: 'npm run typecheck' }),
    ['npm run typecheck', 'npm run typecheck']);
  assert.deepEqual(workflowRunCommands(workflow('{{unknownCiCommand}}')), ['template', 'npm run typecheck']);
  assert.deepEqual(workflowRunCommands(workflow('{{ciLint}}', '${{ false }}')), ['npm run typecheck']);
});
