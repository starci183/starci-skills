// stack-swarm-fakes.mjs - helpers of worker B's specs (converge, verify, prune, release-store, deploy), on top of tests/helpers/stack-fakes.mjs.
//   testConfig(extra)        a normalised deploy config as stack-deploy-config.mjs returns it (neutral names)
//   seedService(host, ...)   a service with running / failed tasks in the docker shim
//   psRunning                a corrected `ps -q` override (see its comment)
//   globalInspect            a `service inspect` override for a global service (no Replicated mode)
//   releaseSsh(options)      an ssh runner that understands exactly the remote commands release-store.mjs composes, backed by a temp directory
//   fakeFetch(routes)        a ctx.fetch over canned answers
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const testConfig = (extra = {}) => ({
  env: 'production', project: 'app', stack: 'app', remote: { host: 'vps', releasesBase: null, sealed: null },
  images: {}, volumes: [], secrets: { grants: [], settings: null }, environment: {}, configs: [], passEnv: [],
  verify: { http: [], exec: [] }, jobs: null, backup: null, ...extra,
});

/** Seeds `<stack>_<name>` with `replicas` desired and `running` running tasks; `extra` tasks and `update` status are added as given. */
export function seedService(host, name, { replicas = 1, running = replicas, update, tasks = [], template } = {}) {
  host.state.services.set(name, { replicas, image: 'img', update, template });
  host.state.tasks = host.state.tasks.filter((task) => task.service !== name);
  const stamp = new Date(host.state.time).toISOString();
  for (let index = 0; index < running; index += 1) host.state.tasks.push({ id: `${name}.${index + 1}`, service: name, desired: 'running', state: 'running', timestamp: stamp, error: '' });
  for (const [index, task] of tasks.entries()) host.state.tasks.push({ id: `${name}.x${index}`, service: name, desired: 'shutdown', state: 'failed', timestamp: stamp, error: '', ...task });
}

/** `service inspect` of a global service: no Replicated block, so the desired count defaults to 1. */
export const globalInspect = (args, call, host) => {
  const service = host.state.services.get(args[2]);
  return { status: 0, stdout: `${JSON.stringify({ Name: args[2], Spec: { Mode: { Global: {} } }, UpdateStatus: service.update })}\n`, stderr: '' };
};

/**
 * `ps -q` override: stack-fakes.mjs slices the service label one character too far (37 instead of 36), so no service would match.
 * Lists the running tasks of the labelled service (container = task.container ?? task.id).
 */
export const psRunning = (args, call, host) => {
  const label = args.find((arg) => arg.startsWith('label=com.docker.swarm.service.name='));
  const service = label.slice('label=com.docker.swarm.service.name='.length);
  const running = host.state.tasks.filter((task) => task.service === service && task.state === 'running');
  return { status: 0, stdout: running.map((task) => `${task.container ?? task.id}
`).join(''), stderr: '' };
};

/** ctx.fetch over `routes`: { url: response | (init) => response }; a response is { status, body } (body a string or an object). */
export function fakeFetch(routes) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    const route = routes[url];
    if (route === undefined) throw new Error(`fake fetch: no route ${url}`);
    const answer = typeof route === 'function' ? route(init, calls.length) : route;
    if (answer instanceof Error) throw answer;
    const text = typeof answer.body === 'string' ? answer.body : JSON.stringify(answer.body ?? {});
    return { status: answer.status, text: async () => text };
  };
  return { fetch, calls };
}

const q = (text) => text.replaceAll(/[.*+?^${}()|[\]\\/]/gu, String.raw`\$&`);
const OK = (stdout = '') => ({ status: 0, stdout, stderr: '' });
const NO = (stderr, status = 1) => ({ status, stdout: '', stderr });

/**
 * The remote side of the release store: files live in a temp directory, pointers and modes in memory. Unknown commands fail loudly.
 *   const remote = releaseSsh({ base: '/srv/app' });  remote.ssh(command, { input })  remote.calls  remote.dispose()
 */
export function releaseSsh({ base = '/srv/app' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-remote-'));
  const links = new Map();
  const modes = new Map();
  const order = [];
  const calls = [];
  const real = (remote) => path.join(root, remote);
  const table = [];
  const on = (pattern, handler) => { table.push([new RegExp(`^${pattern}$`, 'u'), handler]); };

  on(String.raw`set -e; d="(${q(base)}/releases/[0-9a-f]{16})"; if \[ -d "\$d" \]; then chmod -R u\+w "\$d"; else mkdir -p "\$d"; fi`, ([, dir]) => {
    if (fs.existsSync(real(dir))) for (const name of fs.readdirSync(real(dir))) modes.set(`${dir}/${name}`, '640');
    modes.set(dir, '750');
    fs.mkdirSync(real(dir), { recursive: true });
    const id = dir.split('/').pop();
    if (!order.includes(id)) order.unshift(id);
    return OK();
  });
  on(String.raw`set -e; d="(${q(base)}/releases/[0-9a-f]{16})"; cat > "\$d/(stack\.yaml|release\.json)"`, ([, dir, name], input) => {
    if (modes.get(dir) === '550' || modes.get(`${dir}/${name}`) === '440') return NO(`cat: ${name}: Permission denied`);
    fs.writeFileSync(real(`${dir}/${name}`), input);
    return OK();
  });
  on(String.raw`set -e; d="(${q(base)}/releases/[0-9a-f]{16})"; chmod 440 "\$d/stack\.yaml" "\$d/release\.json"; chmod 550 "\$d"`, ([, dir]) => {
    modes.set(`${dir}/stack.yaml`, '440');
    modes.set(`${dir}/release.json`, '440');
    modes.set(dir, '550');
    return OK();
  });
  on(String.raw`set -e; cd "${q(base)}"; test -d "releases/([0-9a-f]{16})"; if .*; ln -sfn "releases/\1" current\.new; mv -Tf current\.new current`, ([, id]) => {
    if (!fs.existsSync(real(`${base}/releases/${id}`))) return NO('', 1);
    const current = links.get('current');
    if (current && current.split('/').pop() !== id) links.set('previous', current);
    links.set('current', `releases/${id}`);
    return OK();
  });
  on(String.raw`cd "${q(base)}" 2>/dev/null && \[ -L (current|previous) \] && basename "\$\(readlink \1\)" \|\| true`, ([, name]) => {
    const target = links.get(name);
    return OK(target ? `${target.split('/').pop()}\n` : '');
  });
  on(String.raw`cat "(${q(base)}/releases/[0-9a-f]{16})/(stack\.yaml|release\.json)"`, ([, dir, name]) => {
    const file = real(`${dir}/${name}`);
    return fs.existsSync(file) ? OK(fs.readFileSync(file, 'utf8')) : NO(`cat: ${dir}/${name}: No such file or directory`);
  });
  on(String.raw`cd "${q(base)}/releases" 2>/dev/null && ls -1t \|\| true`, () => OK(order.map((id) => `${id}\n`).join('')));

  const ssh = async (command, { input } = {}) => {
    calls.push({ command, input });
    for (const [pattern, handler] of table) {
      const match = pattern.exec(command);
      if (match) return handler(match, input);
    }
    return NO(`fake ssh: unknown command ${command}`, 127);
  };
  return { ssh, calls, links, modes, root, real, dispose: () => fs.rmSync(root, { recursive: true, force: true }) };
}
