import fs from 'node:fs';
import path from 'node:path';
import { machineKit } from './machine-ast.mjs';
import { constructorDependencies } from './constructor-deps.mjs';
import { treeOf } from './required-files.mjs';
import { byCodeUnit } from '../../lib/list.mjs';

/**
 * R48 `unit-spec-providers` (BE_SPEC_QUALITY), the unit test standard's rule 3: the unit spec of a service builds its
 * subject with `Test.createTestingModule({ providers: [...] })`, and that providers array EQUALS the constructor
 * dependencies of the service under test: the service class first, then one provider for each constructor parameter.
 *
 * The service under test is the sibling `<name>.service.ts` of every `<name>.service.spec.ts` under src/ or apps/ (a spec is
 * outside the production program, so it is read from disk). A parameter decorated with a custom `Inject<Thing>()` provides
 * the token that decorator's `injector<T>(TOKEN)` names; an undecorated parameter of a class type provides that class (see
 * constructor-deps.mjs). Providers are matched by the exported name of the imported binding (`import { CACHE as C }` is
 * CACHE), never by text. A provider is a class, or `{ provide: TOKEN, useValue: double }` and nothing else.
 *
 * Findings: an extra provider, a missing provider, a service that is not the first provider, a dependency whose token cannot
 * be resolved, a spec with no createTestingModule providers array, and a provider that is neither a class nor
 * `{ provide, useValue }`. Which double a `useValue` is, and whether other specs exist at all, are other rules' business.
 */
export const UNIT_SPEC_PROVIDERS_RULE_IDS = ['BE_SPEC_QUALITY'];

const RULE = 'BE_SPEC_QUALITY';
const SERVICE_SPEC = /\.service\.spec\.ts$/u;
const SPEC_ROOT = /^(?:src|apps)\//u;

/** local name -> {name, module} for every named import of a source file. */
function importsOf(ts, sourceFile) {
  const imports = new Map();
  for (const statement of sourceFile.statements) {
    const bindings = ts.isImportDeclaration(statement) ? statement.importClause?.namedBindings : null;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) imports.set(element.name.text, { name: (element.propertyName ?? element.name).text, module: statement.moduleSpecifier.text });
  }
  return imports;
}

/** The `Test.createTestingModule(...)` calls of a spec. */
function testingModules(ts, sourceFile) {
  const calls = [];
  const visit = node => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'createTestingModule') calls.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return calls;
}

const literalKey = (ts, property) => (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) && (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) ? property.name.text : null;

export function checkUnitSpecProviders(input) {
  const { config, graph } = input;
  const kit = machineKit(input);
  const { ts } = kit;
  const violations = [];
  let specs = 0;
  const tree = treeOf(config.root);
  for (const rel of [...tree.files].filter(file => SPEC_ROOT.test(file) && SERVICE_SPEC.test(file)).sort(byCodeUnit)) {
    const abs = path.join(config.root, ...rel.split('/'));
    if (!fs.existsSync(abs)) continue;
    specs += 1;
    const sourceFile = ts.createSourceFile(abs, fs.readFileSync(abs, 'utf8'), ts.ScriptTarget.Latest, true);
    const report = (node, message) => violations.push({ ruleId: RULE, path: rel, ...kit.at(rel, sourceFile, node), message });
    const imports = importsOf(ts, sourceFile);
    const nameOf = identifier => imports.get(identifier.text)?.name ?? identifier.text;

    const serviceRel = rel.replace(/\.spec\.ts$/u, '.ts');
    const serviceFile = graph.files.get(serviceRel);
    if (!serviceFile) { report(sourceFile, `${rel} has no ${path.posix.basename(serviceRel)} beside it; a service spec sits next to the service it tests.`); continue; }

    const modules = testingModules(ts, sourceFile);
    if (!modules.length) { report(sourceFile, `${rel} never calls Test.createTestingModule({ providers: [...] }); build the service from a testing module holding exactly its constructor dependencies.`); continue; }

    for (const call of modules) {
      const options = call.arguments[0];
      const property = options && ts.isObjectLiteralExpression(options) ? options.properties.find(item => literalKey(ts, item) === 'providers') : null;
      const list = property && ts.isPropertyAssignment(property) && ts.isArrayLiteralExpression(property.initializer) ? property.initializer : null;
      if (!list) { report(call, `${rel}: Test.createTestingModule has no literal \`providers\` array; list the service and each constructor dependency there.`); continue; }

      const provided = []; // [{name, node}]
      let readable = true;
      for (const element of list.elements) {
        if (ts.isIdentifier(element)) { provided.push({ name: nameOf(element), node: element, isClass: true }); continue; }
        if (ts.isObjectLiteralExpression(element)) {
          const keys = element.properties.map(item => literalKey(ts, item));
          const provide = element.properties.find(item => literalKey(ts, item) === 'provide');
          const value = provide && ts.isPropertyAssignment(provide) ? provide.initializer : null;
          if (keys.length === 2 && keys.includes('useValue') && value && ts.isIdentifier(value)) { provided.push({ name: nameOf(value), node: element, isClass: false }); continue; }
        }
        readable = false;
        report(element, `${rel}: a provider is a class or \`{ provide: TOKEN, useValue: double }\` and nothing else (no useClass, useFactory, useExisting, spread or computed token).`);
      }
      if (!readable) continue;

      const first = list.elements[0];
      const serviceName = first && ts.isIdentifier(first) ? imports.get(first.text) : null;
      const target = serviceName ? path.posix.normalize(path.posix.join(path.posix.dirname(rel), serviceName.module)).replace(/\.[cm]?[jt]s$/u, '') : null;
      const serviceClass = serviceName && target === serviceRel.replace(/\.ts$/u, '')
        ? serviceFile.sourceFile.statements.find(statement => ts.isClassDeclaration(statement) && statement.name?.text === serviceName.name) : null;
      if (!serviceClass) { report(first ?? list, `${rel}: the first provider is the service under test, imported from ./${path.posix.basename(serviceRel, '.ts')}.`); continue; }

      const dependencies = constructorDependencies(kit, serviceFile, serviceClass);
      const expected = [];
      for (const dependency of dependencies) {
        if (dependency.kind === 'unresolved') {
          report(list, `${rel}: a constructor dependency of ${serviceName.name} cannot be resolved to a token (${dependency.reason}), so its provider cannot be checked; inject it through an exported Inject<Thing>() decorator or a class type.`);
          continue;
        }
        expected.push(dependency.name);
      }
      const remaining = [...expected];
      for (const item of provided.slice(1)) {
        const index = remaining.indexOf(item.name);
        if (index === -1) report(item.node, `${rel}: ${item.name} is provided but is not a constructor dependency of ${serviceName.name}; a unit spec provides exactly what the constructor needs.`);
        else remaining.splice(index, 1);
      }
      for (const name of remaining) report(list, `${rel}: ${name} is a constructor dependency of ${serviceName.name} but is not provided; add \`{ provide: ${name}, useValue: double }\` (or the class itself) to the providers.`);
    }
  }
  return { violations, coverage: { status: 'checked', specs, files: graph.files.size } };
}
