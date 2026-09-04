#!/usr/bin/env node
// workspace.bind's read-only selection of a declared checkout or its own registered session worktree.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { validateLocalRoute, validatePortableRoute } from './workspace-portable.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isSessionId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
const slash = value => value.replaceAll('\\', '/');
const comparable = value => process.platform === 'win32' ? slash(value).toLowerCase() : slash(value);
const samePath = (left, right) => comparable(path.resolve(left)) === comparable(path.resolve(right));
const within = (root, target) => { const rel = path.relative(root, target); return rel === '' || (!path.isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${path.sep}`)); };
const sha256 = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const fail = (code, message) => { const error = new Error(`${code}: ${message}`); error.code = code; throw error; };
const requireThat = (truth, code, message) => { if (!truth) fail(code, message); };
const real = (value, code = 'ROUTE_MISMATCH') => { try { return realpathSync(value); } catch { fail(code, 'a declared or registered checkout path is absent'); } };
function git(cwd, ...args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  try { return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' } }); }
  catch { fail('ROUTE_MISMATCH', 'read-only Git identity verification failed'); }
}
const gitValue = (cwd, ...args) => git(cwd, ...args).trim();
const commonDir = checkout => real(gitValue(checkout, 'rev-parse', '--path-format=absolute', '--git-common-dir'));
function remoteIdentity(value) {
  const match = /^(?:https:\/\/github\.com\/|git@github\.com:)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(value.trim());
  return match?.[1].toLowerCase() ?? null;
}
function routeFile(source, relative, code) {
  const file = path.join(source, relative);
  requireThat(existsSync(file), code, 'route declaration is absent');
  requireThat(within(source, real(file)), 'ROUTE_MISMATCH', 'route declaration escapes Source');
  const bytes = readFileSync(file);
  try { return { bytes, value: JSON.parse(bytes) }; } catch { fail('ROUTE_MISMATCH', 'route declaration is not JSON'); }
}
function rootsFor(checkout, roots) {
  requireThat(Array.isArray(roots), 'INVALID_INPUT', 'declaredWriteRoots must be a list');
  return roots.map(root => {
    requireThat(typeof root === 'string' && root.length > 0 && !path.isAbsolute(root) && !/^[A-Za-z]:/.test(root) && !root.includes('\\') && !root.split('/').some(part => !part || part === '.' || part === '..'), 'INVALID_INPUT', 'write roots must be safe repository-relative paths');
    const target = path.resolve(checkout, root);
    requireThat(within(checkout, target), 'INVALID_INPUT', 'write root escapes the checkout');
    return { root, target };
  });
}
function assertTree(checkout, roots, allowDirty) {
  const parsedRoots = rootsFor(checkout, roots);
  // NUL porcelain avoids quoted filenames; a rename has both destination and source paths.
  const records = git(checkout, 'status', '--porcelain=v1', '-z', '--untracked-files=all').split('\0');
  const dirty = [];
  for (let index = 0; index < records.length; index += 1) {
    if (!records[index]) continue;
    const record = records[index];
    dirty.push(record.slice(3));
    if (/[RC]/.test(record.slice(0, 2))) dirty.push(records[++index]);
  }
  requireThat(allowDirty || dirty.length === 0, 'CHECKOUT_DIRTY', 'the canonical mutation checkout must be clean');
  for (const dirtyPath of dirty) {
    requireThat(typeof dirtyPath === 'string' && dirtyPath.length > 0, 'CHECKOUT_DIRTY', 'Git returned an incomplete changed path');
    const target = path.resolve(checkout, dirtyPath);
    requireThat(within(checkout, target) && parsedRoots.some(root => within(root.target, target)), 'CHECKOUT_DIRTY', 'a changed path is outside the declared write roots');
    let cursor = target;
    while (within(checkout, cursor) && !samePath(cursor, checkout)) {
      let stat;
      try { stat = lstatSync(cursor); } catch (error) { requireThat(error.code === 'ENOENT', 'CHECKOUT_DIRTY', 'a changed path cannot be inspected'); }
      if (stat) requireThat(!stat.isSymbolicLink() && within(checkout, real(cursor)), 'CHECKOUT_DIRTY', 'a changed path traverses a symbolic link');
      cursor = path.dirname(cursor);
    }
  }
}
function worktrees(canonical) {
  const rows = [];
  let current = {};
  for (const entry of git(canonical, 'worktree', 'list', '--porcelain', '-z').split('\0')) {
    if (!entry) { if (current.worktree) rows.push(current); current = {}; continue; }
    const space = entry.indexOf(' ');
    current[space < 0 ? entry : entry.slice(0, space)] = space < 0 ? true : entry.slice(space + 1);
  }
  if (current.worktree) rows.push(current);
  return rows;
}

export function resolveWorkspaceCheckout({ source = path.dirname(ROOT), project, role, sessionId, checkout = 'routed', declaredWriteRoots = [] }) {
  requireThat(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project ?? '') && /^(fe|be)$/.test(role ?? ''), 'INVALID_INPUT', 'project and role must be declared route identifiers');
  requireThat(['routed', 'session'].includes(checkout), 'INVALID_INPUT', 'checkout must be routed or session');
  requireThat(isSessionId(sessionId), 'INVALID_INPUT', 'sessionId must identify one session');
  source = real(source);
  const portableRouteRef = `.workspaces/projects/${project}/${role}.json`;
  const hydratedRouteRef = `.workspaces/local/routes/${project}/${role}/config.json`;
  const portable = routeFile(source, portableRouteRef, 'ROUTE_UNDECLARED');
  const hydrated = routeFile(source, hydratedRouteRef, 'ROUTE_UNHYDRATED');
  try { validatePortableRoute(portable.value); validateLocalRoute(hydrated.value); }
  catch { fail('ROUTE_MISMATCH', 'portable or hydrated route fails its schema'); }
  const declaration = portable.value, local = hydrated.value, repo = declaration.repository;
  requireThat(declaration.project === project && local.project === project && declaration.role === role && local.role === role, 'ROUTE_MISMATCH', 'route identity differs from its declaration location');
  requireThat(samePath(real(local.source.path), source) && samePath(real(local.source.workspaceRoot), path.join(source, '.workspaces')) && samePath(real(local.source.trust), path.join(source, '.claude')) && samePath(local.source.skills, path.join(source, '.claude', 'skills')), 'ROUTE_MISMATCH', 'hydrated route belongs to another Source');
  requireThat(repo.gitPolicy && local.repository.gitPolicy, 'INVALID_INPUT', 'both route halves must declare gitPolicy');
  requireThat(isDeepStrictEqual(repo.gitPolicy, local.repository.gitPolicy), 'ROUTE_MISMATCH', 'route halves disagree on Git policy');
  requireThat(remoteIdentity(repo.gitRepository) && remoteIdentity(repo.gitRepository) === remoteIdentity(local.repository.gitRepository) && repo.branch === local.repository.branch, 'ROUTE_MISMATCH', 'route halves disagree on repository or branch');
  const canonical = real(repo.kind === 'source' ? source : path.resolve(source, '..', repo.directory));
  requireThat(repo.kind === 'source' || (within(real(path.dirname(source)), canonical) && !samePath(canonical, real(path.dirname(source)))), 'ROUTE_MISMATCH', 'sibling checkout escapes the repositories root');
  requireThat(samePath(real(local.repository.diskPath), canonical) && samePath(real(local.repository.gitRoot), canonical) && samePath(real(gitValue(canonical, 'rev-parse', '--show-toplevel')), canonical), 'ROUTE_MISMATCH', 'hydrated route does not identify the declared Git root');
  requireThat(remoteIdentity(gitValue(canonical, 'remote', 'get-url', 'origin')) === remoteIdentity(repo.gitRepository), 'ROUTE_MISMATCH', 'canonical origin differs from the declaration');
  requireThat(gitValue(canonical, 'branch', '--show-current') === repo.branch, 'BRANCH_POLICY_VIOLATION', 'canonical checkout is not on the declared mutation branch');
  const canonicalHead = gitValue(canonical, 'rev-parse', 'HEAD');
  const canonicalCommon = commonDir(canonical);
  let selected = canonical, head = canonicalHead, branch = repo.branch, sessionCheckout;
  if (checkout === 'session') {
    requireThat(repo.gitPolicy.worktreeBranches === 'session-only', 'BRANCH_POLICY_VIOLATION', 'a forbidden worktree policy cannot select a session checkout');
    branch = `session/${sessionId}`;
    const candidates = worktrees(canonical).filter(item => item.branch === `refs/heads/${branch}`);
    requireThat(candidates.length === 1, 'ROUTE_MISMATCH', 'the current session must have exactly one registered worktree');
    const registration = candidates[0];
    requireThat(!registration.bare && !registration.detached && !registration.prunable && !registration.locked, 'ROUTE_MISMATCH', 'the session worktree registration is not available');
    selected = real(registration.worktree);
    requireThat(!samePath(selected, canonical) && samePath(real(gitValue(selected, 'rev-parse', '--show-toplevel')), selected) && samePath(commonDir(selected), canonicalCommon), 'ROUTE_MISMATCH', 'session checkout is not a registered worktree of the canonical repository');
    requireThat(gitValue(selected, 'branch', '--show-current') === branch && remoteIdentity(gitValue(selected, 'remote', 'get-url', 'origin')) === remoteIdentity(repo.gitRepository), 'ROUTE_MISMATCH', 'session checkout branch or repository identity differs');
    head = gitValue(selected, 'rev-parse', 'HEAD');
    requireThat(registration.HEAD === head, 'SOURCE_DRIFT', 'registered session head moved during selection');
    assertTree(canonical, [], false);
    sessionCheckout = { sessionId, canonicalDiskPath: slash(canonical), canonicalSourceHead: canonicalHead, canonicalBranch: repo.branch, gitCommonDir: slash(canonicalCommon) };
  }
  assertTree(selected, declaredWriteRoots, checkout === 'session');
  const gitPolicy = { worktreeBranches: repo.gitPolicy.worktreeBranches, mutationBranch: repo.gitPolicy.mutationBranch };
  return { project, role, portableRouteRef, hydratedRouteRef, routeFingerprint: sha256(Buffer.concat([portable.bytes, hydrated.bytes])), sourceHead: head,
    checkout: { diskPath: slash(selected), gitRoot: slash(selected), gitRepository: repo.gitRepository, branch, repositoryKind: repo.kind, directory: repo.directory ?? null, sourceHead: head },
    gitPolicy, writeRoots: declaredWriteRoots, mutationReadiness: declaredWriteRoots.length ? 'ready' : 'read-only', ...(sessionCheckout ? { sessionCheckout } : {}) };
}

function sessionIdentityErrors(root, request, branchDir) {
  try {
    requireThat(isSessionId(request?.sessionId) && Number.isSafeInteger(request?.step) && request.step > 0 && Number.isSafeInteger(request?.parallel) && request.parallel > 0, 'INVALID_INPUT', 'session identity and coordinates must be safe before resolving paths');
    requireThat(typeof branchDir === 'string', 'INVALID_INPUT', 'session checkout requires its containing request branch');
    const expected = path.resolve(path.dirname(root), '.worktrees', 'sessions', request.sessionId, `step-${request.step}`, `parallel-${request.parallel}`);
    requireThat(samePath(path.resolve(branchDir), expected) && samePath(real(branchDir), expected), 'INVALID_INPUT', 'session checkout request is outside its own session coordinate');
    const state = JSON.parse(readFileSync(path.join(branchDir, '..', '..', 'state.json'), 'utf8'));
    const bytes = readFileSync(path.join(branchDir, 'request', 'request.json'));
    const coordinate = `${request.step}/${request.parallel}`;
    requireThat(state.id === request.sessionId && state.steps?.[coordinate] === 'workspace.bind', 'INVALID_INPUT', 'containing session does not own this workspace.bind coordinate');
    requireThat(isDeepStrictEqual(JSON.parse(bytes), request) && state.requestHashes?.[coordinate] === sha256(bytes), 'INVALID_INPUT', 'session checkout requires the unchanged frozen request hash');
    return [];
  } catch (error) { return [`request.json: ${error.code ? error.message : 'INVALID_INPUT: session identity or frozen request cannot be verified'}`]; }
}

export function validateWorkspaceCheckoutRequest(root, request, branchDir) {
  const requirements = request.requirements ?? {};
  if (requirements.checkout === undefined) return [];
  if (!['routed', 'session'].includes(requirements.checkout)) return ['request.json: checkout must be routed or session'];
  if (requirements.checkout !== 'session') return [];
  const identityErrors = sessionIdentityErrors(root, request, branchDir);
  if (identityErrors.length) return identityErrors;
  try {
    const result = resolveWorkspaceCheckout({ source: path.dirname(root), project: requirements.project, role: requirements.role, sessionId: request.sessionId, checkout: 'session', declaredWriteRoots: requirements.declaredWriteRoots ?? [] });
    if (requirements.gitPolicy && (requirements.gitPolicy.worktreeBranches !== result.gitPolicy.worktreeBranches || requirements.gitPolicy.mutationBranch !== result.gitPolicy.mutationBranch)) return ['request.json: requested Git policy differs from the declared route'];
    return [];
  } catch (error) { return [`request.json: ${error.message}`]; }
}

export function validateWorkspaceCheckoutBinding(root, request, route, branchDir) {
  const mode = request?.requirements?.checkout ?? 'routed';
  if (mode !== 'session') return route.sessionCheckout !== undefined ? ['response/data/route.json: sessionCheckout requires checkout=session'] : [];
  if (!route.sessionCheckout) return ['response/data/route.json: checkout=session requires a sessionCheckout binding'];
  const identityErrors = sessionIdentityErrors(root, request, branchDir);
  if (identityErrors.length) return identityErrors;
  try {
    const observed = resolveWorkspaceCheckout({ source: path.dirname(root), project: request.requirements.project, role: request.requirements.role, sessionId: request.sessionId, checkout: mode, declaredWriteRoots: request.requirements.declaredWriteRoots ?? [] });
    const errors = [];
    for (const key of Object.keys(observed)) if (!isDeepStrictEqual(route[key], observed[key])) errors.push(`response/data/route.json: ${key} differs from independently observed workspace selection`);
    return errors;
  } catch (error) { return [`response/data/route.json: ${error.message}`]; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [project, role, sessionId, checkout = 'routed', ...declaredWriteRoots] = process.argv.slice(2);
  try { process.stdout.write(`${JSON.stringify(resolveWorkspaceCheckout({ project, role, sessionId, checkout, declaredWriteRoots }), null, 2)}\n`); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
