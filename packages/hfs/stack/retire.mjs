// retire.mjs - `starci app stack retire --project <compose project>... [--execute]`: stops the containers of the OLD docker compose projects once the swarm
// stack has taken over, WITHOUT removing anything. Each container gets `--restart=no` first (a restart policy or a reboot would otherwise start the old
// model again beside the new one), then `docker stop`; applications first, data stores last (the reverse of the recovery order). Containers, volumes,
// images and networks stay, so the old model can be started again for a rollback. The legacy edge container is never touched here (it is kept stopped
// by the takeover for its own retention), and a project that holds it is refused.
import { refusal } from './errors.mjs';
import { remoteDocker, withRunner } from './remote.mjs';
import { snapshotContainers, startOrder } from './live-restore.mjs';

const PROJECT = /^[a-z0-9][a-z0-9_-]*$/u;
const STOP_GRACE_SECONDS = 45;

function checkProjects(config, projects) {
  if (projects.length === 0) throw refusal('STACK_RETIRE_NO_PROJECT', 'name the compose projects to retire with --project <name> (repeatable)');
  for (const project of projects) {
    if (!PROJECT.test(project)) throw refusal('STACK_RETIRE_PROJECT', `${project} is not a compose project name`);
    if (project === config.stack) throw refusal('STACK_RETIRE_PROJECT', `${project} is the swarm stack, not an old compose project`);
  }
}

/** The running containers of the selected projects, applications first and data stores last. */
function selected(run, projects) {
  const all = snapshotContainers(run);
  const chosen = all.filter((entry) => projects.includes(entry.project));
  return startOrder(chosen).reverse();
}

/** `retire`: dry run unless execute. */
export async function retireCompose(ctx, config, { projects = [], execute = false, sshCmd = null } = {}, deps = {}) {
  checkProjects(config, projects);
  return withRunner(ctx, config, { sshCmd }, deps, (run, notes) => {
    const containers = selected(run, projects);
    const edge = config.ingress?.legacy?.container;
    if (edge && containers.some((entry) => entry.name === edge)) throw refusal('STACK_RETIRE_EDGE', `the project of ${edge} (the legacy edge) is not retired here: the takeover keeps that container stopped for its own retention`);
    const lines = [...notes, `${containers.length} running container(s) in ${projects.join(', ')}: ${containers.map((entry) => entry.name).join(', ') || 'none'}`];
    if (containers.length === 0) return { ok: true, lines: [...lines, 'nothing to retire'], data: { stopped: [], failed: [] } };
    if (!execute) return { ok: true, lines: [...lines, 'dry run: each would get --restart=no and then be stopped (nothing is removed)'], data: { stopped: [], failed: [] } };
    const stopped = [];
    const failed = [];
    for (const entry of containers) {
      const done = remoteDocker(run, ['update', '--restart=no', entry.name]).status === 0 && remoteDocker(run, ['stop', '-t', String(STOP_GRACE_SECONDS), entry.name]).status === 0;
      (done ? stopped : failed).push(entry.name);
    }
    const outcome = failed.length === 0 ? `retired ${stopped.length} container(s); nothing was removed, start them again with docker start for a rollback` : `FAILED to retire: ${failed.join(', ')}`;
    return { ok: failed.length === 0, lines: [...lines, outcome], data: { stopped, failed } };
  });
}
