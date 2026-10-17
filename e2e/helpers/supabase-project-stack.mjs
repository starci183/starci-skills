// supabase-project-stack.mjs - the Docker resources of ONE local Supabase project (the supabase CLI labels every container,
// volume and network of a stack with com.supabase.cli.project=<project id>, and its containers also carry the working
// directory that started them), so an e2e spec can tear its own stack down on every path and reclaim the leftover of an
// earlier interrupted run of itself, and never touch another project's resources: every lookup filters on the project label.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const PROJECT_LABEL = 'com.supabase.cli.project';
const WORKDIR_LABEL = 'com.supabase.cli.workdir';
/** The file a spec writes into the directory that holds its app, naming the process that owns the stack started there. */
export const OWNER_FILE = '.e2e-owner';

const dockerRun = (args) => spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 120_000 });
const lines = (run) => String(run.stdout ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

/** The containers of `project`, running or not: [{ name, workdir }]. */
export function projectContainers(project, run = dockerRun) {
  const listing = run(['ps', '-a', '--filter', `label=${PROJECT_LABEL}=${project}`, '--format', `{{.Names}}\t{{.Label "${WORKDIR_LABEL}"}}`]);
  return lines(listing).map((line) => {
    const [name, workdir = ''] = line.split('\t');
    return { name, workdir };
  });
}

/** True when the process `pid` still exists. */
const alive = (pid) => {
  try { process.kill(pid, 0); return true; } catch (error) { return error?.code === 'EPERM'; }
};

/**
 * Whether the stack started in `workdir` was abandoned: its working directory is gone, or the directory that held it names an
 * owner process (OWNER_FILE) that is no longer running. A directory with a live owner, or with no owner record, is not stale.
 */
export function stackIsStale(workdir) {
  if (!workdir || !fs.existsSync(workdir)) return true;
  const ownerFile = path.join(path.dirname(workdir), OWNER_FILE);
  if (!fs.existsSync(ownerFile)) return false;
  const pid = Number.parseInt(fs.readFileSync(ownerFile, 'utf8'), 10);
  return !Number.isInteger(pid) || !alive(pid);
}

/**
 * Removes the containers of `project` that `select` accepts, then - once the project has no container left - its labelled
 * volumes and networks. Returns the names removed. Resources of another project are never matched.
 */
export function removeProjectStack(project, { select = () => true, run = dockerRun } = {}) {
  const removed = [];
  for (const container of projectContainers(project, run).filter(select)) {
    run(['rm', '-f', '-v', container.name]);
    removed.push(container.name);
  }
  if (projectContainers(project, run).length === 0) {
    for (const kind of ['volume', 'network']) {
      const listing = run([kind, 'ls', '--filter', `label=${PROJECT_LABEL}=${project}`, '--format', '{{.Name}}']);
      for (const name of lines(listing)) {
        run([kind, 'rm', name]);
        removed.push(name);
      }
    }
  }
  return removed;
}

/** Removes the leftover stack of `project` an earlier interrupted run abandoned (every container stale); leaves a live or foreign one. */
export function reclaimStaleStack(project, { run = dockerRun } = {}) {
  const containers = projectContainers(project, run);
  if (containers.length === 0 || !containers.every((container) => stackIsStale(container.workdir))) return [];
  return removeProjectStack(project, { run });
}
