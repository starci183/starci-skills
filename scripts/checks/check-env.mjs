#!/usr/bin/env node
// check-env.mjs - every environment variable the runtime reads is catalogued, and read in one place (smell S8-01, S8-02 and
// S11-04; part of `npm run check`).
//   starci runtime check --only env [--json]
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
import { trackedTextFiles } from '../hfs/runtime-rules/tracked-files.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { isMain } from '../lib/is-main.mjs';
import { runCheckCli } from '../lib/check-cli.mjs';
import { envFacts } from '../lib/env-source-facts.mjs';
import { parseSource, ts } from '../hfs/runtime-rules/source-ast.mjs';

export const CATALOG_FILE = 'modules/schemas/env.yaml';
const FAILURE_CODES_FILE = 'modules/kernel/failure-codes.yaml';
const ENV_ROOTS = Object.freeze(['scripts', 'engine', 'modules', 'bin', 'ext', 'ui', 'packages']);
export const KINDS = Object.freeze(['config', 'seam', 'handoff', 'host', 'secret']);
const TEST_RUNNER_VARIABLE = 'NODE_TEST_CONTEXT';
const GENERATED = /^packages\/[^/]+(\/[^/]+)?\/runtime\//;
const VENDORED = /(^|\/)(node_modules|dist|reference-renders)\//;
const isSpec = (rel) => /\.(test|spec)\.mjs$/.test(rel) || /(^|\/)tests?\//.test(rel);
/** The catalog's variables: {NAME: {purpose, kind}} and the reader module; throws on an unreadable catalog. */
function parseCatalog(text) {
  const doc = parseYaml(text) ?? {};
  return { reader: doc.reader, variables: doc.variables ?? {} };
}

/** The findings the environment reads of one in-scope source yield (every named name joins `seen`). */
const readFindings = (reads, { rel, owner, known, seen, catalog, findings }) => {
  for (const read of reads) {
    seen.add(read.name.toUpperCase());
    if (!known.has(read.name.toUpperCase())) findings.push({ code: 'RT_ENV_UNCATALOGUED', path: rel, line: read.line, message: `${read.name} is read from the environment and is not a variable of ${CATALOG_FILE}: add it with its purpose and kind` });
    if (read.name === TEST_RUNNER_VARIABLE && !owner) findings.push({ code: 'RT_TEST_ENV_IN_PRODUCTION', path: rel, line: read.line, message: `${rel} branches on the test runner (${TEST_RUNNER_VARIABLE}): use isSpecRun() of ${catalog.reader}, the one seam` });
    else if (read.direct && !owner) findings.push({ code: 'RT_ENV_READ_OUTSIDE_OWNER', path: rel, line: read.line, message: `${read.name} is read straight from process.env in ${rel}: read it through ${catalog.reader} (readEnv), or take an injected env parameter` });
  }
};

const dynamicFindings = (dynamic, { rel, owner, catalog, findings }) => {
  for (const d of dynamic) if (d.direct && !owner) findings.push({ code: 'RT_ENV_READ_OUTSIDE_OWNER', path: rel, line: d.line, message: `a name computed at run time is read straight from process.env in ${rel}: read it through ${catalog.reader} (readEnv)` });
};

const mentionFindings = (mentions, { rel, known, seen, failureCodes, findings }) => {
  for (const m of mentions) {
    if (failureCodes.has(m.name)) continue; // a refusal code spelled STARCI_*, owned by the failure-code catalog, not a variable
    seen.add(m.name.toUpperCase());
    if (!known.has(m.name.toUpperCase())) findings.push({ code: 'RT_ENV_UNCATALOGUED', path: rel, line: m.line, message: `${m.name} is an environment variable of the runtime and is not a variable of ${CATALOG_FILE}: add it with its purpose and kind` });
  }
};

/** The findings one in-scope source's env facts yield (and the `seen` update every named name performs). */
const fileEnvFindings = (facts, ctx) => {
  readFindings(facts.reads, ctx);
  dynamicFindings(facts.dynamic, ctx);
  for (const l of facts.literals) ctx.seen.add(l.toUpperCase());
  mentionFindings(facts.mentions, ctx);
};

/**
 * The findings of a source set: [{code, path, line, message}]. files: [{rel, text}] (the runtime sources among them are
 * judged); catalog: parseCatalog(...); failureCodes: the names of modules/kernel/failure-codes.yaml (a STARCI_* refusal code is not a variable).
 */
function envFindings(files, catalog, failureCodes = new Set(), exampleNames = null) {
  const findings = [];
  // Windows environment names are case-insensitive (ComSpec is COMSPEC), so names compare upper-cased.
  const known = new Set(Object.keys(catalog.variables).map((n) => n.toUpperCase()));
  const seen = new Set();
  for (const { rel, text } of files) {
    if (!rel.endsWith('.mjs') || isSpec(rel) || !ENV_ROOTS.some((r) => rel.startsWith(`${r}/`))) continue;
    fileEnvFindings(envFacts(ts(), parseSource(text, rel)), { rel, owner: rel === catalog.reader, known, seen, failureCodes, catalog, findings });
  }
  for (const [name, entry] of Object.entries(catalog.variables)) {
    if (!seen.has(name.toUpperCase())) findings.push({ code: 'RT_ENV_STALE_ENTRY', path: CATALOG_FILE, line: 1, message: `${name} is in ${CATALOG_FILE} but no production source reads or names it: delete the entry` });
    if (typeof entry?.purpose !== 'string' || !entry.purpose.trim() || !KINDS.includes(entry?.kind)) findings.push({ code: 'RT_ENV_UNCATALOGUED', path: CATALOG_FILE, line: 1, message: `${name} needs a purpose (a sentence) and a kind (${KINDS.join('|')})` });
  }
  for (const [name, entry] of Object.entries(catalog.variables)) {
    if (entry?.kind === 'secret' && exampleNames && !exampleNames.has(name)) findings.push({ code: 'RT_ENV_UNCATALOGUED', path: 'secret.env.example', line: 1, message: `${name} is a secret of ${CATALOG_FILE} (held in the untracked secret.env) and secret.env.example does not list it: add NAME= with a comment saying what it is for and where its value comes from` });
  }
  return findings;
}

/** The variable names secret.env.example lists, commented or not (NAME=). */
const exampleNamesOf = (text) => new Set([...text.matchAll(/^#?[ \t]*([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]));

/** Run the check on the runtime at `root`. */
function checkEnv(root = skillRoot) {
  const files = trackedTextFiles(root, (rel) => rel.endsWith('.mjs') && !GENERATED.test(rel) && !VENDORED.test(rel));
  const failureCodes = new Set(Object.keys(parseYaml(fs.readFileSync(path.join(root, FAILURE_CODES_FILE), 'utf8')) ?? {}));
  const example = fs.existsSync(path.join(root, 'secret.env.example')) ? exampleNamesOf(fs.readFileSync(path.join(root, 'secret.env.example'), 'utf8')) : new Set();
  return envFindings(files, parseCatalog(fs.readFileSync(path.join(root, CATALOG_FILE), 'utf8')), failureCodes, example);
}

if (isMain(import.meta.url)) {
  runCheckCli(checkEnv(), 'OK: every environment variable is catalogued and read through its owner.');
}
