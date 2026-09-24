import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { checkScopedLint } from '../scripts/checks/check-scoped-lint.mjs';

const require = createRequire(import.meta.url);
const digest = 'a'.repeat(64);
const identityRules = ['NEST_ERROR_DECLARATION_IDENTITY', 'NEST_THROWN_ERROR_IDENTITY'];
const legacyRules = [
  'starci-be/exception-name-ends-in-exception',
  'starci-be/exception-code-matches-class-name',
  'starci-be/exception-metadata-type-named-for-class',
  'starci-be/exception-extends-abstract',
  'starci-be/exception-in-errors-folder',
  'starci-be/require-exception-object-arg',
  'starci-be/throw-abstract-exception',
  'starci-be/no-handler-encoded-failure',
];

const capabilityContract = {
  schema: 'starci/nest-error-identity@1',
  profile: 'capability',
  throwRoots: ['src', 'server'],
  families: [{
    id: 'capability',
    path: 'src/errors/capability-error.ts',
    export: 'CapabilityError',
    declarationRoots: ['src/errors'],
    codeProperty: 'code',
    causeProperties: ['cause'],
  }],
};

const academyContract = {
  schema: 'starci/nest-error-identity@1',
  profile: 'academy-abstract-exception',
  throwRoots: ['src', 'server'],
  families: [{
    id: 'academy',
    path: 'src/errors/abstract.ts',
    export: 'AbstractException',
    declarationRoots: ['src/errors'],
    codeProperty: 'code',
    causeProperties: ['originalError'],
    academy: { classSuffix: 'Exception', codeArgument: 1, metadataArgument: 2 },
  }],
};

function fixture(t, { profile = 'capability', legacy = 'off' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-nest-identity-aggregate-'));
  const write = (relative, value) => {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
    return file;
  };
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('starci-nest-identity-aggregate-'));
    fs.rmSync(root, { recursive: true, force: true });
  });

  const contract = profile === 'academy-abstract-exception' ? academyContract : capabilityContract;
  const manifest = { private: true, starci: { codePatterns: { nest: { errorIdentity: contract } } } };
  write('package.json', manifest);
  write('architecture.json', { schema: 'starci/architecture-config@1', kinds: ['backend'], tsconfig: 'tsconfig.json' });
  write('tsconfig.json', {
    compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true },
    include: ['src/**/*.ts', 'server/**/*.ts'],
  });
  write('jest.config.ts', "export default { setup: () => { throw new Error('configuration only'); } };\n");

  if (profile === 'academy-abstract-exception') {
    write('src/errors/abstract.ts', `export interface AbstractExceptionMetadata { originalError?: unknown }
export class AbstractException extends Error {
  readonly code: string;
  constructor(message: string, code: string, readonly metadata: AbstractExceptionMetadata) { super(message); this.code = code; }
}`);
    write('src/errors/user-missing.ts', `import { AbstractException, AbstractExceptionMetadata } from './abstract';
export interface UserMissingExceptionMetadata extends AbstractExceptionMetadata { id?: string }
export class UserMissingException extends AbstractException {
  constructor({ id, originalError }: UserMissingExceptionMetadata) {
    super('User missing', 'USER_MISSING_EXCEPTION', { id, originalError });
  }
}`);
    write('server/modules/execute.ts', `import { UserMissingException } from '../../src/errors/user-missing';
export function execute(): never { throw new UserMissingException({}); }`);
  } else {
    write('src/errors/capability-error.ts', `export class CapabilityError extends Error {
  readonly code = 'CAPABILITY_ERROR';
  constructor(readonly metadata: { cause?: unknown } = {}) { super('failed'); }
}`);
    write('src/errors/widget-error.ts', `import { CapabilityError } from './capability-error';
export class WidgetError extends CapabilityError {}`);
    write('server/modules/execute.ts', `import { WidgetError } from '../../src/errors/widget-error';
export function execute(): never { throw new WidgetError({}); }`);
  }
  write('src/disposition.ts', "export function disposition(): { status: 'refused' } { return { status: 'refused' }; }\n");

  fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
  fs.symlinkSync(path.dirname(require.resolve('typescript/package.json')), path.join(root, 'node_modules/typescript'), 'junction');

  const legacyRuleObjects = Object.fromEntries(legacyRules.map(rule => [rule.slice('starci-be/'.length), {}]));
  const configuredLegacy = Object.fromEntries(legacyRules.map(rule => [rule, 'off']));
  if (legacy === 'on') configuredLegacy[legacyRules[0]] = 'error';
  if (legacy === 'missing') delete configuredLegacy[legacyRules[0]];
  const profileCatalog = { schema: 'starci/code-pattern-profile@1', profiles: { nest: {
    title: 'Nest identity aggregate integration',
    canon: { package: '@starci/eslint-canon-be', version: '1.2.1', contentDigest: { algorithm: 'sha256', include: ['**/*.mjs'], exclude: [], framing: 'sorted-posix-relative-path-null-raw-bytes-null', value: digest, files: 1 } },
    sourceRuleRoots: ['knowledge/patterns/be'],
    expectedSourceRuleIds: ['BE-ERROR-1', 'BE-ERROR-2', 'BE-ERROR-3', 'BE-NAMING-3'],
    sourceGlobs: ['src/**/*.ts'],
    inputGlobs: ['package.json', 'architecture.json', 'tsconfig.json', 'jest.config.ts'],
    obligations: [
      {
        id: 'NEST-EXCEPTION-IDENTITY', sourceRuleIds: ['BE-ERROR-1', 'BE-ERROR-2', 'BE-ERROR-3', 'BE-NAMING-3'],
        applicability: { include: ['**/*.ts'] },
        mechanical: { requirement: 'Check the selected error identity.', check: { kind: 'script', ruleIds: [...identityRules], sourceOnly: true } },
        semantic: { guidance: 'knowledge/patterns/be/error.yaml', review: 'Review semantics separately.' }, status: 'implemented',
      },
      {
        id: 'NEST-LEGACY-EXCEPTION-IDENTITY-GUARD', sourceRuleIds: ['BE-ERROR-1', 'BE-ERROR-2', 'BE-ERROR-3', 'BE-NAMING-3'],
        applicability: { include: ['**/*.ts'] },
        mechanical: { requirement: 'Keep contradictory legacy rules disabled.', check: { kind: 'eslint', ruleIds: [...legacyRules], expected: { severity: 'off' }, sourceOnly: true } },
        semantic: { guidance: 'knowledge/patterns/be/error.yaml', review: 'Review selected profile separately.' }, status: 'implemented',
      },
      {
        id: 'NEST-SOURCE-COVERAGE', sourceRuleIds: ['BE-ERROR-1'], applicability: { include: ['**/*.ts'] },
        mechanical: { requirement: 'Bind canonical TypeScript subjects.', check: { kind: 'architecture', ruleIds: ['ARCH_SYNTAX_INVALID'] } },
        semantic: { guidance: 'docs/architecture-check.md', review: 'Review architecture meaning separately.' }, status: 'implemented',
      },
    ],
    semanticOnly: [],
  } } };
  // This ESLint stub isolates aggregate rule settings. TypeScript, architecture and the error-identity adapter are real.
  const runtime = {
    package: { name: '@starci/eslint-canon-be', version: '1.2.1', digest, files: 1 },
    canon: { rules: legacyRuleObjects, recommended: {} }, builtinRules: new Map(), typescriptRules: {}, eslintVersion: 'fixture',
    eslint: {
      isPathIgnored: async () => false,
      calculateConfigForFile: async () => ({ linterOptions: { noInlineConfig: true }, rules: configuredLegacy, plugins: { 'starci-be': { rules: legacyRuleObjects } } }),
      lintFiles: async files => files.map(filePath => ({ filePath, messages: [], suppressedMessages: [], errorCount: 0, warningCount: 0, fatalErrorCount: 0 })),
    },
  };
  const options = { profile: 'nest', profileCatalog, runtime, architectureConfig: 'architecture.json', all: true };
  return { root, write, manifest, profileCatalog, options, check: overrides => checkScopedLint(root, [], { ...options, ...overrides }) };
}

test('capability identity checks all canonical source roots while metadata remains context only', async t => {
  const f = fixture(t);
  let report = await f.check();
  assert.equal(report.status, 'clean', JSON.stringify(report.issues));
  const identity = report.machineResults.find(item => item.obligation === 'NEST-EXCEPTION-IDENTITY');
  assert.deepEqual(identity.checkedRuleIds, [...identityRules].sort());
  assert.ok(identity.files.includes('server/modules/execute.ts'));
  assert.ok(!identity.files.includes('jest.config.ts'));
  assert.ok(report.inputs.before.files.includes('jest.config.ts'));
  assert.ok(report.obligations.find(item => item.id === 'NEST-LEGACY-EXCEPTION-IDENTITY-GUARD').files.includes('server/modules/execute.ts'));
  assert.ok(!report.obligations.find(item => item.id === 'NEST-LEGACY-EXCEPTION-IDENTITY-GUARD').files.includes('jest.config.ts'));

  f.write('server/modules/execute.ts', "export function execute(): never { throw new Error('bare'); }\n");
  report = await f.check();
  assert.equal(report.status, 'findings', JSON.stringify(report.issues));
  assert.ok(report.issues.some(issue => issue.ruleId === 'NEST_THROWN_ERROR_IDENTITY' && issue.path === 'server/modules/execute.ts'));

  f.write('package.json', { private: true });
  report = await f.check();
  assert.equal(report.status, 'unavailable');
  assert.ok(report.issues.some(issue => issue.code === 'SCRIPT_INPUT_UNAVAILABLE' && issue.obligation === 'NEST-EXCEPTION-IDENTITY'), JSON.stringify(report.issues));
  // An undeclared target contract names the key the repository owes (nivo WSPV inc-900c9199622e read
  // "invalid shape" as a broken checker).
  const missing = report.issues.find(issue => issue.obligation === 'NEST-EXCEPTION-IDENTITY' && issue.targetContract);
  assert.equal(missing?.targetContract, 'package.json#starci.codePatterns.nest.errorIdentity', JSON.stringify(report.issues));
  assert.match(missing.message, /is not declared: the repository owes its Nest error identity contract/);
});

test('Academy identity accepts its exact constructor and rejects a mismatched class code', async t => {
  const f = fixture(t, { profile: 'academy-abstract-exception' });
  let report = await f.check();
  assert.equal(report.status, 'clean', JSON.stringify(report.issues));
  const child = fs.readFileSync(path.join(f.root, 'src/errors/user-missing.ts'), 'utf8');
  f.write('src/errors/user-missing.ts', child.replace('USER_MISSING_EXCEPTION', 'UNRELATED_CODE'));
  report = await f.check();
  assert.equal(report.status, 'findings', JSON.stringify(report.issues));
  assert.ok(report.issues.some(issue => issue.ruleId === 'NEST_ERROR_DECLARATION_IDENTITY'));
});

test('identity adapter mixtures and non-disabled legacy guards fail closed', async t => {
  const mixed = fixture(t);
  mixed.profileCatalog.profiles.nest.obligations[0].mechanical.check.ruleIds.push('NEST_ENV_ACCESS');
  let report = await mixed.check();
  assert.equal(report.status, 'unavailable');
  assert.ok(report.issues.some(issue => issue.code === 'SCRIPT_INPUT_UNAVAILABLE' && issue.obligation === 'NEST-EXCEPTION-IDENTITY'), JSON.stringify(report.issues));
  assert.deepEqual(report.machineResults.find(item => item.obligation === 'NEST-EXCEPTION-IDENTITY').checkedRuleIds, []);

  const enabled = fixture(t, { legacy: 'on' });
  report = await enabled.check();
  assert.equal(report.status, 'findings', JSON.stringify(report.issues));
  assert.ok(report.issues.some(issue => issue.code === 'REQUIRED_RULE_MISMATCH' && issue.ruleId === legacyRules[0]));

  const absent = fixture(t, { legacy: 'missing' });
  report = await absent.check();
  assert.equal(report.status, 'findings', JSON.stringify(report.issues));
  assert.ok(report.issues.some(issue => issue.code === 'REQUIRED_RULE_MISSING' && issue.ruleId === legacyRules[0]));
});
