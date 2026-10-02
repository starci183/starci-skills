#!/usr/bin/env node
// check-helper-once.mjs - one home per shared helper (redundancy RED15 and RED17; part of `npm run check`).
//   starci runtime check --only helper-once -- [--json]
//
// RT_HELPER_REDEFINED: every tracked `.mjs` under scripts/, engine/, modules/, bin/ and ext/ is parsed with acorn. The
// helper table is DERIVED from the exports of the shared libs (scripts/lib/*.mjs, scripts/api/<system>/lib.mjs, engine/*.mjs and the check kit
// scripts/lib/walk.mjs): each exported function/const gets a normalised token sequence (parameters plus body,
// declared names renamed by first use, comments, whitespace and semicolons dropped). A top-level function/const of any
// other place whose sequence equals an exported helper's is a copy: import the lib one. A copy with a different body is a
// different contract and is not flagged. Two libs that export one NAME with different contracts are reported for a rename.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { lsFiles } from '../api/git/ls-files.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';

// acorn lives in packages/node_modules (a dev dependency of the packages workspace); no other path is tried.
const acorn = createRequire(path.join(skillRoot, 'packages', 'node_modules', 'x.js'))('acorn');

export const SCRIPT_ROOTS = Object.freeze(['scripts', 'engine', 'modules', 'bin', 'ext']);
/** Shortest normalised sequence that counts as a helper body: below it two functions agree by accident. */
const MIN_TOKENS = 8;

const isLib = (rel) => /^(scripts\/lib|engine)\/[^/]+\.mjs$/.test(rel) || /^scripts\/api\/[^/]+\/lib\.mjs$/.test(rel) || rel === 'scripts/lib/walk.mjs';
const isTest = (rel) => rel.startsWith('tests/') || /\.(test|spec)\.mjs$/.test(rel);
const GENERATED = /^packages\/[^/]+\/runtime\//;

const parse = (text) => acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true, allowReturnOutsideFunction: true });

/** Names a pattern binds (identifiers, destructuring, defaults, rest). */
function bound(pattern, into) {
  if (!pattern) return;
  if (pattern.type === 'Identifier') into.add(pattern.name);
  else if (pattern.type === 'ObjectPattern') pattern.properties.forEach((p) => bound(p.value ?? p.argument, into));
  else if (pattern.type === 'ArrayPattern') pattern.elements.forEach((p) => bound(p, into));
  else if (pattern.type === 'AssignmentPattern') bound(pattern.left, into);
  else if (pattern.type === 'RestElement') bound(pattern.argument, into);
}

/** Every name declared anywhere inside `node` (params, var/let/const, functions, classes, catch parameters). */
function declaredNames(node) {
  const names = new Set();
  const visit = (n) => {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'VariableDeclarator') bound(n.id, names);
    if (/^Function/.test(n.type) || n.type === 'ArrowFunctionExpression') { if (n.id) names.add(n.id.name); n.params.forEach((p) => bound(p, names)); }
    if (n.type === 'ClassDeclaration' && n.id) names.add(n.id.name);
    if (n.type === 'CatchClause') bound(n.param, names);
    for (const key of Object.keys(n)) {
      const v = n[key];
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v.type === 'string') visit(v);
    }
  };
  visit(node);
  return names;
}

/** Token text of `source.slice(start, end)`, declared names renamed by first use, `;` and comments dropped. */
function tokensOf(source, start, end, renames, extraNames) {
  const out = [];
  const raw = [...acorn.tokenizer(source.slice(start, end), { ecmaVersion: 'latest', sourceType: 'module' })].filter((t) => t.type.label !== 'eof');
  raw.forEach((t, i) => {
    const text = source.slice(start + t.start, start + t.end);
    if (text === ';') return;
    const prev = raw[i - 1]?.type.label;
    if (t.type.label === 'name' && extraNames.has(text) && prev !== '.' && prev !== '?.') {
      if (!renames.has(text)) renames.set(text, `$${renames.size}`);
      out.push(renames.get(text));
    } else out.push(text);
  });
  return out;
}

/** The normalised token sequence of a function or const value: parameters, then the body as statements. */
export function normalise(source, node) {
  const renames = new Map();
  const names = declaredNames(node);
  if (/^Function/.test(node.type) || node.type === 'ArrowFunctionExpression') {
    const params = node.params.length ? tokensOf(source, node.params[0].start, node.params.at(-1).end, renames, names) : [];
    const body = node.body.type === 'BlockStatement'
      ? tokensOf(source, node.body.start + 1, node.body.end - 1, renames, names)
      : ['return', ...tokensOf(source, node.body.start, node.body.end, renames, names)];
    return [`fn${node.async ? 'A' : ''}${node.generator ? 'G' : ''}`, '(', ...params, ')', '{', ...body, '}'].join(' ');
  }
  return tokensOf(source, node.start, node.end, renames, names).join(' ');
}

/** [{name, node, exported}] for each top-level function/const declaration of a program. */
function topLevel(ast) {
  const exportedNames = new Set();
  const rows = [];
  const add = (name, node, exported) => rows.push({ name, node, exported });
  for (const stmt of ast.body) {
    const decl = stmt.type === 'ExportNamedDeclaration' && stmt.declaration ? stmt.declaration : stmt;
    const exported = decl !== stmt;
    if (decl.type === 'FunctionDeclaration' && decl.id) add(decl.id.name, decl, exported);
    else if (decl.type === 'VariableDeclaration' && decl.kind === 'const') {
      for (const d of decl.declarations) if (d.id.type === 'Identifier' && d.init) add(d.id.name, d.init, exported);
    } else if (stmt.type === 'ExportNamedDeclaration' && !stmt.source) stmt.specifiers.forEach((s) => exportedNames.add(s.local.name));
  }
  return rows.map((r) => ({ ...r, exported: r.exported || exportedNames.has(r.name) }));
}

/**
 * Names of the module's own mutable state: top-level `let`/`var` bindings and `const` bindings holding a fresh object
 * (`new X()`, `{...}`, `[...]`). A helper that reads one is bound to its module's state (`() => cache.clear()` clears THIS
 * module's cache), so an identical body elsewhere is a different function, not a copy to import.
 */
function moduleState(ast) {
  const names = new Set();
  for (const stmt of ast.body) {
    const decl = stmt.type === 'ExportNamedDeclaration' && stmt.declaration ? stmt.declaration : stmt;
    if (decl.type !== 'VariableDeclaration') continue;
    for (const d of decl.declarations) {
      const fresh = d.init && ['NewExpression', 'ObjectExpression', 'ArrayExpression'].includes(d.init.type);
      if (decl.kind !== 'const' || fresh) bound(d.id, names);
    }
  }
  return names;
}

/** True when `node` reads one of `state` as a free name (not as a property after `.`). */
function readsState(source, node, state) {
  if (!state.size) return false;
  const tokens = [...acorn.tokenizer(source.slice(node.start, node.end), { ecmaVersion: 'latest', sourceType: 'module' })];
  const local = declaredNames(node);
  return tokens.some((t, i) => t.type.label === 'name' && state.has(t.value) && !local.has(t.value) && !['.', '?.'].includes(tokens[i - 1]?.type.label));
}

const lineOf = (source, offset) => source.slice(0, offset).split('\n').length;

/**
 * The findings of a tree: [{code, path, line, message}].
 * files: {tracked: [rel], read: (rel) => text}.
 */
export function helperOnceFindings({ tracked, read }) {
  const scripts = tracked.filter((rel) => rel.endsWith('.mjs') && SCRIPT_ROOTS.some((r) => rel.startsWith(`${r}/`)) && !isTest(rel) && !GENERATED.test(rel));
  const parsed = scripts.map((rel) => {
    const source = read(rel);
    const ast = parse(source);
    const state = moduleState(ast);
    return { rel, source, rows: topLevel(ast).filter((row) => !readsState(source, row.node, state)), ast: null };
  });
  const findings = [];
  // The table: exported helpers of the libs, keyed by normalised sequence.
  const table = new Map();
  const byName = new Map();
  for (const file of parsed.filter((f) => isLib(f.rel))) {
    for (const row of file.rows.filter((r) => r.exported)) {
      const sequence = normalise(file.source, row.node);
      if (sequence && sequence.split(' ').length >= MIN_TOKENS) {
        if (!table.has(sequence)) table.set(sequence, []);
        table.get(sequence).push({ rel: file.rel, name: row.name });
      }
      if (!byName.has(row.name)) byName.set(row.name, new Map());
      byName.get(row.name).set(file.rel, sequence);
    }
  }
  for (const [name, homes] of byName) {
    if (new Set(homes.values()).size > 1) {
      findings.push({ code: 'RT_HELPER_REDEFINED', path: [...homes.keys()].sort()[0], line: 1,
        message: `${name} is exported by ${[...homes.keys()].sort().join(' and ')} with different contracts: rename one` });
    }
  }
  for (const file of parsed) {
    for (const row of file.rows) {
      const sequence = normalise(file.source, row.node);
      const homes = (table.get(sequence) ?? []).filter((h) => !(h.rel === file.rel && h.name === row.name));
      if (sequence && homes.length && (!isLib(file.rel) || !row.exported || homes.some((h) => h.rel < file.rel || (h.rel === file.rel)))) {
        const home = homes[0];
        findings.push({ code: 'RT_HELPER_REDEFINED', path: file.rel, line: lineOf(file.source, row.node.start),
          message: `${row.name} repeats ${home.name} exported by ${home.rel}: import it instead of redefining it` });
      }
    }
  }
  return findings;
}

/** Run the check on the runtime at `root`. */
export function checkHelperOnce(root = skillRoot) {
  const tracked = lsFiles(['-z'], { dir: root, maxBuffer: 64 * 1024 * 1024 }).stdout.split('\0').filter(Boolean);
  return helperOnceFindings({ tracked, read: (rel) => fs.readFileSync(path.join(root, rel), 'utf8') });
}

if (isMain(import.meta.url)) {
  const findings = checkHelperOnce();
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: findings.length === 0, findings }, null, 2));
  else {
    for (const f of findings) console.error(`${f.code} ${f.path}:${f.line} ${f.message}`);
    if (!findings.length) console.log('OK: every shared helper has one home.');
  }
  process.exit(findings.length ? 1 : 0);
}
