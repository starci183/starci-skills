import fs from 'node:fs';
import path from 'node:path';
import { loadArchitectureConfig, slash } from '../architecture/config.mjs';
import { buildTypeScriptContext } from '../architecture/typescript.mjs';
import { moduleSpecifier, projectBinding, propertyName, repositoryPath, symbolAt, unwrap } from './common.mjs';

export const NEST_TEST_RULES = Object.freeze(['NEST_TEST_SUBJECT_FORM', 'NEST_TEST_NAME_FORM']);
const SPEC = /\.spec\.[cm]?tsx?$/;
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
function extendsSubject(ts, checker, type, targets, seen = new Set()) {
  if (!type || seen.has(type)) return false;
  seen.add(type);
  if (targets.has(type.getSymbol?.())) return true;
  return (type.getBaseTypes?.() ?? []).some(base => extendsSubject(ts, checker, base, targets, seen));
}

/** Verify test source form; this never executes a test or claims behavioral coverage. */
export function checkNestTests({ root, files, ruleIds, contextFiles = [], architectureConfig } = {}) {
  const result = { schema: 'starci/code-pattern-script@1', repository: '', files: [], requestedRuleIds: ruleIds ?? [], checkedRuleIds: [], violations: [], errors: [], compiler: null };
  try {
    root = fs.realpathSync(path.resolve(root)); result.repository = root;
    if (!Array.isArray(files) || !files.length || new Set(files).size !== files.length || files.some(file => !SPEC.test(file))
      || !Array.isArray(ruleIds) || !ruleIds.length || new Set(ruleIds).size !== ruleIds.length || ruleIds.some(id => !NEST_TEST_RULES.includes(id))) throw Error('Explicit colocated unit specs and unique supported Nest test rules are required.');
    for (const file of files) safe(root, file);
    const context = buildTypeScriptContext(loadArchitectureConfig(root, architectureConfig));
    const { ts } = context;
    result.compiler = { version: context.loaded.version, resolved: context.loaded.resolved };
    if (context.errors.length) throw Error(context.errors.map(error => error.message).join('; '));
    const boundFiles = new Set([...files, ...contextFiles]);
    for (const relative of [...files].sort()) {
      const { program, checker, source } = projectBinding(context, path.resolve(root, relative));
      const stem = relative.replace(SPEC, ''), candidates = ['ts', 'mts', 'cts', 'tsx'].map(extension => `${stem}.${extension}`)
        .filter(file => fs.existsSync(path.resolve(root, file)));
      if (candidates.length !== 1 || !boundFiles.has(candidates[0])) throw Error(`Unit spec needs its unique colocated subject in the bound source context: ${relative}`);
      const subjectFile = safe(root, candidates[0]), subject = program.getSourceFile(subjectFile);
      const module = subject && checker.getSymbolAtLocation(subject);
      if (!module) throw Error(`Subject source has no resolvable module exports: ${candidates[0]}`);
      const exports = checker.getExportsOfModule(module), targets = new Map();
      for (const exported of exports) {
        if (exported.name === 'default') continue;
        const identity = symbolAt(ts, checker, exported.declarations?.[0]?.name ?? exported.valueDeclaration?.name) ?? exported;
        const declared = identity.declarations ?? [];
        if (declared.some(node => ts.isClassDeclaration(node) || ts.isFunctionDeclaration(node)
          || (ts.isVariableDeclaration(node) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))))) targets.set(identity, exported.name);
      }
      if (!targets.size) throw Error(`Subject source has no named class/function test subject: ${candidates[0]}`);
      const targetSymbols = new Set(targets.keys()), suites = [], calls = [];
      const add = (ruleId, node, message, unavailable = false) => {
        const point = source.getLineAndCharacterOfPosition(node.getStart(source));
        (unavailable ? result.errors : result.violations).push({ ruleId, path: relative, line: point.line + 1, column: point.character + 1, message });
      };
      const collect = node => {
        if (ts.isCallExpression(node)) {
          const api = apiName(ts, checker, node.expression);
          // .each(table) configures a curried test API; its outer call owns the title/callback.
          const configuringEach = ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'each';
          if (!configuringEach && ['describe', 'it', 'test'].includes(api) && node.arguments.length) {
            calls.push({ node, api });
            if (api === 'describe' && ts.isExpressionStatement(node.parent) && node.parent.parent === source) suites.push(node);
          }
        }
        ts.forEachChild(node, collect);
      };
      collect(source);
      if (!suites.length && ruleIds.includes('NEST_TEST_NAME_FORM')) add('NEST_TEST_NAME_FORM', source, 'A selected unit spec has an outer suite naming a real exported subject.');
      const selectedTargets = new Set(), suiteTargets = new Map();
      for (const suite of suites) {
        const title = suite.arguments[0];
        let target;
        if (ts.isStringLiteralLike(title)) target = [...targets].find(([, name]) => name === title.text)?.[0];
        else if (ts.isPropertyAccessExpression(title) && title.name.text === 'name') {
          const identity = symbolAt(ts, checker, title.expression);
          if (targets.has(identity)) target = identity;
        }
        if (target) { selectedTargets.add(target); suiteTargets.set(suite, target); }
        else if (ruleIds.includes('NEST_TEST_NAME_FORM')) add('NEST_TEST_NAME_FORM', title, 'Outer describe names the actual exported subject, not an unrelated or dynamically constructed title.');
      }
      if (ruleIds.includes('NEST_TEST_NAME_FORM')) for (const { node, api } of calls) {
        if (api !== 'describe') {
          const title = node.arguments[0];
          if (!ts.isStringLiteralLike(title) || !title.text.trim()) add('NEST_TEST_NAME_FORM', title, 'A selected test has a nonempty static behavior title; .each placeholders may appear inside it.');
          else if (!NEST_TEST_TITLE_ACTIONS.includes(title.text.trim().split(/\s/)[0].toLowerCase())) add('NEST_TEST_NAME_FORM', title, 'A behavior title starts with an action from the shared test-title vocabulary.');
        }
        const callback = node.arguments.find(argument => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument));
        if (!callback && !disabledApi(ts, node.expression)) add('NEST_TEST_NAME_FORM', node, 'An enabled suite/test needs a supported statically resolved runnable callback.', Boolean(node.arguments[1]));
        if (callback) {
          const prior = node.arguments[node.arguments.indexOf(callback) - 1];
          if (prior && source.getLineAndCharacterOfPosition(prior.end).line === source.getLineAndCharacterOfPosition(callback.getStart(source)).line) add('NEST_TEST_NAME_FORM', callback, 'The selected test callback starts on a line after its preceding argument.');
        }
      }
      if (ruleIds.includes('NEST_TEST_SUBJECT_FORM')) {
        if (!selectedTargets.size) add('NEST_TEST_SUBJECT_FORM', source, 'The subject cannot be bound to a real exported class/function suite.', true);
        const invoked = new Map(suites.map(suite => [suite, new Set()]));
        const containingSuite = (input, permitOpaque = false) => {
          let runnableTest = false;
          for (let node = input; node; node = node.parent) {
            if (ts.isFunctionLike(node)) {
              const registration = node.parent;
              if (!ts.isCallExpression(registration) || !['describe', 'it', 'test'].includes(apiName(ts, checker, registration.expression))
                || !registration.arguments.includes(node)) { if (!permitOpaque) return null; }
            }
            if (ts.isCallExpression(node)) {
              const api = apiName(ts, checker, node.expression);
              if (['describe', 'it', 'test'].includes(api) && disabledApi(ts, node.expression)) return null;
              if (['it', 'test'].includes(api)) {
                const callback = node.arguments.find(argument => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument));
                if (callback && input.pos >= callback.pos && input.end <= callback.end) runnableTest = true;
              }
            }
            if (invoked.has(node)) return runnableTest ? node : null;
          }
          return null;
        };
        const writeIsSupported = input => {
          for (let node = input; node; node = node.parent) {
            if (!ts.isFunctionLike(node)) continue;
            const registration = node.parent;
            if (!ts.isCallExpression(registration) || !['describe', 'it', 'test', 'beforeEach', 'beforeAll'].includes(apiName(ts, checker, registration.expression))
              || !registration.arguments.includes(node) || disabledApi(ts, registration.expression)) return false;
          }
          return true;
        };
        const variableValues = node => {
          if (!ts.isIdentifier(node)) return [];
          const symbol = symbolAt(ts, checker, node), declaration = symbol?.valueDeclaration;
          if (!declaration || !ts.isVariableDeclaration(declaration)) return [];
          const values = declaration.initializer ? [writeIsSupported(declaration) ? declaration.initializer : null] : [];
          const findWrites = item => {
            if (ts.isBinaryExpression(item) && item.operatorToken.kind === ts.SyntaxKind.EqualsToken
              && symbolAt(ts, checker, unwrap(ts, item.left)) === symbol) values.push(writeIsSupported(item) ? item.right : null);
            ts.forEachChild(item, findWrites);
          };
          findWrites(source);
          return values;
        };
        const realTestingModule = (input, target, phase = 'module', seen = new Set(), awaited = false) => {
          const node = unwrap(ts, input);
          if (!node || seen.has(node)) return false;
          seen.add(node);
          if (ts.isAwaitExpression(node)) return realTestingModule(node.expression, target, phase, seen, true);
          if (ts.isIdentifier(node)) {
            const values = variableValues(node);
            return values.length > 0 && values.every(value => realTestingModule(value, target, phase, new Set(seen), awaited));
          }
          if (!ts.isCallExpression(node)) return false;
          const expression = unwrap(ts, node.expression);
          if (!(ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression))) return false;
          const name = propertyName(ts, expression), signature = checker.getResolvedSignature(node)?.declaration;
          if (!signature || !/\/node_modules\/@nestjs\/testing\//.test(slash(signature.getSourceFile().fileName))) return false;
          if (phase === 'module') return awaited && name === 'compile' && realTestingModule(expression.expression, target, 'builder', seen);
          if (name !== 'createTestingModule') return false;
          const api = symbolAt(ts, checker, expression.expression);
          if (api?.name !== 'Test' || !(api.declarations ?? []).some(declaration => ts.isClassDeclaration(declaration)
            && /\/node_modules\/@nestjs\/testing\//.test(slash(declaration.getSourceFile().fileName)))) return false;
          const metadata = unwrap(ts, node.arguments[0]);
          if (!metadata || !ts.isObjectLiteralExpression(metadata) || metadata.properties.some(property => ts.isSpreadAssignment(property))) return false;
          const providers = metadata.properties.find(property => ts.isPropertyAssignment(property) && property.name?.getText(source) === 'providers');
          const values = providers && unwrap(ts, providers.initializer);
          // More elaborate module factories/overrides require a supported identity adapter, not a type cast.
          return Boolean(values && ts.isArrayLiteralExpression(values) && !values.elements.some(element => ts.isSpreadElement(element))
            && values.elements.some(element => symbolAt(ts, checker, element) === target)
            && !values.elements.some(element => ts.isObjectLiteralExpression(element) && element.properties.some(property =>
              ts.isPropertyAssignment(property) && property.name?.getText(source) === 'provide' && symbolAt(ts, checker, property.initializer) === target)));
        };
        const lookupTarget = node => {
          if (!ts.isCallExpression(node)) return null;
          const expression = unwrap(ts, node.expression);
          if (!(ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression))
            || !['get', 'resolve'].includes(propertyName(ts, expression)) || !node.arguments[0]) return null;
          const identity = symbolAt(ts, checker, node.arguments[0]);
          const declaration = checker.getResolvedSignature(node)?.declaration;
          return targetSymbols.has(identity) && declaration && /\/(?:@nestjs\/testing|@nestjs\/core)\//.test(slash(declaration.getSourceFile().fileName))
            && realTestingModule(expression.expression, identity) ? identity : null;
        };
        const receiverTarget = (input, seen = new Set()) => {
          const node = unwrap(ts, input);
          if (!node || seen.has(node)) return null;
          seen.add(node);
          if (ts.isAwaitExpression(node)) return receiverTarget(node.expression, seen);
          if (ts.isNewExpression(node)) {
            const identity = symbolAt(ts, checker, node.expression);
            return targetSymbols.has(identity) ? identity : null;
          }
          const lookup = lookupTarget(node);
          if (lookup) return lookup;
          if (ts.isIdentifier(node)) {
            const identities = variableValues(node).map(value => receiverTarget(value, new Set(seen)));
            return identities.length && identities.every(identity => identity && identity === identities[0]) ? identities[0] : null;
          }
          return null;
        };
        const executeEntry = /\.(?:handler|use-case)\.[cm]?tsx?$/.test(candidates[0]);
        const opaqueHelpers = new Set();
        const activeHelpers = new Set();
        const localHelper = symbol => {
          const declarations = symbol?.declarations ?? [];
          if (declarations.length !== 1 || declarations[0].getSourceFile() !== source) return null;
          const declaration = declarations[0];
          if (ts.isFunctionDeclaration(declaration) && declaration.body) return declaration;
          if (ts.isVariableDeclaration(declaration) && declaration.initializer && (ts.getCombinedNodeFlags(declaration.parent) & ts.NodeFlags.Const)) {
            const value = unwrap(ts, declaration.initializer);
            if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) return value;
          }
          return null;
        };
        const visit = (node, helperSuite = null) => {
          if (helperSuite && ts.isFunctionLike(node)) return;
          if (ts.isCallExpression(node)) {
            const suite = helperSuite ?? containingSuite(node);
            const direct = symbolAt(ts, checker, unwrap(ts, node.expression));
            if (!suite && targetSymbols.has(direct)) {
              const enclosing = containingSuite(node, true);
              if (enclosing) opaqueHelpers.add(enclosing);
            }
            if (suite && !targetSymbols.has(direct) && (direct?.declarations ?? []).some(declaration => declaration.getSourceFile() === source
              && (ts.isFunctionDeclaration(declaration) || (ts.isVariableDeclaration(declaration) && declaration.initializer
                && (ts.isArrowFunction(unwrap(ts, declaration.initializer)) || ts.isFunctionExpression(unwrap(ts, declaration.initializer))))))) opaqueHelpers.add(suite);
            const helper = suite && !targetSymbols.has(direct) ? localHelper(direct) : null;
            // Transparent zero-argument helpers preserve lexical subject identity without interpreting arbitrary code.
            if (helper && helper.parameters.length === 0 && node.arguments.length === 0 && !activeHelpers.has(helper)) {
              activeHelpers.add(helper);
              visit(helper.body, suite);
              activeHelpers.delete(helper);
            }
            if (suite && targetSymbols.has(direct) && !(direct.declarations ?? []).some(item => ts.isClassDeclaration(item))) invoked.get(suite).add(direct);
            const expression = unwrap(ts, node.expression);
            if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
              const receiver = unwrap(ts, expression.expression), name = propertyName(ts, expression);
              const type = checker.getTypeAtLocation(receiver);
              for (const target of targetSymbols) if (extendsSubject(ts, checker, type, new Set([target]))) {
                if (!suite) { const enclosing = containingSuite(node, true); if (enclosing) opaqueHelpers.add(enclosing); }
                if (name === null) add('NEST_TEST_SUBJECT_FORM', expression, 'Dynamic selection on the subject cannot prove use of its public entry.', true);
                else {
                  const member = checker.getPropertyOfType(type, name);
                  const declarations = member?.declarations ?? [];
                  if (declarations.some(declaration => ts.getModifiers(declaration)?.some(modifier => [ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.ProtectedKeyword].includes(modifier.kind)))) {
                    add('NEST_TEST_SUBJECT_FORM', expression, 'A selected behavior spec calls the public API, not a protected/private implementation hook.');
                  } else if (!member) add('NEST_TEST_SUBJECT_FORM', expression, 'The selected subject member does not resolve to a real public API.', true);
                  else if (declarations.length && declarations.every(declaration => declaration.getSourceFile().isDeclarationFile && /\/typescript\/lib\//.test(slash(declaration.getSourceFile().fileName)))) {
                    add('NEST_TEST_SUBJECT_FORM', expression, 'Inherited language builtins do not establish a subject-owned public entry.');
                  } else if (!executeEntry && declarations.length && declarations.every(declaration => /\/node_modules\//.test(slash(declaration.getSourceFile().fileName)))) {
                    add('NEST_TEST_SUBJECT_FORM', expression, 'An inherited external member needs an explicit owned public contract before it can establish the selected service entry.', true);
                  } else if (suite && (!executeEntry || name === 'execute')) {
                    if (receiverTarget(receiver) === target) invoked.get(suite).add(target);
                    else add('NEST_TEST_SUBJECT_FORM', expression, 'The receiver must bind real constructor or Nest get/resolve values; an opaque factory or cast cannot prove real construction.', true);
                  }
                }
              }
            }
          }
          ts.forEachChild(node, child => visit(child, helperSuite));
        };
        visit(source);
        for (const [suite, target] of suiteTargets) {
          if (!invoked.get(suite).has(target)) add('NEST_TEST_SUBJECT_FORM', suite, opaqueHelpers.has(suite)
            ? 'Local helper indirection or a nested callback needs a supported call-identity adapter before the subject entry can be checked.'
            : 'A selected subject suite invokes its real public API in an enabled suite/test.', opaqueHelpers.has(suite));
        }
      }
      result.files.push(relative);
    }
    if (!result.errors.length) result.checkedRuleIds = [...ruleIds].sort();
  } catch (error) { result.errors.push({ message: String(error.message) }); }
  return result;
}
