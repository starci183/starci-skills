import fs from 'node:fs';
import path from 'node:path';
import { loadArchitectureConfig, isInside, slash } from '../architecture/config.mjs';
import { buildTypeScriptContext } from '../architecture/typescript.mjs';
import { IDENTIFIER, exact, issueSink, missingContract, pathKey, projectBinding, propertyName, repositoryPath, unalias, unwrap } from './common.mjs';
import { checkNestMetadata } from './nest-metadata.mjs';

export const NEST_BOUNDARY_RULES = Object.freeze(['NEST_ENV_ACCESS', 'NEST_CACHE_TOKEN_BOUNDARY', 'NEST_NAMED_EXPORTS']);
const RAW_CACHE_NAMES = new Set(['CACHE_MANAGER', 'MEMORY_CACHE_MANAGER', 'REDIS_CACHE_MANAGER']);
const safeFile = (root, relative) => repositoryPath(root, relative, 'Boundary input');

function readContract(root) {
  const pkg = JSON.parse(fs.readFileSync(safeFile(root, 'package.json'), 'utf8'));
  const value = pkg.starci?.codePatterns?.nest?.boundaries;
  if (value === undefined) throw Error(missingContract('nest.boundaries', 'Nest boundary contract', 'starci/nest-boundary-contract@1'));
  exact(value, ['schema', 'envParsers', 'cacheOwners', 'jestLifecycleEntries'], 'Nest boundary contract');
  if (value.schema !== 'starci/nest-boundary-contract@1') throw Error('Declare package.json#starci.codePatterns.nest.boundaries schema starci/nest-boundary-contract@1.');
  const files = field => {
    if (!Array.isArray(value[field]) || new Set(value[field]).size !== value[field].length) throw Error(`Nest boundaries.${field} must be an array of unique exact paths.`);
    for (const file of value[field]) safeFile(root, file);
    return new Set(value[field]);
  };
  const envParsers = files('envParsers'), jestLifecycleEntries = files('jestLifecycleEntries');
  if (!Array.isArray(value.cacheOwners)) throw Error('Nest boundaries.cacheOwners must be an array.');
  const cacheOwners = value.cacheOwners.map(owner => {
    exact(owner, ['root', 'tokens'], 'Cache owner');
    if (!Array.isArray(owner.tokens) || !owner.tokens.length) throw Error('Cache owner needs explicit exported tokens.');
    const absolute = repositoryPath(root, owner.root, 'Cache owner', { kind: 'directory' });
    const tokens = owner.tokens.map(token => {
      exact(token, ['path', 'export'], 'Cache token');
      const file = safeFile(root, token.path);
      if (!isInside(absolute, file) || typeof token.export !== 'string' || !IDENTIFIER.test(token.export)) throw Error('Cache token must name an export inside its owner.');
      return { ...token, file };
    });
    return { root: owner.root, absolute, tokens };
  });
  for (let i = 0; i < cacheOwners.length; i++) for (let j = i + 1; j < cacheOwners.length; j++) {
    if (isInside(cacheOwners[i].absolute, cacheOwners[j].absolute) || isInside(cacheOwners[j].absolute, cacheOwners[i].absolute)) throw Error('Cache owners must not overlap.');
  }
  return { envParsers, cacheOwners, jestLifecycleEntries };
}

function tokenIdentity(ts, checker, symbol, seen = new Set()) {
  const identity = unalias(ts, checker, symbol);
  if (!identity || seen.has(identity)) return identity;
  seen.add(identity);
  const declaration = identity.declarations?.length === 1 ? identity.declarations[0] : null;
  if (declaration && ts.isBindingElement(declaration)) {
    const owner = declaration.parent.parent;
    const name = declaration.propertyName?.text ?? declaration.name.text;
    if (ts.isVariableDeclaration(owner) && owner.initializer && name) {
      const property = checker.getTypeAtLocation(owner.initializer).getProperty(name);
      if (property) return tokenIdentity(ts, checker, property, seen);
    }
  }
  if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer
    && (ts.getCombinedNodeFlags(declaration.parent) & ts.NodeFlags.Const)) {
    const init = unwrap(ts, declaration.initializer);
    if (ts.isIdentifier(init) || ts.isPropertyAccessExpression(init) || ts.isElementAccessExpression(init)) {
      const selected = ts.isPropertyAccessExpression(init) ? init.name : ts.isElementAccessExpression(init) ? init.argumentExpression : init;
      const target = checker.getSymbolAtLocation(selected) ?? (ts.isElementAccessExpression(init) && ts.isStringLiteralLike(selected)
        ? checker.getTypeAtLocation(init.expression).getProperty(selected.text) : null);
      return tokenIdentity(ts, checker, target, seen) ?? identity;
    }
  }
  return identity;
}

function importOrigin(ts, declaration) {
  for (let node = declaration; node; node = node.parent) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) return node.moduleSpecifier.text;
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) return node.moduleReference.expression?.text;
  }
  return null;
}

function processOrigin(ts, checker, input, seen = new Set()) {
  const node = unwrap(ts, input);
  if (!node) return null;
  if (ts.isAwaitExpression(node)) return processOrigin(ts, checker, node.expression, seen);
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    const parent = processOrigin(ts, checker, node.expression, new Set(seen));
    const name = propertyName(ts, node);
    if (parent === 'global' && name === 'process') return 'process';
    if (parent === 'process' && name === 'env') return 'env';
    if (parent === 'process' && name === 'default') return 'process';
    return null;
  }
  if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])
    && ['node:process', 'process'].includes(node.arguments[0].text)) {
    if (node.expression.kind === ts.SyntaxKind.ImportKeyword) return 'process';
    if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
      const symbol = checker.getSymbolAtLocation(node.expression);
      if (!symbol || (symbol.declarations ?? []).every(item => item.getSourceFile().isDeclarationFile)) return 'process';
    }
    if ((ts.isPropertyAccessExpression(node.expression) || ts.isElementAccessExpression(node.expression))
      && propertyName(ts, node.expression) === 'getBuiltinModule' && processOrigin(ts, checker, node.expression.expression, seen) === 'process') return 'process';
  }
  if (!ts.isIdentifier(node)) return null;
  const symbol = ts.isShorthandPropertyAssignment(node.parent)
    ? checker.getShorthandAssignmentValueSymbol(node.parent) : checker.getSymbolAtLocation(node);
  if (symbol && seen.has(symbol)) return null;
  if (symbol) seen.add(symbol);
  const declarations = symbol?.getDeclarations?.() ?? [];
  const local = declarations.filter(item => !item.getSourceFile().isDeclarationFile);
  if (!local.length && ['globalThis', 'global'].includes(node.text)) return 'global';
  if (!local.length && node.text === 'process' && (!symbol || declarations.some(item => /(?:^|\/)@types\/node\//.test(slash(item.getSourceFile().fileName))))) return 'process';
  for (const declaration of declarations) {
    const imported = importOrigin(ts, declaration);
    if (['node:process', 'process'].includes(imported)) {
      if (ts.isImportSpecifier(declaration)) return (declaration.propertyName?.text ?? declaration.name.text) === 'env' ? 'env' : null;
      return 'process';
    }
    if (ts.isVariableDeclaration(declaration) && declaration.initializer) return processOrigin(ts, checker, declaration.initializer, seen);
    if (ts.isBindingElement(declaration)) {
      const owner = declaration.parent.parent;
      const selected = declaration.propertyName?.text ?? declaration.name.text;
      if (ts.isVariableDeclaration(owner) && owner.initializer) {
        const parent = processOrigin(ts, checker, owner.initializer, seen);
        if (parent === 'process' && selected === 'env') return 'env';
        if (parent === 'process' && selected === 'default') return 'process';
        if (parent === 'global' && selected === 'process') return 'process';
      }
    }
  }
  const resolved = unalias(ts, checker, symbol);
  if (resolved && resolved !== symbol) for (const declaration of resolved.declarations ?? []) {
    if (ts.isVariableDeclaration(declaration) && declaration.initializer) return processOrigin(ts, checker, declaration.initializer, seen);
    if (resolved.name === 'env' && /(?:^|\/)@types\/node\//.test(slash(declaration.getSourceFile().fileName))) return 'env';
    if (resolved.name === 'process' && /(?:^|\/)@types\/node\//.test(slash(declaration.getSourceFile().fileName))) return 'process';
  }
  return null;
}

function defaultExport(ts, node) {
  return ts.isExportAssignment(node)
    || Boolean(ts.getModifiers?.(node)?.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword))
    || (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)
      && node.exportClause.elements.some(element => element.name.text === 'default'))
    || (ts.isExportDeclaration(node) && node.exportClause && ts.isNamespaceExport(node.exportClause) && node.exportClause.name.text === 'default');
}

function globalBinding(ts, checker, node, name) {
  if (!ts.isIdentifier(node) || node.text !== name) return false;
  if ((ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)
    || (ts.isPropertyAssignment(node.parent) && node.parent.name === node)) return false;
  const declarations = checker.getSymbolAtLocation(node)?.declarations ?? [];
  return !declarations.length || declarations.every(declaration => declaration.getSourceFile().isDeclarationFile);
}

function commonJsExport(ts, checker, node) {
  if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return null;
  const left = unwrap(ts, node.left);
  if (!ts.isPropertyAccessExpression(left) && !ts.isElementAccessExpression(left)) return null;
  const base = unwrap(ts, left.expression), name = propertyName(ts, left);
  if (globalBinding(ts, checker, base, 'module')) return name === 'exports' ? 'default' : name === null ? 'unknown' : null;
  if (globalBinding(ts, checker, base, 'exports')) return name === 'default' ? 'default' : name === null ? 'unknown' : null;
  if ((ts.isPropertyAccessExpression(base) || ts.isElementAccessExpression(base)) && globalBinding(ts, checker, base.expression, 'module') && propertyName(ts, base) === 'exports') {
    return name === 'default' ? 'default' : name === null ? 'unknown' : null;
  }
  return null;
}

function supportedOriginUse(ts, node) {
  let outer = node;
  while (outer.parent && unwrap(ts, outer.parent) === outer) outer = outer.parent;
  const parent = outer.parent;
  if (!parent) return false;
  if ((ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) && parent.expression === outer) return true;
  if (ts.isVariableDeclaration(parent) && (parent.name === outer || (parent.initializer === outer && (ts.getCombinedNodeFlags(parent.parent) & ts.NodeFlags.Const)))) return true;
  if (ts.isImportClause(parent) || ts.isImportSpecifier(parent) || ts.isNamespaceImport(parent) || ts.isImportEqualsDeclaration(parent)
    || ts.isBindingElement(parent) || ts.isTypeQueryNode(parent) || ts.isTypeOfExpression(parent)) return true;
  return false;
}

/** Check declared parser/cache owners and named exports using the target TypeScript projects. */
export function checkNestBoundaries({ root, files, ruleIds, architectureConfig } = {}) {
  const result = { schema: 'starci/code-pattern-script@1', repository: '', files: [], requestedRuleIds: ruleIds ?? [], checkedRuleIds: [], violations: [], errors: [], compiler: null };
  try {
    root = fs.realpathSync(path.resolve(root)); result.repository = root;
    if (!Array.isArray(files) || !files.length || new Set(files).size !== files.length || !Array.isArray(ruleIds) || !ruleIds.length
      || new Set(ruleIds).size !== ruleIds.length || ruleIds.some(id => !NEST_BOUNDARY_RULES.includes(id))) throw Error('Explicit files and unique supported Nest boundary rules are required.');
    for (const file of files) if (!/\.(?:[cm]?ts|tsx)$/.test(file) || /\.d\.[cm]?ts$/.test(file)) throw Error('Boundary checks require non-declaration TypeScript source.'); else safeFile(root, file);
    const contract = readContract(root);
    const config = loadArchitectureConfig(root, architectureConfig);
    const context = buildTypeScriptContext(config);
    result.compiler = { version: context.loaded.version, resolved: context.loaded.resolved };
    if (context.errors.length) throw Error(context.errors.map(error => error.message).join('; '));
    const { ts } = context;
    const selected = new Set(files);
    const contexts = new Map(context.files.map(source => [pathKey(source.fileName), source]));
    for (const parser of contract.envParsers) if (!contexts.has(pathKey(path.resolve(root, parser)))) throw Error(`Env parser is outside the checked source projects: ${parser}`);
    for (const entry of contract.jestLifecycleEntries) if (!contexts.has(pathKey(path.resolve(root, entry)))) throw Error(`Jest lifecycle entry is outside the checked source projects: ${entry}`);
    for (const owner of contract.cacheOwners) for (const token of owner.tokens) {
      const { source, checker } = projectBinding(context, token.file);
      const module = source && checker.getSymbolAtLocation(source);
      const exported = module && checker.getExportsOfModule(module).find(symbol => symbol.name === token.export);
      if (!exported || !tokenIdentity(ts, checker, exported)?.declarations?.length) throw Error(`Declared cache token export cannot be resolved: ${token.path}#${token.export}`);
    }
    const lifecycle = new Set();
    if (ruleIds.includes('NEST_NAMED_EXPORTS') && contract.jestLifecycleEntries.size) {
      const metadata = checkNestMetadata({ root, files: [...contract.jestLifecycleEntries], ruleIds: ['NEST_JEST_ALIAS_PARITY'] });
      if (metadata.errors.length) throw Error(`Jest lifecycle identity unavailable: ${metadata.errors.map(error => error.message).join('; ')}`);
      for (const item of metadata.lifecycleEntries ?? []) lifecycle.add(item);
      for (const declared of contract.jestLifecycleEntries) if (!lifecycle.has(declared)) throw Error(`Declared default-export exception is not a resolved Jest globalSetup/globalTeardown: ${declared}`);
    }
    const add = issueSink(root, result);
    for (const relative of [...selected].sort()) {
      if (!contexts.has(pathKey(path.resolve(root, relative)))) throw Error(`Selected source is outside the checked production TypeScript projects: ${relative}`);
      const { source, checker, program } = projectBinding(context, path.resolve(root, relative));
      const tokens = new Map();
      for (const owner of contract.cacheOwners) for (const token of owner.tokens) {
        const tokenSource = program.getSourceFile(token.file);
        // An unrelated app project need not compile another app's cache owner.
        // Each token was validated in its own source project above.
        if (!tokenSource) continue;
        const module = tokenSource && checker.getSymbolAtLocation(tokenSource);
        const exported = module && checker.getExportsOfModule(module).find(symbol => symbol.name === token.export);
        const identity = exported && tokenIdentity(ts, checker, exported);
        if (!identity?.declarations?.length) throw Error(`Cache token export cannot be resolved in the selected project: ${token.path}#${token.export}`);
        if (tokens.has(identity) && tokens.get(identity).root !== owner.root) throw Error('A raw cache token has conflicting owners.');
        tokens.set(identity, owner);
      }
      const namespaceTypes = new Map();
      const identityAt = expression => {
        const node = unwrap(ts, expression);
        const selected = ts.isPropertyAccessExpression(node) ? node.name : ts.isElementAccessExpression(node) ? node.argumentExpression : node;
        return tokenIdentity(ts, checker, checker.getSymbolAtLocation(selected) ?? (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(selected)
          ? checker.getTypeAtLocation(node.expression).getProperty(selected.text) : null));
      };
      const isRawIdentity = identity => tokens.has(identity) || (identity?.declarations?.some(declaration => ts.isVariableDeclaration(declaration) || ts.isBindingElement(declaration)) && RAW_CACHE_NAMES.has(identity.name));
      const namespaceTokens = node => {
        const type = checker.getTypeAtLocation(node);
        if (namespaceTypes.has(type)) return namespaceTypes.get(type);
        const values = type.getProperties().map(symbol => tokenIdentity(ts, checker, symbol)).filter(identity =>
          tokens.has(identity) || (identity?.declarations?.some(declaration => ts.isVariableDeclaration(declaration) || ts.isBindingElement(declaration)) && RAW_CACHE_NAMES.has(identity.name)));
        namespaceTypes.set(type, values); return values;
      };
      const visit = node => {
        if (ruleIds.includes('NEST_NAMED_EXPORTS') && defaultExport(ts, node) && !lifecycle.has(relative)) add(source, 'NEST_NAMED_EXPORTS', node, 'Source exports are named; only actual declared Jest lifecycle entries may export default.');
        if (ruleIds.includes('NEST_NAMED_EXPORTS')) {
          const cjs = commonJsExport(ts, checker, node);
          if (cjs === 'unknown') add(source, 'NEST_NAMED_EXPORTS', node, 'Computed CommonJS exports make named-export coverage unavailable.', true);
          else if (cjs === 'default' && !lifecycle.has(relative)) add(source, 'NEST_NAMED_EXPORTS', node, 'CommonJS default assignments are not named source exports.');
          if (ts.isIdentifier(node) && ['module', 'exports'].some(name => globalBinding(ts, checker, node, name))
            && !((ts.isPropertyAccessExpression(node.parent) || ts.isElementAccessExpression(node.parent)) && node.parent.expression === node)) {
            add(source, 'NEST_NAMED_EXPORTS', node, 'Escaping or replacing the CommonJS export object makes named-export coverage unavailable.', true);
          }
          if ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) && propertyName(ts, node) === 'exports'
            && globalBinding(ts, checker, node.expression, 'module')) {
            const parent = node.parent;
            if (!((ts.isBinaryExpression(parent) && parent.left === node)
              || ((ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) && parent.expression === node))) {
              add(source, 'NEST_NAMED_EXPORTS', node, 'Aliasing the CommonJS export object makes named-export coverage unavailable.', true);
            }
          }
        }
        if (ruleIds.includes('NEST_ENV_ACCESS') && !contract.envParsers.has(relative)) {
          if ((ts.isIdentifier(node) || ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) || ts.isCallExpression(node))
            && ['process', 'global'].includes(processOrigin(ts, checker, node)) && !supportedOriginUse(ts, node)
            && !(ts.isCallExpression(node) && ts.isAwaitExpression(node.parent))) add(source, 'NEST_ENV_ACCESS', node, 'Raw process/global object escapes a supported immutable alias or direct property access.', true);
          if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
            && processOrigin(ts, checker, node.right)) add(source, 'NEST_ENV_ACCESS', node, 'Assigning a process/environment alias requires a statically immutable boundary binding.', true);
          if (ts.isVariableDeclaration(node) && node.initializer && processOrigin(ts, checker, node.initializer)
            && !(ts.getCombinedNodeFlags(node.parent) & ts.NodeFlags.Const)) add(source, 'NEST_ENV_ACCESS', node, 'Mutable process/environment aliases make boundary coverage unavailable.', true);
          if (ts.isCallExpression(node) && node.arguments.some(argument => ['process', 'global', 'env'].includes(processOrigin(ts, checker, argument)))) {
            add(source, 'NEST_ENV_ACCESS', node, 'Passing the process/environment object to another function leaves the statically checked parser boundary.', true);
          }
          if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
            const origin = processOrigin(ts, checker, node.expression);
            if (origin === 'process' && propertyName(ts, node) === 'env') add(source, 'NEST_ENV_ACCESS', node, 'Read/write environment through the declared config parser.');
            if (origin === 'process' && ts.isElementAccessExpression(node) && propertyName(ts, node) === null) add(source, 'NEST_ENV_ACCESS', node, 'Computed access on the process object cannot prove the environment boundary.', true);
            if (origin === 'global' && ts.isElementAccessExpression(node) && propertyName(ts, node) === null) add(source, 'NEST_ENV_ACCESS', node, 'Computed access on the global object cannot prove the process/environment boundary.', true);
          }
          if (ts.isBindingElement(node) && processOrigin(ts, checker, node.name) === 'env') add(source, 'NEST_ENV_ACCESS', node, 'Destructured environment access belongs to the declared config parser.');
          if (ts.isImportSpecifier(node) && processOrigin(ts, checker, node.name) === 'env') add(source, 'NEST_ENV_ACCESS', node, 'Imported environment access belongs to the declared config parser.');
          if (ts.isIdentifier(node) && processOrigin(ts, checker, node) === 'env' && !ts.isImportSpecifier(node.parent) && !ts.isBindingElement(node.parent)
            && !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)) add(source, 'NEST_ENV_ACCESS', node, 'Environment aliases cannot leave the declared config parser.');
        }
        if (ruleIds.includes('NEST_CACHE_TOKEN_BOUNDARY') && (ts.isIdentifier(node) || ts.isElementAccessExpression(node))) {
          const lookup = ts.isElementAccessExpression(node) ? node.argumentExpression : node;
          const rawSymbol = checker.getSymbolAtLocation(lookup) ?? (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(lookup)
            ? checker.getTypeAtLocation(node.expression).getProperty(lookup.text) : null);
          const identity = tokenIdentity(ts, checker, rawSymbol);
          const owner = tokens.get(identity);
          const declarations = identity?.declarations ?? [];
          const variableToken = declarations.some(declaration => ts.isVariableDeclaration(declaration) || ts.isBindingElement(declaration));
          const raw = owner || (variableToken && RAW_CACHE_NAMES.has(identity.name));
          if (raw && (!owner || !isInside(owner.absolute, source.fileName))) add(source, 'NEST_CACHE_TOKEN_BOUNDARY', node, owner
            ? `Raw cache token belongs inside ${owner.root}; consume the cache capability API.`
            : 'Raw cache token has no declared owner; bind its real exported declaration.');
          if (ts.isIdentifier(node) && ts.isImportSpecifier(node.parent) && node.parent.name === node && RAW_CACHE_NAMES.has(node.parent.propertyName?.text ?? node.text)
            && !identity?.declarations?.length) add(source, 'NEST_CACHE_TOKEN_BOUNDARY', node, 'Selected raw cache import cannot be resolved.', true);
          if (ts.isElementAccessExpression(node) && !ts.isStringLiteralLike(lookup)) {
            if (namespaceTokens(node.expression).length) {
              add(source, 'NEST_CACHE_TOKEN_BOUNDARY', node, 'Computed selection from an object exposing raw cache tokens is unavailable.', true);
            }
          }
        }
        if (ruleIds.includes('NEST_CACHE_TOKEN_BOUNDARY') && (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))) {
          const exposed = namespaceTokens(node);
          if (exposed.some(identity => !tokens.has(identity) || !isInside(tokens.get(identity).absolute, source.fileName)) && !supportedOriginUse(ts, node)) {
            add(source, 'NEST_CACHE_TOKEN_BOUNDARY', node, 'An object exposing raw cache tokens escapes supported immutable aliases or direct property selection.', true);
          }
        }
        if (ruleIds.includes('NEST_CACHE_TOKEN_BOUNDARY') && ts.isFunctionLike(node) && node.body) {
          const returned = [];
          const collect = child => {
            if (child !== node.body && ts.isFunctionLike(child)) return;
            if (ts.isReturnStatement(child) && child.expression) returned.push(child.expression);
            ts.forEachChild(child, collect);
          };
          if (ts.isBlock(node.body)) collect(node.body); else returned.push(node.body);
          for (const value of returned) if (isRawIdentity(identityAt(value))) {
            add(source, 'NEST_CACHE_TOKEN_BOUNDARY', value, 'Returning a raw cache token through a function hides token ownership; expose the declared token binding or a capability operation.', true);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source); result.files.push(relative);
    }
    if (!result.errors.length) result.checkedRuleIds = [...ruleIds].sort();
  } catch (error) { result.errors.push({ message: String(error.message) }); }
  return result;
}
