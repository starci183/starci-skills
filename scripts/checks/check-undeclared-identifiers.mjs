#!/usr/bin/env node
// check-undeclared-identifiers.mjs — UNDECLARED_IDENTIFIER (R228, RT_IDENTIFIER_UNDECLARED; part of `npm run check`).
//   starci runtime check --only undeclared-identifiers [--json]
//
// A refactor that moves code leaves a name behind: an import dropped with the function that used it, a variable that stayed in
// the old closure, a re-export (`export {x} from './y.mjs'` binds x in no local scope) read as if it were a local. Node reports
// it only when that line runs. This check reads every runtime ES module (scripts/, engine/ without the vendored yaml bundle,
// ui/api/, packages/cli/bin and src) with the TypeScript parser and resolves each identifier against the scopes around it
// (scripts/lib/undeclared-names.mjs): a declaration, an import, a parameter, or a Node global must bind it. A function a module
// hands to page.evaluate (here or through an import) also sees the browser globals; nowhere else does.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { printFindings } from '../lib/check-scan.mjs';
import { walkFiles } from '../lib/walk.mjs';
import { moduleLinks, pageCallNames, undeclaredNames } from '../lib/undeclared-names.mjs';
import { parseSource, ts } from '../hfs/runtime-rules/source-ast.mjs';

export const CODE = 'RT_IDENTIFIER_UNDECLARED';
const SOURCE_ROOTS = Object.freeze(['scripts', 'engine', 'ui/api', 'packages/cli/bin', 'packages/cli/src']);
const VENDORED = Object.freeze(['engine/yaml.mjs']);

const posix = (file) => file.replaceAll('\\', '/');

/** The runtime ES modules under `root`, absolute and sorted. */
function runtimeModules(root) {
  const files = SOURCE_ROOTS.flatMap((dir) => (fs.existsSync(path.join(root, dir))
    ? walkFiles(path.join(root, dir), { sorted: true, filter: (name) => name.endsWith('.mjs'), exclude: (name) => name === 'node_modules' })
    : []));
  return files.filter((file) => !VENDORED.includes(posix(path.relative(root, file))));
}

/** The module a relative `specifier` of `from` names, or null (a package, a built-in, a missing file). */
const resolved = (from, specifier, known) => {
  if (!specifier.startsWith('.')) return null;
  const target = path.resolve(path.dirname(from), specifier);
  return known.has(target) ? target : null;
};

/** The export links of every module in `files`, and the page-call arguments that name an imported function: {links, pending}. */
function linksOfModules(t, files, known) {
  const links = new Map();
  const pending = [];
  for (const file of files) {
    const source = parseSource(fs.readFileSync(file, 'utf8'), file);
    const { imports, exports } = moduleLinks(t, source);
    links.set(file, { exports });
    for (const name of pageCallNames(t, source)) {
      const link = imports.get(name);
      const target = link && resolved(file, link.specifier, known);
      if (target) pending.push({ file: target, name: link.name });
    }
  }
  return { links, pending };
}

/**
 * The functions that run in a browser page, per module: those a module passes to page.evaluate, followed through the
 * imports and re-exports that carry them to the module declaring them. Map(file -> Set(local function name)).
 */
function pageFunctionsByModule(t, files) {
  const known = new Set(files);
  const { links, pending } = linksOfModules(t, files, known);
  const byModule = new Map();
  const seen = new Set();
  while (pending.length) {
    const { file, name } = pending.pop();
    if (seen.has(`${file}\0${name}`)) continue;
    seen.add(`${file}\0${name}`);
    const exported = links.get(file).exports.get(name);
    if (exported?.local) byModule.set(file, (byModule.get(file) ?? new Set()).add(exported.local));
    else if (exported) {
      const target = resolved(file, exported.specifier, known);
      if (target) pending.push({ file: target, name: exported.name });
    }
  }
  return byModule;
}

/** The undeclared-identifier findings of the runtime modules under `root`. */
export function checkUndeclaredIdentifiers(root = skillRoot) {
  const t = ts();
  const files = runtimeModules(root);
  const pageFunctions = pageFunctionsByModule(t, files);
  const findings = [];
  for (const file of files) {
    const source = parseSource(fs.readFileSync(file, 'utf8'), file);
    for (const { name, line, column } of undeclaredNames(t, source, { pageFunctions: pageFunctions.get(file) })) {
      findings.push({ code: CODE, path: posix(path.relative(root, file)), message: `${posix(path.relative(root, file))}:${line}:${column} "${name}" is read or written but no declaration, import, parameter or global binds it in its scope (a re-export from another module binds nothing locally)` });
    }
  }
  return findings;
}

if (isMain(import.meta.url)) process.exit(printFindings(checkUndeclaredIdentifiers(), 'OK: every identifier of the runtime modules resolves to a declaration, import, parameter or global.'));
