// hfs test-stack (up | down) - the warm stack of the test world (BE-CONVENTION 1.16, owner refinement 2026-09-30).
//
// The test world runs every service of the repository's own stack definition (.starcistacks/<env>: Postgres, Redis, Keycloak
// with its realm imported, a mail host, ...) for real, each behind a toxiproxy proxy, so an outage or a slow dependency is
// injected on real infrastructure (`world.infra.<service>.cut() / .latency(ms) / .restore()`). This module starts and stops
// exactly that set under ONE stable project name (`<package>-test-stack`), so the world finds the same stack again:
//   up    starts the services (or attaches when the whole stack already answers: `started: false`, proxies reset), and
//         prints ONE JSON document on stdout: the project, whether this call started it, where each service and each proxy
//         listens on loopback, the (test-only) environment and the bind mounts of each service.
//   down  removes every container and the network of the project; nothing else on the host is touched.
// Images, ports, commands, environment and mounts come from the stack declaration (scripts/lib/stack-services.mjs); nothing is
// spelled here except how a well-known image tells it answers. Every service publishes on 127.0.0.1 with an OS-allocated
// host port, so the test stack never collides with a developer's dev stack.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DEFAULT_ENVIRONMENT, readStack } from '../runtime/scripts/lib/stack-services.mjs';

export const STACK_SCHEMA = 'starci/test-stack@1';
const LABEL = 'com.starci.test-stack';
const SERVICE_LABEL = `${LABEL}.service`;
const PROXIES_LABEL = `${LABEL}.proxies`;
const LOOPBACK = '127.0.0.1';
const PROXY_LISTEN_BASE = 21000;
const DOCKER_TIMEOUT_MS = 600_000;
const READY_DEADLINE_MS = 240_000;
const ATTACH_DEADLINE_MS = 15_000;
const PROBE_TIMEOUT_MS = 5_000;
const KEYCLOAK_IMPORT_DIRECTORY = '/opt/keycloak/data/import/';

export class TestStackError extends Error {}

/** The stable project name of a repository: its package name (scope dropped) plus `-test-stack`. */
export function projectNameOf(root) {
  let name = path.basename(path.resolve(root));
  try { name = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).name ?? name; } catch { /* the directory name stands */ }
  const plain = String(name).replace(/^@[^/]+\//u, '').toLowerCase().replace(/[^a-z0-9_.-]+/gu, '-').replace(/^[^a-z0-9]+/u, '');
  return `${plain || 'repository'}-test-stack`;
}

const dockerCli = (args, { timeoutMs = 120_000 } = {}) => {
  try {
    return execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: timeoutMs, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    throw new TestStackError(`docker ${args.slice(0, 2).join(' ')} failed: ${String(error.stderr ?? error.message).trim().split('\n').at(-1)}`);
  }
};

const tcpAnswers = port => new Promise(resolve => {
  const socket = net.connect({ host: LOOPBACK, port });
  const done = value => { socket.destroy(); resolve(value); };
  socket.setTimeout(PROBE_TIMEOUT_MS, () => done(false));
  socket.once('connect', () => done(true));
  socket.once('error', () => done(false));
});

const defaultIo = () => ({
  docker: dockerCli,
  fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) }),
  tcp: tcpAnswers,
  sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
  log: message => process.stderr.write(`hfs test-stack: ${message}\n`),
});

const containerOf = (project, service) => `${project}-${service}`;
const proxyNameOf = (service, containerPort) => `${service}-${containerPort}`;

/** The host port a container published for `containerPort`: `docker port <c> 5432/tcp` prints `127.0.0.1:49153`. */
const hostPortOf = (io, container, containerPort) => {
  const lines = io.docker(['port', container, `${containerPort}/tcp`]).split(/\r?\n/u).filter(Boolean);
  const port = Number(lines[0]?.split(':').at(-1));
  if (!Number.isInteger(port)) throw new TestStackError(`${container} publishes no host port for ${containerPort}`);
  return port;
};

const containersOf = (io, project) => io.docker(['ps', '-a', '--filter', `label=${LABEL}=${project}`, '--format', '{{.Names}}\t{{.Label "' + SERVICE_LABEL + '"}}\t{{.State}}'])
  .split(/\r?\n/u).filter(Boolean).map(line => { const [name, service, state] = line.split('\t'); return { name, service, running: state === 'running' }; });

/** Removes every container and the network of `project`; a project that is not there is a no-op. */
export function down({ project, io = defaultIo() }) {
  const removed = containersOf(io, project).map(container => container.name);
  if (removed.length) io.docker(['rm', '-f', '-v', ...removed]);
  const networks = io.docker(['network', 'ls', '--filter', `label=${LABEL}=${project}`, '--format', '{{.Name}}']).split(/\r?\n/u).filter(Boolean);
  for (const network of networks) io.docker(['network', 'rm', network]);
  return { project, removed };
}

/** The realm a keycloak service imports (`realm` of its mounted import file), so its probe waits for the realm and not only the server. */
const importedRealm = service => {
  const mount = service.mounts.find(item => item.container.startsWith(KEYCLOAK_IMPORT_DIRECTORY));
  if (!mount) return null;
  try { return JSON.parse(fs.readFileSync(mount.host, 'utf8')).realm ?? null; } catch { return null; }
};

/** True when `service` answers: the probe of its image, through `docker exec`, HTTP or TCP on its direct host port. */
async function answers({ io, project, service, ports }) {
  const container = containerOf(project, service.name);
  const { probe } = service;
  try {
    if (probe.exec) {
      const user = service.environment.POSTGRES_USER;
      io.docker(['exec', container, ...probe.exec, ...(probe.exec[0] === 'pg_isready' && user ? ['-U', user] : [])]);
      return true;
    }
    if (probe.http) {
      const target = ports.find(port => port.containerPort === (probe.http.containerPort ?? service.ports[0])) ?? ports[0];
      if (!target) return false;
      const realm = service.kind === 'identity' ? importedRealm(service) : null;
      const response = await io.fetch(`http://${LOOPBACK}:${target.direct}${realm ? `/realms/${realm}` : probe.http.path}`, {});
      return response.ok;
    }
    return ports[0] ? await io.tcp(ports[0].direct) : false;
  } catch {
    return false;
  }
}

/** Polls `check` once a second until it is true (answers true) or the deadline passes (answers false). */
async function untilAnswers({ io, deadlineMs, check }) {
  const deadline = Date.now() + deadlineMs;
  while (!(await check())) {
    if (Date.now() >= deadline) return false;
    await io.sleep(1000);
  }
  return true;
}

/** The plan of the proxies: one per published container port of each real service, each with its own listener port inside the toxiproxy container. */
const proxyPlanOf = services => {
  const plan = [];
  for (const service of services) {
    for (const containerPort of service.ports) plan.push({ service: service.name, containerPort, name: proxyNameOf(service.name, containerPort), listen: PROXY_LISTEN_BASE + plan.length });
  }
  return plan;
};

const proxyApiOf = (io, project, proxy) => `http://${LOOPBACK}:${hostPortOf(io, containerOf(project, proxy.name), proxy.ports[0])}`;

/** The state document of a running project, read back from the host: labels, published ports, the proxy plan. */
function describe({ io, project, stack, services }) {
  const proxy = stack.proxy;
  const api = proxyApiOf(io, project, proxy);
  const labels = JSON.parse(io.docker(['inspect', '--format', '{{json .Config.Labels}}', containerOf(project, proxy.name)]));
  const plan = JSON.parse(labels[PROXIES_LABEL] ?? '[]');
  const described = {};
  for (const service of services) {
    described[service.name] = {
      image: service.image,
      container: containerOf(project, service.name),
      environment: service.environment,
      mounts: service.mounts.map(({ host, container: target }) => ({ host, container: target })),
      ports: service.ports.map(containerPort => {
        const entry = plan.find(item => item.service === service.name && item.containerPort === containerPort);
        return {
          containerPort,
          host: LOOPBACK,
          direct: hostPortOf(io, containerOf(project, service.name), containerPort),
          proxy: entry ? hostPortOf(io, containerOf(project, proxy.name), entry.listen) : null,
          proxyName: entry?.name ?? proxyNameOf(service.name, containerPort),
        };
      }),
    };
  }
  return { schema: STACK_SCHEMA, project, environment: stack.environment, toxiproxy: { apiUrl: api }, services: described, plan };
}

const startService = ({ io, project, service, extraPorts = [], labels = {} }) => {
  const args = ['run', '-d', '--name', containerOf(project, service.name), '--network', project, '--network-alias', service.name,
    '--label', `${LABEL}=${project}`, '--label', `${SERVICE_LABEL}=${service.name}`,
    ...Object.entries(labels).flatMap(([key, value]) => ['--label', `${key}=${value}`])];
  for (const [key, value] of Object.entries(service.environment)) args.push('-e', `${key}=${value}`);
  for (const mount of service.mounts) args.push('--mount', `type=bind,source=${mount.host},target=${mount.container}${mount.readOnly ? ',readonly' : ''}`);
  for (const port of [...service.ports, ...extraPorts]) args.push('-p', `${LOOPBACK}::${port}`);
  args.push(service.image, ...service.command);
  io.docker(args, { timeoutMs: DOCKER_TIMEOUT_MS });
};

const call = async (io, method, url, body) => {
  const response = await io.fetch(url, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!response.ok) throw new TestStackError(`toxiproxy ${method} ${url} answered ${response.status}`);
  return response;
};

/**
 * Brings the stack up under `project` (or attaches to the one that already answers) and answers its state document.
 * `started` is true only when THIS call created the containers: the world tears down only a stack it started.
 */
export async function up({ root, environment = DEFAULT_ENVIRONMENT, project = projectNameOf(root), io = defaultIo() }) {
  const stack = readStack({ root, environment });
  if (!stack) throw new TestStackError(`no stack for environment ${environment}: .starcistacks/application-stacks.yaml declares none`);
  if (!stack.proxy) throw new TestStackError(`the ${environment} stack declares no toxiproxy service; add one (its image is ghcr.io/shopify/toxiproxy) so the world can inject failures`);
  const services = stack.services.filter(service => service.runs && service.kind !== 'proxy');
  if (services.length === 0) throw new TestStackError(`the ${environment} stack declares no service the test world runs`);

  const present = containersOf(io, project);
  const expected = [...services.map(service => service.name), stack.proxy.name];
  const warm = expected.every(name => present.some(container => container.service === name && container.running));
  if (warm) {
    try {
      const state = describe({ io, project, stack, services });
      const answering = await Promise.all(services.map(service => untilAnswers({ io, deadlineMs: ATTACH_DEADLINE_MS, check: () => answers({ io, project, service, ports: state.services[service.name].ports }) })));
      if (answering.every(Boolean)) {
        await call(io, 'POST', `${state.toxiproxy.apiUrl}/reset`);
        io.log(`attached to the running ${project}`);
        return { ...state, started: false };
      }
    } catch { /* a stack that cannot be read is replaced below */ }
  }

  down({ project, io });
  io.log(`starting ${project}: ${services.map(service => `${service.name} (${service.image})`).join(', ')}`);
  io.docker(['network', 'create', '--label', `${LABEL}=${project}`, project]);
  const plan = proxyPlanOf(services);
  try {
    for (const service of services) startService({ io, project, service });
    startService({ io, project, service: stack.proxy, extraPorts: plan.map(entry => entry.listen), labels: { [PROXIES_LABEL]: JSON.stringify(plan) } });
    const state = describe({ io, project, stack, services });
    const proxyReady = await untilAnswers({ io, deadlineMs: READY_DEADLINE_MS, check: () => answers({ io, project, service: stack.proxy, ports: [{ containerPort: stack.proxy.ports[0], direct: Number(new URL(state.toxiproxy.apiUrl).port) }] }) });
    if (!proxyReady) throw new TestStackError(`${stack.proxy.name} did not answer within ${READY_DEADLINE_MS / 1000}s`);
    for (const service of services) {
      const ready = await untilAnswers({ io, deadlineMs: READY_DEADLINE_MS, check: () => answers({ io, project, service, ports: state.services[service.name].ports }) });
      if (!ready) throw new TestStackError(`${service.name} (${service.image}) did not answer within ${READY_DEADLINE_MS / 1000}s`);
    }
    for (const entry of plan) {
      await call(io, 'POST', `${state.toxiproxy.apiUrl}/proxies`, { name: entry.name, listen: `0.0.0.0:${entry.listen}`, upstream: `${entry.service}:${entry.containerPort}`, enabled: true });
    }
    return { ...state, started: true };
  } catch (error) {
    down({ project, io });
    throw error;
  }
}

/** The command line of `hfs test-stack <up|down>`: answers the exit code; `up` prints the state document on stdout. */
export async function main({ action, root, environment, project, stdout = text => process.stdout.write(text), io = defaultIo() }) {
  if (action === 'up') {
    stdout(`${JSON.stringify(await up({ root, environment, project, io }), null, 2)}
`);
    return 0;
  }
  if (action === 'down') {
    const result = down({ project: project ?? projectNameOf(root), io });
    io.log(`removed ${result.removed.length} container${result.removed.length === 1 ? '' : 's'} of ${result.project}`);
    return 0;
  }
  throw new TestStackError('hfs test-stack takes up or down');
}
