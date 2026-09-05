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
const gitEnv = () => { const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))); return { ...env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' }; };
function git(cwd, ...args) {
  try { return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: gitEnv() }); }
  catch { fail('ROUTE_MISMATCH', 'read-only Git identity verification failed'); }
}
// The same read, without the refusal: a history question whose answer may lawfully be "there is none"
// (a checkout with no stash ref, a commit this repository never had) is asked here and read as null.
function gitTry(cwd, ...args) {
  try { return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: gitEnv() }); }
  catch { return null; }
}
const isTrue = (value) => value === true || String(value ?? '').trim().toLowerCase() === 'true';
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

// ---------------------------------------------------------------------------------------------------
// The installed tree. `node_modules` is routinely a junction or symbolic link onto one installed tree
// several checkouts share, and a delete inside such a checkout travels through the link and empties
// the tree every other checkout is using. The label is what a binding records, so the next reader can
// see the link before it reaches for a recursive delete.
export function installedTreeOf(checkout) {
  const target = path.join(checkout, 'node_modules');
  let stat = null;
  try { stat = lstatSync(target); } catch { return { present: false, linked: false, target: null, label: 'absent' }; }
  if (!stat.isSymbolicLink()) return { present: true, linked: false, target: null, label: 'own directory' };
  let resolved = null;
  try { resolved = slash(realpathSync(target)); } catch { return { present: true, linked: true, target: null, label: 'junction to an unresolvable target' }; }
  return { present: true, linked: true, target: resolved, label: `junction to ${resolved}` };
}

// A shared installed tree is bound only on purpose. A junction whose target lies outside the checkout
// belongs to something else — most often another session's checkout — and binding it silently is how a
// delete inside one session empties every other one.
export function junctionErrors(checkout, { sharedInstall = false } = {}) {
  const installed = installedTreeOf(checkout);
  if (!installed.linked || !installed.target) return [];
  if (within(path.resolve(checkout), path.resolve(installed.target))) return [];
  if (isTrue(sharedInstall)) return [];
  return [`the installed tree node_modules of this checkout is a ${installed.label}, outside the checkout and shared with whatever else uses it; a binding takes a shared installed tree only when the request declares sharedInstall: true, and nothing under it is ever deleted by hand`];
}

// ---------------------------------------------------------------------------------------------------
// The reflog of a routed checkout. A session branch gains its own commits and nothing else: a stash
// (which resets HEAD and leaves the entry behind even after the stash is dropped), a reset, a checkout
// of another branch, a rebase or an am each leave an entry the branch never earned, and each is
// forbidden inside a routed checkout. The window read is the entries from the branch's base up to the
// commit the receipt recorded, so a later branch of the same chain committing on the same worktree is
// not read as this branch's history.
const LAWFUL_REFLOG_ENTRY = /^commit(?: \(initial\))?:/;
export function reflogEntries(checkout, ref = 'HEAD') {
  const out = gitTry(checkout, 'reflog', 'show', '--format=%H%x09%gd%x09%gs', ref);
  if (out === null) return [];
  return out.split(/\r?\n/).filter(Boolean).map((line) => { const [sha, selector, ...rest] = line.split('\t'); return { sha, selector, subject: rest.join('\t') }; });
}
export function reflogErrors(checkout, { since, sessionBranch, until = null, expected = null, at = 'response/changes.md' }) {
  if (!checkout) return [];
  const errors = [];
  const entries = reflogEntries(checkout, 'HEAD');
  if (!entries.length) return [`${at}: the checkout of ${sessionBranch} keeps no HEAD reflog, so the entries the branch gained cannot be read; a source-writing receipt is judged against the history of the checkout it wrote in`];
  const end = until ? entries.findIndex((entry) => entry.sha === until) : 0;
  if (end === -1) return [`${at}: no HEAD reflog entry of the checkout names the recorded commit ${until}; the commit this receipt claims was never made in this checkout`];
  // The oldest entry standing on the base, not the newest: a reset that puts HEAD back on the base
  // writes an entry carrying the base's own sha, and reading that as the start of the window would let
  // the reset itself close the window it belongs inside.
  let start = -1;
  for (let index = entries.length - 1; index >= end; index -= 1) if (entries[index].sha === since) { start = index; break; }
  if (start === -1) return [`${at}: no HEAD reflog entry at or below the recorded commit names the base ${since}; the window between the base and the commit cannot be read`];
  // `git worktree add` writes the worktree into being with an empty entry and a `reset: moving to HEAD`
  // at the very bottom of the new reflog, both standing on the base. Those two are the worktree
  // existing, not the branch doing anything, so they are outside the window the branch is judged on; a
  // reset anywhere above them is the branch's own.
  const bootstrap = (entry, index) => index >= entries.length - 2 && (entry.subject === '' || entry.subject === 'reset: moving to HEAD');
  const window = [];
  for (let index = end; index < start; index += 1) if (!bootstrap(entries[index], index)) window.push(entries[index]);
  for (const entry of window) {
    if (LAWFUL_REFLOG_ENTRY.test(entry.subject)) continue;
    errors.push(`${at}: ${entry.selector} of the checkout is "${entry.subject}"; between the base ${since} and the recorded commit ${sessionBranch} gains only its own commits, and stash, reset, force, clean, a checkout of another branch, a rebase and an am are forbidden inside a routed checkout`);
  }
  if (expected !== null && window.length !== expected) errors.push(`${at}: the checkout's HEAD reflog gained ${window.length} entr${window.length === 1 ? 'y' : 'ies'} between the base and the recorded commit, and the receipt records ${expected}`);
  return errors;
}

// ---------------------------------------------------------------------------------------------------
// What a source-writing receipt states about the checkout it wrote in, and what the checkout itself
// says. `Reflog before` and `Reflog after` are the marks the branch read at dispatch and at its last
// commit — `HEAD <entries> <sha>; stash <entries>` — and `Preflight` is the verdict and instant of the
// request preflight (resources/orchestrator.json#sourceWrites). The arithmetic of the two marks holds
// wherever the receipt is read; the live reflog and the commit time are read whenever the checkout is
// still on disk.
export const REFLOG_MARK = /^HEAD (\d+) ([0-9a-f]{40}); stash (\d+)$/;
export const PREFLIGHT_MARK = /^(passed|failed) at (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))$/;
export const REFLOG_MARK_SHAPE = 'HEAD <reflog entries> <head sha>; stash <reflog entries>';
export const PREFLIGHT_MARK_SHAPE = '<passed|failed> at <ISO 8601 instant>';

export function sourceWriteErrors({ at, binding = {}, base, commits = [], branch, mode = 'apply', status = 'done', checkout = null }) {
  const errors = [];
  if (status !== 'done' || !base || !branch) return errors;
  const owed = mode === 'dry' ? 0 : commits.length;
  const expectedHead = owed ? commits[owed - 1] : base;

  // An em dash is this tree's written "nothing here", so a row carrying one is a row that was not filled.
  const stated = (value) => { const text = String(value ?? '').trim(); return text === '—' ? '' : text; };
  // Preflight before the first write.
  const preflight = stated(binding.Preflight);
  const stamped = PREFLIGHT_MARK.exec(preflight);
  if (!preflight) errors.push(`${at}: ## Binding records no Preflight; a source-writing branch runs the request preflight before it writes any file outside the session folder and records its verdict and instant as \`${PREFLIGHT_MARK_SHAPE}\` (orchestrator.json#sourceWrites)`);
  else if (!stamped) errors.push(`${at}: Preflight "${preflight}" is not \`${PREFLIGHT_MARK_SHAPE}\`; the verdict and the instant are both read`);
  else if (stamped[1] !== 'passed') errors.push(`${at}: Preflight is ${stamped[1]}; a done source-writing branch carries a preflight that passed before its first write`);

  // The two reflog marks.
  const before = REFLOG_MARK.exec(stated(binding['Reflog before']));
  const after = REFLOG_MARK.exec(stated(binding['Reflog after']));
  for (const [label, mark] of [['Reflog before', before], ['Reflog after', after]]) {
    if (!mark) errors.push(`${at}: ## Binding carries no ${label} of the shape \`${REFLOG_MARK_SHAPE}\`; the entries a routed checkout gained while the branch ran are what proves it gained nothing but its own commits`);
  }
  let gained = null;
  if (before && after) {
    gained = Number(after[1]) - Number(before[1]);
    if (before[2] !== base) errors.push(`${at}: Reflog before names head ${before[2]}; at dispatch the checkout stood on the branch's base ${base}`);
    if (after[2] !== expectedHead) errors.push(`${at}: Reflog after names head ${after[2]}; the last head this branch recorded is ${expectedHead}`);
    if (gained !== owed) errors.push(`${at}: the checkout's HEAD reflog gained ${gained} entr${gained === 1 ? 'y' : 'ies'} while the branch made ${owed} commit${owed === 1 ? '' : 's'}; a routed checkout gains only the branch's own commits, and a stash, a reset, a force, a clean or a checkout of another branch each leave one it never earned`);
    if (after[3] !== before[3]) errors.push(`${at}: the checkout's stash reflog went from ${before[3]} to ${after[3]} entries; a stash inside a routed checkout is forbidden, and dropping it afterwards does not undo it`);
  }

  if (!checkout) return errors;
  errors.push(...reflogErrors(checkout, { since: base, sessionBranch: branch, until: expectedHead, expected: gained, at }));
  if (stamped && owed) {
    const written = gitTry(checkout, 'show', '-s', '--format=%cI', commits[0]);
    const at0 = written === null ? null : Date.parse(written.trim());
    if (at0 !== null && Number.isFinite(at0) && at0 < Date.parse(stamped[2])) {
      errors.push(`${at}: the branch's first commit ${commits[0]} was made at ${written.trim()}, before the preflight this receipt records at ${stamped[2]}; the preflight runs before any file outside the session folder is written (orchestrator.json#sourceWrites)`);
    }
  }
  return errors;
}

// Where a source-writing branch wrote: the one registered worktree of `session/<sessionId>` in the
// canonical checkout the branch's own `@workspaces/<role>` context resolves to. It asks no policy and
// no cleanliness question — those belong to workspace.bind — only "which directory holds this branch's
// history"; a checkout a publish has already removed answers null, and the live half of the
// source-write law is then simply not available.
export function sessionWorktreeOf({ source, project, role, sessionId }) {
  try {
    const hydrated = JSON.parse(readFileSync(path.join(source, '.workspaces', 'local', 'routes', project, role, 'config.json'), 'utf8'));
    const canonical = realpathSync(hydrated.repository.diskPath);
    const rows = worktrees(canonical).filter((row) => row.branch === `refs/heads/session/${sessionId}`);
    return rows.length === 1 ? slash(realpathSync(rows[0].worktree)) : null;
  } catch { return null; }
}
export function sourceCheckoutOf(root, branchDir, request) {
  try {
    const state = JSON.parse(readFileSync(path.join(path.resolve(branchDir, '..', '..'), 'state.json'), 'utf8'));
    const alias = (request?.contexts ?? []).map((context) => context?.alias).find((value) => /^@workspaces\/(fe|be)$/.test(value ?? ''));
    if (!state?.project || !alias || !isSessionId(request?.sessionId)) return null;
    return sessionWorktreeOf({ source: path.dirname(root), project: state.project, role: alias.slice('@workspaces/'.length), sessionId: request.sessionId });
  } catch { return null; }
}

export function resolveWorkspaceCheckout({ source = path.dirname(ROOT), project, role, sessionId, checkout = 'routed', declaredWriteRoots = [], sharedInstall = false }) {
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
  const junction = junctionErrors(selected, { sharedInstall });
  requireThat(junction.length === 0, 'INVALID_INPUT', junction[0] ?? '');
  const gitPolicy = { worktreeBranches: repo.gitPolicy.worktreeBranches, mutationBranch: repo.gitPolicy.mutationBranch };
  return { project, role, portableRouteRef, hydratedRouteRef, routeFingerprint: sha256(Buffer.concat([portable.bytes, hydrated.bytes])), sourceHead: head,
    checkout: { diskPath: slash(selected), gitRoot: slash(selected), gitRepository: repo.gitRepository, branch, repositoryKind: repo.kind, directory: repo.directory ?? null, sourceHead: head },
    gitPolicy, writeRoots: declaredWriteRoots, mutationReadiness: declaredWriteRoots.length ? 'ready' : 'read-only', ...(sessionCheckout ? { sessionCheckout } : {}) };
}

// The request's gitPolicy is the object {worktreeBranches, mutationBranch}: the two fields of the
// route declaration's repository.gitPolicy (readiness/initialization/workspaces, $defs.gitPolicy)
// that a binding is checked against. A refusal names the field and the value the declared route
// carries, so a request that arrived in the wrong shape (a list, a string, a partial object) learns
// the shape it wanted; the request gate and the operator's own validator both read this one check.
export function gitPolicyErrors(asked, declared) {
  if (asked === undefined || asked === null) return [];
  const names = Object.keys(declared);
  const shape = `{${names.join(', ')}}`;
  if (typeof asked !== 'object' || Array.isArray(asked)) return names.map((field) => `request.json: gitPolicy.${field} is absent because gitPolicy is ${Array.isArray(asked) ? 'a list' : `a ${typeof asked}`}, not the object ${shape} the route declaration carries; it differs from the declared route (${declared[field]})`);
  return names.filter((field) => asked[field] !== declared[field]).map((field) => `request.json: gitPolicy.${field} ${asked[field] === undefined ? 'is absent and' : `${JSON.stringify(asked[field])}`} differs from the declared route (${declared[field]}); gitPolicy is the object ${shape} the route declaration carries`);
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
    const result = resolveWorkspaceCheckout({ source: path.dirname(root), project: requirements.project, role: requirements.role, sessionId: request.sessionId, checkout: 'session', declaredWriteRoots: requirements.declaredWriteRoots ?? [], sharedInstall: requirements.sharedInstall });
    return gitPolicyErrors(requirements.gitPolicy, result.gitPolicy);
  } catch (error) { return [`request.json: ${error.message}`]; }
}

// A head a receipt recorded is judged against the head it recorded, not against wherever the chain has
// carried the checkout since. A later branch of the same chain committing on the same branch moves the
// head forward lawfully, and the recorded head is then an ancestor of the current one; a checkout that
// moved to an unrelated commit — or to another branch, which the selection above refuses outright — is
// not the checkout this receipt describes.
function ancestorErrors(checkout, recorded, observed, label) {
  if (recorded === observed) return [];
  if (gitTry(checkout, 'merge-base', '--is-ancestor', recorded, observed) !== null) return [];
  return [`response/data/route.json: ${label} ${recorded} is neither the checkout's current head ${observed} nor an ancestor of it; a bound head is judged against the head the receipt recorded, and only a chain that moved forward on the same branch is still that checkout`];
}
// Every field of the observed selection must be what the receipt recorded, save the three heads, which
// a lawful chain is allowed to have advanced past.
function selectionErrors(route, observed, canonical) {
  const errors = [];
  for (const key of Object.keys(observed)) {
    if (key === 'sourceHead') { errors.push(...ancestorErrors(observed.checkout.diskPath, route.sourceHead, observed.sourceHead, 'sourceHead')); continue; }
    if (key === 'checkout' || key === 'sessionCheckout') {
      const head = key === 'checkout' ? 'sourceHead' : 'canonicalSourceHead';
      const where = key === 'checkout' ? observed.checkout.diskPath : canonical;
      const recorded = route[key] ?? {};
      const { [head]: recordedHead, ...recordedRest } = recorded;
      const { [head]: observedHead, ...observedRest } = observed[key];
      if (!isDeepStrictEqual(recordedRest, observedRest)) errors.push(`response/data/route.json: ${key} differs from independently observed workspace selection`);
      else errors.push(...ancestorErrors(where, recordedHead, observedHead, `${key}.${head}`));
      continue;
    }
    if (!isDeepStrictEqual(route[key], observed[key])) errors.push(`response/data/route.json: ${key} differs from independently observed workspace selection`);
  }
  return errors;
}

export function validateWorkspaceCheckoutBinding(root, request, route, branchDir) {
  const mode = request?.requirements?.checkout ?? 'routed';
  if (mode !== 'session') return route.sessionCheckout !== undefined ? ['response/data/route.json: sessionCheckout requires checkout=session'] : [];
  if (!route.sessionCheckout) return ['response/data/route.json: checkout=session requires a sessionCheckout binding'];
  const identityErrors = sessionIdentityErrors(root, request, branchDir);
  if (identityErrors.length) return identityErrors;
  try {
    const observed = resolveWorkspaceCheckout({ source: path.dirname(root), project: request.requirements.project, role: request.requirements.role, sessionId: request.sessionId, checkout: mode, declaredWriteRoots: request.requirements.declaredWriteRoots ?? [], sharedInstall: request.requirements.sharedInstall });
    return selectionErrors(route, observed, observed.sessionCheckout?.canonicalDiskPath ?? observed.checkout.diskPath);
  } catch (error) { return [`response/data/route.json: ${error.message}`]; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const sharedInstall = argv.includes('--shared-install');
  const [project, role, sessionId, checkout = 'routed', ...declaredWriteRoots] = argv.filter((a) => a !== '--shared-install');
  try { process.stdout.write(`${JSON.stringify(resolveWorkspaceCheckout({ project, role, sessionId, checkout, declaredWriteRoots, sharedInstall }), null, 2)}\n`); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
