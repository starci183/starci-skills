#!/usr/bin/env node
// check-specs.mjs - a spec asserts behaviour, and a skipped test says why (smell S10-01 and S10-03; part of `npm run check`).
//   starci runtime check --only specs [--json]
//
// Every tracked `.spec.mjs` / `.test.mjs` of the runtime (tests/, packages/*, no generated runtime copies) is parsed with the
// TypeScript compiler and judged:
//   RT_SPEC_ASSERTS_SOURCE_TEXT  the spec reads the text of a runtime production source (a `.mjs`/`.js`/`.ts` file under
//                                scripts/, engine/, modules/, bin/, ext/ or ui/ of THIS repository, named through
//                                import.meta or a repository-root constant of the spec) - the usual shape is
//                                `assert.match(readFileSync(...), /text of the implementation/)`. A spec drives the exported
//                                function and asserts what it returns or writes; it never greps the implementation. A
//                                fixture the spec writes into its own temporary directory is not a source of this repository.
//   RT_SPEC_SKIP_UNEXPLAINED     a skipped test (`t.skip(...)`, `it.skip(...)`, `{ skip: cond }`) whose skip does not carry a
//                                reason: a string or template literal in the call or option, or an identifier/member whose
//                                one-hop definition in the file holds one. A silent skip passes without running; a skip
//                                that stays says what is missing and what provisions it.
import { trackedTextFiles } from '../hfs/runtime-rules/tracked-files.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { runCheckCli } from '../lib/check-cli.mjs';
import { lineOf, parseSource, ts } from '../hfs/runtime-rules/source-ast.mjs';

export const SOURCE_ROOTS = Object.freeze(['scripts', 'engine', 'modules', 'bin', 'ext', 'ui']);
const SOURCE_FILE = /\.(mjs|cjs|js|ts|tsx)$/;
const SPEC = /\.(spec|test)\.mjs$/;
const GENERATED = /^packages\/[^/]+(\/[^/]+)?\/runtime\//;
const VENDORED = /(^|\/)(node_modules|dist)\//;
const TEST_CALLEES = new Set(['test', 'it', 'describe', 'suite', 'before', 'after']);

/** The string literals under `node`, in source order. */
function literalsOf(node) {
  const t = ts();
  const out = [];
  const visit = (n) => {
    if (t.isStringLiteralLike(n)) out.push(n.text);
    else if (t.isTemplateExpression(n)) { out.push(n.head.text); n.templateSpans.forEach((s) => out.push(s.literal.text)); }
    t.forEachChild(n, visit);
  };
  visit(node);
  return out;
}

/** The facts of one spec: {sourceReads: [{line, path}], skips: [{line, explained}]}. */
export function specFacts(text, rel = 'x.spec.mjs') {
  const t = ts();
  const source = parseSource(text, rel);
  // top-level const bindings: name -> initializer
  const consts = new Map();
  const functions = new Map();
  for (const stmt of source.statements) {
    if (t.isVariableStatement(stmt)) for (const d of stmt.declarationList.declarations) if (t.isIdentifier(d.name) && d.initializer) consts.set(d.name.text, d.initializer);
    if (t.isFunctionDeclaration(stmt) && stmt.name) functions.set(stmt.name.text, stmt);
  }
  const mentionsImportMeta = (node) => /import\.meta/.test(node.getText(source));
  /** True when `node` is a repository-relative anchor: import.meta itself, or a top-level const (resolved one hop) built from it. */
  const anchored = (node) => {
    if (mentionsImportMeta(node)) return true;
    let found = false;
    const visit = (n) => {
      if (t.isIdentifier(n) && consts.has(n.text) && mentionsImportMeta(consts.get(n.text))) found = true;
      t.forEachChild(n, visit);
    };
    visit(node);
    return found;
  };
  const hasLiteral = (node) => literalsOf(node).some((s) => s.trim().length > 0);
  /** True when the expression can evaluate to a reason text: a string/template, or a branch (?:, &&, ||, ??) that does. A comparison against a string is not a reason. */
  const yieldsReason = (node) => {
    if (t.isStringLiteralLike(node)) return node.text.trim().length > 0;
    if (t.isTemplateExpression(node)) return true;
    if (t.isParenthesizedExpression(node) || t.isAsExpression(node)) return yieldsReason(node.expression);
    if (t.isConditionalExpression(node)) return yieldsReason(node.whenTrue) || yieldsReason(node.whenFalse);
    if (t.isBinaryExpression(node) && [t.SyntaxKind.AmpersandAmpersandToken, t.SyntaxKind.BarBarToken, t.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) return yieldsReason(node.right) || yieldsReason(node.left);
    return false;
  };
  const explainedByDefinition = (node) => {
    let root = node;
    while (t.isPropertyAccessExpression(root) || t.isElementAccessExpression(root) || t.isCallExpression(root)) root = root.expression;
    if (!t.isIdentifier(root)) return false;
    const init = consts.get(root.text);
    if (!init) return false;
    if (hasLiteral(init)) return true;
    let callee = init;
    while (t.isAwaitExpression(callee) || t.isParenthesizedExpression(callee)) callee = callee.expression;
    if (t.isCallExpression(callee) && t.isIdentifier(callee.expression)) {
      const fn = functions.get(callee.expression.text) ?? consts.get(callee.expression.text);
      if (fn && hasLiteral(fn)) return true;
    }
    return false;
  };
  const sourceReads = [];
  const skips = [];
  const visit = (node) => {
    if (t.isCallExpression(node)) {
      const callee = node.expression;
      const name = t.isPropertyAccessExpression(callee) ? callee.name.text : t.isIdentifier(callee) ? callee.text : null;
      if ((name === 'readFileSync' || name === 'readFile') && node.arguments.length && anchored(node.arguments[0])) {
        const joined = literalsOf(node.arguments[0]).join('/').replaceAll('\\', '/').replace(/^(\.\.?\/)+/, '');
        const rootSegment = joined.split('/').filter(Boolean)[0];
        if (SOURCE_ROOTS.includes(rootSegment) && SOURCE_FILE.test(joined) && !SPEC.test(joined)) sourceReads.push({ line: lineOf(source, node), path: joined });
      }
      if (t.isPropertyAccessExpression(callee) && callee.name.text === 'skip' && t.isIdentifier(callee.expression) && /^(t|it|test|describe|suite|ctx|context)$/.test(callee.expression.text)) {
        skips.push({ line: lineOf(source, node), explained: node.arguments.some(yieldsReason) || node.arguments.some(explainedByDefinition) });
      }
      if (name && TEST_CALLEES.has(name) || (t.isPropertyAccessExpression(callee) && TEST_CALLEES.has(callee.expression.getText(source)))) {
        for (const arg of node.arguments) {
          if (!t.isObjectLiteralExpression(arg)) continue;
          for (const prop of arg.properties) {
            if (!t.isPropertyAssignment(prop) || prop.name.getText(source) !== 'skip') continue;
            const value = prop.initializer;
            if (value.kind === t.SyntaxKind.FalseKeyword) continue;
            skips.push({ line: lineOf(source, prop), explained: yieldsReason(value) || explainedByDefinition(value) });
          }
        }
      }
    }
    t.forEachChild(node, visit);
  };
  visit(source);
  return { sourceReads, skips };
}

/** The findings of a spec set: [{code, path, line, message}]. files: [{rel, text}]. */
export function specFindings(files) {
  const findings = [];
  for (const { rel, text } of files) {
    if (!SPEC.test(rel) || GENERATED.test(rel) || VENDORED.test(rel)) continue;
    const facts = specFacts(text, rel);
    for (const r of facts.sourceReads) findings.push({ code: 'RT_SPEC_ASSERTS_SOURCE_TEXT', path: rel, line: r.line, message: `the spec reads the text of ${r.path}: call its exported function and assert what it returns or writes, never the implementation text` });
    for (const s of facts.skips) if (!s.explained) findings.push({ code: 'RT_SPEC_SKIP_UNEXPLAINED', path: rel, line: s.line, message: 'a skipped test carries no reason: provision what it needs so it runs, or give the skip a reason that names what is missing and what provides it' });
  }
  return findings;
}

/** Run the check on the runtime at `root`. */
function checkSpecs(root = skillRoot) {
  const files = trackedTextFiles(root, (rel) => SPEC.test(rel) && !GENERATED.test(rel) && !VENDORED.test(rel));
  return specFindings(files);
}

if (isMain(import.meta.url)) {
  runCheckCli(checkSpecs(), 'OK: no spec reads implementation text and every skip says why.');
}
