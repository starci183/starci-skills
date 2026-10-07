import { contextModelOf } from './context-map.mjs';
import { machineKit } from './machine-ast.mjs';
import { byCodeUnit } from '../../lib/list.mjs';

/**
 * R178 `context-platform-tables` (BE_CONTEXT_PLATFORM_TABLES). A platform capability the manifest lists as `perConnection` (the event-bus outbox,
 * the job table) keeps its tables on EVERY connection that uses it: when a call into the capability passes the entity manager of connection C
 * (an `Inject<C>EntityManager` property, or the manager of a transaction on one), the capability's `<c>Entities` and `<c>Migrations` must be
 * registered on C, or the row the call writes has no table in C's database. The caller's connection is proven by the manager's origin; a call
 * whose manager origin cannot be proven is not judged.
 */
export const CONTEXT_PLATFORM_TABLES_RULE_IDS = ['BE_CONTEXT_PLATFORM_TABLES'];

const RULE = 'BE_CONTEXT_PLATFORM_TABLES';

function perConnectionHome(kit, model, checker, file, node) {
  const { ts } = kit;
  const callee = ts.isPropertyAccessExpression(node.expression) ? node.expression.name : node.expression;
  const home = kit.declarationsOf(checker, callee).map(kit.ownerOfDeclaration).find(Boolean);
  if (!home || !model.perConnection.has(home.root) || file.owner?.root === home.root) return undefined;
  return home;
}

function unregisteredViolations(kit, model, scope, home, connections, seen) {
  const { file, node } = scope;
  const registeredOn = model.registered.get(home.root)?.connections ?? new Map();
  const violations = [];
  for (const connection of connections) {
    if (registeredOn.has(connection)) continue;
    const key = `${file.rel}|${node.getStart()}|${connection}`;
    if (seen.has(key)) continue;
    seen.add(key);
    violations.push({ ruleId: RULE, ...kit.at(file.rel, file.sourceFile, node), message: `${file.rel} passes the entity manager of connection ${connection} to ${home.name}, but the tables of ${home.name} are not registered on ${connection} (registered: ${[...registeredOn.keys()].sort(byCodeUnit).join(', ') || 'none'}); register its entities and migrations on ${connection} too, so the table exists in the database of that context.`, connection, capability: home.name });
  }
  return violations;
}

export function checkContextPlatformTables(input) {
  const { graph } = input;
  const kit = machineKit(input);
  const { ts } = kit;
  const model = contextModelOf(kit, graph);
  const violations = [];
  const counts = { calls: 0, unproven: 0 };
  if (!model.perConnection.size) return { violations, coverage: { status: 'checked', perConnectionCapabilities: 0, ...counts } };
  const seen = new Set();
  for (const file of graph.files.values()) {
    const checker = kit.checkerOf(file.sourceFile);
    kit.walk(file.sourceFile, node => {
      if (!ts.isCallExpression(node)) return true;
      const home = perConnectionHome(kit, model, checker, file, node);
      if (!home) return true;
      counts.calls += 1;
      const connections = new Set(node.arguments.map(argument => model.connectionOfManager(checker, argument)).filter(Boolean));
      if (!connections.size) { counts.unproven += 1; return true; }
      violations.push(...unregisteredViolations(kit, model, { file, node }, home, connections, seen));
      return true;
    });
  }
  return { violations, coverage: { status: 'checked', perConnectionCapabilities: model.perConnection.size, ...counts } };
}
