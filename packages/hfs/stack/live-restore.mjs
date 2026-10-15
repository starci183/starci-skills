// live-restore.mjs - docker `live-restore` is incompatible with swarm mode. `prepare` detects it; with --fix-live-restore, --owner-approved and
// --execute it backs up /etc/docker/daemon.json, sets live-restore false and restarts dockerd through passwordless sudo.
// A dockerd restart stops every container (a restart policy does not reliably bring them back: on a real host 25 of 25 stayed down), so the fix
//   1. snapshots every running container first (name, compose project and service, depends_on, image) and the answer of every public host,
//   2. after the restart waits for docker, gives the restart policies a short grace, then `docker start`s every snapshotted container that is
//      not running: databases and infrastructure first, applications next, edge proxies last, compose depends_on respected inside a group,
//   3. re-checks the hosts against the baseline and FAILS loudly, listing every container and host still down.
// Everything runs ON the manager through the ssh runner.
import { approvalMissing } from './errors.mjs';
import { remoteDocker, shellQuote } from './remote.mjs';

const DAEMON_JSON = '/etc/docker/daemon.json';
const WAIT_SECONDS = 180;
const GRACE_SECONDS = 45;
const HOST_WAIT_SECONDS = 120;
const POLL_MS = 3000;
const INFRA = /(?:postgres|postgis|pgbouncer|mysql|mariadb|mongo|redis|valkey|memcached|kafka|zookeeper|nats|rabbit|minio|elastic|opensearch|qdrant|clickhouse|cassandra|-db\b|_db\b|^db$|database)/iu;
const EDGE = /(?:traefik|nginx|caddy|haproxy|envoy|edge|proxy)/iu;
const FORMAT = '{{.Name}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}|{{index .Config.Labels "com.docker.compose.depends_on"}}|{{.HostConfig.RestartPolicy.Name}}|{{.Config.Image}}';

/** True when dockerd runs with live-restore (docker info reports it). */
function liveRestoreEnabled(run) {
  return remoteDocker(run, ['info', '--format', '{{.LiveRestoreEnabled}}']).stdout.trim() === 'true';
}

/** Read-only check used by prepare and doctor. */
export function checkLiveRestore(run, report) {
  if (liveRestoreEnabled(run)) report.bad('docker live-restore is enabled and is incompatible with swarm: run "starci app stack prepare --fix-live-restore --owner-approved --execute"');
  else report.ok('docker live-restore is off');
}

/** depends_on label: "db:service_started:false,cache:service_healthy:true" -> ['db', 'cache']. */
const dependenciesOf = (label) => label.split(',').map((item) => item.split(':')[0].trim()).filter(Boolean);

function parseSnapshot(line) {
  const [name, project = '', service = '', depends = '', restart = '', image = ''] = line.split('|');
  return { name: name.replace(/^\//u, ''), project, service, depends: dependenciesOf(depends), restart, image };
}

/** Every running container with the facts needed to start it again in order. */
export function snapshotContainers(run) {
  const names = remoteDocker(run, ['ps', '--format', '{{.Names}}']).stdout.split(/\r?\n/u).filter(Boolean);
  return names.map((name) => parseSnapshot(remoteDocker(run, ['inspect', '--format', FORMAT, name]).stdout.trim()));
}

const rankOf = (entry) => {
  if (INFRA.test(`${entry.service} ${entry.name} ${entry.image}`)) return 0;
  return EDGE.test(`${entry.service} ${entry.name} ${entry.image}`) ? 2 : 1;
};

/** Start order: infrastructure, applications, edge; inside a rank, compose dependencies first (stable, cycles keep their input order). */
export function startOrder(snapshot) {
  const ordered = [];
  const placed = new Set();
  const place = (entry, trail) => {
    if (placed.has(entry.name) || trail.has(entry.name)) return;
    const next = new Set(trail).add(entry.name);
    const same = (other) => other.project === entry.project && entry.depends.includes(other.service) && rankOf(other) === rankOf(entry);
    for (const dependency of snapshot.filter(same)) place(dependency, next);
    placed.add(entry.name);
    ordered.push(entry);
  };
  for (const rank of [0, 1, 2]) for (const entry of snapshot.filter((item) => rankOf(item) === rank)) place(entry, new Set());
  return ordered;
}

function rewrittenDaemonJson(run) {
  const read = run(`sudo -n cat ${shellQuote(DAEMON_JSON)}`);
  if (read.status !== 0) return { error: `cannot read ${DAEMON_JSON}: ${read.stderr.trim().split(/\r?\n/u)[0]}` };
  let parsed;
  try { parsed = JSON.parse(read.stdout.trim() || '{}'); } catch { return { error: `${DAEMON_JSON} is not valid JSON; fix it by hand` }; }
  return { text: `${JSON.stringify({ ...parsed, 'live-restore': false }, null, 2)}\n` };
}

const running = (run, name) => remoteDocker(run, ['inspect', '--format', '{{.State.Running}}', name]).stdout.trim() === 'true';
const dockerUp = (run) => remoteDocker(run, ['info', '--format', '{{.ServerVersion}}']).status === 0;
const notRunning = (run, names) => names.filter((name) => !running(run, name));

async function waitUntil(ctx, seconds, done) {
  const deadline = ctx.now() + seconds * 1000;
  while (!done() && ctx.now() < deadline) await ctx.sleep(POLL_MS);
  return done();
}

/** The hosts to prove, from the declared ingress: the verify list, else every upstream host (path /). */
function hostsToProve(config) {
  const ingress = config.ingress;
  if (!ingress) return [];
  const verify = ingress.verify.map((item) => ({ host: item.host, path: item.path }));
  const seen = new Set(verify.map((item) => item.host));
  const plain = ingress.upstreams.flatMap((entry) => entry.hosts).filter((host) => !seen.has(host) && !ingress.drop.includes(host));
  return [...verify, ...[...new Set(plain)].map((host) => ({ host, path: '/' }))];
}

const probeClass = (run, entry) => {
  const target = `https://${entry.host}${entry.path}`;
  const result = run(['curl', '-sS', '-o', '/dev/null', '--max-time', '10', '-w', '%{http_code}', '--resolve', shellQuote(`${entry.host}:443:127.0.0.1`), shellQuote(target)].join(' '));
  const code = Number(result.stdout.trim());
  return code >= 200 && code < 500 ? Math.floor(code / 100) : 0;
};

const baselineOf = (run, hosts) => new Map(hosts.map((entry) => [entry.host, probeClass(run, entry)]));
const hostsDown = (run, hosts, baseline) => hosts.filter((entry) => baseline.get(entry.host) !== 0 && probeClass(run, entry) !== baseline.get(entry.host));

function startMissing(run, report, order) {
  const failed = [];
  for (const entry of order.filter((item) => !running(run, item.name))) {
    const started = remoteDocker(run, ['start', entry.name]);
    if (started.status === 0) report.note(`started ${entry.name}`);
    else {
      failed.push(entry.name);
      report.bad(`cannot start ${entry.name}: ${started.stderr.trim().split(/\r?\n/u)[0]}`);
    }
  }
  return failed;
}

async function recover(ctx, run, report, snapshot, hosts, baseline) {
  const order = startOrder(snapshot);
  const names = order.map((entry) => entry.name);
  await waitUntil(ctx, WAIT_SECONDS, () => dockerUp(run));
  await waitUntil(ctx, GRACE_SECONDS, () => notRunning(run, names).length === 0);
  startMissing(run, report, order);
  await waitUntil(ctx, WAIT_SECONDS, () => notRunning(run, names).length === 0);
  const still = notRunning(run, names);
  const back = names.filter((name) => !still.includes(name));
  report.note(`containers back (${back.length} of ${names.length}): ${back.join(', ') || 'none'}`);
  if (still.length > 0) report.bad(`CONTAINERS STILL DOWN after the restart: ${still.join(', ')}`);
  await waitUntil(ctx, HOST_WAIT_SECONDS, () => hostsDown(run, hosts, baseline).length === 0);
  const down = hostsDown(run, hosts, baseline).map((entry) => entry.host);
  if (down.length > 0) report.bad(`PUBLIC HOSTS STILL DOWN against the pre-restart baseline: ${down.join(', ')}`);
  else if (hosts.length > 0) report.ok(`all ${hosts.length} public host(s) answer as before the restart`);
  return { back, missing: still, hostsDown: down };
}

/**
 * The fix. Needs execute AND ownerApproved (else a dry-run line, or approvalMissing when execute is given without approval).
 * Returns { changed, back, missing, hostsDown, snapshot }.
 */
export async function fixLiveRestore(ctx, run, report, { execute, ownerApproved, config }) {
  const idle = { changed: false, back: [], missing: [], hostsDown: [], snapshot: [] };
  if (!liveRestoreEnabled(run)) {
    report.note('docker live-restore is already off: nothing to change');
    return idle;
  }
  if (!execute) {
    report.note('dry run: would snapshot the running containers and the public hosts, back up daemon.json, set live-restore false, restart docker, start every container that does not come back (databases, applications, edge) and re-check the hosts (needs --execute and --owner-approved)');
    return idle;
  }
  if (!ownerApproved) throw approvalMissing('STACK_LIVE_RESTORE_UNAPPROVED', 'restarting dockerd restarts every container; pass --owner-approved after the owner said yes');
  const rewritten = rewrittenDaemonJson(run);
  if (rewritten.error) {
    report.bad(rewritten.error);
    return idle;
  }
  const snapshot = snapshotContainers(run);
  const hosts = hostsToProve(config);
  const baseline = baselineOf(run, hosts);
  report.note(`snapshot: ${snapshot.length} running container(s), ${hosts.length} public host(s) in the baseline`);
  const stamp = new Date(ctx.now()).toISOString().replaceAll(/[-:.]/gu, '').slice(0, 15);
  const backup = `${DAEMON_JSON}.bak-${stamp}`;
  const steps = [
    [`sudo -n cp -p ${shellQuote(DAEMON_JSON)} ${shellQuote(backup)}`, undefined],
    [`sudo -n tee ${shellQuote(DAEMON_JSON)} >/dev/null`, rewritten.text],
    ['sudo -n systemctl restart docker', undefined],
  ];
  for (const [command, input] of steps) {
    const done = run(command, input === undefined ? {} : { input });
    if (done.status !== 0) {
      report.bad(`live-restore fix stopped at "${command.split(' ').slice(0, 4).join(' ')}": ${done.stderr.trim().split(/\r?\n/u)[0]} (daemon.json backup: ${backup})`);
      return { ...idle, snapshot };
    }
  }
  report.note(`daemon.json backed up to ${backup}; live-restore set to false; docker restarted`);
  const outcome = await recover(ctx, run, report, snapshot, hosts, baseline);
  return { changed: true, snapshot, ...outcome };
}
