// spawn-calls.mjs — every child-process call in one source text, read with the TypeScript AST (never a text grep), and
// the program each one can run. The checks that judge spawns read it: scripts/hfs/runtime-rules/external-owner.mjs
// (RT_EXTERNAL_OWNER: which program may be spawned where) and check-host-boundary.mjs (no agent CLI as a child process).
//
//   spawnCalls(text, file) -> {imports: [{line, module}], calls: [{line, callee, programs, resolved}]}
//     imports   every import/require/import() of child_process (a scripts/lib module may hold none)
//     calls     every call of spawn/spawnSync/exec/execSync/execFile/execFileSync/fork reached through a child_process
//               binding: a named import (aliases kept), the module itself (cp.spawnSync), a destructured require/import(),
//               or a parameter or const whose default/initializer is one of those.
//     programs  the programs the call can start: every string the command expression can be (literals, templates' head,
//               consts, both branches of a conditional, ||/??), its first word, basename, lower case, .cmd/.exe/.bat/.ps1
//               dropped; process.execPath reads as 'node'. A shell (cmd, sh, bash, powershell, pwsh) adds the program its
//               argv runs (cmd /c git ...). `resolved` is false when the command expression has no knowable value;
//               `passThrough` marks the spawn inside a local runner whose callers name the command (their calls are
//               listed as calls of the runner, callee = its name).
import path from 'node:path';
import { createRequire } from 'node:module'; import { hasFlag } from './ts-ast.mjs';

const CHILD_PROCESS = new Set(['child_process', 'node:child_process']);
const SPAWN_FNS = Object.freeze(['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']);
const SPAWN_SET = new Set(SPAWN_FNS);
const SHELLS = new Set(['cmd', 'sh', 'bash', 'powershell', 'pwsh']);
let typescript = null;
const ts = () => (typescript ??= createRequire(import.meta.url)('typescript'));

/** The declared name of a function declaration or a `const x = (arrow|function)` binding, else null. */
export const nameOfFn = (t, fn) => {
  if (t.isFunctionDeclaration(fn) && fn.name) return fn.name.text;
  if ((t.isArrowFunction(fn) || t.isFunctionExpression(fn)) && fn.parent && t.isVariableDeclaration(fn.parent) && t.isIdentifier(fn.parent.name)) return fn.parent.name.text;
  return null;
};

/** The function whose parameter list `node` (an identifier) reads, walking up parents: {fn, index} or null. */
export const paramOf = (t, node) => {
  if (!node || !t.isIdentifier(node)) return null;
  for (let p = node.parent; p; p = p.parent) {
    if (t.isFunctionLike(p)) {
      const index = p.parameters.findIndex((q) => t.isIdentifier(q.name) && q.name.text === node.text);
      return index >= 0 ? { fn: p, index } : null;
    }
  }
  return null;
};

/** The program a command word names: basename, lower case, without a .cmd/.exe/.bat/.ps1 shim suffix. */
export const programOf = (word) => path.posix.basename(String(word ?? '').replace(/^["']|["']$/g, '').replaceAll('\\', '/')).toLowerCase().replace(/\.(?:cmd|exe|bat|ps1)$/, '');
const firstWord = (text) => String(text ?? '').trim().split(/\s+/)[0] ?? '';

const moduleOf = (t, node) => Boolean(node && t.isStringLiteralLike(node) && CHILD_PROCESS.has(node.text));

function requireOf(t, node) {
  let n = node;
  if (n && t.isAwaitExpression(n)) n = n.expression;
  if (!n || !t.isCallExpression(n)) return false;
  const callee = n.expression;
  const isRequire = t.isIdentifier(callee) && callee.text === 'require';
  const isImport = callee.kind === t.SyntaxKind.ImportKeyword;
  return (isRequire || isImport) && moduleOf(t, n.arguments[0]);
}

function bindPattern({ t, fnBinding }, pattern) {
  for (const el of pattern.elements) {
    let imported = null;
    if (el.propertyName && t.isIdentifier(el.propertyName)) imported = el.propertyName.text;
    else if (t.isIdentifier(el.name)) imported = el.name.text;
    if (imported && SPAWN_SET.has(imported) && t.isIdentifier(el.name)) fnBinding.set(el.name.text, imported);
  }
}

/** The child_process function an expression is (a binding, cp.<fn>), or null. */
function spawnFnOf({ t, fnBinding, nsBinding }, e) {
  if (!e) return null;
  if (t.isIdentifier(e) && fnBinding.has(e.text)) return fnBinding.get(e.text);
  if (t.isPropertyAccessExpression(e) && t.isIdentifier(e.expression) && nsBinding.has(e.expression.text) && SPAWN_SET.has(e.name.text)) return e.name.text;
  return null;
}

// An import of child_process: the module itself, or the spawn functions it names.
function collectImport({ t, out, nsBinding, fnBinding, lineOf }, node) {
  out.imports.push({ line: lineOf(node), module: node.moduleSpecifier.text });
  const c = node.importClause;
  if (c?.name) nsBinding.add(c.name.text);
  const b = c?.namedBindings;
  if (b && t.isNamespaceImport(b)) nsBinding.add(b.name.text);
  if (b && t.isNamedImports(b)) for (const el of b.elements) {
    const imported = (el.propertyName ?? el.name).text;
    if (SPAWN_SET.has(imported)) fnBinding.set(el.name.text, imported);
  }
}

// A variable declaration: a require of child_process binds the module or its functions; a const keeps its initializers.
function collectVariable(S, node) {
  const { t, nsBinding, consts } = S;
  if (requireOf(t, node.initializer)) {
    if (t.isIdentifier(node.name)) nsBinding.add(node.name.text);
    else if (t.isObjectBindingPattern(node.name)) bindPattern(S, node.name);
  }
  const list = node.parent;
  if (t.isIdentifier(node.name) && list && t.isVariableDeclarationList(list) && hasFlag(list.flags, t.NodeFlags.Const))
    consts.set(node.name.text, [...(consts.get(node.name.text) ?? []), node.initializer]);
}

function collectBindings(S, node) {
  const { t, out, lineOf } = S;
  if (t.isImportDeclaration(node) && moduleOf(t, node.moduleSpecifier)) collectImport(S, node);
  if (t.isCallExpression(node) && requireOf(t, node)) out.imports.push({ line: lineOf(node), module: node.arguments[0].text });
  if (t.isVariableDeclaration(node) && node.initializer) collectVariable(S, node);
  t.forEachChild(node, (child) => collectBindings(S, child));
}

// Seams: `run = spawnSync` as a parameter default, `const run = cp.spawnSync` - the alias runs the same function.
function collectAliases(S, node) {
  const { t, fnBinding } = S;
  if ((t.isParameter(node) || t.isBindingElement(node) || t.isVariableDeclaration(node)) && t.isIdentifier(node.name) && node.initializer) {
    const fn = spawnFnOf(S, node.initializer);
    if (fn) fnBinding.set(node.name.text, fn);
  }
  t.forEachChild(node, (child) => collectAliases(S, child));
}

const isExecPath = (t, node) => t.isPropertyAccessExpression(node) && node.name.text === 'execPath' && t.isIdentifier(node.expression) && node.expression.text === 'process';

// Every string a command expression can be; null inside the list marks a value that cannot be known.
function valuesOf(S, node, seen = new Set()) {
  const { t, consts } = S;
  if (!node) return [null];
  if (t.isParenthesizedExpression(node) || t.isAsExpression(node)) return valuesOf(S, node.expression, seen);
  if (t.isStringLiteralLike(node)) return [node.text];
  if (t.isTemplateExpression(node)) return node.head.text.trim() ? [node.head.text] : [null];
  if (isExecPath(t, node)) return ['node'];
  if (t.isConditionalExpression(node)) return [...valuesOf(S, node.whenTrue, seen), ...valuesOf(S, node.whenFalse, seen)];
  if (t.isBinaryExpression(node) && [t.SyntaxKind.BarBarToken, t.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind))
    return [...valuesOf(S, node.left, seen), ...valuesOf(S, node.right, seen)];
  if (t.isIdentifier(node) && consts.has(node.text) && !seen.has(node.text)) {
    seen.add(node.text);
    return consts.get(node.text).flatMap((init) => valuesOf(S, init, seen));
  }
  return [null];
}

// A local runner - `const run = (cmd, args) => spawnSync(cmd, args, ...)` - spawns whatever its callers pass: each
// function whose spawn takes the command from one of its own parameters is a spawner, and a call of it by name is a
// spawn of its argument at that position (wrappers of wrappers too, to a fixed point). Same file only.
function spawnOf(S, call) {
  const { t, spawners } = S;
  const fn = spawnFnOf(S, call.expression);
  if (fn) return { callee: fn, cmd: call.arguments[0], args: call.arguments[1] };
  if (t.isIdentifier(call.expression) && spawners.has(call.expression.text)) {
    const sp = spawners.get(call.expression.text);
    return { callee: call.expression.text, cmd: call.arguments[sp.cmd], args: sp.args == null ? undefined : call.arguments[sp.args] };
  }
  return null;
}

// One pass over the source: a call whose command is a parameter makes its function a spawner. True when a new spawner was learned.
function learnSpawners(S, node) {
  const { t, spawners } = S;
  let grew = false;
  if (t.isCallExpression(node)) {
    const sp = spawnOf(S, node);
    const from = sp && paramOf(t, sp.cmd);
    const name = from && nameOfFn(t, from.fn);
    if (name && !spawners.has(name)) {
      const args = paramOf(t, sp.args);
      spawners.set(name, { cmd: from.index, args: args && args.fn === from.fn ? args.index : null });
      grew = true;
    }
  }
  t.forEachChild(node, (child) => { if (learnSpawners(S, child)) grew = true; });
  return grew;
}

// argv form (spawn/execFile/fork without shell: true) names the file whole, spaces included; a shell command
// string (exec, shell: true, a local runner's command) is split at its first word.
const isShellOption = (t, p) => t.isPropertyAssignment(p) && t.isIdentifier(p.name) && p.name.text === 'shell' && p.initializer.kind !== t.SyntaxKind.FalseKeyword;
const argvFormOf = (t, callee, node) => SPAWN_SET.has(callee) && !['exec', 'execSync'].includes(callee)
  && !node.arguments.some((a) => t.isObjectLiteralExpression(a) && a.properties.some((p) => isShellOption(t, p)));

// The programs one spawn can start (a shell adds the program its argv runs) and whether its command was knowable.
function programsOfSpawn(S, node, { callee, cmd, args }) {
  const { t } = S;
  const values = valuesOf(S, cmd);
  const argvForm = argvFormOf(t, callee, node);
  const programs = values.filter((v) => v != null).map((v) => programOf(argvForm ? v : firstWord(v)));
  // A shell running a program: cmd /c git ..., sh -c 'docker ps', powershell -Command npm.
  if (programs.some((p) => SHELLS.has(p)) && args && t.isArrayLiteralExpression(args)) {
    const program = args.elements.flatMap((el) => valuesOf(S, el).filter((v) => v != null).slice(0, 1)).find((w) => !/^[-/]/.test(w));
    if (program != null) programs.push(programOf(firstWord(program)));
  }
  return { programs, resolved: !values.includes(null) };
}

function visitCalls(S, node) {
  const { t, out, spawners, lineOf } = S;
  if (t.isCallExpression(node)) {
    const spawn = spawnOf(S, node);
    if (spawn) {
      const { programs, resolved } = programsOfSpawn(S, node, spawn);
      const from = paramOf(t, spawn.cmd);
      const passThrough = Boolean(from && spawners.has(nameOfFn(t, from.fn)));
      out.calls.push({ line: lineOf(node), callee: spawn.callee, programs: [...new Set(programs)], resolved, passThrough });
    }
  }
  t.forEachChild(node, (child) => visitCalls(S, child));
}

/** {imports, calls} of one source text. Pure. */
export function spawnCalls(text, file = 'x.mjs') {
  const out = { imports: [], calls: [] };
  if (!/child_process/.test(text)) return out;
  const t = ts();
  const source = t.createSourceFile(file, text, t.ScriptTarget.Latest, true, file.endsWith('.ts') ? t.ScriptKind.TS : t.ScriptKind.JS);
  const S = { t, out, source, lineOf: (node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
    fnBinding: new Map(), // local name -> child_process function name
    nsBinding: new Set(), // local names bound to the module itself
    consts: new Map(), // const name -> [initializer]
    spawners: new Map() }; // function name -> {cmd: param index, args: param index | null}
  collectBindings(S, source);
  if (S.fnBinding.size || S.nsBinding.size) collectAliases(S, source);
  if (!S.fnBinding.size && !S.nsBinding.size) return out;
  for (let grew = true, rounds = 0; grew && rounds < 10; rounds += 1) grew = learnSpawners(S, source);
  visitCalls(S, source);
  return out;
}
