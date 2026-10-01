import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { main } from '../packages/hfs/bin/hfs.mjs';
import { anchorOf, linterReport, sonarReport, sourceRootsOf } from '../packages/hfs/report/sonar.mjs';
import { renderTargets } from '../packages/hfs/sync/index.mjs';
import { managedFindings } from '../packages/hfs/sync/managed.mjs';
import { parseYaml } from '../engine/yaml.mjs';
import { loadSonarGate, serverConditions } from '../scripts/checks/sonar-gate.mjs';
import { APP, TWO_FE_APPS, FORMATTED, PRESETS, cleanup, gitAdd, installTypeScript, writeCleanRepo } from './_hfs-cli-fixture.mjs';

// One Sonar mechanism (contract change hfs-sonar-import, rules R11, R20, R21): the findings of `hfs check` and the eslint and stylelint
// results become Sonar Generic Issue Import documents through one placement rule; the managed configuration names the reports; the gate holds them at zero.
const root = path.resolve(import.meta.dirname, '..');
const made = [];
test.after(() => cleanup(made));

const CLEAN_CODE_ATTRIBUTES = new Set(['CONVENTIONAL', 'FORMATTED', 'IDENTIFIABLE', 'CLEAR', 'COMPLETE', 'EFFICIENT', 'LOGICAL', 'DISTINCT', 'FOCUSED', 'MODULAR', 'TESTED', 'LAWFUL', 'RESPECTFUL', 'TRUSTWORTHY']);
const QUALITIES = new Set(['MAINTAINABILITY', 'RELIABILITY', 'SECURITY']);
const SEVERITIES = new Set(['HIGH', 'MEDIUM', 'LOW']);

/** The problems of a Generic Issue Import document (SonarQube 10.3+ format), as a list of texts; empty when valid. */
function schemaProblems(document) {
  const problems = [];
  if (Object.keys(document).sort().join() !== 'issues,rules') problems.push('the document is exactly { rules, issues }');
  const ids = new Set();
  for (const rule of document.rules ?? []) {
    for (const key of ['id', 'name', 'description', 'engineId', 'cleanCodeAttribute']) if (typeof rule[key] !== 'string' || !rule[key]) problems.push(`rule ${rule.id}: ${key} is a non-empty string`);
    if (!CLEAN_CODE_ATTRIBUTES.has(rule.cleanCodeAttribute)) problems.push(`rule ${rule.id}: cleanCodeAttribute ${rule.cleanCodeAttribute}`);
    if (!Array.isArray(rule.impacts) || rule.impacts.length === 0) problems.push(`rule ${rule.id}: impacts`);
    for (const impact of rule.impacts ?? []) if (!QUALITIES.has(impact.softwareQuality) || !SEVERITIES.has(impact.severity)) problems.push(`rule ${rule.id}: impact ${JSON.stringify(impact)}`);
    if (ids.has(rule.id)) problems.push(`rule ${rule.id} is listed twice`);
    ids.add(rule.id);
  }
  for (const issue of document.issues ?? []) {
    if (!ids.has(issue.ruleId)) problems.push(`issue names rule ${issue.ruleId}, which the rules section lacks`);
    const location = issue.primaryLocation;
    if (typeof location?.message !== 'string' || !location.message) problems.push(`issue ${issue.ruleId}: primaryLocation.message`);
    if (typeof location?.filePath !== 'string' || !location.filePath || path.isAbsolute(location.filePath) || location.filePath.includes('\\')) problems.push(`issue ${issue.ruleId}: filePath is a relative posix path (${location?.filePath})`);
    const range = location?.textRange;
    if (range !== undefined && !(Number.isInteger(range.startLine) && range.startLine >= 1 && Number.isInteger(range.endLine) && range.endLine >= range.startLine)) problems.push(`issue ${issue.ruleId}: textRange ${JSON.stringify(range)}`);
  }
  const used = new Set((document.issues ?? []).map((issue) => issue.ruleId));
  for (const id of ids) if (!used.has(id)) problems.push(`rule ${id} has no issue`);
  return problems;
}

const finding = (over) => ({ code: 'HFS_MANAGED_FILE_DRIFT', level: 'error', path: 'src/a.ts', message: 'a.ts drifted', title: 'A managed file differs from its render', titleVi: 'Tệp do máy sinh bị sửa tay', whyVi: 'Tệp lệch bản render.', nextStepVi: 'Chạy lại hfs sync.', ...over });

test('the report maps a finding to an issue and its code to a rule with the catalog text, in the 10.3+ format', () => {
  const report = sonarReport([finding({ path: 'src/a.ts', line: 7, message: 'a.ts line 7' })]);
  assert.deepEqual(schemaProblems(report), []);
  assert.equal(report.rules.length, 1);
  const [rule] = report.rules;
  assert.deepEqual([rule.id, rule.engineId, rule.name, rule.cleanCodeAttribute], ['HFS_MANAGED_FILE_DRIFT', 'starci-hfs', 'A managed file differs from its render', 'CONVENTIONAL']);
  assert.deepEqual(rule.impacts, [{ softwareQuality: 'MAINTAINABILITY', severity: 'HIGH' }]);
  assert.match(rule.description, /A managed file differs from its render\. Tệp do máy sinh bị sửa tay: Tệp lệch bản render\. Cách sửa: Chạy lại hfs sync\./);
  assert.deepEqual(report.issues, [{ ruleId: 'HFS_MANAGED_FILE_DRIFT', effortMinutes: 5, primaryLocation: { message: 'a.ts line 7', filePath: 'src/a.ts', textRange: { startLine: 7, endLine: 7 } } }]);
});

test('the report holds error findings only: a report-only info finding and a check with no finding give an empty, valid document', () => {
  assert.deepEqual(sonarReport([finding({ code: 'HFS_SIZE_SOFT_BACKLOG', level: 'info' })]), { rules: [], issues: [] });
  assert.deepEqual(sonarReport([]), { rules: [], issues: [] });
  assert.deepEqual(schemaProblems(sonarReport([])), []);
});

test('the report is deterministic: the order of the findings does not change one byte, rules sort by id and issues by file, line, rule and message', () => {
  const findings = [
    finding({ code: 'HFS_TS_STRICT', path: 'src/z.ts', message: 'z' }),
    finding({ path: 'src/b.ts', line: 30, message: 'b30' }),
    finding({ path: 'src/b.ts', line: 4, message: 'b4' }),
    finding({ code: 'BE_TIER_DIRECTION', path: 'src/b.ts', line: 4, message: 'b4 tier' }),
    finding({ code: 'BE_TIER_DIRECTION', path: 'src/a.ts', message: 'a' }),
  ];
  const forward = JSON.stringify(sonarReport(findings));
  assert.equal(JSON.stringify(sonarReport([...findings].reverse())), forward);
  assert.equal(JSON.stringify(sonarReport(findings)), forward);
  const report = JSON.parse(forward);
  assert.deepEqual(report.rules.map((rule) => rule.id), ['BE_TIER_DIRECTION', 'HFS_MANAGED_FILE_DRIFT', 'HFS_TS_STRICT']);
  assert.deepEqual(report.issues.map((issue) => `${issue.primaryLocation.filePath}:${issue.primaryLocation.textRange?.startLine ?? 0}:${issue.ruleId}`), [
    'src/a.ts:0:BE_TIER_DIRECTION', 'src/b.ts:4:BE_TIER_DIRECTION', 'src/b.ts:4:HFS_MANAGED_FILE_DRIFT', 'src/b.ts:30:HFS_MANAGED_FILE_DRIFT', 'src/z.ts:0:HFS_TS_STRICT',
  ]);
  assert.deepEqual(schemaProblems(report), []);
});

test('a finding outside sonar.sources, or with no path, is filed on the first source file and its message names the real path', () => {
  const tracked = ['hfs.json', 'src/z.ts', 'src/a.spec.ts', 'src/data/seed.json', 'apps/core/src/main.ts', 'README.md'];
  assert.equal(anchorOf(tracked, ['apps', 'src']), 'apps/core/src/main.ts');
  assert.equal(anchorOf(['README.md'], ['apps', 'src']), null);
  const report = sonarReport([finding({ path: 'hfs.json', message: 'hfs.json is not valid' }), finding({ path: undefined, message: 'no file' }), finding({ path: 'apps/migrate', message: 'a directory' }), finding({ path: 'src/data/seed.json', message: 'json' }), finding({ path: 'src/z.ts', line: 3, message: 'in source' })], { sourceRoots: ['apps', 'src'], tracked });
  assert.deepEqual(schemaProblems(report), []);
  assert.deepEqual(report.issues.map((issue) => [issue.primaryLocation.filePath, issue.primaryLocation.message, issue.primaryLocation.textRange?.startLine]), [
    ['apps/core/src/main.ts', 'apps/migrate: a directory', undefined],
    ['apps/core/src/main.ts', 'hfs.json: hfs.json is not valid', undefined],
    ['apps/core/src/main.ts', 'repository: no file', undefined],
    ['apps/core/src/main.ts', 'src/data/seed.json: json', undefined],
    ['src/z.ts', 'in source', 3],
  ]);
  const kept = sonarReport([finding({ path: 'hfs.json', message: 'x' })], { sourceRoots: ['apps'], tracked: ['hfs.json'] });
  assert.equal(kept.issues[0].primaryLocation.filePath, 'hfs.json', 'no source file to anchor on: the finding keeps its path');
  assert.deepEqual(sourceRootsOf('sonar.projectKey=a\nsonar.sources=apps, src\nsonar.tests=apps,src\n'), ['apps', 'src']);
  assert.deepEqual(sourceRootsOf('sonar.projectKey=a\n'), []);
});

test('stylelint results become issues of engine stylelint: one rule per stylelint rule, relative posix paths, the rule suffix dropped from the text', () => {
  const results = [
    { source: path.join(root, 'apps', 'web', 'src', 'b.css'), warnings: [{ line: 9, endLine: 9, column: 3, rule: 'starci/no-important', severity: 'error', text: 'Unexpected !important (starci/no-important)' }, { line: 2, rule: 'starci/token-only', severity: 'error', text: 'Raw value (starci/token-only)' }] },
    { source: path.join(root, 'apps', 'web', 'src', 'a.css'), warnings: [{ line: 5, rule: 'starci/token-only', severity: 'error', text: 'Raw value (starci/token-only)' }, { line: 1, text: 'Unclosed block', severity: 'error' }] },
    { source: path.join(root, 'apps', 'web', 'src', 'clean.css'), warnings: [] },
    { source: path.join(path.dirname(root), 'outside.css'), warnings: [{ line: 1, rule: 'starci/token-only', text: 'x' }] },
  ];
  const report = linterReport('stylelint', results, { root });
  assert.deepEqual(schemaProblems(report), []);
  assert.deepEqual(report.rules.map((rule) => [rule.id, rule.engineId]), [['starci/no-important', 'stylelint'], ['starci/token-only', 'stylelint'], ['stylelint-error', 'stylelint']]);
  assert.deepEqual(report.issues.map((issue) => [issue.primaryLocation.filePath, issue.primaryLocation.textRange.startLine, issue.ruleId, issue.primaryLocation.message]), [
    ['apps/web/src/a.css', 1, 'stylelint-error', 'Unclosed block'],
    ['apps/web/src/a.css', 5, 'starci/token-only', 'Raw value'],
    ['apps/web/src/b.css', 2, 'starci/token-only', 'Raw value'],
    ['apps/web/src/b.css', 9, 'starci/no-important', 'Unexpected !important'],
  ]);
  assert.equal(JSON.stringify(linterReport('stylelint', [...results].reverse(), { root })), JSON.stringify(report));
  assert.deepEqual(linterReport('stylelint', [{ source: path.join(root, 'a.css'), warnings: [] }], { root }), { rules: [], issues: [] });
  assert.throws(() => linterReport('tslint', [], { root }), /unknown linter tslint/);
});

test('eslint results become issues of engine eslint: one rule per rule id, a fatal parse error under eslint-error, warnings included, files outside the repository skipped', () => {
  const results = [
    { filePath: path.join(root, 'apps', 'web', 'src', 'b.tsx'), messages: [{ ruleId: 'starci-fe/no-raw-brand-value', severity: 2, line: 9, endLine: 9, message: 'Raw brand value' }, { ruleId: '@typescript-eslint/no-explicit-any', severity: 1, line: 2, message: 'Unexpected any' }] },
    { filePath: path.join(root, 'apps', 'web', 'src', 'a.ts'), messages: [{ ruleId: null, fatal: true, severity: 2, line: 1, message: 'Parsing error: Unexpected token' }] },
    { filePath: path.join(root, 'apps', 'web', 'src', 'clean.ts'), messages: [] },
    { filePath: path.join(path.dirname(root), 'outside.ts'), messages: [{ ruleId: 'starci-fe/x', line: 1, message: 'x' }] },
  ];
  const report = linterReport('eslint', results, { root });
  assert.deepEqual(schemaProblems(report), []);
  assert.deepEqual(report.rules.map((rule) => [rule.id, rule.engineId]), [['@typescript-eslint/no-explicit-any', 'eslint'], ['eslint-error', 'eslint'], ['starci-fe/no-raw-brand-value', 'eslint']]);
  assert.deepEqual(report.issues.map((issue) => [issue.primaryLocation.filePath, issue.primaryLocation.textRange.startLine, issue.ruleId, issue.primaryLocation.message]), [
    ['apps/web/src/a.ts', 1, 'eslint-error', 'Parsing error: Unexpected token'],
    ['apps/web/src/b.tsx', 2, '@typescript-eslint/no-explicit-any', 'Unexpected any'],
    ['apps/web/src/b.tsx', 9, 'starci-fe/no-raw-brand-value', 'Raw brand value'],
  ]);
  assert.equal(JSON.stringify(linterReport('eslint', [...results].reverse(), { root })), JSON.stringify(report), 'deterministic');
});

test('a linter finding outside sonar.sources (packages, e2e, a config file) is filed on the first source file with its real path in the message; a stylesheet or source file under the sources keeps its place', () => {
  const tracked = ['apps/web/src/app/globals.css', 'apps/web/src/main.ts', 'packages/kit/src/index.ts', 'e2e/flows/a.e2e-spec.ts', 'playwright.config.ts', 'README.md'];
  const eslint = [
    { filePath: path.join(root, 'packages', 'kit', 'src', 'index.ts'), messages: [{ ruleId: 'starci-fe/x', line: 4, message: 'in a package' }] },
    { filePath: path.join(root, 'e2e', 'flows', 'a.e2e-spec.ts'), messages: [{ ruleId: 'starci-fe/y', line: 8, message: 'in e2e' }] },
    { filePath: path.join(root, 'apps', 'web', 'src', 'main.ts'), messages: [{ ruleId: 'starci-fe/z', line: 3, message: 'in an app' }] },
  ];
  const unindexed = linterReport('eslint', eslint, { root, sourceRoots: ['apps'], tracked });
  assert.deepEqual(schemaProblems(unindexed), []);
  assert.deepEqual(unindexed.issues.map((issue) => [issue.primaryLocation.filePath, issue.primaryLocation.message, issue.primaryLocation.textRange?.startLine]), [
    ['apps/web/src/main.ts', 'packages/kit/src/index.ts: in a package', undefined],
    ['apps/web/src/main.ts', 'e2e/flows/a.e2e-spec.ts: in e2e', undefined],
    ['apps/web/src/main.ts', 'in an app', 3],
  ]);
  const indexed = linterReport('eslint', eslint, { root, sourceRoots: ['apps', 'packages'], tracked });
  assert.deepEqual(indexed.issues.map((issue) => issue.primaryLocation.filePath), ['apps/web/src/main.ts', 'apps/web/src/main.ts', 'packages/kit/src/index.ts'], 'a package the sources list keeps its own file');
  const css = [{ source: path.join(root, 'apps', 'web', 'src', 'app', 'globals.css'), warnings: [{ line: 6, rule: 'starci/token-only', text: 'Raw value (starci/token-only)' }] }, { source: path.join(root, 'e2e', 'a.css'), warnings: [{ line: 1, rule: 'starci/token-only', text: 'Raw value (starci/token-only)' }] }];
  const styled = linterReport('stylelint', css, { root, sourceRoots: ['apps'], tracked });
  assert.deepEqual(styled.issues.map((issue) => [issue.primaryLocation.filePath, issue.primaryLocation.message, issue.primaryLocation.textRange?.startLine]), [
    ['apps/web/src/app/globals.css', 'Raw value', 6],
    ['apps/web/src/main.ts', 'e2e/a.css: Raw value', undefined],
  ]);
});

const cli = async (argv, presets) => {
  let out = '';
  let err = '';
  const code = await main(argv, { stdout: (s) => { out += s; }, stderr: (s) => { err += s; }, presets, prettier: FORMATTED }); // this spec is not about formatting
  return { code, out, err };
};
const repo = (declaration = APP, mutate) => {
  const dir = writeCleanRepo(declaration);
  made.push(dir);
  if (mutate) mutate(dir);
  return installTypeScript(gitAdd(dir));
};
const scratch = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-sonar-'));
  made.push(dir);
  return dir;
};

test('the superseded Sonar commands are gone, not aliased: hfs check --sonar and hfs report are refused', async () => {
  const out = scratch();
  const violating = repo(APP, (dir) => fs.appendFileSync(path.join(dir, 'sonar-project.properties'), 'sonar.host.url=https://sonar.example.org\n'));
  assert.equal((await cli(['check', '--repo', violating, '--sonar', path.join(out, 'x.json')], PRESETS)).code, 2, 'hfs check --sonar is gone');
  assert.equal((await cli(['report', 'eslint', 'a.json', 'b.json', '--repo', violating])).code, 2, 'hfs report is gone');
  assert.equal(fs.existsSync(path.join(out, 'x.json')), false);
});

const managed = async (dir) => {
  const tracked = execFileSync('git', ['-C', dir, 'ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  return (await managedFindings({ repoRoot: dir, tracked, presets: PRESETS })).filter((f) => f.code === 'HFS_SONAR_CONFIG').map((f) => f.path);
};

test('HFS_SONAR_CONFIG: a host URL, a dropped report path or any edit of the app sonar-project.properties is one finding; the render is clean', async () => {
  for (const declaration of [APP, TWO_FE_APPS]) {
    const dir = repo(declaration);
    assert.deepEqual(await managed(dir), [], `${declaration.sides.fe.apps.length} fe app(s): the rendered configuration is clean`);
    const file = path.join(dir, 'sonar-project.properties');
    const text = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, `${text}sonar.host.url=https://sonar.example.org\n`);
    assert.deepEqual(await managed(dir), ['sonar-project.properties'], `${declaration.sides.fe.apps.length} fe app(s): a host URL`);
    fs.writeFileSync(file, text.replace('reports/lint.sonar.json', 'reports/eslint.json'));
    assert.deepEqual(await managed(dir), ['sonar-project.properties'], `${declaration.sides.fe.apps.length} fe app(s): the lint import path dropped`);
    fs.writeFileSync(file, `${text}sonar.eslint.reportPaths=reports/eslint.json\n`);
    assert.deepEqual(await managed(dir), ['sonar-project.properties'], `${declaration.sides.fe.apps.length} fe app(s): Sonar's own ESLint import is not used`);
    fs.writeFileSync(file, text.replace(/^sonar\.externalIssuesReportPaths=.*\n/m, ''));
    assert.deepEqual(await managed(dir), ['sonar-project.properties'], `${declaration.sides.fe.apps.length} fe app(s): the import path dropped`);
    fs.writeFileSync(file, text);
    assert.deepEqual(await managed(dir), []);
  }
});

test('HFS_SONAR_CONFIG: a stack declaration that names another quality gate than the bundled gate file is a finding; the gate name, a disabled Sonar and no declaration are not', async () => {
  const gate = loadSonarGate().gate.name;
  const declare = (dir, sonar) => {
    fs.mkdirSync(path.join(dir, '.starcistacks'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.starcistacks', 'application-stacks.yaml'), `schema: starci/application-stacks@1\nservices:\n  sonar:\n${sonar}\n`);
  };
  const dir = repo(APP);
  const tracked = ['.starcistacks/application-stacks.yaml'];
  const found = async () => (await managedFindings({ repoRoot: dir, tracked, presets: PRESETS })).filter((f) => f.code === 'HFS_SONAR_CONFIG');
  declare(dir, `    provider: sonarqube\n    mode: local\n    qualityGate: ${gate}`);
  assert.deepEqual(await found(), []);
  declare(dir, '    provider: sonarqube\n    mode: local\n    qualityGate: my-own-gate');
  const [wrong] = await found();
  assert.equal(wrong.path, '.starcistacks/application-stacks.yaml');
  assert.match(wrong.message, new RegExp(`my-own-gate.*${gate}`));
  declare(dir, '    provider: sonarqube\n    mode: local');
  assert.match((await found())[0].message, /is absent/);
  declare(dir, '    provider: sonarqube\n    mode: disabled\n    qualityGate: other');
  assert.deepEqual(await found(), []);
  fs.rmSync(path.join(dir, '.starcistacks'), { recursive: true });
  assert.deepEqual(await found(), []);
});

test('the managed configuration wires the one report: properties name reports/lint.sonar.json, the workflow produces it once through npm run lint before the scan, no step swallows a failure', () => {
  for (const declaration of [APP, TWO_FE_APPS]) {
    const files = Object.fromEntries(renderTargets(declaration, PRESETS).map((target) => [target.path, target.content]));
    const properties = files['sonar-project.properties'];
    assert.doesNotMatch(properties, /sonar\.eslint\.reportPaths/, 'no second import path for eslint');
    assert.match(properties, /^sonar\.externalIssuesReportPaths=reports\/lint\.sonar\.json$/m);
    assert.doesNotMatch(properties, /sonar.host.url/);
    const steps = parseYaml(files['.github/workflows/ci.yml']).jobs.ci.steps;
    const scan = steps.findIndex((step) => String(step.uses).startsWith('SonarSource/sonarqube-scan-action'));
    const producers = steps.map((step, index) => [step, index]).filter(([step]) => /npm run lint|hfs |eslint|stylelint/.test(step.run ?? ''));
    assert.deepEqual(producers.map(([step]) => step.run), ['npm run lint -- --sonar reports/lint.sonar.json'], `${declaration.sides.fe.apps.length} fe app(s): one lint step produces the one report`);
    for (const [, index] of producers) assert.ok(index < scan, `${declaration.sides.fe.apps.length} fe app(s): the report is produced before the Sonar scan`);
    for (const step of steps) assert.equal(step['continue-on-error'], undefined, 'no step swallows a failure');
    for (const step of [steps[scan], steps[scan + 1]]) assert.match(String(step.if), /!cancelled\(\)/, 'a failed lint still reaches Sonar');
  }
});

test('the one gate holds the imports at zero on the whole code, beside the new-code conditions', () => {
  const gate = loadSonarGate();
  assert.deepEqual(gate.overall.issues.engines, ['starci-hfs', 'eslint', 'stylelint']);
  const conditions = serverConditions(gate);
  assert.deepEqual(conditions.filter((condition) => !condition.metric.startsWith('new_')), [
    { metric: 'coverage', op: 'LT', error: '100' },
    { metric: 'violations', op: 'GT', error: '0' },
    { metric: 'security_hotspots_reviewed', op: 'LT', error: '100' },
    { metric: 'duplicated_lines_density', op: 'GT', error: String(gate.overall.duplication.maxPercent) },
  ]);
  assert.ok(conditions.some((condition) => condition.metric === 'new_duplicated_lines_density'), 'the new-code conditions stay');
  assert.deepEqual(conditions.filter((condition) => /coverage/.test(condition.metric)), [
    { metric: 'new_coverage', op: 'LT', error: '100' },
    { metric: 'coverage', op: 'LT', error: '100' },
  ], 'coverage of the services is 100 on new code and overall');
  assert.equal(gate.overall.coverage.perFile, true);
  assert.deepEqual(gate.enforces.map((entry) => entry.code).sort(), ['HFS_DUPLICATE_CODE', 'HFS_DUPLICATE_SYMBOL', 'HFS_SIZE_GROWTH']);
  const rules = parseYaml(fs.readFileSync(path.join(root, 'knowledge/hfs/rules.yaml'), 'utf8')).rules;
  for (const entry of gate.enforces) assert.ok(rules.find((rule) => rule.id === entry.rule).failureCodes.includes(entry.code), `${entry.rule} lists ${entry.code}`);
});
