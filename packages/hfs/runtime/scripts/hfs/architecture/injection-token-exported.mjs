import path from 'node:path';
import { machineKit } from './machine-ast.mjs';
import { constructorDependencies, serviceClasses } from './constructor-deps.mjs';

/**
 * R85 `injection-token-exported` (BE_RAW_INJECT), the injection law's last obligation: a spec can only provide a token it
 * can import. Every `Inject<Thing>()` decorator that a service constructor uses resolves to a token (the argument of its
 * `injector<T>(TOKEN)`), and that token must be EXPORTED, by name, from the file of the decorator (`<cap>.decorators.ts`),
 * from the `<cap>.decorators.ts` that declares it, or from the index.ts of the capability that owns either file. A token
 * that is a private (non-exported) const, or one only a sibling file of the capability can reach, cannot be provided by a
 * unit spec and is a finding. A token that a package declares (a Nest options token, say) is the package's export.
 * The finding sits on the decorator's `injector(...)` call, once per decorator, however many services use it.
 */
export const INJECTION_TOKEN_EXPORTED_RULE_IDS = ['BE_RAW_INJECT'];

const RULE = 'BE_RAW_INJECT';

export function checkInjectionTokenExported(input) {
  const { graph } = input;
  const kit = machineKit(input);
  const { ts } = kit;
  const violations = [];
  const seen = new Set();
  let decorators = 0;

  const exportsName = (file, name) => {
    if (!file) return false;
    for (const statement of file.sourceFile.statements) {
      if (ts.isVariableStatement(statement) && kit.isExported(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name) && declaration.name.text === name) return true;
          if (ts.isObjectBindingPattern(declaration.name) && declaration.name.elements.some(element => ts.isIdentifier(element.name) && element.name.text === name)) return true;
        }
      }
      if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)
        && statement.exportClause.elements.some(element => element.name.text === name)) return true;
    }
    return false;
  };
  const indexOf = file => (file?.owner ? graph.files.get(`${file.owner.root}/index.ts`) : null);

  for (const { file, declaration } of serviceClasses(kit, graph)) {
    for (const dependency of constructorDependencies(kit, file, declaration)) {
      if (dependency.external || !dependency.decoratorDeclaration || !dependency.injectorCall || seen.has(dependency.injectorCall)) continue;
      seen.add(dependency.injectorCall);
      decorators += 1;
      const decoratorFile = graph.files.get(kit.graphPath(dependency.decoratorDeclaration));
      if (dependency.kind === 'unresolved') {
        if (decoratorFile) violations.push({ ruleId: RULE, path: decoratorFile.rel, ...kit.at(decoratorFile.rel, decoratorFile.sourceFile, dependency.injectorCall), decorator: dependency.decorator,
          message: `${dependency.decorator}() cannot be followed to its token (${dependency.reason}); name an exported \`unique symbol\` const so a unit spec can provide it.` });
        continue;
      }
      const tokenFile = dependency.declaration ? graph.files.get(kit.graphPath(dependency.declaration)) : null;
      const homes = [decoratorFile, tokenFile && path.posix.basename(tokenFile.rel).endsWith('.decorators.ts') ? tokenFile : null, indexOf(decoratorFile), indexOf(tokenFile)];
      if (homes.some(home => exportsName(home, dependency.name))) continue;
      if (!decoratorFile) continue;
      violations.push({ ruleId: RULE, path: decoratorFile.rel, ...kit.at(decoratorFile.rel, decoratorFile.sourceFile, dependency.injectorCall), decorator: dependency.decorator, token: dependency.name,
        message: `${dependency.decorator}() injects ${dependency.name}, which is not exported from ${path.posix.basename(decoratorFile.rel)} nor from the capability index.ts; export the token so a unit spec can provide it (\`{ provide: ${dependency.name}, useValue: double }\`).` });
    }
  }
  return { violations, coverage: { status: 'checked', decorators, files: graph.files.size } };
}
