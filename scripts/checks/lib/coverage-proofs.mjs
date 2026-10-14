// A proves header is a claim; reachable checker results and nonempty test cases substantiate it.
import { enforcerJudgedInEdition } from '../../hfs/edition-slots.mjs';
import { evidenceFiles, evidenceInEdition } from './coverage-inventory.mjs';
import { astChildren, expressionReach, nodeName, propertyOf, resolvedExpression, sourceIndex, staticValues } from './coverage-ast.mjs';
import { lintEnforcersForCode, registeredLintRules } from './coverage-routing.mjs';

const NEGATIVE = /\b(?:invalid|violat\w*|refus\w*|reject\w*|deni\w*|fail\w*|negative|forbid\w*|missing)\b/i;
const POSITIVE = /\b(?:valid|pass\w*|accept\w*|conform\w*|positive|clean)\b/i;
const assertions = new Set(['ok', 'equal', 'strictEqual', 'deepEqual', 'deepStrictEqual', 'match', 'throws', 'rejects', 'doesNotThrow', 'doesNotReject', 'notEqual', 'notDeepEqual']);
const sourceFamilies = new Set(['machine', 'hfs', 'runtime', 'work-validate', 'sonar']);

export function claimsProof(text, code, edition) {
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
  const pending = index.tree ? [{ node: index.tree, editions: [] }] : [];
  while (pending.length) {
    const current = pending.pop();
    let editions = current.editions;
    if (current.node.type === 'ForOfStatement') editions = staticValues(context, index, current.node.right).filter((value) => ['lite', 'full'].includes(value));
    if (testCall(index, current.node)) {
      const title = titleOf(current.node.arguments[0]);
      const named = title.split(/[^A-Za-z]+/).includes(edition);
      const callback = current.node.arguments.at(-1);
      if (named || editions.includes(edition)) out.push({ title, node: callback });
    }
    pending.push(...astChildren(current.node).map((node) => ({ node, editions })));
  }
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

function nonemptyCases(context, index, node) {
  const resolved = resolvedExpression(context, index, node);
  if (resolved.node?.type !== 'ArrayExpression') return false;
  return resolved.node.elements.some((entry) => entry && (entry.type !== 'SpreadElement' || nonemptyCases(context, resolved.index, entry.argument)));
}

function testerRun(context, index, node) {
  if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression' || nodeName(node.callee.property) !== 'run') return null;
  if (typeof node.arguments[0]?.value !== 'string' || !testerReceiver(context, index, node.callee.object)) return null;
  const cases = node.arguments[2];
  const valid = propertyOf(context, index, cases, 'valid');
  const invalid = propertyOf(context, index, cases, 'invalid');
  return { id: node.arguments[0].value, implementation: expressionReach(context, index, node.arguments[1]),
    complete: Boolean(valid && invalid && nonemptyCases(context, valid.index, valid.node) && nonemptyCases(context, invalid.index, invalid.node)) };
}

function nodeContainsCode(context, file, nodes, code) {
  const source = sourceIndex(context, file);
  return nodes.some((node) => node.type === 'Literal' && typeof node.value === 'string' && node.value.includes(code))
    || !source.tree;
}

function reachedExportKeys(context, file, nodes) {
  const index = sourceIndex(context, file);
  const reached = new Set(nodes);
  return [...index.exports].filter(([, node]) => reached.has(resolvedExpression(context, index, node).node))
    .map(([name]) => `${file}#${name}`);
}

function assertionTargets(context, index, node, code) {
  const out = new Set();
  const actual = node.arguments[0];
  for (const [file, reached] of expressionReach(context, index, actual)) {
    if (file === index.file || !nodeContainsCode(context, file, reached, code)) continue;
    out.add(file);
    reachedExportKeys(context, file, reached).forEach((key) => out.add(key));
  }
  return out;
}

function expectationRole(node, title) {
  const out = new Set();
  if (POSITIVE.test(title)) out.add('passing');
  if (NEGATIVE.test(title)) out.add('violating');
  const expected = node.arguments[1];
  if (expected?.type === 'ArrayExpression') out.add(expected.elements.length ? 'violating' : 'passing');
  if (expected?.type === 'Literal' && typeof expected.value === 'number') out.add(expected.value > 0 ? 'violating' : 'passing');
  if (['throws', 'rejects'].includes(nodeName(node.callee.property))) out.add('violating');
  return out;
}

function assertionClaimsCode(context, index, assertion, code) {
  const pending = assertion.arguments.map((node) => ({ index, node }));
  const seen = new Set();
  while (pending.length) {
    const current = pending.pop();
    const key = [current.index.file, current.node.type, current.node.start, current.node.end].join(':');
    if (seen.has(key)) continue;
    seen.add(key);
    if (current.node.type === 'Literal' && current.node.value === code) return true;
    const resolved = resolvedExpression(context, current.index, current.node);
    const callable = ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(resolved.node?.type);
    const helper = resolved.index.file.startsWith('tests/') || resolved.index.file.endsWith('.spec.mjs');
    if (resolved.node !== current.node && resolved.node && (!callable || helper)) pending.push(resolved);
    pending.push(...astChildren(current.node).map((node) => ({ index: current.index, node })));
  }
  return false;
}

function testEvidence(context, index, test, code) {
  const roles = new Map();
  const runs = [];
  const reached = expressionReach(context, index, test.node);
  for (const [file, nodes] of reached) {
    const current = sourceIndex(context, file);
    for (const node of nodes) {
      const run = testerRun(context, current, node);
      if (run) runs.push(run);
      if (!assertionCall(current, node)) continue;
      const targets = assertionTargets(context, current, node, code);
      const claimed = assertionClaimsCode(context, current, node, code);
      for (const target of targets) {
        const proven = roles.get(target) ?? new Set();
        expectationRole(node, test.title).forEach((role) => {
          if (role !== 'violating' || claimed) proven.add(role);
        });
        roles.set(target, proven);
      }
    }
  }
  return { roles, runs };
}

function sourceEvidence(context, rule, code, edition) {
  const proofs = [];
  for (const ref of rule.proves ?? []) {
    if (!evidenceInEdition(ref, edition) || ref.codes && !ref.codes.includes(code)) continue;
    for (const file of evidenceFiles(context.files, ref).filter((name) => name.endsWith('.spec.mjs'))) {
      const index = sourceIndex(context, file);
      if (!claimsProof(index.text, code, edition)) continue;
      const tests = testsInEdition(context, index, edition);
      proofs.push({ file, tests: tests.map((entry) => testEvidence(context, index, entry, code)) });
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

function activeSourceEnforcers(context, rule, code, edition) {
  return (rule.enforcers ?? []).filter((entry) => sourceFamilies.has(entry.kind) && !entry.planned && entry.status !== 'planned'
    && entry.at && context.files.has(entry.at) && String(context.files.get(entry.at)).includes(code)
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
  const target = implementation?.expression && resolvedExpression(context, implementation.index, implementation.expression).node;
  return proofs.some((proof) => proof.tests.some((test) => test.runs.some((run) => run.id === entry.id && run.complete
    && run.implementation.has(implementation?.file) && (!target || run.implementation.get(implementation.file).includes(target)))));
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
  const specs = helperSpecs(context, ref).filter((file) => helperIsUsed(context, file, ref, edition));
  const proofs = sourceEvidence(context, { proves: [ref, ...specs] }, code, edition);
  return proofs.some((proof) => {
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
  });
}
