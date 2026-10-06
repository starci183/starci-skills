// docker-policy.mjs - pure Docker ownership policy. No LITE port-block helper exists in packages/hfs in this tree, so the
// full edition accepts published ports only in the reserved 41000-44999 range and names the protected blocks.
import { isProtectedContainer, protectedPortLabel } from '../lib/protected-installations.mjs';

export const DOCKER_PORT_POLICY = 'DOCKER_PORT_POLICY';
export const PROJECT_LABEL_KEY = 'starci.project';
const COMPOSE_PROJECT_LABEL = 'com.docker.compose.project';
const PORT_RANGE = Object.freeze({ first: 41_000, last: 44_999 });

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

/** Whether a Docker container name belongs to a protected installation. */
export const isForeignContainer = isProtectedContainer;

/** The exact Compose project name owned by one app stack. */
export function dockerProjectName(project, stack) {
  const part = /^[a-z0-9][a-z0-9-]*$/;
  if (!part.test(String(project ?? '')) || !part.test(String(stack ?? ''))) return null;
  return `starci-${project}-${stack}`;
}

/** Host ports published by a canonical Compose JSON model, including short-syntax fixtures used by specs. */
function publishedPorts(composeModel) {
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
 * Returns a typed refusal when a Compose model publishes a protected/foreign port or names a protected container; otherwise
 * null. All published ports use the fallback project range because this tree has no reusable LITE block allocator.
 */
export function refusePortPolicy(composeModel) {
  const foreign = Object.entries(composeModel?.services ?? {})
    .map(([service, definition]) => ({ service, name: definition?.container_name ?? definition?.containerName ?? service }))
    .filter(({ name }) => isForeignContainer(name));
  const ports = publishedPorts(composeModel);
  const unfixed = Object.entries(composeModel?.services ?? {}).flatMap(([service, definition]) =>
    (Array.isArray(definition?.ports) ? definition.ports : []).filter((value) => publishedPortOf(value) === null).map(() => service));
  const protectedPorts = ports.filter(({ port }) => protectedPortLabel(port));
  const outside = ports.filter(({ port }) => port < PORT_RANGE.first || port > PORT_RANGE.last);
  if (!foreign.length && !protectedPorts.length && !outside.length && !unfixed.length) return null;
  const reasons = [];
  if (foreign.length) {
    const names = foreign.map(({ service, name }) => `${service}=${name}`).join(', ');
    reasons.push(`foreign container name(s): ${names}`);
  }
  if (protectedPorts.length) {
    const names = protectedPorts.map(({ service, port }) => `${service}=${port}`).join(', ');
    reasons.push(`protected host port(s): ${names}`);
  }
  const outsideOnly = outside.filter((entry) => !protectedPorts.some((item) => item.service === entry.service && item.port === entry.port));
  if (outsideOnly.length) {
    const names = outsideOnly.map(({ service, port }) => `${service}=${port}`).join(', ');
    reasons.push(`host port(s) outside 41000-44999: ${names}`);
  }
  if (unfixed.length) reasons.push(`published host port(s) are not fixed to the project block: ${unfixed.join(', ')}`);
  return { code: DOCKER_PORT_POLICY, message: reasons.join('; '), ports, foreign };
}

/** Two non-empty exact label selectors used together for every destructive query. */
export function ownershipFilters(project, projectName) {
  if (!project || !projectName) throw new TypeError('docker ownership filters refuse an empty label selector');
  return [`label=${PROJECT_LABEL_KEY}=${project}`, `label=${COMPOSE_PROJECT_LABEL}=${projectName}`];
}
