import { treeOf } from './required-files.mjs';
import { allowsFile } from '../../lib/hfs-allows.mjs';
import { DEFAULT_ENVIRONMENT, STACKS_DIRECTORY, STATEFUL_KINDS, namesOfService, readStack } from '../../lib/stack-services.mjs';

/**
 * R47 `test-world-files` (BE_TEST_TOPOLOGY). Two judgements over the test world, read through slots, the repository's own
 * stack definition (`.starcistacks/<env>`, scripts/lib/stack-services.mjs) and the world's declaration
 * (`test-world.config.ts` of the test-world library), never through a path or a name list:
 *
 * 1. Files. `src/tests/world/` is the only test infrastructure location, and it holds only what its slot `allows`
 *    (knowledge/hfs/slots.yaml be.tests.world: global-setup.ts, global-teardown.ts, use-test-world.ts, and fakes/; kit/ is
 *    its own slot, be.tests.world.kit) plus files at its root whose role suffix is in ruleParams.be.suffixes
 *    (`stripe.client.ts`, `checkout.contracts.ts`, `test-world.config.ts`, ...). Every tracked file below the world root is
 *    matched by the slot's own entries through `allowsFile`.
 * 2. Fakes against the stack (owner refinement 2026-09-30). Every service the stack declares runs real in the world;
 *    `fakes/<provider>/` holds a network-edge fake of an external SaaS the team does not operate. A `fakes/<provider>/` that
 *    fakes a stack service (its own name, its image repository or a well-known alias of the image) is refused, except the one
 *    owner-approved exception: a stack service that is stateless compute needing special hardware or an external model
 *    (GPU inference, a self-hosted embedding model) and that the config declares in `fakedBy`:
 *    `fakedBy: { "<stack service>": { fake: "<fakes/ folder>", reason: "<non-empty>" } }`. A stack service of a stateful
 *    kind (database, cache, identity, storage, mail, queue, search) or with a persistent volume is never accepted, and a
 *    `fakedBy` entry that names a stack service or a fake folder that does not exist, or has no reason, is refused as stale
 *    or empty. The config's `stacks` names the stack environments the world runs (default `dev`); the machine reads the
 *    literal object of the config through the TypeScript AST and nothing else of it.
 */
export const TEST_WORLD_FILES_RULE_IDS = ['BE_TEST_TOPOLOGY'];

const RULE = 'BE_TEST_TOPOLOGY';
const WORLD_SLOT = 'be.tests.world';
const FAKES_DIRECTORY = 'fakes/';
const CONFIG_FILE = 'test-world.config.ts';
const defaultEnvironment = DEFAULT_ENVIRONMENT;
const KEBAB = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

const nameOf = (ts, name) => (name && (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) ? name.text : null);
const unwrap = (ts, node) => {
  let current = node;
  while (current && (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isSatisfiesExpression?.(current))) current = current.expression;
  return current;
};
const propertyOf = (ts, literal, key) => literal.properties.find(property => ts.isPropertyAssignment(property) && nameOf(ts, property.name) === key)?.initializer ?? null;

/** The object literal a config file declares: `export default { ... }` or `export default defineTestWorld({ ... })`. */
function configLiteral(ts, sourceFile) {
  for (const statement of sourceFile.statements) {
    if (!ts.isExportAssignment(statement)) continue;
    const expression = unwrap(ts, statement.expression);
    if (ts.isObjectLiteralExpression(expression)) return expression;
    if (ts.isCallExpression(expression)) {
      const [first] = expression.arguments;
      const literal = first ? unwrap(ts, first) : null;
      if (literal && ts.isObjectLiteralExpression(literal)) return literal;
    }
  }
  return null;
}

/** `stacks` as a list of environment names: an array of strings, or the keys of an object literal. */
function stacksOf(ts, literal) {
  const node = literal ? propertyOf(ts, literal, 'stacks') : null;
  const value = node ? unwrap(ts, node) : null;
  if (!value) return null;
  if (ts.isArrayLiteralExpression(value)) return value.elements.filter(element => ts.isStringLiteralLike(element)).map(element => element.text);
  if (ts.isObjectLiteralExpression(value)) return value.properties.map(property => nameOf(ts, property.name)).filter(Boolean);
  return null;
}

/** `fakedBy` entries: [{service, fake, reason, line, column}]; a value the reader cannot read statically has an empty fake and reason. */
function fakedByOf(ts, sourceFile, literal) {
  const node = literal ? propertyOf(ts, literal, 'fakedBy') : null;
  const value = node ? unwrap(ts, node) : null;
  if (!value || !ts.isObjectLiteralExpression(value)) return [];
  const entries = [];
  for (const property of value.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const service = nameOf(ts, property.name);
    const body = unwrap(ts, property.initializer);
    const fake = ts.isObjectLiteralExpression(body) ? propertyOf(ts, body, 'fake') : null;
    const reason = ts.isObjectLiteralExpression(body) ? propertyOf(ts, body, 'reason') : null;
    const position = sourceFile.getLineAndCharacterOfPosition(property.getStart(sourceFile));
    entries.push({
      service,
      fake: fake && ts.isStringLiteralLike(fake) ? fake.text : '',
      reason: reason && ts.isStringLiteralLike(reason) ? reason.text.trim() : '',
      line: position.line + 1,
      column: position.character + 1,
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
  const environments = (literal ? stacksOf(ts, literal) : null) ?? [defaultEnvironment];
  const services = [];
  for (const environment of environments) {
    let stack = null;
    try { stack = readStack({ root: config.root, environment }); } catch { stack = null; }
    for (const service of stack?.services ?? []) if (service.role !== 'service' && !services.some(known => known.name === service.name)) services.push({ ...service, environment });
  }
  const stackHint = `${STACKS_DIRECTORY}/${environments.join(', ')}`;
  const statefulWhy = service => (STATEFUL_KINDS.has(service.kind) ? `a ${service.kind} holds data the app reads back` : service.persistent ? 'the stack gives it a persistent volume' : null);
  const declared = configFile ? fakedByOf(ts, configFile.sourceFile, literal) : [];

  for (const entry of declared) {
    const service = services.find(candidate => candidate.name === entry.service);
    const problems = [];
    if (!service) problems.push(`${stackHint} declares no service ${entry.service}`);
    else if (statefulWhy(service)) problems.push(`${service.name} is stateful (${statefulWhy(service)}) and always runs real`);
    if (!fakeProviders.has(entry.fake)) problems.push(`there is no fakes/${entry.fake || '<fake>'}/ folder`);
    if (entry.reason === '') problems.push('the reason is empty');
    if (problems.length > 0) {
      violations.push({
        ruleId: RULE, path: configPath, line: entry.line, column: entry.column, slot: WORLD_SLOT,
        message: `${configPath} declares ${entry.service} as faked by ${entry.fake || '(no fake)'}, but ${problems.join('; ')}. The exception covers only stateless compute that needs special hardware or an external model, with a reason; everything else in the stack runs real.`,
      });
    }
  }

  for (const [provider, file] of [...fakeProviders].sort(([a], [b]) => a.localeCompare(b))) {
    const service = services.find(candidate => namesOfService(candidate).includes(provider));
    if (!service) continue;
    if (declared.some(entry => entry.service === service.name && entry.fake === provider)) continue; // judged on its config entry above
    const why = statefulWhy(service);
    violations.push({
      ruleId: RULE, path: file, line: 1, column: 1, slot: WORLD_SLOT,
      message: `fakes/${provider}/ fakes ${service.name} (${service.image}), which ${stackHint} declares: a service of the repository's own stack runs real in the test world. ${why ? `${service.name} is stateful (${why}), so no exception applies. ` : `Only stateless compute that needs special hardware or an external model may be faked, and only when ${configPath ?? `${CONFIG_FILE} in the world`} declares it in fakedBy with a reason. `}Delete the fake and let the world run the real service; fakes/ is otherwise only for external SaaS the team does not operate.`,
    });
  }
  return { violations, coverage: { status: 'checked', files } };
}
