// A proves header is a claim; reachable checker results and nonempty test cases substantiate it.
import { enforcerJudgedInEdition } from '../../hfs/edition-slots.mjs';
import { evidenceFiles, evidenceInEdition } from './coverage-inventory.mjs';
import { astChildren, astNodes, expressionReach, nodeName, resolvedExpression, sourceIndex } from './coverage-ast.mjs';
import { lintEnforcersForCode, registeredLintRules } from './coverage-routing.mjs';
import { bindPattern, evaluate, invocation, localScope, scopedWalk, UNKNOWN } from './coverage-evaluation.mjs';
import { resultReach, returnedExpressions } from './coverage-results.mjs';
import { collectorExpressions, collectorFacadeInvocation } from './coverage-collectors.mjs';

const NEGATIVE = /\b(?:invalid|violat\w*|refus\w*|reject\w*|deni\w*|fail\w*|negative|forbid\w*|missing)\b/i;
const POSITIVE = /\b(?:valid|pass\w*|accept\w*|conform\w*|positive|clean)\b/i;
const assertions = new Set(['ok', 'equal', 'strictEqual', 'deepEqual', 'deepStrictEqual', 'match', 'throws', 'rejects', 'doesNotThrow', 'doesNotReject', 'notEqual', 'notDeepEqual']);
const sourceFamilies = new Set(['machine', 'hfs', 'runtime', 'work-validate', 'sonar']);
const analysisCaches = new WeakMap();

function claimsProof(text, code, edition) {
  return text.split(/\r?\n/).some((line) => /^\s*\/\/\s*proves:\s*/.test(line)
    && line.replace(/^\s*\/\/\s*proves:\s*/, '').split(/[\s,]+/).includes(`${code}@${edition}`));
}

const titleOf = (node) => node?.type === 'TemplateLiteral' ? node.quasis.map((part) => part.value.cooked).join(' edition ') : String(node?.value ?? '');

function testCall(index, node) {
  if (node.type !== 'CallExpression') return false;
  const callee = node.callee;
  const imported = index.imports.get(callee.name ?? callee.object?.name);
  if (!['node:test', 'mocha', 'vitest'].includes(imported?.source)) return false;
  return callee.type === 'Identifier' || ['test', 'it'].includes(nodeName(callee.property));
}

function testsInEdition(context, index, edition) {
  const out = [];
  scopedWalk(context, localScope(index), index.tree, (scope, node, enclosingEdition) => {
    if (!testCall(scope, node)) return;
    const value = evaluate(context, scope, node.arguments[0]);
    const title = value === UNKNOWN ? titleOf(node.arguments[0]) : String(value);
    const named = title.split(/[^A-Za-z]+/).includes(edition);
    if (enclosingEdition ? enclosingEdition === edition : named) out.push({ title, node: node.arguments.at(-1), index: localScope(scope) });
    return false;
  });
  return out;
}

function assertionCall(index, node) {
  if (node.type !== 'CallExpression') return false;
  const callee = node.callee;
  const name = callee.name ?? callee.object?.name;
  const imported = index.imports.get(name);
  if (!['node:assert', 'node:assert/strict', 'assert', 'assert/strict'].includes(imported?.source)) return false;
  return callee.type === 'Identifier' || assertions.has(nodeName(callee.property));
}

function testerReceiver(context, index, node) {
  const reach = expressionReach(context, index, node);
  return [...reach].some(([file, nodes]) => {
    const source = sourceIndex(context, file);
    return nodes.some((entry) => entry.type === 'NewExpression' && source.imports.get(entry.callee.name)?.source === 'eslint'
      && source.imports.get(entry.callee.name)?.name === 'RuleTester');
  });
}

function testerRun(context, index, node) {
  if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression' || nodeName(node.callee.property) !== 'run') return null;
  const id = evaluate(context, index, node.arguments[0]);
  if (typeof id !== 'string' || !testerReceiver(context, index, node.callee.object)) return null;
  const cases = evaluate(context, index, node.arguments[2]);
  return { id, implementation: expressionReach(context, index, node.arguments[1]),
    complete: Boolean(Array.isArray(cases?.valid) && cases.valid.length && Array.isArray(cases?.invalid) && cases.invalid.length) };
}

function nodeContainsCode(context, file, nodes, code, reached) {
  const source = sourceIndex(context, file);
  return nodes.some((node) => codeLiteral(node, code) || importedCode(context, source, node, code, reached))
    || !source.tree;
}

function codeLiteral(node, code) {
  if (node?.type === 'Literal') return typeof node.value === 'string' && node.value.includes(code);
  return node?.type === 'TemplateLiteral' && node.quasis.some((part) => part.value.cooked?.includes(code));
}

function importedCode(context, index, node, code, reached) {
  if (node.type !== 'Identifier' || !index.imports.has(node.name)) return false;
  const resolved = resolvedExpression(context, index, node);
  return codeLiteral(resolved.node, code) && reached.get(resolved.index.file)?.includes(resolved.node);
}

function reachedExportKeys(context, file, nodes) {
  const index = sourceIndex(context, file);
  const reached = new Set(nodes);
  return [...index.exports].filter(([, node]) => reached.has(resolvedExpression(context, index, node).node))
    .map(([name]) => `${file}#${name}`);
}

function assertionTargets(context, assertion, code, delegatedFiles) {
  const out = new Set();
  for (const [file, reached] of assertion.reached) {
    if (file === assertion.index.file) continue;
    if (nodeContainsCode(context, file, reached, code, assertion.reached)) {
      out.add(file);
      reachedExportKeys(context, file, reached).forEach((key) => out.add(key));
    } else if (delegatedFiles.has(file)) delegatedTargets(context, file, reached, code).forEach((key) => out.add(key));
  }
  return out;
}

// A wrapper owns the proof when its returned value consumes a code-bearing checker.
// Calls whose results are discarded cannot lend their code to the wrapper's return.
function returnedCode(context, index, node, code, seen = new Set()) {
  if (!node || seen.has(node)) return false;
  const next = new Set(seen).add(node);
  const resolved = resolvedExpression(context, index, node);
  if (resolved.node !== node) return returnedCode(context, resolved.index, resolved.node, code, next);
  if (codeLiteral(node, code)) return true;
  if (node.type === 'CallExpression') {
    const target = invocation(context, index, node) ?? collectorFacadeInvocation(context, index, node);
    if (target) return functionReturnsCode(context, target, code, next);
  }
  if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type)) return false;
  return astChildren(node).some((child) => returnedCode(context, index, child, code, next));
}

function functionReturnsCode(context, target, code, seen = new Set()) {
  if (seen.has(target.node)) return false;
  const next = new Set(seen).add(target.node);
  const reached = expressionReach(context, localScope(target.index), target.node);
  const local = reached.get(target.index.file) ?? [];
  if (local.some((node) => codeLiteral(node, code))) return true;
  const reachableCode = [...reached.values()].some(nodes => nodes.some(node => codeLiteral(node, code)));
  const reachableFacade = !reachableCode && [...reached].some(([file, nodes]) => nodes.some(node =>
    node.type === 'CallExpression' && collectorFacadeInvocation(context, sourceIndex(context, file), node)));
  if (!reachableCode && !reachableFacade) return false;
  const returns = returnedExpressions(context, target);
  if (collectorExpressions(context, target, returns).some(entry => returnedCode(context, entry.index, entry.node, code, next))) return true;
  if (!reachableCode) return false;
  return returns.some(entry => returnedCode(context, entry.index, entry.node, code, next));
}

function delegatedTargets(context, file, reached, code) {
  const index = sourceIndex(context, file);
  const nodes = new Set(reached);
  return [...index.exports].flatMap(([name, expression]) => {
    const target = resolvedExpression(context, index, expression);
    if (!nodes.has(target.node) || !['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(target.node?.type)) return [];
    return declarationReturnsCode(context, target, code) ? [file, `${file}#${name}`] : [];
  });
}

function declarationReturnsCode(context, target, code) {
  const declarations = analysisCaches.get(context.files).declarations;
  let codes = declarations.get(target.node);
  if (!codes) { codes = new Map(); declarations.set(target.node, codes); }
  if (codes.has(code)) return codes.get(code);
  const scope = localScope(target.index);
  target.node.params.forEach((parameter) => bindPattern(context, scope, parameter,
    { index: scope, node: { type: 'Literal', value: UNKNOWN } }));
  const result = functionReturnsCode(context, { index: scope, node: target.node }, code);
  codes.set(code, result);
  return result;
}

function expectationRole(node, title, code, expected) {
  const out = new Set();
  const role = expectedRole(expected, code);
  if (role) out.add(role);
  if (['throws', 'rejects'].includes(nodeName(node.callee.property))) out.add('violating');
  if (nodeName(node.callee.property) === 'ok' && node.arguments[0]?.type === 'UnaryExpression' && node.arguments[0].operator === '!') out.add('passing');
  if (!out.size) {
    if (POSITIVE.test(title)) out.add('passing');
    if (NEGATIVE.test(title)) out.add('violating');
  }
  return out;
}

function expectedRole(expected, code) {
  if (Array.isArray(expected)) return expected.length ? 'violating' : 'passing';
  if (typeof expected === 'number') return expected > 0 ? 'violating' : 'passing';
  if (typeof expected === 'boolean') return expected ? 'violating' : 'passing';
  return expected === code ? 'violating' : null;
}

function assertionClaims(context, index, assertion) {
  const name = nodeName(assertion.callee.property) ?? assertion.callee.name;
  const argumentsToCheck = assertion.arguments.slice(0, name === 'ok' ? 1 : 2);
  const out = new Set();
  for (const argument of argumentsToCheck) {
    for (const nodes of resultReach(context, index, argument, { helpersOnly: true }).values()) {
      for (const node of nodes) if (node.type === 'Literal') out.add(node.value);
    }
  }
  return out;
}

function testAnalysis(context, index, test) {
  const checked = [];
  const runs = [];
  const callback = resolvedExpression(context, test.index ?? index, test.node);
  scopedWalk(context, localScope(callback.index), callback.node?.body, (current, node) => {
    const run = testerRun(context, current, node);
    if (run) runs.push(run);
    if (!assertionCall(current, node)) return;
    checked.push({ index: current, node, expected: evaluate(context, current, node.arguments[1]),
      reached: resultReach(context, current, node.arguments[0]),
      claims: assertionClaims(context, current, node) });
    return false;
  });
  return { checked, runs, title: test.title };
}

function testEvidence(context, analysis, code, delegatedFiles) {
  const roles = new Map();
  for (const assertion of analysis.checked) {
    for (const target of assertionTargets(context, assertion, code, delegatedFiles)) {
      const proven = roles.get(target) ?? new Set();
      expectationRole(assertion.node, analysis.title, code, assertion.expected).forEach((role) => {
        if (role !== 'violating' || assertion.claims.has(code)) proven.add(role);
      });
      roles.set(target, proven);
    }
  }
  return { roles, runs: analysis.runs };
}

function cachedTests(context, file, edition) {
  let cache = analysisCaches.get(context.files);
  if (!cache || cache.sources.size !== context.files.size
    || ![...cache.sources].every(([name, text]) => context.files.get(name) === text)) {
    cache = { sources: new Map(context.files), tests: new Map(), declarations: new WeakMap() };
    analysisCaches.set(context.files, cache);
  }
  const key = `${file}@${edition}`;
  if (!cache.tests.has(key)) {
    const index = sourceIndex(context, file);
    cache.tests.set(key, testsInEdition(context, index, edition).map((test) => testAnalysis(context, index, test)));
  }
  return cache.tests.get(key);
}

function sourceEvidence(context, rule, code, edition) {
  const proofs = [];
  const delegatedFiles = new Set(activeSourceEnforcers(context, rule, code, edition).map((entry) => entry.at));
  for (const ref of rule.proves ?? []) {
    if (!evidenceInEdition(ref, edition) || ref.codes && !ref.codes.includes(code)) continue;
    for (const file of evidenceFiles(context.files, ref).filter((name) => name.endsWith('.spec.mjs'))) {
      const index = sourceIndex(context, file);
      if (!claimsProof(index.text, code, edition)) continue;
      const tests = cachedTests(context, file, edition);
      proofs.push({ file, tests: tests.map((entry) => testEvidence(context, entry, code, delegatedFiles)) });
    }
  }
  return proofs;
}

function helperSpecs(context, ref) {
  const helpers = new Set(evidenceFiles(context.files, ref));
  return [...context.files.keys()].filter((file) => {
    if (!file.endsWith('.spec.mjs')) return false;
    const index = sourceIndex(context, file);
    return [...index.imports.values()].some((entry) => helpers.has(entry.file));
  });
}

function helperIsUsed(context, file, ref, edition) {
  const helpers = new Set(evidenceFiles(context.files, ref));
  const index = sourceIndex(context, file);
  return testsInEdition(context, index, edition).some((test) =>
    [...expressionReach(context, index, test.node).keys()].some((target) => helpers.has(target)));
}

function sourceOwnsCode(context, file, code) {
  const index = sourceIndex(context, file);
  // Keep conservative ownership for declarative sources outside the JS parser.
  if (!index.tree) return index.text.includes(code);
  if (astNodes(index.tree).some((node) => codeLiteral(node, code))) return true;
  // Delegating wrappers still need proof that they consume the checker's findings.
  return [...index.exports.values()].some((expression) => {
    const target = resolvedExpression(context, index, expression);
    return ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(target.node?.type)
      && ([...expressionReach(context, target.index, target.node).values()]
        .some((nodes) => nodes.some((node) => codeLiteral(node, code)))
        || functionReturnsCode(context, target, code));
  });
}

function activeSourceEnforcers(context, rule, code, edition) {
  return (rule.enforcers ?? []).filter((entry) => sourceFamilies.has(entry.kind) && !entry.planned && entry.status !== 'planned'
    && entry.at && context.files.has(entry.at) && sourceOwnsCode(context, entry.at, code)
    && enforcerJudgedInEdition(context.catalog.rules, entry.kind, entry.id, edition));
}

function sourceIdentity(context, entry) {
  const index = sourceIndex(context, entry.at);
  const name = entry.id.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
  const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
  const candidates = [name, `check${capitalized}`, `${name}Findings`];
  const exported = candidates.find((candidate) => ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']
    .includes(resolvedExpression(context, index, index.exports.get(candidate)).node?.type));
  return exported ? `${entry.at}#${exported}` : entry.at;
}

function sourceProven(context, proofs, entry) {
  const identity = sourceIdentity(context, entry);
  const roles = new Set(proofs.flatMap((proof) => proof.tests.flatMap((test) => [...test.roles.get(identity) ?? []])));
  return roles.has('passing') && roles.has('violating');
}

function lintProven(context, proofs, entry) {
  const implementation = registeredLintRules(context, entry.kind).get(entry.id);
  const target = implementation?.expression && resolvedExpression(context, implementation.index, implementation.expression);
  const file = target?.index.file ?? implementation?.file;
  return proofs.some((proof) => proof.tests.some((test) => test.runs.some((run) => run.id === entry.id && run.complete
    && run.implementation.has(file) && (!target?.node || run.implementation.get(file).includes(target.node)))));
}

export function coverageProofFindings(context, rule, code, edition) {
  const proofs = sourceEvidence(context, rule, code, edition);
  if (!proofs.length) return [];
  const missing = activeSourceEnforcers(context, rule, code, edition).filter((entry) => !sourceProven(context, proofs, entry));
  missing.push(...lintEnforcersForCode(context, rule, code, edition).filter((entry) => !lintProven(context, proofs, entry)));
  const meaningful = proofs.some((proof) => proof.tests.some((test) => test.roles.size || test.runs.some((run) => run.complete)));
  if (!missing.length && meaningful) return [];
  const details = missing.length ? missing.map((entry) => `${entry.kind}:${entry.id}`).join(', ') : 'an invoked checker and result assertion';
  return [{ code: 'RT_COVERAGE_PROOF_VACUOUS', level: 'error', rule: rule.id, edition, path: proofs[0].file,
    message: `${rule.id} ${edition}: ${code} has a proves header without nonempty passing and violating evidence for ${details}` }];
}

/** Spec evidence can also name a helper; its edition claim must still exercise and assert a checker. */
export function claimedSpecProof(context, ref, code, edition) {
  if (!evidenceInEdition(ref, edition)) return false;
  const direct = sourceEvidence(context, { proves: [ref] }, code, edition);
  if (direct.some(completeClaimedProof)) return true;
  const specs = helperSpecs(context, ref).filter((file) => helperIsUsed(context, file, ref, edition));
  const proofs = sourceEvidence(context, { proves: [ref, ...specs] }, code, edition);
  return proofs.some(completeClaimedProof);
}

function completeClaimedProof(proof) {
  const passing = new Set();
  const violating = new Set();
  for (const test of proof.tests) {
    if (test.runs.some((run) => run.complete)) return true;
    for (const [file, roles] of test.roles) {
      if (roles.has('passing')) passing.add(file);
      if (roles.has('violating')) violating.add(file);
    }
  }
  return [...passing].some((file) => violating.has(file));
}
