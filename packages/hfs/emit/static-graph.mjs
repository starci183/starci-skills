/**
 * What a Nest application serves over GraphQL, read from its SOURCE: the module graph an app root composes and the resolver
 * classes Nest GraphQL's explorers would collect from it. Nothing is executed and no configuration is needed: the app root and
 * every module it reaches are parsed with the TypeScript compiler API and their `@Module` metadata and static registration
 * methods (`register`, `forRoot`, ...) are interpreted symbolically. The interpretation is lazy and only follows what decides
 * the graph: module imports, providers, `forwardRef`, spreads, conditionals (both branches are taken: the contract is the
 * superset a deployment can serve), static methods called with the options of a deployment (unknown values), the options of
 * `GraphQLModule.forRoot` / `forRootAsync`.
 *
 * Mirrors Nest: a module's providers are the `@Module({ providers })` of its class plus the `providers` of a dynamic module;
 * likewise its imports. A GraphQL server reads the providers of EVERY module of the application unless its options carry
 * `include`, which whitelists module classes and their transitive imports (Nest's `BaseExplorerService.getModules`).
 *
 * Anything the interpreter cannot decide in a position that decides the graph (a module import or a provider list) is an
 * error naming the file and line: an answer is exact or it is not given.
 *
 * Injected: `ts` (the TypeScript module), `host.read(file)` (text or null) and `host.resolve(fromFile, specifier)` (an
 * absolute file of the repository, or null for an external package). Pure of the file system otherwise.
 */

const NEST_COMMON = '@nestjs/common';
const NEST_GRAPHQL = '@nestjs/graphql';

/** GraphQL server options that change the printed schema and that this reader does not model: presence is an error. */
const SCHEMA_OPTIONS_NOT_MODELED = ['buildSchemaOptions', 'typeDefs', 'schema', 'transformSchema', 'transformAutoSchemaFile'];

const undef = { t: 'undef' };
const free = (why) => ({ t: 'free', why });

export function createGraphReader({ ts, host }) {
  const files = new Map();
  const classes = new Map();
  const thunks = new WeakMap();

  const where = (node) => {
    const sf = node.getSourceFile();
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    return `${sf.fileName}:${line + 1}`;
  };

  // ---- files: imports, declarations, exports ----
  function info(file) {
    if (files.has(file)) return files.get(file);
    const text = host.read(file);
    if (text === null || text === undefined) throw new Error(`cannot read ${file}`);
    const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const record = { sourceFile, imports: new Map(), decls: new Map(), exports: new Map(), stars: [] };
    files.set(file, record);
    const exported = (node) => (ts.getSyntacticModifierFlags(node) & ts.ModifierFlags.Export) !== 0;
    const isDefault = (node) => (ts.getSyntacticModifierFlags(node) & ts.ModifierFlags.Default) !== 0;
    for (const statement of sourceFile.statements) {
      if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
        const spec = statement.moduleSpecifier.text;
        const clause = statement.importClause;
        if (!clause) continue;
        if (clause.name) record.imports.set(clause.name.text, { spec, name: 'default' });
        if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
          for (const element of clause.namedBindings.elements) record.imports.set(element.name.text, { spec, name: (element.propertyName ?? element.name).text });
        } else if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) record.imports.set(clause.namedBindings.name.text, { spec, name: '*' });
      } else if ((ts.isClassDeclaration(statement) || ts.isFunctionDeclaration(statement)) && statement.name) {
        record.decls.set(statement.name.text, { kind: ts.isClassDeclaration(statement) ? 'class' : 'function', node: statement });
        if (exported(statement)) record.exports.set(isDefault(statement) ? 'default' : statement.name.text, { local: statement.name.text });
      } else if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) {
            record.decls.set(declaration.name.text, { kind: 'var', node: declaration });
            if (exported(statement)) record.exports.set(declaration.name.text, { local: declaration.name.text });
          } else {
            for (const element of declaration.name.elements ?? []) {
              if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
                record.decls.set(element.name.text, { kind: 'opaque', node: element });
                if (exported(statement)) record.exports.set(element.name.text, { local: element.name.text });
              }
            }
          }
        }
      } else if (ts.isEnumDeclaration(statement)) {
        record.decls.set(statement.name.text, { kind: 'opaque', node: statement });
        if (exported(statement)) record.exports.set(statement.name.text, { local: statement.name.text });
      } else if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) {
        const spec = statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier) ? statement.moduleSpecifier.text : null;
        if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
          for (const element of statement.exportClause.elements) {
            if (element.isTypeOnly) continue;
            record.exports.set(element.name.text, spec ? { spec, name: (element.propertyName ?? element.name).text } : { local: (element.propertyName ?? element.name).text });
          }
        } else if (!statement.exportClause && spec) record.stars.push(spec);
      } else if (ts.isExportAssignment(statement)) record.exports.set('default', { expression: statement.expression });
    }
    return record;
  }

  const target = (file, spec) => host.resolve(file, spec);

  /** A top-level name of a file: its own declaration, or what an import binding leads to. */
  function resolveName(file, name, seen = new Set()) {
    const key = `${file}#${name}`;
    if (seen.has(key)) return null;
    seen.add(key);
    const record = info(file);
    const decl = record.decls.get(name);
    if (decl) return { file, name, ...decl };
    const binding = record.imports.get(name);
    if (!binding) return null;
    const to = target(file, binding.spec);
    if (to === null) return { ext: binding.spec, name: binding.name };
    if (binding.name === '*') return { opaque: true };
    return resolveExport(to, binding.name, seen);
  }

  /** A name a file exports, followed through re-exports and `export *`. */
  function resolveExport(file, name, seen = new Set()) {
    const record = info(file);
    const entry = record.exports.get(name);
    if (entry?.local) return resolveName(file, entry.local, seen);
    if (entry?.spec) {
      const to = target(file, entry.spec);
      return to === null ? { ext: entry.spec, name: entry.name } : resolveExport(to, entry.name, seen);
    }
    if (entry?.expression) return { file, name, kind: 'expression', node: entry.expression };
    for (const spec of record.stars) {
      const to = target(file, spec);
      if (to === null) continue;
      const found = resolveExport(to, name, seen);
      if (found) return found;
    }
    return null;
  }

  const classRef = (found) => {
    const key = `${found.file}#${found.name}`;
    if (!classes.has(key)) classes.set(key, { t: 'class', file: found.file, name: found.name, node: found.node });
    return classes.get(key);
  };

  // ---- values ----
  const thunk = (node, env) => {
    const key = env.cache;
    if (!thunks.has(key)) thunks.set(key, new Map());
    const memo = thunks.get(key);
    if (!memo.has(node)) memo.set(node, { t: 'thunk', node, env, done: false, value: undefined });
    return memo.get(node);
  };
  const lazy = (compute) => ({ t: 'thunk', compute, done: false, value: undefined });
  const force = (value) => {
    let current = value;
    while (current && current.t === 'thunk') {
      if (!current.done) {
        if (current.forcing) return free('circular value');
        current.forcing = true;
        current.value = current.compute ? current.compute() : ev(current.node, current.env);
        current.forcing = false;
        current.done = true;
      }
      current = current.value;
    }
    return current;
  };
  const newEnv = (file, extra = {}) => ({ file, vars: new Map(), cache: {}, depth: 0, ...extra });

  const TRANSPARENT = new Set([ts.SyntaxKind.ParenthesizedExpression, ts.SyntaxKind.AsExpression, ts.SyntaxKind.SatisfiesExpression, ts.SyntaxKind.NonNullExpression, ts.SyntaxKind.TypeAssertionExpression, ts.SyntaxKind.AwaitExpression]);
  const unwrapped = (node) => {
    let current = node;
    while (TRANSPARENT.has(current.kind)) current = current.expression;
    return current;
  };

  function ev(rawNode, env) {
    const node = unwrapped(rawNode);
    if (env.depth > 60) return free('evaluation too deep');
    if (ts.isIdentifier(node)) return identifier(node.text, node, env);
    if (ts.isArrayLiteralExpression(node)) return { t: 'arr', items: node.elements.map((element) => (ts.isSpreadElement(element) ? { t: 'spread', v: thunk(element.expression, env) } : thunk(element, env))) };
    if (ts.isObjectLiteralExpression(node)) return objectLiteral(node, env);
    if (ts.isConditionalExpression(node)) return { t: 'alt', alts: [thunk(node.whenTrue, env), thunk(node.whenFalse, env)] };
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind;
      if (op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.BarBarToken) return { t: 'alt', alts: [thunk(node.left, env), thunk(node.right, env)] };
      if (op === ts.SyntaxKind.AmpersandAmpersandToken) return { t: 'alt', alts: [thunk(node.right, env), undef] };
      if (op === ts.SyntaxKind.EqualsToken) return thunk(node.right, env);
      return free('binary expression');
    }
    if (ts.isPropertyAccessExpression(node)) return member(thunk(node.expression, env), node.name.text);
    if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) return member(thunk(node.expression, env), node.argumentExpression.text);
    if (ts.isCallExpression(node)) return call(node, env);
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return { t: 'fn', node, env };
    if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) return { t: 'lit', v: node.text };
    if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) return { t: 'lit', v: node.kind === ts.SyntaxKind.TrueKeyword };
    if (node.kind === ts.SyntaxKind.NullKeyword) return undef;
    return free(`unmodelled expression ${ts.SyntaxKind[node.kind]}`);
  }

  function identifier(name, node, env) {
    if (env.vars.has(name)) return env.vars.get(name);
    if (name === 'undefined') return undef;
    const found = resolveName(env.file, name);
    if (!found) return free(`unresolved name ${name}`);
    return declared(found);
  }

  function declared(found) {
    if (found.ext) return { t: 'ext', spec: found.ext, name: found.name };
    if (found.opaque || found.kind === 'opaque') return free('opaque declaration');
    if (found.kind === 'class') return classRef(found);
    const env = newEnv(found.file);
    if (found.kind === 'function') return { t: 'fn', node: found.node, env };
    if (found.kind === 'expression') return thunk(found.node, env);
    const initializer = found.node.initializer;
    return initializer ? thunk(initializer, newEnv(found.file, { cache: found.node })) : free('declaration without a value');
  }

  function objectLiteral(node, env) {
    const props = new Map();
    let open = false;
    for (const property of node.properties) {
      if (ts.isPropertyAssignment(property) && (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name))) props.set(property.name.text, thunk(property.initializer, env));
      else if (ts.isShorthandPropertyAssignment(property)) props.set(property.name.text, thunk(property.name, env));
      else if (ts.isSpreadAssignment(property)) {
        const spread = force(thunk(property.expression, env));
        if (spread.t === 'obj') {
          for (const [key, value] of spread.props) props.set(key, value);
          open = open || spread.open;
        } else if (spread.t === 'dyn') {
          props.set('module', spread.module);
          props.set('imports', { t: 'arr', items: spread.imports });
          props.set('providers', { t: 'arr', items: spread.providers });
        } else open = true;
      } else if (ts.isMethodDeclaration(property) && ts.isIdentifier(property.name)) props.set(property.name.text, { t: 'fn', node: property, env });
      else open = true;
    }
    return { t: 'obj', props, open };
  }

  function member(baseThunk, key) {
    return lazy(() => {
      const base = force(baseThunk);
      switch (base.t) {
        case 'obj':
          return base.props.get(key) ?? (base.open ? free(`property ${key} of an open object`) : undef);
        case 'dyn':
          return key === 'module' ? base.module : key === 'imports' || key === 'providers' ? { t: 'arr', items: base[key] } : undef;
        case 'alt':
          return { t: 'alt', alts: base.alts.map((alt) => member(alt, key)) };
        case 'class': {
          const property = base.node.members.find((item) => ts.isPropertyDeclaration(item) && item.name && ts.isIdentifier(item.name) && item.name.text === key && item.initializer);
          return property ? thunk(property.initializer, newEnv(base.file, { cache: property })) : free(`static ${key} of ${base.name}`);
        }
        case 'undef':
          return undef;
        default:
          return free(`property ${key} of ${base.t}`);
      }
    });
  }

  // ---- calls ----
  function call(node, env) {
    const callee = unwrapped(node.expression);
    const args = node.arguments.map((argument) => thunk(argument, env));
    if (callee.kind === ts.SyntaxKind.SuperKeyword) return free('super call');
    if (ts.isPropertyAccessExpression(callee)) {
      if (callee.expression.kind === ts.SyntaxKind.SuperKeyword) return superCall(env);
      const base = force(thunk(callee.expression, env));
      return methodCall(base, callee.name.text, args, node);
    }
    const target = force(thunk(callee, env));
    if (target.t === 'ext' && target.spec === NEST_COMMON && target.name === 'forwardRef') return args[0] ? lazy(() => callFunction(force(args[0]), [])) : free('forwardRef without a value');
    if (target.t === 'fn') return callFunction(target, args);
    return free(`call of ${target.t}`);
  }

  /** `super.register(...)` of a class built on Nest's ConfigurableModuleBuilder: the class itself, no user additions. */
  const superCall = (env) => ({ t: 'dyn', module: env.thisClass ?? free('super outside a class'), imports: [], providers: [], args: [] });

  /** Array methods over a list whose items are known (`arr`) or unknown (`free`: one representative item). */
  function arrayMethod(base, name, args) {
    const items = base.t === 'arr' ? base.items : [free('an item of a list from the options of a deployment')];
    if (name === 'map' || name === 'flatMap') {
      const fn = args[0] ? force(args[0]) : null;
      return fn?.t === 'fn' ? { t: 'arr', items: items.map((item) => callFunction(fn, [item, undef])) } : free(`${name} without a function`);
    }
    if (name === 'filter' || name === 'slice' || name === 'sort' || name === 'reverse') return base;
    if (name === 'concat') return { t: 'arr', items: [{ t: 'spread', v: base }, ...args.map((argument) => ({ t: 'spread', v: argument }))] };
    return null;
  }

  function methodCall(base, name, args, node) {
    if ((base.t === 'arr' || base.t === 'free') && ['map', 'flatMap', 'filter', 'slice', 'sort', 'reverse', 'concat'].includes(name)) {
      const result = arrayMethod(base, name, args);
      if (result) return result;
    }
    if (base.t === 'alt') return { t: 'alt', alts: base.alts.map((alt) => lazy(() => methodCall(force(alt), name, args, node))) };
    if (base.t === 'ext') return { t: 'dyn', module: base, imports: listOf(args[0], 'imports'), providers: [], args, ext: name };
    if (base.t === 'class') {
      const found = staticMethod(base, name);
      if (found) return callFunction({ t: 'fn', node: found.method, env: newEnv(found.owner.file, { thisClass: base }) }, args);
      return { t: 'dyn', module: base, imports: [], providers: [], args };
    }
    return free(`method ${name} of ${base.t} at ${where(node)}`);
  }

  /** The static method of a class or of its in-repository base classes; null when none (the base is external). */
  function staticMethod(cls, name) {
    const method = cls.node.members.find((item) => ts.isMethodDeclaration(item) && item.name && ts.isIdentifier(item.name) && item.name.text === name && (ts.getSyntacticModifierFlags(item) & ts.ModifierFlags.Static) !== 0 && item.body);
    if (method) return { method, owner: cls };
    const heritage = cls.node.heritageClauses?.find((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword)?.types[0];
    if (!heritage) return null;
    const base = force(thunk(heritage.expression, newEnv(cls.file)));
    return base.t === 'class' ? staticMethod(base, name) : null;
  }

  /** The `imports` array a call's first argument carries (forRootAsync-style options), as a list of thunks. */
  function listOf(argument, key) {
    if (!argument) return [];
    const options = force(argument);
    if (options.t !== 'obj' || !options.props.has(key)) return [];
    return [options.props.get(key)];
  }

  function callFunction(fn, args) {
    if (fn.t !== 'fn') return free(`call of ${fn.t}`);
    const env = newEnv(fn.env.file, { ...fn.env, vars: new Map(fn.env.vars), depth: fn.env.depth + 1, cache: {} });
    fn.node.parameters.forEach((parameter, index) => bindParameter(parameter.name, args[index] ?? undef, env));
    const body = fn.node.body;
    if (!body) return free('function without a body');
    if (!ts.isBlock(body)) return thunk(body, env);
    const returns = [];
    runStatements(body.statements, env, returns);
    return returns.length === 0 ? undef : returns.length === 1 ? returns[0] : { t: 'alt', alts: returns };
  }

  function bindParameter(name, value, env) {
    if (ts.isIdentifier(name)) env.vars.set(name.text, value);
    else if (ts.isObjectBindingPattern(name)) {
      for (const element of name.elements) {
        const key = (element.propertyName ?? element.name).text;
        if (ts.isIdentifier(element.name)) env.vars.set(element.name.text, member(value, key));
      }
    }
  }

  function runStatements(statements, env, returns) {
    for (const statement of statements) {
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (declaration.initializer) bindParameter(declaration.name, thunk(declaration.initializer, env), env);
        }
      } else if (ts.isReturnStatement(statement)) returns.push(statement.expression ? thunk(statement.expression, env) : undef);
      else if (ts.isIfStatement(statement)) {
        for (const branch of [statement.thenStatement, statement.elseStatement]) {
          if (!branch) continue;
          runStatements(ts.isBlock(branch) ? branch.statements : [branch], env, returns);
        }
      } else if (ts.isBlock(statement)) runStatements(statement.statements, env, returns);
    }
  }

  // ---- modules ----
  const decoratorsOf = (node) => (ts.canHaveDecorators?.(node) ? ts.getDecorators(node) ?? [] : node.decorators ?? []);

  /** The `@Module({...})` metadata object of a class (an obj value), or null. */
  function moduleMetadata(cls) {
    for (const decorator of decoratorsOf(cls.node)) {
      const expression = decorator.expression;
      if (!ts.isCallExpression(expression)) continue;
      const callee = force(thunk(expression.expression, newEnv(cls.file)));
      if (callee.t === 'ext' && callee.spec === NEST_COMMON && callee.name === 'Module') {
        const argument = expression.arguments[0];
        return argument ? force(thunk(argument, newEnv(cls.file, { thisClass: cls }))) : { t: 'obj', props: new Map(), open: false };
      }
    }
    return null;
  }

  /** Flattens a value into its module/provider entries: arrays, spreads and both branches of a conditional. */
  function entries(value, out = []) {
    const v = force(value);
    if (v.t === 'arr') for (const item of v.items) entries(item.t === 'spread' ? item.v : item, out);
    else if (v.t === 'alt') for (const alt of v.alts) entries(alt, out);
    else if (v.t !== 'undef' && !(v.t === 'lit' && v.v === false)) out.push(v);
    return out;
  }

  const isGraphqlServer = (module) => module.t === 'ext' && module.spec === NEST_GRAPHQL && module.name === 'GraphQLModule';

  /** A module entry as `{ module, dyn }`: a class, an external module, a dynamic module, or a `{ module, ... }` literal. */
  function normalize(value, origin) {
    if (value.t === 'class' || value.t === 'ext') return { module: value, dyn: null, key: value.t === 'class' ? value : `${value.spec}#${value.name}` };
    if (value.t === 'dyn') return { module: force(value.module), dyn: value, key: value };
    if (value.t === 'obj' && value.props.has('module')) {
      const dyn = { t: 'dyn', module: value.props.get('module'), imports: value.props.has('imports') ? [value.props.get('imports')] : [], providers: value.props.has('providers') ? [value.props.get('providers')] : [], args: [] };
      return { module: force(dyn.module), dyn, key: value };
    }
    throw new Error(`${origin}: an import cannot be decided (${value.why ?? value.t})`);
  }

  /**
   * Walks the module graph from a root entry. Answers the module instances `{ module, providers, imports, server }` in
   * discovery order; `imports` are instances of the same list. A static class is one instance; every dynamic module value is
   * its own instance (Nest keys them by their metadata).
   */
  function walk(root) {
    const order = [];
    const seen = new Map();
    function visit(entry, origin) {
      const nodes = [];
      for (const value of entries(entry)) {
        const { module, dyn, key } = normalize(value, origin);
        if (module.t === 'free') throw new Error(`${origin}: a dynamic module's class cannot be decided (${module.why})`);
        if (seen.has(key)) {
          nodes.push(seen.get(key));
          continue;
        }
        const node = { module, dynamic: dyn, providers: [], imports: [], server: null };
        seen.set(key, node);
        order.push(node);
        nodes.push(node);
        const children = [];
        const statics = module.t === 'class' ? moduleMetadata(module) : null;
        if (statics?.props.has('imports')) children.push(statics.props.get('imports'));
        if (statics?.props.has('providers')) node.providers.push(statics.props.get('providers'));
        if (dyn) {
          children.push(...dyn.imports);
          node.providers.push(...dyn.providers);
          if (isGraphqlServer(module)) node.server = dyn;
        }
        const name = module.t === 'class' ? `${module.name} (${module.file})` : `${module.name}`;
        for (const child of children) node.imports.push(...visit(child, name));
      }
      return nodes;
    }
    visit(root, 'the application root');
    return order;
  }

  /** The instances of the modules a GraphQL server reads: all of them, or the `include` whitelist and its transitive imports. */
  function servedNodes(nodes, include) {
    if (include.length === 0) return nodes;
    const served = new Set();
    const pending = nodes.filter((node) => include.includes(node.module));
    while (pending.length) {
      const node = pending.pop();
      if (served.has(node)) continue;
      served.add(node);
      pending.push(...node.imports);
    }
    return nodes.filter((node) => served.has(node));
  }

  /** The provider classes of instances: plain class providers and `useClass` providers, unique, in order. */
  function providerClasses(nodes) {
    const found = [];
    for (const node of nodes) {
      for (const list of node.providers) {
        for (const provider of entries(list)) {
          const cls = provider.t === 'class' ? provider : provider.t === 'obj' && provider.props.has('useClass') ? force(provider.props.get('useClass')) : null;
          if (provider.t === 'free') throw new Error(`${node.module.name ?? 'a module'}: a provider list cannot be decided (${provider.why})`);
          if (cls && cls.t === 'class' && !found.includes(cls)) found.push(cls);
        }
      }
    }
    return found;
  }

  /** True when a class carries `@Resolver` or `@Scalar` of @nestjs/graphql (by where the decorator was imported from). */
  function graphqlKind(cls) {
    for (const decorator of decoratorsOf(cls.node)) {
      const expression = ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression;
      const callee = force(thunk(expression, newEnv(cls.file)));
      if (callee.t === 'ext' && callee.spec === NEST_GRAPHQL && (callee.name === 'Resolver' || callee.name === 'Scalar')) return callee.name;
    }
    return null;
  }

  /** The options of a GraphQL server: its literal, or what the factory of `forRootAsync` returns. */
  function serverOptions(server, origin) {
    const argument = server.args[0];
    if (!argument) return { include: [] };
    let options = force(argument);
    if (options.t === 'obj' && options.props.has('useFactory')) {
      const result = callFunction(force(options.props.get('useFactory')), (options.props.has('inject') ? entries(options.props.get('inject')) : []).map(() => free('injected value')));
      options = force(result);
    }
    const objects = options.t === 'alt' ? options.alts.map(force) : [options];
    const props = new Map();
    for (const object of objects) {
      if (object.t !== 'obj') throw new Error(`${origin}: the GraphQL server options cannot be decided (${object.why ?? object.t})`);
      for (const [key, value] of object.props) props.set(key, value);
    }
    for (const key of SCHEMA_OPTIONS_NOT_MODELED) {
      if (props.has(key)) throw new Error(`${origin}: GraphQL server option ${key} changes the schema and is not modeled by this reader`);
    }
    const auto = props.has('autoSchemaFile') ? force(props.get('autoSchemaFile')) : undef;
    if (auto.t === 'undef' || (auto.t === 'lit' && auto.v === false)) throw new Error(`${origin}: the GraphQL server is not code-first (no autoSchemaFile)`);
    const include = props.has('include') ? entries(props.get('include')) : [];
    if (include.some((item) => item.t !== 'class')) throw new Error(`${origin}: the GraphQL include list cannot be decided`);
    return { include };
  }

  /**
   * Composes an app root file. Answers null when the file exports no `AppModule` class or its module graph holds no GraphQL server, else
   * `{ resolvers: [{ file, name }], scalars: [{ file, name }], include: [{ file, name }] }`.
   */
  function compose(appFile, exportName = 'AppModule') {
    const found = resolveExport(appFile, exportName);
    if (!found || found.kind !== 'class') return null;
    const root = classRef(found);
    const register = staticMethod(root, 'register');
    const rootValue = register ? { t: 'arr', items: [root, callFunction({ t: 'fn', node: register.method, env: newEnv(register.owner.file, { thisClass: root }) }, [free('the options of a deployment')])] } : root;
    const nodes = walk(rootValue);
    const servers = nodes.filter((node) => node.server);
    if (servers.length === 0) return null;
    if (servers.length > 1) throw new Error(`${appFile} composes ${servers.length} GraphQL servers; a contract snapshot describes exactly one`);
    const { include } = serverOptions(servers[0].server, `${exportName} of ${appFile}`);
    const classesOf = providerClasses(servedNodes(nodes, include));
    const pick = (kind) => classesOf.filter((cls) => graphqlKind(cls) === kind).map((cls) => ({ file: cls.file, name: cls.name }));
    return { resolvers: pick('Resolver'), scalars: pick('Scalar'), include: include.map((cls) => ({ file: cls.file, name: cls.name })) };
  }

  return { compose };
}
