import path from 'node:path';

/**
 * The constructor dependencies of a service, read the way the injection law (R85) writes them, shared by the unit-spec
 * provider check (R48 `unit-spec-providers`) and the token export check (R85 `injection-token-exported`).
 *
 * A constructor parameter is one of
 *   - `token`: decorated with a custom `Inject<Thing>()` decorator. The decorator is declared in a `<cap>.decorators.ts`
 *     as `injector<T>(TOKEN)`; the dependency is the TOKEN it names, identified by the name the token is exported under
 *     (the declaration's own name), never by the decorator's or the parameter's name. A raw `@Inject(TOKEN)` is read the same way.
 *   - `class`: no injection decorator and a class type; the dependency is that class.
 *   - `unresolved`: anything else (a token expression that is not a plain identifier, a decorator the reader cannot follow,
 *     a type that is not a class).
 */
const INJECT_NAME = /^Inject(?:[A-Z][A-Za-z0-9]*)?$/u;

/** The identifier a decorator names: `@InjectFoo()` -> InjectFoo, `@Inject(TOKEN)` -> Inject; null for a non-identifier decorator. */
function decoratorCallee(ts, decorator) {
  const expression = decorator.expression;
  const callee = ts.isCallExpression(expression) ? expression.expression : expression;
  return ts.isIdentifier(callee) ? { callee, call: ts.isCallExpression(expression) ? expression : null } : null;
}

/** The token a `injector(<arg>)` call names, judged where the argument is declared. */
function tokenOfArgument(kit, checker, argument) {
  const { ts } = kit;
  if (!argument || !ts.isIdentifier(argument)) return { kind: 'unresolved', reason: 'its token is not a plain identifier of an exported const', node: argument ?? null };
  const declaration = kit.declarationsOf(checker, argument).find(item => ts.isVariableDeclaration(item) || ts.isBindingElement(item));
  if (declaration) {
    const name = ts.isIdentifier(declaration.name) ? declaration.name.text : argument.text;
    return { kind: 'token', name, declaration, argument, external: false };
  }
  const binding = kit.importBinding(checker, argument);
  if (binding && !binding.module.startsWith('.')) return { kind: 'token', name: binding.name, declaration: null, argument, external: true };
  return { kind: 'unresolved', reason: `the token ${argument.text} does not resolve to a declaration`, node: argument };
}

/** The first `injector(...)` call under a decorator declaration, or null. */
function injectorCallOf(kit, declaration) {
  const { ts } = kit;
  let injectorCall = null;
  kit.walk(declaration, node => {
    if (injectorCall) return false;
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const binding = kit.importBinding(kit.checkerOf(declaration.getSourceFile()), node.expression);
      if ((binding?.name ?? node.expression.text) === 'injector') injectorCall = node;
    }
    return true;
  });
  return injectorCall;
}

/** The injector token of a custom `Inject<Thing>()` decorator, or an unresolved reason. */
function tokenOfInjectDecorator(kit, checker, parameter, decorator) {
  const { ts } = kit;
  const head = decoratorCallee(ts, decorator);
  if (!head || !INJECT_NAME.test(head.callee.text)) return null;
  if (head.callee.text === 'Inject' && head.call?.arguments.length) return { ...tokenOfArgument(kit, checker, head.call.arguments[0]), decorator: head.callee.text, decoratorDeclaration: null, decoratorFile: null };
  const declaration = kit.declarationsOf(checker, head.callee).find(item => ts.isVariableDeclaration(item) || ts.isFunctionDeclaration(item));
  if (!declaration) return { kind: 'unresolved', reason: `${head.callee.text}() does not resolve to a declaration`, node: parameter, decorator: head.callee.text };
  const injectorCall = injectorCallOf(kit, declaration);
  if (!injectorCall) return { kind: 'unresolved', reason: `${head.callee.text}() is not built with injector<T>(TOKEN)`, node: parameter, decorator: head.callee.text };
  const declarationChecker = kit.checkerOf(declaration.getSourceFile());
  return { ...tokenOfArgument(kit, declarationChecker, injectorCall.arguments[0]), decorator: head.callee.text, decoratorDeclaration: declaration, injectorCall };
}

/** The class a parameter type names, judged where the type is declared; null when it is not a class type. */
function classOfType(kit, checker, type) {
  const { ts } = kit;
  if (!type || !ts.isTypeReferenceNode(type) || !ts.isIdentifier(type.typeName)) return null;
  const declarations = kit.declarationsOf(checker, type.typeName);
  const declared = declarations.find(item => ts.isClassDeclaration(item) && item.name);
  if (declared) return declared.name.text;
  if (declarations.length) return null;
  const binding = kit.importBinding(checker, type.typeName);
  return binding && binding.name !== 'default' && binding.name !== '*' ? binding.name : null;
}

/** The dependencies of one class, in constructor order: [{kind, name?, node, parameter, ...}]. */
export function constructorDependencies(kit, file, classDeclaration) {
  const { ts } = kit;
  const checker = kit.checkerOf(file.sourceFile);
  const constructor = classDeclaration.members.find(member => ts.isConstructorDeclaration(member) && member.body !== undefined)
    ?? classDeclaration.members.find(member => ts.isConstructorDeclaration(member));
  if (!constructor) return [];
  return constructor.parameters.map(parameter => {
    for (const decorator of kit.decorators(parameter)) {
      const token = tokenOfInjectDecorator(kit, checker, parameter, decorator);
      if (token) return { ...token, parameter, node: token.node ?? parameter };
    }
    const name = classOfType(kit, checker, parameter.type);
    if (name) return { kind: 'class', name, parameter, node: parameter };
    return { kind: 'unresolved', reason: 'it has no Inject<Thing>() decorator and its type is not a class', parameter, node: parameter };
  });
}

/** Every service class of the program: [{file, declaration}] for each class of a `*.service.ts` file. */
export function serviceClasses(kit, graph) {
  const { ts } = kit;
  const found = [];
  for (const file of graph.files.values()) {
    if (!path.posix.basename(file.rel).endsWith('.service.ts')) continue;
    for (const statement of file.sourceFile.statements) if (ts.isClassDeclaration(statement) && statement.name) found.push({ file, declaration: statement });
  }
  return found;
}
