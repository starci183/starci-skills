// Docker API liveness reachability through the app module graph and its health probe.
import path from 'node:path';
import { literalText as tsLiteral, variableInitializerGroups } from '../../lib/ts-ast.mjs';
import { execForm, shellCommands } from '../../lib/dockerfile.mjs';
import { readText } from './read.mjs';

/** Resolve only app-owned source imports; health routes must be reachable from this app's module composition. */
function healthSourceBase(filename, source) {
  if (source.startsWith('.')) return path.posix.normalize(path.posix.join(path.posix.dirname(filename), source));
  if (source.startsWith('@features/')) return `be/src/features/${source.slice(10)}`;
  if (source.startsWith('@modules/')) return `be/src/modules/${source.slice(9)}`;
  return null;
}

function healthSourcePath(repoRoot, filename, source) {
  const base = healthSourceBase(filename, source);
  if (!base || base.startsWith('../')) return null;
  return [base, `${base}.ts`, `${base}/index.ts`].find((candidate) => readText(repoRoot, candidate) !== null) ?? null;
}

const tsDecorators = (ts, node) => ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : [];
const tsDecoratorCall = (ts, node, name) => tsDecorators(ts, node).map((entry) => entry.expression).find((entry) => ts.isCallExpression(entry) && ts.isIdentifier(entry.expression) && entry.expression.text === name);

function collectHealthUsage(ts, node, state, seen = new Set()) {
  if (ts.isIdentifier(node)) {
    state.used.add(node.text);
    if (state.bindings.has(node.text) && !seen.has(node.text)) collectHealthUsage(ts, state.bindings.get(node.text), state, new Set(seen).add(node.text));
  }
  ts.forEachChild(node, (child) => collectHealthUsage(ts, child, state, seen));
}

function collectHealthModuleObject(ts, node, state) {
  if (!node || !ts.isObjectLiteralExpression(node)) return;
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name = property.name.getText(state.source).replace(/^['"]|['"]$/g, '');
    if (['imports', 'controllers'].includes(name)) collectHealthUsage(ts, property.initializer, state);
  }
}

function collectHealthReturns(ts, node, state) {
  const expression = node.expression;
  if (ts.isReturnStatement(node) && expression && ts.isObjectLiteralExpression(expression)
      && expression.properties.some((property) => property.name?.getText(state.source) === 'module')) collectHealthModuleObject(ts, expression, state);
  ts.forEachChild(node, (child) => collectHealthReturns(ts, child, state));
}

function collectHealthClassWiring(ts, node, state) {
  collectHealthModuleObject(ts, tsDecoratorCall(ts, node, 'Module')?.arguments[0], state);
  for (const method of node.members) {
    if (method.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword)) collectHealthReturns(ts, method, state);
  }
}

function collectHealthExportNames(ts, node, state) {
  if (!ts.isExportDeclaration(node) || node.moduleSpecifier || !node.exportClause || !ts.isNamedExports(node.exportClause)) return;
  for (const entry of node.exportClause.elements) {
    if (!state.wanted || state.wanted.includes(entry.name.text)) state.used.add((entry.propertyName ?? entry.name).text);
  }
}

function collectHealthWiring(ts, node, state) {
  const { wanted } = state;
  if (ts.isClassDeclaration(node) && (!wanted || wanted.includes(node.name?.text))) collectHealthClassWiring(ts, node, state);
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && wanted?.includes(node.name.text) && node.initializer) collectHealthUsage(ts, node.initializer, state);
  if (ts.isFunctionDeclaration(node) && wanted?.includes(node.name?.text) && node.body) collectHealthUsage(ts, node.body, state);
  collectHealthExportNames(ts, node, state);
  ts.forEachChild(node, (child) => collectHealthWiring(ts, child, state));
}

function healthWiringNames(ts, source, wanted) {
  const bindings = new Map([...variableInitializerGroups(ts, source)].map(([name, initializers]) => [name, initializers.at(-1)]));
  const state = { source, wanted, used: new Set(), bindings };
  collectHealthWiring(ts, source, state);
  return state.used;
}

function sourceHasLiveRoute(ts, source, wanted, used) {
  const isLiveController = (node) => {
    if (!ts.isClassDeclaration(node)) return false;
    if (wanted && !wanted.includes(node.name?.text) && !used.has(node.name?.text)) return false;
    if (tsLiteral(ts, tsDecoratorCall(ts, node, 'Controller')?.arguments[0]) !== 'health') return false;
    return node.members.some((member) => tsLiteral(ts, tsDecoratorCall(ts, member, 'Get')?.arguments[0]) === 'live');
  };
  return source.statements.filter((node) => !ts.isImportDeclaration(node)).some((node) => tsSome(ts, node, isLiveController));
}

function healthImportNames(ts, clause, used) {
  const bindings = clause?.namedBindings;
  if (bindings && ts.isNamedImports(bindings)) {
    return bindings.elements.filter((entry) => !entry.isTypeOnly && used.has(entry.name.text)).map((entry) => (entry.propertyName ?? entry.name).text);
  }
  return [clause?.name?.text].filter((name) => used.has(name));
}

function healthImportTargets({ repoRoot, filename, ts, source, used }) {
  const targets = [];
  for (const statement of source.statements.filter((node) => ts.isImportDeclaration(node))) {
    const clause = statement.importClause;
    if (clause?.isTypeOnly) continue;
    const imported = healthImportNames(ts, clause, used);
    if (!imported.length) continue;
    const target = healthSourcePath(repoRoot, filename, statement.moduleSpecifier.text);
    if (target) targets.push({ filename: target, wanted: imported });
  }
  return targets;
}

function healthExportTargets({ repoRoot, filename, ts, source, wanted }) {
  const targets = [];
  for (const statement of source.statements.filter((node) => ts.isExportDeclaration(node) && node.moduleSpecifier && !node.isTypeOnly)) {
    const target = healthSourcePath(repoRoot, filename, statement.moduleSpecifier.text);
    let exported = wanted;
    if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      exported = statement.exportClause.elements.filter((entry) => !wanted || wanted.includes(entry.name.text)).map((entry) => (entry.propertyName ?? entry.name).text);
    }
    if (target && (!exported || exported.length)) targets.push({ filename: target, wanted: exported });
  }
  return targets;
}

/** Find GET /health/live in the local import closure, excluding unused imports and type-only imports. */
function apiLiveRoute({ repoRoot, app, ts }) {
  const pending = [{ filename: `be/apps/${app}/src/app.module.ts`, wanted: ['AppModule'] }];
  const visited = new Set();
  while (pending.length) {
    const { filename, wanted } = pending.pop();
    const identity = `${filename}:${wanted?.join(',') ?? '*'}`;
    if (visited.has(identity)) continue;
    visited.add(identity);
    const text = readText(repoRoot, filename);
    if (text === null) continue;
    const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true);
    const used = healthWiringNames(ts, source, wanted);
    if (sourceHasLiveRoute(ts, source, wanted, used)) return true;
    pending.push(
      ...healthImportTargets({ repoRoot, filename, ts, source, used }),
      ...healthExportTargets({ repoRoot, filename, ts, source, wanted }),
    );
  }
  return false;
}

/** Keep literal URL pieces while substituting the runtime's declared port for a dynamic expression. */
function probeUrlText(ts, node, port) {
  if (!node) return null;
  const literal = tsLiteral(ts, node);
  if (literal !== null) return literal;
  if (ts.isParenthesizedExpression(node)) return probeUrlText(ts, node.expression, port);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = probeUrlText(ts, node.left, port);
    const right = probeUrlText(ts, node.right, port);
    return left === null && right === null ? null : `${left ?? port}${right ?? port}`;
  }
  if (ts.isTemplateExpression(node)) return node.head.text + node.templateSpans.map((entry) => `${port}${entry.literal.text}`).join('');
  return null;
}

function localLiveUrl(value, port) {
  try {
    const url = new URL(value.replace(/\$\{?PORT\}?/g, port));
    return url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      && (url.port || '80') === port && url.pathname === '/health/live';
  } catch { return false; }
}

function tsSome(ts, node, predicate) {
  if (!node) return false;
  if (predicate(node)) return true;
  let foundNode = false;
  ts.forEachChild(node, (child) => { if (tsSome(ts, child, predicate)) foundNode = true; });
  return foundNode;
}

const failedExit = (ts, node) => ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
  && node.expression.expression.getText() === 'process' && node.expression.name.text === 'exit'
  && node.arguments[0] && ts.isNumericLiteral(node.arguments[0]) && Number(node.arguments[0].text) > 0;
const responseStatus = (ts, node, response) => tsSome(ts, node, (entry) => ts.isPropertyAccessExpression(entry)
  && ts.isIdentifier(entry.expression) && entry.expression.text === response && ['ok', 'status', 'statusCode'].includes(entry.name.text));

/** The failure exit must belong to the callback consuming this response, and depend on that response's status. */
function responseFails(ts, callback) {
  if (!callback || !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) return false;
  const response = callback.parameters[0]?.name;
  if (!response || !ts.isIdentifier(response)) return false;
  return tsSome(ts, callback.body, (node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText() === 'process' && node.expression.name.text === 'exit') {
      const arg = node.arguments[0];
      return arg && ts.isConditionalExpression(arg) && responseStatus(ts, arg.condition, response.text)
        && [arg.whenTrue, arg.whenFalse].some((entry) => ts.isNumericLiteral(entry) && Number(entry.text) > 0);
    }
    return ts.isIfStatement(node) && responseStatus(ts, node.expression, response.text)
      && tsSome(ts, node.thenStatement, (entry) => failedExit(ts, entry) || ts.isThrowStatement(entry));
  });
}

function chainedCall(ts, node, name) {
  const member = node.parent;
  return member && ts.isPropertyAccessExpression(member) && member.expression === node && member.name.text === name
    && member.parent && ts.isCallExpression(member.parent) ? member.parent : null;
}

function nodeProbeReachesLive(ts, code, port) {
  const source = ts.createSourceFile('healthcheck.js', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  return tsSome(ts, source, (node) => {
    if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || node.expression.text !== 'fetch') return false;
    const url = probeUrlText(ts, node.arguments[0], port);
    if (!url || !localLiveUrl(url, port)) return false;
    for (let parent = node.parent; parent && parent !== source; parent = parent.parent) {
      if (ts.isFunctionDeclaration(parent) || ts.isFunctionExpression(parent) || ts.isArrowFunction(parent) || ts.isIfStatement(parent) || ts.isConditionalExpression(parent)) return false;
    }
    const consumed = chainedCall(ts, node, 'then');
    if (!consumed || !responseFails(ts, consumed.arguments[0])) return false;
    const rejected = chainedCall(ts, consumed, 'catch')?.arguments[0] ?? consumed.arguments[1];
    return rejected && (ts.isArrowFunction(rejected) || ts.isFunctionExpression(rejected)) && tsSome(ts, rejected.body, (entry) => failedExit(ts, entry));
  });
}

/** A shell health probe cannot erase a failure through a pipeline, fallback, or later independent command. */
function masksProbeFailure(body) {
  let quote = null;
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char === '\\') { index += 1; continue; }
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === ';' || char === '|') return true;
  }
  return false;
}

function healthCommandReachesLive(ts, body, port) {
  const exec = execForm(body);
  if (!exec && masksProbeFailure(body)) return false;
  const commands = exec ? [exec] : shellCommands(body);
  if (commands.at(-1)?.[0] === 'true' || commands.at(-1)?.join(' ') === 'exit 0') return false;
  return commands.some((parts) => {
    const tool = parts[0];
    if (['sh', '/bin/sh', 'bash', '/bin/bash'].includes(tool) && parts.includes('-c')) return healthCommandReachesLive(ts, parts[parts.indexOf('-c') + 1] ?? '', port);
    if (['curl', 'wget'].includes(tool)) return (tool === 'wget' || parts.some((arg) => arg === '--fail' || /^-[^-]*f/.test(arg))) && parts.slice(1).some((arg) => localLiveUrl(arg, port));
    if (tool !== 'node' || !parts.includes('-e')) return false;
    return nodeProbeReachesLive(ts, parts[parts.indexOf('-e') + 1] ?? '', port);
  });
}

/** Whether the API image probes a registered local liveness route and propagates probe failure. */
export function healthProbeReachesLive({ repoRoot, app, ts, body, port }) {
  return healthCommandReachesLive(ts, body, port) && apiLiveRoute({ repoRoot, app, ts });
}
