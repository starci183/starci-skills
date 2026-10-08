// release-sonar-stack.mjs - what the release flow's Sonar proof and its pre-cut host check share about the local SonarQube stack: the gate config of an example that
// always names the stack's LOCAL host, the docker calls by exact container name, a container's state, and the bounds of the start-up wait.
import { containerInspect } from '../api/docker/container-inspect.mjs';
import { containerLifecycle } from '../api/docker/container-lifecycle.mjs';
import { resolveConfig } from '../gates/sonar-local.mjs';
import { runtimeSecretEnv } from '../gates/runtime-host.mjs';
import { freshFetch } from '../api/sonar/fresh-fetch.mjs';

/** The wait for SonarQube to report UP after its containers started, and the pause between two reads of its status. A cold start with migrations needs minutes. */
export const STARTUP = Object.freeze({ readyMs: 10 * 60_000, pollMs: 5_000 });
/** What the stack needs from the docker host: SonarQube's embedded Elasticsearch refuses to start under this vm.max_map_count (Linux; the Docker Desktop VM sets it itself). */
export const HOST_NEEDS = Object.freeze({ maxMapCount: 262_144 });

const withoutHost = (env) => Object.fromEntries(Object.entries(env).filter(([name]) => name !== 'SONAR_HOST_URL'));

/**
 * The gate config of the example in `appDir` for the stack the release starts: the host the example declares for the local stack (host.local), never the
 * SONAR_HOST_URL of the environment or of the host's secret.env, which names the public tunnel of CI and answers only while that tunnel runs. Its requests use a connection each.
 */
export function localStackConfig(appDir) {
  return resolveConfig({ cwd: appDir, fetch: freshFetch, runtimeSecretEnv: (env, root) => withoutHost(runtimeSecretEnv(env, root)) });
}

/** The docker calls the release flow makes on the stack, by container name: inspect, start, stop. `docker` is the binary. */
export const dockerOf = (docker) => ({
  inspect: (name) => containerInspect(name, '{{.State.Status}}', { docker }),
  start: (names) => containerLifecycle('start', names, { docker }),
  stop: (names) => containerLifecycle('stop', names, { docker }),
});

/** The state of one container: 'running', another docker state, or 'missing' / 'docker-unavailable'. */
export function stateOf(inspect, name) {
  const r = inspect(name);
  if (r.error) return 'docker-unavailable';
  if (r.status !== 0) return /daemon|connect/i.test(String(r.stderr)) ? 'docker-unavailable' : 'missing';
  return String(r.stdout ?? '').trim() || 'unknown';
}
