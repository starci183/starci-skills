// release-sonar-wait.mjs - the wait for the local SonarQube server after its containers started: read from the server's own status (/api/system/status: STARTING,
// DB_MIGRATION_NEEDED, UP) and from the server container's state, bounded by a declared time (release-sonar-stack.mjs STARTUP), ending in a result that names
// the real state: {ok: true} or {ok: false, state, reason}. A state that cannot become UP by waiting (a migration the owner must run, a container that stopped) ends the wait at once.
import { containerLogs } from '../api/docker/container-logs.mjs';
import { repeatInOrder } from '../lib/in-order.mjs';

const HINTS = Object.freeze([
  [/max virtual memory areas vm\.max_map_count \[(\d+)\] is too low/i, (m) => `Elasticsearch refused to start: vm.max_map_count is ${m[1]} on the docker host (needs 262144; on Docker Desktop: wsl -d docker-desktop sysctl -w vm.max_map_count=262144)`],
  [/database migration|DB_MIGRATION_NEEDED|upgrade the database/i, () => 'the database was written by another SonarQube version and needs its migration'],
  [/OutOfMemoryError|Cannot allocate memory|Killed process/i, () => 'the server ran out of memory (raise the docker memory limit)'],
]);

/** The reason a SonarQube log tail names for the server's stop, or '' when none of the known ones appears. Pure. */
export function logHint(text) {
  for (const [pattern, say] of HINTS) {
    const found = pattern.exec(String(text ?? ''));
    if (found) return say(found);
  }
  return '';
}

const seconds = (ms) => Math.round(ms / 1000);

/** Why a server container that is not running ends the wait: its docker state plus what its log tail says. */
function stoppedReason({ host, container, containerState, logs }) {
  const tail = logs({ container });
  const hint = logHint(`${tail.stdout ?? ''}\n${tail.stderr ?? ''}`);
  const cause = hint ? `: ${hint}` : ' (docker logs shows no known cause)';
  return `the SonarQube container ${container} is ${containerState} while waiting for ${host}${cause}`;
}

/** The reason for a state the wait stops on at once, or '' when the wait goes on. */
function terminalReason(state, { host, container }) {
  if (state === 'DB_MIGRATION_NEEDED') {
    return `SonarQube at ${host} reports DB_MIGRATION_NEEDED: the volumes of ${container} hold a database written by an older SonarQube; open ${host}/setup once (or POST ${host}/api/system/migrate_db with an admin) and cut again`;
  }
  return '';
}

/**
 * Wait for the server of `cfg` to report UP. Seams (deps): state(cfg) -> {state, detail}, containerState() -> docker state of the server container, logs({container}) -> {stdout, stderr},
 * sleep(ms), now(), readyMs, pollMs. Resolves {ok: true, state: 'UP', ms} or {ok: false, state, reason, ms}; `state` is the last the server reported (`unreachable` when nothing answered).
 */
export async function awaitSonarUp(cfg, deps) {
  const { host, container } = cfg;
  const t0 = deps.now();
  const deadline = t0 + deps.readyMs;
  let last = { state: 'unreachable' };
  let verdict = null;
  const done = (ok, reason = null) => { verdict = { ok, state: last.state, ms: deps.now() - t0, ...(reason ? { reason } : {}) }; return true; };
  await repeatInOrder(async () => {
    last = await deps.state(cfg);
    if (last.state === 'UP') return done(true);
    const terminal = terminalReason(last.state, { host, container });
    if (terminal) return done(false, terminal);
    const containerState = deps.containerState();
    if (containerState !== 'running' && containerState !== 'restarting') return done(false, stoppedReason({ host, container, containerState, logs: deps.logs }));
    if (deps.now() >= deadline) {
      const detail = last.detail ? ` (${last.detail})` : '';
      return done(false, `SonarQube at ${host} still reports ${last.state}${detail} after ${seconds(deps.readyMs)}s although ${container} is ${containerState}; the bound is ${seconds(deps.readyMs)}s`);
    }
    await deps.sleep(deps.pollMs);
  });
  return verdict;
}

/** The log reader of a docker binary for awaitSonarUp. */
export const logsOf = (docker) => ({ container }) => containerLogs(container, { docker });
