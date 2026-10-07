import path from 'node:path';
import { machineKit } from './machine-ast.mjs';
import { treeOf } from './required-files.mjs';
import { byCodeUnit } from '../../lib/list.mjs';

/**
 * R45 `module-per-transport` (BE_MODULE_SHAPE, BE-CONVENTION 1.2 and 1.6). A feature has one Nest module for its
 * application (`<f>.module.ts` at the feature root) and exactly one module per transport folder
 * (`transport/<protocol>/<f>-<protocol>.module.ts`). Never one module per operation, never a module-definition in a feature:
 *
 *   - a `*.module.ts` file below a transport folder other than `<f>-<protocol>.module.ts`, a `*.module-definition.ts`
 *     anywhere in a feature, and an `@Module` class (or a `ConfigurableModuleBuilder`/`ConfigurableModuleClass` use) in a
 *     feature file that is neither the application module nor the transport module of its own folder are refused;
 *   - apps import only transport modules, of the kinds their app kind allows: the `composedBy` list of each transport slot
 *     in knowledge/hfs/slots.yaml (api: graphql, http, websocket; worker: schedule, message). An app root that
 *     lists a feature's application module, or the transport module of another kind, is refused;
 *   - a composed root (an owner slot with `composedBy`, be.cli) holds one static module per folder, named after the folder
 *     (cli.module.ts, <group>/<group>.module.ts); an app of a composing kind lists the root module only, and an app of any
 *     other kind lists none of its modules.
 */
export const MODULE_PER_TRANSPORT_RULE_IDS = ['BE_MODULE_SHAPE'];

const RULE = 'BE_MODULE_SHAPE';
const APP_ROOT_FILE = 'app.module.ts';
const TRAILING_SLASH = new RegExp('/+$', 'u');

function featureOwnerOf(resolver, rel) {
  const owner = resolver.ownerOf(rel);
  return owner && resolver.slot(owner.slot)?.tier === 'feature' ? owner : null;
}

function modulePlaceOf(resolver, rel) {
  const owner = featureOwnerOf(resolver, rel);
  if (!owner) return null;
  const slot = resolver.slot(owner.slot);
  const below = rel.slice(owner.root.length + 1).split('/');
  const feature = path.posix.basename(owner.root);
  if (slot.composedBy) return { root: owner.root, feature, protocol: null, below, composed: slot };
  return { root: owner.root, feature, protocol: below[0] === 'transport' && below.length > 2 ? below[1] : null, below, composed: null };
}

function composedModulePath(rel) {
  const dir = path.posix.dirname(rel);
  return `${dir}/${path.posix.basename(dir)}.module.ts`;
}

function composedByProtocol(resolver) {
  const composedBy = new Map();
  for (const slot of resolver.slots()) {
    if (!slot.composedBy || slot.owner) continue;
    composedBy.set(path.posix.basename(slot.path.replace(TRAILING_SLASH, '')), slot.composedBy);
  }
  return composedBy;
}

function reportTransportFileShapes(tree, placeOf, plain) {
  let transportModules = 0;
  for (const rel of [...tree.files].sort(byCodeUnit)) {
    const place = placeOf(rel);
    if (!place) continue;
    const base = path.posix.basename(rel);
    if (/\.module-definition\.[cm]?tsx?$/u.test(base)) plain(rel, `${rel} is a module-definition inside feature ${place.feature}; a feature module is a static \`@Module\`, and only capabilities under src/modules build their module from a definition. Delete it and list the providers in the module.`, { feature: place.feature });
    if (place.protocol && /\.module\.[cm]?tsx?$/u.test(base)) {
      const expected = `${place.feature}-${place.protocol}.module.ts`;
      if (place.below.length !== 3 || base !== expected) plain(rel, `${rel} is a second module of the ${place.protocol} transport of ${place.feature}; a transport folder has exactly one module, transport/${place.protocol}/${expected}, never one module per operation. List the operation's providers in that module and delete this file.`, { feature: place.feature, protocol: place.protocol });
      else transportModules += 1;
    }
  }
  return transportModules;
}

function isNestModuleClass(ts, kit, checker, statement) {
  return kit.decorators(statement).some(decorator => {
    const call = ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression;
    return kit.isImportOf(checker, call, 'Module', '@nestjs/common');
  });
}

function reportModuleClassLocation(file, statement, place, composedModuleOf, report) {
  if (place.composed) {
    const own = composedModuleOf(file.rel);
    if (file.rel !== own) report(file, statement.name, `${statement.name.text} is a Nest module declared in ${file.rel}; every folder of ${place.root} holds exactly one static module named after it (${own}), never a module per command.`, { feature: place.feature });
    return;
  }
  const own = place.protocol === null
    ? `${place.root}/${place.feature}.module.ts`
    : `${place.root}/transport/${place.protocol}/${place.feature}-${place.protocol}.module.ts`;
  if (file.rel !== own) report(file, statement.name, `${statement.name.text} is a Nest module declared in ${file.rel}; a feature declares exactly its application module (${place.feature}.module.ts) and one module per transport folder (${place.feature}-<protocol>.module.ts), never a module per operation.`, { feature: place.feature });
}

function reportConfigurableModuleUses(file, checker, kit, ts, place, report) {
  kit.walk(file.sourceFile, node => {
    if (ts.isNewExpression(node) && kit.isImportOf(checker, node.expression, 'ConfigurableModuleBuilder', '@nestjs/common')) {
      report(file, node, `ConfigurableModuleBuilder builds a capability's module definition; feature ${place.feature} has static modules only, so declare the providers in its @Module.`, { feature: place.feature });
    } else if (ts.isHeritageClause(node)) {
      for (const type of node.types) if (kit.isImportOf(checker, type.expression, 'ConfigurableModuleClass', '@nestjs/common')) {
        report(file, type, `A feature module never extends ConfigurableModuleClass; feature ${place.feature} has static modules only.`, { feature: place.feature });
      }
    }
    return true;
  });
}

function moduleClassesInFile(file, checker, place, modules, kit, ts, composedModuleOf, report) {
  for (const statement of file.sourceFile.statements) {
    if (!ts.isClassDeclaration(statement) || !statement.name) continue;
    if (!isNestModuleClass(ts, kit, checker, statement)) continue;
    modules.set(statement, { name: statement.name.text, file });
    if (place) reportModuleClassLocation(file, statement, place, composedModuleOf, report);
  }
}

function collectFeatureModules(graph, kit, ts, placeOf, composedModuleOf, report) {
  const modules = new Map(); // class declaration -> {name, file}
  for (const file of graph.files.values()) {
    const checker = kit.checkerOf(file.sourceFile);
    const place = placeOf(file.rel);
    moduleClassesInFile(file, checker, place, modules, kit, ts, composedModuleOf, report);
    if (place) reportConfigurableModuleUses(file, checker, kit, ts, place, report);
  }
  return modules;
}

function reportModuleReference(root, node, app, module, place, composedBy, report) {
  if (place.composed) {
    const rootModule = `${place.root}/${place.feature}.module.ts`;
    if (!place.composed.composedBy.includes(app.kind)) report(root, node, `App ${app.name} is of kind ${app.kind} and lists ${module.name} from ${place.root}; only an app of kind ${place.composed.composedBy.join(', ')} composes that root.`, { app: app.name, module: module.name });
    else if (module.file.rel !== rootModule) report(root, node, `App ${app.name} lists ${module.name}, a group module inside ${place.root}; the app lists the root module (${rootModule}), which imports every group module.`, { app: app.name, module: module.name });
  } else if (place.protocol === null) {
    report(root, node, `App ${app.name} lists ${module.name}, the application module of feature ${place.feature}; apps import only transport modules (${place.feature}-<protocol>.module.ts), which import the application module themselves.`, { app: app.name, module: module.name });
  } else if (!(composedBy.get(place.protocol) ?? []).includes(app.kind)) {
    const allowed = [...composedBy].filter(([, kinds]) => kinds.includes(app.kind)).map(([protocol]) => protocol).sort(byCodeUnit);
    const transports = allowed.length ? `${allowed.join(', ')} transports only` : 'no transport module';
    report(root, node, `App ${app.name} is of kind ${app.kind} and lists ${module.name}, a ${place.protocol} transport module; an app of kind ${app.kind} composes ${transports}.`, { app: app.name, module: module.name, protocol: place.protocol });
  }
}

function inspectModuleDeclarations(checker, target, node, root, app, moduleMap, kit, placeOf, seen, composedBy, report) {
  let references = 0;
  for (const declaration of kit.declarationsOf(checker, target)) {
    const module = moduleMap.get(declaration);
    if (!module) continue;
    const place = placeOf(module.file.rel);
    if (!place || seen.has(node)) continue;
    seen.add(node);
    references += 1;
    reportModuleReference(root, node, app, module, place, composedBy, report);
  }
  return references;
}

function inspectAppRoot(app, graph, kit, ts, moduleMap, placeOf, composedBy, report) {
  const root = graph.files.get(`apps/${app.name}/src/${APP_ROOT_FILE}`);
  if (!root) return 0;
  const checker = kit.checkerOf(root.sourceFile);
  const seen = new Set();
  let references = 0;
  const judge = node => {
    const call = ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'register';
    if (ts.isCallExpression(node) && !call) return;
    const target = call ? node.expression.expression : node;
    references += inspectModuleDeclarations(checker, target, node, root, app, moduleMap, kit, placeOf, seen, composedBy, report);
  };
  kit.walk(root.sourceFile, node => {
    if (ts.isPropertyAssignment(node) && kit.propertyNameText(node.name) === 'imports' && ts.isArrayLiteralExpression(node.initializer)) {
      for (const element of node.initializer.elements) judge(element);
    } else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'register') judge(node);
    return true;
  });
  return references;
}

function appModuleReferences(apps, graph, kit, ts, moduleMap, placeOf, composedBy, report) {
  let references = 0;
  for (const app of apps) references += inspectAppRoot(app, graph, kit, ts, moduleMap, placeOf, composedBy, report);
  return references;
}

export function checkModulePerTransport(input) {
  const { config, graph } = input;
  const kit = machineKit(input);
  const { ts, resolver } = kit;
  const violations = [];
  const report = (file, node, message, extra = {}) => violations.push({ ruleId: RULE, path: file.rel, ...kit.at(file.rel, file.sourceFile, node), message, ...extra });
  const plain = (rel, message, extra = {}) => violations.push({ ruleId: RULE, path: rel, line: 1, column: 1, message, ...extra });

  const placeOf = rel => modulePlaceOf(resolver, rel);
  const composedModuleOf = composedModulePath;

  const composedBy = composedByProtocol(resolver);

  const tree = treeOf(config.root);
  const transportModules = reportTransportFileShapes(tree, placeOf, plain);

  const modules = collectFeatureModules(graph, kit, ts, placeOf, composedModuleOf, report);

  const references = appModuleReferences(resolver.repo.apps, graph, kit, ts, modules, placeOf, composedBy, report);
  return { violations, coverage: { status: 'checked', modules: modules.size, transportModules, appReferences: references } };
}
