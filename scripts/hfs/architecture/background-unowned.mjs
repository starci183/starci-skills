import path from 'node:path';
import { machineKit } from './machine-ast.mjs';

/**
 * R46 `background-unowned` (BE_BACKGROUND_UNOWNED, BE-CONVENTION 1.6 and 1.13). Background work is a transport that only
 * a worker or api app runs (an api app composes the message transport of its own service; a separate worker is opt-in):
 *
 *   - every job processor (`*.processor.ts`, the jobs kind) and consumer (`*.consumer.ts`) is composed by an app of kind `worker` or
 *     `api`: the file is reachable, through runtime imports, from the root module of some such app declared in hfs.json; one no app
 *     reaches never runs. A schedule is a BullMQ job scheduler of a queue, so no scheduler decorator or timer is judged here: `@nestjs/schedule`
 *     and the timers are owned by platform capabilities (R90 BE_INFRA_OWNER);
 *   - a method whose name is one of the words the law names (`sweep`, `deliver`, `reconcile`, `retry`, alone or as the
 *     first word of a camelCase name) in a domain, integrations or feature class is reachable from a composed processor or
 *     consumer: from the processor or consumer files and everything they import, and from the files of the feature that holds them
 *     (its handlers are registered with the command bus, not imported by the processor). Mechanisms of platform are exempt.
 *
 * Reachability is static (imports, re-exports and the feature of the processor); it proves a processor or consumer could call the method,
 * not that it does.
 */
export const BACKGROUND_UNOWNED_RULE_IDS = ['BE_BACKGROUND_UNOWNED'];

const RULE = 'BE_BACKGROUND_UNOWNED';
const BACKGROUND_ROLES = new Set(['processor', 'consumer']);
/** The words the law names for background methods (knowledge/hfs/README.md 5.7). */
const BACKGROUND_WORDS = ['sweep', 'deliver', 'reconcile', 'retry'];

const roleOf = rel => {
  const parts = path.posix.basename(rel).split('.');
  return parts.length >= 3 && parts.at(-1) === 'ts' && BACKGROUND_ROLES.has(parts.at(-2)) ? parts.at(-2) : null;
};
const isBackgroundName = name => BACKGROUND_WORDS.some(word => name === word || (name.startsWith(word) && /[A-Z]/u.test(name[word.length] ?? '')));

const adjacencyOf = edges => {
  const adjacency = new Map();
  for (const edge of edges) {
    if (!edge.runtime) continue;
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from).push(edge.to);
  }
  return adjacency;
};

const closureOf = (adjacency, starts) => {
  const seen = new Set(starts);
  const queue = [...starts];
  while (queue.length) {
    for (const next of adjacency.get(queue.shift()) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
};

const appRootsOf = (apps, graph) => {
  const rootOf = app => `apps/${app.name}/src/app.module.ts`;
  const workers = apps.filter(app => app.kind === 'worker').map(rootOf).filter(rel => graph.files.has(rel));
  const services = apps.filter(app => app.kind === 'api').map(rootOf).filter(rel => graph.files.has(rel));
  return { workers, composed: [...workers, ...services] };
};

const backgroundFilesOf = graph => [...graph.files.values()].filter(file => roleOf(file.rel) && file.tier === 'feature');

const reportUncomposedFiles = (background, composed, workerRoots, report) => {
  for (const file of background) {
    if (composed.has(file.rel)) continue;
    const role = roleOf(file.rel);
    report(file, file.sourceFile, `${file.rel} is a ${role} that no service app composes${workerRoots.length ? '' : ' (hfs.json declares no worker app)'}; a ${role} runs only when the ${role === 'processor' ? 'job' : 'message'} module of its feature is imported by the root module of an app of kind worker or api.`, { role });
  }
};

const rootsOfRunningFeatures = (running, files) => {
  const roots = new Set();
  for (const file of running) {
    roots.add(file.rel);
    const owner = file.owner?.root;
    if (owner) for (const other of files.values()) if (other.owner?.root === owner) roots.add(other.rel);
  }
  return roots;
};

const backgroundMethodsOf = (node, kit, ts) => node.members.flatMap(member => {
  if (!ts.isMethodDeclaration(member) || !member.name) return [];
  const name = kit.propertyNameText(member.name);
  return name && isBackgroundName(name) ? [{ name, node: member.name }] : [];
});

const checkBackgroundMethods = ({ graph, kit, ts, reachable, report }) => {
  let methods = 0;
  const reportMethod = (file, method) => {
    methods += 1;
    if (!reachable.has(file.rel)) report(file, method.node, `${method.name} is background work (a ${BACKGROUND_WORDS.join(', ')} method) that no processor or consumer composed by a worker or api app can reach. Add a processor in features/jobs/<job> or a consumer in transport/message of a feature that runs it, and compose its module in a worker or api app.`, { method: method.name });
  };
  for (const file of graph.files.values()) {
    if (file.tier === 'platform') continue;
    kit.walk(file.sourceFile, node => {
      if (ts.isClassDeclaration(node)) for (const method of backgroundMethodsOf(node, kit, ts)) reportMethod(file, method);
    });
  }
  return methods;
};

export function checkBackgroundUnowned(input) {
  const { graph } = input;
  const kit = machineKit(input);
  const { ts, resolver } = kit;
  const violations = [];
  const report = (file, node, message, extra = {}) => violations.push({ ruleId: RULE, path: file.rel, ...kit.at(file.rel, file.sourceFile, node), message, ...extra });

  const adjacency = adjacencyOf(graph.edges);
  const closure = starts => closureOf(adjacency, starts);
  const { workers: workerRoots, composed: appRoots } = appRootsOf(resolver.repo.apps, graph);
  const composed = closure(appRoots);
  const background = backgroundFilesOf(graph);
  const running = background.filter(file => composed.has(file.rel));
  reportUncomposedFiles(background, composed, workerRoots, report);

  // Everything a composed processor or consumer can reach: its imports, and the files of its own feature (command handlers).
  const roots = rootsOfRunningFeatures(running, graph.files);
  const reachable = closure([...roots]);
  const methods = checkBackgroundMethods({ graph, kit, ts, reachable, report });
  return { violations, coverage: { status: 'checked', workers: workerRoots.length, jobsAndConsumers: background.length, composed: running.length, backgroundMethods: methods } };
}
