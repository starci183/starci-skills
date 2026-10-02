#!/usr/bin/env node
// check-clones.mjs - one block of code, one place (smell S4; part of `npm run check`).
//   node scripts/checks/check-clones.mjs [--json]
//
// RT_DUPLICATE_CODE: a token-normalised block of at least CLONE_LINES source lines and CLONE_TOKENS tokens that appears twice in
// the runtime's production source (two files, or twice in one file) is code copied instead of shared. The threshold is the
// one of the product rule R21 (knowledge/hfs/slots.yaml ruleParams.<profile>.duplicateBlock: 8 lines, 60 tokens).
// Normalisation: every file is flattened into its syntax-node sequence (comments and whitespace do not exist in it),
// identifiers become one kind, string/template/number/regex literals one kind, keywords and operators keep their own
// kind; import and export-from statements are dropped (imports repeat legitimately). A window is the run of tokens on 8
// consecutive physical lines that starts at a line start; equal windows are found by hash, and hits on consecutive lines of
// the same two locations merge into one maximal block. Blocks are compared inside one unit (the runtime proper, or one published package: packages/eslint/be and packages/eslint/fe are two); packages/grammar is out of scope. A block whose nodes are mostly type declarations is ignored. The
// finding sits on the later location, names the first one and the home of the shared code.
import crypto from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';
import { trackedTextFiles } from '../lib/tracked-files.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { runCheckCli } from '../lib/check-cli.mjs';
import { tokenize as tokenizeSource } from '../hfs/architecture/clones.mjs';

export const CLONE_LINES = 8;
export const CLONE_TOKENS = 60;
export const CLONE_ROOTS = Object.freeze(['scripts', 'engine', 'modules', 'bin', 'ext', 'ui', 'packages']);
const SOURCE = /\.(mjs|js|ts|tsx)$/;
const isTest = (rel) => /(^|\/)tests?\//.test(rel) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(rel) || /\.d\.[cm]?ts$/.test(rel);
const GENERATED = /^packages\/[^/]+(\/[^/]+)?\/runtime\//;
const VENDORED = /(^|\/)(node_modules|dist|reference-renders)\//;
// packages/grammar is a published React component library judged by its own Sonar duplication gate (its markup and Storybook files repeat by design); it is not runtime code.
const OUT_OF_SCOPE = /^packages\/grammar\//;
/** The unit a file belongs to: a package (packages/eslint/<be|fe> is one) or the runtime proper. Blocks are compared inside one unit: two packages are published apart and cannot import each other. */
export const unitOf = (rel) => (rel.startsWith('packages/eslint/') ? rel.split('/').slice(0, 3).join('/') : rel.startsWith('packages/') ? rel.split('/').slice(0, 2).join('/') : 'runtime');
const MAX_FINDINGS = 400;

let typescript = null;
const tsOf = () => { typescript ??= createRequire(path.join(skillRoot, 'packages', 'node_modules', 'x.js'))('typescript'); return typescript; };
/** The normalised node sequence of a source file: {kinds, lines, types} (the line of each node, and whether it sits in a type declaration). */
function tokenize(rel, text) {
  const ts = tsOf();
  const kindOfFile = rel.endsWith('.tsx') ? ts.ScriptKind.TSX : rel.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  return tokenizeSource(ts, ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, false, kindOfFile));
}

/** Where the shared code of a block belongs, by the files that hold it. */
function homeText(a, b) {
  if (a === b) return 'extract it once in the file and call it from both places';
  if (a.startsWith('packages/') || b.startsWith('packages/')) return 'move it into one module of the package and import it from both files';
  return 'move it into one scripts/lib module (or the owning module) and import it from both files';
}

const windowKey = (kinds, start, end) => `${end - start}:${crypto.createHash('sha1').update(Buffer.from(kinds.buffer, kinds.byteOffset + start * 4, (end - start) * 4)).digest('base64')}`;

/**
 * The findings of a source set: [{code, path, line, message}], one per duplicated block, on the later location, naming
 * the first. files: [{rel, text}].
 */
export function cloneFindings(files, { lines: N = CLONE_LINES, tokens: T = CLONE_TOKENS } = {}) {
  const entries = files.filter((f) => SOURCE.test(f.rel) && !isTest(f.rel)).sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0)).map((f) => ({ rel: f.rel, ...tokenize(f.rel, f.text) }));
  const buckets = new Map();
  entries.forEach((file, fileIndex) => {
    const { kinds, lines } = file;
    const count = kinds.length;
    let end = 0;
    for (let start = 0; start < count; start += 1) {
      if (start > 0 && lines[start] === lines[start - 1]) continue;
      const limit = lines[start] + N;
      if (end < start) end = start;
      while (end < count && lines[end] < limit) end += 1;
      if (end === start || lines[end - 1] - lines[start] + 1 < N || end - start < T) continue;
      const key = `${unitOf(file.rel)}|${windowKey(kinds, start, end)}`;
      const list = buckets.get(key);
      if (list) list.push([fileIndex, start, end]); else buckets.set(key, [[fileIndex, start, end]]);
    }
  });
  // pair key `${fileA}:${fileB}:${line offset}` -> the windows of A that equal a window of B at that offset
  const pairs = new Map();
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const [first, ...rest] = list;
    for (const other of rest) {
      const a = entries[first[0]];
      const b = entries[other[0]];
      const key = `${first[0]}:${other[0]}:${b.lines[other[1]] - a.lines[first[1]]}`;
      if (!pairs.has(key)) pairs.set(key, []);
      pairs.get(key).push({ a: first, b: other });
    }
  }
  const findings = [];
  for (const [key, hits] of pairs) {
    const [ai, bi, offset] = key.split(':').map(Number);
    const fa = entries[ai];
    const fb = entries[bi];
    hits.sort((x, y) => fa.lines[x.a[1]] - fa.lines[y.a[1]]);
    let block = null;
    const flush = () => {
      if (!block) return;
      const lineSpan = block.endLine - block.startLine + 1;
      let typeNodes = 0;
      for (let i = block.aStart; i < block.aEnd; i += 1) typeNodes += fa.types[i];
      const shapes = new Set();
      let shape = [];
      for (let i = block.aStart; i < block.aEnd; i += 1) {
        if (i > block.aStart && fa.lines[i] !== fa.lines[i - 1]) { shapes.add(shape.join(',')); shape = []; }
        shape.push(fa.kinds[i]);
      }
      shapes.add(shape.join(','));
      // A table of one repeated row shape is a list, not copied logic; a block matching itself shifted by less than its own length is a repetition.
      const repetition = shapes.size < N / 3 || (ai === bi && Math.abs(offset) < lineSpan);
      if (lineSpan >= N && typeNodes * 2 < block.aEnd - block.aStart && !repetition) {
        findings.push({ code: 'RT_DUPLICATE_CODE', path: fb.rel, line: block.startLine + offset,
          message: `${lineSpan} duplicated lines also at ${fa.rel}:${block.startLine}: ${homeText(fa.rel, fb.rel)}` });
      }
      block = null;
    };
    for (const hit of hits) {
      const startLine = fa.lines[hit.a[1]];
      const endLine = fa.lines[hit.a[2] - 1];
      if (block && startLine <= block.endLine + 1) {
        block.endLine = Math.max(block.endLine, endLine);
        block.aEnd = Math.max(block.aEnd, hit.a[2]);
      } else { flush(); block = { startLine, endLine, aStart: hit.a[1], aEnd: hit.a[2] }; }
    }
    flush();
  }
  const seen = new Set();
  return findings.filter((f) => { const k = `${f.path}:${f.line}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((x, y) => (x.path < y.path ? -1 : x.path > y.path ? 1 : x.line - y.line)).slice(0, MAX_FINDINGS);
}

/** Run the check on the runtime at `root`. */
export function checkClones(root = skillRoot) {
  const files = trackedTextFiles(root,
    (rel) => CLONE_ROOTS.some((r) => rel.startsWith(`${r}/`)) && SOURCE.test(rel) && !GENERATED.test(rel) && !VENDORED.test(rel) && !OUT_OF_SCOPE.test(rel));
  return cloneFindings(files);
}

if (isMain(import.meta.url)) runCheckCli(checkClones(), 'OK: no duplicated block of code.');
