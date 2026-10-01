// services.mjs - the microservice policy of a product that runs more than one service (R128 to R132).
// A product keeps every back-end service as a Nest app at `be/apps/<service>/` of the one repository, sharing the `be/src` libraries and
// the one package.json; the services it does not own stay pinned images in the stack. Five tree checks:
//   R128 HFS_SERVICE_PLACEMENT      a service root (a Dockerfile, or a package.json other than the app's own and a workspace package's)
//                                   exists only at be/apps/<service>/ (fe/apps/<app>/Dockerfile is a front end's);
//   R129 HFS_IMAGE_UNPINNED         in a multi-service product every component image of application-stacks.yaml is a digest or an exact
//                                   version (x.y.z), never a missing tag, `latest`, a branch word or a major/minor-only tag;
//   R130 HFS_SERVICE_STACK_DECLARATION  each api or worker app of a multi-service product is a `role: service` component of the stack;
//   R131 HFS_EVENT_CONTRACT         the async contract is vendored: `be/contracts/<service>/events.json` equals the provider's
//                                   `apps/<service>/src/events.ts` table, and every event a consumer's `apps/<app>/src/consumes.ts` names
//                                   exists in that snapshot at the same version;
//   R132 BE_ASYNC_SPEC_MISSING      every message consumer and every saga has an e2e spec `be/src/tests/e2e/<area>/<stem>.e2e-spec.ts`
//                                   (`<stem>` = its file name without `.consumer.ts` / `.saga.ts`) that boots the world with `useTestWorld`
//                                   and, for a consumer, names an event of the contracts.
// "Multi-service" = two or more be apps of kind api or worker. A single-service product is judged by R128 and R131-R132 only.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findStackDeclaration } from '../../lib/stack-declaration.mjs';
import { findPackage, requirePackage } from '../../lib/package-at.mjs';
import { folded, readConsumes, readEvents, snapshotText } from '../../lib/event-contract.mjs';
import { found, readText } from './read.mjs';

export const SERVICE_PLACEMENT = 'HFS_SERVICE_PLACEMENT';
export const IMAGE_UNPINNED = 'HFS_IMAGE_UNPINNED';
export const SERVICE_STACK_DECLARATION = 'HFS_SERVICE_STACK_DECLARATION';
export const EVENT_CONTRACT = 'HFS_EVENT_CONTRACT';
export const ASYNC_SPEC_MISSING = 'BE_ASYNC_SPEC_MISSING';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVICE_KINDS = new Set(['api', 'worker']);
const BE_SERVICE_FILE = /^be\/apps\/([^/]+)\/(.+)$/;
const DOCKERFILE = /(?:^|\/)Dockerfile(?:\.[^/]+)?$/;
const WORKSPACE_PACKAGE_JSON = /^fe\/packages\/[^/]+\/package\.json$/;
const SNAPSHOT = /^be\/contracts\/([^/]+)\/events\.json$/;
const DIGEST = /@sha256:[0-9a-f]{64}$/;
const EXACT_TAG = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const ASYNC_SUFFIX = /\.(consumer|saga)\.ts$/;

/** The be apps of kind api or worker. */
const servicesOf = (repo) => (repo.sides?.be?.apps ?? []).filter((app) => SERVICE_KINDS.has(app.kind));

/** The TypeScript compiler of the app (else of the runtime), or null. */
function typescriptFor(repoRoot) {
  const located = findPackage([repoRoot, HERE], ['typescript']);
  return located ? requirePackage(located) : null;
}

// ------------------------------------------------------------------------------------------------ R128 placement

/** Findings of R128: a service root outside `be/apps/<service>/`. */
export function servicePlacementFindings({ files }) {
  const findings = [];
  for (const file of files) {
    if (file.startsWith('.starciwork/') || file.startsWith('.starcistacks/') || file.includes('node_modules/')) continue;
    const dockerfile = DOCKERFILE.test(file) && !BE_SERVICE_FILE.test(file) && !/^fe\/apps\/[^/]+\/Dockerfile(?:\.[^/]+)?$/.test(file) && file !== 'Dockerfile';
    const manifest = path.posix.basename(file) === 'package.json' && file !== 'package.json' && !WORKSPACE_PACKAGE_JSON.test(file);
    const rootDockerfile = file === 'Dockerfile';
    if (!dockerfile && !manifest && !rootDockerfile) continue;
    const what = manifest ? 'a package.json of its own' : 'a Dockerfile';
    findings.push(found(SERVICE_PLACEMENT, file, `${file} gives a folder ${what}, which makes it a service root outside be/apps/<service>/; a back-end service is a Nest app at be/apps/<service>/ (own Dockerfile there) sharing the be/src libraries and the one package.json, never a folder of its own.`));
  }
  return findings;
}

// ------------------------------------------------------------------------------------------------ R129 pinned images

/** The image reference with `${VAR:-default}` resolved to its default, or null when it cannot be (a bare `${VAR}`). */
function resolvedImage(image) {
  let unresolved = false;
  const resolved = image.replace(/\$\{[^}:]+(?::-([^}]*))?\}/g, (_all, fallback) => { if (fallback === undefined) unresolved = true; return fallback ?? ''; });
  return unresolved ? null : resolved;
}

/** Why an image is not pinned, or null when it is: a digest, or an exact version tag. */
export function unpinnedReason(image) {
  const resolved = resolvedImage(image);
  if (resolved === null) return 'its reference is an environment variable with no default';
  if (DIGEST.test(resolved)) return null;
  const name = resolved.slice(resolved.lastIndexOf('/') + 1);
  const colon = name.indexOf(':');
  if (colon < 0) return 'it has no tag';
  const tag = name.slice(colon + 1);
  return EXACT_TAG.test(tag) ? null : `its tag \`${tag}\` is not an exact version (x.y.z) or a digest, so it moves`;
}

/** Findings of R129 over a multi-service product's stack declaration. */
export function imagePinFindings({ repoRoot, repo }) {
  if (servicesOf(repo).length < 2) return [];
  const declaration = findStackDeclaration(repoRoot);
  const components = declaration.doc?.components;
  if (components === null || typeof components !== 'object' || components === undefined) return [];
  const file = '.starcistacks/application-stacks.yaml';
  const findings = [];
  for (const [name, component] of Object.entries(components)) {
    const image = component?.image;
    if (typeof image !== 'string') continue;
    const reason = unpinnedReason(image);
    if (reason !== null) findings.push(found(IMAGE_UNPINNED, file, `${file} components.${name}.image ${image}: ${reason}. A product with more than one service pins every image: an exact version (\`<repo>/<service>:1.2.3\`, \`postgres:16.4\`) or a digest (\`@sha256:...\`).`, { component: name, image }));
  }
  return findings;
}

// ------------------------------------------------------------------------------------------------ R130 stack declaration

/** Findings of R130: each service app of a multi-service product is a `role: service` component. */
export function serviceStackFindings({ repoRoot, repo }) {
  const services = servicesOf(repo);
  if (services.length < 2) return [];
  const declaration = findStackDeclaration(repoRoot);
  if (declaration.doc === undefined) return [];
  const components = declaration.doc.components ?? {};
  const file = '.starcistacks/application-stacks.yaml';
  const findings = [];
  for (const app of services) {
    const component = components[app.name];
    if (component === null || typeof component !== 'object') findings.push(found(SERVICE_STACK_DECLARATION, file, `${file} declares no component \`${app.name}\` for the ${app.kind} app be/apps/${app.name}; every service of a multi-service product is a \`role: service\` component (own image \`<repo>/${app.name}:<exact version>\`, built from be/apps/${app.name}/Dockerfile).`, { app: app.name }));
    else if (component.role !== 'service') findings.push(found(SERVICE_STACK_DECLARATION, file, `${file} components.${app.name} is the stack's face of be/apps/${app.name} and must be \`role: service\`, not \`${String(component.role)}\`.`, { app: app.name }));
  }
  return findings;
}

// ------------------------------------------------------------------------------------------------ R131 event contract

/** Findings of R131 over the provider tables, their snapshots and the consumer tables of every service app. */
export function eventContractFindings({ repoRoot, files }) {
  const tracked = new Set(files);
  const providers = files.filter((file) => /^be\/apps\/[^/]+\/src\/events\.ts$/.test(file));
  const consumers = files.filter((file) => /^be\/apps\/[^/]+\/src\/consumes\.ts$/.test(file));
  const snapshots = files.filter((file) => SNAPSHOT.test(file));
  if (providers.length === 0 && consumers.length === 0 && snapshots.length === 0) return [];
  const ts = typescriptFor(repoRoot);
  if (ts === null) return [];
  const findings = [];
  const provided = new Map();
  for (const file of providers) {
    const service = BE_SERVICE_FILE.exec(file)[1];
    const snapshot = `be/contracts/${service}/events.json`;
    const { events, problems } = readEvents(ts, readText(repoRoot, file) ?? '');
    if (problems.length > 0) {
      findings.push(found(EVENT_CONTRACT, file, `${file} is not a literal event table the contract can be emitted from: ${problems.join('; ')}.`, { service }));
      continue;
    }
    provided.set(service, events);
    if (!tracked.has(snapshot)) findings.push(found(EVENT_CONTRACT, snapshot, `${service} declares events (${file}) but ${snapshot} is not committed; run \`npm run contract:emit\` and commit the snapshot, the contract its consumers are judged against.`, { service }));
    else if (folded(readText(repoRoot, snapshot) ?? '') !== snapshotText(service, events)) findings.push(found(EVENT_CONTRACT, snapshot, `${snapshot} differs from the event table ${service} declares now (${file}); run \`npm run contract:emit\` and commit the result.`, { service, drift: 'stale' }));
  }
  for (const snapshot of snapshots) {
    const service = SNAPSHOT.exec(snapshot)[1];
    if (!provided.has(service) && !providers.includes(`be/apps/${service}/src/events.ts`)) findings.push(found(EVENT_CONTRACT, snapshot, `${snapshot} is committed but be/apps/${service}/src/events.ts declares no events; delete the snapshot or restore the table.`, { service, drift: 'left-behind' }));
  }
  for (const file of consumers) {
    const app = BE_SERVICE_FILE.exec(file)[1];
    const { consumes, problems } = readConsumes(ts, readText(repoRoot, file) ?? '');
    if (problems.length > 0) {
      findings.push(found(EVENT_CONTRACT, file, `${file} is not a literal consumes table: ${problems.join('; ')}.`, { app }));
      continue;
    }
    for (const [service, events] of Object.entries(consumes)) {
      const snapshot = `be/contracts/${service}/events.json`;
      const text = tracked.has(snapshot) ? readText(repoRoot, snapshot) : null;
      let vendored = null;
      try { vendored = text === null ? null : JSON.parse(text).events ?? null; } catch { vendored = null; }
      if (vendored === null) {
        findings.push(found(EVENT_CONTRACT, file, `${file}: ${app} consumes events of ${service}, but the vendored contract ${snapshot} is ${text === null ? 'not committed' : 'not a JSON event contract'}; a consumer is judged against the snapshot, so vendor it (\`npm run contract:emit\`).`, { app, service }));
        continue;
      }
      for (const [event, version] of Object.entries(events)) {
        const declared = vendored[event];
        if (declared === undefined) findings.push(found(EVENT_CONTRACT, file, `${file}: ${app} consumes ${service} event "${event}", which ${snapshot} does not declare.`, { app, service, event }));
        else if (declared.version !== version) findings.push(found(EVENT_CONTRACT, file, `${file}: ${app} consumes ${service} event "${event}" at version ${version}, but ${snapshot} declares version ${declared.version}; update the consumer (and its handling) or the provider's version.`, { app, service, event }));
      }
    }
  }
  return findings;
}

// ------------------------------------------------------------------------------------------------ R132 async specs

/** The consumer files: the slot be.transport.message's `<event>.consumer.ts`, as `be/src/features/<feature>/transport/message/<stem>.consumer.ts`. */
const isConsumerFile = (file, messagePath) => new RegExp(`^be/${messagePath.replace(/<[a-z][a-z0-9-]*>/g, '[^/]+')}[^/]+\\.consumer\\.ts$`).test(file);

/** Whether a source file declares a saga: a method decorated with `Saga` imported from `@nestjs/cqrs` (by import origin, never by name). */
function declaresSaga(ts, text) {
  if (!text.includes('@nestjs/cqrs') || !text.includes('Saga')) return false;
  const sourceFile = ts.createSourceFile('x.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const locals = new Set();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== '@nestjs/cqrs') continue;
    const named = statement.importClause?.namedBindings;
    if (named && ts.isNamedImports(named)) for (const element of named.elements) if ((element.propertyName ?? element.name).text === 'Saga') locals.add(element.name.text);
  }
  if (locals.size === 0) return false;
  let saga = false;
  const visit = (node) => {
    if (saga) return;
    if (ts.isDecorator(node)) {
      const call = ts.isCallExpression(node.expression) ? node.expression.expression : node.expression;
      if (ts.isIdentifier(call) && locals.has(call.text)) saga = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return saga;
}

/** The string literals of a source text (a quick scan; the consumer names an event as a literal). */
const literalsOf = (text) => new Set([...text.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)].map((match) => match[2]));

/** Findings of R132. `messagePath` is the path of the slot be.transport.message (`src/features/<feature>/transport/message/`). */
export function asyncSpecFindings({ repoRoot, files, messagePath = 'src/features/<feature>/transport/message/' }) {
  const ts = typescriptFor(repoRoot);
  if (ts === null) return [];
  const sources = files.filter((file) => file.startsWith('be/src/') && file.endsWith('.ts') && !file.startsWith('be/src/tests/') && !/\.(spec|e2e-spec|integration-spec|contract-spec)\.ts$/.test(file));
  const eventNames = new Set();
  for (const snapshot of files.filter((file) => SNAPSHOT.test(file))) {
    try { for (const name of Object.keys(JSON.parse(readText(repoRoot, snapshot) ?? '{}').events ?? {})) eventNames.add(name); } catch { /* an unreadable snapshot is R131's */ }
  }
  const e2e = files.filter((file) => /^be\/src\/tests\/e2e\/[^/]+\/[^/]+\.e2e-spec\.ts$/.test(file));
  const findings = [];
  for (const file of sources) {
    const consumer = isConsumerFile(file, messagePath);
    const text = readText(repoRoot, file);
    if (text === null) continue;
    const saga = !consumer && declaresSaga(ts, text);
    if (!consumer && !saga) continue;
    const kind = consumer ? 'consumer' : 'saga';
    const stem = path.posix.basename(file).replace(ASYNC_SUFFIX, '').replace(/\.ts$/, '');
    const specs = e2e.filter((spec) => path.posix.basename(spec) === `${stem}.e2e-spec.ts`);
    const expected = `be/src/tests/e2e/<area>/${stem}.e2e-spec.ts`;
    if (specs.length === 0) {
      findings.push(found(ASYNC_SPEC_MISSING, file, `${file} is a message ${kind} with no spec; an async flow is proven through the world: add ${expected}, which boots the apps with useTestWorld and ${consumer ? 'publishes the event it consumes and reads the persisted effect back, including a redelivery' : 'drives the failure that triggers the compensation and reads the compensated state back'}.`, { kind, expected }));
      continue;
    }
    const specText = specs.map((spec) => readText(repoRoot, spec) ?? '').join('\n');
    if (!/\buseTestWorld\s*\(/.test(specText)) findings.push(found(ASYNC_SPEC_MISSING, specs[0], `${specs[0]} is the spec of the ${kind} ${file} but never calls useTestWorld; an async flow is proven through the world, not by calling the ${kind} directly.`, { kind, expected }));
    else if (consumer) {
      const named = [...literalsOf(text)].filter((literal) => eventNames.has(literal));
      if (named.length > 0 && !named.some((name) => specText.includes(name))) findings.push(found(ASYNC_SPEC_MISSING, specs[0], `${specs[0]} is the spec of the consumer ${file} but never names the event it consumes (${named.map((name) => `"${name}"`).join(', ')}); it must publish that event and read the effect back.`, { kind, expected }));
    }
  }
  return findings;
}

// ------------------------------------------------------------------------------------------------ entry

/** Every finding of the microservice policy over the app at `repoRoot`; `files` are its tracked app-relative paths. */
export function serviceFindings({ repoRoot, files, repo }) {
  return [
    ...servicePlacementFindings({ files }),
    ...imagePinFindings({ repoRoot, repo }),
    ...serviceStackFindings({ repoRoot, repo }),
    ...eventContractFindings({ repoRoot, files }),
    ...asyncSpecFindings({ repoRoot, files }),
  ];
}
