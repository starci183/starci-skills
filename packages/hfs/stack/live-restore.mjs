// live-restore.mjs - docker `live-restore` is incompatible with swarm mode. `prepare` detects it; with --fix-live-restore, --owner-approved and
// --execute it backs up /etc/docker/daemon.json, sets live-restore false, restarts dockerd through passwordless sudo, waits for every container
// that has a restart policy to come back and reports which ones did. Everything runs ON the manager through the ssh runner.
import { approvalMissing } from './errors.mjs';
import { remoteDocker, shellQuote } from './remote.mjs';

const DAEMON_JSON = '/etc/docker/daemon.json';
const WAIT_SECONDS = 180;
const POLL_MS = 3000;
const NO_POLICY = new Set(['', 'no']);

/** True when dockerd runs with live-restore (docker info reports it). */
export function liveRestoreEnabled(run) {
  return remoteDocker(run, ['info', '--format', '{{.LiveRestoreEnabled}}']).stdout.trim() === 'true';
}

/** Read-only check used by prepare and doctor. */
export function checkLiveRestore(run, report) {
  if (liveRestoreEnabled(run)) report.bad('docker live-restore is enabled and is incompatible with swarm: run "starci app stack prepare --fix-live-restore --owner-approved --execute"');
  else report.ok('docker live-restore is off');
}

function restartingContainers(run) {
  const listed = remoteDocker(run, ['ps', '--format', '{{.Names}}']).stdout.split(/\r?\n/u).filter(Boolean);
  return listed.filter((name) => {
    const policy = remoteDocker(run, ['inspect', '--format', '{{.HostConfig.RestartPolicy.Name}}', name]).stdout.trim();
    return !NO_POLICY.has(policy);
  });
}

function rewrittenDaemonJson(run) {
  const read = run(`sudo -n cat ${shellQuote(DAEMON_JSON)}`);
  if (read.status !== 0) return { error: `cannot read ${DAEMON_JSON}: ${read.stderr.trim().split(/\r?\n/u)[0]}` };
  let parsed;
  try { parsed = JSON.parse(read.stdout.trim() || '{}'); } catch { return { error: `${DAEMON_JSON} is not valid JSON; fix it by hand` }; }
  return { text: `${JSON.stringify({ ...parsed, 'live-restore': false }, null, 2)}\n` };
}

async function waitForContainers(ctx, run, names) {
  const deadline = ctx.now() + WAIT_SECONDS * 1000;
  let missing = names;
  for (;;) {
    const up = remoteDocker(run, ['info', '--format', '{{.ServerVersion}}']).status === 0;
    if (up) missing = names.filter((name) => remoteDocker(run, ['inspect', '--format', '{{.State.Running}}', name]).stdout.trim() !== 'true');
    if ((up && missing.length === 0) || ctx.now() >= deadline) return missing;
    await ctx.sleep(POLL_MS);
  }
}

/**
 * The fix. Needs execute AND ownerApproved (else a dry-run line, or approvalMissing when execute is given without approval).
 * Returns { changed, back, missing }.
 */
export async function fixLiveRestore(ctx, run, report, { execute, ownerApproved }) {
  if (!liveRestoreEnabled(run)) {
    report.note('docker live-restore is already off: nothing to change');
    return { changed: false, back: [], missing: [] };
  }
  if (!execute) {
    report.note('dry run: would back up daemon.json, set live-restore false and restart docker (needs --execute and --owner-approved)');
    return { changed: false, back: [], missing: [] };
  }
  if (!ownerApproved) throw approvalMissing('STACK_LIVE_RESTORE_UNAPPROVED', 'restarting dockerd restarts every container; pass --owner-approved after the owner said yes');
  const names = restartingContainers(run);
  const rewritten = rewrittenDaemonJson(run);
  if (rewritten.error) {
    report.bad(rewritten.error);
    return { changed: false, back: [], missing: names };
  }
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
      return { changed: false, back: [], missing: names };
    }
  }
  report.note(`daemon.json backed up to ${backup}; live-restore set to false; docker restarted`);
  const missing = await waitForContainers(ctx, run, names);
  const back = names.filter((name) => !missing.includes(name));
  report.note(`containers with a restart policy back: ${back.join(', ') || 'none'}`);
  if (missing.length > 0) report.bad(`containers not back after ${WAIT_SECONDS} s: ${missing.join(', ')}`);
  return { changed: true, back, missing };
}
