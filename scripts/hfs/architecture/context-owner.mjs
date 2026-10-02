import { contextModelOf, connectionsComposedBy } from './context-map.mjs';
import { machineKit } from './machine-ast.mjs';

/**
 * R131 `context-owner` (BE_CONTEXT_OWNER). A connection of hfs.json IS a bounded context, and its `owner` is the one service app that composes it:
 *   - an api or worker app passes to the database module registration (or lists in its options) only the connections it owns (a monolith's one
 *     app owns them all);
 *   - an api or worker app imports no domain or projection capability of a context it does not own: it composes only its own contexts;
 *   - the cli app (and the migrate app of a repository not yet moved to it) is the migration runner and composes every declared connection
 *     that holds registered tables (migrations run only through it, once per connection).
 * Which connection an app composes is read from two typed origins in its own files: the connection passed to the database module registration
 * and the connection literal that lists a capability's `<c>Entities` / `<c>Migrations`. Which context a capability belongs to is the connection
 * its arrays are registered on (context-map.mjs); an import is judged by the owner graph edge and the target's slot tier, never by a path or
 * name pattern. A runner app with a registration whose connection name cannot be resolved is not judged for missing connections.
 */
export const CONTEXT_OWNER_RULE_IDS = ['BE_CONTEXT_OWNER'];

const RULE = 'BE_CONTEXT_OWNER';
const SERVICE_KINDS = new Set(['api', 'worker']);
const RUNNER_KINDS = new Set(['migrate', 'cli']);

export function checkContextOwner(input) {
  const { graph } = input;
  const kit = machineKit(input);
  const { resolver } = kit;
  const model = contextModelOf(kit, graph);
  const violations = [];
  const owners = new Map(resolver.repo.connections.map(connection => [connection.name, connection.owner]));
  let compositions = 0;
  let imports = 0;
  const seen = new Set();
  const once = (key, violation) => { if (!seen.has(key)) { seen.add(key); violations.push({ ruleId: RULE, ...violation }); } };
  const appOf = rel => { const classified = resolver.classifyPath(rel); return classified.slot?.startsWith('be.app.') ? classified.bindings?.app ?? null : null; };

  // What each app composes: [{connection, file, node}] from the database module registration and from the registration literals under its files.
  const composed = new Map(resolver.repo.apps.map(app => [app.name, { items: [], unresolved: false }]));
  for (const app of resolver.repo.apps) {
    const { root, items } = connectionsComposedBy(kit, app.name);
    for (const item of items) composed.get(app.name).items.push({ ...item, file: root });
  }
  for (const site of model.registrations) {
    const app = appOf(site.file.rel);
    if (!app || !composed.has(app)) continue;
    if (site.connection === null) composed.get(app).unresolved = true;
    else composed.get(app).items.push({ connection: site.connection, file: site.file, node: site.node });
  }

  for (const app of resolver.repo.apps) {
    const { items, unresolved } = composed.get(app.name);
    compositions += items.length;
    if (SERVICE_KINDS.has(app.kind)) {
      for (const { connection, file, node } of items) {
        const owner = owners.get(connection);
        if (owner && owner !== app.name) {
          once(`${app.name}|${connection}`, { ...kit.at(file.rel, file.sourceFile, node), message: `App ${app.name} composes connection ${connection}, the context owned by app ${owner}; an app composes only the contexts it owns. Reach that context through the API or the events of ${owner}.`, connection, app: app.name, owner });
        }
      }
    } else if (RUNNER_KINDS.has(app.kind) && !unresolved) {
      const root = kit.appRoot(app.name);
      const present = new Set(items.map(item => item.connection));
      const held = new Set([...model.registered.values()].flatMap(entry => [...entry.connections.keys()]));
      for (const connection of owners.keys()) {
        if (!root || present.has(connection) || !held.has(connection) || !items.length) continue;
        once(`${app.name}|missing|${connection}`, { ...kit.at(root.rel, root.sourceFile, root.sourceFile), message: `The ${app.kind} app ${app.name} does not compose connection ${connection}; migrations run only through it, once per connection, so it registers every declared connection that holds tables.`, connection, app: app.name });
      }
    }
  }

  const kinds = new Map(resolver.repo.apps.map(app => [app.name, app.kind]));
  for (const edge of graph.edges) {
    const app = appOf(edge.from);
    if (!app || !SERVICE_KINDS.has(kinds.get(app))) continue;
    const context = model.contextOfFile(edge.to);
    if (!context) continue;
    imports += 1;
    const owner = owners.get(context);
    if (owner && owner !== app) {
      once(`${edge.from}|${edge.to}`, { path: edge.from, line: edge.line, column: edge.column, message: `App ${app} imports ${graph.files.get(edge.to).owner.root}, a capability of context ${context} owned by app ${owner}; an app composes only the contexts it owns, so use the API or the events of ${owner} instead.`, connection: context, app, owner });
    }
  }
  return { violations, coverage: { status: 'checked', apps: resolver.repo.apps.length, compositions, contextImports: imports } };
}
