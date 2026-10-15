// backup.mjs - `starci app stack backup`: age-encrypted tarballs of the declared volumes, produced ON the manager.
// Per volume ONE remote command streams `tar` straight through `age` into <name>-<stamp>.tgz.age.partial and renames it to its final name only
// when the whole pipeline succeeded, so no plaintext file ever exists and a failed dump never leaves a truncated backup that looks valid.
// The age recipient is the public recipient of the app's .sops.yaml (the custody's own recipient). --swarm-state also archives
// /var/lib/docker/swarm (orchestration state; NOT a database backup). Backups older than keepDays are deleted after a fully successful run.
// The files are NOT moved off the machine: copying them and proving a restore on an isolated host is the owner's job.
import fs from 'node:fs';
import path from 'node:path';
import { firstLine } from './context.mjs';
import { failure, refusal } from './errors.mjs';
import { shellQuote, withRunner } from './remote.mjs';
import { parseYaml } from '../runtime/engine/yaml.mjs';

const RECIPIENT = /age1[0-9a-z]{50,}/u;

/** The first age recipient of the creation_rules of <repoRoot>/.sops.yaml. */
function readRecipient(repoRoot) {
  let rules;
  try { rules = parseYaml(fs.readFileSync(path.join(repoRoot, '.sops.yaml'), 'utf8'))?.creation_rules; } catch { rules = null; }
  const found = RECIPIENT.exec(JSON.stringify(rules ?? null));
  if (!found) throw refusal('STACK_BACKUP_NO_RECIPIENT', 'no age recipient found in the creation_rules of .sops.yaml');
  return found[0];
}

/** YYYYMMDD-HHMMSS in UTC. */
const stampOf = (epochMs) => new Date(epochMs).toISOString().slice(0, 19).replaceAll('-', '').replaceAll(':', '').replace('T', '-');

function archiveJob(name, producer, { dir, stamp, recipient }) {
  const final = `${dir}/${name}-${stamp}.tgz.age`;
  const partial = `${final}.partial`;
  const script = [
    'set -o pipefail', 'umask 077', `mkdir -p ${shellQuote(dir)}`,
    `${producer} | age -r ${shellQuote(recipient)} -o ${shellQuote(partial)} && mv ${shellQuote(partial)} ${shellQuote(final)} || { rm -f ${shellQuote(partial)}; exit 1; }`,
  ].join('; ');
  return { name: `${name}-${stamp}.tgz.age`, command: `bash -c ${shellQuote(script)}` };
}

function planJobs(config, { swarmState, stamp, recipient }) {
  const dir = config.backup.dir ?? `/var/backups/${config.stack}`;
  const shared = { dir, stamp, recipient };
  const jobs = config.backup.volumes.map((entry) => {
    const mount = shellQuote(`${entry.volume}:/src:ro`);
    return archiveJob(entry.name, `docker run --rm -v ${mount} ${shellQuote(config.backup.image)} tar czf - -C /src .`, shared);
  });
  if (swarmState) jobs.push(archiveJob('swarm-state', 'sudo tar czf - -C /var/lib/docker swarm', shared));
  return { dir, jobs };
}

const pruneCommand = (dir, keepDays) => String.raw`find ${shellQuote(dir)} -type f \( -name '*.age' -o -name '*.age.partial' \) -mtime +${Number(keepDays)} -delete`;

function describePlan(config, plan, recipient, swarmState) {
  const names = config.backup.volumes.map((entry) => entry.name);
  return [
    `volumes: ${names.join(', ')}${swarmState ? ' and the swarm state' : ''}`,
    `target on the manager: ${plan.dir} (keep ${config.backup.keepDays} days)`,
    `age recipient: ${recipient.slice(0, 12)}... (public recipient of .sops.yaml)`,
    `files: ${plan.jobs.map((job) => job.name).join(', ')}`,
  ];
}

const REMINDERS = [
  'the files are encrypted but still on the manager: copy them to storage in another failure domain',
  'a restore proof on an isolated host (age -d with the owner identity) is the job of the owner',
];

function runArchives(run, plan) {
  const lines = [];
  const files = [];
  for (const job of plan.jobs) {
    const result = run(job.command);
    if (result.status === 0) {
      files.push(job.name);
      lines.push(`ok    ${job.name}`);
    } else lines.push(`FAIL  ${job.name}: ${firstLine(result.stderr)}`);
  }
  return { lines, files };
}

/** backup: the plan without execute; with execute the encrypted archives, then the retention sweep. */
export async function backupVolumes(ctx, config, { swarmState = false, execute = false, sshCmd = null } = {}, deps = {}) {
  if (!config.backup) throw refusal('STACK_BACKUP_UNDECLARED', 'the environment declares no deploy.backup block');
  const recipient = readRecipient(config.repoRoot);
  const plan = planJobs(config, { swarmState, stamp: stampOf(ctx.now()), recipient });
  const summary = describePlan(config, plan, recipient, swarmState);
  if (!execute) return { ok: true, lines: ['dry run: nothing was backed up', ...summary], data: { files: [], planned: plan.jobs.map((job) => job.name) } };
  return withRunner(ctx, config, { sshCmd }, deps, (run, notes) => {
    if (run('command -v age >/dev/null 2>&1').status !== 0) throw refusal('STACK_BACKUP_NO_AGE', 'age is not installed on the manager (apt install age)');
    const done = runArchives(run, plan);
    const lines = [...notes, ...summary, ...done.lines];
    const complete = done.files.length === plan.jobs.length;
    if (complete) {
      const pruned = run(pruneCommand(plan.dir, config.backup.keepDays));
      if (pruned.status !== 0) throw failure('STACK_BACKUP_PRUNE', `deleting backups older than ${config.backup.keepDays} days failed: ${firstLine(pruned.stderr)}`);
      lines.push(`ok    removed backups older than ${config.backup.keepDays} days`);
    } else lines.push('old backups were kept because this run did not finish');
    lines.push(...REMINDERS);
    if (swarmState) lines.push('the swarm state archive is orchestration state, not a database backup');
    return { ok: complete, lines, data: { files: done.files } };
  });
}
