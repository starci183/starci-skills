// ingress-create.mjs - `starci app stack ingress create`: deploys the SHARED ingress as its own swarm stack with ZERO replicas, so the service exists
// (rehearse and takeover need it) while nothing binds a port and the live edge is untouched. The stack is rendered from the deploy block:
// the pinned image, the whole legacy dynamic directory bind-mounted read-only, the persisted certificates volume, the attachable overlay (external),
// host-mode 80/443 (they bind only when a task starts) and no ACME email. The static arguments are the declared `ingress.args` or, byte for byte, the
// ones the live edge container runs with (read-only inspect), so the new proxy behaves exactly like the old one. It refuses to start a task.
import { refusal } from './errors.mjs';
import { remoteDocker, shellQuote } from './remote.mjs';

const ACME_EMAIL = /acme\.email=(.+)$/iu;
const SERVICE_NETWORK = 'edge';

const parse = (text) => { try { return JSON.parse(text); } catch { return null; } };
const asArray = (value) => (Array.isArray(value) ? value : []);

/** The static arguments and the two mount targets of the live edge container (inspect formats read Args and Mounts only, never the environment). */
function readLegacy(run, ingress) {
  const container = ingress.legacy.container;
  const args = parse(remoteDocker(run, ['inspect', '--format', '{{json .Args}}', container]).stdout);
  const mounts = asArray(parse(remoteDocker(run, ['inspect', '--format', '{{json .Mounts}}', container]).stdout));
  const target = (match) => mounts.find(match)?.Destination;
  return {
    args: ingress.args ?? asArray(args).filter((arg) => typeof arg === 'string'),
    dynamicTarget: target((mount) => mount.Source === ingress.legacy.dynamicDir),
    acmeTarget: target((mount) => mount.Name === ingress.acmeVolume),
  };
}

/** The stack model (compose spec as JSON, which is valid YAML). */
function stackModel(ingress, { args, dynamicTarget, acmeTarget }) {
  const ports = [80, 443].map((port) => ({ target: port, published: port, protocol: 'tcp', mode: 'host' }));
  return {
    services: {
      [ingress.service]: {
        image: ingress.image,
        command: args,
        ports,
        volumes: [
          { type: 'bind', source: ingress.legacy.dynamicDir, target: dynamicTarget, read_only: true },
          { type: 'volume', source: 'acme', target: acmeTarget },
        ],
        networks: [SERVICE_NETWORK],
        logging: { driver: 'json-file', options: { 'max-size': '10m', 'max-file': '5' } },
        deploy: {
          replicas: 0,
          placement: { constraints: ['node.role == manager'] },
          update_config: { order: 'stop-first', failure_action: 'rollback' },
          restart_policy: { condition: 'any' },
        },
      },
    },
    networks: { [SERVICE_NETWORK]: { external: true, name: ingress.network } },
    volumes: { acme: { external: true, name: ingress.acmeVolume } },
  };
}

/** The guard that no task can start from this model. */
function refuseRunning(model) {
  for (const [name, service] of Object.entries(model.services)) {
    if (service.deploy?.replicas !== 0) throw refusal('STACK_INGRESS_WOULD_START', `the ingress service ${name} would start a task; create deploys it with replicas 0 only`);
  }
}

function emailProblem(args) {
  const configured = args.map((arg) => ACME_EMAIL.exec(arg)).find((match) => match !== null);
  return configured ? 'the arguments set an ACME email; a new email registers a new ACME account: leave it unset at takeover' : null;
}

const swarmActive = (run) => remoteDocker(run, ['info', '--format', '{{.Swarm.LocalNodeState}} {{.Swarm.ControlAvailable}}']).stdout.trim() === 'active true';
const overlayAttachable = (run, network) => remoteDocker(run, ['network', 'inspect', '--format', '{{.Driver}} {{.Attachable}}', network]).stdout.trim() === 'overlay true';
const volumePresent = (run, volume) => remoteDocker(run, ['volume', 'inspect', volume]).status === 0;

/** Replica state of the service: { exists, desired }. */
function serviceState(run, name) {
  const listed = remoteDocker(run, ['service', 'ls', '--filter', `name=${name}`, '--format', '{{.Name}} {{.Replicas}}']);
  const row = String(listed.stdout).split('\n').map((line) => line.trim().split(' ')).find(([found]) => found === name);
  if (listed.status !== 0 || !row) return { exists: false, desired: 0 };
  return { exists: true, desired: Number(String(row[1]).split('/')[1]) };
}

function checks(run, ingress, legacy, service) {
  const directory = run(`test -d ${shellQuote(ingress.legacy.dynamicDir)}`).status === 0;
  return [
    ['an image is declared (deploy.ingress.image, pinned by digest)', typeof ingress.image === 'string', 'declare deploy.ingress.image'],
    ['static arguments known (declared, or read from the live edge)', legacy.args.length > 0, `cannot read the arguments of ${ingress.legacy.container}`],
    ['no ACME email configured', emailProblem(legacy.args) === null, emailProblem(legacy.args)],
    ['dynamic directory and certificates mounts found on the live edge', typeof legacy.dynamicTarget === 'string' && typeof legacy.acmeTarget === 'string', 'the live edge container does not mount the dynamic directory and the certificates volume'],
    ['swarm active (manager)', swarmActive(run), 'this host is not an active swarm manager'],
    [`network ${ingress.network} is an attachable overlay`, overlayAttachable(run, ingress.network), 'run "starci app stack ingress attach --execute" first'],
    [`certificates volume ${ingress.acmeVolume} present`, volumePresent(run, ingress.acmeVolume), 'the persisted certificates volume is missing'],
    [`dynamic directory ${ingress.legacy.dynamicDir} present`, directory, 'the dynamic directory is missing'],
    [`service ${ingress.name}_${ingress.service} is not running a task`, service.desired === 0, `it already runs ${service.desired} replica(s): use takeover or scale it by hand`],
  ].map(([name, ok, detail]) => ({ name, ok, detail }));
}

/** `ingress create`: dry run unless execute. Returns { ok, lines, data }. */
export function createIngress(run, ingress, execute) {
  const legacy = readLegacy(run, ingress);
  const stack = `${ingress.name}_${ingress.service}`;
  const results = checks(run, ingress, legacy, serviceState(run, stack));
  const lines = results.map((item) => (item.ok ? `precondition ok: ${item.name}` : `precondition FAILED: ${item.name} (${item.detail})`));
  if (results.some((item) => !item.ok)) return { ok: false, lines: [...lines, 'create refused: nothing was changed'], data: { steps: [] } };
  const model = stackModel(ingress, legacy);
  refuseRunning(model);
  const summary = `stack ${ingress.name}: service ${ingress.service} image ${ingress.image}, ${legacy.args.length} static argument(s), host-mode 80/443, replicas 0`;
  if (!execute) return { ok: true, lines: [...lines, `dry run: would deploy ${summary}`], data: { steps: [] } };
  const deployed = run(['docker', ...['stack', 'deploy', '--detach=true', '-c', '-', ingress.name].map(shellQuote)].join(' '), { input: JSON.stringify(model) });
  if (deployed.status !== 0) return { ok: false, lines: [...lines, `docker stack deploy failed: ${String(deployed.stderr).trim().split('\n')[0]}`], data: { steps: [{ step: 'deploy', ok: false }] } };
  const tasks = remoteDocker(run, ['service', 'ps', stack, '--filter', 'desired-state=running', '-q']).stdout.trim();
  if (tasks !== '') {
    remoteDocker(run, ['service', 'scale', `${stack}=0`]);
    return { ok: false, lines: [...lines, 'REFUSED: a task of the ingress service started; it was scaled back to 0'], data: { steps: [{ step: 'deploy', ok: true }, { step: 'no-task', ok: false }] } };
  }
  return { ok: true, lines: [...lines, `deployed ${summary}; no task runs and no port is bound`], data: { steps: [{ step: 'deploy', ok: true }, { step: 'no-task', ok: true }] } };
}
