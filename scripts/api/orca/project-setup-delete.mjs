#!/usr/bin/env node
// project-setup-delete.mjs — the calls.yaml `project-setup-delete` call as a callable function.
//   node scripts/api/orca/project-setup-delete.mjs --setup <setup-id>
// Removes a project host setup. A repo-backed setup's id is the repo id `repo add` answered, and deleting it removes the
// repository registration (Orca has no `repo rm`): a live spec that registered a throwaway repository removes it here.
// Returns {ok, error, errorCode, hostUnavailable}.
import { orcaCall, arg } from './lib.mjs';

export function projectSetupDelete({ setup }) {
  const r = orcaCall('project-setup-delete', { setup });
  return { ok: r.outcome === 'ok', errorCode: r.receipt?.error?.code ?? null, error: r.error, hostUnavailable: r.hostUnavailable === true };
}

if (process.argv[1]?.endsWith('project-setup-delete.mjs')) {
  const out = projectSetupDelete({ setup: arg(process.argv.slice(2), 'setup') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
