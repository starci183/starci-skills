import path from 'node:path';
import { machineKit } from './machine-ast.mjs';

/**
 * R45 `register-once` (BE_MODULE_SHAPE), the module graph read from the app roots (owner rule of 2026-09-30, the
 * reference's `CodingModule imports DeviceModule` shape). Each capability has one representative module: the only module
 * of the capability an app registers, once, in `apps/<app>/src/app.module.ts` as `X.register({ isGlobal: true, ... })`.
 * It may split itself into sub-modules imported as plain `imports: [Sub]`; a sub-module is never in an app and has one
 * importer, its parent. Over every `@Module` class of the program:
 *
 *   - a module in an app root's imports (a `X.register(...)` call or a listed class, helpers of the root included) is
 *     listed once there, is imported by no other module, and, when it is a capability module of src/modules, is registered
 *     with the literal `isGlobal: true` (a bare capability class is not a registration);
 *   - a module imported by a non-app module has exactly one importer and appears in no app root; the one exception is
 *     the feature case: a feature's application module is imported by each protocol module of the same feature;
 *   - `isGlobal: true` appears only in an app root.
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
  // The test world (slot be.tests.world) is the test composition root: useTestWorld registers capability modules with
  // `isGlobal: true` the way an app root does. A spec (integration, contract, e2e) is not a composition root.
  const isWorld = file => file.slot === 'be.tests.world';
  const appOf = file => config.apps.find(app => file.rel === `apps/${app.name}/src/app.module.ts`)?.name ?? null;

  // Every @Module class of the program.
  const modules = new Map(); // declaration -> {name, file, capability}
  for (const file of graph.files.values()) {
    const checker = kit.checkerOf(file.sourceFile);
    for (const statement of file.sourceFile.statements) {
      if (!ts.isClassDeclaration(statement) || !statement.name) continue;
      const isModule = kit.decorators(statement).some(decorator => {
        const call = ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression;
        const binding = kit.importBinding(checker, call);
        return binding?.module === '@nestjs/common' && binding.name === 'Module';
      });
      if (isModule) modules.set(statement, { name: statement.name.text, file, capability: CAPABILITY_TIERS.has(file.tier) });
    }
  }
  const targetOf = (checker, node) => {
    for (const declaration of kit.declarationsOf(checker, node)) if (modules.has(declaration)) return { declaration, ...modules.get(declaration) };
    return null;
  };
  const enclosingModule = node => {
    for (let current = node.parent; current; current = current.parent) if (ts.isClassDeclaration(current) && modules.has(current)) return current;
    return null;
  };

  // The references to modules: importer (the enclosing module class, else the file), target, node, whether it is a register call.
  const references = [];
  for (const file of graph.files.values()) {
    if (isWorld(file)) continue; // the test composition root assembles modules; it is not a module importer
    const checker = kit.checkerOf(file.sourceFile);
    const seen = new Set();
    const note = (element, viaImports) => {
      const call = ts.isCallExpression(element) && ts.isPropertyAccessExpression(element.expression) && element.expression.name.text === 'register';
      if (ts.isCallExpression(element) && !call) return;
      const target = targetOf(checker, call ? element.expression.expression : element);
      if (!target) return;
      seen.add(element);
      const owner = enclosingModule(element);
      references.push({ file, node: element, target, register: call, viaImports, importer: owner ?? file.rel, importerOwner: file.owner?.root ?? null,
        options: call ? element.arguments[0] : null, root: isAppRoot(file) });
    };
    kit.walk(file.sourceFile, node => {
      if (ts.isPropertyAssignment(node) && kit.propertyNameText(node.name) === 'imports' && ts.isArrayLiteralExpression(node.initializer)) {
        for (const element of node.initializer.elements) note(element, true);
      } else if (ts.isCallExpression(node) && !seen.has(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'register') {
        note(node, false);
      }
      if (ts.isPropertyAssignment(node) && kit.propertyNameText(node.name) === 'isGlobal' && node.initializer.kind === ts.SyntaxKind.TrueKeyword && !isAppRoot(file) && !isWorld(file)) {
        report(file, node, '`isGlobal: true` appears only in the app root (apps/<app>/src/app.module.ts), where the representative module of a capability is registered; a module never decides its own globality.');
      }
      return true;
    });
  }

  const trueGlobal = options => Boolean(options) && ts.isObjectLiteralExpression(options) && (() => {
    const property = kit.propertyOf(options, 'isGlobal');
    return Boolean(property) && ts.isPropertyAssignment(property) && property.initializer.kind === ts.SyntaxKind.TrueKeyword;
  })();

  // App roots: each module is listed once, capability modules are registered with isGlobal true.
  const rootReferences = references.filter(item => item.root);
  const inApps = new Map(); // module declaration -> Set(app names)
  for (const item of rootReferences) {
    const app = appOf(item.file) ?? item.file.rel;
    if (!inApps.has(item.target.declaration)) inApps.set(item.target.declaration, new Set());
    inApps.get(item.target.declaration).add(app);
  }
  for (const app of config.apps) {
    const seenInApp = new Map();
    for (const item of rootReferences.filter(entry => appOf(entry.file) === app.name)) {
      if (seenInApp.has(item.target.declaration)) {
        report(item.file, item.node, `${item.target.name} is registered more than once in the root of app ${app.name}; a module is listed once per app.`, { module: item.target.name, app: app.name });
      } else seenInApp.set(item.target.declaration, item.node);
    }
  }
  for (const item of rootReferences) {
    if (!item.target.capability || !item.viaImports && !item.register) continue;
    if (!item.register) report(item.file, item.node, `${item.target.name} is listed in imports as a bare class; the representative module of a capability is registered in the app root as ${item.target.name}.register({ isGlobal: true, ...options }).`, { module: item.target.name });
    else if (!trueGlobal(item.options)) report(item.file, item.node, `${item.target.name} is registered in the app root without the literal \`isGlobal: true\`; write ${item.target.name}.register({ isGlobal: true, ...options }).`, { module: item.target.name });
  }

  // Non-app importers: no importer of an app-registered module, exactly one importer otherwise (the feature case excepted).
  const importersOf = new Map(); // module declaration -> [reference]
  for (const item of references.filter(entry => !entry.root && entry.viaImports)) {
    if (!importersOf.has(item.target.declaration)) importersOf.set(item.target.declaration, []);
    importersOf.get(item.target.declaration).push(item);
  }
  for (const [declaration, list] of importersOf) {
    const target = modules.get(declaration);
    const apps = inApps.get(declaration);
    if (apps) {
      for (const item of list) {
        report(item.file, item.node, `${target.name} is registered in the root of app ${[...apps].sort().join(', ')}, so no other module imports it; consume it through its Inject*() decorators.`, { module: target.name });
      }
      continue;
    }
    const distinct = [...new Set(list.map(item => item.importer))];
    const featureCase = target.file.tier === 'feature' && target.file.owner && list.every(item => item.importerOwner === target.file.owner.root);
    if (distinct.length > 1 && !featureCase) {
      for (const item of list.filter(entry => entry.importer !== list[0].importer)) {
        report(item.file, item.node, `${target.name} is imported by ${distinct.length} modules; a sub-module has exactly one importer, its parent. Another capability's module is consumed through its Inject*() decorators, never imported.`, { module: target.name });
      }
    }
  }

  return { violations, coverage: { status: 'checked', apps: config.apps.filter(app => kit.appRoot(app.name)).length, modules: modules.size,
    capabilityModules: [...modules.values()].filter(item => item.capability).length, registrations: references.filter(item => item.register).length,
    rootImports: rootReferences.length } };
}
