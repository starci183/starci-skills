import { contextModelOf } from './context-map.mjs';
import { machineKit } from './machine-ast.mjs';

/**
 * R158 `context-platform-tables` (BE_CONTEXT_PLATFORM_TABLES). A platform capability the manifest lists as `perConnection` (the event-bus outbox,
 * the job table) keeps its tables on EVERY connection that uses it: when a call into the capability passes the entity manager of connection C
 * (an `Inject<C>EntityManager` property, or the manager of a transaction on one), the capability's `<c>Entities` and `<c>Migrations` must be
 * registered on C, or the row the call writes has no table in C's database. The caller's connection is proven by the manager's origin; a call
 * whose manager origin cannot be proven is not judged.
 */
export const CONTEXT_PLATFORM_TABLES_RULE_IDS = ['BE_CONTEXT_PLATFORM_TABLES'];

const RULE = 'BE_CONTEXT_PLATFORM_TABLES';

export function checkContextPlatformTables(input) {
  const { graph } = input;
  const kit = machineKit(input);
  const { ts } = kit;
  const model = contextModelOf(kit, graph);
  const violations = [];
  let calls = 0;
  let unproven = 0;
  if (!model.perConnection.size) return { violations, coverage: { status: 'checked', perConnectionCapabilities: 0, calls, unproven } };
  const seen = new Set();
  for (const file of graph.files.values()) {
    const checker = kit.checkerOf(file.sourceFile);
    kit.walk(file.sourceFile, node => {
      if (!ts.isCallExpression(node)) return true;
      const callee = ts.isPropertyAccessExpression(node.expression) ? node.expression.name : node.expression;
      const home = kit.declarationsOf(checker, callee).map(kit.ownerOfDeclaration).find(Boolean);
      if (!home || !model.perConnection.has(home.root) || file.owner?.root === home.root) return true;
      calls += 1;
      const connections = new Set(node.arguments.map(argument => model.connectionOfManager(checker, argument)).filter(Boolean));
      if (!connections.size) { unproven += 1; return true; }
      const registeredOn = model.registered.get(home.root)?.connections ?? new Map();
      for (const connection of connections) {
        if (registeredOn.has(connection)) continue;
        const key = `${file.rel}|${node.getStart()}|${connection}`;
        if (seen.has(key)) continue;
        seen.add(key);
        violations.push({ ruleId: RULE, ...kit.at(file.rel, file.sourceFile, node), message: `${file.rel} passes the entity manager of connection ${connection} to ${home.name}, but the tables of ${home.name} are not registered on ${connection} (registered: ${[...registeredOn.keys()].sort().join(', ') || 'none'}); register its entities and migrations on ${connection} too, so the table exists in the database of that context.`, connection, capability: home.name });
      }
      return true;
    });
  }
  return { violations, coverage: { status: 'checked', perConnectionCapabilities: model.perConnection.size, calls, unproven } };
}
