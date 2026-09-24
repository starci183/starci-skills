#!/usr/bin/env node
// check-starcistacks.mjs - the .starcistacks services contract (owner ruling 2026-09-24: "stacks làm rõ
// codecov, sonar ... update .claude và enforce định dạng .starcistacks").
//
// Every product states the delivery and quality services its code and CI use - Sonar, Codecov, a
// container registry, analytics, error tracking - in the `services` block of its stack declaration
// (modules/schemas/application-stacks.schema.yaml $defs.service): provider, mode local|hosted|disabled,
// host (local and public URL), the stack that runs a local one, project keys per repository, credentials
// as custody references, how GitHub CI gets them and ownerAction. A Kernel or an op reads this block
// before it asks for any credential, and never asks the owner for what it declares `ownerAction: none`
// with custody present.
//
//   node scripts/checks/check-starcistacks.mjs <repo-root> [--new] [--admitted-at <ISO|ms> [--op <op>]] [--json]
//
//   --new          the repository is being created by this leg (interface.scaffold, backend.scaffold,
//                  package.scaffold): a missing declaration or services block is refused, not a suspect
//   --admitted-at  the leg's admission (api op-contract --json admission.admittedAt): finding codes a
//                  contract change added after it are suspects for that leg (modules/kernel/contract-changes.yaml)
//
// Refusals: an unknown or ambiguous service declaration, custody that is missing where it is declared,
// an owner action declared for something custody already holds, CI calling a service the declaration
// disables or omits, and a tracked plaintext secret. Everything an existing repository merely lacks -
// the declaration, the services block, the .starcistacks rename, ignore rules - is a suspect with a
// planned follow-up (workspace.manage mode stacks), never a block on running work.
//
// Values are never read: custody presence is a file-existence test, and nothing here prints a secret.
// Exit 0 clean (suspects allowed), 1 refused, 2 usage.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

export const RESULT_SCHEMA = 'starci/starcistacks-check@1';
export const DECLARATION_SCHEMA = 'starci/application-stacks@1';
export const DECLARATION = 'application-stacks.yaml';
/** Canonical root first; `.stacks` is the pre-rename name of the same tree. */
export const STACK_ROOTS = ['.starcistacks', '.stacks'];
export const CONTRACT_CHANGE = 'starcistacks-services';
export const FOLLOW_UP = { op: 'workspace.manage', params: { mode: 'stacks' },
  detail: 'author the services block of the repository stack declaration (sonar, codecov and every other delivery/quality service) from examples/starcistacks-services/<repository>.services.yaml' };
const MAX_BYTES = 2 * 1024 * 1024;

/** The closed service catalog: its providers and the CI text that shows a workflow calls it. */
export const SERVICE_CATALOG = {
  sonar: { providers: ['sonarqube', 'sonarcloud'], words: ['sonar', 'sonarqube', 'sonarcloud'],
    ci: [/SonarSource\/sonar(?:qube|cloud)-[a-z-]+-action/i, /\bsonar-scanner\b/i, /\bSONAR_TOKEN\b/] },
  codecov: { providers: ['codecov'], words: ['codecov'], ci: [/codecov\/codecov-action/i, /\bCODECOV_TOKEN\b/] },
  'container-registry': { providers: ['ghcr', 'dockerhub', 'ecr', 'gar'], words: ['ghcr', 'registry', 'docker hub', 'dockerhub'],
    ci: [/docker\/login-action/i] },
  analytics: { providers: ['posthog', 'plausible', 'umami', 'google-analytics'], words: ['posthog', 'plausible', 'umami', 'analytics'], ci: [] },
  'error-tracking': { providers: ['sentry', 'glitchtip'], words: ['sentry', 'glitchtip'], ci: [/getsentry\/action-release/i, /\bSENTRY_AUTH_TOKEN\b/] },
};

/** Every finding code this check can emit (registered by contract change starcistacks-services). */
export const CODES = [
  'STACKS_DECLARATION_MISSING', 'STACKS_DECLARATION_INVALID', 'STACKS_SERVICES_MISSING', 'STACKS_LEGACY_ROOT',
  'STACKS_DUAL_ROOT', 'STACKS_SCHEMA_INVALID', 'STACKS_SERVICE_UNKNOWN', 'STACKS_PROVIDER_UNKNOWN',
  'STACKS_SERVICE_AMBIGUOUS', 'STACKS_STACK_UNRESOLVED', 'STACKS_CUSTODY_MISSING', 'STACKS_CUSTODY_UNVERIFIED',
  'STACKS_OWNER_ACTION_REDUNDANT', 'STACKS_PROJECT_MISSING', 'STACKS_PROJECT_DRIFT', 'STACKS_HOST_DRIFT',
  'STACKS_SERVICE_UNDECLARED', 'STACKS_CI_CONTRADICTION', 'STACKS_CI_UNUSED', 'STACKS_CI_NAME_UNREFERENCED',
  'STACKS_PLAINTEXT_TRACKED', 'STACKS_ENC_TWIN_MISSING', 'STACKS_GITIGNORE_OPEN', 'STACKS_DECLARATION_IGNORED',
];
/** Codes an older leg's admission never demotes: a tracked plaintext secret is a leak already. */
const SAFETY_CODES = new Set(['STACKS_PLAINTEXT_TRACKED']);

const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const list = (value) => (Array.isArray(value) ? value : []);
const slash = (value) => String(value ?? '').replaceAll('\\', '/');
const isFile = (file) => { try { return fs.statSync(file).isFile(); } catch { return false; } };
const isDir = (file) => { try { return fs.statSync(file).isDirectory(); } catch { return false; } };
const readText = (file) => { try { return fs.statSync(file).size > MAX_BYTES ? null : fs.readFileSync(file, 'utf8'); } catch { return null; } };
const escapeRe = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The runtime's source host: the repository this runtime tree lives in (STARCI_SOURCE_ROOT overrides). */
export const sourceHostRoot = () => (process.env.STARCI_SOURCE_ROOT ? path.resolve(process.env.STARCI_SOURCE_ROOT) : path.dirname(skillRoot));

// ---- schema ---------------------------------------------------------------------------------------------

let schemaCache = null;
function declarationSchema() {
  if (!schemaCache) schemaCache = parseYaml(fs.readFileSync(path.join(skillRoot, 'modules', 'schemas', 'application-stacks.schema.yaml'), 'utf8'));
  return schemaCache;
}

/** The subset of JSON Schema the declaration schema uses: type, const, enum, pattern, minLength, required, properties, additionalProperties, items, minProperties, $ref, anyOf. */
export function schemaErrors(value, shape, at = '$', root = declarationSchema()) {
  const resolve = (ref) => ref.slice(2).split('/').reduce((node, key) => node?.[key], root);
  const run = (node, s, where) => {
    if (!plain(s)) return [];
    if (s.$ref) return run(node, resolve(s.$ref), where);
    if (Array.isArray(s.anyOf))
      return s.anyOf.some((option) => run(node, option, where).length === 0) ? [] : [{ path: where, message: 'matches none of the allowed shapes' }];
    const typed = s.type === 'object' ? plain(node) : s.type === 'array' ? Array.isArray(node) : s.type ? typeof node === s.type : true;
    if (!typed) return [{ path: where, message: `expected ${s.type}` }];
    const out = [];
    if (Object.hasOwn(s, 'const') && node !== s.const) out.push({ path: where, message: `must be ${JSON.stringify(s.const)}` });
    if (Array.isArray(s.enum) && !s.enum.includes(node)) out.push({ path: where, message: `must be one of ${s.enum.join(', ')}` });
    if (typeof node === 'string') {
      if (s.minLength && node.length < s.minLength) out.push({ path: where, message: 'string too short' });
      if (s.pattern && !new RegExp(s.pattern, 'u').test(node)) out.push({ path: where, message: `does not match ${s.pattern}` });
    }
    if (Array.isArray(node)) { node.forEach((item, index) => { if (s.items) out.push(...run(item, s.items, `${where}[${index}]`)); }); return out; }
    if (!plain(node)) return out;
    if (s.minProperties && Object.keys(node).length < s.minProperties) out.push({ path: where, message: 'object has too few properties' });
    for (const key of s.required ?? []) if (!Object.hasOwn(node, key)) out.push({ path: where, message: `missing ${key}` });
    for (const [key, child] of Object.entries(node)) {
      if (Object.hasOwn(s.properties ?? {}, key)) out.push(...run(child, s.properties[key], `${where}.${key}`));
      else if (s.additionalProperties === false) out.push({ path: `${where}.${key}`, message: 'unknown field' });
      else if (plain(s.additionalProperties)) out.push(...run(child, s.additionalProperties, `${where}.${key}`));
    }
    return out;
  };
  return run(value, shape, at);
}

// ---- locating declarations and repositories -------------------------------------------------------------

function readDeclaration(file) {
  const raw = readText(file);
  if (raw === null) return { error: 'unreadable or larger than 2 MiB' };
  try { const doc = parseYaml(raw); return plain(doc) ? { doc } : { error: 'not a YAML mapping' }; }
  catch (error) { return { error: `YAML does not parse: ${String(error?.message ?? error).split('\n')[0]}` }; }
}

/**
 * The stack declaration a repository owns: {root, file, legacy, dual, roots, doc|error} - or {missing:true, roots}
 * when neither .starcistacks/application-stacks.yaml nor the legacy .stacks one exists.
 */
export function findStackDeclaration(repoRoot) {
  const repo = path.resolve(String(repoRoot ?? ''));
  const roots = STACK_ROOTS.filter((root) => isDir(path.join(repo, root)));
  for (const root of STACK_ROOTS) {
    const file = path.join(repo, root, DECLARATION);
    if (!isFile(file)) continue;
    return { repo, root, file, legacy: root !== STACK_ROOTS[0], dual: roots.length > 1, roots, ...readDeclaration(file) };
  }
  return { repo, missing: true, roots, dual: roots.length > 1 };
}

/**
 * A repository named in a declaration, on this machine: the declaring repository itself, the runtime's
 * source host, or a sibling checkout of either. Null when it is not checked out here.
 */
export function resolveRepository(name, { fromRepo } = {}) {
  const wanted = text(name);
  if (!wanted) return null;
  const same = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
  const candidates = [];
  if (fromRepo) candidates.push(path.resolve(fromRepo));
  candidates.push(sourceHostRoot());
  for (const dir of candidates) if (same(path.basename(dir), wanted) && isDir(dir)) return dir;
  for (const dir of candidates) {
    const sibling = path.join(path.dirname(dir), wanted);
    if (isDir(sibling)) return sibling;
  }
  return null;
}

/** A frontend declared by its backend's stack: a sibling declaration whose `sources` lists this repository. */
function governingDeclaration(repo) {
  const name = path.basename(repo);
  let entries = [];
  try { entries = fs.readdirSync(path.dirname(repo), { withFileTypes: true }); } catch { return null; }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === name) continue;
    for (const root of STACK_ROOTS) {
      const file = path.join(path.dirname(repo), entry.name, root, DECLARATION);
      if (!isFile(file)) continue;
      const read = readDeclaration(file);
      if (read.doc && list(read.doc.sources).some((source) => source?.repository === name))
        return { repo: path.join(path.dirname(repo), entry.name), root, file, legacy: root !== STACK_ROOTS[0], governs: name, ...read };
    }
  }
  return null;
}

// ---- normalizing a service ------------------------------------------------------------------------------

/** One declared service with its custody resolved to presence (never a value). */
export function normalizeService(id, entry, { declaringRepo } = {}) {
  const s = plain(entry) ? entry : {};
  const stack = plain(s.stack) ? s.stack : null;
  const stackRepo = stack ? resolveRepository(stack.repository, { fromRepo: declaringRepo }) : null;
  const stackDir = stackRepo && text(stack.root) && text(stack.environment) ? path.join(stackRepo, stack.root, stack.environment) : null;
  const credentials = list(s.credentials).filter(plain).map((credential) => {
    const custody = plain(credential.custody) ? credential.custody : {};
    const repo = resolveRepository(custody.repository, { fromRepo: declaringRepo });
    const rel = text(custody.path);
    const abs = repo && rel && !rel.split(/[\\/]/).includes('..') ? path.join(repo, rel) : null;
    return { id: text(credential.id), env: text(credential.env), key: text(credential.key), purpose: text(credential.purpose),
      custody: { repository: text(custody.repository), path: rel, resolved: Boolean(repo), file: abs,
        encPresent: abs ? isFile(`${abs}.enc`) : null, plainPresent: abs ? isFile(abs) : null } };
  });
  const ci = plain(s.ci) ? s.ci : {};
  return {
    id, provider: text(s.provider), mode: text(s.mode), purpose: text(s.purpose), reason: text(s.reason), auth: text(s.auth),
    host: { local: text(s.host?.local), public: text(s.host?.public), fromCredential: text(s.host?.fromCredential) },
    stack: stack ? { repository: text(stack.repository), root: text(stack.root), environment: text(stack.environment), compose: text(stack.compose),
      container: text(stack.container), publishedBy: text(stack.publishedBy), repo: stackRepo, dir: stackDir,
      composeFile: stackDir && text(stack.compose) ? path.join(stackDir, stack.compose) : null } : null,
    projects: list(s.projects).filter(plain).map((project) => ({ repository: text(project.repository), key: text(project.key), name: text(project.name) })),
    credentials,
    ci: { wiring: text(ci.wiring), workflow: text(ci.workflow), permissions: list(ci.permissions).map(String),
      secrets: list(ci.secrets).filter(plain).map((item) => ({ name: text(item.name), credential: text(item.credential) })),
      vars: list(ci.vars).filter(plain).map((item) => ({ name: text(item.name), value: text(item.value) })),
      provisioning: text(ci.provisioning) },
    ownerAction: s.ownerAction === 'none' ? 'none' : plain(s.ownerAction) ? { needed: text(s.ownerAction.needed), reason: text(s.ownerAction.reason) } : null,
  };
}

const custodyHeld = (service) => (service.credentials.length
  ? service.credentials.every((credential) => credential.custody.encPresent || credential.custody.plainPresent)
  : ['oidc', 'github-token', 'none'].includes(service.auth));

/**
 * What a tool (scripts/checks/sonar-local.mjs, a CI wiring leg) reads for one service of one repository:
 * the repository's own (or governing) declaration first, then the source host's declaration when its entry
 * lists this repository among its projects. Null when nothing declares it.
 */
export function resolveStackService(repoRoot, serviceId) {
  const repo = path.resolve(String(repoRoot ?? ''));
  const name = path.basename(repo);
  const own = findStackDeclaration(repo);
  const candidates = [own.doc ? own : governingDeclaration(repo)].filter(Boolean);
  const host = sourceHostRoot();
  if (path.resolve(host) !== repo) { const source = findStackDeclaration(host); if (source.doc) candidates.push({ ...source, sourceHost: true }); }
  for (const declaration of candidates) {
    const entry = declaration.doc?.services?.[serviceId];
    if (!plain(entry)) continue;
    let service = normalizeService(serviceId, entry, { declaringRepo: declaration.repo });
    const listed = service.projects.some((project) => project.repository === name);
    if (declaration.sourceHost && !listed) continue;
    // Through the source host a product gets the shared server, its shared credentials and its own project
    // token (a credential whose id is a project key); other projects' tokens and the host's CI wiring are not its.
    const ownKey = service.projects.find((project) => project.repository === name)?.key;
    const projectKeys = new Set(service.projects.map((project) => project.key));
    if (declaration.sourceHost) service = { ...service, credentials: service.credentials.filter((credential) => !projectKeys.has(credential.id) || credential.id === ownKey),
      ci: { wiring: null, workflow: null, permissions: [], secrets: [], vars: [], provisioning: null } };
    return { declaration: declaration.file, declaringRepo: declaration.repo, legacy: Boolean(declaration.legacy), sourceHost: Boolean(declaration.sourceHost),
      repository: name, projectKey: service.projects.find((project) => project.repository === name)?.key ?? null, ...service };
  }
  return null;
}

// ---- repository evidence --------------------------------------------------------------------------------

function workflowTexts(repo) {
  const dir = path.join(repo, '.github', 'workflows');
  let entries = [];
  try { entries = fs.readdirSync(dir).filter((name) => /\.ya?ml$/i.test(name)); } catch { return []; }
  return entries.map((name) => ({ file: `.github/workflows/${name}`, text: readText(path.join(dir, name)) ?? '' }));
}

function readProperties(file) {
  const out = {};
  for (const raw of String(readText(file) ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;
    const at = line.search(/[=:]/);
    if (at > 0) out[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return out;
}

function git(repo, args) {
  try {
    const result = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', timeout: 8000, windowsHide: true });
    if (result.error) return null;
    return { status: result.status, stdout: String(result.stdout ?? '') };
  } catch { return null; }
}

// ---- the check ------------------------------------------------------------------------------------------

/**
 * The whole check for one repository. `newRepo`: the leg creates this repository, so what it lacks is
 * refused. `advisoryCodes`: codes a contract change added after the checked leg was admitted - suspects
 * for it (safety codes excepted).
 */
export function checkStarciStacks(repoRoot, { newRepo = false, advisoryCodes = [] } = {}) {
  const repo = path.resolve(String(repoRoot ?? ''));
  const name = path.basename(repo);
  const findings = [];
  const add = (level, code, file, message) => findings.push({ level, code, file: slash(file), message });
  const missingLevel = newRepo ? 'refuse' : 'suspect';

  const own = findStackDeclaration(repo);
  const governing = own.missing ? governingDeclaration(repo) : null;
  const declaration = own.missing ? governing : own;
  const shown = (file) => slash(path.relative(repo, file)) || '.';

  if (own.dual) add('suspect', 'STACKS_DUAL_ROOT', '.', `both ${own.roots.join(' and ')} exist; one repository owns one stack root - finish the rename to .starcistacks and remove the other`);
  if (own.missing && !governing) {
    add(missingLevel, 'STACKS_DECLARATION_MISSING', `.starcistacks/${DECLARATION}`,
      `no stack declaration (.starcistacks/${DECLARATION}, or the legacy .stacks one); the services this repository's CI uses are undeclared - follow-up: ${FOLLOW_UP.op} mode stacks`);
  } else if (declaration?.legacy) {
    add('suspect', 'STACKS_LEGACY_ROOT', shown(declaration.file), 'the declaration lives under the legacy .stacks root; rename the tree to .starcistacks (read the same way meanwhile)');
  }
  if (declaration?.error) add('refuse', 'STACKS_DECLARATION_INVALID', shown(declaration.file), declaration.error);
  if (declaration?.doc && declaration.doc.schema !== DECLARATION_SCHEMA)
    add('refuse', 'STACKS_DECLARATION_INVALID', shown(declaration.file), `schema must be ${DECLARATION_SCHEMA}`);

  const doc = declaration?.doc ?? null;
  const services = plain(doc?.services) ? doc.services : null;
  const declFile = declaration?.file ? shown(declaration.file) : `.starcistacks/${DECLARATION}`;
  if (doc && !Object.hasOwn(doc, 'services'))
    add(missingLevel, 'STACKS_SERVICES_MISSING', declFile, `the declaration has no services block; declare sonar, codecov and every other delivery/quality service the repository uses - follow-up: ${FOLLOW_UP.op} mode stacks`);

  // CI evidence: which services the workflows call, and which secret/variable names they read.
  const workflows = workflowTexts(repo);
  const ciText = workflows.map((workflow) => workflow.text).join('\n');
  const ciUses = Object.fromEntries(Object.entries(SERVICE_CATALOG).map(([id, entry]) => [id, workflows.filter((workflow) => entry.ci.some((re) => re.test(workflow.text))).map((workflow) => workflow.file)]));
  const normalized = {};

  if (services) {
    const schema = declarationSchema();
    for (const [id, entry] of Object.entries(services)) {
      if (!Object.hasOwn(SERVICE_CATALOG, id)) {
        add('refuse', 'STACKS_SERVICE_UNKNOWN', `${declFile}#services.${id}`, `${id} is not a catalogued service (${Object.keys(SERVICE_CATALOG).join(', ')}); a service the catalog does not know is one nobody can read unambiguously`);
        continue;
      }
      for (const issue of schemaErrors(entry, schema.$defs.service, `services.${id}`))
        add('refuse', 'STACKS_SCHEMA_INVALID', `${declFile}#${issue.path}`, issue.message);
      const service = normalizeService(id, entry, { declaringRepo: declaration.repo });
      normalized[id] = service;
      const at = `${declFile}#services.${id}`;
      const ambiguous = (message) => add('refuse', 'STACKS_SERVICE_AMBIGUOUS', at, message);
      if (service.provider && !SERVICE_CATALOG[id].providers.includes(service.provider))
        add('refuse', 'STACKS_PROVIDER_UNKNOWN', `${at}.provider`, `${service.provider} is not a ${id} provider (${SERVICE_CATALOG[id].providers.join(', ')})`);
      if (service.mode === 'disabled') {
        if (!service.reason) ambiguous('a disabled service states its reason');
        if (ciUses[id].length) add('refuse', 'STACKS_CI_CONTRADICTION', at, `declared disabled, but ${ciUses[id].join(', ')} call it`);
        continue;
      }
      if (service.mode === 'local') {
        if (!service.host.local) ambiguous('a local service names host.local, the URL the stack serves it on');
        if (!service.stack) ambiguous('a local service names the stack that runs it (repository, root, environment, compose)');
        else if (!service.stack.repo) add('suspect', 'STACKS_STACK_UNRESOLVED', `${at}.stack`, `repository ${service.stack.repository} is not checked out on this machine; its compose file and custody are unverified`);
        else if (!service.stack.composeFile || !isFile(service.stack.composeFile))
          add('refuse', 'STACKS_STACK_UNRESOLVED', `${at}.stack`, `${service.stack.repository}/${service.stack.root}/${service.stack.environment}/${service.stack.compose} does not exist`);
      }
      if (service.mode === 'hosted' && !service.host.public && !service.host.fromCredential)
        ambiguous('a hosted service names host.public, or host.fromCredential when the endpoint travels inside a credential');
      if (ciUses[id].length && service.ci.wiring !== 'not-used' && !service.host.public)
        ambiguous('GitHub CI reaches a service only through host.public; name it');
      if (!service.auth) ambiguous('auth is token, oidc, github-token or none');
      if (service.auth === 'token' && !service.credentials.length) ambiguous('auth token names at least one credential in custody');
      if (service.host.fromCredential && !service.credentials.some((credential) => credential.id === service.host.fromCredential))
        ambiguous(`host.fromCredential names ${service.host.fromCredential}, which is not one of its credentials`);
      if (!service.projects.length) ambiguous('an enabled service lists the project key of every repository it serves');
      const ids = new Set();
      for (const credential of service.credentials) {
        const where = `${at}.credentials.${credential.id ?? '?'}`;
        if (credential.id && ids.has(credential.id)) ambiguous(`credential id ${credential.id} is declared twice`);
        ids.add(credential.id);
        if (!credential.env && !credential.key) ambiguous(`credential ${credential.id ?? '?'} names the env variable or the file key its consumer reads`);
        if (!credential.custody.resolved) add('suspect', 'STACKS_CUSTODY_UNVERIFIED', where, `custody repository ${credential.custody.repository} is not checked out on this machine`);
        else if (!credential.custody.encPresent)
          add('refuse', 'STACKS_CUSTODY_MISSING', where, `${credential.custody.repository}/${credential.custody.path}.enc is not in custody; repair the stack custody (secret:gen / stack-secret) - never ask the owner for a value the declaration says the runtime holds`);
      }
      for (const secret of service.ci.secrets)
        if (secret.credential && !ids.has(secret.credential)) ambiguous(`ci secret ${secret.name} names credential ${secret.credential}, which the service does not declare`);
      if (plain(service.ownerAction) && service.credentials.length && custodyHeld(service))
        add('refuse', 'STACKS_OWNER_ACTION_REDUNDANT', `${at}.ownerAction`, 'every credential is already in custody; ownerAction must be none - the owner is never asked for what the runtime holds');
      if (service.ci.wiring === 'not-used' && ciUses[id].length)
        add('refuse', 'STACKS_CI_CONTRADICTION', `${at}.ci`, `ci.wiring not-used, but ${ciUses[id].join(', ')} call it`);
      if (service.ci.wiring === 'required' && !ciUses[id].length && SERVICE_CATALOG[id].ci.length)
        add('suspect', 'STACKS_CI_UNUSED', `${at}.ci`, 'ci.wiring required, but no workflow calls the service');
      if (['required', 'optional-follow-up'].includes(service.ci.wiring) && ciUses[id].length)
        for (const item of [...service.ci.secrets, ...service.ci.vars])
          if (item.name && !new RegExp(`\\b${escapeRe(item.name)}\\b`).test(ciText))
            add('suspect', 'STACKS_CI_NAME_UNREFERENCED', `${at}.ci`, `${item.name} is declared for CI but no workflow reads it`);
      if (ciUses[id].length && service.projects.length && !service.projects.some((project) => project.repository === name) && !governing)
        add('refuse', 'STACKS_PROJECT_MISSING', `${at}.projects`, `the workflows call ${id} but no project entry names repository ${name}`);
    }
  }

  for (const [id, files] of Object.entries(ciUses)) {
    if (!files.length || normalized[id] || (services && Object.hasOwn(services, id))) continue;
    const viaSource = resolveStackService(repo, id);
    if (viaSource && !services) continue;
    add(services ? 'refuse' : 'suspect', 'STACKS_SERVICE_UNDECLARED', declFile,
      `${files.join(', ')} call ${id}, which the declaration does not state${services ? '' : ` - follow-up: ${FOLLOW_UP.op} mode stacks`}`);
  }

  // Sonar settings the repository carries must agree with the declaration.
  const sonar = normalized.sonar ?? (services ? null : resolveStackService(repo, 'sonar'));
  const props = readProperties(path.join(repo, 'sonar-project.properties'));
  if (sonar && sonar.mode !== 'disabled' && Object.keys(props).length) {
    const declared = sonar.projects.find((project) => project.repository === name)?.key;
    if (declared && props['sonar.projectKey'] && props['sonar.projectKey'] !== declared)
      add(normalized.sonar ? 'refuse' : 'suspect', 'STACKS_PROJECT_DRIFT', 'sonar-project.properties', `sonar.projectKey ${props['sonar.projectKey']} but the declaration names ${declared}`);
    if (sonar.host.public && props['sonar.host.url'] && props['sonar.host.url'].replace(/\/+$/, '') !== sonar.host.public.replace(/\/+$/, ''))
      add('suspect', 'STACKS_HOST_DRIFT', 'sonar-project.properties', `sonar.host.url ${props['sonar.host.url']} but the declaration's public host is ${sonar.host.public}`);
  }

  // Custody layout (modules/schemas/stacks-layout.yaml custody, the product repositories' secrets-guard).
  for (const root of own.roots ?? []) {
    const tracked = git(repo, ['ls-files', '--', root]);
    if (tracked?.status === 0) {
      for (const file of tracked.stdout.split(/\r?\n/).filter(Boolean)) {
        const parts = slash(file).split('/');
        const custodyArea = parts.length > 3 && (parts[2] === 'runtime' || parts[2] === 'secrets');
        const base = parts.at(-1);
        if (custodyArea && !/\.enc$/.test(base) && !['KEYS.md', '.gitkeep'].includes(base))
          add('refuse', 'STACKS_PLAINTEXT_TRACKED', file, 'a custody member is tracked in plaintext; untrack it (git rm --cached), rotate the value and commit only its .enc twin');
      }
    }
    for (const env of fs.readdirSync(path.join(repo, root), { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
      const filesDir = path.join(repo, root, env.name, 'runtime', 'files');
      let members = [];
      try { members = fs.readdirSync(filesDir); } catch { continue; }
      const bare = members.filter((member) => !member.endsWith('.enc') && !/\.md$/i.test(member) && member !== '.gitkeep'
        && !/\.(rotation-pending|bak)$/.test(member) && !members.includes(`${member}.enc`));
      if (bare.length) add('suspect', 'STACKS_ENC_TWIN_MISSING', `${root}/${env.name}/runtime/files`,
        `${bare.length} plaintext custody member(s) have no .enc twin (${bare.slice(0, 5).join(', ')}${bare.length > 5 ? ', ...' : ''}); encrypt them (stack-secret) so another machine can decrypt them`);
    }
    const ignore = readText(path.join(repo, '.gitignore')) ?? '';
    if (!new RegExp(`^/?${escapeRe(root)}/\\*\\*\\s*$`, 'm').test(ignore))
      add('suspect', 'STACKS_GITIGNORE_OPEN', '.gitignore', `no deny-all rule \`${root}/**\`; custody plaintext is only safe when the tree is denied and *.enc, KEYS.md and the declaration are re-included`);
  }
  if (!own.missing && own.file) {
    const ignored = git(repo, ['check-ignore', '-q', '--', slash(path.relative(repo, own.file))]);
    if (ignored?.status === 0)
      add('suspect', 'STACKS_DECLARATION_IGNORED', shown(own.file), `the ignore rules hide the declaration; re-include it (!${slash(path.relative(repo, own.file))}) so every machine reads the same services`);
  }

  const advisory = new Set(advisoryCodes);
  for (const finding of findings)
    if (finding.level === 'refuse' && advisory.has(finding.code) && !SAFETY_CODES.has(finding.code)) Object.assign(finding, { level: 'suspect', advisory: true });
  const pick = (level) => findings.filter((finding) => finding.level === level).map((finding) => `${finding.file}: ${finding.message} [${finding.code}]${finding.advisory ? ' (added after this leg was admitted)' : ''}`);
  const refused = pick('refuse');
  const needsFollowUp = findings.some((finding) => ['STACKS_DECLARATION_MISSING', 'STACKS_SERVICES_MISSING', 'STACKS_SERVICE_UNDECLARED', 'STACKS_LEGACY_ROOT'].includes(finding.code) && finding.level !== 'refuse');
  const fixture = path.join(skillRoot, 'examples', 'starcistacks-services', `${name}.services.yaml`);
  return {
    schema: RESULT_SCHEMA, ok: refused.length === 0, repository: name, repoRoot: slash(repo), newRepo,
    declaration: declaration?.file ? slash(declaration.file) : null, root: declaration?.root ?? null, legacy: Boolean(declaration?.legacy),
    governedBy: governing ? slash(governing.repo) : null,
    services: Object.fromEntries(Object.entries(normalized).map(([id, service]) => [id, summary(service)])),
    refused, suspect: pick('suspect'), findings,
    ...(needsFollowUp ? { followUp: { change: CONTRACT_CHANGE, ...FOLLOW_UP, ...(isFile(fixture) ? { fixture: slash(path.relative(skillRoot, fixture)) } : {}) } } : {}),
  };
}

/** A report-safe view: custody as presence, never a value. */
function summary(service) {
  return { provider: service.provider, mode: service.mode, auth: service.auth, host: service.host,
    stack: service.stack ? { repository: service.stack.repository, root: service.stack.root, environment: service.stack.environment, compose: service.stack.compose, container: service.stack.container } : null,
    projects: service.projects, credentials: service.credentials.map((credential) => ({ id: credential.id, env: credential.env, key: credential.key,
      custody: `${credential.custody.repository}/${credential.custody.path}`, present: credential.custody.encPresent ?? null })),
    ci: service.ci, ownerAction: service.ownerAction };
}

// ---- the owner-ask guard --------------------------------------------------------------------------------

const ASK_WORDS = /\b(tokens?|secrets?|credentials?|api[ _-]?keys?|passwords?|host|url|access|github (?:settings?|secrets?|variables?)|repository (?:settings?|secrets?|variables?))\b|\bSONAR_[A-Z_]+|\bCODECOV_[A-Z_]+/i;

/**
 * An ask that requests what a stack declaration already answers: a service declared `ownerAction: none`
 * whose custody is present (or needs none), named by one of its credential/CI variable names or by the
 * service's name next to a credential word. Returns {service, provider, declaration, matched, message}
 * or null. Declarations read: the asking repository's own (or governing) one, then the source host's
 * when its entry lists this repository.
 */
export function ownerAskConflict({ repo, question } = {}) {
  if (!repo || question === undefined || question === null) return null;
  const body = typeof question === 'string' ? question : JSON.stringify(question);
  for (const id of Object.keys(SERVICE_CATALOG)) {
    const service = resolveStackService(repo, id);
    if (!service || service.mode === 'disabled' || service.ownerAction !== 'none' || !custodyHeld(service)) continue;
    const names = [...service.credentials.map((credential) => credential.env), ...service.ci.secrets.map((item) => item.name), ...service.ci.vars.map((item) => item.name)].filter(Boolean);
    const byName = names.find((item) => new RegExp(`\\b${escapeRe(item)}\\b`).test(body));
    const words = [...new Set([id, service.provider, ...SERVICE_CATALOG[id].words].filter(Boolean))];
    const byWord = words.find((word) => new RegExp(`\\b${escapeRe(word)}\\b`, 'i').test(body));
    if (!byName && !(byWord && ASK_WORDS.test(body))) continue;
    const custody = service.credentials.map((credential) => `${credential.custody.repository}/${credential.custody.path}`);
    return { service: id, provider: service.provider, declaration: slash(service.declaration), matched: byName ?? byWord,
      message: `${id} (${service.provider}, ${service.mode}) is declared in ${slash(service.declaration)} with ownerAction none${custody.length ? ` and its credentials in custody (${custody.join(', ')})` : ` and auth ${service.auth}`}; the owner is never asked for it. ${id === 'sonar' ? 'Run scripts/checks/sonar-local.mjs (status, ensure-project, scan) - it reads host, project and token from the declaration and custody. ' : ''}CI wiring is ${service.ci.wiring ?? 'undeclared'}${service.ci.provisioning ? ` (${service.ci.provisioning})` : ''}.` };
  }
  return null;
}

// ---- CLI ------------------------------------------------------------------------------------------------

async function admittedCodes(argv) {
  const at = argv.indexOf('--admitted-at');
  if (at < 0) return { ok: true, codes: [], drop: [] };
  const raw = argv[at + 1];
  const admittedAt = /^\d+$/.test(String(raw)) ? Number(raw) : Date.parse(String(raw));
  if (!Number.isFinite(admittedAt)) return { ok: false };
  const opAt = argv.indexOf('--op');
  const { advisoryCodesFor, loadContractChanges } = await import('../kernel/contract-version.mjs');
  const { codes } = advisoryCodesFor(loadContractChanges(skillRoot), { admittedAt, op: opAt >= 0 ? argv[opAt + 1] : null });
  return { ok: true, codes, drop: [at, at + 1, ...(opAt >= 0 ? [opAt, opAt + 1] : [])] };
}

const USAGE = 'Usage: node scripts/checks/check-starcistacks.mjs <repo-root> [--new] [--admitted-at <ISO|epoch-ms> [--op <op>]] [--json]\n\nHolds a repository\'s stack declaration services block (sonar, codecov, container-registry, analytics, error-tracking) and its custody layout to modules/schemas/application-stacks.schema.yaml and stacks-layout.yaml. Exit 0 clean (suspects allowed), 1 refused, 2 usage.\n';

export async function checkStarciStacksMain(argv = []) {
  const admitted = await admittedCodes(argv);
  if (!admitted.ok) return { exitCode: 2, text: '--admitted-at takes an ISO date-time or epoch milliseconds (api op-contract --json admission.admittedAt)\n' };
  const rest = argv.filter((_, index) => !admitted.drop.includes(index));
  const args = rest.filter((arg) => !['--json', '--new'].includes(arg));
  if (args.includes('--help') || args.includes('-h')) return { exitCode: 0, text: USAGE };
  if (args.length !== 1) return { exitCode: 2, text: USAGE };
  if (!isDir(args[0])) return { exitCode: 2, text: `${args[0]}: not a directory\n` };
  const result = checkStarciStacks(args[0], { newRepo: rest.includes('--new'), advisoryCodes: admitted.codes });
  if (rest.includes('--json')) return { exitCode: result.ok ? 0 : 1, text: `${JSON.stringify(result, null, 2)}\n` };
  const lines = [...result.refused.map((line) => `  REFUSED ${line}`), ...result.suspect.map((line) => `  SUSPECT ${line}`)];
  if (result.followUp) lines.push(`  follow-up: ${result.followUp.op} mode ${result.followUp.params.mode} (${result.followUp.change})${result.followUp.fixture ? ` from ${result.followUp.fixture}` : ''}`);
  return { exitCode: result.ok ? 0 : 1, text: `${lines.join('\n')}${lines.length ? '\n' : ''}${result.ok ? 'OK' : 'FAIL'}: starcistacks ${result.repository} - ${result.refused.length} refused, ${result.suspect.length} suspect, services: ${Object.keys(result.services).join(', ') || 'none declared'}.\n` };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkStarciStacksMain(process.argv.slice(2)).then(({ exitCode, text: out }) => { process.stdout.write(out); process.exitCode = exitCode; },
    (error) => { process.stderr.write(`check-starcistacks: ${error?.stack ?? error}\n`); process.exitCode = 2; });
}
