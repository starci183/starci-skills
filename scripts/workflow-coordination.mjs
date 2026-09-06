// Executable assignments for workflowTopologies.coordinated. The coordinator's sealed history is
// the sole ownership authority. The Source locator index is durable discovery, never a claim map.
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual as equal } from 'node:util';
import { contentHash, digest, locateWorkflowSession, realPath, sameRoot } from './workflow-root.mjs';
import { mutateSession, withCoordinationLock, replaceFile, currentSessionMutation } from './session-lock.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fail = (code, message) => { throw Error(`${code}: ${message}`); };
const check = (condition, code, message) => { if (!condition) fail(code, message); };
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const safeId = value => typeof value === 'string' && /^[a-z0-9][a-z0-9.-]*$/.test(value) && !value.includes('..');
const cellPattern = /^\d+\/\d+$/;
const dependencyIdentity = (extractionId, consumerSessionId, kind) => `${extractionId}:${consumerSessionId}:${kind}`;
const addressEqual = (a, b) => !!a && !!b && a.ref === b.ref && a.hash === b.hash;
const sessionState = session => currentSessionMutation(session) ?? read(path.join(session, 'state.json'));
const indexFile = source => path.join(source, '.workspaces/local/workflows/.coordinators.json');
const locatorFile = (source, id) => path.join(source, '.workspaces/local/workflows', `${id}.json`);
const sourceOf = state => {
  check(state.runtimeRevision === 3 && state.contractVersion === 'starci/v2.2', 'COORDINATION_CONTRACT', 'current workflow contract is required');
  check(path.isAbsolute(state.workflowOwner?.sourceRoot ?? ''), 'COORDINATION_OWNER', 'Source binding is required');
  return realPath(state.workflowOwner.sourceRoot);
};
export function canonicalRepository(value) {
  check(typeof value === 'string' && value.trim() === value && value, 'COORDINATION_REPOSITORY', 'a verified Git repository identity is required');
  // Local repositories are a useful supported Git transport, including distinct linked worktrees.
  if (path.isAbsolute(value) || value.startsWith('file://')) {
    const disk = value.startsWith('file://') ? fileURLToPath(value) : value;
    const common = execFileSync('git', ['-C', disk, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    return `local:${realPath(common).replaceAll('\\', '/')}`;
  }
  let url;
  const scp = /^(?:[^@/:]+@)?([^/:]+):([^/].*)$/.exec(value);
  try { url = new URL(scp && !value.includes('://') ? `ssh://${scp[1]}/${scp[2]}` : value); }
  catch { fail('COORDINATION_REPOSITORY', 'unverifiable repository transport'); }
  check(['https:', 'http:', 'ssh:', 'git:'].includes(url.protocol) && !url.search && !url.hash && !url.password,
    'COORDINATION_REPOSITORY', 'unsupported or ambiguous repository identity');
  check(!url.username || url.protocol === 'ssh:', 'COORDINATION_REPOSITORY', 'credential-bearing repository URL is not an identity');
  check(!url.port || { 'https:': '443', 'http:': '80', 'ssh:': '22', 'git:': '9418' }[url.protocol] === url.port,
    'COORDINATION_REPOSITORY', 'a non-default transport port needs an independently declared canonical identity');
  let namespace = url.pathname.replace(/^\//, '').replace(/\/$/, '').replace(/\.git$/, '');
  check(namespace && !/[\\%]/.test(namespace) && namespace.split('/').every(part => part && part !== '.' && part !== '..'),
    'COORDINATION_REPOSITORY', 'repository namespace is ambiguous');
  if (url.hostname.toLowerCase() === 'github.com') namespace = namespace.toLowerCase();
  return `${url.hostname.toLowerCase()}/${namespace}`;
}
export function repositoryPath(value) {
  check(typeof value === 'string' && value && !path.isAbsolute(value) && !value.includes('\\') && !/[\0:*?{}]/.test(value),
    'COORDINATION_ROOT', 'write roots must be literal repository-relative paths');
  check(value === '.' || value.split('/').every(part => part && part !== '.' && part !== '..'), 'COORDINATION_ROOT', 'write root is not canonical');
  return process.platform === 'win32' ? value.toLowerCase() : value;
}
const contains = (parent, child) => parent === '.' || parent === child || child.startsWith(`${parent}/`);
const overlaps = (a, b) => contains(a, b) || contains(b, a);
// Discovery describes impact at repository/role level. Only its literal paths can directly
// delimit a claim; expressions and ledger annotations neither grant roots nor poison siblings.
function literalScopeCovers(code, root) {
  try { return contains(repositoryPath(code), root); } catch { return false; }
}
// Source-write declarations use the registered checkout segment, unlike discovery prose.
// A terminal /** names its literal subtree; other expressions cannot become owner roots.
function declaredWritePath(value, { alias = false } = {}) {
  const segment = '/branch/session';
  if (alias && Object.hasOwn(read(path.join(ROOT, 'alias/alias.json')).segments, segment)) {
    const prefix = segment.slice(1);
    if (value === prefix || value.startsWith(`${prefix}/`)) value = value.slice(prefix.length).replace(/^\//, '') || '.';
  }
  return repositoryPath(value.endsWith('/**') ? value.slice(0, -3) : value);
}
function declaredWriteCovers(code, root) {
  try { return contains(declaredWritePath(code), root); } catch { return false; }
}
function sourceScopeCovers(mission, role, root) {
  return mission.discovery.impacts.some(impact => impact.role === role && !impact.producer && impact.code.some(code => literalScopeCovers(code, root)));
}
function retainedSourceScope(claim, peer, mission) {
  const authority = claim.authority;
  return ['accepted-source-file', 'admitted-source-root'].includes(authority?.kind) && authorityContains(authority, claim.root)
    && authority.origin.sessionId === peer.sessionId && addressEqual(authority.origin.mission, peer.mission)
    && mission.discovery.repositories.some(repo => repo.role === authority.role && canonicalRepository(repo.repository) === claim.repository)
    && mission.discovery.impacts.some(impact => impact.role === authority.role && !impact.producer);
}
const authorityContains = (authority, root) => authority.root === root || authority.shape === 'subtree' && contains(authority.root, root);
const claimOverlaps = (claim, root) => overlaps(claim.root, root) && !(claim.excludes ?? []).some(excluded => contains(excluded, root));
const claimsOverlap = (a, b) => a.repository === b.repository && overlaps(a.root, b.root)
  && claimOverlaps(a, contains(a.root, b.root) ? b.root : a.root) && claimOverlaps(b, contains(a.root, b.root) ? b.root : a.root);
function claimErrors(claims) {
  const errors = [];
  for (const [i, claim] of claims.entries()) {
    try { check(repositoryPath(claim.root) === claim.root, 'COORDINATION_ROOT', 'claim root is not canonical');
      const excluded = claim.excludes ?? [];
      for (const [j, root] of excluded.entries()) check(repositoryPath(root) === root && root !== claim.root && contains(claim.root, root)
        && excluded.slice(0, j).every(other => !overlaps(root, other)), 'COORDINATION_ROOT', 'exclusions must be distinct disjoint proper subtrees of their parent');
      for (const root of excluded) check(claims.some(other => other !== claim && other.ownerSessionId !== claim.ownerSessionId && other.repository === claim.repository && other.root === root), 'COORDINATION_ROOT', 'an exclusion must transfer to a distinct sole owner without an unowned hole');
      check(claims.slice(0, i).every(other => !claimsOverlap(claim, other)), 'COORDINATION_OWNED', 'effective claim sets overlap');
    } catch (error) { errors.push(error.message); }
  }
  return errors;
}
const branch = (session, cell) => path.join(session, `step-${cell.split('/')[0]}`, `parallel-${cell.split('/')[1]}`);

function locate(source, id, expected) {
  check(safeId(id), 'COORDINATION_IDENTITY', 'invalid session id');
  const file = locatorFile(source, id);
  check(existsSync(file), 'COORDINATION_LOCATOR', `durable locator ${id} is missing`);
  const bytes = readFileSync(file);
  if (expected) check(expected.locatorHash === digest(bytes), 'COORDINATION_LOCATOR', `locator ${id} changed`);
  const located = locateWorkflowSession(source, id);
  const state = sessionState(located.session);
  check(state.id === id && sameRoot(sourceOf(state), source), 'COORDINATION_IDENTITY', 'located workflow belongs to another Source');
  if (expected) check(state.hostBinding?.hostId === expected.taskId, 'COORDINATION_IDENTITY', 'native task binding changed');
  return { session: located.session, state, identity: { sessionId: id, taskId: state.hostBinding?.hostId, locatorHash: digest(bytes) } };
}
function index(source) {
  if (!existsSync(indexFile(source))) {
    // A missing discovery file is not a release operation. Existing enrolments retain its duty.
    const directory = path.dirname(indexFile(source));
    for (const name of existsSync(directory) ? readdirSync(directory).filter(name => !name.startsWith('.') && name.endsWith('.json')) : []) {
      let locator;
      try { locator = read(path.join(directory, name)); }
      catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      const stateFile = path.join(locator.ownerRoot, '.worktrees/sessions', locator.sessionId ?? name.slice(0, -5), 'state.json');
      if (existsSync(stateFile) && read(stateFile).coordination) fail('COORDINATION_LOCATOR', 'discovery index disappeared while an enrolled workflow still owns it');
    }
    return { version: 1, coordinators: [] };
  }
  const value = read(indexFile(source));
  check(value.version === 1 && Array.isArray(value.coordinators), 'COORDINATION_LOCATOR', 'coordinator discovery index is corrupt');
  check(new Set(value.coordinators.map(entry => entry.sessionId)).size === value.coordinators.length, 'COORDINATION_LOCATOR', 'duplicate coordinator locators');
  return value;
}
async function register(source, identity) {
  const value = index(source), present = value.coordinators.find(entry => entry.sessionId === identity.sessionId);
  if (present) { check(equal(present, identity), 'COORDINATION_LOCATOR', 'coordinator identity changed'); return; }
  value.coordinators.push(identity);
  await mkdir(path.dirname(indexFile(source)), { recursive: true });
  const temp = `${indexFile(source)}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`);
  await replaceFile(temp, indexFile(source));
}
function history(session, address, kind) {
  check(address && /^sha256:[0-9a-f]{64}$/.test(address.hash ?? '') && address.ref === `runtime/history/${kind}/${address.hash.slice(7)}.json`,
    'COORDINATION_SEAL', `invalid ${kind} address`);
  const file = path.resolve(session, address.ref);
  check(realPath(file).startsWith(`${realPath(session)}${path.sep}`), 'COORDINATION_SEAL', 'history escapes original session');
  const bytes = readFileSync(file);
  check(digest(bytes) === address.hash, 'COORDINATION_SEAL', `${kind} bytes differ from original seal`);
  return JSON.parse(bytes);
}
async function seal(session, kind, record) {
  const { retainContext } = await import('./mission-history.mjs');
  return retainContext(session, kind, record);
}
function currentAssignment(owner) {
  const address = owner.state.coordination?.active;
  if (!address) return null;
  check(addressEqual(owner.state.coordination?.revisions?.at(-1), address), 'COORDINATION_SEAL', 'active assignment must be the latest retained revision');
  const value = history(owner.session, address, 'assignments');
  check(value.version === 1 && Array.isArray(value.claims) && Array.isArray(value.dependencies) && value.peers && typeof value.peers === 'object', 'COORDINATION_ASSIGNMENT', 'assignment contract is incomplete');
  check(value.coordinator.sessionId === owner.state.id && value.coordinator.taskId === owner.state.hostBinding.hostId,
    'COORDINATION_IDENTITY', 'assignment names another coordinator');
  const errors = claimErrors(value.claims);
  check(!errors.length, 'COORDINATION_ASSIGNMENT', errors.join('; '));
  for (const claim of value.claims) {
    const peer = value.peers[claim.ownerSessionId];
    check(peer?.sessionId === claim.ownerSessionId, 'COORDINATION_ASSIGNMENT', 'claim owner is outside the exact enrolled peer set');
    const original = locate(sourceOf(owner.state), peer.sessionId, peer);
    check(original.state.coordination?.coordinatorSessionId === owner.state.id, 'COORDINATION_ENROLMENT', 'writer no longer has its original sole coordinator');
    const mission = history(original.session, peer.mission, 'missions');
    check(mission.sessionId === peer.sessionId && mission.mission.discovery.repositories.some(repo => canonicalRepository(repo.repository) === claim.repository
      && (sourceScopeCovers(mission.mission, repo.role, claim.root) || retainedSourceScope(claim, peer, mission.mission))),
      'COORDINATION_SCOPE', 'claim is outside its original authorized repository subset');
  }
  return { address, value };
}
function allAssignments(source) {
  const result = index(source).coordinators.map(identity => {
    const owner = locate(source, identity.sessionId, identity);
    return { owner, assignment: currentAssignment(owner) };
  });
  for (let i = 0; i < result.length; i++) for (const prior of result.slice(0, i)) {
    check(!(result[i].assignment?.value.claims ?? []).some(a => (prior.assignment?.value.claims ?? []).some(b => claimsOverlap(a, b))), 'COORDINATION_OWNED', 'cross-coordinator assignments overlap');
  }
  return result;
}
function confirmed(owner) {
  check(owner.state.lifecycle?.phase === 'active' && owner.state.mission?.confirmation?.status === 'confirmed', 'COORDINATION_SCOPE', 'an active confirmed workflow is required');
  const address = owner.state.missionSnapshots?.[owner.state.mission.version];
  const frozen = history(owner.session, address, 'missions');
  const comparable = mission => { const { scope, ...rest } = mission; return rest; };
  check(frozen.sessionId === owner.state.id && equal(comparable(frozen.mission), comparable(owner.state.mission)), 'COORDINATION_SCOPE', 'mission differs from its original accepted authority');
  return { address, mission: frozen.mission };
}
function repositoryBinding(state, role, worktree = null) {
  const declaration = state.mission.discovery?.repositories?.find(repo => repo.role === role);
  check(declaration, 'COORDINATION_REPOSITORY', `role ${role} is outside the frozen mission`);
  const repository = canonicalRepository(declaration.repository);
  const source = sourceOf(state), routeFile = path.resolve(source, declaration.routeRef);
  check(realPath(routeFile).startsWith(`${source}${path.sep}`), 'COORDINATION_REPOSITORY', 'route escapes Source');
  const route = read(routeFile);
  check(canonicalRepository(route.repository?.gitRepository) === repository && route.role === role && route.project === declaration.project,
    'COORDINATION_REPOSITORY', 'route and frozen repository identity differ');
  const selected = worktree ?? route.checkout?.diskPath ?? route.repository?.diskPath;
  check(path.isAbsolute(selected ?? ''), 'COORDINATION_REPOSITORY', 'repository checkout cannot be verified');
  const origin = execFileSync('git', ['-C', selected, 'remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  check(canonicalRepository(origin) === repository, 'COORDINATION_REPOSITORY', 'actual checkout origin differs from the frozen repository');
  return { repository, worktree: selected };
}
function repoFor(state, role, worktree = null) { return repositoryBinding(state, role, worktree).repository; }
async function sourceFileAuthority(root, peer, role, wanted, { authority = null, cache = new Map() } = {}) {
  const scope = confirmed(peer);
  check(peer.state.mission.discovery.impacts.some(impact => impact.role === role && !impact.producer), 'COORDINATION_SCOPE', 'accepted source cannot introduce another source role');
  const kindOf = { 'backend.generate': 'backend-source-application', 'interface.generate': 'source-application' };
  const selected = authority?.proof ?? authority?.request;
  const candidates = selected ? [[`${selected.step}/${selected.parallel}`, peer.state.attempts?.[`${selected.step}/${selected.parallel}`]]]
    : Object.entries(peer.state.attempts ?? {}).filter(([cell, attempt]) => cellPattern.test(cell) && kindOf[attempt.operatorId]).reverse();
  for (const [cell, attempt] of candidates) {
    if (!attempt || !kindOf[attempt.operatorId] || !['running', 'waiting', 'matched', 'mismatched', 'inconclusive', 'blocked'].includes(attempt.status) || attempt.expected?.goalVersion !== peer.state.mission.version) continue;
    const directory = branch(peer.session, cell), request = read(path.join(directory, 'request/request.json'));
    if (request.environment?.workspace?.alias !== `@workspaces/${role}`) continue;
    const { invocationState, readContext } = await import('./mission-history.mjs');
    invocationState(peer.session, peer.state, request);
    check(addressEqual(readContext(peer.session, attempt.context, 'invocations').mission, scope.address), 'COORDINATION_SCOPE', 'source boundary belongs to a stale mission');
    if (authority?.kind === 'admitted-source-root' || attempt.status !== 'matched') {
      const admitted = await admittedSourceAuthority(root, peer, role, wanted, attempt, request, scope, cache);
      if (!admitted) continue;
      check(!authority || equal(authority, admitted), 'COORDINATION_SCOPE', 'admitted boundary differs from its retained original request and binding');
      return admitted;
    }
    const cacheKey = `${peer.state.id}:${cell}`, kind = kindOf[attempt.operatorId];
    if (!cache.has(cacheKey)) {
      const { acceptedProducerProof } = await import('./producer-import.mjs');
      cache.set(cacheKey, await acceptedProducerProof(root, peer.state.id, request.step, request.parallel, kind, { hostRoot: sourceOf(peer.state) }));
    }
    const response = read(path.join(directory, 'response/response.json'));
    const modelRef = response.fields?.[attempt.operatorId === 'backend.generate' ? 'mutations' : 'writes'];
    if (typeof modelRef !== 'string') continue;
    const model = read(path.join(directory, modelRef));
    const files = attempt.operatorId === 'backend.generate' ? model.changes : model.files?.filter(file => file.change !== 'unchanged');
    if (model.mode !== 'apply' || !Array.isArray(files) || !files.some(file => repositoryPath(file.path) === wanted)) {
      const admitted = await admittedSourceAuthority(root, peer, role, wanted, attempt, request, scope, cache);
      if (admitted && !authority) return admitted;
      continue;
    }
    const proof = cache.get(cacheKey), workspace = request.environment.workspace;
    check(proof.bindings.some(binding => binding.alias === workspace.alias && sameRoot(binding.worktree ?? '.', workspace.worktree)
      && binding.repositoryHash && binding.revision === proof.heads.at(-1)), 'COORDINATION_SCOPE', 'source boundary has no verified committed checkout');
    check(repoFor(peer.state, role, workspace.worktree) === repoFor(peer.state, role), 'COORDINATION_SCOPE', 'source boundary belongs to another repository');
    const result = { kind: 'accepted-source-file', root: wanted, role, origin: { ...peer.identity, mission: scope.address }, proof };
    check(!authority || equal(authority, result), 'COORDINATION_SCOPE', 'accepted source boundary differs from its retained original proof');
    return result;
  }
  fail('COORDINATION_SCOPE', 'claim has no literal confirmed root or intact same-mission accepted source file');
}
// This is opening authority, never delivery proof: an immutable admitted source request is joined
// to its accepted workspace binding. The original source matcher keeps mutable/protected meaning.
async function admittedSourceAuthority(root, peer, role, wanted, attempt, request, scope, cache) {
  if (request.contractVersion !== 'starci/v2.2' || !['backend.generate', 'interface.generate'].includes(request.operatorId) || request.requirements?.mode === 'dry') return null;
  const key = `${request.step}/${request.parallel}`, workspace = request.environment?.workspace;
  check(attempt.context && attempt.id === request.attempt?.id && attempt.operatorId === request.operatorId
    && attempt.number === request.attempt.number && attempt.kind === request.attempt.kind && attempt.previous === request.attempt.previous
    && equal(attempt.expected, request.expected) && attempt.expectedHash === digest(Buffer.from(JSON.stringify(request.expected)))
    && equal(attempt.frozenInputs, request.frozenInputs) && attempt.requestRef === `step-${request.step}/parallel-${request.parallel}/request/request.json`
    && peer.state.requestHashes?.[key] === digest(readFileSync(path.join(peer.session, attempt.requestRef))), 'COORDINATION_SCOPE', 'source admission differs from its immutable request');
  const { refToRegExp } = await import('../operators/backend-generate/validate.mjs');
  const normalized = value => process.platform === 'win32' ? value.toLowerCase() : value;
  const backend = request.operatorId === 'backend.generate';
  const refs = (request.requirements.mutableFileRefs ?? []).map(normalized), protectedRefs = (request.requirements.protectedRefs ?? []).map(normalized);
  const ancestors = wanted.split('/').map((_, index, parts) => parts.slice(0, index + 1).join('/'));
  let subtree = backend && refs.some(ref => ref === '**' || ref.endsWith('/**') && ancestors.some(parent => refToRegExp(ref.slice(0, -3)).test(parent)));
  if (backend && !subtree && !refs.some(ref => refToRegExp(ref).test(wanted))) return null;
  if (!backend) {
    const declared = (request.environment.writes ?? []).flatMap(write => {
      const prefix = `@workspaces/${role}/`;
      if (write.startsWith(prefix)) return [{ root: declaredWritePath(write.slice(prefix.length), { alias: true }), recursive: write.endsWith('/**') }];
      if (path.isAbsolute(write) && (sameRoot(write, workspace.worktree) || realPath(write).startsWith(`${realPath(workspace.worktree)}${path.sep}`)))
        return [{ root: repositoryPath(path.relative(realPath(workspace.worktree), realPath(write)).replaceAll('\\', '/') || '.'), recursive: false }];
      return [];
    });
    const grant = declared.find(write => write.root === wanted || write.recursive && contains(write.root, wanted));
    if (!grant) return null;
    subtree = grant.recursive;
  }
  const intersects = ref => {
    if (!subtree) return refToRegExp(ref).test(wanted);
    const pattern = ref.split('/'), target = wanted.split('/'), seen = new Set();
    const walk = (i, j) => {
      if (j === target.length) return true;
      if (i === pattern.length || seen.has(`${i}/${j}`)) return false;
      seen.add(`${i}/${j}`);
      return pattern[i] === '**' ? walk(i + 1, j) || walk(i, j + 1) : refToRegExp(pattern[i]).test(target[j]) && walk(i + 1, j + 1);
    };
    return walk(0, 0);
  };
  if (protectedRefs.some(intersects)) return null;
  const repository = repoFor(peer.state, role, workspace.worktree), target = realPath(path.resolve(workspace.worktree, wanted));
  if (!(request.environment.exclusive ?? []).some(held => path.isAbsolute(held) && (sameRoot(held, target) || target.startsWith(`${realPath(held)}${path.sep}`)))) return null;
  if (!requestRoots(peer.state, request).some(write => write.repository === repository && contains(write.root, wanted))) return null;
  const { acceptedProducerProof } = await import('./producer-import.mjs');
  for (const [cell, binding] of Object.entries(peer.state.attempts ?? {}).reverse()) {
    if (!cellPattern.test(cell) || binding.operatorId !== 'workspace.bind' || binding.status !== 'matched' || binding.expected?.goalVersion !== peer.state.mission.version || Number(cell.split('/')[0]) >= request.step) continue;
    const bindingRequest = read(path.join(peer.session, binding.requestRef));
    if (bindingRequest.requirements?.role !== role || bindingRequest.requirements?.project !== peer.state.project) continue;
    const cacheKey = `${peer.state.id}:${cell}:route`;
    if (!cache.has(cacheKey)) cache.set(cacheKey, await acceptedProducerProof(root, peer.state.id, bindingRequest.step, bindingRequest.parallel, 'route', { hostRoot: sourceOf(peer.state) }));
    const proof = cache.get(cacheKey), route = read(path.join(peer.session, proof.artifacts[0].ref));
    if (!sameRoot(route.checkout?.diskPath ?? '.', workspace.worktree) || route.role !== role || !route.writeRoots?.some(code => declaredWriteCovers(code, wanted))) continue;
    check(canonicalRepository(route.checkout.gitRepository) === repository && repository === repoFor(peer.state, role), 'COORDINATION_SCOPE', 'admitted source binding belongs to another repository');
    execFileSync('git', ['-C', workspace.worktree, 'merge-base', '--is-ancestor', route.sourceHead, workspace.revision], { stdio: 'pipe' });
    return { kind: 'admitted-source-root', root: wanted, shape: subtree ? 'subtree' : 'file', role, origin: { ...peer.identity, mission: scope.address },
      request: { step: request.step, parallel: request.parallel, ref: attempt.requestRef, hash: peer.state.requestHashes[key], context: attempt.context, attemptId: attempt.id }, binding: proof };
  }
  return null;
}
export function requestRoots(state, request) {
  const writes = request.environment?.writes ?? [];
  const workspace = request.environment?.workspace;
  const roots = [];
  for (const write of writes) {
    if (typeof write !== 'string') fail('COORDINATION_ROOT', 'a product write must use its declared alias or path');
    const match = /^@workspaces\/([^/]+)(?:\/(.*))?$/.exec(write);
    if (match) {
      const role = match[1];
      const selected = workspace?.alias === `@workspaces/${role}` ? workspace.worktree : null;
      let root = declaredWritePath(match[2] || '.', { alias: true });
      const { repository, worktree } = repositoryBinding(state, role, selected);
      const resolved = realPath(path.resolve(worktree, root));
      check(sameRoot(resolved, worktree) || resolved.startsWith(`${realPath(worktree)}${path.sep}`), 'COORDINATION_ROOT', 'aliased write escapes its bound worktree through a filesystem alias');
      root = repositoryPath(path.relative(realPath(worktree), resolved).replaceAll('\\', '/') || '.');
      roots.push({ repository, root });
    } else if (path.isAbsolute(write) && workspace?.worktree && (sameRoot(write, workspace.worktree) || realPath(write).startsWith(`${realPath(workspace.worktree)}${path.sep}`))) {
      const role = /^@workspaces\/([^/]+)$/.exec(workspace.alias ?? '')?.[1];
      check(role, 'COORDINATION_ROOT', 'absolute product write has no routed workspace');
      roots.push({ repository: repoFor(state, role, workspace.worktree), root: repositoryPath(path.relative(realPath(workspace.worktree), realPath(write)).replaceAll('\\', '/') || '.') });
    } else if (path.isAbsolute(write)) {
      const resolved = realPath(write), session = locateWorkflowSession(sourceOf(state), state.id).session;
      if (sameRoot(resolved, session) || resolved.startsWith(`${realPath(session)}${path.sep}`)) continue;
      let directory = path.dirname(resolved);
      while (!existsSync(directory) && path.dirname(directory) !== directory) directory = path.dirname(directory);
      let gitRoot, origin;
      try {
        gitRoot = execFileSync('git', ['-C', directory, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
        origin = execFileSync('git', ['-C', gitRoot, 'remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
      } catch { fail('COORDINATION_ROOT', 'absolute write outside the session must identify its actual repository'); }
      const repository = canonicalRepository(origin);
      check(state.mission.discovery.repositories.some(repo => canonicalRepository(repo.repository) === repository), 'COORDINATION_ROOT', 'absolute write is outside the frozen repository authority');
      roots.push({ repository, root: repositoryPath(path.relative(realPath(gitRoot), resolved).replaceAll('\\', '/') || '.') });
    } else if (write.startsWith('@workspaces')) fail('COORDINATION_ROOT', 'unverifiable workspace write alias');
  }
  return roots;
}
function ownershipErrors(roots, sessionId, assignments) {
  const errors = [];
  for (const { assignment } of assignments) for (const claim of assignment?.value.claims ?? []) for (const wanted of roots) {
    if (claim.repository === wanted.repository && claimOverlaps(claim, wanted.root) && claim.ownerSessionId !== sessionId)
      errors.push(`COORDINATION_OWNED: ${wanted.repository}/${wanted.root} belongs to ${claim.ownerSessionId}, not ${sessionId}`);
  }
  return errors;
}
function activeRequests(owner) {
  return Object.entries(owner.state.attempts ?? {}).filter(([, attempt]) => ['running', 'waiting'].includes(attempt.status))
    .map(([cell, attempt]) => ({ cell, attempt, request: read(path.join(owner.session, attempt.requestRef)) }));
}
function ensureNoRunningOwnerChange(source, before, after) {
  const affected = before.filter(old => !after.some(next => equal(next, old)));
  for (const claim of affected) {
    const owner = locate(source, claim.ownerSessionId);
    for (const active of activeRequests(owner)) {
      if (requestRoots(owner.state, active.request).some(root => root.repository === claim.repository && overlaps(root.root, claim.root)))
        fail('COORDINATION_BUSY', `${owner.state.id}/${active.cell} still reserves transferred write roots; seal or release it first`);
    }
    for (const lease of owner.state.workerSlots ?? []) {
      const request = lease.branch && owner.state.attempts?.[lease.branch]?.requestRef;
      if (!request || requestRoots(owner.state, read(path.join(owner.session, request))).some(root => root.repository === claim.repository && overlaps(root.root, claim.root)))
        fail('COORDINATION_BUSY', 'a live resource lease overlaps the transfer');
    }
  }
}
function ensureNoForeignReservation(source, claims) {
  const directory = path.dirname(indexFile(source));
  for (const name of readdirSync(directory).filter(name => !name.startsWith('.') && name.endsWith('.json'))) {
    const owner = locate(source, name.slice(0, -5));
    if (!Object.values(owner.state.attempts ?? {}).some(attempt => ['running', 'waiting'].includes(attempt.status))) continue;
    for (const active of activeRequests(owner)) for (const wanted of requestRoots(owner.state, active.request)) {
      check(!claims.some(claim => claim.ownerSessionId !== owner.state.id && claim.repository === wanted.repository && overlaps(claim.root, wanted.root)),
        'COORDINATION_BUSY', 'an already-admitted foreign workflow still reserves a new assignment root');
    }
  }
}
function enrolled(source, coordinator, id) {
  const peer = locate(source, id);
  check(peer.state.coordination?.coordinatorSessionId === coordinator.state.id, 'COORDINATION_ENROLMENT', `${id} has not enrolled itself with this coordinator`);
  check(equal(peer.state.coordination.coordinator, coordinator.identity), 'COORDINATION_ENROLMENT', 'coordinator identity changed');
  return peer;
}
async function assertCurrentAuthority(root, owner, active) {
  if (!active) return;
  const { scopeHash, frozenScopeErrors } = await import('./mission-scope.mjs');
  const identities = [{ ...owner.identity, mission: active.value.coordinatorMission }, ...Object.values(active.value.peers)];
  for (const identity of identities) {
    const original = locate(sourceOf(owner.state), identity.sessionId, identity);
    const retained = history(original.session, identity.mission, 'missions');
    check(original.state.mission.confirmation?.status === 'confirmed' && original.state.lifecycle?.phase !== 'draft'
      && scopeHash(retained.mission) === scopeHash(original.state.mission), 'COORDINATION_SCOPE', 'an assigned workflow changed or revoked its current scope; old authority cannot grant new work');
    const errors = frozenScopeErrors(original.state, { root });
    check(!errors.length, 'COORDINATION_SCOPE', errors.join('; '));
  }
  const cache = new Map();
  for (const claim of active.value.claims) if (claim.authority) {
    const original = locate(sourceOf(owner.state), claim.authority.origin.sessionId, claim.authority.origin);
    await sourceFileAuthority(root, original, claim.authority.role, claim.authority.root, { authority: claim.authority, cache });
  }
}
async function assertPreparationAuthority(root, coordinator, value) {
  await assertCurrentAuthority(root, coordinator, currentAssignment(coordinator));
  const { scopeHash } = await import('./mission-scope.mjs');
  for (const identity of [value.donor, ...(value.dependencies ?? []).map(item => item.consumer)]) {
    const original = locate(sourceOf(coordinator.state), identity.sessionId, identity), current = confirmed(original);
    const retained = history(original.session, identity.mission, 'missions');
    check(scopeHash(current.mission) === scopeHash(retained.mission), 'COORDINATION_SCOPE', 'prepared extraction authority was changed or revoked');
  }
}

export async function enrolWorkflow(root, session, coordinatorSessionId, { preparation = null } = {}) {
  return mutateSession(session, async state => {
    const source = sourceOf(state), coordinator = locate(source, coordinatorSessionId);
    check(coordinator.state.topology?.mode === 'coordinated' && coordinator.state.id !== state.id, 'COORDINATION_ENROLMENT', 'a distinct coordinated owner is required');
    confirmed(coordinator);
    await assertCurrentAuthority(root, coordinator, currentAssignment(coordinator));
    check(!state.coordination?.coordinatorSessionId || state.coordination.coordinatorSessionId === coordinatorSessionId, 'COORDINATION_ENROLMENT', 'one workflow cannot enrol in two coordinators');
    if (preparation) await confirmDerived(root, session, state, coordinator, preparation);
    else confirmed({ session, state });
    state.coordination = { ...state.coordination, version: 1, coordinatorSessionId, coordinator: coordinator.identity };
    await register(source, coordinator.identity);
    return { status: 'enrolled', sessionId: state.id, coordinatorSessionId, mission: state.missionSnapshots[state.mission.version] };
  });
}

export async function assignWorkflows(root, session, { id, claims }) {
  return mutateSession(session, async state => {
    const source = sourceOf(state), coordinator = locate(source, state.id);
    check(state.topology?.mode === 'coordinated' && safeId(id), 'COORDINATION_ASSIGNMENT', 'coordinated owner and idempotency id are required');
    const scope = confirmed({ session, state });
    const existing = (state.coordination?.revisions ?? []).map(address => ({ address, value: history(session, address, 'assignments') })).find(item => item.value.id === id);
    if (existing) { check(equal(existing.value.request, claims), 'COORDINATION_REPLAY', 'assignment id was already used for another request'); return existing.address; }
    check(!state.coordination?.active, 'COORDINATION_ASSIGNMENT', 'later writer transfers require a sealed extraction preparation');
    const peers = {}, normalized = [], cache = new Map();
    for (const claim of claims) {
      const peer = enrolled(source, coordinator, claim.sessionId), scope = confirmed(peer);
      const rootPath = repositoryPath(claim.root), repository = repoFor(peer.state, claim.role);
      const authority = sourceScopeCovers(peer.state.mission, claim.role, rootPath) ? null : await sourceFileAuthority(root, peer, claim.role, rootPath, { cache });
      peers[peer.state.id] = { ...peer.identity, mission: scope.address };
      normalized.push({ repository, root: rootPath, ownerSessionId: peer.state.id, ...(authority ? { authority } : {}) });
    }
    check(normalized.length && normalized.every((claim, i) => normalized.slice(0, i).every(other => claim.repository !== other.repository || !overlaps(claim.root, other.root))), 'COORDINATION_OWNED', 'assignment roots must be disjoint, including aliases');
    const competing = allAssignments(source).filter(item => item.owner.state.id !== state.id);
    check(!ownershipErrors(normalized, state.id, competing).length, 'COORDINATION_OWNED', 'another coordinator already owns a repository-relative root');
    ensureNoForeignReservation(source, normalized);
    const inFlight = [];
    for (const peer of Object.values(peers)) {
      const original = locate(source, peer.sessionId, peer);
      for (const { request } of activeRequests(original)) if (!request.coordination && requestRoots(original.state, request).length)
        inFlight.push(await admittedBeforeAssignment(original.session, original.state, request));
    }
    const value = { version: 1, id, request: claims, coordinator: coordinator.identity, coordinatorMission: scope.address, previous: null, peers, claims: normalized, dependencies: [], inFlight };
    const address = await seal(session, 'assignments', value);
    await register(source, coordinator.identity); // Discovery precedes activation; a crash never creates an invisible owner.
    state.coordination = { ...state.coordination, version: 1, active: address, revisions: [address], preparations: [] };
    state.brief.peers ??= {};
    for (const peer of Object.values(peers)) state.brief.peers[peer.taskId] ??= { owns: normalized.filter(claim => claim.ownerSessionId === peer.sessionId).map(claim => `${claim.repository}/${claim.root}`).join(', '), head: null };
    return address;
  });
}

function extractionMission(donorMission, specification, producerState, claims = []) {
  const mission = structuredClone(donorMission);
  delete mission.confirmation; delete mission.scope; delete mission.bankRef;
  mission.version = 1;
  mission.goal = `Shared implementation for: ${donorMission.goal}`;
  mission.discovery.impacts = specification.selections.map(selection => {
    const original = donorMission.discovery.impacts.find(impact => impact.id === selection.impactId);
    check(original, 'COORDINATION_SCOPE', 'selected impact is outside donor authority');
    const roots = selection.roots.map(repositoryPath);
    check(roots.length && roots.every(root => original.code.some(code => literalScopeCovers(code, root))
      || claims.some(claim => claim.ownerSessionId === specification.donorSessionId && contains(claim.root, root)
        && !(claim.excludes ?? []).some(excluded => overlaps(excluded, root))
        && claim.authority?.role === original.role && authorityContains(claim.authority, root))), 'COORDINATION_SCOPE', 'extraction widens donor code authority');
    return { ...original, code: roots };
  });
  const roles = new Set(mission.discovery.impacts.map(impact => impact.role));
  mission.discovery.repositories = donorMission.discovery.repositories.filter(repo => roles.has(repo.role)).map(repo => ({ ...repo,
    project: producerState.project, routeRef: `.workspaces/local/routes/${producerState.project}/${repo.role}/config.json` }));
  for (const repo of mission.discovery.repositories) repoFor({ ...producerState, mission }, repo.role);
  mission.discovery.destinations = donorMission.discovery.destinations.filter(destination => roles.has(destination.role));
  mission.discovery.stage = 'implement';
  for (const [id, lane] of Object.entries(mission.discovery.lanes)) if (lane.status === 'planned' && !roles.has(lane.owner))
    mission.discovery.lanes[id] = { status: 'not-applicable', reason: 'The extracted code subset does not include this repository role.' };
  for (const lane of Object.values(mission.discovery.lanes)) if (lane.dependsOn) lane.dependsOn = lane.dependsOn.filter(id => mission.discovery.lanes[id].status === 'planned');
  mission.includes = mission.discovery.impacts.map(impact => impact.behavior);
  mission.doneWhen = [{ evidence: `The extracted code subset has an accepted ${specification.operatorId} outcome.`, producedBy: specification.operatorId }];
  return mission;
}
export async function prepareExtraction(root, session, specification) {
  return mutateSession(session, async state => {
    const source = sourceOf(state), coordinator = locate(source, state.id), active = currentAssignment(coordinator);
    check(active && safeId(specification.id), 'COORDINATION_EXTRACTION', 'active assignments and a stable id are required');
    await assertCurrentAuthority(root, coordinator, active);
    const prior = (state.coordination.preparations ?? []).find(address => history(session, address, 'extractions').specification.id === specification.id);
    if (prior) { check(equal(history(session, prior, 'extractions').specification, specification), 'COORDINATION_REPLAY', 'extraction id is bound to different inputs'); return prior; }
    const donor = enrolled(source, coordinator, specification.donorSessionId), donorScope = confirmed(donor);
    check(donorScope.mission.discovery.stage !== 'handoff', 'COORDINATION_SCOPE', 'planning authority cannot be promoted into shared implementation');
    const producer = locate(source, specification.producerSessionId);
    check(producer.state.lifecycle?.phase === 'draft' && !Object.keys(producer.state.attempts ?? {}).length && producer.state.topology?.mode === 'solo', 'COORDINATION_EXTRACTION', 'new producer must be an untouched solo draft');
    check(producer.state.id !== donor.state.id && !active.value.peers[producer.state.id], 'COORDINATION_EXTRACTION', 'producer must be a new distinct workflow');
    const { deliveryTargets, completeDeliveryMission, scopeErrors } = await import('./mission-scope.mjs');
    check(deliveryTargets(donor.state.mission, root).includes(specification.operatorId) || donor.state.mission.doneWhen.some(line => line.producedBy === specification.operatorId), 'COORDINATION_SCOPE', 'producer operation is outside donor authorized delivery');
    const mission = completeDeliveryMission(extractionMission(donorScope.mission, specification, producer.state, active.value.claims), root);
    const errors = scopeErrors(mission, { root, complete: true });
    check(!errors.length, 'COORDINATION_SCOPE', errors.join('; '));
    const transfers = mission.discovery.impacts.flatMap(impact => impact.code.map(code => {
      const repository = repoFor(donor.state, impact.role), root = repositoryPath(code);
      const authority = active.value.claims.find(claim => claim.repository === repository && contains(claim.root, root) && claim.ownerSessionId === donor.state.id
        && !(claim.excludes ?? []).some(excluded => overlaps(excluded, root)))?.authority;
      return { repository, root, ownerSessionId: donor.state.id, ...(authority ? { authority } : {}) };
    }));
    check(transfers.every(claim => active.value.claims.filter(old => old.repository === claim.repository && old.ownerSessionId === claim.ownerSessionId && contains(old.root, claim.root)
      && !(old.excludes ?? []).some(excluded => overlaps(excluded, claim.root))).length === 1), 'COORDINATION_EXTRACTION', 'each transferred subtree must have exactly one uninterrupted donor owner');
    check(transfers.every((claim, i) => transfers.slice(0, i).every(prior => !claimsOverlap(claim, prior))), 'COORDINATION_EXTRACTION', 'transferred subtrees cannot overlap or repeat');
    const dependencies = specification.dependencies ?? [];
    check(dependencies.length && dependencies.every(dependency => dependency.kind && dependency.cells?.length), 'COORDINATION_DEPENDENCY', 'affected consumer nodes and typed output are required');
    check(new Set(dependencies.map(dependency => JSON.stringify([dependency.consumerSessionId, dependency.kind]))).size === dependencies.length,
      'COORDINATION_DEPENDENCY', 'duplicate consumer/output-kind dependency; combine its cells in one row');
    for (const dependency of dependencies) {
      const consumer = enrolled(source, coordinator, dependency.consumerSessionId);
      for (const cell of dependency.cells) check(cellPattern.test(cell) && consumer.state.steps?.[cell] && !consumer.state.attempts?.[cell], 'COORDINATION_DEPENDENCY', 'only unopened consumer coordinates can be parked');
    }
    const { activePlanView } = await import('./plan-history.mjs');
    const logicalDependencies = dependencies.map(dependency => {
      const consumer = enrolled(source, coordinator, dependency.consumerSessionId);
      const forecast = activePlanView(consumer.session, consumer.state).forecast;
      return { ...dependency, consumer: { ...consumer.identity, mission: confirmed(consumer).address }, nodes: dependency.cells.map(cell => forecast?.nodes?.[cell]).filter(Boolean) };
    });
    const value = { version: 1, coordinator: coordinator.identity, assignment: active.address, donor: { ...donor.identity, mission: donorScope.address }, producer: producer.identity, producerDraftHash: contentHash(producer.state.mission), specification, dependencies: logicalDependencies, mission, transfers };
    const address = await seal(session, 'extractions', value);
    state.coordination.preparations ??= []; state.coordination.preparations.push(address);
    return address;
  });
}
async function confirmDerived(root, session, state, coordinator, preparation) {
  check(coordinator.state.coordination?.preparations?.some(address => addressEqual(address, preparation)), 'COORDINATION_SCOPE', 'extraction is not retained by its coordinator');
  const value = history(coordinator.session, preparation, 'extractions');
  await assertPreparationAuthority(root, coordinator, value);
  check(value.producer.sessionId === state.id && value.producer.taskId === state.hostBinding.hostId, 'COORDINATION_SCOPE', 'extraction names a different producer');
  if (state.mission.confirmation?.authority?.kind === 'coordination-extraction') {
    check(addressEqual(state.mission.confirmation.authority.derivation.preparation, preparation), 'COORDINATION_SCOPE', 'producer was derived from another extraction'); return;
  }
  check(state.lifecycle?.phase === 'draft' && !Object.keys(state.attempts ?? {}).length && !state.missionSnapshots?.[1], 'COORDINATION_SCOPE', 'only an untouched producer draft may derive authority');
  check(contentHash(state.mission) === value.producerDraftHash, 'COORDINATION_SCOPE', 'producer draft changed after preparation');
  const donor = locate(sourceOf(state), value.donor.sessionId, value.donor);
  const original = history(donor.session, value.donor.mission, 'missions');
  const { completeDeliveryMission, scopeHash } = await import('./mission-scope.mjs');
  const expected = completeDeliveryMission(extractionMission(original.mission, value.specification, state, history(coordinator.session, value.assignment, 'assignments').claims), root);
  check(equal(value.mission, expected), 'COORDINATION_SCOPE', 'prepared producer mission is not the exact authorized subset');
  state.mission = structuredClone(expected);
  const decisionId = `goal:${state.id}:v1`, sourceRef = original.mission.confirmation.sourceRef;
  const authority = { kind: 'coordination-extraction', sourceRef, statement: original.mission.confirmation.authority.statement,
    coverage: original.mission.confirmation.authority.coverage, scopeHash: scopeHash(state.mission),
    derivation: { coordinator: coordinator.identity, preparation } };
  state.mission.confirmation = { status: 'confirmed', decisionId, sourceRef, confirmedAt: new Date().toISOString(), scopeHash: authority.scopeHash, authority };
  state.choices[decisionId] = { selected: 'as-stated', selectedBy: 'coordinator', sourceRef };
  const { retainMission } = await import('./mission-history.mjs');
  await retainMission(session, state, { root });
  state.lifecycle.phase = 'active';
}
export async function activateExtraction(root, session, preparation) {
  return mutateSession(session, async state => {
    const source = sourceOf(state), coordinator = locate(source, state.id);
    check(state.coordination?.preparations?.some(address => addressEqual(address, preparation)), 'COORDINATION_EXTRACTION', 'preparation is not retained');
    const value = history(session, preparation, 'extractions'), active = currentAssignment(coordinator);
    const done = (state.coordination.revisions ?? []).find(address => addressEqual(history(session, address, 'assignments').extraction, preparation));
    if (done) return done;
    await assertPreparationAuthority(root, coordinator, value);
    check(addressEqual(active.address, value.assignment), 'COORDINATION_STALE', 'prepare against the current assignment; do not overwrite another transfer');
    const producer = enrolled(source, coordinator, value.producer.sessionId), producerScope = confirmed(producer);
    check(addressEqual(producer.state.mission.confirmation.authority?.derivation?.preparation, preparation), 'COORDINATION_SCOPE', 'producer has no exact derived scope');
    const claims = active.value.claims.flatMap(claim => {
      const transfers = value.transfers.filter(item => item.repository === claim.repository && item.ownerSessionId === claim.ownerSessionId && contains(claim.root, item.root));
      if (!transfers.length) return [claim];
      if (transfers.some(item => item.root === claim.root)) return [{ ...claim, ownerSessionId: producer.state.id }];
      return [{ ...claim, excludes: [...(claim.excludes ?? []), ...transfers.map(item => item.root)].sort() }, ...transfers.map(item => ({ ...item, ownerSessionId: producer.state.id }))];
    });
    check(!claimErrors(claims).length, 'COORDINATION_ASSIGNMENT', claimErrors(claims).join('; '));
    ensureNoRunningOwnerChange(source, value.transfers, claims);
    for (const dependency of value.specification.dependencies) {
      const consumer = enrolled(source, coordinator, dependency.consumerSessionId);
      for (const cell of dependency.cells) check(!consumer.state.attempts?.[cell], 'COORDINATION_BUSY', 'dependent work opened after preparation');
    }
    const dependencies = [...active.value.dependencies, ...value.dependencies.map(dependency => ({ ...dependency, id: dependencyIdentity(value.specification.id, dependency.consumerSessionId, dependency.kind), producerSessionId: producer.state.id, operatorId: value.specification.operatorId, proof: null }))];
    check(new Set(dependencies.map(dependency => dependency.id)).size === dependencies.length, 'COORDINATION_DEPENDENCY', 'dependency identities must remain distinct');
    const next = { ...active.value, id: value.specification.id, previous: active.address, extraction: preparation, claims,
      peers: { ...active.value.peers, ...Object.fromEntries(value.dependencies.map(item => [item.consumer.sessionId, item.consumer])), [producer.state.id]: { ...producer.identity, mission: producerScope.address } }, dependencies };
    const address = await seal(session, 'assignments', next);
    state.coordination.revisions.push(address); state.coordination.active = address;
    state.brief.peers ??= {};
    state.brief.peers[producer.identity.taskId] ??= { owns: value.transfers.map(claim => `${claim.repository}/${claim.root}`).join(', '), head: null };
    return address;
  });
}

export async function coordinationStateErrors(root, session, state, { historical = false } = {}) {
  const errors = [];
  if (state.runtimeRevision !== 3) return errors;
  try {
    const authority = state.mission?.confirmation?.authority;
    if (authority?.kind === 'coordination-extraction') {
      const coordinator = locate(sourceOf(state), authority.derivation.coordinator.sessionId, authority.derivation.coordinator);
      const preparation = authority.derivation.preparation;
      check(coordinator.state.coordination?.preparations?.some(address => addressEqual(address, preparation)), 'COORDINATION_SCOPE', 'derived scope is not retained by coordinator');
      const value = history(coordinator.session, preparation, 'extractions');
      check(value.producer.sessionId === state.id && value.producer.taskId === state.hostBinding.hostId, 'COORDINATION_SCOPE', 'derived scope belongs to another producer');
      const donor = locate(sourceOf(state), value.donor.sessionId, value.donor), original = history(donor.session, value.donor.mission, 'missions');
      const { completeDeliveryMission, scopeHash } = await import('./mission-scope.mjs');
      const expected = completeDeliveryMission(extractionMission(original.mission, value.specification, state, history(coordinator.session, value.assignment, 'assignments').claims), root);
      check(equal(expected, value.mission) && scopeHash(expected) === scopeHash(state.mission), 'COORDINATION_SCOPE', 'derived scope widened or changed after preparation');
      check(authority.sourceRef === original.mission.confirmation.sourceRef && authority.statement === original.mission.confirmation.authority.statement,
        'COORDINATION_SCOPE', 'derived authority does not preserve original user provenance');
    }
    if (state.coordination) {
      const source = sourceOf(state), entries = allAssignments(source);
      const expectedId = state.coordination.coordinatorSessionId ?? state.id;
      const entry = entries.find(entry => entry.owner.state.id === expectedId);
      check(entry, 'COORDINATION_LOCATOR', 'active coordination discovery anchor is absent');
      if (entry.assignment) {
        const value = entry.assignment.value;
        const { scopeHash } = await import('./mission-scope.mjs');
        const address = state.id === expectedId ? value.coordinatorMission : value.peers[state.id]?.mission;
        if (address && !historical) {
          const original = history(session, address, 'missions');
          check(original.sessionId === state.id && scopeHash(original.mission) === scopeHash(state.mission), 'COORDINATION_SCOPE', 'active assignment no longer matches its original authorized mission');
        }
        if (!historical) await assertCurrentAuthority(root, entry.owner, entry.assignment);
        const revisions = entry.owner.state.coordination.revisions;
        for (const [i, retained] of revisions.entries()) {
          const record = history(entry.owner.session, retained, 'assignments');
          check(record.coordinator.sessionId === expectedId && (i === 0 ? record.previous === null : addressEqual(record.previous, revisions[i - 1])), 'COORDINATION_SEAL', 'assignment history is not a contiguous original lineage');
        }
      }
    }
  } catch (error) { errors.push(error.message); }
  return errors;
}

// Initial assignment retains already-running work under the same admission lock. This selector
// proves when the exact invocation joined coordination; it grants no new or transferred writes.
async function admittedBeforeAssignment(session, state, request) {
  const { invocationKey, invocationState } = await import('./mission-history.mjs');
  const key = invocationKey(request), attempt = state.attempts?.[key];
  const base = `step-${request.step}/parallel-${request.parallel}${request.exchange ? `/${request.exchange}` : ''}`;
  check(request.contractVersion === 'starci/v2.2' && request.sessionId === state.id && !request.coordination
    && attempt?.context && ['running', 'waiting'].includes(attempt.status)
    && attempt.id === request.attempt?.id && attempt.operatorId === request.operatorId
    && state.steps?.[`${request.step}/${request.parallel}`] === request.operatorId
    && attempt.requestRef === `${base}/request/request.json`
    && attempt.number === request.attempt.number && attempt.kind === request.attempt.kind && attempt.previous === request.attempt.previous
    && request.expected?.goalVersion === state.mission.version && attempt.expectedVersion === request.expected.version
    && equal(attempt.expected, request.expected) && attempt.expectedHash === digest(Buffer.from(JSON.stringify(request.expected)))
    && equal(attempt.frozenInputs, request.frozenInputs), 'COORDINATION_IN_FLIGHT', 'continuation requires its exact original admitted invocation');
  invocationState(session, state, request);
  check(equal(read(path.join(session, attempt.requestRef)), request), 'COORDINATION_IN_FLIGHT', 'continuation request differs from its immutable original bytes');
  return { sessionId: state.id, key, attemptId: attempt.id, requestHash: state.requestHashes[key], context: attempt.context };
}

export async function coordinationAdmissionErrors(root, session, state, request, { historical = false } = {}) {
  if (state.runtimeRevision !== 3) return [];
  const errors = await coordinationStateErrors(root, session, state, { historical });
  try {
    const source = sourceOf(state), assignments = allAssignments(source);
    if (!assignments.length && !state.coordination && !request.coordination) return errors;
    if (historical) {
      // History consumes the exact prior acceptance. The caller's phase flag cannot authorize a
      // new writer, and a later assignment cannot add requirements to an earlier sealed request.
      const { invocationKey, invocationState } = await import('./mission-history.mjs');
      const { evidenceManifestErrors } = await import('./evidence-manifest.mjs');
      const key = invocationKey(request), attempt = state.attempts?.[key];
      const base = `step-${request.step}/parallel-${request.parallel}${request.exchange ? `/${request.exchange}` : ''}`;
      const statuses = { matched: 'done', mismatched: 'mismatch', inconclusive: 'mismatch', blocked: 'blocked', waiting: 'waiting' };
      check(attempt?.context && attempt.endedAt && statuses[attempt.status] && attempt.id === request.attempt?.id
        && attempt.operatorId === request.operatorId && attempt.requestRef === `${base}/request/request.json`
        && attempt.responseRef === `${base}/response/response.json`
        && attempt.number === request.attempt.number && attempt.kind === request.attempt.kind && attempt.previous === request.attempt.previous
        && attempt.expectedVersion === request.expected?.version && equal(attempt.expected, request.expected)
        && attempt.expectedHash === digest(Buffer.from(JSON.stringify(request.expected))) && equal(attempt.frozenInputs, request.frozenInputs),
      'COORDINATION_HISTORY', 'historical admission requires the exact accepted invocation');
      invocationState(session, state, request);
      const directory = path.join(session, base), retainedRequest = read(path.join(directory, 'request/request.json'));
      check(equal(retainedRequest, request), 'COORDINATION_HISTORY', 'historical request differs from the sealed invocation');
      const response = read(path.join(directory, 'response/response.json'));
      check(response.status === statuses[attempt.status] && response.operatorId === request.operatorId
        && response.attempt?.id === attempt.id && response.attempt?.number === attempt.number
        && response.attempt?.expectedVersion === attempt.expectedVersion && equal(response.comparison, attempt.comparison),
      'COORDINATION_HISTORY', 'historical response differs from its accepted identity and comparison');
      const seals = await evidenceManifestErrors(directory, attempt.evidenceManifest);
      check(seals.length === 0, 'COORDINATION_HISTORY', seals.join('; '));
      if (!request.coordination) return errors;
    }
    const roots = requestRoots(state, request), cell = `${request.step}/${request.parallel}`;
    if (!historical) for (const pending of state.coordination?.incorporations ?? []) if (!pending.receipt) {
      const intent = history(session, pending.intent, 'incorporations');
      check(!roots.some(wanted => wanted.repository === intent.repository), 'COORDINATION_INCORPORATION', 'pending shared-source merge must be measured and recorded before another source writer');
    }
    const ownerId = state.coordination?.coordinatorSessionId ?? (state.coordination?.active ? state.id : null);
    const owner = assignments.find(item => item.owner.state.id === ownerId);
    const active = owner?.assignment;
    let pinned = null;
    if (request.coordination) {
      check(owner && request.coordination.coordinatorSessionId === owner.owner.state.id, 'COORDINATION_IDENTITY', 'request names another coordinator');
      check(owner.owner.state.coordination.revisions.some(address => addressEqual(address, request.coordination.assignment)), 'COORDINATION_SEAL', 'request pins unknown assignment');
      pinned = history(owner.owner.session, request.coordination.assignment, 'assignments');
      check(pinned.peers[state.id] || owner.owner.state.id === state.id && roots.length === 0, 'COORDINATION_ENROLMENT', 'request assignment does not enrol its session or read-only coordinator');
    }
    const affected = active?.value.claims.some(claim => roots.some(wanted => claim.repository === wanted.repository && claimOverlaps(claim, wanted.root)));
    const dependencies = [];
    for (const dependency of historical && pinned ? pinned.dependencies : active?.value.dependencies ?? []) if (dependency.consumerSessionId === state.id && await dependencyContainsCell(session, state, dependency, cell)) dependencies.push(dependency);
    if ((affected || dependencies.length) && !pinned) {
      const key = `${cell}${request.exchange ? `/${request.exchange}` : ''}`;
      const retained = (active?.value.inFlight ?? []).filter(item => item.sessionId === state.id && item.key === key);
      check(!historical && retained.length === 1, 'COORDINATION_STALE', 'affected requests must freeze an assignment selector');
      const original = await admittedBeforeAssignment(session, state, request);
      check(equal(retained[0], original), 'COORDINATION_IN_FLIGHT', 'continuation differs from the invocation retained when ownership was assigned');
    }
    if (!historical) errors.push(...ownershipErrors(roots, state.id, assignments));
    else if (pinned) errors.push(...ownershipErrors(roots, state.id, [{ assignment: { value: pinned } }]));
    for (const dependency of dependencies) {
      check(dependency.proof, 'COORDINATION_WAIT', `${dependency.id} waits only its selected consumer nodes for accepted producer proof`);
      await checkConsumerInput(root, state, request, dependency, { session });
    }
  } catch (error) { errors.push(error.message); }
  return [...new Set(errors)];
}
async function checkConsumerInput(root, state, request, dependency, { session }) {
  const { acceptedProducerProof, validateImportedInput } = await import('./producer-import.mjs');
  const proof = await acceptedProducerProof(root, dependency.producerSessionId, dependency.proof.step, dependency.proof.parallel, dependency.kind, { hostRoot: sourceOf(state) });
  check(proof.manifestFingerprint === dependency.proof.manifestFingerprint && proof.requestHash === dependency.proof.requestHash && equal(proof.bindings, dependency.proof.bindings), 'COORDINATION_PRODUCER', 'producer identity, head or accepted seal changed');
  const input = request.inputs?.[dependency.kind];
  check(typeof input === 'string', 'COORDINATION_INPUT', 'consumer must actually bind the typed imported producer output');
  const imported = await validateImportedInput(root, session, input, dependency.kind, { hostRoot: sourceOf(state) });
  check(!imported.length, 'COORDINATION_INPUT', imported.join('; '));
  // validateImportedInput validates bytes and original acceptance; bind its origin to this edge too.
  const parts = /^step-(\d+)\/parallel-(\d+)\//.exec(input);
  check(parts, 'COORDINATION_INPUT', 'consumer input must identify an evidence-only imported slot');
  const manifest = read(path.join(session, `step-${parts[1]}`, `parallel-${parts[2]}`, 'import.json'));
  check(manifest.sourceSessionId === dependency.producerSessionId && manifest.sourceStep === dependency.proof.step && manifest.sourceParallel === dependency.proof.parallel,
    'COORDINATION_INPUT', 'import came from another producer');
  if (['backend-source-application', 'source-application'].includes(dependency.kind)) {
    const receipt = consumptionReceipt(session, state, dependency, request.environment?.workspace?.alias);
    check(receipt, 'COORDINATION_INCORPORATION', 'consumer must record its accepted upstream incorporation before source admission');
    const workspace = request.environment?.workspace;
    check(workspace && sameRoot(workspace.worktree, receipt.intent.worktree), 'COORDINATION_INCORPORATION', 'consumer source uses another incorporation checkout');
    execFileSync('git', ['-C', workspace.worktree, 'merge-base', '--is-ancestor', receipt.value.head, workspace.revision], { stdio: 'pipe' });
  }
}

function consumptionReceipt(session, state, dependency, alias) {
  const row = (state.coordination?.incorporations ?? []).find(item => item.dependencyId === dependency.id && item.alias === alias);
  if (!row?.receipt) return null;
  const intent = history(session, row.intent, 'incorporations'), value = history(session, row.receipt, 'incorporations');
  check(intent.sessionId === state.id && intent.dependencyId === dependency.id && equal(intent.producerProof, dependency.proof), 'COORDINATION_INCORPORATION', 'incorporation names another consumer, dependency or accepted producer proof');
  check(addressEqual(value.intent, row.intent) && value.tree === intent.tree && value.sourceHead === intent.sourceHead && value.oldHead === intent.oldHead,
    'COORDINATION_INCORPORATION', 'receipt differs from its frozen merge intent');
  const git = (...args) => execFileSync('git', ['-C', intent.worktree, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  check(git('rev-parse', `${value.head}^{tree}`) === intent.tree, 'COORDINATION_INCORPORATION', 'recorded incorporated tree is unavailable or changed');
  if (intent.mode === 'merge') {
    check(git('show', '-s', '--format=%P', value.head) === `${intent.oldHead} ${intent.sourceHead}`, 'COORDINATION_INCORPORATION', 'recorded commit has another pair of parents');
    check(git('show', '-s', '--format=%B', value.head) === intent.message, 'COORDINATION_INCORPORATION', 'recorded commit has another consumption message');
  }
  else check(value.head === intent.oldHead, 'COORDINATION_INCORPORATION', 'already-present receipt moved the source head');
  return { intent, value, intentAddress: row.intent, receiptAddress: row.receipt };
}

export async function incorporateExtraction(root, session, dependencyId, { input, alias, worktree }) {
  return mutateSession(session, async state => {
    const source = sourceOf(state), owner = locate(source, state.coordination?.coordinatorSessionId), active = currentAssignment(owner);
    await assertCurrentAuthority(root, owner, active);
    const dependency = active.value.dependencies.find(item => item.id === dependencyId && item.consumerSessionId === state.id);
    check(dependency?.proof && ['backend-source-application', 'source-application'].includes(dependency.kind), 'COORDINATION_INCORPORATION', 'select a resolved source dependency owned by this consumer');
    check(/^@workspaces\/(be|fe)$/.test(alias ?? ''), 'COORDINATION_INCORPORATION', 'consumer needs its exact source role');
    const { acceptedProducerProof, validateImportedInput } = await import('./producer-import.mjs');
    const errors = await validateImportedInput(root, session, input, dependency.kind, { hostRoot: source, receivingContractVersion: state.contractVersion });
    check(!errors.length, 'COORDINATION_INPUT', errors.join('; '));
    const slot = /^step-(\d+)\/parallel-(\d+)\//.exec(input ?? '');
    check(slot, 'COORDINATION_INPUT', 'incorporation requires the exact typed imported slot');
    const imported = read(path.join(session, `step-${slot[1]}/parallel-${slot[2]}/import.json`));
    check(imported.sourceSessionId === dependency.producerSessionId && imported.sourceStep === dependency.proof.step && imported.sourceParallel === dependency.proof.parallel, 'COORDINATION_INPUT', 'incorporation import came from another producer');
    const proof = await acceptedProducerProof(root, dependency.producerSessionId, dependency.proof.step, dependency.proof.parallel, dependency.kind, { hostRoot: source });
    check(proof.manifestFingerprint === dependency.proof.manifestFingerprint && proof.requestHash === dependency.proof.requestHash, 'COORDINATION_PRODUCER', 'producer changed after dependency resolution');
    const role = alias.split('/')[1], repository = repoFor(state, role, worktree);
    const { sessionWorktreeOf, sharedSourceIntent, sharedSourceResult } = await import('./workspace-checkout.mjs');
    const actualWorktree = sessionWorktreeOf({ source, project: state.project, role, sessionId: state.id });
    check(actualWorktree && sameRoot(actualWorktree, worktree), 'COORDINATION_INCORPORATION', 'incorporation must use the registered consumer session worktree');
    const bindings = proof.bindings.filter(binding => binding.worktree && canonicalRepository(execFileSync('git', ['-C', binding.worktree, 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim()) === repository);
    check(bindings.length === 1, 'COORDINATION_INCORPORATION', 'source incorporation requires one exact same-repository producer binding');
    const preparation = owner.state.coordination.preparations.map(address => history(owner.session, address, 'extractions')).find(value =>
      dependencyIdentity(value.specification.id, state.id, dependency.kind) === dependency.id
      && value.specification.dependencies.some(spec => spec.consumerSessionId === state.id && spec.kind === dependency.kind && equal(spec.cells, dependency.cells)));
    check(preparation?.producer.sessionId === dependency.producerSessionId, 'COORDINATION_INCORPORATION', 'dependency has no exact original extraction');
    const roots = preparation.transfers.filter(claim => claim.repository === repository).map(claim => claim.root);
    check(roots.length, 'COORDINATION_INCORPORATION', 'no source root was transferred in this repository');
    const already = consumptionReceipt(session, state, dependency, alias);
    if (already) { execFileSync('git', ['-C', worktree, 'merge-base', '--is-ancestor', already.value.head, 'HEAD'], { stdio: 'pipe' }); return already.receiptAddress; }
    for (const running of activeRequests({ session, state })) check(!requestRoots(state, running.request).some(wanted => wanted.repository === repository), 'COORDINATION_BUSY', 'finish the consumer repository writer before changing its source base');
    check(!(state.workerSlots ?? []).some(slot => slot.workerKind === 'helper' || !slot.branch || !state.attempts?.[slot.branch]), 'COORDINATION_BUSY', 'an unclassified consumer resource lease prevents source incorporation');
    state.coordination.incorporations ??= [];
    let row = state.coordination.incorporations.find(item => item.dependencyId === dependency.id && item.alias === alias), intent;
    if (row) {
      intent = history(session, row.intent, 'incorporations');
      check(equal(intent.producerProof, dependency.proof) && sameRoot(intent.worktree, worktree) && intent.sourceHead === bindings[0].revision, 'COORDINATION_INCORPORATION', 'pending intent is bound to another producer or checkout');
    } else {
      intent = { version: 1, sessionId: state.id, dependencyId, assignment: active.address, producerProof: dependency.proof, alias, repository, worktree: realPath(worktree), roots,
        ...sharedSourceIntent(worktree, bindings[0].revision, roots), message: `Incorporate accepted shared source ${dependency.id}` };
      row = { dependencyId, alias, intent: await seal(session, 'incorporations', intent), receipt: null };
      state.coordination.incorporations.push(row);
      // Intent survives a process death during normal Git hooks/signing. It grants no completed
      // source base; only the later exact parents/tree receipt can admit a consumer source writer.
      const file = path.join(session, 'state.json'), temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
      await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`); await replaceFile(temporary, file);
    }
    const result = sharedSourceResult(worktree, intent, { execute: true });
    row.receipt = await seal(session, 'incorporations', { version: 1, intent: row.intent, oldHead: intent.oldHead, sourceHead: intent.sourceHead, ...result });
    return row.receipt;
  });
}
export async function resolveExtraction(root, session, dependencyId, { step, parallel }) {
  return mutateSession(session, async state => {
    const source = sourceOf(state), owner = locate(source, state.id), active = currentAssignment(owner);
    await assertCurrentAuthority(root, owner, active);
    const matches = active?.value.dependencies.filter(item => item.id === dependencyId) ?? [];
    check(matches.length === 1, 'COORDINATION_DEPENDENCY', 'resolve exactly one retained typed dependency');
    const dependency = matches[0];
    check(dependency, 'COORDINATION_DEPENDENCY', 'unknown shared producer dependency');
    const { acceptedProducerProof } = await import('./producer-import.mjs');
    const proof = await acceptedProducerProof(root, dependency.producerSessionId, step, parallel, dependency.kind, { hostRoot: source });
    check(proof.operatorId === dependency.operatorId, 'COORDINATION_PRODUCER', 'wrong producer operation');
    const frozen = { step, parallel, requestHash: proof.requestHash, manifestFingerprint: proof.manifestFingerprint, bindings: proof.bindings, artifacts: proof.artifacts };
    if (dependency.proof) { check(equal(dependency.proof, frozen), 'COORDINATION_REPLAY', 'resolved dependency cannot be replaced'); return active.address; }
    const next = { ...active.value, id: `${active.value.id}-resolved-${dependencyId}`, previous: active.address,
      dependencies: active.value.dependencies.map(item => item.id === dependencyId ? { ...item, proof: frozen } : item) };
    const address = await seal(session, 'assignments', next);
    state.coordination.revisions.push(address); state.coordination.active = address;
    return address;
  });
}

export async function coordinationReadiness(root, session) {
  const state = sessionState(session), source = sourceOf(state);
  const errors = await coordinationStateErrors(root, session, state);
  check(!errors.length, 'COORDINATION_READINESS', errors.join('; '));
  const owner = locate(source, state.coordination?.coordinatorSessionId ?? state.id), active = currentAssignment(owner);
  const rows = [];
  for (const dependency of active?.value.dependencies ?? []) {
    if (state.id !== owner.state.id && dependency.consumerSessionId !== state.id) continue;
    const consumer = locate(source, dependency.consumerSessionId, active.value.peers[dependency.consumerSessionId]);
    const cells = Object.keys(consumer.state.steps ?? {}).filter(cell => cellPattern.test(cell));
    const pending = [];
    for (const cell of cells) if (!consumer.state.attempts?.[cell] && await dependencyContainsCell(consumer.session, consumer.state, dependency, cell)) pending.push(cell);
    let status = 'waiting-producer', inputs = [];
    if (dependency.proof) {
      status = 'waiting-import';
      const { acceptedProducerProof, validateImportedInput } = await import('./producer-import.mjs');
      const proof = await acceptedProducerProof(root, dependency.producerSessionId, dependency.proof.step, dependency.proof.parallel, dependency.kind, { hostRoot: source });
      check(proof.manifestFingerprint === dependency.proof.manifestFingerprint, 'COORDINATION_PRODUCER', 'resolved producer proof changed');
      for (const step of readdirSync(consumer.session).filter(name => /^step-\d+$/.test(name))) for (const parallel of readdirSync(path.join(consumer.session, step)).filter(name => /^parallel-\d+$/.test(name))) {
        const file = path.join(consumer.session, step, parallel, 'import.json');
        if (!existsSync(file)) continue;
        const manifest = read(file);
        if (manifest.sourceSessionId !== dependency.producerSessionId || manifest.sourceStep !== dependency.proof.step || manifest.sourceParallel !== dependency.proof.parallel) continue;
        const response = read(path.join(consumer.session, step, parallel, 'response/response.json'));
        const declared = response.fields?.[dependency.kind], refs = Array.isArray(declared) ? declared : [declared];
        for (const ref of refs.filter(Boolean)) {
          const input = `${step}/${parallel}/${ref}`, failures = await validateImportedInput(root, consumer.session, input, dependency.kind, { hostRoot: source });
          check(!failures.length, 'COORDINATION_INPUT', failures.join('; ')); inputs.push(input);
        }
      }
      if (inputs.length) status = ['backend-source-application', 'source-application'].includes(dependency.kind)
        && !(consumer.state.coordination?.incorporations ?? []).some(row => row.dependencyId === dependency.id && consumptionReceipt(consumer.session, consumer.state, dependency, row.alias)) ? 'waiting-incorporation' : 'ready';
    }
    rows.push({ dependencyId: dependency.id, consumerSessionId: dependency.consumerSessionId, cells: pending, status, inputs, assignment: active.address });
  }
  return rows;
}

export function affectedConsumerHeads(report, incorporation) {
  const heads = report.heads.filter(boundary => incorporation.bindings.some(item => item.alias === boundary.alias && item.worktree));
  check(heads.length, 'COORDINATION_PROOF', 'incorporation has no verified affected repository boundary');
  return heads;
}

// This is the Git/tuple half of the proof, not an acceptance adapter. Its caller first establishes
// the original accepted verification operator and required criterion through acceptedProducerProof.
export function verifyIntegratedTuple({ contributions, integration, bindings, repositoryFor }) {
  check(Array.isArray(integration?.repositories) && integration.repositories.length === contributions.size, 'COORDINATION_COMBINED', 'combined verification requires the exact integrated repository tuple');
  const heads = [];
  for (const [repository, peers] of contributions) {
    const expected = [...peers].map(([sessionId, head]) => ({ sessionId, head })).sort((a, b) => a.sessionId.localeCompare(b.sessionId));
    const declared = integration.repositories.filter(item => item.repository === repository);
    check(declared.length === 1 && equal(declared[0].contributions, expected), 'COORDINATION_COMBINED', 'integrated tuple omits or changes a producer or consumer contribution');
    const matching = bindings.filter(item => item.worktree && repositoryFor(item) === repository);
    check(matching.length === 1 && matching[0].revision === declared[0].head, 'COORDINATION_COMBINED', 'combined test does not bind one actual integrated head');
    const binding = matching[0];
    check(execFileSync('git', ['-C', binding.worktree, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() === binding.revision, 'COORDINATION_COMBINED', 'integrated worktree moved after verification');
    for (const contribution of expected) try {
      execFileSync('git', ['-C', binding.worktree, 'merge-base', '--is-ancestor', contribution.head, binding.revision], { stdio: 'pipe' });
    } catch { fail('COORDINATION_COMBINED', 'integrated tested head does not contain every producer and consumer contribution'); }
    heads.push({ repository, alias: binding.alias, head: binding.revision, contributions: expected });
  }
  return heads;
}

// workflow.verify calls this only with the peer inventory already frozen and independently
// verified by its normal contract. Messages and copied receipts never stand in for regression.
export async function buildCoordinationVerification(root, session, state, snapshot, peerReports, request) {
  if (!state.coordination?.active) {
    check(!snapshot.coordination, 'COORDINATION_PROOF', 'snapshot has no owning assignment'); return null;
  }
  check(snapshot.version === 2 && addressEqual(snapshot.coordination?.assignment, state.coordination.active), 'COORDINATION_PROOF', 'freeze the current assignment in the peer inventory');
  const source = sourceOf(state), owner = locate(source, state.id), active = currentAssignment(owner);
  const stateErrors = await coordinationStateErrors(root, session, state);
  check(!stateErrors.length, 'COORDINATION_PROOF', stateErrors.join('; '));
  const selected = snapshot.coordination.consumers;
  check(Array.isArray(selected) && selected.length === active.value.dependencies.length && new Set(selected.map(item => item.dependencyId)).size === selected.length,
    'COORDINATION_PROOF', 'every extracted dependency requires one consumer incorporation and regression');
  for (const identity of Object.values(active.value.peers)) {
    const peer = snapshot.peers[identity.taskId];
    check(peer?.sessionId === identity.sessionId, 'COORDINATION_PROOF', 'all assigned workflows must remain in the frozen portfolio');
  }
  const { acceptedProducerProof } = await import('./producer-import.mjs');
  const edges = [];
  const contributions = new Map();
  for (const dependency of active.value.dependencies) {
    check(dependency.proof, 'COORDINATION_WAIT', 'unresolved shared output cannot close the portfolio');
    const selection = selected.find(item => item.dependencyId === dependency.id);
    check(selection, 'COORDINATION_PROOF', 'missing exact dependency proof selection');
    const consumer = locate(source, dependency.consumerSessionId, active.value.peers[dependency.consumerSessionId]);
    const incorporation = await acceptedProducerProof(root, consumer.state.id, selection.incorporation.step, selection.incorporation.parallel, selection.incorporation.kind, { hostRoot: source });
    const incorporationRequest = read(path.join(incorporation.sessionRoot, incorporation.requestRef));
    await checkConsumerInput(root, consumer.state, incorporationRequest, dependency, { session: consumer.session });
    const cell = `${selection.incorporation.step}/${selection.incorporation.parallel}`;
    check(dependency.cells.includes(cell) || await dependencyContainsCell(consumer.session, consumer.state, dependency, cell), 'COORDINATION_PROOF', 'incorporation did not execute the selected consumer node');
    check(['backend.generate', 'interface.generate', 'library.update'].includes(incorporation.operatorId), 'COORDINATION_PROOF', 'incorporation must be an actual source consumer');
    const regression = await acceptedProducerProof(root, consumer.state.id, selection.regression.step, selection.regression.parallel, selection.regression.kind, { hostRoot: source });
    check(['quality.verify', 'api.verify', 'uat.verify'].includes(regression.operatorId), 'COORDINATION_PROOF', 'regression must be a validator-accepted verification operation');
    const regressionRequest = read(path.join(regression.sessionRoot, regression.requestRef));
    check(regressionRequest.coordination?.coordinatorSessionId === state.id && state.coordination.revisions.some(address => addressEqual(address, regressionRequest.coordination.assignment)), 'COORDINATION_PROOF', 'regression must freeze a retained assignment');
    const regressionAssignment = history(session, regressionRequest.coordination.assignment, 'assignments');
    check(equal(regressionAssignment.dependencies.find(item => item.id === dependency.id)?.proof, dependency.proof), 'COORDINATION_PROOF', 'regression predates the accepted shared output');
    const report = peerReports.find(peer => peer.sessionId === consumer.state.id);
    check(report?.heads?.length, 'COORDINATION_PROOF', 'consumer has no verified terminal repository heads');
    const sourceProof = await acceptedProducerProof(root, dependency.producerSessionId, dependency.proof.step, dependency.proof.parallel, dependency.kind, { hostRoot: source });
    const sourceState = locate(source, dependency.producerSessionId).state;
    const affectedHeads = affectedConsumerHeads(report, incorporation);
    const appliedAttempt = consumer.state.attempts[`${selection.incorporation.step}/${selection.incorporation.parallel}`];
    const regressionAttempt = consumer.state.attempts[`${selection.regression.step}/${selection.regression.parallel}`];
    check(Date.parse(regressionAttempt.startedAt) >= Date.parse(appliedAttempt.endedAt), 'COORDINATION_PROOF', 'consumer regression ran before its incorporation completed');
    for (const boundary of affectedHeads) {
      const binding = regression.bindings.find(item => item.alias === boundary.alias && item.worktree && item.revision === boundary.head);
      check(binding, 'COORDINATION_PROOF', 'consumer regression does not attest its exact terminal head');
      const applied = incorporation.bindings.find(item => item.alias === boundary.alias && item.worktree);
      check(applied && canonicalRepository(execFileSync('git', ['-C', applied.worktree, 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim()) === canonicalRepository(execFileSync('git', ['-C', binding.worktree, 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim()), 'COORDINATION_PROOF', 'incorporation and regression refer to different repositories');
      execFileSync('git', ['-C', binding.worktree, 'merge-base', '--is-ancestor', applied.revision, boundary.head], { stdio: 'pipe' });
      const consumerRepository = repoFor(consumer.state, boundary.alias.split('/')[1], binding.worktree);
      const required = contributions.get(consumerRepository) ?? new Map();
      required.set(consumer.state.id, boundary.head); contributions.set(consumerRepository, required);
      const sourceBindings = sourceProof.bindings.filter(item => item.worktree && repoFor(sourceState, item.alias.split('/')[1], item.worktree) === consumerRepository);
      if (sourceBindings.length) for (const producer of sourceBindings) {
        required.set(dependency.producerSessionId, producer.revision);
        execFileSync('git', ['-C', binding.worktree, 'merge-base', '--is-ancestor', producer.revision, boundary.head], { stdio: 'pipe' });
      }
      else check(incorporation.operatorId === 'library.update' && dependency.kind === 'library-release', 'COORDINATION_PROOF', 'cross-repository incorporation requires the existing verified package consume contract');
    }
    edges.push({ dependencyId: dependency.id, producerSessionId: dependency.producerSessionId, consumerSessionId: dependency.consumerSessionId,
      producer: { fingerprint: sourceProof.manifestFingerprint, requestHash: sourceProof.requestHash },
      incorporation: { step: selection.incorporation.step, parallel: selection.incorporation.parallel, fingerprint: incorporation.manifestFingerprint, requestHash: incorporation.requestHash,
        sourceReceipts: incorporation.bindings.flatMap(binding => { const receipt = consumptionReceipt(consumer.session, consumer.state, dependency, binding.alias); return receipt ? [{ alias: binding.alias, intent: receipt.intentAddress, receipt: receipt.receiptAddress }] : []; }) },
      regression: { step: selection.regression.step, parallel: selection.regression.parallel, fingerprint: regression.manifestFingerprint, requestHash: regression.requestHash } });
  }
  const selection = snapshot.coordination.combined;
  check(selection && (selection.sessionId === state.id || active.value.peers[selection.sessionId]), 'COORDINATION_COMBINED', 'select an original combined verification from the coordinator or one exact assigned workflow');
  const combined = await acceptedProducerProof(root, selection.sessionId, selection.step, selection.parallel, selection.kind, { hostRoot: source });
  check(['quality.verify', 'api.verify', 'uat.verify'].includes(combined.operatorId), 'COORDINATION_COMBINED', 'combined evidence must execute a verification operator');
  const combinedOwner = locate(source, selection.sessionId), combinedRequest = read(path.join(combined.sessionRoot, combined.requestRef));
  const integration = combinedRequest.coordination?.integration;
  check(combinedRequest.coordination?.coordinatorSessionId === state.id && addressEqual(combinedRequest.coordination.assignment, active.address), 'COORDINATION_COMBINED', 'combined verification must freeze the final resolved assignment');
  const criterion = combinedRequest.expected?.criteria?.find(item => item.id === integration?.criterionId && item.required === true);
  check(criterion, 'COORDINATION_COMBINED', 'combined verification requires a mandatory test criterion');
  // Source incorporation is local to the extracted boundary, but combined execution covers all
  // delivered consumer roles. A BE-only shared producer must not invent an FE source application.
  const consumerIds = new Set(active.value.dependencies.map(item => item.consumerSessionId));
  for (const report of peerReports.filter(peer => consumerIds.has(peer.sessionId))) {
    const consumer = locate(source, report.sessionId, active.value.peers[report.sessionId]);
    for (const boundary of report.heads) {
      const role = boundary.alias.split('/')[1];
      const repository = repoFor(consumer.state, role);
      const required = contributions.get(repository) ?? new Map();
      required.set(report.sessionId, boundary.head); contributions.set(repository, required);
    }
  }
  check(Array.isArray(integration.runtime) && integration.runtime.length, 'COORDINATION_COMBINED', 'combined verification requires original per-role runtime and measured verifier selectors');
  const proofOwners = new Set([selection.sessionId]);
  for (const runtime of integration.runtime) for (const selector of [runtime.before, runtime.after, runtime.verification]) {
    check(selector && (selector.sessionId === state.id || active.value.peers[selector.sessionId]), 'COORDINATION_COMBINED', 'runtime evidence came from an unassigned workflow');
    proofOwners.add(selector.sessionId);
  }
  const contexts = new Set((request?.contexts ?? []).map(context => context.alias));
  for (const id of proofOwners) check(['sessions', 'done'].some(zone => contexts.has(`@worktrees/${zone}/${id}`)), 'COORDINATION_COMBINED', 'combined proof owner is outside the isolated verifier context');
  const { verifiedIntegrationBindings } = await import('./workflow-runtime-proof.mjs');
  const runtimeBindings = await verifiedIntegrationBindings(root, combined, combinedRequest, integration, { hostRoot: source });
  check(runtimeBindings.length === contributions.size, 'COORDINATION_COMBINED', 'actual runtime evidence must cover every integrated repository boundary');
  const combinedHeads = verifyIntegratedTuple({ contributions, integration, bindings: runtimeBindings,
    repositoryFor: binding => repoFor(combinedOwner.state, binding.alias.split('/')[1], binding.worktree) });
  const heads = peerReports.flatMap(peer => (peer.heads ?? []).map(head => ({ sessionId: peer.sessionId, alias: head.alias, head: head.head }))).sort((a, b) => `${a.sessionId}:${a.alias}`.localeCompare(`${b.sessionId}:${b.alias}`));
  const proof = { assignment: active.address, edges, heads, combined: { sessionId: selection.sessionId, step: selection.step, parallel: selection.parallel,
    fingerprint: combined.manifestFingerprint, requestHash: combined.requestHash, heads: combinedHeads,
    runtime: runtimeBindings.map(({ alias, revision, repositoryHash, endpoint, runtimeFingerprint }) => ({ alias, head: revision, repositoryHash, endpoint, fingerprint: runtimeFingerprint })) } };
  return { ...proof, fingerprint: contentHash(proof) };
}

export async function dependencyContainsCell(session, state, dependency, cell) {
  if (dependency.cells.includes(cell)) return true;
  if (!state.planHistory || !dependency.nodes) return false;
  const { activePlanView } = await import('./plan-history.mjs');
  const forecast = activePlanView(session, state).forecast;
  const rebind = forecast?.rebinds?.[cell];
  if (rebind && forecast.steps?.[cell] === 'workspace.bind'
    && state.steps?.[rebind.source] === 'workspace.bind'
    && forecast.retries?.[rebind.retry]?.rebind === cell
    && forecast.goals?.[cell]?.prerequisite === rebind.retry) return false;
  const node = forecast?.nodes?.[cell];
  return typeof node === 'string' && dependency.nodes.some(original => node === original || node.startsWith(`${original}:`));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, session, file] = process.argv.slice(2);
  try {
    const input = file ? read(path.resolve(file)) : {};
    const operations = {
      enrol: () => enrolWorkflow(ROOT, path.resolve(session), input.coordinatorSessionId, input),
      assign: () => assignWorkflows(ROOT, path.resolve(session), input),
      prepare: () => prepareExtraction(ROOT, path.resolve(session), input),
      activate: () => activateExtraction(ROOT, path.resolve(session), input),
      resolve: () => resolveExtraction(ROOT, path.resolve(session), input.dependencyId, input),
      incorporate: () => incorporateExtraction(ROOT, path.resolve(session), input.dependencyId, input),
      readiness: () => coordinationReadiness(ROOT, path.resolve(session))
    };
    check(operations[command], 'INVALID_INPUT', 'expected enrol, assign, prepare, activate, resolve, incorporate or readiness with session and input JSON');
    process.stdout.write(`${JSON.stringify(await operations[command](), null, 2)}\n`);
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
