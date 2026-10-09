// runtime-deploy-host.mjs - the host-side seams of `starci runtime deploy`: reading the host tree and its engine, running the new tree's own verbs as children,
// and journalling the deploy. Each is replaceable in a spec (runtime-deploy.mjs takes them as `deps`).
import os from 'node:os';
import path from 'node:path';
import { allocationMs } from '../../engine/config.mjs';
import { putMachineBlob, readMachine, withMachine } from '../../engine/db/machine.mjs';
import { runNode } from '../api/node/run-node.mjs';
import { merge } from '../api/git/merge.mjs';
import { fetch } from '../api/git/fetch.mjs';
import { hostLockOwner } from '../machine/host-lock.mjs';
import { leaderState } from './boot.mjs';
import { inFlightSteps } from './runtime-deploy-inflight.mjs';
import { snapshotOf } from './runtime-deploy-verify.mjs';
import { runLandFullCheck } from '../supervisor/git-land-verify.mjs';

export const DEPLOY_EVENT = 'runtime-deployed';
export const DEPLOY_FAILED_EVENT = 'runtime-deploy-failed';
export const DEPLOY_SCHEMA = 'starci/runtime-deploy@1';
const CLI = path.join('packages', 'cli', 'bin', 'starci.mjs');

/** The declared waits of a deploy (modules/models/runtimes.yaml allocation.deploy). */
export const deployNumbers = () => ({ waitMs: allocationMs('deploy.waitMs'), pollMs: allocationMs('deploy.pollMs'), verifyMs: allocationMs('deploy.verifyMs') });

/** Runs `starci <args>` of the host tree as a child (the NEW code after a fast-forward) and parses its JSON: {status, data}. */
export function runHostVerb(host, args, env) {
  const r = runNode([CLI, ...args, '--json'], { cwd: host, env: { ...env, STARCI_RUNTIME: host }, timeout: 1_800_000 });
  let data = null;
  try { data = JSON.parse(String(r.stdout ?? '')); } catch { data = null; }
  return { status: r.error ? 1 : r.status, data, stderr: String(r.stderr ?? r.error?.message ?? '').slice(0, 400) };
}

/** The default seams over the real host. `env` is the verb's environment, `host` the host tree. */
export function hostSeams({ host, env }) {
  const read = (fn, fallback = null) => readMachine(fn, fallback, { env });
  return {
    lockOwner: () => hostLockOwner({ env }),
    leader: () => leaderState({ env }),
    inFlight: () => read((machine) => inFlightSteps({ machine, leader: leaderState({ env }) }), []),
    snapshot: () => { const leader = leaderState({ env }); return read((machine) => ({ leader, after: snapshotOf(machine, leader) })); },
    runCheck: (dir) => runLandFullCheck(dir),
    fetchFrom: (dir) => fetch(['--no-tags', dir, 'HEAD'], { cwd: host }),
    fastForward: (sha) => merge(['--ff-only', sha], { cwd: host }),
    migrate: () => runHostVerb(host, ['runtime', 'artefacts', '--migrate'], env),
    restart: () => runHostVerb(host, ['reconciler', 'restart'], env),
    journal: (kind, payload, files) => withMachine((machine) => {
      const filesSha = files ? putMachineBlob(machine, JSON.stringify({ files }), { mediaType: 'application/json' }) : null;
      return machine.supEvent({ entityType: 'runtime', entityId: payload.to, kind, payload: { ...payload, filesSha } });
    }, { env }),
    // The per-role payload (starci/revision-deploy@1) the role notification reads: asked of the NEW tree's own verb; null where that tree has none.
    roleActions: (from, to) => { const r = runHostVerb(host, ['runtime', 'revision-scope', '--from', from, '--to', to], env); return r.status === 0 ? r.data : null; },
    who: () => ({ actor: env.STARCI_ACTOR ?? null, user: os.userInfo().username, pid: process.pid }),
  };
}
