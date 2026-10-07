// node-modules-link.mjs - RT_NODE_MODULES_LINK (knowledge/hfs/rules.yaml, gate runtime): no runtime source creates a
// junction or a symlink for a node_modules folder. Every checkout - a lane, a workflow worktree, a land scratch, a
// [Worker] staging tree, a push scratch - installs its own dependencies with a real npm ci from the cache
// (scripts/api/npm/ci.mjs); a link into another checkout's node_modules is what a recursive delete or an npm reify
// follows into the live tree (inc-c8fbf76aa499, node-modules-link-wipe). Removing or detecting an existing link stays.
// Read with the TypeScript AST, never a text grep:
//   fs links      a call of symlink/symlinkSync reached through a node:fs or node:fs/promises binding (a named import,
//                 the module, fs.promises, a require), or of a local function that passes one of its parameters into
//                 such a call (wrappers of wrappers too), whose link or target argument can name node_modules: a string
//                 or template holding `node_modules`, a call or expression with one inside, or a const initialized so
//   spawned links a child-process call (scripts/lib/spawn-calls.mjs) whose arguments spell a link command - mklink with
//                 /J or /D, New-Item -ItemType Junction or SymbolicLink, ln -s - and can name node_modules
// Pure.
import { nameOfFn, paramOf, spawnCalls } from '../../lib/spawn-calls.mjs';
import { fsBindings, fsMemberAccess, lineOf, ts } from './source-ast.mjs';

export const CODE = 'RT_NODE_MODULES_LINK';
const LINK_MEMBERS = new Set(['symlink', 'symlinkSync']);
const NODE_MODULES = /node_modules/;
const LINK_COMMAND = [/\bmklink\b[\s\S]*\/[jd]\b/i, /\bnew-item\b[\s\S]*\b(?:junction|symboliclink)\b/i, /(?:^|\s)ln\s+-[a-z]*s/i];

const isStringPart = (t, node) => t.isStringLiteral(node) || t.isTemplateLiteralToken(node);

/** Every initializer of each named const of the source, by name. */
function constsOf(t, source) {
  const consts = new Map();
  const collect = (node) => {
    if (t.isVariableDeclaration(node) && t.isIdentifier(node.name) && node.initializer) consts.set(node.name.text, [...(consts.get(node.name.text) ?? []), node.initializer]);
    t.forEachChild(node, collect);
  };
  collect(source);
  return consts;
}

/** True when `node` can name node_modules: a string in its subtree, or a const it reads that does (one level of names deep each). */
function namesNodeModules(scope, node, seen = new Set()) {
  const { t, consts } = scope;
  if (isStringPart(t, node) && NODE_MODULES.test(node.text)) return true;
  if (t.isIdentifier(node) && consts.has(node.text) && !seen.has(node.text)) {
    seen.add(node.text);
    if (consts.get(node.text).some((init) => namesNodeModules(scope, init, seen))) return true;
  }
  return t.forEachChild(node, (child) => (namesNodeModules(scope, child, seen) ? true : undefined)) === true;
}

const isFsLink = ({ t, functions, namespaces }, callee) => (t.isIdentifier(callee) ? functions.has(callee.text) : fsMemberAccess(t, callee, namespaces, (name) => LINK_MEMBERS.has(name)) !== null);

/** The arguments of a call that reach a link: the first two of an fs link call, the linked parameters of a local linker, else null. */
function linkArgs(scope, linkers, call) {
  const { t } = scope;
  if (isFsLink(scope, call.expression)) return call.arguments.slice(0, 2);
  if (t.isIdentifier(call.expression) && linkers.has(call.expression.text)) return [...linkers.get(call.expression.text)].map((i) => call.arguments[i]).filter(Boolean);
  return null;
}

/** Records the functions whose parameters a link call under `node` receives; true when a new parameter was recorded. */
function learnLinkers(scope, linkers, node) {
  const { t } = scope;
  let grew = false;
  if (t.isCallExpression(node)) {
    for (const arg of linkArgs(scope, linkers, node) ?? []) {
      const from = paramOf(t, arg);
      const name = from && nameOfFn(t, from.fn);
      if (!name) continue;
      const set = linkers.get(name) ?? new Set();
      if (!set.has(from.index)) { set.add(from.index); linkers.set(name, set); grew = true; }
    }
  }
  t.forEachChild(node, (child) => { grew = learnLinkers(scope, linkers, child) || grew; });
  return grew;
}

/** Local linkers: a function that passes one of its own parameters into a link call (to a fixed point). */
function localLinkers(scope) {
  const linkers = new Map(); // name -> Set(param index)
  for (let grew = true, rounds = 0; grew && rounds < 10; rounds += 1) grew = learnLinkers(scope, linkers, scope.source);
  return linkers;
}

function fsLinkFindings(scope, linkers, file, node, found) {
  const { t, source } = scope;
  if (t.isCallExpression(node)) {
    const args = linkArgs(scope, linkers, node);
    if (args?.some((arg) => namesNodeModules(scope, arg))) {
      const line = lineOf(source, node);
      found.push({ code: CODE, level: 'error', path: file, line, message: `${file}:${line} links a node_modules folder (${node.expression.getText(source)}): a checkout installs its own dependencies with a real npm ci from the cache (scripts/api/npm/ci.mjs), never a junction or symlink into another checkout's node_modules` });
    }
  }
  t.forEachChild(node, (child) => fsLinkFindings(scope, linkers, file, child, found));
}

/** The strings of a call argument, following the consts it reads. */
function collectWords(scope, node, words, seen) {
  const { t, consts } = scope;
  if (isStringPart(t, node)) words.push(node.text);
  else if (t.isIdentifier(node) && consts.has(node.text) && !seen.has(node.text)) { seen.add(node.text); for (const init of consts.get(node.text)) collectWords(scope, init, words, seen); }
  t.forEachChild(node, (child) => collectWords(scope, child, words, seen));
}

/** Spawned link commands: the strings of each child-process call's arguments. */
function spawnLinkFindings(scope, byLine, file, node, found) {
  const { t, source } = scope;
  if (t.isCallExpression(node) && byLine.has(lineOf(source, node))) {
    const words = [];
    const seen = new Set();
    node.arguments.forEach((arg) => collectWords(scope, arg, words, seen));
    const command = words.join(' ');
    if (LINK_COMMAND.some((rx) => rx.test(command)) && node.arguments.some((arg) => namesNodeModules(scope, arg))) {
      const line = lineOf(source, node);
      found.push({ code: CODE, level: 'error', path: file, line, message: `${file}:${line} spawns a link command for a node_modules folder: a checkout installs its own dependencies with a real npm ci from the cache (scripts/api/npm/ci.mjs)` });
    }
  }
  t.forEachChild(node, (child) => spawnLinkFindings(scope, byLine, file, child, found));
}

/** The RT_NODE_MODULES_LINK findings of one parsed source. */
export function fileLinkFindings({ path: file, text, source }) {
  const t = ts();
  const found = [];
  if (!NODE_MODULES.test(text)) return found;
  const { namespaces, members: links } = fsBindings(source, (imported) => LINK_MEMBERS.has(imported), { destructuredRequires: false });
  const scope = { t, source, namespaces, functions: new Set(links.keys()), consts: constsOf(t, source) };
  fsLinkFindings(scope, localLinkers(scope), file, source, found);
  const calls = spawnCalls(text, file).calls;
  if (calls.length) spawnLinkFindings(scope, new Map(calls.map((c) => [c.line, c])), file, source, found);
  return found;
}

/** RT_NODE_MODULES_LINK over the runtime's production sources (ctx of scripts/hfs/runtime-check.mjs). */
export function nodeModulesLinkFindings(ctx) {
  return ctx.sources.flatMap(({ path: file, text }) => fileLinkFindings({ path: file, text, source: ctx.parsed(file) }));
}
