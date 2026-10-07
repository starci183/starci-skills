// fe-no-tests.mjs - FE_NO_TESTS (R97): a front-end repository has no tests by standard (owner 2026-09-30). There is no exception: a spec
// anywhere in a front-end repository is a finding, `scripts/` included.
//   - a tracked test file: `*.spec.*`, `*.test.*`, `*-spec.*` (also `*.e2e-spec.*`);
//   - a tracked test directory: `e2e/`, `__tests__/`, `__mocks__/` or `test-support/`;
//   - a tracked test-tool file: `vitest.*`, `jest.*`, `playwright.*` (config, setup, workspace), `cypress.config.*`, `tsconfig.e2e.json`, `e2e.yml`;
//   - a test script in a package.json: a script named `test`, `test:*` (or with a pre/post prefix), or one that runs a test runner;
//   - a test dependency in a package.json: a test runner, a test environment, testing-library or an axe package.
// The check reads the tracked tree and the manifests only. One finding per path (a manifest: one per script or dependency), and it is
// the only finding of a test file: the slot check leaves these paths to it (isFeTestPath).
import { found, readJson } from './read.mjs';

export const FE_NO_TESTS = 'FE_NO_TESTS';
const SPEC_FILE = /(?:\.(?:spec|test)|-spec)\.[cm]?[jt]sx?$/;
const TEST_DIRECTORY = /(?:^|\/)(?:e2e|__tests__|__mocks__|test-support)\//;
export const TEST_TOOL_FILE = /(?:^|\/)(?:(?:vitest|jest|playwright)\.[^/]+|cypress\.config\.[^/]+|tsconfig\.e2e\.json|e2e\.ya?ml)$/;
// The edition rule (rules/edition.mjs, L01) applies the same lists to the whole app tree in lite: they are the test vocabulary.
export const TEST_SCRIPT_NAME = /^(?:pre|post)?test(?::|$)/;
const TEST_RUNNER_COMMAND_SOURCE = String.raw`(?:^|[\s&|;(])(?:npx\s+)?(?:vitest|jest|playwright|cypress|mocha)(?=$|[\s&|;)])|\bnode\s+(?:--\S+\s+)*--test\b`;
export const TEST_RUNNER_COMMAND = new RegExp(TEST_RUNNER_COMMAND_SOURCE);
const TEST_DEPENDENCY_SOURCE = String.raw`^(?:vitest|@vitest\/.+|playwright|playwright-core|@playwright\/.+|jest|@jest\/.+|ts-jest|babel-jest|@types\/jest|jest-[\w-]+|mocha|@types\/mocha|cypress|@testing-library\/.+|jsdom|@types\/jsdom|happy-dom|axe-core|@axe-core\/.+|vitest-axe|@starci\/(?:vitest|jest|playwright)-preset)$`;
export const TEST_DEPENDENCY = new RegExp(TEST_DEPENDENCY_SOURCE);
export const DEPENDENCY_SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

/** True for a path FE_NO_TESTS owns: a spec file, a test directory or a test-tool file. */
export const isFeTestPath = (file) => SPEC_FILE.test(file) || TEST_DIRECTORY.test(file) || TEST_TOOL_FILE.test(file);

function testPathFinding(file) {
  let what = 'test tooling';
  if (SPEC_FILE.test(file)) what = 'a test file';
  else if (TEST_DIRECTORY.test(file)) what = 'inside a test directory';
  return found(FE_NO_TESTS, file, `${file} is ${what}; a front-end repository has no tests, no test tooling and no exception: delete it`);
}

function testDependencyFindings(file, pkg) {
  const findings = [];
  for (const section of DEPENDENCY_SECTIONS) {
    for (const name of Object.keys(pkg[section] ?? {})) {
      if (TEST_DEPENDENCY.test(name)) findings.push(found(FE_NO_TESTS, file, `${file} ${section} names ${name}, a test dependency; a front-end repository has no tests: delete the dependency`));
    }
  }
  return findings;
}

function packageTestFindings(repoRoot, file) {
  if (file !== 'package.json' && !file.endsWith('/package.json')) return [];
  if (file.includes('node_modules/')) return [];
  const pkg = readJson(repoRoot, file);
  if (!pkg || typeof pkg !== 'object') return [];
  const findings = [];
  for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
    if (TEST_SCRIPT_NAME.test(name) || TEST_RUNNER_COMMAND.test(String(command))) findings.push(found(FE_NO_TESTS, file, `${file} script ${name} is a test script (${String(command).slice(0, 80)}); a front-end repository has no tests: delete the script`));
  }
  findings.push(...testDependencyFindings(file, pkg));
  return findings;
}

/** The findings of R97 over the tracked paths `files` of a front-end repository at `repoRoot`. */
export function feNoTestsFindings({ repoRoot, files }) {
  const findings = [];
  for (const file of files) {
    if (isFeTestPath(file)) {
      findings.push(testPathFinding(file));
      continue;
    }
    findings.push(...packageTestFindings(repoRoot, file));
  }
  return findings;
}
