// docker-policy.mjs - pure Docker ownership policy. No LITE port-block helper exists in packages/hfs in this tree, so the
// full edition accepts published ports only in the reserved 41000-44999 range and still names the protected legacy blocks.

export const DOCKER_PORT_POLICY = 'DOCKER_PORT_POLICY';
export const STARCI_PROJECT_LABEL = 'starci.project';
export const COMPOSE_PROJECT_LABEL = 'com.docker.compose.project';
export const PORT_RANGE = Object.freeze({ first: 41_000, last: 44_999 });

const PROTECTED_RANGES = Object.freeze([
  { first: 3_000, last: 3_000 },
  { first: 3_100, last: 3_100 },
  { first: 54_320, last: 54_329 },
  { first: 55_321, last: 55_327 },
]);

const integerPort = (value) => {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65_535 ? port : null;
};

const publishedPortOf = (value) => {
  if (value && typeof value === 'object') return integerPort(value.published ?? value.PublishedPort);
  if (typeof value === 'number') return integerPort(value);
  if (typeof value !== 'string') return null;
  const withoutProtocol = value.split('/')[0];
  const parts = withoutProtocol.split(':');
  return parts.length >= 2 ? integerPort(parts.at(-2)) : null;
};

/** Whether a Docker container name belongs to the protected nivo-lite installation. */
export const isForeignContainer = (name) => String(name ?? '').toLowerCase().includes('nivo-lite');

/** The exact Compose project name owned by one app stack. */
export function dockerProjectName(project, stack) {
  const part = /^[a-z0-9][a-z0-9-]*$/;
  if (!part.test(String(project ?? '')) || !part.test(String(stack ?? ''))) return null;
  return `starci-${project}-${stack}`;
}

/** Host ports published by a canonical Compose JSON model, including short-syntax fixtures used by specs. */
export function publishedPorts(composeModel) {
  const found = [];
  for (const [service, definition] of Object.entries(composeModel?.services ?? {})) {
    for (const value of Array.isArray(definition?.ports) ? definition.ports : []) {
      const published = publishedPortOf(value);
      if (published !== null) found.push({ service, port: published });
    }
  }
  return found;
}

/**
 * Returns a typed refusal when a Compose model publishes a protected/foreign port or names a nivo-lite container; otherwise
 * null. All published ports use the fallback project range because this tree has no reusable LITE block allocator.
 */
export function refusePortPolicy(composeModel) {
  const foreign = Object.entries(composeModel?.services ?? {})
    .map(([service, definition]) => ({ service, name: definition?.container_name ?? definition?.containerName ?? service }))
    .filter(({ name }) => isForeignContainer(name));
  const ports = publishedPorts(composeModel);
  const unfixed = Object.entries(composeModel?.services ?? {}).flatMap(([service, definition]) =>
    (Array.isArray(definition?.ports) ? definition.ports : []).filter((value) => publishedPortOf(value) === null).map(() => service));
  const protectedPorts = ports.filter(({ port }) => PROTECTED_RANGES.some((range) => port >= range.first && port <= range.last));
  const outside = ports.filter(({ port }) => port < PORT_RANGE.first || port > PORT_RANGE.last);
  if (!foreign.length && !protectedPorts.length && !outside.length && !unfixed.length) return null;
  const reasons = [];
  if (foreign.length) reasons.push(`foreign container name(s): ${foreign.map(({ service, name }) => `${service}=${name}`).join(', ')}`);
  if (protectedPorts.length) reasons.push(`protected host port(s): ${protectedPorts.map(({ service, port }) => `${service}=${port}`).join(', ')}`);
  const outsideOnly = outside.filter((entry) => !protectedPorts.some((item) => item.service === entry.service && item.port === entry.port));
  if (outsideOnly.length) reasons.push(`host port(s) outside 41000-44999: ${outsideOnly.map(({ service, port }) => `${service}=${port}`).join(', ')}`);
  if (unfixed.length) reasons.push(`published host port(s) are not fixed to the project block: ${unfixed.join(', ')}`);
  return { code: DOCKER_PORT_POLICY, message: reasons.join('; '), ports, foreign };
}

/** Two non-empty exact label selectors used together for every destructive query. */
export function ownershipFilters(project, projectName) {
  if (!project || !projectName) throw new TypeError('docker ownership filters refuse an empty label selector');
  return [`label=${STARCI_PROJECT_LABEL}=${project}`, `label=${COMPOSE_PROJECT_LABEL}=${projectName}`];
}
