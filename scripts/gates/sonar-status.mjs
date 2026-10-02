// sonar-status.mjs - whether the configured local SonarQube server answers UP: one plain GET of /api/system/status through the gate config's own fetch and timeout
// (scripts/gates/sonar-local.mjs resolveConfig). No custody, no token, nothing written. The release flow waits on it after starting the Sonar stack
// (scripts/supervisor/release-l4-sonar.mjs).

/** true when `<cfg.host>/api/system/status` answers 200 with status UP; any error, timeout or other state is false. */
export async function sonarUp(cfg) {
  try {
    const response = await cfg.fetch(`${cfg.host}/api/system/status`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(cfg.timeoutMs) });
    if (response.status !== 200) return false;
    return (await response.json())?.status === 'UP';
  } catch {
    return false;
  }
}
