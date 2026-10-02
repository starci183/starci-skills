#!/usr/bin/env node
// check-env.mjs - every environment variable the runtime reads is catalogued, and read in one place (smell S8-01, S8-02 and
// S11-04; part of `npm run check`).
//   node scripts/checks/check-env.mjs [--json]
//
// The catalog is modules/schemas/env.yaml (`variables:` keyed by name: purpose, kind). Its `reader` field names the one
// module that reads `process.env` by name (scripts/lib/env.mjs: readEnv, isSpecRun, ...). The check parses every runtime
// production source (`.mjs` under scripts/, engine/, modules/, bin/, ext/, ui/ and the packages, no specs, no generated
// copies) and judges:
//   RT_ENV_UNCATALOGUED       a name read from the environment (`process.env.X`, `process.env['X']`, `env.X`, `env['X']`,
//                             `{ X } = env`) or a STARCI_* name written in code, that is not a key of the catalog
//   RT_ENV_READ_OUTSIDE_OWNER a direct read of one name from `process.env` outside the reader module (an injected `env`
//                             parameter is a pure function's input and may be read by name; `process.env` as a whole is
//                             passed to children and defaults untouched)
//   RT_TEST_ENV_IN_PRODUCTION production code that branches on the test runner (NODE_TEST_CONTEXT) outside the reader
//   RT_ENV_STALE_ENTRY        a catalog entry no production source reads or names any more
// `env` is the runtime's injection convention for a parameter holding the environment; an alias of `process.env` declared
// in the same file counts too.
import fs from 'node:fs';
import path from 'node:path';
import { trackedTextFiles } from '../lib/tracked-files.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { isMain } from '../lib/is-main.mjs';
import { runCheckCli } from '../lib/check-cli.mjs';
import { lineOf, parseSource, ts } from '../hfs/runtime-rules/source-ast.mjs';

export const CATALOG_FILE = 'modules/schemas/env.yaml';
const FAILURE_CODES_FILE = 'modules/kernel/failure-codes.yaml';
const ENV_ROOTS = Object.freeze(['scripts', 'engine', 'modules', 'bin', 'ext', 'ui', 'packages']);
export const KINDS = Object.freeze(['config', 'seam', 'handoff', 'host']);
const TEST_RUNNER_VARIABLE = 'NODE_TEST_CONTEXT';
const GENERATED = /^packages\/[^/]+(\/[^/]+)?\/runtime\//;
const VENDORED = /(^|\/)(node_modules|dist|reference-renders)\//;
const isSpec = (rel) => /\.(test|spec)\.mjs$/.test(rel) || /(^|\/)tests?\//.test(rel);
const OWN_NAMESPACE = /^STARCI_[A-Z0-9_]+$/;
/** An environment variable is spelled UPPER_SNAKE; an injected `env` object also holds other things (a graph env, a layout env), which a lowercase property never is. */
const VARIABLE_NAME = /^[A-Z][A-Z0-9_]*$/;

/**
 * The environment facts of one source: {reads: [{name, line, direct}], dynamic: [{line, direct}], mentions: [{name, line}]}.
 * `direct` is true for a read of `process.env` itself; a read of an injected `env` or an alias is not direct.
 */
export function envFacts(text, rel = 'x.mjs') {
  const t = ts();
  const source = parseSource(text, rel);
  const aliases = new Set(['env']);
  const isProcessEnv = (node) => t.isPropertyAccessExpression(node) && t.isIdentifier(node.expression) && node.expression.text === 'process' && node.name.text === 'env';
  // aliases: `const e = process.env`, `function f(e = process.env)`, `{ env: e = process.env }`
  const collect = (node) => {
    if ((t.isVariableDeclaration(node) || t.isParameter(node) || t.isBindingElement(node)) && node.initializer && isProcessEnv(node.initializer) && t.isIdentifier(node.name)) aliases.add(node.name.text);
    t.forEachChild(node, collect);
  };
  collect(source);
  const reads = [];
  const dynamic = [];
  const mentions = [];
  const kindOf = (object) => (isProcessEnv(object) ? 'direct' : t.isIdentifier(object) && aliases.has(object.text) ? 'injected' : null);
  const assignedOrDeleted = (node) => {
    const p = node.parent;
    return (t.isBinaryExpression(p) && p.left === node && p.operatorToken.kind >= t.SyntaxKind.FirstAssignment && p.operatorToken.kind <= t.SyntaxKind.LastAssignment)
      || (t.isDeleteExpression(p) && p.expression === node);
  };
  const visit = (node) => {
    if (t.isPropertyAccessExpression(node)) {
      const kind = kindOf(node.expression);
      if (kind && !assignedOrDeleted(node) && (kind === 'direct' || VARIABLE_NAME.test(node.name.text))) reads.push({ name: node.name.text, line: lineOf(source, node), direct: kind === 'direct' });
    } else if (t.isElementAccessExpression(node)) {
      const kind = kindOf(node.expression);
      if (kind && !assignedOrDeleted(node)) {
        if (t.isStringLiteralLike(node.argumentExpression)) { if (kind === 'direct' || VARIABLE_NAME.test(node.argumentExpression.text)) reads.push({ name: node.argumentExpression.text, line: lineOf(source, node), direct: kind === 'direct' }); }
        else if (kind === 'direct') dynamic.push({ line: lineOf(source, node), direct: true });
      }
    } else if (t.isVariableDeclaration(node) && node.initializer && t.isObjectBindingPattern(node.name) && kindOf(node.initializer)) {
      for (const el of node.name.elements) if (t.isIdentifier(el.propertyName ?? el.name) && (kindOf(node.initializer) === 'direct' || VARIABLE_NAME.test((el.propertyName ?? el.name).text))) reads.push({ name: (el.propertyName ?? el.name).text, line: lineOf(source, node), direct: kindOf(node.initializer) === 'direct' });
    } else if (t.isStringLiteralLike(node) && OWN_NAMESPACE.test(node.text)) mentions.push({ name: node.text, line: lineOf(source, node) });
    else if (t.isIdentifier(node) && OWN_NAMESPACE.test(node.text)) mentions.push({ name: node.text, line: lineOf(source, node) });
    t.forEachChild(node, visit);
  };
  visit(source);
  return { reads, dynamic, mentions };
}

/** The catalog's variables: {NAME: {purpose, kind}} and the reader module; throws on an unreadable catalog. */
export function parseCatalog(text) {
  const doc = parseYaml(text) ?? {};
  return { reader: doc.reader, variables: doc.variables ?? {} };
}

/**
 * The findings of a source set: [{code, path, line, message}]. files: [{rel, text}] (the runtime sources among them are
 * judged); catalog: parseCatalog(...); failureCodes: the names of modules/kernel/failure-codes.yaml (a STARCI_* refusal code is not a variable).
 */
export function envFindings(files, catalog, failureCodes = new Set()) {
  const findings = [];
  const known = new Set(Object.keys(catalog.variables));
  const seen = new Set();
  for (const { rel, text } of files) {
    if (!rel.endsWith('.mjs') || isSpec(rel) || !ENV_ROOTS.some((r) => rel.startsWith(`${r}/`))) continue;
    const owner = rel === catalog.reader;
    const facts = envFacts(text, rel);
    for (const read of facts.reads) {
      seen.add(read.name);
      if (!known.has(read.name)) findings.push({ code: 'RT_ENV_UNCATALOGUED', path: rel, line: read.line, message: `${read.name} is read from the environment and is not a variable of ${CATALOG_FILE}: add it with its purpose and kind` });
      if (read.name === TEST_RUNNER_VARIABLE && !owner) findings.push({ code: 'RT_TEST_ENV_IN_PRODUCTION', path: rel, line: read.line, message: `${rel} branches on the test runner (${TEST_RUNNER_VARIABLE}): use isSpecRun() of ${catalog.reader}, the one seam` });
      else if (read.direct && !owner) findings.push({ code: 'RT_ENV_READ_OUTSIDE_OWNER', path: rel, line: read.line, message: `${read.name} is read straight from process.env in ${rel}: read it through ${catalog.reader} (readEnv), or take an injected env parameter` });
    }
    for (const d of facts.dynamic) if (d.direct && !owner) findings.push({ code: 'RT_ENV_READ_OUTSIDE_OWNER', path: rel, line: d.line, message: `a name computed at run time is read straight from process.env in ${rel}: read it through ${catalog.reader} (readEnv)` });
    for (const m of facts.mentions) {
      if (failureCodes.has(m.name)) continue; // a refusal code spelled STARCI_*, owned by the failure-code catalog, not a variable
      seen.add(m.name);
      if (!known.has(m.name)) findings.push({ code: 'RT_ENV_UNCATALOGUED', path: rel, line: m.line, message: `${m.name} is an environment variable of the runtime and is not a variable of ${CATALOG_FILE}: add it with its purpose and kind` });
    }
  }
  for (const [name, entry] of Object.entries(catalog.variables)) {
    if (!seen.has(name)) findings.push({ code: 'RT_ENV_STALE_ENTRY', path: CATALOG_FILE, line: 1, message: `${name} is in ${CATALOG_FILE} but no production source reads or names it: delete the entry` });
    if (typeof entry?.purpose !== 'string' || !entry.purpose.trim() || !KINDS.includes(entry?.kind)) findings.push({ code: 'RT_ENV_UNCATALOGUED', path: CATALOG_FILE, line: 1, message: `${name} needs a purpose (a sentence) and a kind (${KINDS.join('|')})` });
  }
  return findings;
}

/** Run the check on the runtime at `root`. */
function checkEnv(root = skillRoot) {
  const files = trackedTextFiles(root, (rel) => rel.endsWith('.mjs') && !GENERATED.test(rel) && !VENDORED.test(rel));
  const failureCodes = new Set(Object.keys(parseYaml(fs.readFileSync(path.join(root, FAILURE_CODES_FILE), 'utf8')) ?? {}));
  return envFindings(files, parseCatalog(fs.readFileSync(path.join(root, CATALOG_FILE), 'utf8')), failureCodes);
}

if (isMain(import.meta.url)) {
  runCheckCli(checkEnv(), 'OK: every environment variable is catalogued and read through its owner.');
}
