// scripts/api/quota/devin.mjs — devin viability probe. The agent card
// (modules/models/agents/devin.yaml) establishes that `devin auth status`
// exits zero even while logged out, so the probe is two-stage:
//   1. `devin auth status` must exit 0 AND not report "Not logged in"
//   2. `devin models list` must exit 0 (real authenticated reachability)
// Both spawn with ACP_BACKEND stripped from the env copy — a leaked
// ACP_BACKEND=windsurf makes the CLI take the wrong auth branch and reject
// valid credentials (POSIX equivalent: `env -u ACP_BACKEND`).
// Any non-zero exit or a logged-out report -> 'dead'.
import { spawnSync } from 'node:child_process';

function devinRun(args, timeout = 60000) {
  const env = { ...process.env };
  delete env.ACP_BACKEND;
  const r = spawnSync('devin', args, { encoding: 'utf8', env, shell: true, timeout, windowsHide: true });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error?.message ?? null };
}

export function probe() {
  const auth = devinRun(['auth', 'status'], 30000);
  if (auth.status !== 0) {
    return { state: 'dead', usedPercent: null, detail: `devin auth status exited ${auth.status}${auth.error ? ` (${auth.error})` : ''}` };
  }
  if (/not logged in/i.test(auth.stdout)) {
    return { state: 'dead', usedPercent: null, detail: 'devin auth status reports not logged in' };
  }
  const models = devinRun(['models', 'list']);
  if (models.status !== 0) {
    return { state: 'dead', usedPercent: null, detail: `devin models list exited ${models.status}${models.stderr ? `: ${models.stderr.slice(0, 200)}` : ''}` };
  }
  return { state: 'ok', usedPercent: null, detail: 'devin auth status + models list reachable' };
}
