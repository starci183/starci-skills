import path from 'node:path';
import { machineKit } from './machine-ast.mjs';
import { treeOf } from './required-files.mjs';

/**
 * R45 `module-per-transport` (BE_MODULE_SHAPE, BE-CONVENTION 1.2 and 1.6). A feature has one Nest module for its
 * application (`<f>.module.ts` at the feature root) and exactly one module per transport folder
 * (`transport/<protocol>/<f>-<protocol>.module.ts`). Never one module per operation, never a module-definition in a feature:
 *
 *   - a `*.module.ts` file below a transport folder other than `<f>-<protocol>.module.ts`, a `*.module-definition.ts`
 *     anywhere in a feature, and an `@Module` class (or a `ConfigurableModuleBuilder`/`ConfigurableModuleClass` use) in a
 *     feature file that is neither the application module nor the transport module of its own folder are refused;
 *   - apps import only transport modules, of the kinds their app kind allows: the `composedBy` list of each transport slot
 *     in knowledge/hfs/slots.yaml (api: graphql, http, websocket; worker: schedule, message; cli: cli). An app root that
 *     lists a feature's application module, or the transport module of another kind, is refused.
 */
export const MODULE_PER_TRANSPORT_RULE_IDS = ['BE_MODULE_SHAPE'];

const RULE = 'BE_MODULE_SHAPE';
const APP_ROOT_FILE = 'app.module.ts';

export function checkModulePerTransport(input) {
  const { config, graph } = input;
  const kit = machineKit(input);
  const { ts, resolver } = kit;
  const violations = [];
  const report = (file, node, message, extra = {}) => violations.push({ ruleId: RULE, path: file.rel, ...kit.at(file.rel, file.sourceFile, node), message, ...extra });
  const plain = (rel, message, extra = {}) => violations.push({ ruleId: RULE, path: rel, line: 1, column: 1, message, ...extra });

  const featureOf = rel => {
    const owner = resolver.ownerOf(rel);
    return owner && resolver.slot(owner.slot)?.tier === 'feature' ? owner : null;
  };
  /** {feature, root, protocol} of a file inside a feature: protocol is the transport folder, null for the application side. */
  const placeOf = rel => {
    const owner = featureOf(rel);
    if (!owner) return null;
    const below = rel.slice(owner.root.length + 1).split('/');
    return { root: owner.root, feature: path.posix.basename(owner.root), protocol: below[0] === 'transport' && below.length > 2 ? below[1] : null, below };
  };

  // The transport slots and the app kinds that compose them, by protocol folder name.
  const composedBy = new Map();
  for (const slot of resolver.slots()) {
    if (!slot.composedBy) continue;
    composedBy.set(path.posix.basename(slot.path.replace(/\/+$/u, '')), slot.composedBy);
  }

  let transportModules = 0;
  const tree = treeOf(config.root);
  for (const rel of [...tree.files].sort()) {
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

  // @Module classes of the program: where they live, and the feature classes among them.
  const modules = new Map(); // class declaration -> {name, file}
  for (const file of graph.files.values()) {
    const checker = kit.checkerOf(file.sourceFile);
    const place = placeOf(file.rel);
    for (const statement of file.sourceFile.statements) {
      if (!ts.isClassDeclaration(statement) || !statement.name) continue;
      const isModule = kit.decorators(statement).some(decorator => {
        const call = ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression;
        return kit.isImportOf(checker, call, 'Module', '@nestjs/common');
      });
      if (!isModule) continue;
      modules.set(statement, { name: statement.name.text, file });
      if (!place) continue;
      const own = place.protocol === null
        ? `${place.root}/${place.feature}.module.ts`
        : `${place.root}/transport/${place.protocol}/${place.feature}-${place.protocol}.module.ts`;
      if (file.rel !== own) report(file, statement.name, `${statement.name.text} is a Nest module declared in ${file.rel}; a feature declares exactly its application module (${place.feature}.module.ts) and one module per transport folder (${place.feature}-<protocol>.module.ts), never a module per operation.`, { feature: place.feature });
    }
    if (place) {
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
  }

  // What each app root lists: a feature module must be a transport module of a kind the app kind composes.
  let references = 0;
  for (const app of resolver.repo.apps) {
    const root = graph.files.get(`apps/${app.name}/src/${APP_ROOT_FILE}`);
    if (!root) continue;
    const checker = kit.checkerOf(root.sourceFile);
    const seen = new Set();
    const judge = node => {
      const call = ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'register';
      if (ts.isCallExpression(node) && !call) return;
      const target = call ? node.expression.expression : node;
      for (const declaration of kit.declarationsOf(checker, target)) {
        const module = modules.get(declaration);
        if (!module) continue;
        const place = placeOf(module.file.rel);
        if (!place || seen.has(node)) continue;
        seen.add(node);
        references += 1;
        if (place.protocol === null) {
          report(root, node, `App ${app.name} lists ${module.name}, the application module of feature ${place.feature}; apps import only transport modules (${place.feature}-<protocol>.module.ts), which import the application module themselves.`, { app: app.name, module: module.name });
        } else if (!(composedBy.get(place.protocol) ?? []).includes(app.kind)) {
          const allowed = [...composedBy].filter(([, kinds]) => kinds.includes(app.kind)).map(([protocol]) => protocol).sort();
          report(root, node, `App ${app.name} is of kind ${app.kind} and lists ${module.name}, a ${place.protocol} transport module; an app of kind ${app.kind} composes ${allowed.length ? `${allowed.join(', ')} transports only` : 'no transport module'}.`, { app: app.name, module: module.name, protocol: place.protocol });
        }
      }
    };
    kit.walk(root.sourceFile, node => {
      if (ts.isPropertyAssignment(node) && kit.propertyNameText(node.name) === 'imports' && ts.isArrayLiteralExpression(node.initializer)) {
        for (const element of node.initializer.elements) judge(element);
      } else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'register') judge(node);
      return true;
    });
  }
  return { violations, coverage: { status: 'checked', modules: modules.size, transportModules, appReferences: references } };
}
