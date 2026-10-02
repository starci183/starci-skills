import fs from 'node:fs';
import path from 'node:path';
import { checkerScope } from './required-files.mjs';
import { allowsFile } from '../allows.mjs';
import { unwrapEach } from './typescript.mjs';

/**
 * R47 `contract-fixture-guard` (BE_CONTRACT_UNGUARDED). A fake at the network edge serves payload fixtures; a fixture drifts
 * from the real provider silently unless a sandbox contract spec compares them. So every `fakes/<provider>/` of the test
 * world that holds payload fixtures (`payloads/*.json`) needs at least one `src/tests/contract/<provider>/*.contract-spec.ts`
 * (slot be.tests.contract) that, in its AST,
 *   1. references that provider's fixtures: a call whose argument is the provider's name as a string literal (the world's
 *      fixture accessor, `renderPayload("<provider>", ...)`), an import from `fakes/<provider>/`, or a string that names
 *      `fakes/<provider>/`; and
 *   2. compares shapes: an `expect(<... shapeOf(real) ...>).toEqual(<... shapeOf(fixture) ...>)` (or `toStrictEqual`), where
 *      `shapeOf` is the helper the world vocabulary names (knowledge/hfs/slots.yaml ruleParams.be.contractShape.helper) and
 *      is imported, never declared in the spec.
 * A fake with fixtures and no such spec is a finding at its first fixture. The tree is the tracked one over the world's own
 * slot; nothing names a path. Fakes the test-world library provides (declared in `test-world.config.ts`, held in the library
 * package) have no tracked fixtures here and are guarded by the library's own contract specs, so only the repository's own
 * `fakes/<provider>/` folders are judged.
 */
export const CONTRACT_FIXTURE_GUARD_RULE_IDS = ['BE_CONTRACT_UNGUARDED'];

const RULE = 'BE_CONTRACT_UNGUARDED';
const WORLD_SLOT = 'be.tests.world';
const CONTRACT_SLOT = 'be.tests.contract';
const FAKES_DIRECTORY = 'fakes/';
const PAYLOADS = /^([^/]+)\/payloads\/[^/]+\.json$/u;
const SHAPE_MATCHERS = new Set(['toEqual', 'toStrictEqual']);

const unwrap = (ts, node) => unwrapEach(ts, node, [ts.isParenthesizedExpression, ts.isAsExpression, ts.isNonNullExpression, ts.isAwaitExpression]);

/** Every node under `root`, itself included. */
function walk(ts, root, visit) {
  const step = node => { visit(node); ts.forEachChild(node, step); };
  step(root);
}

/** Facts one contract spec establishes: the providers whose fixtures it references and whether it compares shapes. */
function readSpec(ts, sourceFile, helper, providers) {
  const shapeNames = new Set();
  const referenced = new Set();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const from = statement.moduleSpecifier.text;
    for (const provider of providers) if (from.includes(`${FAKES_DIRECTORY}${provider}/`) || from.endsWith(`${FAKES_DIRECTORY}${provider}`)) referenced.add(provider);
    const named = statement.importClause?.namedBindings;
    if (!named || !ts.isNamedImports(named)) continue;
    for (const element of named.elements) if ((element.propertyName ?? element.name).text === helper) shapeNames.add(element.name.text);
  }
  const callsShape = node => {
    let found = false;
    walk(ts, node, inner => { if (ts.isCallExpression(inner) && ts.isIdentifier(inner.expression) && shapeNames.has(inner.expression.text)) found = true; });
    return found;
  };
  let compares = false;
  walk(ts, sourceFile, node => {
    if (ts.isStringLiteralLike(node)) for (const provider of providers) if (node.text.includes(`${FAKES_DIRECTORY}${provider}/`)) referenced.add(provider);
    if (!ts.isCallExpression(node)) return;
    const named = ts.isIdentifier(node.expression) ? node.expression.text : null;
    for (const argument of node.arguments) {
      const value = unwrap(ts, argument);
      if (value && ts.isStringLiteralLike(value) && providers.has(value.text) && named !== 'describe' && named !== 'it' && named !== 'test') referenced.add(value.text);
    }
    const callee = node.expression;
    if (!ts.isPropertyAccessExpression(callee) || !SHAPE_MATCHERS.has(callee.name.text)) return;
    let receiver = unwrap(ts, callee.expression);
    while (receiver && ts.isPropertyAccessExpression(receiver)) receiver = unwrap(ts, receiver.expression); // .not / .resolves
    if (!receiver || !ts.isCallExpression(receiver) || !ts.isIdentifier(receiver.expression) || receiver.expression.text !== 'expect') return;
    const [actual] = receiver.arguments;
    const [expected] = node.arguments;
    if (actual && expected && callsShape(actual) && callsShape(expected)) compares = true;
  });
  return { referenced, compares };
}

export function checkContractFixtureGuard(input) {
  const { config, graph, ts, resolver, tree } = checkerScope(input);
  const { contractShape } = resolver.ruleParams();
  const violations = [];
  const fixtures = new Map(); // provider -> first payload fixture file
  const specs = new Map(); // provider -> [contract spec file]
  for (const file of [...tree.files].sort()) {
    const classified = resolver.classifyPath(file);
    if (classified.status !== 'owned') continue;
    if (classified.slot === CONTRACT_SLOT) {
      const provider = classified.bindings?.provider;
      if (provider && file.endsWith('.contract-spec.ts')) specs.set(provider, [...(specs.get(provider) ?? []), file]);
      continue;
    }
    const verdict = classified.slot === WORLD_SLOT ? allowsFile(resolver, file) : null;
    if (verdict?.slot === WORLD_SLOT) {
      if (!verdict.relative.startsWith(FAKES_DIRECTORY)) continue;
      const match = PAYLOADS.exec(verdict.relative.slice(FAKES_DIRECTORY.length));
      if (match && !fixtures.has(match[1])) fixtures.set(match[1], file);
    }
  }
  const providers = new Set(fixtures.keys());
  const guarded = new Set();
  for (const [provider, files] of specs) {
    for (const file of files) {
      const absolute = path.join(config.root, ...file.split('/'));
      if (!fs.existsSync(absolute)) continue;
      const sourceFile = ts.createSourceFile(absolute, fs.readFileSync(absolute, 'utf8'), ts.ScriptTarget.Latest, true); // the contract tree is outside the root program
      const facts = readSpec(ts, sourceFile, contractShape.helper, providers);
      if (facts.compares && facts.referenced.has(provider)) guarded.add(provider);
    }
  }
  for (const [provider, file] of [...fixtures].sort(([a], [b]) => a.localeCompare(b))) {
    if (guarded.has(provider)) continue;
    const has = specs.get(provider)?.length ?? 0;
    const why = has === 0
      ? `there is no src/tests/contract/${provider}/*.contract-spec.ts`
      : `none of the ${has} contract spec(s) under src/tests/contract/${provider}/ both references the ${provider} fixtures and asserts expect(${contractShape.helper}(real)).toEqual(${contractShape.helper}(fixture))`;
    violations.push({
      ruleId: RULE, path: file, line: 1, column: 1, slot: WORLD_SLOT,
      message: `fakes/${provider}/ serves payload fixtures but no contract spec guards them: ${why}. A fixture that is not compared with the real provider drifts silently; add the sandbox contract spec (the contract helper of the world skips it when the sandbox config is absent).`,
    });
  }
  return { violations, coverage: { status: 'checked', fixtureFakes: fixtures.size, contractSpecs: [...specs.values()].flat().length } };
}
