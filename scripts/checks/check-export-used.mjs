#!/usr/bin/env node
// check-export-used.mjs - an export is used somewhere (smell S5-01; part of `npm run check`).
//   node scripts/checks/check-export-used.mjs [--json]
//
// RT_EXPORT_UNUSED: a name that a runtime source file (`.mjs` under scripts/, engine/, modules/, bin/, ext/, ui/ and the
// packages without the generated runtime copies) exports, and that no OTHER tracked text file mentions, is dead surface:
// strip the `export` (the name is used only here) or delete the declaration (it is used nowhere). A mention is the name as
// a whole word in any other tracked text file (source, spec, yaml, json, markdown, shell), so a handler a manifest names
// and a symbol a spec imports both count. The one structural exemption is a package's public entry: the files its
// package.json names under `main`, `exports`, `bin` and `types` are API for consumers outside the repository, and the one call
// function a scripts/api/<system>/<call>.mjs file exports (named after the file, RT_API_SHAPE: the call's own contract). There
// is no pending list and no allowlist.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { lsFiles } from '../api/git/ls-files.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { callFunctionName } from '../hfs/runtime-rules/api-shape.mjs';
import { boundNames } from '../lib/ast-names.mjs';

const EXPORT_ROOTS = Object.freeze(['scripts', 'engine', 'modules', 'bin', 'ext', 'ui', 'packages']);
const TEXT = /\.(mjs|cjs|js|ts|tsx|json|ya?ml|md|sh|ps1|sql|txt|css|html|hbs|ejs|tpl)$/;
const GENERATED = /^packages\/[^/]+(\/[^/]+)?\/runtime\//;
const VENDORED = /(^|\/)(node_modules|dist|reference-renders)\//;
const API_CALL_FILE = /^scripts\/api\/[^/]+\/(?!lib\.mjs$)([^/]+)\.mjs$/;
const isSpec = (rel) => /\.(test|spec)\.mjs$/.test(rel) || /(^|\/)tests?\//.test(rel);
const MAX_TEXT_BYTES = 3_000_000;

const acorn = () => createRequire(path.join(skillRoot, 'packages', 'node_modules', 'x.js'))('acorn');

/** [{name, line}] of the named exports of a module's source (declarations and `export { a, b as c }` lists; `default` and re-exports from another module are not judged). */
export function exportedNames(text, parse = acorn().parse) {
  let ast;
  try { ast = parse(text, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true, allowReturnOutsideFunction: true, locations: true }); } catch { return []; }
  const out = [];
  for (const stmt of ast.body) {
    if (stmt.type !== 'ExportNamedDeclaration') continue;
    if (stmt.declaration) {
      const names = [];
      if (stmt.declaration.id) names.push(stmt.declaration.id.name);
      else for (const d of stmt.declaration.declarations ?? []) boundNames(d.id, names);
      for (const name of names) out.push({ name, line: stmt.loc.start.line });
    } else if (!stmt.source) for (const s of stmt.specifiers) out.push({ name: s.exported.name, line: stmt.loc.start.line });
  }
  return out;
}

/** The files a package.json names as its public entry (main, module, types, exports, bin), as repo-relative paths. */
export function publicEntries(packageRel, packageText) {
  let pkg;
  try { pkg = JSON.parse(packageText); } catch { return []; }
  const dir = path.posix.dirname(packageRel);
  const found = [];
  const add = (value) => {
    if (typeof value === 'string') found.push(path.posix.normalize(path.posix.join(dir === '.' ? '' : dir, value)));
    else if (Array.isArray(value)) value.forEach(add);
    else if (value && typeof value === 'object') Object.values(value).forEach(add);
  };
  for (const key of ['main', 'module', 'types', 'exports', 'bin']) add(pkg[key]);
  return found;
}

/**
 * The findings of a tree: [{code, path, line, message}]. files: [{rel, text}] (every tracked text file; the judged ones are
 * the runtime `.mjs` sources among them).
 */
export function exportUsedFindings(files) {
  const mentions = new Map();
  for (const { rel, text } of files) {
    for (const word of new Set(text.match(/[A-Za-z_$][\w$]*/g) ?? [])) {
      let set = mentions.get(word);
      if (!set) { set = new Set(); mentions.set(word, set); }
      set.add(rel);
    }
  }
  const entries = new Set(files.filter((f) => path.posix.basename(f.rel) === 'package.json').flatMap((f) => publicEntries(f.rel, f.text)));
  const findings = [];
  for (const { rel, text } of files) {
    if (!rel.endsWith('.mjs') || isSpec(rel) || entries.has(rel) || !EXPORT_ROOTS.some((r) => rel.startsWith(`${r}/`))) continue;
    for (const { name, line } of exportedNames(text)) {
      if (name === callFunctionName(rel.match(API_CALL_FILE)?.[1] ?? '')) continue;
      const where = mentions.get(name);
      if (where && [...where].some((other) => other !== rel)) continue;
      findings.push({ code: 'RT_EXPORT_UNUSED', path: rel, line, name,
        message: `${name} is exported by ${rel} and mentioned by no other file: drop the export (or the declaration when ${rel} does not use it either)` });
    }
  }
  return findings;
}

/** Every tracked text file of the runtime at `root` (generated copies and vendored trees excluded). */
function readTracked(root = skillRoot) {
  const tracked = lsFiles(['-z'], { dir: root, maxBuffer: 64 * 1024 * 1024 }).stdout.split('\0').filter(Boolean);
  const files = [];
  for (const rel of tracked) {
    if (!TEXT.test(rel) || GENERATED.test(rel) || VENDORED.test(rel) || rel.startsWith('packages/grammar/')) continue;
    const file = path.join(root, rel);
    try {
      if (fs.statSync(file).size > MAX_TEXT_BYTES) continue;
      files.push({ rel, text: fs.readFileSync(file, 'utf8') });
    } catch { /* a tracked file deleted in the worktree is not judged */ }
  }
  return files;
}

if (isMain(import.meta.url)) {
  const findings = exportUsedFindings(readTracked());
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: findings.length === 0, findings }, null, 2));
  else {
    for (const f of findings) console.error(`${f.code} ${f.path}:${f.line} ${f.message}`);
    if (!findings.length) console.log('OK: every export is used by another file.');
  }
  process.exit(findings.length ? 1 : 0);
}
