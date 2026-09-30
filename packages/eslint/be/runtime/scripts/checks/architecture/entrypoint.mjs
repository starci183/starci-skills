import path from 'node:path';
import { machineKit } from './machine-ast.mjs';

/**
 * R33 `entrypoint-only-in-apps` (BE_ENTRYPOINT_ONLY_IN_APPS). A process starts in `apps/<app>/src/main.ts` only:
 * `NestFactory.create*` (from @nestjs/core) and a top-level `bootstrap()` call anywhere else are entrypoints hiding in a
 * library, a feature, a spec helper or another file of an app.
 *
 * The test world (slot be.tests.world) is the test COMPOSITION ROOT, like an app's main.ts: use-test-world.ts boots the
 * real apps with NestFactory the way main.ts does in production, so it is an entrypoint owner too. A spec
 * (*.integration-spec.ts, *.contract-spec.ts, *.e2e-spec.ts) does not compose: it calls useTestWorld(...) only, and the
 * other test slots stay refused.
 */
export const ENTRYPOINT_RULE_IDS = ['BE_ENTRYPOINT_ONLY_IN_APPS'];

const RULE = 'BE_ENTRYPOINT_ONLY_IN_APPS';

export function checkEntrypoints(input) {
  const { graph } = input;
  const kit = machineKit(input);
  const { ts } = kit;
  const violations = [];
  let entrypoints = 0;
  /** The identifier a top-level statement calls: `bootstrap()`, `void bootstrap()`, `bootstrap().catch(...)`. */
  const calledIdentifier = expression => {
    let current = expression;
    for (;;) {
      if (ts.isVoidExpression(current) || ts.isAwaitExpression(current) || ts.isParenthesizedExpression(current) || ts.isNonNullExpression(current)) current = current.expression;
      else if (ts.isCallExpression(current)) {
        if (ts.isIdentifier(current.expression)) return current.expression;
        current = current.expression;
      } else if (ts.isPropertyAccessExpression(current)) current = current.expression;
      else return null;
    }
  };
  for (const file of graph.files.values()) {
    const isMain = (Boolean(file.slot?.startsWith('be.app.')) && path.posix.basename(file.rel) === 'main.ts') || file.slot === 'be.tests.world';
    const checker = kit.checkerOf(file.sourceFile);
    const report = (node, message) => violations.push({ ruleId: RULE, path: file.rel, ...kit.at(file.rel, file.sourceFile, node), message });
    kit.walk(file.sourceFile, node => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text.startsWith('create')
        && kit.isImportOf(checker, node.expression.expression, 'NestFactory', '@nestjs/core')) {
        if (isMain) entrypoints += 1;
        else report(node, `NestFactory.${node.expression.name.text}() starts a process outside apps/<app>/src/main.ts; entrypoints live in an app's main.ts only.`);
      }
      return true;
    });
    if (isMain) continue;
    for (const statement of file.sourceFile.statements) {
      if (!ts.isExpressionStatement(statement)) continue;
      if (calledIdentifier(statement.expression)?.text === 'bootstrap') {
        report(statement, "A top-level bootstrap() call starts a process outside apps/<app>/src/main.ts; entrypoints live in an app's main.ts only.");
      }
    }
  }
  return { violations, coverage: { status: 'checked', entrypoints } };
}
