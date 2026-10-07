// launch-smoke-state.mjs - the launch smoke's roles, its state directory layout and the files its op roles own.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const SMOKE_SCHEMA = 'starci/launch-smoke@2';
export const slash = (p) => String(p).replaceAll('\\', '/');

/**
 * Each role: its depth under the entry, its parent role, its title; an op role also its side (be/fe) and whether its
 * no-op fails on purpose. `by: 'smoke'` is a role the smoke itself starts from its parent's terminal (the starci kernel dispatch
 * shape: the dispatcher names the Kernel terminal as --from) instead of the parent's stage.
 */
export const ROLES = Object.freeze({
  supervisor: { depth: 1, parent: null, title: '[Supervisor] launch smoke' },
  worker: { depth: 2, parent: 'supervisor', title: '[Worker] launch smoke' },
  kernel: { depth: 1, parent: null, title: '[Kernel] launch smoke' },
  op: { depth: 2, parent: 'kernel', title: '[Op] launch smoke be', side: 'be' },
  opFe: { depth: 2, parent: 'kernel', title: '[Op] launch smoke fe', side: 'fe' },
  opFail: { depth: 2, parent: 'kernel', title: '[Op] launch smoke be fail', side: 'be', fails: true, by: 'smoke' },
  critic: { depth: 3, parent: 'op', title: '[Critic] launch smoke' },
});
export const PATHS = Object.freeze({
  'supervisor-worker': ['supervisor', 'worker'],
  'op-critic': ['kernel', 'op', 'critic'],
  'workflow-worktree': ['kernel', 'op', 'opFe', 'opFail'],
});
/** The children a parent's stage starts, in parallel. */
export const CHILDREN = Object.freeze(Object.fromEntries(Object.keys(ROLES).map((p) => [p, Object.entries(ROLES).filter(([, r]) => r.parent === p && r.by !== 'smoke').map(([role]) => role)]).filter(([, c]) => c.length)));
// Deepest first: a child is settled and released while its creator's terminal still exists.
export const CLEANUP_ORDER = Object.freeze(['critic', 'op', 'opFe', 'opFail', 'worker', 'kernel', 'supervisor']);
// worker-show: a Dispatch that will do nothing more.
export const SETTLED_STATUS = new Set(['completed', 'succeeded', 'failed', 'cancelled']);
export const ENDED_STATE = new Set(['done', 'completed', 'succeeded', 'failed', 'stopped', 'released', 'exited']);
export const GREEN_STATUS = new Set(['completed', 'succeeded']);
// ------------------------------------------------------------------ state directory
/** Where every smoke run keeps its state directory. */
export const stateParentOf = (tmp = os.tmpdir()) => path.join(tmp, 'starci-launch-smoke');
export const dirs = (state) => ({ agents: path.join(state, 'agents'), stages: path.join(state, 'stages'), results: path.join(state, 'results') });
export const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };
export const agentFile = (state, role) => path.join(dirs(state).agents, `${role}.json`);
export const stageFile = (state, role) => path.join(dirs(state).stages, `${role}.json`);
export const resultFile = (state, role) => path.join(dirs(state).results, `${role}.txt`);
export const planFile = (state) => path.join(state, 'plan.json');
export const planOf = (state) => readJson(planFile(state));
export const agentOf = (state, role) => readJson(agentFile(state, role));

// ------------------------------------------------------------------ the workflow worktree
/** The app-relative file an op role owns in the workflow worktree. */
// Each no-op file sits in a slot every scaffolded app owns, so the finish gate's lint judges the smoke and not an invented
// folder: a be op writes a payload fixture (be.tests.fixtures, src/tests/fixtures/<name>.<role>.json), an fe op a static
// file of the app's first fe application (fe.app-optional, apps/<app>/public/).
const OWNED_SLUG = Object.freeze({ op: 'be', opFe: 'fe', opFail: 'be-fail' });
export const ownedFileOf = (role, workflowId, feApp) => (ROLES[role].side === 'be'
  ? `be/src/tests/fixtures/launch-smoke-${workflowId}-${OWNED_SLUG[role]}.payload.json`
  : `fe/apps/${feApp}/public/launch-smoke-${workflowId}-${OWNED_SLUG[role]}.txt`);
/** The app's first fe application (hfs.json sides.fe.apps[0].name): the fe op's file goes under its public/ folder. */
export function feAppOf(appRoot) {
  try { return JSON.parse(fs.readFileSync(path.join(appRoot, 'hfs.json'), 'utf8'))?.sides?.fe?.apps?.[0]?.name ?? null; } catch { return null; }
}
/** The bytes an op role writes into its owned file. */
export const ownedTextOf = (role, workflowId) => (ROLES[role].side === 'be'
  ? `${JSON.stringify({ schema: SMOKE_SCHEMA, workflowId, role }, null, 2)}\n`
  : `${SMOKE_SCHEMA} ${workflowId} ${role}\n`);
/** The op record the dispatcher judges (sideOf, canDispatchConcurrently): its owned paths, app-relative. */
export const opRecordOf = (role, workflowId, feApp) => ({ jobId: `${workflowId}:${role}`, opId: role, owned_paths: [ownedFileOf(role, workflowId, feApp)] });
