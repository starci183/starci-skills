// module-index.mjs - the top-level shape of one ES module, read with acorn: its declarations, what each uses, its imports and its exports.
//
// The index is what a symbol-level selection (scripts/supervisor/affected-symbols.mjs) needs and nothing more: no scopes, no types. A name used inside
// a declaration is recorded by its spelling whether or not an inner binding shadows it, so the index over-reports uses and never misses one.
import path from 'node:path';
import { createRequire } from 'node:module';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { boundNames } from './ast-names.mjs';
import { spawnedEntriesOf } from './spec-deps.mjs';

const SKIPPED_KEYS = new Set(['type', 'start', 'end', 'loc', 'range']);

/** The acorn syntax tree of a module's source, or null when it does not parse. */
function parseModule(text) {
  const acorn = createRequire(path.join(skillRoot, 'packages', 'node_modules', 'x.js'))('acorn');
  try { return acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true, allowReturnOutsideFunction: true }); } catch { return null; }
}

const isNode = (value) => Boolean(value) && typeof value === 'object' && typeof value.type === 'string';
const stringOf = (node) => (node?.type === 'Literal' && typeof node.value === 'string' ? node.value : null);
const nameOf = (node) => (node.type === 'Identifier' ? node.name : String(node.value));
const children = (node) => Object.keys(node).filter((key) => !SKIPPED_KEYS.has(key)).flatMap((key) => (Array.isArray(node[key]) ? node[key] : [node[key]])).filter(isNode);

const newUses = () => ({ refs: new Set(), members: new Map(), dynamics: [] });

/** Whether a declaration (or the module level) uses the import `local`: bare, or - when `member` is given - through `local.member` as well. */
export function usesLocal(uses, local, member = null) {
  if (uses.refs.has(local)) return true;
  return member === null ? uses.members.has(local) : Boolean(uses.members.get(local)?.has(member));
}

// Whether a variable initialiser makes a binding that code can fill in later: no initialiser, `new X(...)`, an empty array or object literal. A
// declaration that writes such a binding changes what every other declaration reading it sees.
const holdsState = (init) => !init || init.type === 'NewExpression' || (init.type === 'ArrayExpression' && !init.elements.length) || (init.type === 'ObjectExpression' && !init.properties.length);

const usedNames = (decl) => [...decl.refs, ...decl.members.keys()];

function addUsers(index, reached) {
  let grew = false;
  for (const decl of index.decls.values()) {
    if (!reached.has(decl.name) && [...reached].some((name) => usesLocal(decl, name))) { reached.add(decl.name); grew = true; }
  }
  return grew;
}

function addSharedState(index, reached) {
  let grew = false;
  for (const name of reached) {
    for (const used of usedNames(index.decls.get(name) ?? { refs: [], members: new Map() })) {
      if (!reached.has(used) && index.decls.get(used)?.state) { reached.add(used); grew = true; }
    }
  }
  return grew;
}

/**
 * The names of `index` that a change to `names` reaches: `names`, every declaration that uses one of them, and every module-level state binding (a Map, a Set,
 * an empty container, a `let`) that a reached declaration uses - the declarations sharing that state read what the reached one writes - until nothing is added.
 */
export function usersClosure(index, names) {
  const reached = new Set(names);
  let grew = true;
  while (grew) {
    const users = addUsers(index, reached);
    grew = addSharedState(index, reached) || users;
  }
  return reached;
}

/** The exported names that expose one of the local names `locals` (a Set): a declaration or an import binding listed in an export. */
export const exportsOf = (index, locals) => [...index.exports].filter(([, local]) => locals.has(local)).map(([exported]) => exported);

// A visitor returns true when it walked the children it cares about itself.
function visitMember(node, uses, walk) {
  if (!node.computed && node.object.type === 'Identifier') {
    if (!uses.members.has(node.object.name)) uses.members.set(node.object.name, new Set());
    uses.members.get(node.object.name).add(node.property.name);
  } else walk(node.object);
  if (node.computed) walk(node.property);
  return true;
}

function visitKeyed(node, uses, walk) {
  if (node.computed) walk(node.key);
  if (node.value) walk(node.value);
  return true;
}

function visitCall(node, uses) {
  const literal = node.callee.type === 'Identifier' && node.callee.name === 'require' ? stringOf(node.arguments[0]) : null;
  if (literal !== null) uses.dynamics.push({ source: literal });
  return literal !== null;
}

function visitImportExpression(node, uses, walk) {
  const literal = stringOf(node.source);
  uses.dynamics.push({ source: literal });
  if (literal === null) walk(node.source);
  return true;
}

const VISITORS = Object.freeze({
  Identifier: (node, uses) => { uses.refs.add(node.name); return false; },
  MemberExpression: visitMember,
  Property: visitKeyed,
  MethodDefinition: visitKeyed,
  PropertyDefinition: visitKeyed,
  CallExpression: visitCall,
  ImportExpression: visitImportExpression,
});

/** The names a subtree uses: `refs` (bare uses), `members` (object name -> the properties read through `object.prop`) and `dynamics` ([{source}] of import() and require() calls; source null when computed). */
function usesOf(root, into = newUses()) {
  const walk = (node) => {
    const visit = VISITORS[node.type];
    if (!visit?.(node, into, walk)) children(node).forEach((child) => walk(child));
  };
  walk(root);
  return into;
}

const slice = (ctx, node) => ctx.text.slice(node.start, node.end);

function addDecl(ctx, name, text, node, state = false) {
  const uses = usesOf(node);
  ctx.index.decls.set(name, { name, text, refs: uses.refs, members: uses.members, dynamics: uses.dynamics, spawns: spawnedEntriesOf(text), state });
}

/** Records the declarations of a function, class or variable statement; returns the names it declares. */
function addDeclaration(ctx, node) {
  if (node.type === 'VariableDeclaration') {
    return node.declarations.flatMap((declarator) => {
      const names = boundNames(declarator.id);
      for (const name of names) addDecl(ctx, name, `${node.kind} ${slice(ctx, declarator)}`, declarator, node.kind !== 'const' || holdsState(declarator.init));
      return names;
    });
  }
  const name = node.id ? node.id.name : 'default';
  addDecl(ctx, name, slice(ctx, node), node);
  return [name];
}

function addImport(ctx, node) {
  if (!node.specifiers.length) { addModuleLevel(ctx, node); return; }
  for (const spec of node.specifiers) {
    let imported = 'default';
    if (spec.type === 'ImportNamespaceSpecifier') imported = '*';
    else if (spec.type === 'ImportSpecifier') imported = nameOf(spec.imported);
    ctx.index.imports.set(spec.local.name, { source: node.source.value, imported });
  }
}

function addNamedExport(ctx, node) {
  if (node.declaration) {
    for (const name of addDeclaration(ctx, node.declaration)) ctx.index.exports.set(name, name);
  } else if (node.source) {
    for (const spec of node.specifiers) ctx.index.reexports.push({ source: node.source.value, imported: nameOf(spec.local), exported: nameOf(spec.exported) });
  } else {
    for (const spec of node.specifiers) ctx.index.exports.set(nameOf(spec.exported), nameOf(spec.local));
  }
}

function addExportAll(ctx, node) {
  ctx.index.reexports.push({ source: node.source.value, imported: '*', exported: node.exported ? nameOf(node.exported) : null });
}

function addExportDefault(ctx, node) {
  const target = node.declaration;
  const isDeclaration = target.type === 'FunctionDeclaration' || target.type === 'ClassDeclaration';
  if (isDeclaration) ctx.index.exports.set('default', addDeclaration(ctx, target)[0]);
  else {
    addDecl(ctx, 'default', slice(ctx, target), target);
    ctx.index.exports.set('default', 'default');
  }
}

function addModuleLevel(ctx, node) {
  const text = slice(ctx, node);
  ctx.index.residue.push(text);
  usesOf(node, ctx.index.module);
  ctx.index.module.spawns.push(...spawnedEntriesOf(text));
}

const STATEMENTS = Object.freeze({
  ImportDeclaration: addImport,
  ExportNamedDeclaration: addNamedExport,
  ExportAllDeclaration: addExportAll,
  ExportDefaultDeclaration: addExportDefault,
  FunctionDeclaration: addDeclaration,
  ClassDeclaration: addDeclaration,
  VariableDeclaration: addDeclaration,
});

/**
 * The index of a module's source (line endings normalised), or null when it does not parse: {decls: Map name -> {name, text, refs, members, dynamics, spawns, state (a binding that holds state later code fills in)}, imports: Map local ->
 * {source, imported} (imported 'default', '*' or the exported name), reexports: [{source, imported, exported}] ('*' = every name; exported null = `export *`),
 * exports: Map exported name -> local name, module: the uses of the module-level statements, residue: [the text of those statements and of side-effect imports]}.
 */
export function indexModule(source) {
  const text = String(source).replaceAll('\r\n', '\n');
  const ast = parseModule(text);
  if (!ast) return null;
  const ctx = { text, index: { decls: new Map(), imports: new Map(), reexports: [], exports: new Map(), module: { ...newUses(), spawns: [] }, residue: [] } };
  for (const node of ast.body) (STATEMENTS[node.type] ?? addModuleLevel)(ctx, node);
  return ctx.index;
}
