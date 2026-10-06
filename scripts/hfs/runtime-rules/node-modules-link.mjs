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

/** The RT_NODE_MODULES_LINK findings of one parsed source. */
export function fileLinkFindings({ path: file, text, source }) {
  const t = ts();
  const found = [];
  if (!NODE_MODULES.test(text)) return found;
  const { namespaces, members: links } = fsBindings(source, (imported) => LINK_MEMBERS.has(imported), { destructuredRequires: false });
  const functions = new Set(links.keys());
  const consts = new Map();
  const collectConsts = (node) => {
    if (t.isVariableDeclaration(node) && t.isIdentifier(node.name) && node.initializer) consts.set(node.name.text, [...(consts.get(node.name.text) ?? []), node.initializer]);
    t.forEachChild(node, collectConsts);
  };
  collectConsts(source);
  /** True when `node` can name node_modules: a string in its subtree, or a const it reads that does (one level of names deep each). */
  const namesNodeModules = (node, seen = new Set()) => {
    let hit = false;
    const visit = (n) => {
      if (hit) return;
      if ((t.isStringLiteralLike(n) || t.isTemplateHead(n) || t.isTemplateMiddle(n) || t.isTemplateTail(n)) && NODE_MODULES.test(n.text)) { hit = true; return; }
      if (t.isIdentifier(n) && consts.has(n.text) && !seen.has(n.text)) {
        seen.add(n.text);
        for (const init of consts.get(n.text)) if (namesNodeModules(init, seen)) { hit = true; return; }
      }
      t.forEachChild(n, visit);
    };
    visit(node);
    return hit;
  };
  const isFsLink = (callee) => t.isIdentifier(callee) ? functions.has(callee.text) : fsMemberAccess(t, callee, namespaces, (name) => LINK_MEMBERS.has(name)) !== null;
  // Local linkers: a function that passes one of its own parameters into a link call (to a fixed point).
  const linkers = new Map(); // name -> Set(param index)
  const linkArgs = (call) => {
    if (isFsLink(call.expression)) return call.arguments.slice(0, 2);
    if (t.isIdentifier(call.expression) && linkers.has(call.expression.text)) return [...linkers.get(call.expression.text)].map((i) => call.arguments[i]).filter(Boolean);
    return null;
  };
  for (let grew = true, rounds = 0; grew && rounds < 10; rounds += 1) {
    grew = false;
    const learn = (node) => {
      if (t.isCallExpression(node)) {
        for (const arg of linkArgs(node) ?? []) {
          const from = paramOf(t, arg);
          const name = from && nameOfFn(t, from.fn);
          if (!name) continue;
          const set = linkers.get(name) ?? new Set();
          if (!set.has(from.index)) { set.add(from.index); linkers.set(name, set); grew = true; }
        }
      }
      t.forEachChild(node, learn);
    };
    learn(source);
  }
  const visit = (node) => {
    if (t.isCallExpression(node)) {
      const args = linkArgs(node);
      if (args?.some((arg) => namesNodeModules(arg))) {
        const line = lineOf(source, node);
        found.push({ code: CODE, level: 'error', path: file, line, message: `${file}:${line} links a node_modules folder (${node.expression.getText(source)}): a checkout installs its own dependencies with a real npm ci from the cache (scripts/api/npm/ci.mjs), never a junction or symlink into another checkout's node_modules` });
      }
    }
    t.forEachChild(node, visit);
  };
  visit(source);
  // Spawned link commands: the strings of each child-process call's arguments.
  const calls = spawnCalls(text, file).calls;
  if (calls.length) {
    const byLine = new Map(calls.map((c) => [c.line, c]));
    const spawnVisit = (node) => {
      if (t.isCallExpression(node) && byLine.has(lineOf(source, node))) {
        const words = [];
        const seen = new Set();
        const collect = (n) => {
          if (t.isStringLiteralLike(n) || t.isTemplateHead(n) || t.isTemplateMiddle(n) || t.isTemplateTail(n)) words.push(n.text);
          else if (t.isIdentifier(n) && consts.has(n.text) && !seen.has(n.text)) { seen.add(n.text); for (const init of consts.get(n.text)) collect(init); }
          t.forEachChild(n, collect);
        };
        node.arguments.forEach(collect);
        const command = words.join(' ');
        if (LINK_COMMAND.some((rx) => rx.test(command)) && node.arguments.some((arg) => namesNodeModules(arg))) {
          const line = lineOf(source, node);
          found.push({ code: CODE, level: 'error', path: file, line, message: `${file}:${line} spawns a link command for a node_modules folder: a checkout installs its own dependencies with a real npm ci from the cache (scripts/api/npm/ci.mjs)` });
        }
      }
      t.forEachChild(node, spawnVisit);
    };
    spawnVisit(source);
  }
  return found;
}

/** RT_NODE_MODULES_LINK over the runtime's production sources (ctx of scripts/hfs/runtime-check.mjs). */
export function nodeModulesLinkFindings(ctx) {
  return ctx.sources.flatMap(({ path: file, text }) => fileLinkFindings({ path: file, text, source: ctx.parsed(file) }));
}
