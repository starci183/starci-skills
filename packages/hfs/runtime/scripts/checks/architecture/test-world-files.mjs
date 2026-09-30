import fs from 'node:fs';
import path from 'node:path';
import { treeOf } from './required-files.mjs';
import { allowsFile } from '../../lib/hfs-allows.mjs';
import { machineKit } from './machine-ast.mjs';
import { DEFAULT_ENVIRONMENT, STACKS_DIRECTORY, STATEFUL_KINDS, imagePathOf, isTagged, namesOfService, readStack } from '../../lib/stack-services.mjs';

/**
 * R47 `test-world-files` (BE_TEST_TOPOLOGY). Three judgements over the test world, all read through slots and the
 * repository's own stack definition (`.starcistacks/<env>`, scripts/lib/stack-services.mjs), never through a path or a name list:
 *
 * 1. Files. `src/tests/world/` is the only test infrastructure location, and it holds only what its slot `allows`
 *    (knowledge/hfs/slots.yaml be.tests.world: global-setup.ts, global-teardown.ts, use-test-world.ts, and fakes/; kit/ is
 *    its own slot, be.tests.world.kit) plus files at its root whose role suffix is in ruleParams.be.suffixes
 *    (`stripe.client.ts`, `checkout.contracts.ts`, ...). Every tracked file below the world root is matched by the slot's
 *    own entries through `allowsFile`.
 * 2. Images (owner refinement 2026-09-30: the world's services come from the stack definition, at run time). No test
 *    source (slots be.tests.*; specs never start infrastructure, and the program excludes them) spells a container image: an `image:tag` literal that names a repository the dev stack
 *    declares (the world reads it from the stack), and an image literal handed to a `docker run` / `docker create` (an
 *    argument array holding `run` or `create`, or a `docker run ...` command string) or to a testcontainers class is a
 *    service the dev stack does not declare.
 * 3. Fakes. `fakes/<provider>/` holds a network-edge fake of an external SaaS the team does not operate; a service the
 *    stack declares (its own name, its image repository or a well-known alias of the image: postgres, redis, keycloak, a
 *    mail host, ...) runs real, so a fake of it is refused. One owner-approved exception (BE-CONVENTION 1.16): a
 *    stack service that is stateless compute needing special hardware or an external model (GPU inference, a self-hosted
 *    embedding model) may be faked with a protocol-faithful fake when the world README (`README.md` in the world, an allowed
 *    world file) marks it in the table `| stack service | fake | reason | holds |`: the stack service, the `fakes/<fake>/`
 *    folder, a non-empty reason, and `holds` = `a, b` (both hold: a) stateless, b) needs special hardware or an external
 *    model). A stack service of a stateful kind (database, cache, identity, storage, mail, queue, search) or with a persistent
 *    volume is never accepted; a row that names a stack service or a fake folder that does not exist is refused as stale.
 */
export const TEST_WORLD_FILES_RULE_IDS = ['BE_TEST_TOPOLOGY'];

const RULE = 'BE_TEST_TOPOLOGY';
const WORLD_SLOT = 'be.tests.world';
const TEST_SLOT_PREFIX = 'be.tests.';
const FAKES_DIRECTORY = 'fakes/';
const KEBAB = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const IMAGE_SHAPE = /^[a-z][a-z0-9._-]*(?:\/[a-z0-9._-]+)*:[A-Za-z0-9_][A-Za-z0-9_.-]*(?:@sha256:[a-f0-9]+)?$/;
const DOCKER_ARGUMENT_VERBS = new Set(['run', 'create']);
const DOCKER_COMMAND = /^\s*docker\s+(?:run|create)\s/u;
const CONTAINER_PACKAGES = /^(?:testcontainers|@testcontainers\/.+)$/u;

const WORLD_README = 'README.md';
const FAKED_TABLE_HEADER = ['stack service', 'fake', 'reason', 'holds'];
const HOLDS_BOTH = 'a,b';

/** The cells of one markdown table row, trimmed, without the outer pipes and without backticks. */
const cellsOf = line => line.trim().replace(/^\|/u, '').replace(/\|$/u, '').split('|').map(cell => cell.trim().replaceAll('`', ''));

/**
 * The marked fakes of the world README: rows of the table whose header is exactly `stack service | fake | reason | holds`
 * (the structured source; nothing else in the README is read). Each row: {service, fake, reason, holds, line}.
 */
function readMarkedFakes(file) {
  let lines;
  try { lines = fs.readFileSync(file, 'utf8').split(/\r?\n/u); } catch { return []; }
  const rows = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].trim().startsWith('|') || cellsOf(lines[index]).map(cell => cell.toLowerCase()).join('|') !== FAKED_TABLE_HEADER.join('|')) continue;
    for (let row = index + 2; row < lines.length && lines[row].trim().startsWith('|'); row += 1) {
      const [service = '', fake = '', reason = '', holds = ''] = cellsOf(lines[row]);
      rows.push({ service, fake, reason, holds: holds.toLowerCase().replace(/\s+/gu, ''), line: row + 1 });
    }
    break;
  }
  return rows;
}

const readDeclaredStack = root => {
  try { return readStack({ root, environment: DEFAULT_ENVIRONMENT }); } catch { return null; }
};

const isImageShaped = text => IMAGE_SHAPE.test(text);

/** The image literals of the test sources: hard-coded stack images, images of a `docker run` and of a testcontainers class. */
function imageViolations({ input, declaredPaths, stackHint }) {
  const { graph } = input;
  const kit = machineKit(input);
  const { ts } = kit;
  const out = [];
  for (const file of graph.files.values()) {
    if (!file.slot?.startsWith(TEST_SLOT_PREFIX)) continue;
    const checker = kit.checkerOf(file.sourceFile);
    const reported = new Set();
    const report = (node, text, why) => {
      if (reported.has(node)) return;
      reported.add(node);
      const message = declaredPaths.has(imagePathOf(text))
        ? `"${text}" is an image literal of ${stackHint}: the world reads the services and image versions of the stack at run time (hfs test-stack), so no image is spelled in test source (${why}).`
        : `"${text}" is an image ${stackHint} does not declare (${why}): declare the service in the dev stack, where hfs test-stack starts it, and never start an image the stack does not carry from test source.`;
      out.push({ ruleId: RULE, ...kit.at(file.rel, file.sourceFile, node), message, slot: file.slot });
    };
    kit.walk(file.sourceFile, node => {
      if (ts.isStringLiteralLike(node) && isImageShaped(node.text) && declaredPaths.has(imagePathOf(node.text))) report(node, node.text, 'an image the dev stack declares');
      if (ts.isArrayLiteralExpression(node)) {
        const literals = node.elements.filter(element => ts.isStringLiteralLike(element));
        if (literals.some(element => DOCKER_ARGUMENT_VERBS.has(element.text))) {
          for (const element of literals) if (isImageShaped(element.text)) report(element, element.text, 'an argument of docker run');
        }
      }
      if (ts.isStringLiteralLike(node) && DOCKER_COMMAND.test(node.text)) {
        for (const token of node.text.split(/\s+/u)) if (isImageShaped(token)) report(node, token, 'a docker run command');
      }
      if (ts.isNewExpression(node) || ts.isCallExpression(node)) {
        const binding = kit.importBinding(checker, node.expression);
        const [first] = node.arguments ?? [];
        if (binding && CONTAINER_PACKAGES.test(binding.module) && first && ts.isStringLiteralLike(first)) report(first, first.text, 'a testcontainers image');
      }
      return true;
    });
  }
  return out;
}

export function checkTestWorldFiles(input) {
  const { config, graph } = input;
  const resolver = graph.resolver;
  const { suffixes } = resolver.ruleParams();
  const tree = treeOf(config.root);
  const violations = [];
  const stack = readDeclaredStack(config.root);
  const declaredPaths = new Set((stack?.services ?? []).filter(service => isTagged(service.image)).map(service => imagePathOf(service.image)));
  const fakeable = (stack?.services ?? []).filter(service => service.role !== 'service');
  const stackHint = `${STACKS_DIRECTORY}/${DEFAULT_ENVIRONMENT}`;
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

  const readmePath = worldRoot === null ? null : `${worldRoot}${WORLD_README}`;
  const marked = readmePath !== null && stack ? readMarkedFakes(path.join(config.root, ...readmePath.split('/'))) : [];
  const statefulWhy = service => (STATEFUL_KINDS.has(service.kind) ? `a ${service.kind} holds data the app reads back` : service.persistent ? 'the stack gives it a persistent volume' : null);
  const at = (file, line, message) => violations.push({ ruleId: RULE, path: file, line, column: 1, message, slot: WORLD_SLOT });

  for (const row of marked) {
    const service = (stack?.services ?? []).find(candidate => candidate.name === row.service);
    const problems = [];
    if (!service) problems.push(`${stackHint} declares no service ${row.service}`);
    else if (statefulWhy(service)) problems.push(`${service.name} is stateful (${statefulWhy(service)}) and always runs real`);
    if (!fakeProviders.has(row.fake)) problems.push(`there is no fakes/${row.fake}/ folder`);
    if (row.reason === '') problems.push('the reason is empty');
    if (row.holds !== HOLDS_BOTH) problems.push('holds must be "a, b": both (a) stateless compute and (b) needs special hardware or an external model must hold');
    if (problems.length > 0) at(readmePath, row.line, `${readmePath} marks ${row.service} as faked by ${row.fake}, but ${problems.join('; ')}. The exception covers only stateless compute that needs special hardware or an external model; everything else in the stack runs real.`);
  }

  for (const [provider, file] of [...fakeProviders].sort(([a], [b]) => a.localeCompare(b))) {
    const service = fakeable.find(candidate => namesOfService(candidate).includes(provider));
    if (!service) continue;
    const row = marked.find(candidate => candidate.fake === provider && candidate.service === service.name);
    if (row && !statefulWhy(service) && row.reason !== '' && row.holds === HOLDS_BOTH) continue;
    if (row) continue; // the invalid marking was reported on its README row above
    const why = statefulWhy(service);
    at(file, 1, `fakes/${provider}/ fakes ${service.name} (${service.image}), which ${stackHint} declares: a service of the repository's own stack runs real in the test world. ${why ? `${service.name} is stateful (${why}), so no exception applies. ` : `Only stateless compute that needs special hardware or an external model may be faked, and only when ${readmePath ?? 'the world README.md'} marks it in the table | stack service | fake | reason | holds |. `}Delete the fake and let the world use the real service (hfs test-stack); fakes/ is otherwise only for external SaaS the team does not operate.`);
  }

  violations.push(...imageViolations({ input, declaredPaths, stackHint }));
  return { violations, coverage: { status: 'checked', files } };
}
