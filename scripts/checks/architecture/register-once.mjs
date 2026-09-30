import path from 'node:path';
import { machineKit } from './machine-ast.mjs';

/**
 * R45 `register-once` (BE_MODULE_SHAPE). A capability module (a `@Module` class declared under a domain, platform or
 * integrations owner) is composed by the app root alone:
 *   - it is registered as `X.register(...)` in `apps/<app>/src/app.module.ts` (imports built by helpers of the same file
 *     count) and nowhere else: no other module registers it or lists it in `imports:` (RED03), an app root does not list
 *     the bare class;
 *   - `isGlobal: true` appears only in an app root;
 *   - one dynamic module class is registered once in the graph of an app (its root and every file the root reaches by
 *     runtime imports), whichever file the second registration sits in.
 * Owners register their own submodules freely: only a registration or import that crosses an owner boundary is refused.
 */
export const REGISTER_ONCE_RULE_IDS = ['BE_MODULE_SHAPE'];

const RULE = 'BE_MODULE_SHAPE';
const CAPABILITY_TIERS = new Set(['domain', 'platform', 'integrations']);

export function checkRegisterOnce(input) {
  const { config, graph } = input;
  const kit = machineKit(input);
  const { ts } = kit;
  const violations = [];
  const report = (file, node, message, extra = {}) => violations.push({ ruleId: RULE, path: file.rel, ...kit.at(file.rel, file.sourceFile, node), message, ...extra });
  const isAppRoot = file => Boolean(file.slot?.startsWith('be.app.')) && path.posix.basename(file.rel) === 'app.module.ts';

  // The module classes of the program, and which of them are capabilities.
  const modules = new Map(); // declaration -> {name, rel, ownerRoot, capability}
  for (const file of graph.files.values()) {
    const checker = kit.checkerOf(file.sourceFile);
    for (const statement of file.sourceFile.statements) {
      if (!ts.isClassDeclaration(statement) || !statement.name) continue;
      const isModule = kit.decorators(statement).some(decorator => {
        const call = ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression;
        const binding = kit.importBinding(checker, call);
        return binding?.module === '@nestjs/common' && binding.name === 'Module';
      });
      if (isModule) modules.set(statement, { name: statement.name.text, rel: file.rel, ownerRoot: file.owner?.root ?? null, capability: CAPABILITY_TIERS.has(file.tier) });
    }
  }
  const moduleOf = (checker, node) => {
    for (const declaration of kit.declarationsOf(checker, node)) if (modules.has(declaration)) return { declaration, ...modules.get(declaration) };
    return null;
  };

  // Registration sites per file: `X.register(...)` calls of a module class.
  const sites = new Map(); // rel -> [{module, node}]
  let registrations = 0;
  for (const file of graph.files.values()) {
    const checker = kit.checkerOf(file.sourceFile);
    const list = [];
    kit.walk(file.sourceFile, node => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'register') {
        const target = moduleOf(checker, node.expression.expression);
        if (target) list.push({ module: target, node });
      }
      // isGlobal: true belongs to the app root alone.
      if (ts.isPropertyAssignment(node) && kit.propertyNameText(node.name) === 'isGlobal' && node.initializer.kind === ts.SyntaxKind.TrueKeyword && !isAppRoot(file)) {
        report(file, node, '`isGlobal: true` appears only in the app root (apps/<app>/src/app.module.ts), where the capability module is registered; a module never decides its own globality.');
      }
      // imports: [...] of a module outside the app root must not list another owner's capability module.
      if (ts.isPropertyAssignment(node) && kit.propertyNameText(node.name) === 'imports' && ts.isArrayLiteralExpression(node.initializer)) {
        for (const element of node.initializer.elements) {
          if (ts.isCallExpression(element)) continue;
          const target = moduleOf(checker, element);
          if (!target || !target.capability) continue;
          if (isAppRoot(file)) report(file, element, `${target.name} is listed in imports as a bare class; a capability module is registered once in the app root as ${target.name}.register({ isGlobal: true, ...options }).`, { module: target.name });
          else if (target.ownerRoot !== file.owner?.root) report(file, element, `${target.name} (${target.ownerRoot}) is imported by a module of another owner; capability modules are registered once in the app root and never imported by another module.`, { module: target.name });
        }
      }
      return true;
    });
    sites.set(file.rel, list);
    registrations += list.length;
    for (const site of list) {
      if (!site.module.capability || isAppRoot(file) || site.module.ownerRoot === file.owner?.root) continue;
      report(file, site.node, `${site.module.name}.register(...) is called outside the app root; a capability module is registered once per app in apps/<app>/src/app.module.ts and never by another module.`, { module: site.module.name });
    }
  }

  // One registration of a module class in the graph of each app.
  const reachable = rel => {
    const seen = new Set([rel]);
    const queue = [rel];
    const outgoing = new Map();
    for (const edge of graph.edges) if (edge.runtime) { if (!outgoing.has(edge.from)) outgoing.set(edge.from, []); outgoing.get(edge.from).push(edge.to); }
    while (queue.length) for (const next of outgoing.get(queue.shift()) ?? []) if (!seen.has(next)) { seen.add(next); queue.push(next); }
    return seen;
  };
  let apps = 0;
  for (const app of config.apps) {
    const root = kit.appRoot(app.name);
    if (!root) continue;
    apps += 1;
    const counted = new Map();
    for (const rel of [...reachable(root.rel)].sort()) {
      for (const site of sites.get(rel) ?? []) {
        const seenBefore = counted.get(site.module.declaration);
        if (!seenBefore) { counted.set(site.module.declaration, rel); continue; }
        const file = graph.files.get(rel);
        report(file, site.node, `${site.module.name} is registered more than once in the graph of app ${app.name} (first in ${seenBefore}); register a dynamic module once.`, { module: site.module.name, app: app.name });
      }
    }
  }

  return { violations, coverage: { status: 'checked', apps, modules: modules.size, capabilityModules: [...modules.values()].filter(item => item.capability).length, registrations } };
}
