import fs from 'node:fs';
import path from 'node:path';
import { machineKit } from './machine-ast.mjs';

/**
 * R32 `composition-spec-boots-real-module` (BE_APP_COMPOSITION_ONLY, second half of "apps compose only; the composition
 * spec boots the real module"). Every app whose slot requires an `app.module.ts` also requires
 * `<app>.composition.spec.ts`; that spec must import `AppModule` from the app's own `app.module` and call
 * `AppModule.register(`. A spec that declares its own `AppModule`, imports one from anywhere else, or never registers it
 * boots a stand-in, and the real composition is never exercised. The spec is read from disk (specs are outside the
 * production program); its absence is BE_REQUIRED_MODULE_MISSING's finding, not this one's.
 */
export const COMPOSITION_SPEC_RULE_IDS = ['BE_APP_COMPOSITION_ONLY'];

const RULE = 'BE_APP_COMPOSITION_ONLY';
const MODULE_NAME = 'AppModule';
const MODULE_FILE = 'app.module.ts';
const SPEC_ENTRY = /^<app>\.composition\.spec\.ts$/u;

export function checkCompositionSpec(input) {
  const { config, graph } = input;
  const kit = machineKit(input);
  const { ts, resolver } = kit;
  const violations = [];
  let specs = 0;
  let missing = 0;
  for (const app of resolver.repo.apps) {
    const slot = resolver.slots().find(item => item.appKind === app.kind);
    if (!slot || !(slot.requires ?? []).includes(MODULE_FILE)) continue;
    const specEntry = (slot.requires ?? []).find(entry => SPEC_ENTRY.test(entry));
    if (!specEntry) continue;
    const source = slot.path.replace('<app>', app.name);
    const rel = `${source}${specEntry.replace('<app>', app.name)}`;
    const abs = path.join(config.root, ...rel.split('/'));
    if (!fs.existsSync(abs)) { missing += 1; continue; }
    specs += 1;
    const sourceFile = ts.createSourceFile(abs, fs.readFileSync(abs, 'utf8'), ts.ScriptTarget.Latest, true);
    const report = (node, message) => violations.push({ ruleId: RULE, path: rel, app: app.name, ...kit.at(rel, sourceFile, node), message });
    const moduleRel = `${source}${MODULE_FILE}`.replace(/\.ts$/u, '');
    const specDirectory = path.posix.dirname(rel);
    let local = null;
    let standIn = null;
    for (const statement of sourceFile.statements) {
      if (ts.isImportDeclaration(statement) && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)) {
        for (const element of statement.importClause.namedBindings.elements) {
          if ((element.propertyName ?? element.name).text !== MODULE_NAME) continue;
          const specifier = statement.moduleSpecifier.text;
          const target = specifier.startsWith('.') ? path.posix.normalize(path.posix.join(specDirectory, specifier)).replace(/\.[cm]?[jt]s$/u, '') : null;
          if (target === moduleRel) local = element.name.text;
          else report(element, `${rel} imports ${MODULE_NAME} from '${specifier}', not from the app's own ./app.module; the composition spec boots the real ${MODULE_NAME} of apps/${app.name}, never a stand-in module.`);
        }
      }
      if ((ts.isClassDeclaration(statement) || ts.isFunctionDeclaration(statement)) && statement.name?.text === MODULE_NAME) standIn = statement;
      if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name) && declaration.name.text === MODULE_NAME) standIn = declaration;
    }
    if (standIn) report(standIn, `${rel} declares its own ${MODULE_NAME}; the composition spec boots the real ${MODULE_NAME} of apps/${app.name} and declares no module of its own.`);
    if (!local) {
      if (!violations.some(item => item.path === rel && item.app === app.name)) report(sourceFile, `${rel} does not import ${MODULE_NAME} from ./app.module; the composition spec boots the real module of apps/${app.name}.`);
      continue;
    }
    let registers = false;
    kit.walk(sourceFile, node => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'register'
        && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === local) registers = true;
      return true;
    });
    if (!registers) report(sourceFile, `${rel} imports ${MODULE_NAME} but never calls ${local}.register(...); the composition spec boots the real module with stubbed options through its static register.`);
  }
  return { violations, coverage: { status: 'checked', specs, missing, apps: resolver.repo.apps.length, files: graph.files.size } };
}
