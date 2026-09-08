// Read-only updater admission. Package versions do not identify execution contracts.
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveWorkflowOwner, sameRoot } from './workflow-root.mjs';

const policyFile = 'resources/runtime-compatibility.json';
const localPolicy = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', policyFile), 'utf8'));
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const validTuple = tuple => typeof tuple?.contractVersion === 'string' && tuple.contractVersion.length > 0 && Number.isInteger(tuple.runtimeRevision) && tuple.runtimeRevision > 0;
export function runtimeExecution(root) {
  const file = path.join(root, policyFile);
  if (existsSync(file)) {
    const policy = read(file);
    if (policy.version !== 1 || !validTuple(policy.execution)) throw Error(`invalid runtime compatibility policy: ${file}`);
    return policy.execution;
  }
  // The pre-policy runtime advertised its execution revision in this exported constant.
  // Do not infer compatibility from the npm release number.
  const legacy = path.join(root, 'scripts/workflow-root.mjs');
  if (existsSync(legacy) && /export const RUNTIME_REVISION = 3;/.test(readFileSync(legacy, 'utf8'))) return localPolicy.legacyExecution;
  return null;
}
export const canExecuteSession = (execution, state) => Boolean(execution && !state.upgrade && state.contractVersion === execution.contractVersion && state.runtimeRevision === execution.runtimeRevision);

export function discoverUpdateSessions(sourceRoot) {
  sourceRoot = realpathSync(sourceRoot);
  const owners = new Map([[sourceRoot, sourceRoot]]);
  const addOwner = owner => { const canonical = realpathSync(owner); owners.set(process.platform === 'win32' ? canonical.toLowerCase() : canonical, canonical); };
  const projects = path.join(sourceRoot, '.workspaces/projects');
  if (existsSync(projects)) for (const entry of readdirSync(projects, { withFileTypes: true })) {
    if (!entry.isDirectory() || !existsSync(path.join(projects, entry.name, 'workflow.json'))) continue;
    addOwner(resolveWorkflowOwner(sourceRoot, entry.name).ownerRoot);
  }
  const locators = path.join(sourceRoot, '.workspaces/local/workflows');
  if (existsSync(locators)) for (const entry of readdirSync(locators, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const file = path.join(locators, entry.name), locator = read(file);
    const declared = resolveWorkflowOwner(sourceRoot, locator.project);
    if (typeof locator.ownerRoot !== 'string' || !sameRoot(locator.ownerRoot, declared.ownerRoot)) throw Error(`workflow locator differs from declared owner: ${file}`);
    addOwner(declared.ownerRoot);
  }
  const sessions = [];
  for (const owner of owners.values()) {
    const directory = path.join(owner, '.worktrees/sessions');
    if (!existsSync(directory)) continue;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const session = path.join(directory, entry.name);
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      if (existsSync(path.join(session, 'retirement.json')) || existsSync(path.join(session, 'relocation.json'))) continue;
      const file = path.join(session, 'state.json');
      if (!existsSync(file)) throw Error(`active workflow coordinate has no state: ${session}`);
      const state = read(file);
      if (state.lifecycle?.phase === 'closed-success') continue;
      if (!validTuple(state) || typeof state.lifecycle?.phase !== 'string') throw Error(`unclassified active session: ${file}`);
      if (state.workflowOwner?.sourceRoot && !sameRoot(state.workflowOwner.sourceRoot, sourceRoot)) continue;
      sessions.push({ session, state });
    }
  }
  return sessions;
}

export function assertRuntimeUpdateCompatible({ sourceRoot, installedRoot, incomingRoot }) {
  let installed, incoming, sessions;
  try {
    installed = runtimeExecution(installedRoot);
    incoming = runtimeExecution(incomingRoot);
    if (!incoming) throw Error('incoming runtime has no readable execution compatibility contract');
    sessions = discoverUpdateSessions(sourceRoot);
  } catch (error) { throw Error(`RUNTIME_UPDATE_DISCOVERY_FAILED: ${error.message}. Preserve the installed runtime and repair the declaration or session inventory before retrying.`); }
  const blocked = sessions.filter(({ state }) => !canExecuteSession(incoming, state) && (canExecuteSession(installed, state) || !installed));
  if (blocked.length) throw Error(`RUNTIME_UPDATE_INCOMPATIBLE: incoming ${incoming.contractVersion}/revision-${incoming.runtimeRevision} cannot continue ${blocked.map(({ session }) => session).join(', ')}. Keep the installed runtime until these sessions finish or explicitly retire/archive them; retain their evidence and open fresh sessions for the new contract. --force does not bypass this preflight.`);
  return { installed, incoming, sessions: sessions.map(({ session, state }) => ({ session, compatibility: canExecuteSession(incoming, state) ? 'compatible' : 'historical-incompatible' })) };
}
