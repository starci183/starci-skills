// Runtime authority and project workflow storage are resolved separately.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

export const RUNTIME_REVISION = 3;
export const digest = value => `sha256:${createHash('sha256').update(value).digest('hex')}`;
export const canonical = value => value && typeof value === 'object' ? Array.isArray(value) ? value.map(canonical) : Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const contentHash = value => digest(JSON.stringify(canonical(value)));
export function realPath(value) {
  let cursor = path.resolve(value); const tail = [];
  while (!existsSync(cursor)) { const parent = path.dirname(cursor); if (parent === cursor) break; tail.unshift(path.basename(cursor)); cursor = parent; }
  const resolved = path.join(realpathSync(cursor), ...tail);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}
export const sameRoot = (left, right) => realPath(left) === realPath(right);
const safeId = value => typeof value === 'string' && /^[a-z0-9][a-z0-9.-]*$/.test(value) && !value.includes('..');
export function resolveWorkflowOwner(source, project) {
  if (!safeId(project)) throw Error('WORKFLOW_OWNER_INVALID: project must be a safe declaration id');
  source = path.resolve(source);
  const declarationRef = `.workspaces/projects/${project}/workflow.json`;
  const file = path.join(source, declarationRef);
  if (!existsSync(file)) throw Error(`WORKFLOW_OWNER_MISSING: declare ${declarationRef} before opening project work`);
  const relative = path.relative(realpathSync(source), realpathSync(file));
  if (lstatSync(file).isSymbolicLink() || path.isAbsolute(relative) || relative.startsWith('..')) throw Error('WORKFLOW_OWNER_INVALID: declaration escapes its Source or is a symlink');
  const bytes = readFileSync(file); const declaration = JSON.parse(bytes);
  if (declaration.version !== 1 || declaration.project !== project || !safeId(declaration.ownerRole) || Object.keys(declaration).some(key => !['$schema', 'version', 'project', 'ownerRole'].includes(key))) throw Error('WORKFLOW_OWNER_INVALID: expected version, project and one ownerRole');
  const routeRef = `.workspaces/local/routes/${project}/${declaration.ownerRole}/config.json`;
  const routeBytes = readFileSync(path.join(source, routeRef)); const route = JSON.parse(routeBytes);
  if (route.project !== project || route.role !== declaration.ownerRole || !path.isAbsolute(route.repository?.diskPath ?? '') || !sameRoot(route.source?.path ?? '.', source)) throw Error('WORKFLOW_OWNER_INVALID: owner route does not bind this Source and project');
  const ownerRoot = realpathSync(route.repository.diskPath);
  return { version: 1, project, sourceRoot: realpathSync(source), ownerRole: declaration.ownerRole, ownerRoot, repository: route.repository.gitRepository, gitPolicy: route.repository.gitPolicy ?? null, declarationRef, declarationHash: digest(bytes), routeRef, routeHash: digest(routeBytes) };
}
export const ownerFingerprint = owner => { const { routeHash, ...identity } = owner; return contentHash(identity); };
export function workflowOwnerErrors(root, session, state, { dispatch = false } = {}) {
  if (existsSync(path.join(session, 'relocation.json'))) return ['WORKFLOW_RELOCATED: source evidence is retained read-only; use the verified destination ledger'];
  if (state?.runtimeRevision !== RUNTIME_REVISION) return dispatch ? ['WORKFLOW_UPGRADE_REQUIRED: legacy evidence is readable; migrate ownership and resolve the current goal before new dispatch'] : [];
  const errors = [];
  try {
    const saved = state.workflowOwner;
    if (!saved) return ['WORKFLOW_OWNER_MISSING: state has no workflow owner'];
    if (!sameRoot(saved.sourceRoot, path.dirname(realpathSync(root)))) errors.push('WORKFLOW_OWNER_INVALID: runtime authority differs from workflowOwner.sourceRoot');
    if (dispatch) {
      const current = resolveWorkflowOwner(saved.sourceRoot, state.project);
      if (ownerFingerprint(current) !== ownerFingerprint(saved)) errors.push('WORKFLOW_OWNER_DRIFT: owner declaration or stable repository identity changed; review ownership before dispatch');
    }
    const active = path.join(saved.ownerRoot, '.worktrees', 'sessions', state.id);
    const archived = path.join(saved.ownerRoot, '.worktrees', 'done', state.id, 'bundle');
    if (!sameRoot(session, active) && !(state.lifecycle?.phase === 'closed-success' && sameRoot(session, archived))) errors.push('WORKFLOW_OWNER_INVALID: session is outside its one project-owned coordinate');
    if (existsSync(path.join(session, 'relocation.json'))) errors.push('WORKFLOW_RELOCATED: use the verified destination ledger');
  } catch (error) { errors.push(`WORKFLOW_OWNER_INVALID: ${error.message}`); }
  return errors;
}
export const workflowRootOf = (root, state) => state?.workflowOwner?.ownerRoot ?? path.dirname(root);
export function legacyBranchOf(state, branch, request) {
  if (!state.upgrade) return null;
  const ref = `step-${request.step}/parallel-${request.parallel}${request.exchange ? `/${request.exchange}` : ''}/request/request.json`;
  if (!state.upgrade.legacyRequestRefs.includes(ref)) return null;
  const located = readSessionState(branch); if (!located) throw Error('MIGRATION_CHANGED: migrated request has no ledger');
  const bytes = readFileSync(path.join(located.session, state.upgrade.legacyInventory));
  if (digest(bytes) !== state.upgrade.legacyInventoryHash) throw Error('MIGRATION_CHANGED: original inventory seal changed');
  const record = JSON.parse(bytes).files.find(file => file.path === ref);
  if (!record || record.hash !== digest(readFileSync(path.join(branch, 'request', 'request.json')))) throw Error('MIGRATION_CHANGED: original request bytes changed');
  return path.join(state.upgrade.from, path.dirname(path.dirname(ref)));
}
export function locateWorkflowSession(source, sessionId, fallbackOwner = source) {
  if (!safeId(sessionId)) throw Error('WORKFLOW_OWNER_INVALID: unsafe session id');
  const index = path.join(source, '.workspaces', 'local', 'workflows', `${sessionId}.json`);
  let owner = fallbackOwner;
  if (existsSync(index)) {
    const record = JSON.parse(readFileSync(index, 'utf8'));
    const declared = resolveWorkflowOwner(source, record.project);
    if (!sameRoot(record.ownerRoot, declared.ownerRoot)) throw Error('WORKFLOW_OWNER_DRIFT: session locator differs from project declaration');
    owner = declared.ownerRoot;
  }
  const live = path.join(owner, '.worktrees', 'sessions', sessionId);
  if (existsSync(path.join(live, 'relocation.json'))) {
    const relocation = JSON.parse(readFileSync(path.join(live, 'relocation.json'), 'utf8'));
    const declared = resolveWorkflowOwner(source, relocation.project);
    const destination = path.join(declared.ownerRoot, '.worktrees', 'sessions', sessionId);
    if (!sameRoot(destination, relocation.destination)) throw Error('WORKFLOW_OWNER_DRIFT: relocation target differs from declaration');
    return { session: destination, archive: null, ownerRoot: declared.ownerRoot };
  }
  const archive = path.join(owner, '.worktrees', 'done', sessionId);
  return existsSync(live) ? { session: live, archive: null, ownerRoot: owner } : { session: path.join(archive, 'bundle'), archive, ownerRoot: owner };
}
export function legacyMissionState(state, branch, request) {
  if (!legacyBranchOf(state, branch, request)) return state;
  const located = readSessionState(branch);
  const bytes = readFileSync(path.join(located.session, state.upgrade.legacyState));
  if (digest(bytes) !== state.upgrade.legacyStateHash) throw Error('MIGRATION_CHANGED: original mission state seal changed');
  const original = JSON.parse(bytes);
  return { ...state, mission: original.mission, choices: original.choices };
}
export function readSessionState(branch) {
  let cursor = path.resolve(branch);
  while (path.dirname(cursor) !== cursor) {
    if (existsSync(path.join(cursor, 'state.json'))) return { session: cursor, state: JSON.parse(readFileSync(path.join(cursor, 'state.json'), 'utf8')) };
    cursor = path.dirname(cursor);
  }
  return null;
}
