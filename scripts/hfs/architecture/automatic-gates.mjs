import { readTextFile } from '../../lib/read-text.mjs';

// Owner ruling 2026-09-29 (layout 2026-09-30): integration, e2e and contract run MANUALLY only. No hook, default typecheck,
// coverage run or automatic CI trigger may include those trees or run those projects. Linting the e2e files is not running them: ESLint reads them
// as syntax in the one repository-wide lint run (the factory's e2e block), so no `lint:e2e` command exists to judge.
const E2E_COMMAND = new RegExp([
  String.raw`\btest:(?:e2e|integration|contract)\b|`,
  String.raw`\btypecheck:tests\b|`,
  String.raw`--selectProjects\s+(?:e2e|integration|contract)\b|`,
  String.raw`src\/tests\/(?:world|integration|e2e|contract)\b|`,
  String.raw`jest[^\n|&;]*(?:e2e|integration|contract)`,
].join(''), 'u');
const UNIT_RUN_SCRIPTS = ['test', 'test:unit', 'test:ci', 'test:affected', 'test:coverage', 'test:cov'];

const runsE2e = text => E2E_COMMAND.test(String(text).replace(/--ignore-pattern[= ]+(?:"[^"]*"|'[^']*'|\S+)/gu, ''));
const withoutComments = text => text.split('\n').filter(line => !/^\s*#/u.test(line)).join('\n');

function inspectHooks(state) {
  for (const hook of ['.husky/pre-commit', '.husky/pre-push']) {
    const text = readTextFile(state.root, hook);
    if (text === null) continue;
    const body = withoutComments(text);
    if (runsE2e(body)) state.finding(state.rule, hook, `${hook} runs integration, e2e or contract. They are manual only; hooks run unit, lint and typecheck.`);
    for (const match of body.matchAll(/npm\s+run\s+([\w:.-]+)/gu)) state.pending.push(match[1]);
  }
}

function inspectLintStaged(state) {
  const lintStaged = state.pkg?.['lint-staged'];
  if (lintStaged && runsE2e(Object.values(lintStaged).flat().join('\n')))
    state.finding(state.rule, 'package.json', 'lint-staged runs an integration, e2e or contract command. They are manual only.');
}

function inspectHookScripts(state) {
  for (const name of state.pending) {
    if (state.called.has(name)) continue;
    state.called.add(name);
    const command = state.scripts[name];
    if (typeof command !== 'string') continue;
    if (runsE2e(command)) state.finding(state.rule, 'package.json', `Script ${name} is run by a husky hook and touches integration, e2e or contract. They are manual only.`);
    for (const match of command.matchAll(/npm\s+run\s+([\w:.-]+)/gu)) state.pending.push(match[1]);
  }
}

function inspectUnitGates(state) {
  if (!state.tree.hasFile(state.jestConfig)) return;
  for (const name of UNIT_RUN_SCRIPTS) {
    const command = state.scripts[name];
    if (typeof command === 'string' && /\bjest\b/u.test(command) && !/--selectProjects\s+unit\b/u.test(command))
      state.finding(state.rule, 'package.json', `Script ${name} runs jest without --selectProjects unit and would run the integration, e2e or contract project.`);
  }
  const jestText = readTextFile(state.root, state.jestConfig) ?? '';
  if (/collectCoverageFrom/u.test(jestText) && !/!src\/tests\/(?:\*\*|e2e)/u.test(jestText))
    state.finding(state.rule, state.jestConfig, 'collectCoverageFrom must exclude src/tests/** so no integration, e2e or contract file counts toward coverage.');
}

function inspectWorkflows(state) {
  for (const file of state.tree.files().filter(entry => /^\.github\/workflows\/[^/]+\.ya?ml$/u.test(entry))) {
    const text = readTextFile(state.root, file);
    if (text === null) continue;
    const trigger = /^on:.*(?:\n(?:[ \t].*)?$)*/mu.exec(text)?.[0] ?? '';
    if (!/\b(?:push|pull_request)\b/u.test(trigger)) continue;
    if (runsE2e(withoutComments(text)))
      state.finding(state.rule, file, `${file} runs e2e on push or pull_request. Move the e2e job to its own workflow with on: workflow_dispatch only.`);
  }
}

/** Check hooks, transitive hook scripts, unit scripts, coverage and automatic workflows. */
export function e2eInAutomaticGate({ root, tree, jestConfig, finding }) {
  const rule = 'HFS_E2E_IN_AUTOMATIC_GATE';
  let pkg = null;
  try { pkg = JSON.parse(readTextFile(root, 'package.json') ?? ''); } catch { /* the package checks own invalid JSON */ }
  const state = { root, tree, jestConfig, finding, rule, pkg, scripts: pkg?.scripts ?? {}, pending: [], called: new Set() };
  inspectHooks(state);
  inspectLintStaged(state);
  inspectHookScripts(state);
  inspectUnitGates(state);
  inspectWorkflows(state);
}

/** The be side's default tsconfig excludes the world, integration, e2e and contract trees (they are checked by src/tests/tsconfig.json). */
export function testTreesOutOfDefaultProgram({ root, tree, finding }) {
  const rule = 'HFS_E2E_IN_AUTOMATIC_GATE';
  const tsconfigText = readTextFile(root, 'tsconfig.json');
  let tsconfig = null;
  try { tsconfig = tsconfigText === null ? null : JSON.parse(tsconfigText); } catch { /* the typecheck itself owns parsing */ }
  if (tsconfig) {
    const excludedText = JSON.stringify(tsconfig.exclude ?? []);
    const excludesTestTrees = ['world', 'integration', 'e2e', 'contract'].every(tree => excludedText.includes(`src/tests/${tree}`));
    const defaultAll = tsconfig.include === undefined && tsconfig.files === undefined;
    const files = tree.files();
    if (files.some(file => /^src\/tests\/(?:world|integration|e2e|contract)\/.+\.[cm]?tsx?$/u.test(file)) && !excludesTestTrees &&
        (defaultAll || JSON.stringify(tsconfig.include ?? []).includes('src')))
      finding(rule, 'tsconfig.json', 'The default tsconfig includes src/tests/{world,integration,e2e,contract}/**. Exclude those trees and check them with src/tests/tsconfig.json (typecheck:tests).');
  }
}
