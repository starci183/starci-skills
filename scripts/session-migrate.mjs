import { existsSync } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { withSessionLock, withOwnedFileLock, mutateSession } from './session-lock.mjs';
import { contentHash, digest, resolveWorkflowOwner, sameRoot, RUNTIME_REVISION } from './workflow-root.mjs';
import { authorityErrors, scopeHash, scopeBindingErrors, completeDeliveryMission } from './mission-scope.mjs';
import { goalDecisionId } from './validate-request.mjs';
import { resolvedWaitingAttemptKeys } from './resolved-waiting.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const writeJson = async (file, value) => writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
async function inventory(directory) {
  const files = [];
  async function walk(relative = '') {
    for (const entry of await readdir(path.join(directory, relative), { withFileTypes: true })) {
      const ref = path.posix.join(relative, entry.name);
      if (ref === 'runtime/.session-lock') continue;
      const full = path.join(directory, ref); const stat = await lstat(full);
      if (stat.isSymbolicLink()) throw Error(`MIGRATION_PATH: symlink ${ref}`);
      if (stat.isDirectory()) await walk(ref);
      else if (stat.isFile()) files.push({ path: ref, hash: digest(await readFile(full)) });
      else throw Error(`MIGRATION_PATH: non-file ${ref}`);
    }
  }
  await walk(); return files.sort((a, b) => a.path.localeCompare(b.path));
}
export async function verifyMigration(session) {
  const state = await json(path.join(session, 'state.json'));
  if (!state.upgrade) return [];
  const errors = [];
  const originalBytes = await readFile(path.join(session, state.upgrade.legacyState));
  if (digest(originalBytes) !== state.upgrade.legacyStateHash) errors.push('MIGRATION_CHANGED: original state bytes changed');
  const manifest = await json(path.join(session, state.upgrade.legacyInventory));
  if (digest(await readFile(path.join(session, state.upgrade.legacyInventory))) !== state.upgrade.legacyInventoryHash) errors.push('MIGRATION_CHANGED: preserved inventory seal differs');
  if (manifest.source !== state.upgrade.from || manifest.sessionId !== state.id) errors.push('MIGRATION_CHANGED: inventory identity differs');
  for (const file of manifest.files) {
    if (path.isAbsolute(file.path) || file.path.split(/[\\/]/).includes('..')) { errors.push('MIGRATION_PATH: unsafe inventory ref'); continue; }
    const target = file.path === 'state.json' ? path.join(session, state.upgrade.legacyState) : path.join(session, file.path);
    try { if (digest(await readFile(target)) !== file.hash) errors.push(`MIGRATION_CHANGED: ${file.path}`); }
    catch { errors.push(`MIGRATION_MISSING: ${file.path}`); }
  }
  return errors;
}
export async function migrateSession(session, { sourceRoot = path.dirname(ROOT), project } = {}) {
  session = path.resolve(session);
  const state = await json(path.join(session, 'state.json'));
  project ??= state.project;
  if (project !== state.project) throw Error('MIGRATION_IDENTITY: project cannot change');
  const owner = resolveWorkflowOwner(sourceRoot, project);
  const destination = path.join(owner.ownerRoot, '.worktrees', 'sessions', state.id);
  if (path.basename(session) !== state.id || path.basename(path.dirname(session)) !== 'sessions' || path.basename(path.dirname(path.dirname(session))) !== '.worktrees' || (await lstat(session)).isSymbolicLink()) throw Error('MIGRATION_PATH: source must be exactly one real session directory');
  if (state.runtimeRevision === RUNTIME_REVISION && sameRoot(session, destination)) return { status: 'already-migrated', session };
  const indexDir = path.join(sourceRoot, '.workspaces', 'local', 'workflows');
  await mkdir(indexDir, { recursive: true });
  return withOwnedFileLock(path.join(indexDir, `${state.id}.lock`), () => withSessionLock(session, async () => {
    if (existsSync(path.join(session, 'relocation.json'))) {
      const relocation = await json(path.join(session, 'relocation.json'));
      if (!sameRoot(relocation.destination, destination) || relocation.project !== project) throw Error('MIGRATION_CONFLICT: relocation identity changed');
      const pending = existsSync(destination) ? destination : relocation.staging;
      if (!pending || !sameRoot(path.dirname(pending), path.dirname(destination)) || !path.basename(pending).startsWith(`${state.id}.migrating-`) && !sameRoot(pending, destination)) throw Error('MIGRATION_CONFLICT: invalid pending copy');
      const recovered = await json(path.join(pending, 'state.json'));
      if (recovered.id !== state.id || recovered.project !== project || !recovered.upgrade || !sameRoot(recovered.upgrade.from, session) || !sameRoot(recovered.workflowOwner?.ownerRoot ?? '.', owner.ownerRoot) || !sameRoot(recovered.workflowOwner?.sourceRoot ?? '.', sourceRoot)) throw Error('MIGRATION_CONFLICT: pending copy is not this verified ownership transfer');
      const manifest = await json(path.join(pending, recovered.upgrade.legacyInventory));
      if (contentHash(manifest.files) !== relocation.inventoryHash) throw Error('MIGRATION_CONFLICT: pending inventory differs from the switching record');
      const errors = await verifyMigration(pending); if (errors.length) throw Error(errors.join('\n'));
      if (!sameRoot(pending, destination)) await rename(pending, destination);
      await writeJson(path.join(session, 'relocation.json'), { ...relocation, status: 'moved' });
      await writeJson(path.join(indexDir, `${state.id}.json`), { version: 1, project, sessionId: state.id, ownerRoot: owner.ownerRoot });
      return { status: 'migration-recovered', session: destination, preserved: session };
    }
    const original = await json(path.join(session, 'state.json'));
    const resolved = await resolvedWaitingAttemptKeys(ROOT, session, original, { requireSuccessorTerminal: true });
    if (resolved.errors.length) throw Error(`MIGRATION_HISTORY: ${resolved.errors.join('\n')}`);
    if ((original.workerSlots ?? []).length || Object.keys(original.leases ?? {}).length || Object.entries(original.attempts ?? {}).some(([key, attempt]) => attempt.status === 'running' || attempt.status === 'waiting' && !resolved.settled.has(key))) throw Error('MIGRATION_BUSY: release workers and finish or truthfully suspend attempts before moving ownership');
    const files = await inventory(session);
    const same = sameRoot(session, destination);
    if (!same && existsSync(destination)) throw Error('MIGRATION_CONFLICT: destination already exists; never merge active ledgers');
    const staging = same ? session : `${destination}.migrating-${randomUUID()}`;
    if (!same) {
      await mkdir(staging, { recursive: true });
      for (const file of files) { const target = path.join(staging, file.path); await mkdir(path.dirname(target), { recursive: true }); await copyFile(path.join(session, file.path), target); }
      if (contentHash(await inventory(staging)) !== contentHash(files) || contentHash(await inventory(session)) !== contentHash(files)) throw Error('MIGRATION_CHANGED: source or copy changed; original remains active');
    }
    await mkdir(path.join(staging, 'upgrade'), { recursive: true });
    await copyFile(path.join(session, 'state.json'), path.join(staging, 'upgrade', 'legacy-state.json'));
    await writeJson(path.join(staging, 'upgrade', 'inventory.json'), { version: 1, sessionId: original.id, source: session, files });
    const upgraded = { ...original, runtimeRevision: RUNTIME_REVISION, workflowOwner: owner, upgrade: { from: session, migratedAt: new Date().toISOString(), legacyInventory: 'upgrade/inventory.json', legacyInventoryHash: digest(await readFile(path.join(staging, 'upgrade', 'inventory.json'))), legacyState: 'upgrade/legacy-state.json', legacyStateHash: files.find(file => file.path === 'state.json').hash, legacyRequestRefs: files.filter(file => file.path.endsWith('/request/request.json')).map(file => file.path) } };
    await writeJson(path.join(staging, 'state.json'), upgraded);
    const errors = await verifyMigration(staging); if (errors.length) throw Error(errors.join('\n'));
    if (!same) {
      // The source is disabled before activation of the verified copy. A failed rename leaves a resumable relocation record, never two executable owners.
      await writeJson(path.join(session, 'relocation.json'), { version: 1, project, sessionId: state.id, destination, staging, inventoryHash: contentHash(files), status: 'switching' });
      await rename(staging, destination);
      await writeJson(path.join(session, 'relocation.json'), { version: 1, project, sessionId: state.id, destination, staging, inventoryHash: contentHash(files), status: 'moved' });
    }
    await writeJson(path.join(indexDir, `${state.id}.json`), { version: 1, project, sessionId: state.id, ownerRoot: owner.ownerRoot });
    return { status: 'migrated', session: destination, preserved: session, files: files.length, scope: 'historical; upgrade-scope is required before new dispatch' };
  }));
}
export function prepareScopeUpgrade(state, discovery) {
  const version = state.mission.version + 1;
  return completeDeliveryMission({ ...state.mission, version, discovery, confirmation: { status: 'draft', decisionId: goalDecisionId(state.id, version), sourceRef: null } });
}
export async function upgradeScope(session, { discovery, authority }) {
  return mutateSession(session, async state => {
    if (state.runtimeRevision !== RUNTIME_REVISION || !state.upgrade) throw Error('WORKFLOW_UPGRADE_REQUIRED: migrate ownership first');
    const resolved = await resolvedWaitingAttemptKeys(ROOT, session, state, { requireSuccessorTerminal: true });
    if (resolved.errors.length) throw Error(`MIGRATION_HISTORY: ${resolved.errors.join('\n')}`);
    if (Object.entries(state.attempts ?? {}).some(([key, attempt]) => attempt.status === 'running' || attempt.status === 'waiting' && !resolved.settled.has(key))) throw Error('MIGRATION_BUSY: scope upgrade cannot race an attempt');
    if (state.mission.discovery) throw Error('GOAL_FROZEN: scope upgrade is a one-time legacy transition; use the normal replan for later changes');
    const mission = prepareScopeUpgrade(state, discovery);
    const errors = [...authorityErrors(mission, authority), ...scopeBindingErrors({ ...state, mission }, {})]; if (errors.length) throw Error(errors.join('\n'));
    mission.confirmation = { ...mission.confirmation, status: 'confirmed', sourceRef: authority.sourceRef, confirmedAt: new Date().toISOString(), scopeHash: scopeHash(mission), authority };
    state.mission = mission;
    state.choices[mission.confirmation.decisionId] = { selected: 'as-stated', selectedBy: 'user', sourceRef: authority.sourceRef };
    const branch = Object.keys(state.steps ?? {}).at(-1) ?? '1/1';
    const transition = { at: new Date().toISOString(), branch, event: 'replanned', goalVersion: mission.version, note: 'The reviewed discovery upgrades the historical mission to explicit impact and delivery coverage.' };
    (state.transitions ??= []).push(transition);
    return { status: 'scope-upgraded', sessionId: state.id, scopeHash: scopeHash(mission), transition, next: 'Print the replan transition to the root chat and mark its logged field through the normal session writer, then derive the new chain.' };
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, session, input] = process.argv.slice(2);
  const operation = command === 'prepare-scope' ? Promise.resolve(prepareScopeUpgrade(await json(path.join(session, 'state.json')), (await json(input)).discovery)) : command === 'migrate' ? migrateSession(session, input ? await json(input) : {}) : command === 'upgrade-scope' ? upgradeScope(session, await json(input)) : command === 'verify' ? verifyMigration(session) : Promise.reject(Error('usage: session-migrate.mjs migrate|prepare-scope|upgrade-scope|verify <session> [input.json]'));
  operation.then(value => process.stdout.write(`${JSON.stringify(value)}\n`), error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
