#!/usr/bin/env node
// REF-COMMENT-1: descriptions on native API calls and explicitly catalogued CLI handler bindings.
// Presence is structural; accurate contracts, difficult logic and decision rationale remain reviewed.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { loadCatalog } from '../cli/catalog.mjs';
import { callExportFinding, callFunctionName, RUNNER } from '../hfs/runtime-rules/api-shape.mjs';
import { ownerIdOf } from '../hfs/runtime-rules/external-owner.mjs';
import { lineOf, parseSource, ts } from '../hfs/runtime-rules/source-ast.mjs';
import { RUNTIME_MANIFEST_FILE, createSlotResolver, loadSlotManifest, readRepoDeclaration, ruleParams } from '../hfs/slots.mjs';
import { isMain } from '../lib/is-main.mjs';
import { hasJsdocDescription } from '../lib/jsdoc.mjs';
import { readTrackedTextFiles, runTrackedTextCheckCli } from '../lib/tracked-text-scan.mjs';

const REQUIRED = 'RT_PUBLIC_JSDOC';
const INPUT = 'RT_PUBLIC_DOCS_INPUT';
const HELP = 'Usage: check-runtime-public-docs [--root <runtime>] [--json]\n'
  + 'Checks adjacent, nonempty JSDoc descriptions at native callable boundaries. '
  + 'Requires the existing TypeScript check tooling. Exit 0 clean, 1 missing docs, 2 unreadable or unsupported input.';
const inputError = (detail) => { throw new Error(`${INPUT}: ${detail}`); };
const exported = (t, node) => node.modifiers?.some((m) => m.kind === t.SyntaxKind.ExportKeyword);
const defaulted = (t, node) => node.modifiers?.some((m) => m.kind === t.SyntaxKind.DefaultKeyword);

/** Resolve a contract-named export to its authored definition without loading executable modules. */
function publicDefinition(file, name, context, chain = new Set()) {
  const { t, sourceOf, fileSet } = context;
  const key = `${file}:${name}`;
  if (chain.has(key)) inputError(`public binding cycle at ${key}`);
  const next = new Set(chain).add(key);
  const source = sourceOf(file);
  const result = (node) => ({ file, name, node, source });
  const through = (specifier, selected) => {
    if (!specifier.startsWith('.')) inputError(`${key} re-exports an external binding`);
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
    if (!target.endsWith('.mjs') || target.startsWith('../') || !fileSet.has(target)) inputError(`${key} refers to an unavailable runtime module ${target}`);
    return publicDefinition(target, selected, context, next);
  };
  const local = (selected) => {
    for (const node of source.statements) {
      if ((t.isFunctionDeclaration(node) || t.isClassDeclaration(node)) && node.name?.text === selected) return result(node);
      if (t.isVariableStatement(node) && node.declarationList.declarations.some((d) => t.isIdentifier(d.name) && d.name.text === selected)) return result(node);
      if (t.isImportDeclaration(node) && t.isStringLiteral(node.moduleSpecifier)) {
        const clause = node.importClause;
        if (clause?.name?.text === selected) return through(node.moduleSpecifier.text, 'default');
        const bindings = clause?.namedBindings;
        if (bindings && t.isNamedImports(bindings)) {
          const binding = bindings.elements.find((el) => el.name.text === selected);
          if (binding) return through(node.moduleSpecifier.text, (binding.propertyName ?? binding.name).text);
        }
      }
    }
    return inputError(`${key} has no authored definition for ${selected}`);
  };
  for (const node of source.statements) {
    if (exported(t, node)) {
      if ((t.isFunctionDeclaration(node) || t.isClassDeclaration(node)) && (defaulted(t, node) ? name === 'default' : node.name?.text === name)) return result(node);
      if (t.isVariableStatement(node) && node.declarationList.declarations.some((d) => t.isIdentifier(d.name) && d.name.text === name)) return result(node);
    }
    if (t.isExportDeclaration(node) && node.exportClause && t.isNamedExports(node.exportClause)) {
      const binding = node.exportClause.elements.find((el) => el.name.text === name);
      if (!binding) continue;
      const selected = (binding.propertyName ?? binding.name).text;
      if (node.moduleSpecifier && t.isStringLiteral(node.moduleSpecifier)) return through(node.moduleSpecifier.text, selected);
      return local(selected);
    }
    if (name === 'default' && t.isExportAssignment(node) && !node.isExportEquals) {
      return t.isIdentifier(node.expression) ? local(node.expression.text) : result(node);
    }
  }
  // Star exports do not establish a unique named owner; report the unresolved contract instead of guessing.
  return inputError(`${key} is not an explicit exported definition`);
}

/** A JSDoc description belongs to the definition only when no code or other comment separates them. */
function descriptionOf({ node, source }, t) {
  const comment = (t.getLeadingCommentRanges(source.text, node.getFullStart()) ?? []).at(-1);
  if (!comment || !source.text.slice(comment.pos, comment.end).startsWith('/**')) return null;
  if (source.text.slice(comment.end, node.getStart(source)).trim()) return null;
  const doc = node.jsDoc?.find((item) => item.pos === comment.pos);
  if (!doc) return null;
  const description = typeof doc.comment === 'string' ? doc.comment : t.getTextOfJSDocComment(doc.comment);
  // Tags describe types/visibility; they do not replace the caller-facing description.
  return hasJsdocDescription(description) ? description : null;
}

/** Check only contract-selected bindings; factories and classes are not skipped as ordinary data exports. */
export function publicDocFindings({ files, read, resolver, catalog, parse = parseSource, compiler = ts }) {
  const t = compiler();
  const fileSet = new Set(files);
  const parsed = new Map();
  const sourceOf = (file) => {
    if (!fileSet.has(file)) inputError(`${file} is outside the current runtime inventory`);
    if (!parsed.has(file)) {
      const text = read(file);
      if (typeof text !== 'string') inputError(`${file} cannot be read`);
      const source = parse(text, file);
      if (source.parseDiagnostics?.length) inputError(`${file} does not parse`);
      parsed.set(file, source);
    }
    return parsed.get(file);
  };
  const selected = new Map();
  const add = (file, name, contract) => {
    if (typeof file !== 'string' || !/^(scripts|ui)\//.test(file) || !file.endsWith('.mjs') || path.posix.normalize(file) !== file || typeof name !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(name)) inputError(`invalid callable binding in ${contract}`);
    const key = `${file}:${name}`;
    const selection = selected.get(key) ?? { file, name, contracts: [] };
    selection.contracts.push(contract);
    selected.set(key, selection);
  };
  for (const file of files.filter((entry) => entry.endsWith('.mjs'))) {
    if (resolver.tierOf(file) !== 'api' || !ownerIdOf(resolver, file) || path.posix.basename(file) === RUNNER) continue;
    const shape = callExportFinding(file, sourceOf(file));
    if (shape) inputError(shape.message);
    add(file, callFunctionName(path.posix.basename(file, '.mjs')), 'native-api-shape');
  }
  if (!Array.isArray(catalog?.groups)) inputError('CLI catalog has no groups');
  for (const group of catalog.groups) {
    if (!Array.isArray(group?.verbs)) inputError('CLI catalog group has no verbs');
    for (const verb of group.verbs) {
      if (!verb.impl || !Object.hasOwn(verb.impl, 'module')) continue;
      add(verb.impl.module, verb.impl.export, `starci ${group.group} ${verb.verb}`);
    }
  }
  const findings = [];
  const context = { t, sourceOf, fileSet };
  const definitions = new Map();
  for (const selection of selected.values()) {
    const definition = publicDefinition(selection.file, selection.name, context);
    const key = `${definition.file}:${definition.node.getStart(definition.source)}`;
    const bound = definitions.get(key) ?? { ...definition, contracts: [] };
    bound.contracts.push(...selection.contracts);
    definitions.set(key, bound);
  }
  for (const definition of definitions.values()) {
    if (descriptionOf(definition, t)) continue;
    const line = lineOf(definition.source, definition.node);
    findings.push({ code: REQUIRED, path: definition.file, line, symbol: definition.name, contracts: definition.contracts,
      message: `${definition.file}:${line} ${definition.name} needs an adjacent JSDoc description for its public caller contract` });
  }
  findings.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
  return { schema: 'starci/runtime-public-docs-check@1', ok: findings.length === 0,
    selected: selected.size, definitions: definitions.size, findings,
    limitations: 'Description presence only; contract accuracy, difficult logic and important rationale require review.verify.' };
}

/** Inspect the current runtime tree, including new nonignored paths; never run or import a selected implementation. */
export function scanRuntimePublicDocs(root = skillRoot, deps = {}) {
  const files = deps.files ?? readTrackedTextFiles(root, { listFiles: lsFiles, workingTree: true });
  const manifest = deps.manifest ?? loadSlotManifest({ root, file: path.join(root, RUNTIME_MANIFEST_FILE) });
  const repo = readRepoDeclaration(manifest, root);
  const resolver = deps.resolver ?? createSlotResolver(manifest, repo);
  // Retain the native runtime parameters as the boundary; an app manifest is not a runtime doc check.
  ruleParams(manifest, 'runtime');
  if (manifest.kind !== 'runtime' || repo.kind !== 'runtime') inputError(`${root} is not a runtime tree`);
  return publicDocFindings({ files, read: deps.read ?? ((file) => fs.readFileSync(path.join(root, file), 'utf8')),
    resolver, catalog: deps.catalog ?? loadCatalog(root), parse: deps.parse ?? parseSource, compiler: deps.compiler ?? ts });
}

/** Native named-check entry: tooling/input failures exit 2, never an empty or passing report. */
export function main(argv = [], io = process, deps = {}) {
  return runTrackedTextCheckCli(argv, io, { command: 'check-runtime-public-docs', help: HELP, defaultRoot: skillRoot,
    scan: deps.scan ?? scanRuntimePublicDocs,
    cleanText: (r) => `runtime-public-docs: ${r.definitions} public definitions have adjacent descriptions`,
    findingText: (f) => `${f.code} ${f.message}`,
    redText: (r) => `runtime-public-docs: ${r.findings.length} missing description(s)` });
}

if (isMain(import.meta.url)) process.exitCode = main(process.argv.slice(2));
