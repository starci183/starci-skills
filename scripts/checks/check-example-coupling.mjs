#!/usr/bin/env node
// check-example-coupling.mjs — NO_EXAMPLE_COUPLING (rule R206): runtime source never names a product
// example. The runtime ships as the .claude of any product, so a source file that says
// `examples/<name>`, a product repo name, a product-prefixed incident id or a host drive path couples
// the canon to one checkout and lands broken or leaking on every other.
//
// Scanned: the tracked files of scripts/, engine/, ui/src, ui/api and packages/ - minus the generated
// runtime copies (packages/*/runtime/), specs and tests (a .spec/.test file or a tests/ segment outside
// the managed templates), which are out of scope. packages/hfs/templates/** is scanned whole: a
// template is source, even when it generates a spec.
//
//   RT_EXAMPLE_COUPLING          a literal examples/<name> path - a concrete example directory
//   RT_PRODUCT_NAME_IN_SOURCE    a product name (the closed PRODUCT_NAMES list of
//                                scripts/lib/example-refs.mjs) or an inc-<hash> token a product
//                                name prefixes
//   RT_HOST_PATH_IN_TEMPLATE     a hard-coded host path (drive letter, /Users/, /home/, an expanded
//                                AppData path) - the matcher is scripts/lib/host-path.mjs
//
// No file allowlist. The one exemption is the declaration file scripts/lib/example-refs.mjs: a read the
// runtime genuinely makes at run time is declared there as a named constant, and every consumer names
// the constant. This file and its spec name the tokens they enforce.
//
// Exit 0 clean, 1 lists every hit as file:line, 2 bad arguments.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkFiles } from '../lib/walk.mjs';
import { hostPathHits } from '../lib/host-path.mjs';
import { ts } from '../hfs/runtime-rules/source-ast.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { gitOutputOf } from '../lib/git.mjs';
import { isMain } from '../lib/is-main.mjs';
import { lineOf, runReportMain } from '../lib/check-scan.mjs';

const HELP = `Usage: check-example-coupling [--root <tree>] [--json]

Refuses a literal examples/<name>, a product repo name, a product-prefixed inc-<hash>
and a host drive path in runtime sources (scripts/, engine/, ui/src, ui/api,
packages/ minus generated runtime copies, specs and tests) and the managed
templates (packages/hfs/templates/**). Exit 0 clean, 1 lists the hits, 2 is a bad
argument.`;

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const RT_EXAMPLE_COUPLING = 'RT_EXAMPLE_COUPLING';
export const RT_PRODUCT_NAME_IN_SOURCE = 'RT_PRODUCT_NAME_IN_SOURCE';
export const RT_HOST_PATH_IN_TEMPLATE = 'RT_HOST_PATH_IN_TEMPLATE';

/** The scanned roots of the runtime repository. */
const SCAN_ROOTS = Object.freeze(['scripts', 'engine', 'ui/src', 'ui/api', 'packages']);
/** The managed templates: scanned whole (a template that generates a spec is still source). */
const TEMPLATES_ROOT = 'packages/hfs/templates/';
/** The one file that declares the reads the runtime makes of its own examples/ tree (R206). */
const DECLARED_REFS = 'scripts/lib/example-refs.mjs';
/** This check and its spec name the tokens they enforce. */
const SELF_FILES = new Set(['scripts/checks/check-example-coupling.mjs', 'tests/checks/example-coupling.spec.mjs', DECLARED_REFS]);
/** Out of scope: a spec or test file, a tests/fixtures segment, the generated runtime copies, a changelog. */
const OUT_OF_SCOPE = (rel) =>
  rel !== undefined && (/(?:^|\/)runtime\//.test(rel) || /(?:^|\/)(?:tests?|fixtures?|__tests__|__fixtures__|node_modules)(?:\/|$)/.test(rel)
    || /\.(?:spec|test)\.[cm]?[jt]sx?$/.test(rel) || /(?:^|\/)CHANGELOG[^/]*\.md$/i.test(rel));

/** The product names of the products this runtime shipped against - declared once in example-refs.mjs. */
import { PRODUCT_NAMES } from '../lib/example-refs.mjs';
const PRODUCT_RE = new RegExp(`(?<![A-Za-z0-9])(?:${PRODUCT_NAMES.join('|')})(?![A-Za-z0-9])`, 'gi');
/** A concrete example directory named in text: `examples/<name>` at the tree root (a bare `examples/`,
 *  `examples/${x}` or a `examples/` segment inside another tree such as knowledge/ui/examples/ stays generic). */
const EXAMPLE_PATH_RE = /(?:^|[^A-Za-z0-9_/-]|\.{1,2}\/)examples\/([A-Za-z0-9_-][\w.-]*)/gm;
/** The characters a hyphen-joined token is made of; an `inc-<hash>` token is always exactly one run of them. */
const TOKEN_RUN = /[a-z0-9._-]+/gi;

/**
 * The incident tokens of `body` as {token, index, prefix}: the same matches
 * `(?<![A-Za-z0-9])([A-Za-z0-9._-]*?)-?inc-[0-9a-z]{4,}[A-Za-z0-9._-]*` yields (a run whose prefix is the part before
 * `inc-`, minus the one dash the `-?` drops; a run's first character is never preceded by an alphanumeric, so the
 * lookbehind holds at every run start) - scanned run by run instead of by backtracking.
 */
const incidentTokens = function* (body) {
  for (const run of body.matchAll(TOKEN_RUN)) {
    const lowered = run[0].toLowerCase();
    for (let at = lowered.indexOf('inc-'); at >= 0; at = lowered.indexOf('inc-', at + 1)) {
      if (!/^[0-9a-z]{4}/.test(lowered.slice(at + 4))) continue;
      yield { token: run[0], index: run.index, prefix: run[0].slice(0, at).replace(/-$/, '') };
      break;
    }
  }
};


/** The live tracked source files of `root` under SCAN_ROOTS (git ls-files, or the filesystem of a spec fixture tree). */
export function exampleCouplingScan(root = DEFAULT_ROOT) {
  const scoped = (rel) =>
    SCAN_ROOTS.some((dir) => rel === dir || rel.startsWith(`${dir}/`))
    && !SELF_FILES.has(rel)
    && (rel.startsWith(TEMPLATES_ROOT) || !OUT_OF_SCOPE(rel));
  try {
    return gitOutputOf(lsFiles(['-z'], { dir: root, maxBuffer: 256 * 1024 * 1024 }), 'git ls-files').split('\0').filter(Boolean)
      .map((f) => f.replaceAll('\\', '/'))
      .filter((rel) => scoped(rel) && fs.existsSync(path.join(root, rel))).sort();
  } catch {
    return walkFiles(root, { sorted: true, exclude: (name) => name === '.git' || name === 'node_modules' })
      .map((f) => path.relative(root, f).replaceAll('\\', '/')).filter(scoped);
  }
}

/** Source extensions are read through the TypeScript syntax tree (strings, template parts and comments -
 *  a regular-expression literal is never judged); every other tracked file is read as line text. */
const SOURCE = /\.(?:mjs|cjs|js|mts|cts|ts|tsx|jsx)$/;

/** The coupling hits of one scanned span: [{file, line, code, token, why}]; `at` is the span's offset in `text`. */
function spanHits(rel, text, body, at) {
  const hits = [];
  const push = (code, token, offset, why) => hits.push({ file: rel, line: lineOf(text, at + offset), code, token, why });
  for (const m of body.matchAll(EXAMPLE_PATH_RE))
    push(RT_EXAMPLE_COUPLING, `examples/${m[1]}`, m.index + m[0].indexOf('examples/'), 'a literal examples/<name> path: a source file names one example tree');
  for (const m of body.matchAll(PRODUCT_RE))
    push(RT_PRODUCT_NAME_IN_SOURCE, m[0], m.index, 'a product name in runtime source: the canon ships into every product');
  for (const hit of incidentTokens(body)) {
    PRODUCT_RE.lastIndex = 0;
    if (hit.prefix && PRODUCT_RE.test(hit.prefix)) push(RT_PRODUCT_NAME_IN_SOURCE, hit.token, hit.index, 'an inc-<hash> token prefixed by a product name');
  }
  for (const hit of hostPathHits(body))
    push(RT_HOST_PATH_IN_TEMPLATE, hit.sample, hit.offset, `a hard-coded ${hit.kind}: templates and runtime sources carry relative paths, the runtime root, os.tmpdir() or a config value`);
  return hits;
}

/** The coupling hits of `text` in file `rel`: [{file, line, code, token, why}]. */
export function couplingHits(rel, text) {
  if (!SOURCE.test(rel)) return spanHits(rel, text, text, 0).sort((a, b) => a.line - b.line || a.code.localeCompare(b.code));
  const t = ts();
  let kind = t.ScriptKind.JS;
  if (rel.endsWith('.tsx')) kind = t.ScriptKind.TSX;
  else if (/\.(?:ts|mts|cts)$/.test(rel)) kind = t.ScriptKind.TS;
  const source = t.createSourceFile(rel, text, t.ScriptTarget.Latest, true, kind);
  const found = [];
  const seenComments = new Set();
  const visit = (node) => {
    if (t.isStringLiteralLike(node) || t.isTemplateHead(node) || t.isTemplateMiddle(node) || t.isTemplateTail(node))
      found.push(...spanHits(rel, text, node.text, node.getStart(source)));
    for (const range of t.getLeadingCommentRanges(text, node.getFullStart()) ?? []) {
      if (seenComments.has(range.pos)) continue;
      seenComments.add(range.pos);
      found.push(...spanHits(rel, text, text.slice(range.pos, range.end), range.pos));
    }
    t.forEachChild(node, visit);
  };
  visit(source);
  return found.sort((a, b) => a.line - b.line || a.code.localeCompare(b.code));
}

/** The coupling report of the runtime sources under `root`: {ok, filesScanned, hits}. */
export function checkExampleCoupling(root = DEFAULT_ROOT) {
  const files = exampleCouplingScan(root);
  const hits = [];
  for (const rel of files) {
    const buffer = fs.readFileSync(path.join(root, rel));
    if (buffer.includes(0)) continue;
    hits.push(...couplingHits(rel, buffer.toString('utf8')));
  }
  return { schema: 'starci/example-coupling@1', ok: hits.length === 0, filesScanned: files.length, hits };
}

/** The findings (RT_EXAMPLE_COUPLING, RT_PRODUCT_NAME_IN_SOURCE, RT_HOST_PATH_IN_TEMPLATE) under `root`. */
function exampleCouplingFindings(root = DEFAULT_ROOT) {
  return checkExampleCoupling(root).hits.map((h) => ({
    code: h.code, level: 'error', path: h.file, line: h.line,
    message: `${h.file}:${h.line} names ${h.token}: ${h.why}`,
  }));
}

export const checkExampleCouplingMain = (argv) => runReportMain(argv, {
  name: 'check-example-coupling', help: HELP, root: DEFAULT_ROOT, scan: checkExampleCoupling,
  describe: (report) => ({
    okText: `check-example-coupling: no example or product name in ${report.filesScanned} source files`,
    headline: `check-example-coupling: ${report.hits.length} coupling hit(s) in runtime source`,
    rows: report.hits.map((h) => `  ${h.file}:${h.line}  ${h.code}  ${h.token} — ${h.why}`),
  }),
});

if (isMain(import.meta.url)) {
  const result = checkExampleCouplingMain(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
