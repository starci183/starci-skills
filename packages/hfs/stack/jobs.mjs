// jobs.mjs - `starci app stack jobs <action>`: runs the app's declared job CLI (deploy.jobs.command + the action) inside the running task of
// deploy.jobs.service on the manager, through the ssh runner, and relays its stdout. Job rows hold names and error texts, never payloads: the app
// CLI decides what is printed, this module only relays it. stats, failed, open and watchdog are read-only; retry and retry-failed are effects
// that need --execute (without it a dry-run line says what would run).
import { firstLine, lines as splitLines } from './context.mjs';
import { failure, refusal } from './errors.mjs';
import { remoteDocker, withRunner } from './remote.mjs';

const READ_ONLY = new Set(['stats', 'failed', 'open', 'watchdog']);
const EFFECTS = new Set(['retry', 'retry-failed']);
const OUTBOX_ID = /^[A-Za-z0-9-]{1,64}$/u;
const WHOLE_NUMBER = /^[0-9]{1,4}$/u;

function validCount(value, label) {
  if (!WHOLE_NUMBER.test(value) || Number(value) < 1 || Number(value) > 720) throw refusal('STACK_JOBS_ARGUMENT', `${label} must be a whole number from 1 to 720`);
}

/** Validates the action and its arguments; every argument reaches a remote command only after this. */
function validate(action, args) {
  if (!READ_ONLY.has(action) && !EFFECTS.has(action)) throw refusal('STACK_JOBS_ARGUMENT', `jobs takes ${[...READ_ONLY, ...EFFECTS].join(', ')}`);
  const maximum = action === 'stats' || action === 'watchdog' ? 0 : 1;
  if (args.length > maximum) throw refusal('STACK_JOBS_ARGUMENT', `jobs ${action} takes at most ${maximum} argument(s)`);
  if (action === 'retry') {
    if (args.length !== 1 || !OUTBOX_ID.test(args[0])) throw refusal('STACK_JOBS_ARGUMENT', 'jobs retry takes one outbox id (letters, digits, dashes, up to 64)');
  } else if (args.length === 1) validCount(args[0], action === 'retry-failed' ? 'hours' : 'the row count');
}

function runningTask(run, config) {
  const service = `${config.stack}_${config.jobs.service}`;
  const result = remoteDocker(run, ['ps', '-q', '--filter', `label=com.docker.swarm.service.name=${service}`, '--filter', 'status=running']);
  const task = result.status === 0 ? splitLines(result.stdout)[0] : undefined;
  if (task) return task;
  const reason = result.status === 0 ? 'none is running' : firstLine(result.stderr);
  throw failure('STACK_JOBS_NO_TASK', `no running task of service ${service} on the manager (${reason})`);
}

/** jobs: relays one action of the app's job CLI. */
export async function runJobs(ctx, config, { action = 'stats', args = [], execute = false, sshCmd = null } = {}, deps = {}) {
  if (!config.jobs) throw refusal('STACK_JOBS_UNDECLARED', 'the environment declares no deploy.jobs block');
  validate(action, args);
  if (EFFECTS.has(action) && !execute) {
    return { ok: true, lines: [`dry run: would run jobs ${[action, ...args].join(' ')} in the running ${config.jobs.service} task (add --execute)`], data: { action, status: null } };
  }
  return withRunner(ctx, config, { sshCmd }, deps, (run, notes) => {
    const task = runningTask(run, config);
    const result = remoteDocker(run, ['exec', task, ...config.jobs.command, action, ...args]);
    const lines = [...notes, ...splitLines(result.stdout)];
    if (result.status !== 0) lines.push(`FAIL  jobs ${action} exited ${result.status}: ${firstLine(result.stderr)}`);
    return { ok: result.status === 0, lines, data: { action, status: result.status } };
  });
}
