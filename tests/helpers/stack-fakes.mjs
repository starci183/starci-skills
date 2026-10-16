// stack-fakes.mjs - the in-memory docker, sops and clock the stack verb specs share (packages/hfs/stack/**).
//   const host = fakeHost();                      // { state, spawn, calls, sleep, now, ctx(extra) }
//   host.state.services.set('app_api', { replicas: 2, image: '...' })
// Docker commands are answered exactly as the stack modules issue them (the shapes of nivo's proven tools). A spec that needs different
// behaviour passes `overrides`: { 'service inspect': (args, call, host) => result } keyed by the first two docker arguments, or
// { ssh: (args, call, host) => result } for the ssh fake. Commands the fake does not know FAIL LOUDLY so a spec never passes by accident.
import { parseYaml, stringifyYaml } from '../../packages/hfs/runtime/engine/yaml.mjs';

const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' });
const bad = (stderr, status = 1) => ({ status, stdout: '', stderr });
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Deep merge as `docker stack config -c a -c b` does for the shapes the stack tools use: mappings merge, lists concatenate, scalars replace. */
export function mergeCompose(base, extra) {
  if (Array.isArray(base) && Array.isArray(extra)) return [...base, ...extra];
  if (isObject(base) && isObject(extra)) {
    const out = { ...base };
    for (const [key, value] of Object.entries(extra)) out[key] = key in base ? mergeCompose(base[key], value) : value;
    return out;
  }
  return extra;
}

/** Compose interpolation: ${VAR}, ${VAR:-default}, ${VAR:?message}; `$$` is a literal dollar. */
export function interpolate(text, env) {
  const filled = text.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?:(:-|:\?)([^}]*))?\}/gu, (_, name, operator, argument) => {
    const value = env[name];
    if (value !== undefined && value !== '') return value;
    if (operator === ':?') throw new Error(argument || `${name} is required`);
    return operator === ':-' ? argument : '';
  });
  return filled.replaceAll('$$', '$');
}

function stackConfig(args, env, fileReader) {
  const files = args.flatMap((arg, index) => (args[index - 1] === '-c' ? [arg] : []));
  if (files.length === 0) return bad('stack config needs -c <file>');
  try {
    let merged = {};
    for (const file of files) merged = mergeCompose(merged, parseYaml(interpolate(fileReader(file), env)));
    return ok(stringifyYaml(merged));
  } catch (error) {
    return bad(`failed to load the compose file: ${error.message}`);
  }
}

const flagValue = (args, flag) => args[args.indexOf(flag) + 1];
const labelsOf = (args) => args.flatMap((arg, index) => (args[index - 1] === '--label' ? [arg] : []));

function createObject(kind, args, call, state) {
  const dashAt = args.lastIndexOf('-');
  const name = args[dashAt - 1];
  const store = state[`${kind}s`];
  if (store.has(name)) return bad(`Error response from daemon: rpc error: code = AlreadyExists desc = ${kind} ${name} already exists`);
  store.set(name, { labels: labelsOf(args), value: call.input ?? '' });
  state.created.push({ kind, name });
  return ok(`${name}\n`);
}

function listObjects(kind, args, state) {
  const wanted = args.flatMap((arg, index) => (args[index - 1] === '--filter' && arg.startsWith('label=') ? [arg.slice(6)] : []));
  const names = [...state[`${kind}s`]].filter(([, entry]) => wanted.every((label) => entry.labels.includes(label))).map(([name]) => name);
  return ok(names.map((name) => `${name}\n`).join(''));
}

function removeObject(kind, args, state) {
  const name = args[2];
  if (state.busy.has(name)) return bad(`Error response from daemon: ${kind} ${name} is in use by service`);
  state[`${kind}s`].delete(name);
  state.removed.push({ kind, name });
  return ok(`${name}\n`);
}

/** The id the fake gives a network: `net-<name>`. */
export const networkIdOf = (name) => `net-${name}`;

function serviceInspect(name, state) {
  const service = state.services.get(name);
  if (!service) return bad(`Error: no such service: ${name}`);
  const networks = service.networks ? { Networks: service.networks.map((entry) => ({ Target: networkIdOf(entry.network), Aliases: entry.aliases })) } : {};
  const template = service.template || service.networks ? { TaskTemplate: { ...service.template, ...networks } } : {};
  const spec = { Name: name, Spec: { Mode: { Replicated: { Replicas: service.replicas } }, ...template }, UpdateStatus: service.update };
  return ok(`${JSON.stringify(spec)}\n`);
}

function servicePs(name, state) {
  const tasks = state.tasks.filter((task) => task.service === name);
  return ok(tasks.map((task) => `${task.id}\n`).join(''));
}

function taskInspect(args, state) {
  const ids = args.slice(args.indexOf('--format') + 2);
  const rows = ids.map((id) => state.tasks.find((task) => task.id === id)).filter(Boolean);
  // A task may carry its spec (an object, or `rawSpec` for a broken text); the spec follows the error after a tab, as in the real format.
  const specOf = (task) => {
    if (task.rawSpec !== undefined) return `\t${task.rawSpec}`;
    return task.spec === undefined ? '' : `\t${JSON.stringify(task.spec)}`;
  };
  return ok(rows.map((task) => `${task.desired}|${task.state}|${task.timestamp}|${task.error ?? ''}${specOf(task)}\n`).join(''));
}

/**
 * What `docker stack deploy` attaches to the service on each external network: the declared aliases AND the compose service name, which docker adds
 * as an implicit alias to every network the service joins (the incident: `api` on the shared edge). null when the service joins no external network.
 */
function edgeNetworks(service, spec, model) {
  const list = Array.isArray(spec.networks) ? Object.fromEntries(spec.networks.map((key) => [key, null])) : spec.networks ?? {};
  const entries = Object.entries(list).filter(([key]) => model.networks?.[key]?.external === true).map(([key, attachment]) => ({ network: model.networks[key].name ?? key, aliases: [...(attachment?.aliases ?? []), service] }));
  return entries.length === 0 ? undefined : entries;
}

function networkInspect(args, state) {
  const name = args[2];
  const network = state.networks.get(name);
  if (!network) return bad(`Error: No such network: ${name}`);
  if (args.at(-1) === '{{.Id}}') return ok(`${networkIdOf(name)}
`);
  return ok(`${JSON.stringify({ Name: name, Id: networkIdOf(name), Containers: Object.fromEntries(network.containers.map((container, index) => [`c${index}`, { Name: container }])), Services: Object.fromEntries(network.services.map((service) => [service, {}])) })}
`);
}

/** `docker service update` for the network flags the edge reconcile issues. */
function serviceUpdate(args, state) {
  const name = args.at(-1);
  const service = state.services.get(name);
  if (!service) return bad(`Error: no such service: ${name}`);
  state.updates.push(args.slice(2));
  const valueOf = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
  const removed = valueOf('--network-rm');
  const added = valueOf('--network-add');
  if (removed) service.networks = (service.networks ?? []).filter((entry) => entry.network !== removed);
  if (added) {
    const [head, ...rest] = added.split(',');
    const network = head.slice(5);
    if (!(service.networks ?? []).some((entry) => entry.network === network)) service.networks = [...(service.networks ?? []), { network, aliases: rest.map((item) => item.slice(6)) }];
  }
  return ok(`${name}
`);
}

function stackDeploy(args, call, state, fileReader) {
  const file = flagValue(args, '-c');
  const stack = args.at(-1);
  let model;
  try { model = parseYaml(fileReader(file)); } catch (error) { return bad(`stack deploy: ${error.message}`); }
  state.deployed.push({ stack, file, model });
  for (const [service, spec] of Object.entries(model?.services ?? {})) {
    const name = `${stack}_${service}`;
    const replicas = spec.deploy?.replicas ?? 1;
    state.services.set(name, { replicas, image: spec.image, update: state.deployUpdate(name, spec), spec, networks: edgeNetworks(service, spec, model) });
    state.tasks = state.tasks.filter((task) => task.service !== name);
    for (let index = 0; index < replicas; index += 1) state.tasks.push({ id: `${name}.${index + 1}`, service: name, desired: 'running', state: 'running', timestamp: new Date(call.at).toISOString(), error: '' });
  }
  return ok('Updating service\n');
}

function dockerInfo(args, state) {
  const format = args[args.indexOf('--format') + 1];
  if (format === '{{.Swarm.LocalNodeState}} {{.Swarm.ControlAvailable}}') return ok(`${state.swarm.state} ${state.swarm.manager}\n`);
  if (format === '{{.OSType}}/{{.Architecture}}') return ok(`${state.platform}\n`);
  if (format === '{{.LiveRestoreEnabled}}') return ok(`${state.liveRestore}
`);
  if (format === '{{.ServerVersion}}') return ok(`${state.version}
`);
  return bad(`unknown docker info format ${format}`);
}

function swarmInit(args, state) {
  if (state.swarm.state === 'active') return bad('Error response from daemon: This node is already part of a swarm');
  state.swarm = { state: 'active', manager: true };
  state.inits.push(args.slice(2));
  return ok('Swarm initialized\n');
}

function volume(args, state) {
  const name = args[2];
  if (args[1] === 'inspect') return state.volumes.has(name) ? ok(`[{"Name":"${name}"}]\n`) : bad(`Error: No such volume: ${name}`);
  state.volumes.add(name);
  return ok(`${name}\n`);
}

function execInTask(args, state) {
  const [, task, ...command] = args;
  const known = state.tasks.some((entry) => entry.id === task || entry.container === task);
  if (!known && !state.containers.has(task)) return bad(`Error: No such container: ${task}`);
  return state.exec(command, task);
}

function containerList(args, state) {
  const service = args.flatMap((arg, index) => (args[index - 1] === '--filter' && arg.startsWith('label=com.docker.swarm.service.name=') ? [arg.slice(36)] : []))[0];
  const running = state.tasks.filter((task) => task.service === service && task.state === 'running');
  return ok(running.map((task) => `${task.container ?? task.id}\n`).join(''));
}

/** The docker command table. Keys are `<noun> <verb>` (first two arguments). */
function dockerTable(host) {
  const { state, fileReader } = host;
  return {
    'info --format': (args) => dockerInfo(args, state),
    'version --format': () => ok(`${state.version}\n`),
    'volume inspect': (args) => volume(args, state),
    'volume create': (args) => volume(args, state),
    'secret ls': (args) => listObjects('secret', args, state),
    'config ls': (args) => listObjects('config', args, state),
    'secret create': (args, call) => createObject('secret', args, call, state),
    'config create': (args, call) => createObject('config', args, call, state),
    'secret rm': (args) => removeObject('secret', args, state),
    'config rm': (args) => removeObject('config', args, state),
    'stack config': (args, call) => stackConfig(args, call.env ?? {}, fileReader),
    'stack deploy': (args, call) => stackDeploy(args, call, state, fileReader),
    'service ls': () => ok([...state.services.keys()].map((name) => `${name}\n`).join('')),
    'service inspect': (args) => serviceInspect(args[2], state),
    'service update': (args) => serviceUpdate(args, state),
    'network inspect': (args) => networkInspect(args, state),
    'service ps': (args) => servicePs(args[2], state),
    'inspect --type': (args) => taskInspect(args, state),
    'node ls': () => ok(Array.from({ length: state.nodes }, (_, index) => `node${index + 1}\n`).join('')),
    'swarm init': (args) => swarmInit(args, state),
    'pull --quiet': (args) => { state.pulled.push(args[2]); return ok(); },
    'image prune': () => ok(),
    'ps -q': (args) => containerList(args, state),
    exec: (args) => execInTask(args, state),
  };
}

/** A new fake host. `files` lets a spec serve stack files from memory; by default the real file system is read. */
export function fakeHost({ overrides = {}, fileReader, clock = 1_800_000_000_000 } = {}) {
  const state = {
    swarm: { state: 'active', manager: true },
    platform: 'linux/x86_64',
    version: '29.8.2',
    nodes: 1,
    liveRestore: false,
    volumes: new Set(),
    secrets: new Map(),
    configs: new Map(),
    services: new Map(),
    networks: new Map(),
    updates: [],
    tasks: [],
    containers: new Set(),
    busy: new Set(),
    pulled: [],
    deployed: [],
    created: [],
    removed: [],
    inits: [],
    time: clock,
    deployUpdate: () => ({ State: 'completed', StartedAt: new Date(clock).toISOString(), Message: 'update completed' }),
    exec: () => bad('exec: no handler'),
  };
  const calls = [];
  const host = { state, calls, fileReader: fileReader ?? (() => { throw new Error('no fileReader'); }) };
  const table = { ...dockerTable(host), ...overrides.docker };
  host.sleep = async (ms) => { state.time += ms; };
  host.now = () => state.time;
  host.spawn = (command, args, options = {}) => {
    const call = { command, args, input: options.input, env: options.env, cwd: options.cwd, at: state.time };
    calls.push(call);
    if (command === 'docker') {
      const key = [args[0], args[1]].join(' ');
      const handler = table[key] ?? table[args[0]];
      return handler ? handler(args, call, host) : bad(`fake docker: unknown command ${key}`, 127);
    }
    if (command === 'ssh' && overrides.ssh) return overrides.ssh(args, call, host);
    if (command === 'icacls' && overrides.icacls) return overrides.icacls(args, call, host);
    return bad(`fake host: unknown tool ${command}`, 127);
  };
  host.ctx = (extra = {}) => ({
    cwd: process.cwd(), env: {}, platform: 'linux', username: 'operator', spawn: host.spawn, sleep: host.sleep, now: host.now,
    stdout: () => {}, stderr: () => {}, sops: undefined, ...extra,
  });
  return host;
}

/** A sops seam over in-memory members: decrypt(file) reads `<slug>.enc`; binary members are plain text. Values never leave memory. */
export function fakeSops({ members = {}, binary = {} } = {}) {
  const slug = (file) => String(file).replace(/\\/gu, '/').split('/').pop().replace(/\.enc$/u, '');
  return {
    decrypt(file) {
      const map = members[slug(file)];
      if (!map) throw new Error(`sops could not decrypt ${slug(file)}.enc`);
      return { ...map };
    },
    decryptBinary(file) {
      const body = binary[slug(file)];
      if (body === undefined) throw new Error(`sops could not decrypt ${slug(file)}.enc`);
      return body;
    },
  };
}
