import { builtinModules } from 'node:module';
import { sourceLocation } from '../../lib/ts-ast.mjs';
import { isServerActionModule } from './server-action.mjs';

/**
 * R55 `client-reaches-server` (FE_CLIENT_REACHES_SERVER), the repository half of the eslint rule `client-no-server-import`,
 * which sees one hop from a file that carries the directive. The machine walks the resolved import graph from every module
 * whose first statement is the `"use client"` directive, over runtime edges only (a type-only import vanishes at build), and
 * reports any reachable module (the entry itself included) that imports a server-only surface:
 *
 *   - `server-only`, `next/headers`, `next/server`, `next-intl/server`;
 *   - a Node built-in: `node:*` and every bare name of `module.builtinModules` (`fs`, `path`, `crypto`, ...).
 *
 * The finding sits on the client entry, names the shortest import chain from it to the offending module (multi-hop) and the
 * specifier. Only imports that reach the client bundle count: `import type`, an import whose every named specifier is
 * `type`, and `export type` re-exports are skipped.
 */
export const CLIENT_REACHES_SERVER_RULE_IDS = ['FE_CLIENT_REACHES_SERVER'];

const RULE = 'FE_CLIENT_REACHES_SERVER';
const SERVER_MODULES = new Set(['server-only', 'next/headers', 'next/server', 'next-intl/server']);
const NODE_BUILTINS = new Set(builtinModules.map(name => name.replace(/^node:/u, '').split('/')[0]));

const isServerSpecifier = specifier => SERVER_MODULES.has(specifier) || specifier.startsWith('node:') || NODE_BUILTINS.has(specifier.split('/')[0]);
const isClientEntry = (ts, file) => {
  const first = file.sourceFile.statements[0];
  return Boolean(first) && ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression) && first.expression.text === 'use client';
};

const reachesBundle = (ts, declaration) => {
  if (ts.isImportDeclaration(declaration)) {
    const clause = declaration.importClause;
    if (!clause) return true;
    if (clause.isTypeOnly) return false;
    if (!clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      const elements = clause.namedBindings.elements;
      return elements.length === 0 || !elements.every(element => element.isTypeOnly);
    }
    return true;
  }
  return !declaration.isTypeOnly;
};

const serverImports = (ts, file) => {
  const found = [];
  const visit = node => {
    let specifier = null;
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && reachesBundle(ts, node)) specifier = node.moduleSpecifier;
    else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) specifier = node.arguments[0];
    if (specifier && ts.isStringLiteralLike(specifier) && isServerSpecifier(specifier.text)) found.push({ specifier: specifier.text, node });
    ts.forEachChild(node, visit);
  };
  visit(file.sourceFile);
  return found;
};

const scanClientEntry = (entry, { ts, graph, runtime, violations }) => {
  const seen = new Map([[entry.rel, { chain: [entry.rel], first: null }]]);
  const queue = [entry.rel];
  for (const rel of queue) {
    if (isServerActionModule(ts, graph.files.get(rel).sourceFile)) continue;
    const state = seen.get(rel);
    for (const hit of runtime.serverOf(rel)) {
      const at = state.first ?? sourceLocation(graph.files.get(rel).sourceFile, hit.node);
      violations.push({
        ruleId: RULE, path: entry.rel, line: at.line, column: at.column, clientEntry: entry.rel, importer: rel, specifier: hit.specifier, dependencyChain: state.chain,
        message: `${entry.rel} is a client module ("use client") and reaches ${hit.specifier} through ${[...state.chain, hit.specifier].join(' -> ')}; a server-only surface never enters the client bundle. Read on the server and pass the value down, or move the import out of the client graph.`,
      });
    }
    for (const edge of runtime.edges.get(rel) ?? []) {
      if (seen.has(edge.to)) continue;
      seen.set(edge.to, { chain: [...state.chain, edge.to], first: state.first ?? { line: edge.line, column: edge.column } });
      queue.push(edge.to);
    }
  }
};

export function checkClientReachesServer({ graph, context }) {
  const ts = context.ts;
  const runtime = new Map();
  for (const edge of graph.edges) {
    if (!edge.runtime) continue;
    if (!runtime.has(edge.from)) runtime.set(edge.from, []);
    runtime.get(edge.from).push(edge);
  }
  const serverByFile = new Map();
  const serverOf = rel => {
    if (!serverByFile.has(rel)) serverByFile.set(rel, serverImports(ts, graph.files.get(rel)));
    return serverByFile.get(rel);
  };

  const violations = [];
  const entries = [...graph.files.values()].filter(file => isClientEntry(ts, file)).sort((a, b) => a.rel.localeCompare(b.rel));
  const scanRuntime = { ts, graph, edges: runtime, serverOf, violations };
  for (const entry of entries) scanClientEntry(entry, { ts, graph, runtime: scanRuntime, violations });
  return { violations, coverage: { status: 'checked', clientEntries: entries.length } };
}
