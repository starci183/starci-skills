// stack-ingress-fakes.mjs - a strict in-memory VPS for the ingress specs: ONE ssh function that answers by command content (docker, curl,
// openssl, bash scripts) and throws on any command it does not know, so a spec can never pass by accident.
//   const vps = makeVps(overrides);   vps.run (the ssh runner), vps.state, vps.calls (every command), vps.ctx (now/sleep seams)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalizeIngress } from '../../scripts/hfs/stack-ingress-config.mjs';

export const RECIPIENT = `age1${'q'.repeat(58)}`;
export const DYNAMIC = '/srv/deploy/app-edge/dynamic';
export const HELPER_IMAGE = `registry.example/helper@sha256:${'a'.repeat(64)}`;
export const REHEARSAL_HTTPS = 18443;
export const SECRET_TOKENS = ['SECRETTOKEN-1', 'userinfo-secret'];

const json = (value) => JSON.stringify(value);
const rule = (...hosts) => hosts.map((host) => `Host(\`${host}\`)`).join(' || ');
const cert = (host) => `serial=AA${host.length}\nsubject=CN=${host}`;
export const table = (hosts) => Object.fromEntries(hosts.map(([host, code]) => [host, { code, cert: cert(host) }]));

export const LIVE_HOSTS = [['api.tenant.example', 200], ['tool.example', 200], ['www.tenant.example', 301], ['x.example', 200]];

/** The files of the old edge dynamic directory (JSON is valid YAML). Route files carry tokens that must never be echoed. */
export function liveFiles() {
  return {
    'routes.yml': json({
      http: {
        routers: {
          api: { rule: rule('api.tenant.example'), service: 'api', middlewares: ['secure'] },
          tool: { rule: rule('TOOL.example'), service: 'tool@file' },
          www: { rule: rule('www.tenant.example'), service: 'api' },
          wild: { rule: 'HostRegexp(`^.+\\.x\\.example$`)', service: 'ghost' },
        },
        services: {
          api: { loadBalancer: { servers: [{ url: 'http://user:userinfo-secret@tenant-api:3000/path' }, { url: 'not a url' }] } },
          tool: { loadBalancer: { servers: [{ url: 'http://172.29.0.1:5678' }] } },
        },
        middlewares: { secure: { headers: { customRequestHeaders: { 'X-Token': 'SECRETTOKEN-1' } } } },
      },
    }),
    'old.yml': json({ http: { routers: { old: { rule: rule('old.example'), service: 'nowhere' } } } }),
  };
}

export const OWN_ROUTES = { http: { routers: { wild: { rule: 'HostRegexp(`^.+\\.x\\.example$`)', service: 'w' } }, middlewares: { secure: {} } } };

export function ingressBlock(extra = {}) {
  return {
    name: 'edge',
    network: 'edge-shared',
    acmeVolume: 'edge_acme',
    legacy: { dir: '/srv/deploy/app-edge', dynamicDir: DYNAMIC, container: 'app-edge-proxy' },
    upstreams: [
      { name: 'tenant-api', hosts: ['api.tenant.example'], container: 'tenant-api', port: 3000, aliases: ['tenant-api', 'tenant-api-b'], middlewares: ['secure'] },
      { name: 'tool', hosts: ['tool.example'], hostAddress: '172.29.0.1', port: 5678 },
    ],
    routes: 'edge/routes.yml',
    drop: ['old.example'],
    redirects: [{ host: 'www.tenant.example', to: 'tenant.example' }],
    backup: { dir: '/srv/deploy/backups' },
    ...extra,
  };
}

/** A temp app tree (.sops.yaml, edge/routes.yml) and the config object the module receives. Call cleanup() in after(). */
export function makeTree(blockExtra = {}, { recipient = true, ownRoutes = OWN_ROUTES, helper = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-ingress-'));
  const envDir = path.join(root, '.starcistacks', 'production');
  fs.mkdirSync(path.join(envDir, 'edge'), { recursive: true });
  if (ownRoutes !== null) fs.writeFileSync(path.join(envDir, 'edge', 'routes.yml'), json(ownRoutes));
  if (recipient) fs.writeFileSync(path.join(root, '.sops.yaml'), json({ creation_rules: [{ age: RECIPIENT }] }));
  const probe = { exists: (rel) => fs.existsSync(path.join(envDir, rel)) };
  const normalised = normalizeIngress(ingressBlock(blockExtra), { probe });
  if (!normalised.ingress) throw new Error(`fixture invalid: ${json(normalised.problems)}`);
  const config = { stack: 'app', repoRoot: root, envDir, ingress: normalised.ingress, remote: { host: 'vps' }, backup: helper ? { image: HELPER_IMAGE } : null };
  return { root, config, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

const parseArgs = (command) => [...command.matchAll(/'((?:[^']|'\\'')*)'/gu)].map((match) => match[1].replaceAll(String.raw`'\''`, "'"));
const NETWORK_OUTPUT = { overlay: 'overlay true\n', bridge: 'bridge false\n' };
const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' });
const bad = (stderr = 'failed') => ({ status: 1, stdout: '', stderr });

/** The VPS. `state` is mutable between steps of a spec; `state.fail` is a Set of failure keys (see the handlers). */
export function makeVps(overrides = {}) {
  const state = {
    files: liveFiles(),
    dirError: false,
    containers: { 'tenant-api': { running: 'true', networks: ['bridge'] } },
    network: 'missing',
    volume: true,
    mountpoint: '/var/lib/docker/volumes/edge_acme/_data',
    swarm: 'active true',
    services: { edge_ingress: 0 },
    legacyRunning: true,
    legacyTable: table(LIVE_HOSTS),
    newTable: table(LIVE_HOSTS),
    bootSleeps: 0,
    startFailures: 0,
    tcpMs: 4000,
    fail: new Set(),
    afterStop: null,
    ingressSpec: {
      Image: 'proxy:1@sha256:abc',
      Args: ['--providers.file.directory=/etc/traefik/dynamic', '--certificatesResolvers.le.acme.httpChallenge.entryPoint=web', '--certificatesResolvers.le.acme.storage=/acme/acme.json', 7],
      Mounts: [{ Type: 'bind', Source: DYNAMIC, Target: '/etc/traefik/dynamic' }, { Type: 'volume', Source: 'edge_acme', Target: '/acme' }],
    },
    specRaw: null,
    rehearsal: { volume: false, service: false },
    rehearsalBoot: 0,
    rehearsalTable: table(LIVE_HOSTS),
    rehearsalLog: 'level=info msg="Configuration loaded"\n',
    taskLinger: 0,
    volumeRmFailures: 0,
    ...overrides,
  };
  const calls = [];
  const sleeps = [];
  const clock = { t: 1_700_000_000_000 };
  const rehearsalReady = () => state.rehearsal.service && sleeps.length >= state.rehearsalBoot;
  const serving = (port) => {
    if (Number(port) === REHEARSAL_HTTPS) return rehearsalReady() ? state.rehearsalTable : null;
    if (state.legacyRunning) return state.legacyTable;
    return state.services.edge_ingress >= 1 && sleeps.length >= state.bootSleeps ? state.newTable : null;
  };
  const inspectContainer = (name) => {
    const entry = state.containers[name];
    if (!entry) return bad('No such container');
    return ok(entry.raw ?? `${entry.running}|${json(Object.fromEntries(entry.networks.map((network) => [network, {}])))}`);
  };
  const networkCommands = {
    inspect: () => (state.network === 'missing' ? bad('no such network') : ok(NETWORK_OUTPUT[state.network])),
    create: () => {
      if (state.fail.has('network create')) return bad('create refused');
      state.network = 'overlay';
      return ok();
    },
    connect: (args) => {
      if (state.fail.has('network connect')) return bad('connect refused');
      state.containers[args.at(-1)].networks.push(args.at(-2));
      return ok();
    },
  };
  const volumeInspect = (args) => {
    if (args.at(-1) === 'edge_acme-rehearsal') return state.rehearsal.volume ? ok('[]') : bad('no such volume');
    if (!state.volume || (args.includes('--format') && state.fail.has('volume mountpoint'))) return bad('no such volume');
    return ok(args.includes('--format') ? `${state.mountpoint}
` : '[]');
  };
  const serviceLs = (args) => {
    const name = args.at(-3).replace('name=', '');
    if (state.fail.has('service ls')) return bad('swarm error');
    if (name === 'edge-rehearsal') return ok(state.rehearsal.service ? `edge-rehearsal ${Number(rehearsalReady())}/1\n` : '');
    return ok(Object.hasOwn(state.services, name) ? `${name} ${state.services[name]}/${state.services[name]}
` : '');
  };
  const serviceScale = (args) => {
    if (state.fail.has('scale0')) return bad('scale refused');
    const [name, count] = args[2].split('=');
    state.services[name] = Number(count);
    return ok();
  };
  const start = () => {
    if (state.startFailures > 0) { state.startFailures -= 1; return bad('port is already allocated'); }
    state.legacyRunning = true;
    return ok();
  };
  const serviceInspect = (args) => {
    const name = args.at(-1);
    if (name === 'edge-rehearsal') return state.rehearsal.service ? ok('{}') : bad('no such service');
    if (name !== 'edge_ingress' || state.fail.has('spec')) return bad('no such service');
    return ok(state.specRaw ?? json(state.ingressSpec));
  };
  const volumeCreate = () => {
    if (state.fail.has('volume create')) return bad('create refused');
    state.rehearsal.volume = true;
    return ok();
  };
  const volumeRm = () => {
    if (state.volumeRmFailures > 0 || state.fail.has('volume rm')) { state.volumeRmFailures -= 1; return bad('volume is in use'); }
    state.rehearsal.volume = false;
    return ok();
  };
  const serviceCreate = () => {
    if (state.fail.has('service create')) return bad('create refused');
    state.rehearsal.service = true;
    return ok();
  };
  const serviceRm = () => {
    if (state.fail.has('service rm')) return bad('rm refused');
    state.rehearsal.service = false;
    return ok();
  };
  const tasks = () => {
    if (state.fail.has('tasks stuck')) return ok('abc\n');
    if (state.taskLinger > 0) { state.taskLinger -= 1; return ok('abc\n'); }
    return ok('');
  };
  const dockerCommands = {
    'service inspect': serviceInspect,
    'volume create': volumeCreate,
    'volume rm': volumeRm,
    run: () => (state.fail.has('copy') ? bad('copy failed') : ok()),
    'service create': serviceCreate,
    'service rm': serviceRm,
    ps: tasks,
    'service logs': () => (state.fail.has('logs') ? bad('no logs') : ok(state.rehearsalLog)),
    inspect: (args) => inspectContainer(args.at(-1)),
    network: (args) => networkCommands[args[1]](args),
    'volume inspect': volumeInspect,
    info: () => ok(`${state.swarm}
`),
    'service ls': serviceLs,
    'service scale': serviceScale,
    start,
  };
  const docker = (args) => {
    const handler = dockerCommands[args.slice(0, 2).join(' ')] ?? dockerCommands[args[0]];
    if (!handler) throw new Error(`fake vps: unknown docker command ${args.join(' ')}`);
    return handler(args);
  };
  const curl = (command) => {
    const [host, port] = parseArgs(command)[4].split(':');
    const entry = serving(port)?.[host];
    return entry ? ok(String(entry.code)) : { status: 7, stdout: '000', stderr: 'connection refused' };
  };
  const openssl = (command) => {
    const host = /-servername[^a-z0-9]+([a-z0-9.-]+)/u.exec(command)[1];
    const port = /127\.0\.0\.1:(\d+)/u.exec(command)[1];
    const entry = serving(port)?.[host];
    return entry ? ok(`${entry.cert}\n`) : bad('no certificate');
  };
  const combined = (command) => {
    if (state.fail.has('stop')) return bad('stop refused');
    state.legacyRunning = false;
    state.afterStop?.(state);
    if (state.fail.has('scale1')) return bad('scale refused');
    state.services.edge_ingress = 1;
    return { ...ok(), command };
  };
  const script = (command) => {
    if (command.includes('openssl')) return openssl(command);
    if (command.includes('/dev/tcp/')) {
      clock.t += state.tcpMs;
      return state.fail.has('tcp') || state.services.edge_ingress < 1 ? bad('') : ok();
    }
    if (command.includes(' age ')) {
      const key = command.includes('dynamic-') ? 'age dynamic' : 'age acme';
      return state.fail.has(key) ? bad('sudo: a password is required') : ok();
    }
    throw new Error(`fake vps: unknown script ${command}`);
  };
  const run = (command) => {
    calls.push(command);
    if (command.startsWith(`cd '${DYNAMIC}' && for f in`)) {
      if (state.dirError) return bad('No such file or directory');
      return ok(Object.entries(state.files).map(([name, body]) => `#@@FILE ${name}\n${body}\n`).join(''));
    }
    if (command.startsWith("docker 'stop'")) return combined(command);
    if (command.startsWith('docker ')) return docker(parseArgs(command));
    if (command.startsWith('curl ')) return curl(command);
    if (command.startsWith('bash -c ')) return script(command);
    throw new Error(`fake vps: unknown command ${command}`);
  };
  const ctx = { now: () => clock.t, sleep: async (ms) => { sleeps.push(ms); } };
  const mutating = () => calls.filter((command) => /^docker '(stop|start|network' '(create|connect)|service' '(scale|update))/u.test(command) || command.includes(' age '));
  return { run, state, calls, sleeps, clock, ctx, mutating };
}
