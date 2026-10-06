import path from 'node:path';
import { machineKit } from './machine-ast.mjs';
import { treeOf } from './required-files.mjs';
import { byCodeUnit } from '../../lib/list.mjs';

/**
 * R56 `hooks-are-hooks` (FE_HOOKS_ARE_HOOKS), the repository half of the eslint rule `hooks-folder-holds-hooks-only`, which
 * judges one file at a time and leaves to the machine what needs the whole tree. Per domain folder of hooks
 * (slot fe.hooks, apps/<app>/src/hooks/<domain>):
 *
 *   - at most one shared file, named `<domain>.shared.ts`: a second `*.shared.ts`, or one named for another domain, is a
 *     second dumping ground for non-hook helpers;
 *   - no helper declared twice: a top-level function or arrow-function constant that is not a hook and whose name is declared
 *     in two files of the domain is a helper copied instead of shared; it lives once in `<domain>.shared.ts`.
 */
export const HOOKS_ARE_HOOKS_RULE_IDS = ['FE_HOOKS_ARE_HOOKS'];

const RULE = 'FE_HOOKS_ARE_HOOKS';
const HOOKS_SLOT = 'fe.hooks';
const HOOK_NAME = /^use[A-Z0-9]/u;
const SHARED = /\.shared\.[cm]?tsx?$/u;

export function checkHooksAreHooks(input) {
  const { config, graph } = input;
  const kit = machineKit(input);
  const { ts, resolver } = kit;
  const violations = [];
  const domains = new Set();

  const tree = treeOf(config.root);
  const shared = new Map(); // domain root -> [file]
  for (const rel of [...tree.files].sort(byCodeUnit)) {
    const classified = resolver.classifyPath(rel);
    if (classified.slot !== HOOKS_SLOT || !classified.root) continue;
    domains.add(classified.root);
    const base = path.posix.basename(rel);
    if (/\.spec\.[cm]?tsx?$/u.test(base) || !SHARED.test(base)) continue;
    if (!shared.has(classified.root)) shared.set(classified.root, []);
    shared.get(classified.root).push({ rel, base });
  }
  for (const [root, list] of shared) {
    const domain = path.posix.basename(root);
    const at = (item, message) => violations.push({ ruleId: RULE, path: item.rel, line: 1, column: 1, domain, message });
    for (const item of list) {
      if (item.base.replace(/\.[cm]?tsx?$/u, '') !== `${domain}.shared` || path.posix.dirname(item.rel) !== root) {
        at(item, `${item.rel} is a shared file that is not ${root}/${domain}.shared.ts; a hooks domain has one shared file for its non-hook helpers, named after the domain. Move the helpers into it.`);
      }
    }
    for (const item of list.filter(entry => entry.base.replace(/\.[cm]?tsx?$/u, '') === `${domain}.shared` && path.posix.dirname(entry.rel) === root).slice(1)) {
      at(item, `${item.rel} is a second shared file of hooks domain ${domain}; a domain has exactly one, ${domain}.shared.ts. Merge the helpers into it.`);
    }
  }

  // Helpers declared in more than one file of one domain.
  const declared = new Map(); // domain root -> name -> [{file, node}]
  for (const file of graph.files.values()) {
    if (file.slot !== HOOKS_SLOT) continue;
    const root = resolver.classifyPath(file.rel).root;
    for (const statement of file.sourceFile.statements) {
      const found = [];
      if (ts.isFunctionDeclaration(statement) && statement.name) found.push([statement.name.text, statement.name]);
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          const init = declaration.initializer;
          if (ts.isIdentifier(declaration.name) && init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) found.push([declaration.name.text, declaration.name]);
        }
      }
      for (const [name, node] of found) {
        if (HOOK_NAME.test(name)) continue;
        if (!declared.has(root)) declared.set(root, new Map());
        const byName = declared.get(root);
        if (!byName.has(name)) byName.set(name, []);
        byName.get(name).push({ file, node });
      }
    }
  }
  for (const [root, byName] of declared) {
    const domain = path.posix.basename(root);
    for (const [name, list] of byName) {
      if (list.length < 2) continue;
      for (const item of list.slice(1)) {
        const others = list.map(entry => entry.file.rel).filter(rel => rel !== item.file.rel).sort(byCodeUnit);
        violations.push({ ruleId: RULE, path: item.file.rel, ...kit.at(item.file.rel, item.file.sourceFile, item.node), domain, helper: name,
          message: `${name} is declared again in hooks domain ${domain} (also in ${others.join(', ')}); a helper the hooks share is written once, in ${domain}.shared.ts.` });
      }
    }
  }
  return { violations, coverage: { status: 'checked', domains: domains.size } };
}
