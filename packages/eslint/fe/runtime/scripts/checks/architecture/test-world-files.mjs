import { treeOf } from './required-files.mjs';
import { allowsFile } from '../../lib/hfs-allows.mjs';
import { locateDeclaration } from '../../lib/hfs-slots.mjs';
import { DEFAULT_ENVIRONMENT, STACKS_DIRECTORY, STATEFUL_KINDS, namesOfService, readStack } from '../../lib/stack-services.mjs';

/**
 * R47 `test-world-files` (BE_TEST_TOPOLOGY). Judgements over the test world, read through slots, the repository's own
 * stack definition (`.starcistacks/<env>`, scripts/lib/stack-services.mjs) and the world's declaration
 * (`test-world.config.ts`, read in the shape @starci/test-world defines), never through a path or a name list:
 *
 * 1. Files. `src/tests/world/` is the only test infrastructure location, and it holds only what its slot `allows`
 *    (knowledge/hfs/slots.yaml be.tests.world: global-setup.ts, global-teardown.ts, use-test-world.ts, and fakes/; kit/ is
 *    its own slot, be.tests.world.kit) plus files at its root whose role suffix is in ruleParams.be.suffixes
 *    (`stripe.client.ts`, `checkout.contracts.ts`, `test-world.config.ts`, ...). Every tracked file below the world root is
 *    matched by the slot's own entries through `allowsFile`.
 * 2. The declaration. `test-world.config.ts` declares the world in ONE form, the named export R89 allows:
 *    `export const { useTestWorld, useSandbox } = defineTestWorld({ ... })` (an exported `const` initialized by a
 *    `defineTestWorld(<object literal>)` call). A config without it (a default export, or a declaration the machine cannot
 *    read) is refused: the world it declares could not be judged.
 * 3. Fakes against the stack (owner refinement 2026-09-30). Every service the stack declares runs real in the world; a fake
 *    (a `fakes/<provider>/` folder, or a `fakes` entry of the declaration such as `smtp: smtpFake()`) is a network-edge fake
 *    of an external SaaS the team does not operate. A fake of a stack service (its own name, its image repository or a
 *    well-known alias of the image) is refused, except the one owner-approved exception: a stack service that is stateless
 *    compute needing special hardware or an external model (GPU inference, a self-hosted embedding model) whose `stacks` entry
 *    declares it faked: `stacks: { "<stack service>": { fakedBy: "<fake>", reason: "<non-empty>" } }`. A stack service of a
 *    stateful kind (database, cache, identity, storage, mail, queue, search) or with a persistent volume is never accepted, and
 *    an entry that names a stack service or a fake (a `fakes` entry or a `fakes/` folder) that does not exist, or has no
 *    reason, is refused as stale or empty. The declaration's `stack` (`".starcistacks/<env>"`) names the stack environment the
 *    world runs (default `dev`); the machine reads the literal object of the declaration through the TypeScript AST and
 *    nothing else of it.
 */
export const TEST_WORLD_FILES_RULE_IDS = ['BE_TEST_TOPOLOGY'];

const RULE = 'BE_TEST_TOPOLOGY';
const WORLD_SLOT = 'be.tests.world';
const FAKES_DIRECTORY = 'fakes/';
const CONFIG_FILE = 'test-world.config.ts';
const DEFINE = 'defineTestWorld';
const NAMED_FORM = `export const { useTestWorld, useSandbox } = ${DEFINE}({ ... })`;
const defaultEnvironment = DEFAULT_ENVIRONMENT;
const KEBAB = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

const nameOf = (ts, name) => (name && (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) ? name.text : null);
const unwrap = (ts, node) => {
  let current = node;
  while (current && (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isSatisfiesExpression?.(current))) current = current.expression;
  return current;
};
const propertyOf = (ts, literal, key) => literal.properties.find(property => ts.isPropertyAssignment(property) && nameOf(ts, property.name) === key)?.initializer ?? null;
const isExported = (ts, statement) => (statement.modifiers ?? []).some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);
const positionOf = (sourceFile, node) => {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { line: position.line + 1, column: position.character + 1 };
};

/** The object literal of `defineTestWorld(<object literal>)`, or null. */
function defineLiteral(ts, expression) {
  const call = unwrap(ts, expression);
  if (!call || !ts.isCallExpression(call) || !ts.isIdentifier(call.expression) || call.expression.text !== DEFINE) return null;
  const [first] = call.arguments;
  const literal = first ? unwrap(ts, first) : null;
  return literal && ts.isObjectLiteralExpression(literal) ? literal : null;
}

/** The declaration of the world: the object literal of an exported `const` initialized by `defineTestWorld({ ... })`, or null. */
function configLiteral(ts, sourceFile) {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement) || !isExported(ts, statement)) continue;
    if ((statement.declarationList.flags & ts.NodeFlags.Const) === 0) continue;
    for (const declaration of statement.declarationList.declarations) {
      const literal = declaration.initializer ? defineLiteral(ts, declaration.initializer) : null;
      if (literal) return literal;
    }
  }
  return null;
}

/** `stack` as the environment it names: the last segment of `".starcistacks/<env>"`; null when absent or not a literal. */
function environmentOf(ts, literal) {
  const node = literal ? propertyOf(ts, literal, 'stack') : null;
  const value = node ? unwrap(ts, node) : null;
  if (!value || !ts.isStringLiteralLike(value)) return null;
  return value.text.split(/[\\/]+/u).filter(Boolean).at(-1) ?? null;
}

/** The keys of the declaration's `fakes` object literal, with their positions. */
function fakeEntriesOf(ts, sourceFile, literal) {
  const node = literal ? propertyOf(ts, literal, 'fakes') : null;
  const value = node ? unwrap(ts, node) : null;
  if (!value || !ts.isObjectLiteralExpression(value)) return [];
  return value.properties
    .map(property => ({ name: nameOf(ts, property.name), ...positionOf(sourceFile, property) }))
    .filter(entry => entry.name);
}

/** The `stacks` entries that declare `fakedBy`: [{service, fake, reason, line, column}]; a value the reader cannot read statically has an empty fake and reason. */
function fakedByOf(ts, sourceFile, literal) {
  const node = literal ? propertyOf(ts, literal, 'stacks') : null;
  const value = node ? unwrap(ts, node) : null;
  if (!value || !ts.isObjectLiteralExpression(value)) return [];
  const entries = [];
  for (const property of value.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const body = unwrap(ts, property.initializer);
    if (!body || !ts.isObjectLiteralExpression(body)) continue;
    const fake = propertyOf(ts, body, 'fakedBy');
    if (!fake) continue;
    const reason = propertyOf(ts, body, 'reason');
    entries.push({
      service: nameOf(ts, property.name),
      fake: ts.isStringLiteralLike(fake) ? fake.text : '',
      reason: reason && ts.isStringLiteralLike(reason) ? reason.text.trim() : '',
      ...positionOf(sourceFile, property),
    });
  }
  return entries;
}

export function checkTestWorldFiles(input) {
  const { config, graph, context } = input;
  const ts = context.ts;
  const resolver = graph.resolver;
  const { suffixes } = resolver.ruleParams();
  const tree = treeOf(config.root);
  const violations = [];
  const fakeProviders = new Map();
  let worldRoot = null;
  let files = 0;
  for (const file of [...tree.files].sort()) {
    if (!file.endsWith('.ts')) continue;
    const verdict = allowsFile(resolver, file);
    if (!verdict || verdict.slot !== WORLD_SLOT) continue;
    files += 1;
    worldRoot ??= file.slice(0, file.length - verdict.relative.length);
    if (verdict.relative.startsWith(FAKES_DIRECTORY)) {
      const [provider, ...rest] = verdict.relative.slice(FAKES_DIRECTORY.length).split('/');
      if (rest.length > 0 && !fakeProviders.has(provider)) fakeProviders.set(provider, file);
    }
    if (verdict.allowed) continue;
    const parts = verdict.relative.slice(0, -'.ts'.length).split('.');
    const roleFileAtRoot = !verdict.relative.includes('/') && parts.length >= 2 && parts.every(part => KEBAB.test(part)) && suffixes.includes(parts.at(-1));
    if (roleFileAtRoot) continue;
    violations.push({
      ruleId: RULE, path: file, line: 1, column: 1,
      message: `${file} is not allowed in the test world; src/tests/world/ holds only ${verdict.allows.join(', ')} and role-suffixed files (<name>.<role>.ts) at its root. Move it to fakes/ or kit/ (be.tests.world.kit), give it a role suffix, or delete it.`,
      slot: verdict.slot,
    });
  }

  const configPath = worldRoot === null ? null : `${worldRoot}${CONFIG_FILE}`;
  const configFile = configPath === null ? null : graph.files.get(configPath) ?? null;
  const literal = configFile ? configLiteral(ts, configFile.sourceFile) : null;
  if (configFile && !literal) {
    violations.push({
      ruleId: RULE, path: configPath, line: 1, column: 1, slot: WORLD_SLOT,
      message: `${configPath} declares no world the machine can read. Declare it in the one named form \`${NAMED_FORM}\` (an exported const of a ${DEFINE} call with an object literal, imported from @starci/test-world); a default export is refused by R89 and is not read.`,
    });
  }
  const environments = [(literal ? environmentOf(ts, literal) : null) ?? defaultEnvironment];
  const services = [];
  for (const environment of environments) {
    let stack = null;
    // The stack is the app root's .starcistacks: the side folder the machine judges reads its app's (locateDeclaration).
    try { stack = readStack({ root: locateDeclaration(config.root).appRoot, environment }); } catch { stack = null; }
    for (const service of stack?.services ?? []) if (service.role !== 'service' && !services.some(known => known.name === service.name)) services.push({ ...service, environment });
  }
  const stackHint = `${STACKS_DIRECTORY}/${environments.join(', ')}`;
  const statefulWhy = service => (STATEFUL_KINDS.has(service.kind) ? `a ${service.kind} holds data the app reads back` : service.persistent ? 'the stack gives it a persistent volume' : null);
  const declared = literal ? fakedByOf(ts, configFile.sourceFile, literal) : [];
  const fakeEntries = literal ? fakeEntriesOf(ts, configFile.sourceFile, literal) : [];

  for (const entry of declared) {
    const service = services.find(candidate => candidate.name === entry.service);
    const problems = [];
    if (!service) problems.push(`${stackHint} declares no service ${entry.service}`);
    else if (statefulWhy(service)) problems.push(`${service.name} is stateful (${statefulWhy(service)}) and always runs real`);
    if (!fakeProviders.has(entry.fake) && !fakeEntries.some(fake => fake.name === entry.fake)) problems.push(`there is no fakes entry and no fakes/${entry.fake || '<fake>'}/ folder of that name`);
    if (entry.reason === '') problems.push('the reason is empty');
    if (problems.length > 0) {
      violations.push({
        ruleId: RULE, path: configPath, line: entry.line, column: entry.column, slot: WORLD_SLOT,
        message: `${configPath} declares ${entry.service} as faked by ${entry.fake || '(no fake)'}, but ${problems.join('; ')}. The exception covers only stateless compute that needs special hardware or an external model, with a reason; everything else in the stack runs real.`,
      });
    }
  }

  // Every fake the world runs: the repository's fakes/<provider>/ folders and the fakes entries of the declaration.
  const fakes = [
    ...[...fakeProviders].map(([provider, file]) => ({ name: provider, path: file, line: 1, column: 1, what: `fakes/${provider}/` })),
    ...fakeEntries.filter(entry => !fakeProviders.has(entry.name)).map(entry => ({ name: entry.name, path: configPath, line: entry.line, column: entry.column, what: `the fakes entry ${entry.name}` })),
  ].sort((a, b) => a.name.localeCompare(b.name));
  for (const fake of fakes) {
    const service = services.find(candidate => namesOfService(candidate).includes(fake.name));
    if (!service) continue;
    if (declared.some(entry => entry.service === service.name && entry.fake === fake.name)) continue; // judged on its stacks entry above
    const why = statefulWhy(service);
    violations.push({
      ruleId: RULE, path: fake.path, line: fake.line, column: fake.column, slot: WORLD_SLOT,
      message: `${fake.what} fakes ${service.name} (${service.image}), which ${stackHint} declares: a service of the repository's own stack runs real in the test world. ${why ? `${service.name} is stateful (${why}), so no exception applies. ` : `Only stateless compute that needs special hardware or an external model may be faked, and only when ${configPath ?? `${CONFIG_FILE} in the world`} declares it in its stacks entry ({ fakedBy, reason }). `}Delete the fake and let the world run the real service; fakes are otherwise only for external SaaS the team does not operate.`,
    });
  }
  return { violations, coverage: { status: 'checked', files } };
}
