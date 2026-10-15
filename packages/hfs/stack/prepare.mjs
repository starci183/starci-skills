// prepare.mjs - `starci app stack prepare` and `doctor`: read-only checks of the Swarm manager, plus (prepare, --execute) the missing external
// volumes and the ONE-TIME, owner-approved `docker swarm init`. Every docker call runs ON the manager through the ssh runner (remote.mjs), so the
// same code serves CI and the owner's machine. Lines are `ok    text` / `FAIL  text`; a failing check makes the result not ok but all checks run.
import { firstLine, lines as splitLines } from './context.mjs';
import { RELEASE_ID } from './digest.mjs';
import { approvalMissing, refusal } from './errors.mjs';
import { installAge } from './age-install.mjs';
import { checkLiveRestore, fixLiveRestore } from './live-restore.mjs';
import { remoteDocker, shellQuote, withRunner } from './remote.mjs';

const MIN_FREE_GB = 10;
const ADDRESS = /^[0-9a-zA-Z.:-]+$/u;
const SWARM_FORMAT = '{{.Swarm.LocalNodeState}} {{.Swarm.ControlAvailable}}';
const OK = 'ok    ';
const BAD = 'FAIL  ';

function newReport() {
  const entries = [];
  const add = (mark) => (text) => { entries.push({ mark, text }); };
  return {
    ok: add(OK),
    bad: add(BAD),
    note: add(''),
    failed: () => entries.some((entry) => entry.mark === BAD),
    lines: () => entries.map((entry) => `${entry.mark}${entry.text}`),
    checks: () => entries.filter((entry) => entry.mark !== '').map((entry) => ({ ok: entry.mark === OK, text: entry.text })),
  };
}

function swarmInfo(run) {
  const result = remoteDocker(run, ['info', '--format', SWARM_FORMAT]);
  const text = result.stdout.trim();
  return { reachable: result.status === 0, active: text === 'active true', state: text.split(' ')[0], manager: text.split(' ')[1] };
}

const dockerText = (run, args) => remoteDocker(run, args).stdout.trim();

function checkDaemon(run, report) {
  if (!swarmInfo(run).reachable) {
    report.bad('docker daemon not reachable');
    return false;
  }
  report.ok(`docker daemon reachable (${dockerText(run, ['version', '--format', '{{.Server.Version}}'])})`);
  return true;
}

function checkPlatform(run, report) {
  const platform = dockerText(run, ['info', '--format', '{{.OSType}}/{{.Architecture}}']);
  if (platform === 'linux/x86_64') report.ok('linux/x86_64');
  else report.bad(`unsupported platform ${platform}`);
}

function checkSwarm(run, report) {
  const info = swarmInfo(run);
  if (info.active) report.ok('swarm active, this node is a manager');
  else report.bad(`swarm is '${info.state}' (manager: ${info.manager}): the owner approves "starci app stack prepare --init-swarm --owner-approved --execute" once`);
}

function checkNodes(run, report) {
  const count = splitLines(remoteDocker(run, ['node', 'ls', '-q']).stdout).length;
  if (count <= 1) report.ok('single-manager swarm');
  else report.ok(`swarm has ${count} nodes: review quorum and placement before relying on it`);
}

const volumeExists = (run, volume) => remoteDocker(run, ['volume', 'inspect', volume]).status === 0;

function checkVolumes(run, report, config) {
  for (const volume of config.volumes) {
    if (volumeExists(run, volume)) report.ok(`volume ${volume}`);
    else report.bad(`volume ${volume} missing (prepare creates it)`);
  }
}

function checkDisk(run, report) {
  const result = run('target=/var/lib/docker; [ -d "$target" ] || target=/; echo "$target"; df -Pk "$target"');
  const [target, , row = ''] = splitLines(result.stdout);
  const availableKb = Number(row.trim().split(/\s+/u)[3]);
  if (result.status !== 0 || !Number.isFinite(availableKb)) {
    report.bad('disk: cannot read the free space');
    return;
  }
  const gigabytes = Math.floor(availableKb / 1_048_576);
  if (gigabytes >= MIN_FREE_GB) report.ok(`disk: ${gigabytes} GB free under ${target}`);
  else report.bad(`disk: only ${gigabytes} GB free under ${target}`);
}

const releasesBase = (config) => config.remote.releasesBase ?? `/srv/${config.stack}`;

function directoryState(run, config) {
  const quoted = shellQuote(releasesBase(config));
  return run(`if [ ! -d ${quoted} ]; then echo missing; elif [ ! -w ${quoted} ]; then echo readonly; else echo writable; fi`).stdout.trim();
}

function checkReleasesDirectory(run, report, config) {
  const base = releasesBase(config);
  const state = directoryState(run, config);
  if (state === 'writable') report.ok(`releases directory ${base} is writable`);
  else if (state === 'readonly') report.bad(`releases directory ${base} is not writable by the deploy user`);
  else report.bad(`releases directory ${base} is missing (create it once, owned by the deploy user)`);
}

/** The checks both verbs share; false when the daemon cannot be reached (nothing else can be judged). */
function baseChecks(run, report, config) {
  if (!checkDaemon(run, report)) return false;
  checkLiveRestore(run, report);
  checkPlatform(run, report);
  checkSwarm(run, report);
  checkNodes(run, report);
  checkVolumes(run, report, config);
  checkDisk(run, report);
  checkReleasesDirectory(run, report, config);
  return true;
}

function advertiseArguments(ctx) {
  const address = ctx.env.STARCI_ADVERTISE_ADDR;
  if (!address) return [];
  if (!ADDRESS.test(address)) throw refusal('STACK_SWARM_ADVERTISE_ADDR', `STARCI_ADVERTISE_ADDR must match ${ADDRESS}`);
  const listen = ctx.env.STARCI_SWARM_LISTEN_ADDR ?? '127.0.0.1:2377';
  if (!ADDRESS.test(listen)) throw refusal('STACK_SWARM_LISTEN_ADDR', `STARCI_SWARM_LISTEN_ADDR must match ${ADDRESS}`);
  // the control port stays on loopback unless the owner widens it: a single manager needs no inbound swarm port
  return ['--advertise-addr', address, '--listen-addr', listen];
}

function initSwarm(run, report, { execute, advertise }) {
  if (swarmInfo(run).active) {
    report.note('swarm already active: nothing to initialize (never re-initialized)');
    return false;
  }
  if (!execute) {
    report.note('dry run: would run docker swarm init (needs --execute and --owner-approved)');
    return false;
  }
  const result = remoteDocker(run, ['swarm', 'init', ...advertise]);
  if (result.status !== 0) {
    report.bad(`docker swarm init failed: ${firstLine(result.stderr)}`);
    return false;
  }
  report.note('SWARM INITIALIZED. Record the node id; back up /var/lib/docker/swarm (docker swarm unlock-key if autolock is enabled later).');
  return true;
}

function createVolumes(run, report, config, execute) {
  const created = [];
  for (const volume of config.volumes.filter((name) => !volumeExists(run, name))) {
    if (!execute) {
      report.note(`dry run: would create volume ${volume}`);
      continue;
    }
    const result = remoteDocker(run, ['volume', 'create', volume]);
    if (result.status === 0) {
      report.note(`created volume ${volume}`);
      created.push(volume);
    } else report.bad(`cannot create volume ${volume}: ${firstLine(result.stderr)}`);
  }
  return created;
}

/** Creates the releases directory and installs age (the backup encryptor) once, with passwordless sudo when the host allows it. */
function ensureTools(run, report, config) {
  const base = releasesBase(config);
  const quoted = shellQuote(base);
  if (directoryState(run, config) === 'missing') {
    const made = run(`sudo -n mkdir -p ${quoted} && sudo -n chown "$(id -un)" ${quoted}`);
    if (made.status === 0) report.note(`created ${base} owned by the deploy user`);
    else report.bad(`cannot create ${base}: ${firstLine(made.stderr)} (needs passwordless sudo once, or create it by hand)`);
  }
  installAge(run, report);
}

/** prepare: read-only checks; with execute also the missing volumes and (initSwarm, approved) the one-time swarm init. */
export async function prepareHost(ctx, config, { execute = false, initSwarm: wantInit = false, fixLiveRestore: wantFix = false, ownerApproved = false, sshCmd = null } = {}, deps = {}) {
  if (wantInit && execute && !ownerApproved && ctx.env.STARCI_SWARM_INIT_APPROVED !== '1') {
    throw approvalMissing('STACK_SWARM_INIT_UNAPPROVED', 'docker swarm init is an owner-approved effect; pass --owner-approved (or set STARCI_SWARM_INIT_APPROVED=1) after the owner said yes');
  }
  const advertise = wantInit ? advertiseArguments(ctx) : [];
  return withRunner(ctx, config, { sshCmd }, deps, async (run, notes) => {
    const report = newReport();
    notes.forEach(report.note);
    const data = { created: [], swarmInitialized: false };
    if (swarmInfo(run).reachable) {
      if (wantFix) data.liveRestore = await fixLiveRestore(ctx, run, report, { execute, ownerApproved, config });
      if (wantInit) data.swarmInitialized = initSwarm(run, report, { execute, advertise });
      data.created = createVolumes(run, report, config, execute);
      if (execute) ensureTools(run, report, config);
    }
    baseChecks(run, report, config);
    return { ok: !report.failed(), lines: report.lines(), data: { ...data, checks: report.checks() } };
  });
}

function checkServices(run, report, config) {
  const result = remoteDocker(run, ['service', 'ls', '--filter', `label=com.docker.stack.namespace=${config.stack}`, '--format', '{{.Name}} {{.Replicas}} {{.Image}}']);
  if (result.status !== 0) {
    report.bad(`cannot list the services of stack ${config.stack}`);
    return 0;
  }
  const services = splitLines(result.stdout);
  report.ok(`services of stack ${config.stack}: ${services.length}`);
  for (const service of services) report.note(`      ${service}`);
  return services.length;
}

function managedCount(run, kind, stack) {
  return splitLines(remoteDocker(run, [kind, 'ls', '--filter', `label=${stack}.managed=true`, '-q']).stdout).length;
}

function checkPointers(run, report, config) {
  const base = shellQuote(releasesBase(config));
  const pointers = {};
  for (const pointer of ['current', 'previous']) {
    const value = run(`cd ${base} 2>/dev/null && [ -L ${pointer} ] && basename "$(readlink ${pointer})" || true`).stdout.trim();
    pointers[pointer] = value === '' ? null : value;
    if (value === '') report.ok(`release ${pointer}: none`);
    else if (RELEASE_ID.test(value)) report.ok(`release ${pointer}: ${value}`);
    else report.bad(`release ${pointer} names an unexpected value`);
  }
  return pointers;
}

/** doctor: the prepare checks plus services, managed secrets and configs and the release pointers. Changes nothing. */
export async function doctorHost(ctx, config, { sshCmd = null } = {}, deps = {}) {
  return withRunner(ctx, config, { sshCmd }, deps, (run, notes) => {
    const report = newReport();
    notes.forEach(report.note);
    const data = { services: 0, secrets: 0, configs: 0, releases: { current: null, previous: null } };
    if (baseChecks(run, report, config)) {
      data.services = checkServices(run, report, config);
      data.secrets = managedCount(run, 'secret', config.stack);
      data.configs = managedCount(run, 'config', config.stack);
      report.ok(`managed secrets: ${data.secrets}, configs: ${data.configs}`);
      data.releases = checkPointers(run, report, config);
    }
    return { ok: !report.failed(), lines: report.lines(), data: { ...data, checks: report.checks() } };
  });
}
