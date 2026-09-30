import fs from 'node:fs';
import path from 'node:path';
import { loadArchitectureConfig, slash } from '../architecture/config.mjs';
import { buildTypeScriptContext } from '../architecture/typescript.mjs';
import { moduleSpecifier, projectBinding, repositoryPath, scriptReport, symbolAt, unwrap } from './common.mjs';

export const NEST_TEST_RULES = Object.freeze(['NEST_TEST_NAME_FORM']);
const SPEC = /\.service\.spec\.ts$/;
const TEST_API_SOURCE = /\/node_modules\/(?:@types\/jest|@jest\/globals|@jest\/types|vitest|@vitest\/runner)\//;
export const NEST_TEST_TITLE_ACTIONS = Object.freeze(('accepts adds allows applies awaits blocks builds calls cancels checks clears closes collects compares completes computes constructs converts copies creates decodes deduplicates defers deletes delivers detects discards dispatches emits encodes enforces excludes executes exposes fails falls fences filters finds formats forwards generates gets guards handles ignores includes increments initializes inserts keeps leaves limits lists loads logs makes maps marks matches merges normalizes notifies opens parses passes persists polls preserves prevents processes propagates provides publishes reads recovers records redirects reduces refreshes registers rejects releases removes renders replaces reports requests resets resolves responds restores retries returns reuses rolls routes runs saves schedules selects sends serializes sets should skips sorts starts stops stores strips subscribes succeeds supports throws times tracks transforms trims truncates updates uses validates waits wraps writes').split(' '));
function apiName(ts, checker, input) {
  let node = unwrap(ts, input);
  if (ts.isCallExpression(node)) node = node.expression;
  if (ts.isTaggedTemplateExpression(node)) node = node.tag;
  while (ts.isPropertyAccessExpression(node) && ['only', 'skip', 'todo', 'each', 'concurrent', 'failing'].includes(node.name.text)) node = node.expression;
  if (ts.isPropertyAccessExpression(node)) {
    const binding = checker.getSymbolAtLocation(node.expression);
    const declarations = binding?.declarations ?? [];
    if (declarations.some(declaration => ts.isNamespaceImport(declaration) && ['@jest/globals', 'vitest'].includes(moduleSpecifier(ts, declaration)))
      && (symbolAt(ts, checker, node)?.declarations ?? []).some(declaration => TEST_API_SOURCE.test(slash(declaration.getSourceFile().fileName)))) return node.name.text;
    return null;
  }
  if (!ts.isIdentifier(node)) return null;
  const symbol = checker.getSymbolAtLocation(node), declarations = symbol?.declarations ?? [];
  const imported = declarations.find(declaration => ts.isImportSpecifier(declaration) && ['@jest/globals', 'vitest'].includes(moduleSpecifier(ts, declaration)));
  if (imported && (symbolAt(ts, checker, node)?.declarations ?? []).some(declaration => TEST_API_SOURCE.test(slash(declaration.getSourceFile().fileName)))) return imported.propertyName?.text ?? imported.name.text;
  if (declarations.length && declarations.every(declaration => declaration.getSourceFile().isDeclarationFile && TEST_API_SOURCE.test(slash(declaration.getSourceFile().fileName)))) return node.text;
  return null;
}
function disabledApi(ts, input) {
  let node = unwrap(ts, input);
  while (node) {
    if (ts.isCallExpression(node)) node = node.expression;
    else if (ts.isTaggedTemplateExpression(node)) node = node.tag;
    else if (ts.isPropertyAccessExpression(node)) {
      if (['skip', 'todo'].includes(node.name.text)) return true;
      node = node.expression;
    } else break;
  }
  return false;
}
const safe = (root, relative) => repositoryPath(root, relative, 'Test source');
/** Verify the title form of colocated service specs; this never executes a test or claims behavioral coverage. */
export function checkNestTests({ root, files, ruleIds } = {}) {
  const result = scriptReport('', ruleIds ?? []);
  try {
    root = fs.realpathSync(path.resolve(root)); result.repository = root;
    if (!Array.isArray(files) || !files.length || new Set(files).size !== files.length || files.some(file => !SPEC.test(file))
      || !Array.isArray(ruleIds) || !ruleIds.length || new Set(ruleIds).size !== ruleIds.length || ruleIds.some(id => !NEST_TEST_RULES.includes(id))) throw Error('Explicit colocated *.service.spec.ts files and the NEST_TEST_NAME_FORM rule are required.');
    for (const file of files) safe(root, file);
    const context = buildTypeScriptContext(loadArchitectureConfig(root));
    const { ts } = context;
    result.compiler = { version: context.loaded.version, resolved: context.loaded.resolved };
    if (context.errors.length) throw Error(context.errors.map(error => error.message).join('; '));
    for (const relative of [...files].sort()) {
      const { checker, source } = projectBinding(context, path.resolve(root, relative));
      const calls = [];
      const add = (node, message, unavailable = false) => {
        const point = source.getLineAndCharacterOfPosition(node.getStart(source));
        (unavailable ? result.errors : result.violations).push({ ruleId: 'NEST_TEST_NAME_FORM', path: relative, line: point.line + 1, column: point.character + 1, message });
      };
      const collect = node => {
        if (ts.isCallExpression(node)) {
          const api = apiName(ts, checker, node.expression);
          // .each(table) configures a curried test API; its outer call owns the title/callback.
          const configuringEach = ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'each';
          if (!configuringEach && ['describe', 'it', 'test'].includes(api) && node.arguments.length) calls.push({ node, api });
        }
        ts.forEachChild(node, collect);
      };
      collect(source);
      if (!calls.some(({ api }) => api === 'describe')) add(source, 'A service spec has an outer describe suite.');
      for (const { node, api } of calls) {
        if (api !== 'describe') {
          const title = node.arguments[0];
          if (!ts.isStringLiteralLike(title) || !title.text.trim()) add(title, 'A test has a nonempty static behavior title; .each placeholders may appear inside it.');
          else if (!NEST_TEST_TITLE_ACTIONS.includes(title.text.trim().split(/\s/)[0].toLowerCase())) add(title, 'A behavior title starts with an action from the shared test-title vocabulary.');
        }
        const callback = node.arguments.find(argument => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument));
        if (!callback && !disabledApi(ts, node.expression)) add(node, 'An enabled suite/test needs a supported statically resolved runnable callback.', Boolean(node.arguments[1]));
        if (callback) {
          const prior = node.arguments[node.arguments.indexOf(callback) - 1];
          if (prior && source.getLineAndCharacterOfPosition(prior.end).line === source.getLineAndCharacterOfPosition(callback.getStart(source)).line) add(callback, 'The test callback starts on a line after its preceding argument.');
        }
      }
      result.files.push(relative);
    }
    if (!result.errors.length) result.checkedRuleIds = [...ruleIds].sort();
  } catch (error) { result.errors.push({ message: String(error.message) }); }
  return result;
}
