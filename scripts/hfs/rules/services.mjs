// services.mjs - the microservice policy of a product that runs more than one service (R163 to R167).
// A product keeps every back-end service as a Nest app at `be/apps/<service>/` of the one repository, sharing the `be/src` libraries and
// the one package.json; the services it does not own stay pinned images in the stack. Five tree checks:
//   R163 HFS_SERVICE_PLACEMENT      a service root (a Dockerfile, or a package.json other than the app's own and a workspace package's)
//                                   exists only at be/apps/<service>/ (fe/apps/<app>/Dockerfile is a front end's);
//   R164 HFS_IMAGE_UNPINNED         in a multi-service product every component image of application-stacks.yaml is a digest or an exact
//                                   version (x.y.z), never a missing tag, `latest`, a branch word or a major/minor-only tag;
//   R165 HFS_SERVICE_STACK_DECLARATION  each api or worker app of a multi-service product is a `role: service` component of the stack;
//   R166 HFS_EVENT_CONTRACT         the async contract is vendored: `be/contracts/<service>/events.json` equals the provider's
//                                   `apps/<service>/src/events.ts` table (an event may declare `compensates: "<event>"`), every event a
//                                   consumer's `apps/<app>/src/consumes.ts` names exists in that snapshot at the same version;
//   R167 BE_ASYNC_SPEC_MISSING      every consumed event (a consumes.ts entry) is named by an e2e spec through `useTestWorld`; the spec of a
//                                   saga step (an event whose contract says `compensates`) also names the compensated event, so the whole
//                                   flow is driven, not the undo alone.
// "Multi-service" = two or more be apps of kind api or worker. A single-service product is judged by R163 and R166-R167 only.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findStackDeclaration } from '../../lib/stack-declaration.mjs';
import { loadTypescript } from '../../lib/package-at.mjs';
import { propertyText } from '../../lib/ts-ast.mjs';
import { folded, readEventClasses, snapshotText } from '../../lib/event-contract.mjs';
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
const WORKSPACE_PACKAGE_JSON = /^fe\/(?:packages|apps)\/[^/]+\/package\.json$/;
const SNAPSHOT = /^be\/contracts\/([^/]+)\/events\.json$/;
const DIGEST = /@sha256:[0-9a-f]{64}$/;
const EXACT_TAG = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const EVENT_CLASS_FILE = /^be\/src\/modules\/events\/([^/]+)\/[^/]+\.event\.ts$/;
const CONSUMER_FILE = /^be\/src\/features\/(?:[^/]+\/)+transport\/message\/[^/]+\.consumer\.ts$/;
const E2E_SPEC = /^be\/src\/tests\/e2e\/[^/]+\/[^/]+\.e2e-spec\.ts$/;
const USE_TEST_WORLD = /\buseTestWorld\s*\(/;

/** The be apps of kind api or worker. */
const servicesOf = (repo) => (repo.sides?.be?.apps ?? []).filter((app) => SERVICE_KINDS.has(app.kind));

/** The TypeScript compiler of the app (else of the runtime), or null. */
const typescriptFor = (repoRoot) => loadTypescript(repoRoot, HERE);

// ------------------------------------------------------------------------------------------------ R163 placement

/** Findings of R163: a service root outside `be/apps/<service>/`. */
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

// ------------------------------------------------------------------------------------------------ R164 pinned images

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

/** Findings of R164 over a multi-service product's stack declaration. */
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

// ------------------------------------------------------------------------------------------------ R165 stack declaration

/** Findings of R165: each service app of a multi-service product is a `role: service` component. */
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

// ------------------------------------------------------------------------------------------------ R166 event contract

/** The typed event classes of every service: `[{ service, file, className, name, version, compensates, payload }]` and the problems of the ones that cannot be read. */
function eventClassesOf({ repoRoot, files, ts }) {
  const classes = [];
  const problems = [];
  for (const file of files.filter((candidate) => EVENT_CLASS_FILE.test(candidate)).sort()) {
    const service = EVENT_CLASS_FILE.exec(file)[1];
    const read = readEventClasses(ts, readText(repoRoot, file) ?? '', file);
    for (const event of read.events) classes.push({ service, file, ...event });
    for (const problem of read.problems) problems.push({ service, file, problem });
  }
  return { classes, problems };
}

/** Findings of R166: each service's event classes are the one source of its vendored `events.json`, and a compensating event names a declared event. */
export function eventContractFindings({ repoRoot, files }) {
  const classFiles = files.filter((file) => EVENT_CLASS_FILE.test(file));
  const snapshots = files.filter((file) => SNAPSHOT.test(file));
  if (classFiles.length === 0 && snapshots.length === 0) return [];
  const ts = typescriptFor(repoRoot);
  if (ts === null) return [];
  const tracked = new Set(files);
  const { classes, problems } = eventClassesOf({ repoRoot, files, ts });
  const findings = problems.map(({ service, file, problem }) => found(EVENT_CONTRACT, file, `${file} is not an event class the contract can be emitted from: ${problem}.`, { service }));
  const services = [...new Set(classes.map((event) => event.service))].sort();
  const declared = new Set(classes.map((event) => event.name));
  for (const service of services) {
    const snapshot = `be/contracts/${service}/events.json`;
    const events = classes.filter((event) => event.service === service);
    if (!tracked.has(snapshot)) findings.push(found(EVENT_CONTRACT, snapshot, `${service} declares event classes (be/src/modules/events/${service}/) but ${snapshot} is not committed; run \`npm run contract:emit\` and commit the snapshot, the contract its consumers rely on.`, { service }));
    else if (folded(readText(repoRoot, snapshot) ?? '') !== snapshotText(service, events)) findings.push(found(EVENT_CONTRACT, snapshot, `${snapshot} differs from what the event classes of ${service} emit now; run \`npm run contract:emit\` and commit the result.`, { service, drift: 'stale' }));
  }
  for (const snapshot of snapshots) {
    const service = SNAPSHOT.exec(snapshot)[1];
    if (!services.includes(service) && !problems.some((entry) => entry.service === service)) findings.push(found(EVENT_CONTRACT, snapshot, `${snapshot} is committed but be/src/modules/events/${service}/ declares no event class; delete the snapshot or restore the classes.`, { service, drift: 'left-behind' }));
  }
  for (const event of classes) {
    if (event.compensates !== undefined && !declared.has(event.compensates)) findings.push(found(EVENT_CONTRACT, event.file, `${event.file}: event "${event.name}" compensates "${event.compensates}", which no event class declares; name the event whose step it undoes.`, { service: event.service, event: event.name }));
  }
  return findings;
}

// ------------------------------------------------------------------------------------------------ R167 async specs

/** The class an expression names, from `readonly event = <Class>` of a consumer: the identifier, or null. */
function consumedClassOf(ts, text) {
  return propertyText(ts, text, { file: 'consumer.ts', key: 'event', declaration: true, kind: 'identifier' });
}

/** The events the consumers consume: `[{ file, className, service, event }]` from `readonly event = <EventClass>` of every `transport/message/*.consumer.ts`. */
function consumedEvents({ repoRoot, files, ts }) {
  const { classes } = eventClassesOf({ repoRoot, files, ts });
  const consumed = [];
  for (const file of files.filter((candidate) => CONSUMER_FILE.test(candidate))) {
    const className = consumedClassOf(ts, readText(repoRoot, file) ?? '');
    const event = classes.find((candidate) => candidate.className === className);
    if (event !== undefined) consumed.push({ file, className, service: event.service, event: event.name, compensates: event.compensates });
  }
  return consumed;
}

/** Findings of R167: every consumed event has an e2e spec through the world; a saga step's spec also names the event it compensates. */
export function asyncSpecFindings({ repoRoot, files }) {
  const ts = typescriptFor(repoRoot);
  if (ts === null) return [];
  const consumed = consumedEvents({ repoRoot, files, ts });
  if (consumed.length === 0) return [];
  const specs = files
    .filter((file) => E2E_SPEC.test(file))
    .map((file) => ({ file, text: readText(repoRoot, file) ?? '' }))
    .filter(({ text }) => USE_TEST_WORLD.test(text));
  const findings = [];
  for (const { file, className, service, event, compensates } of consumed) {
    const named = specs.filter(({ text }) => text.includes(event));
    if (named.length === 0) {
      findings.push(found(ASYNC_SPEC_MISSING, file, `${file}: the consumer of ${service} event "${event}" (${className}) has no e2e spec; add be/src/tests/e2e/<area>/<name>.e2e-spec.ts, which boots the apps with useTestWorld and names it: publish the event, read the persisted effect back and redeliver it.`, { service, event }));
      continue;
    }
    if (typeof compensates === 'string' && !named.some(({ text }) => text.includes(compensates))) {
      findings.push(found(ASYNC_SPEC_MISSING, named[0].file, `${named[0].file} is the spec of the saga step "${event}", which undoes "${compensates}", but never names it; the spec drives the whole flow: the step, the failure, then the compensated state.`, { service, event, compensates }));
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
