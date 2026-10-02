import { contextModelOf } from './context-map.mjs';
import { machineKit } from './machine-ast.mjs';

/**
 * R133 `context-transaction` (BE_CONTEXT_TRANSACTION). One transaction touches one context's connection. In the callback of
 * `<manager>.transaction(async (manager) => ...)`, where `<manager>` is proven to be the entity manager of connection C (an
 * `Inject<C>EntityManager` property or parameter), the code never:
 *   - uses the entity manager of another declared connection (proven by its injector's home file); or
 *   - calls a method of a domain or projection capability of another context (that capability writes through its own connection).
 * Work that spans contexts is a saga of one transaction per context, linked by events. A receiver whose connection cannot be proven is not judged.
 */
export const CONTEXT_TRANSACTION_RULE_IDS = ['BE_CONTEXT_TRANSACTION'];

const RULE = 'BE_CONTEXT_TRANSACTION';

export function checkContextTransaction(input) {
  const { graph } = input;
  const kit = machineKit(input);
  const { ts } = kit;
  const model = contextModelOf(kit, graph);
  const violations = [];
  let transactions = 0;
  let unproven = 0;
  const seen = new Set();
  const report = (file, node, message, extra) => {
    const key = `${file.rel}|${node.getStart()}|${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    violations.push({ ruleId: RULE, ...kit.at(file.rel, file.sourceFile, node), message, ...extra });
  };
  for (const file of graph.files.values()) {
    const checker = kit.checkerOf(file.sourceFile);
    kit.walk(file.sourceFile, node => {
      if (!(ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'transaction')) return true;
      const callback = node.arguments.find(argument => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument));
      if (!callback) return true;
      const connection = model.connectionOfManager(checker, node.expression.expression);
      if (!connection) { unproven += 1; return true; }
      transactions += 1;
      kit.walk(callback.body, inner => {
        if (ts.isPropertyAccessExpression(inner)) {
          const other = model.connectionOfManager(checker, inner);
          if (other && other !== connection) report(file, inner, `A transaction on connection ${connection} uses the entity manager of connection ${other}; one transaction touches one context's connection. Span contexts with a saga: one transaction per context, linked by events.`, { connection, other });
        }
        if (ts.isCallExpression(inner)) {
          const callee = ts.isPropertyAccessExpression(inner.expression) ? inner.expression.name : inner.expression;
          const declaration = kit.declarationsOf(checker, callee)[0];
          const rel = declaration ? kit.graphPath(declaration) : null;
          const context = rel ? model.contextOfFile(rel) : null;
          if (context && context !== connection) {
            report(file, inner, `A transaction on connection ${connection} calls ${graph.files.get(rel).owner.root} of context ${context}; one transaction touches one context's connection. Span contexts with a saga: one transaction per context, linked by events.`, { connection, other: context });
          }
        }
        return true;
      });
      return true;
    });
  }
  return { violations, coverage: { status: 'checked', transactions, unproven } };
}
