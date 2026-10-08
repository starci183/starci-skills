// sonar-status.mjs - the state the configured SonarQube server reports: one plain GET of /api/system/status through the gate config's own fetch and timeout
// (scripts/gates/sonar-local.mjs resolveConfig). No custody, no token, nothing written. The release flow reads it while it waits for the Sonar stack
// (scripts/supervisor/release-sonar-wait.mjs) and when it checks the host before a cut (scripts/supervisor/release-sonar-host.mjs).

/**
 * The state of the server at `<cfg.host>/api/system/status`: the server's own word (UP, STARTING, DB_MIGRATION_NEEDED, DB_MIGRATION_RUNNING, RESTARTING),
 * `http-<code>` for another HTTP answer, `unreachable` (with the error in `detail`) when nothing answered in time.
 */
export async function sonarState(cfg) {
  try {
    const response = await cfg.fetch(`${cfg.host}/api/system/status`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(cfg.timeoutMs) });
    if (response.status !== 200) return { state: `http-${response.status}` };
    const status = (await response.json())?.status;
    return { state: typeof status === 'string' && status ? status : 'unknown' };
  } catch (error) {
    return { state: 'unreachable', detail: String(error?.cause?.code ?? error?.message ?? error).slice(0, 120) };
  }
}

/** true when the server answers 200 with status UP; any error, timeout or other state is false. */
export async function sonarUp(cfg) {
  return (await sonarState(cfg)).state === 'UP';
}
