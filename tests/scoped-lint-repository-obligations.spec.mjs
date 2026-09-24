import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { parseYaml } from '../engine/yaml.mjs';
import { checkScopedLint, codePatternExitCode } from '../scripts/checks/check-scoped-lint.mjs';

// nivo auth inc-8d228a86a8e3: `check-scoped-lint --profile next --root nivo-fe -- <slice files>` answered
// `unavailable` because repo-level obligations (NEXT-DATA-LIFECYCLE-KEYS, NEXT-GRAMMAR-CONTRACT,
// NEXT-OWNER-PUBLIC-ENTRY) had no contract in the repository, so no slice touching nivo-fe could get a verdict.
// A scoped run now judges the slice (the Sonar slice rule's principle): a missing repo-level contract is one
// REPOSITORY_OBLIGATION_OWED note for the repo owner, and the verdict comes from the checks that can run on the
// slice's files. --all still reports the obligations unavailable.
const OWNER = ['ARCH_OWNER_EXPORT_BYPASS', 'ARCH_OWNER_EXPORT_STAR'];
const GRAMMAR = ['ARCH_GRAMMAR_EXPORT_BYPASS', 'ARCH_GRAMMAR_CONTRACT_INVALID'];
const SWR = ['FE_SWR_KEY_IDENTITY', 'FE_SWR_MUTATION_RESOURCE_IDENTITY'];
const FILES = ['src/a.ts', 'src/b.ts', 'src/c.ts'];

const architectureObligation = (id, ruleIds) => ({ id, sourceRuleIds: ['FE-1'], applicability: { include: ['**/*.ts'] }, status: 'implemented',
  mechanical: { requirement: 'x', check: { kind: 'architecture', ruleIds } } });
const scriptObligation = (id, ruleIds) => ({ id, sourceRuleIds: ['FE-1'], applicability: { include: ['**/*.ts'] }, status: 'implemented',
  mechanical: { requirement: 'x', check: { kind: 'script', ruleIds } } });

function fixture(t, { obligations, coverage = {}, violations = [], kinds = ['frontend'], script = null }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-scoped-owed-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  for (const file of FILES) fs.writeFileSync(path.join(root, file), 'export const x = 1\n');
  const digest = 'a'.repeat(64);
  const profileCatalog = { schema: 'starci/code-pattern-profile@1', profiles: { next: {
    canon: { package: '@starci/eslint-canon-fe', version: '1.0.0', contentDigest: { algorithm: 'sha256', include: ['**/*.mjs'], exclude: [], framing: 'sorted-posix-relative-path-null-raw-bytes-null', value: digest, files: 1 } },
    expectedSourceRuleIds: ['FE-1'], sourceGlobs: ['src/**/*.ts'], inputGlobs: [], obligations, semanticOnly: [],
  } } };
  const runtime = { package: { name: '@starci/eslint-canon-fe', version: '1.0.0', digest, files: 1 }, canon: { rules: {}, recommended: {} }, builtinRules: new Map(), typescriptRules: {}, eslintVersion: 'fixture', eslint: {
    isPathIgnored: async () => false,
    calculateConfigForFile: async () => ({ linterOptions: { noInlineConfig: true }, rules: {}, plugins: {} }),
    lintFiles: async (files) => files.map((filePath) => ({ filePath, messages: [], suppressedMessages: [], errorCount: 0, warningCount: 0, fatalErrorCount: 0 })),
  } };
  // The architecture result as the real checker shapes it: a rule group whose repository contract is missing is
  // 'unavailable' and absent from checkedRuleIds.
  const statuses = { ownerPublicApi: { status: 'checked' }, grammarContract: { status: 'checked' }, frontendDataLifecycle: { status: 'not-applicable' }, ...coverage };
  const checked = ['FE_LAYOUT', ...(statuses.ownerPublicApi.status === 'checked' ? OWNER : []), ...(statuses.grammarContract.status === 'checked' ? GRAMMAR : []),
    ...(['checked', 'not-applicable'].includes(statuses.frontendDataLifecycle.status) ? SWR : [])];
  const architecture = () => ({ schema: 'starci/architecture-check@1', ok: violations.length === 0, kinds, files: FILES.length, violations, errors: [],
    coverage: { sourceFiles: [...FILES], checkedRuleIds: checked, ...statuses } });
  const scriptChecker = async (_profile, input) => ({ schema: 'starci/code-pattern-script@1', repository: input.root, files: [...input.files], requestedRuleIds: [...input.ruleIds],
    checkedRuleIds: [...input.ruleIds], violations: [], errors: [], compiler: { version: 'fixture' }, ...(script ? script(input) : {}) });
  const options = { profile: 'next', profileCatalog, runtime, architecture, scriptChecker };
  return { check: (files, extra = {}) => checkScopedLint(root, files, { ...options, ...extra }) };
}

const missingContracts = {
  ownerPublicApi: { status: 'unavailable', reason: 'architecture.json does not declare owners and public entries' },
  grammarContract: { status: 'unavailable', reason: 'architecture.json does not declare the selected Grammar contract' },
  frontendDataLifecycle: { status: 'unavailable', ruleIds: SWR, details: ['src/a.ts:1 SWR call is outside every declared lifecycle hook'] },
};
const repoObligations = [architectureObligation('LAYOUT', ['FE_LAYOUT']), architectureObligation('NEXT-OWNER-PUBLIC-ENTRY', OWNER),
  architectureObligation('NEXT-GRAMMAR-CONTRACT', GRAMMAR), architectureObligation('NEXT-DATA-LIFECYCLE-KEYS', SWR)];

test('a scoped run turns each missing repo-level obligation contract into one owed note, never unavailable for the slice', async (t) => {
  const f = fixture(t, { obligations: repoObligations, coverage: missingContracts });
  const report = await f.check(['src/a.ts']);
  assert.equal(report.slice.status, 'clean', JSON.stringify(report.slice.issues));
  assert.equal(report.slice.ok, true);
  assert.equal(codePatternExitCode(report), 0, 'a scoped run exits on its slice verdict');
  assert.notEqual(report.status, 'unavailable', 'no repo-level contract gap makes the scoped run unavailable');
  assert.deepEqual(report.issues.filter((issue) => /^ARCHITECTURE_/.test(issue.code)), []);
  const notes = report.issues.filter((issue) => issue.code === 'REPOSITORY_OBLIGATION_OWED');
  assert.deepEqual(notes.map((note) => [note.obligation, note.contracts]), [
    ['NEXT-DATA-LIFECYCLE-KEYS', ['package.json#starci.codePatterns.next.dataLifecycle']],
    ['NEXT-GRAMMAR-CONTRACT', ['architecture.json#frontend.grammar']],
    ['NEXT-OWNER-PUBLIC-ENTRY', ['architecture.json#owners']],
  ]);
  for (const note of notes) {
    assert.equal(note.severity, 'note');
    assert.equal(note.owner, 'repository');
    assert.match(note.message, /owed by the repository owner/);
  }
  const data = notes.find((note) => note.obligation === 'NEXT-DATA-LIFECYCLE-KEYS');
  assert.deepEqual(data.declaredIn, ['package.json']);
  assert.deepEqual(data.ruleIds, SWR);
  assert.deepEqual(data.sliceFiles, ['src/a.ts'], 'a detail naming a slice file tells the slice what the owner must declare for it');
  assert.deepEqual(report.slice.owed, notes);
  const validate = new Ajv2020({ strict: true }).compile(parseYaml(fs.readFileSync(new URL('../modules/schemas/code-pattern-check.schema.yaml', import.meta.url), 'utf8')));
  assert.equal(validate(report), true, JSON.stringify(validate.errors));
});

test('--all still reports the missing repo-level contracts unavailable, so the repo-owner leg stays visible', async (t) => {
  const f = fixture(t, { obligations: repoObligations, coverage: missingContracts });
  const report = await f.check([], { all: true });
  assert.equal(report.status, 'unavailable');
  assert.equal(report.slice, undefined);
  assert.equal(codePatternExitCode(report), 2);
  const codes = report.issues.map((issue) => issue.code);
  for (const code of ['ARCHITECTURE_OWNER_PUBLIC_API_UNAVAILABLE', 'ARCHITECTURE_GRAMMAR_CONTRACT_UNAVAILABLE', 'ARCHITECTURE_DATA_LIFECYCLE_UNAVAILABLE', 'ARCHITECTURE_RULE_COVERAGE_UNAVAILABLE']) {
    assert.ok(codes.includes(code), code);
  }
  assert.ok(!codes.includes('REPOSITORY_OBLIGATION_OWED'));
});

test('the slice verdict is judged on the slice files; issues located elsewhere are counted, not judged', async (t) => {
  const violations = [{ ruleId: 'FE_LAYOUT', path: 'src/b.ts', line: 1 }];
  const f = fixture(t, { obligations: [architectureObligation('LAYOUT', ['FE_LAYOUT'])], violations });
  let report = await f.check(['src/a.ts']);
  assert.equal(report.status, 'findings', 'the repository measurement keeps the violation and the unchecked files');
  assert.equal(report.slice.status, 'clean', JSON.stringify(report.slice.issues));
  assert.equal(report.slice.outside, 3, 'one violation in src/b.ts and two unchecked files');
  assert.equal(codePatternExitCode(report), 0);
  report = await f.check(['src/b.ts']);
  assert.equal(report.slice.status, 'findings');
  assert.deepEqual(report.slice.issues.map((issue) => [issue.code, issue.path]), [['ARCHITECTURE_VIOLATION', 'src/b.ts']]);
  assert.equal(codePatternExitCode(report), 1);
});

test('a run-level gap that is not a repository contract still makes the slice unavailable', async (t) => {
  const f = fixture(t, { obligations: [architectureObligation('LAYOUT', ['FE_LAYOUT'])], kinds: [] });
  const report = await f.check(['src/a.ts']);
  assert.equal(report.slice.status, 'unavailable');
  assert.ok(report.slice.issues.some((issue) => issue.code === 'ARCHITECTURE_PROFILE_UNAVAILABLE'));
  assert.equal(codePatternExitCode(report), 2);
});

test('script adapters: an undeclared package.json contract and a project gap outside the slice are owed; slice-file gaps are findings', async (t) => {
  const errors = [
    { message: 'package.json#starci.codePatterns.next.errorState is not declared: the repository owes its Next error contract' },
    { message: 'Source needs one compatible owning TypeScript project: src/c.ts' },
  ];
  const f = fixture(t, { obligations: [scriptObligation('NEXT-ERROR-STATE-MAPPING', ['FE_ERROR_ENVELOPE_POLICY'])], script: () => ({ errors, checkedRuleIds: [] }) });
  let report = await f.check(['src/a.ts']);
  assert.equal(report.slice.status, 'clean', JSON.stringify(report.slice.issues));
  const [note] = report.slice.owed;
  assert.equal(note.obligation, 'NEXT-ERROR-STATE-MAPPING');
  assert.deepEqual(note.contracts, ['package.json#starci.codePatterns.next.errorState', 'package.json#starci.codePatterns.next.projects']);
  assert.deepEqual(note.causes, ['SCRIPT_INPUT_UNAVAILABLE']);
  report = await f.check([], { all: true });
  assert.equal(report.status, 'unavailable', '--all keeps the adapter unavailable');
  assert.deepEqual(report.issues.filter((issue) => issue.code === 'SCRIPT_INPUT_UNAVAILABLE').length, 2);
  report = await f.check(['src/c.ts']);
  assert.equal(report.slice.status, 'unavailable', 'a slice file no declared project owns is the slice\'s own gap');

  const shaped = fixture(t, { obligations: [scriptObligation('NEXT-READONLY-PROPS-CONTRACT', ['FE_READONLY_PROPS_CONTRACT'])], script: () => ({
    checkedRuleIds: [],
    errors: [{ ruleId: 'FE_READONLY_PROPS_CONTRACT', path: 'src/a.ts', message: 'This computed props shape needs an explicit resolved contract before readonly coverage is available.' },
      { ruleId: 'FE_READONLY_PROPS_CONTRACT', path: 'src/b.ts', message: 'A props shape containing any/unknown has unavailable readonly coverage.' }],
    violations: [{ ruleId: 'FE_READONLY_PROPS_CONTRACT', path: 'src/a.ts', line: 2, message: 'Props field is mutable.' }],
  }) });
  report = await shaped.check(['src/a.ts']);
  assert.equal(report.slice.status, 'findings', 'a shape the slice can make provable is its finding, not unavailable');
  assert.deepEqual(report.slice.issues.map((issue) => issue.code).sort(), ['SCRIPT_INPUT_UNAVAILABLE', 'SCRIPT_PATTERN_VIOLATION'],
    'violations on slice files still count when the adapter also reported gaps elsewhere');
  assert.equal(report.slice.outside, 3);
});
